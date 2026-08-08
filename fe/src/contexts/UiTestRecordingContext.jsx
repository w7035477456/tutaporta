import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  completeGraphicalTestRunLoop,
  startGraphicalTestRecording,
  startGraphicalTestRun,
  stopGraphicalTestRecording,
  stopGraphicalTestRun
} from 'api/adminUiTestRecordingsFe';
import {
  applyRecordedScroll,
  buildSelectorForElement,
  captureClickStep,
  captureDragDropStep,
  captureFillStep,
  captureScrollStep,
  clearReplayRecordViewport,
  isRecordableInputElement,
  performUiTestStep,
  readAppScrollState,
  readInputValue,
  scrollStateSignature,
  setReplayRecordViewport,
  sleep
} from 'utils/uiTestRecording';
import { animateReplayCursorForStep, hideReplayCursor, showReplayCursor } from 'utils/uiTestReplayCursor';

const UiTestRecordingContext = createContext(null);

export function UiTestRecordingProvider({ children }) {
  const [recordingId, setRecordingId] = useState(null);
  const [recordingStartedAt, setRecordingStartedAt] = useState(null);
  const [recordedSteps, setRecordedSteps] = useState([]);
  const [runningRecordingId, setRunningRecordingId] = useState(null);
  const [runningTestNumber, setRunningTestNumber] = useState(null);
  const [runId, setRunId] = useState(null);
  const [liveDurationSec, setLiveDurationSec] = useState(0);

  const stepsRef = useRef([]);
  const stopRunRef = useRef(false);
  const runSessionRef = useRef({ recordingId: null, runId: null, runDeadlineMs: null });
  const inputDebounceRef = useRef(new Map());
  const lastFillKeyRef = useRef(null);
  const scrollDebounceRef = useRef(null);
  const lastScrollRef = useRef('');
  const dragStartRef = useRef(null);

  const appendStep = useCallback((step) => {
    if (step.actionType === 'fill') {
      const steps = stepsRef.current;
      const lastIdx = steps.length - 1;
      const last = steps[lastIdx];
      if (last?.actionType === 'fill') {
        const sameTarget =
          (step.selector && step.selector === last.selector) ||
          (!step.selector && !last.selector && step.x === last.x && step.y === last.y);
        if (sameTarget) {
          const next = [...steps];
          next[lastIdx] = { ...step, stepOrder: last.stepOrder };
          stepsRef.current = next;
          setRecordedSteps(next);
          lastFillKeyRef.current = `${step.selector ?? ''}|${step.x ?? ''}|${step.y ?? ''}|${step.valueText ?? ''}`;
          return;
        }
      }
    }
    const last = stepsRef.current[stepsRef.current.length - 1];
    if (step.actionType === 'fill' && last?.actionType === 'fill') {
      const sameTarget =
        (step.selector && step.selector === last.selector) ||
        (!step.selector && !last.selector && step.x === last.x && step.y === last.y);
      if (sameTarget && step.valueText === last.valueText) {
        return;
      }
    }
    stepsRef.current = [...stepsRef.current, step];
    setRecordedSteps(stepsRef.current);
  }, []);

  const recordFillFromElement = useCallback(
    (element) => {
      if (!isRecordableInputElement(element)) return;
      const value = readInputValue(element);
      const step = captureFillStep(element, stepsRef.current.length + 1, 5000);
      const fillKey = `${step.selector ?? ''}|${step.x ?? ''}|${step.y ?? ''}|${value}`;
      if (lastFillKeyRef.current === fillKey) return;
      lastFillKeyRef.current = fillKey;
      appendStep(step);
    },
    [appendStep]
  );

  const flushPendingFillCaptures = useCallback(() => {
    for (const [element, timeoutId] of inputDebounceRef.current.entries()) {
      window.clearTimeout(timeoutId);
      recordFillFromElement(element);
    }
    inputDebounceRef.current.clear();
  }, [recordFillFromElement]);

  const scheduleFillCapture = useCallback(
    (element) => {
      if (!isRecordableInputElement(element)) return;
      const existing = inputDebounceRef.current.get(element);
      if (existing) window.clearTimeout(existing);
      const timeoutId = window.setTimeout(() => {
        inputDebounceRef.current.delete(element);
        recordFillFromElement(element);
      }, 400);
      inputDebounceRef.current.set(element, timeoutId);
    },
    [recordFillFromElement]
  );

  const isRecording = recordingId != null;
  const isRunning = runningRecordingId != null;

  useEffect(() => {
    if (!isRecording || !recordingStartedAt) {
      setLiveDurationSec(0);
      return undefined;
    }
    const tick = () => {
      setLiveDurationSec(Math.floor((Date.now() - recordingStartedAt) / 1000));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [isRecording, recordingStartedAt]);

  useEffect(() => {
    if (!isRecording) return undefined;

    const onClick = (event) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      const target = event.target;
      if (target instanceof Element && target.closest('[data-ui-test-ignore]')) return;

      flushPendingFillCaptures();

      const nextOrder = stepsRef.current.length + 1;
      const step = captureClickStep(event, nextOrder, 5000);
      appendStep(step);
    };

    const onInput = (event) => {
      const target = event.target;
      if (!isRecordableInputElement(target)) return;
      scheduleFillCapture(target);
    };

    const onChange = (event) => {
      const target = event.target;
      if (!isRecordableInputElement(target)) return;
      const pending = inputDebounceRef.current.get(target);
      if (pending) {
        window.clearTimeout(pending);
        inputDebounceRef.current.delete(target);
      }
      recordFillFromElement(target);
    };

    const onScroll = () => {
      if (scrollDebounceRef.current) window.clearTimeout(scrollDebounceRef.current);
      scrollDebounceRef.current = window.setTimeout(() => {
        scrollDebounceRef.current = null;
        const state = readAppScrollState();
        const signature = scrollStateSignature(state);
        if (signature === lastScrollRef.current) return;
        lastScrollRef.current = signature;
        const nextOrder = stepsRef.current.length + 1;
        appendStep(captureScrollStep(nextOrder, 400));
      }, 180);
    };

    const onDragStart = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-ui-test-ignore]')) return;
      const meta = buildSelectorForElement(target);
      dragStartRef.current = {
        meta: { selector: meta?.selector ?? null, selectorFallback: meta?.selectorFallback ?? null },
        point: {
          x: Math.round(Number(event.clientX ?? 0)),
          y: Math.round(Number(event.clientY ?? 0))
        }
      };
    };

    const onDrop = (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-ui-test-ignore]')) {
        dragStartRef.current = null;
        return;
      }
      const nextOrder = stepsRef.current.length + 1;
      appendStep(captureDragDropStep(event, nextOrder, dragStartRef.current, 1200));
      dragStartRef.current = null;
    };

    const onDragEnd = () => {
      dragStartRef.current = null;
    };

    document.addEventListener('click', onClick, true);
    document.addEventListener('input', onInput, true);
    document.addEventListener('change', onChange, true);
    document.addEventListener('dragstart', onDragStart, true);
    document.addEventListener('drop', onDrop, true);
    document.addEventListener('dragend', onDragEnd, true);
    // Capture phase: nested overflow:auto columns (e.g. /myStory) do not scroll the window.
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('change', onChange, true);
      document.removeEventListener('dragstart', onDragStart, true);
      document.removeEventListener('drop', onDrop, true);
      document.removeEventListener('dragend', onDragEnd, true);
      document.removeEventListener('scroll', onScroll, true);
      if (scrollDebounceRef.current) window.clearTimeout(scrollDebounceRef.current);
      scrollDebounceRef.current = null;
      dragStartRef.current = null;
      flushPendingFillCaptures();
      inputDebounceRef.current.clear();
      lastFillKeyRef.current = null;
    };
  }, [isRecording, appendStep, flushPendingFillCaptures, recordFillFromElement, scheduleFillCapture]);

  const beginRecording = useCallback(async (id) => {
    const numericId = Number(id);
    if (!Number.isFinite(numericId) || numericId < 1) return;
    await startGraphicalTestRecording(numericId);
    stepsRef.current = [];
    setRecordedSteps([]);
    lastFillKeyRef.current = null;
    inputDebounceRef.current.clear();
    lastScrollRef.current = scrollStateSignature(readAppScrollState());
    dragStartRef.current = null;
    setRecordingId(numericId);
    setRecordingStartedAt(Date.now());
    stopRunRef.current = true;
  }, []);

  const finishRecording = useCallback(async () => {
    const id = recordingId;
    if (!id) return null;
    const durationSeconds = recordingStartedAt
      ? Math.max(0, Math.floor((Date.now() - recordingStartedAt) / 1000))
      : 0;
    const payload = {
      steps: stepsRef.current,
      durationSeconds,
      targetPath: window.location.pathname,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };
    const data = await stopGraphicalTestRecording(id, payload);
    setRecordingId(null);
    setRecordingStartedAt(null);
    stepsRef.current = [];
    setRecordedSteps([]);
    lastFillKeyRef.current = null;
    inputDebounceRef.current.clear();
    return data?.recording ?? null;
  }, [recordingId, recordingStartedAt]);

  const beginRun = useCallback(async (id, onRecordingUpdate, runOptions = {}) => {
    const numericId = Number(id);
    if (!Number.isFinite(numericId) || numericId < 1) return null;

    const durationMinutes = runOptions.durationMinutes ?? null;
    const delaySec = Math.max(1, Math.round(Number(runOptions.delaySec ?? 5)));

    stopRunRef.current = false;
    const data = await startGraphicalTestRun(numericId, {
      durationMinutes: durationMinutes == null ? 'Infinite' : durationMinutes,
      delaySec
    });
    const steps = Array.isArray(data?.steps) ? data.steps : [];
    const sessionRunId = Number(data?.runId);
    const stepDelayMs = Number(data?.stepIntervalMs) || delaySec * 1000;
    const runDeadlineMs =
      durationMinutes != null && Number(durationMinutes) > 0
        ? Date.now() + Number(durationMinutes) * 60 * 1000
        : null;

    runSessionRef.current = { recordingId: numericId, runId: sessionRunId, runDeadlineMs };
    setRunningRecordingId(numericId);
    setRunningTestNumber(
      Number.isFinite(Number(runOptions?.testNumber)) && Number(runOptions.testNumber) > 0
        ? Number(runOptions.testNumber)
        : null
    );
    setRunId(sessionRunId);

    if (typeof onRecordingUpdate === 'function') {
      onRecordingUpdate(data?.recording ?? null);
    }

    setReplayRecordViewport(data?.recording?.viewportWidth, data?.recording?.viewportHeight);
    showReplayCursor();

    const isRunExpired = () =>
      runDeadlineMs != null && Date.now() >= runDeadlineMs;
    const onRunSummary = typeof runOptions?.onRunSummary === 'function' ? runOptions.onRunSummary : null;
    const onLoopSummary = typeof runOptions?.onLoopSummary === 'function' ? runOptions.onLoopSummary : null;
    let endReason = 'manual';
    let endError = null;
    let replayError = null;

    try {
      while (!stopRunRef.current && !isRunExpired()) {
        for (const step of steps) {
          if (stopRunRef.current || isRunExpired()) break;
          const ts = new Date().toISOString();
          const selector = String(step?.selector ?? '').trim();
          const fallbackSelector = String(step?.selectorFallback ?? '').trim();
          if (!selector && !fallbackSelector) {
            console.warn('[ui-test] selector missing; falling back to coordinates', {
              timestamp: ts,
              recordingId: numericId,
              runId: sessionRunId,
              stepOrder: step?.stepOrder ?? null,
              actionType: step?.actionType ?? null,
              hasCoordinates: Number.isFinite(Number(step?.x)) && Number.isFinite(Number(step?.y))
            });
          }
          applyRecordedScroll(step);
          await animateReplayCursorForStep(step);
          const ok = performUiTestStep(step);
          if (!ok) {
            console.warn('[ui-test] step target not found; skipping step', {
              timestamp: ts,
              recordingId: numericId,
              runId: sessionRunId,
              stepOrder: step?.stepOrder ?? null,
              actionType: step?.actionType ?? null,
              selector: selector || null,
              selectorFallback: fallbackSelector || null
            });
            continue;
          }
          await sleep(stepDelayMs);
        }
        if (stopRunRef.current || isRunExpired()) break;
        try {
          const loopData = await completeGraphicalTestRunLoop(numericId, sessionRunId);
          if (loopData?.memorySnapshotMb) {
            console.info('[ui-test] loop complete', {
              recordingId: numericId,
              runId: sessionRunId,
              loopCount: loopData?.recording?.loopCount,
              memorySnapshotMb: loopData.memorySnapshotMb
            });
          }
          if (onLoopSummary) {
            onLoopSummary(loopData?.loopSummary ?? null, loopData?.logFile ?? null);
          }
          if (typeof onRecordingUpdate === 'function') {
            onRecordingUpdate(loopData?.recording ?? null);
          }
        } catch (err) {
          const status = err?.response?.status;
          const payload = err?.response?.data;
          console.warn('[ui-test] loop failed', {
            recordingId: numericId,
            runId: sessionRunId,
            status,
            error: payload?.error || err?.message || 'Loop failed'
          });
          endReason = 'loop_error';
          endError = payload?.error || err?.message || 'Loop failed';
          throw err;
        }
      }
      if (!stopRunRef.current && isRunExpired()) {
        endReason = 'duration';
      }
    } catch (err) {
      replayError = err;
      if (!endError) {
        endReason = 'error';
        endError = err?.response?.data?.error || err?.message || 'Replay failed';
      }
    } finally {
      hideReplayCursor();
      clearReplayRecordViewport();
    }

    const session = runSessionRef.current;
    if (session.recordingId === numericId && session.runId === sessionRunId) {
      stopRunRef.current = true;
      setRunningRecordingId(null);
      setRunningTestNumber(null);
      setRunId(null);
      runSessionRef.current = { recordingId: null, runId: null, runDeadlineMs: null };
      try {
        const stopData = await stopGraphicalTestRun(numericId, sessionRunId, {
          endReason,
          endError
        });
        if (onRunSummary) {
          onRunSummary(stopData?.runSummary ?? null, stopData?.logFile ?? null);
        }
        if (typeof onRecordingUpdate === 'function') {
          onRecordingUpdate(stopData?.recording ?? null);
        }
        if (replayError) throw replayError;
        return stopData ?? null;
      } catch (err) {
        if (replayError) throw replayError;
        replayError = err;
        return null;
      }
    }

    if (replayError) throw replayError;
    return null;
  }, []);

  const finishRun = useCallback(async () => {
    const { recordingId: id, runId: activeRunId } = runSessionRef.current;
    stopRunRef.current = true;
    hideReplayCursor();
    clearReplayRecordViewport();
    setRunningRecordingId(null);
    setRunningTestNumber(null);
    setRunId(null);
    runSessionRef.current = { recordingId: null, runId: null, runDeadlineMs: null };
    if (!id) return null;
    const data = await stopGraphicalTestRun(id, activeRunId, { endReason: 'manual' });
    return data ?? null;
  }, []);

  const value = useMemo(
    () => ({
      recordingId,
      isRecording,
      isRunning,
      runningRecordingId,
      runningTestNumber,
      runId,
      recordedSteps,
      liveDurationSec,
      liveStepsCount: recordedSteps.length,
      beginRecording,
      finishRecording,
      beginRun,
      finishRun
    }),
    [
      recordingId,
      isRecording,
      isRunning,
      runningRecordingId,
      runningTestNumber,
      runId,
      recordedSteps,
      liveDurationSec,
      beginRecording,
      finishRecording,
      beginRun,
      finishRun
    ]
  );

  return <UiTestRecordingContext.Provider value={value}>{children}</UiTestRecordingContext.Provider>;
}

export function useUiTestRecording() {
  const ctx = useContext(UiTestRecordingContext);
  if (!ctx) {
    throw new Error('useUiTestRecording must be used within UiTestRecordingProvider');
  }
  return ctx;
}
