import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import CloseIcon from '@mui/icons-material/Close';

import {
  createGraphicalTestRecording,
  deleteGraphicalTestRecording,
  fetchGraphicalTestLogs,
  fetchGraphicalTestRecordings,
  patchGraphicalTestRecording,
  resetGraphicalTestLogs,
  resetGraphicalTestRecordingLoop
} from 'api/adminUiTestRecordingsFe';
import { useUiTestRecording } from 'contexts/UiTestRecordingContext';
import { formatDurationSeconds, formatStepsLabel, parseUiTestDisplayNumber } from 'utils/uiTestRecording';
import ColorTemplate9TableData from 'ui-component/ColorTemplate9TableData';
import { colorTemplate9TableBodyTextSx } from 'config/colorTemplate9TableData';
import UiTestRunConfigDialog from 'views/utilities/UiTestRunConfigDialog';
import UiTestPgErrorCountsBar from 'views/utilities/UiTestPgErrorCountsBar';
import FullHdAdjustButton from 'ui-component/FullHdAdjustButton';
import { isFullHdAdjustEnabled } from 'config/fullHdViewportEnv';
import { themedConfirm } from 'utils/themedDialog';

function runButtonSx(isStop) {
  return {
    borderRadius: 999,
    bgcolor: isStop ? '#c62828' : '#2e7d32',
    color: '#fff',
    '&:hover': {
      bgcolor: isStop ? '#b71c1c' : '#1b5e20',
      color: '#fff',
      boxShadow: 'none'
    }
  };
}

function recordButtonSx(isStop) {
  return {
    borderRadius: 999,
    border: '2px solid #000',
    bgcolor: isStop ? '#c62828' : 'var(--theme-yellow-color, #FFEB3B)',
    color: '#000',
    '&:hover': {
      bgcolor: isStop ? '#b71c1c' : 'var(--theme-yellow-color, #FFEB3B)',
      color: '#000',
      boxShadow: 'none'
    }
  };
}

function TestTableHeader() {
  return (
    <ColorTemplate9TableData.UiTestHeaderRow>
      <ColorTemplate9TableData.UiTestHeaderCell aria-hidden />
      <ColorTemplate9TableData.UiTestHeaderCell>Run</ColorTemplate9TableData.UiTestHeaderCell>
      <ColorTemplate9TableData.UiTestHeaderCell>Record</ColorTemplate9TableData.UiTestHeaderCell>
      <ColorTemplate9TableData.UiTestHeaderCell># Loop</ColorTemplate9TableData.UiTestHeaderCell>
      <ColorTemplate9TableData.UiTestHeaderCell>Name</ColorTemplate9TableData.UiTestHeaderCell>
      <ColorTemplate9TableData.UiTestHeaderCell>Steps</ColorTemplate9TableData.UiTestHeaderCell>
      <ColorTemplate9TableData.UiTestHeaderCell>Duration</ColorTemplate9TableData.UiTestHeaderCell>
    </ColorTemplate9TableData.UiTestHeaderRow>
  );
}

function logCellTextSx() {
  return {
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
    lineHeight: 1.25
  };
}

const LOG_VIEWER_GRID_COLUMNS = '220px 180px 120px 90px minmax(480px, 1fr)';

export default function AdminToolsTestTab({ onError }) {
  const [recordings, setRecordings] = useState([]);
  const [runEvents, setRunEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [runConfigTarget, setRunConfigTarget] = useState(null);
  const [logEntries, setLogEntries] = useState([]);
  const [logFilePath, setLogFilePath] = useState('');
  const [logFilesCount, setLogFilesCount] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showLeaksOnly, setShowLeaksOnly] = useState(false);
  const logPanelScrollRef = useRef(null);
  const newestLogRowRef = useRef(null);
  const {
    recordingId: activeRecordingId,
    isRecording,
    isRunning,
    runningRecordingId,
    liveDurationSec,
    liveStepsCount,
    beginRecording,
    finishRecording,
    beginRun,
    finishRun
  } = useUiTestRecording();

  const sortRecordingsStable = useCallback((list) => {
    return [...list].sort((a, b) => Number(a.recordingId) - Number(b.recordingId));
  }, []);

  const loadRecordings = useCallback(async () => {
    try {
      const data = await fetchGraphicalTestRecordings();
      const rows = Array.isArray(data?.recordings) ? data.recordings : [];
      setRecordings(sortRecordingsStable(rows));
    } catch (err) {
      onError?.(err?.response?.data?.error || err?.message || 'Failed to load UI tests');
      setRecordings([]);
    } finally {
      setLoading(false);
    }
  }, [onError, sortRecordingsStable]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await fetchGraphicalTestLogs();
      setLogEntries(Array.isArray(data?.entries) ? data.entries : []);
      setLogFilePath(String(data?.logFile || ''));
      setLogFilesCount(Number(data?.filesCount) || 0);
    } catch (err) {
      onError?.(err?.response?.data?.error || err?.message || 'Failed to load UI test logs');
      setLogEntries([]);
      setLogFilePath('');
      setLogFilesCount(0);
    } finally {
      setLogsLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void loadRecordings();
  }, [loadRecordings]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (!logEntries.length) return;
    if (logPanelScrollRef.current) {
      logPanelScrollRef.current.scrollTop = 0;
    }
    if (newestLogRowRef.current) {
      newestLogRowRef.current.focus();
    }
  }, [logEntries]);

  const filteredLogEntries = [...logEntries]
    .reverse()
    .filter((entry) => {
      if (!showLeaksOnly) return true;
      return entry?.leakDetected === true || String(entry?.leakStatus || '').toLowerCase() === 'leak detected';
    });

  const upsertRecording = useCallback((recording) => {
    if (!recording?.recordingId) return;
    setRecordings((prev) => {
      const idx = prev.findIndex((r) => r.recordingId === recording.recordingId);
      if (idx === -1) return sortRecordingsStable([...prev, recording]);
      const next = [...prev];
      next[idx] = { ...next[idx], ...recording };
      return next;
    });
  }, [sortRecordingsStable]);

  const appendRunEvent = useCallback((summary, logFile) => {
    if (!summary) return;
    const next = {
      ...summary,
      logFile: logFile || null,
      endedAt: summary?.endedAt || new Date().toISOString()
    };
    setRunEvents((prev) => [next, ...prev].slice(0, 30));
    void loadLogs();
  }, [loadLogs]);

  const appendRunEndLog = useCallback((runSummary, logFile) => {
    if (!runSummary) return;
    appendRunEvent(runSummary, logFile);
  }, [appendRunEvent]);

  const appendLoopLog = useCallback((loopSummary, logFile) => {
    if (!loopSummary) return;
    appendRunEvent(loopSummary, logFile);
  }, [appendRunEvent]);

  const handleAdd = async () => {
    setBusyId('new');
    onError?.('');
    try {
      const data = await createGraphicalTestRecording(`Test ${recordings.length + 1}`);
      if (data?.recording) {
        setRecordings((prev) => sortRecordingsStable([...prev, data.recording]));
      }
    } catch (err) {
      onError?.(err?.response?.data?.error || err?.message || 'Failed to create test');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (recording) => {
    if (!(await themedConfirm(`Delete "${recording.name}"?`))) return;
    setBusyId(recording.recordingId);
    onError?.('');
    try {
      await deleteGraphicalTestRecording(recording.recordingId);
      setRecordings((prev) => prev.filter((r) => r.recordingId !== recording.recordingId));
      if (activeRecordingId === recording.recordingId && isRecording) {
        await finishRecording();
      }
      if (runningRecordingId === recording.recordingId && isRunning) {
        await finishRun();
      }
    } catch (err) {
      onError?.(err?.response?.data?.error || err?.message || 'Failed to delete test');
    } finally {
      setBusyId(null);
    }
  };

  const handleNameBlur = async (recording, name) => {
    const trimmed = String(name ?? '').trim();
    if (!trimmed || trimmed === recording.name) return;
    try {
      const data = await patchGraphicalTestRecording(recording.recordingId, { name: trimmed });
      if (data?.recording) upsertRecording(data.recording);
    } catch (err) {
      onError?.(err?.response?.data?.error || err?.message || 'Failed to update name');
    }
  };

  const handleResetLoop = async (recording) => {
    if ((recording.loopCount ?? 0) === 0) return;
    setBusyId(recording.recordingId);
    onError?.('');
    try {
      const data = await resetGraphicalTestRecordingLoop(recording.recordingId);
      if (data?.recording) upsertRecording(data.recording);
    } catch (err) {
      onError?.(err?.response?.data?.error || err?.message || 'Failed to reset loop count');
    } finally {
      setBusyId(null);
    }
  };

  const handleRecordToggle = async (recording) => {
    const id = recording.recordingId;
    setBusyId(id);
    onError?.('');
    try {
      if (isRecording && activeRecordingId === id) {
        const updated = await finishRecording();
        if (updated) upsertRecording(updated);
      } else {
        if (isRunning) await finishRun();
        await beginRecording(id);
        upsertRecording({ ...recording, recordStatus: 'recording', runStatus: 'idle' });
      }
    } catch (err) {
      onError?.(err?.response?.data?.error || err?.message || 'Recording failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleRunToggle = async (recording) => {
    const id = recording.recordingId;
    onError?.('');
    if (isRunning && runningRecordingId === id) {
      setBusyId(id);
      try {
        const stopData = await finishRun();
        if (stopData?.recording) upsertRecording(stopData.recording);
        appendRunEndLog(stopData?.runSummary, stopData?.logFile);
      } catch (err) {
        onError?.(err?.response?.data?.error || err?.message || 'Failed to stop replay');
      } finally {
        setBusyId(null);
      }
      return;
    }

    if (isRunning && runningRecordingId !== id) {
      onError?.('Stop the other running test in this browser first');
      return;
    }
    if (isRecording) {
      onError?.('Stop recording before running a replay');
      return;
    }
    if (!recording.stepsCount) {
      onError?.('Record steps first');
      return;
    }

    setRunConfigTarget(recording);
  };

  const handleRunConfigClose = () => {
    setRunConfigTarget(null);
  };

  const handleResetAllLogs = useCallback(async () => {
    try {
      await resetGraphicalTestLogs();
      setRunEvents([]);
      setLogEntries([]);
      setLogFilePath('');
      setLogFilesCount(0);
    } catch (err) {
      onError?.(err?.response?.data?.error || err?.message || 'Failed to reset UI test logs');
    }
  }, [onError]);

  const handleRunConfigConfirm = ({ durationMinutes, delaySec }) => {
    const recording = runConfigTarget;
    if (!recording) return;
    if (typeof beginRun !== 'function') {
      onError?.('UI test runner is unavailable. Refresh the page and try again.');
      return;
    }
    const id = recording.recordingId;
    setRunConfigTarget(null);
    setBusyId(id);
    upsertRecording({ ...recording, runStatus: 'running' });
    void (async () => {
      try {
        await beginRun(
          id,
          (updated) => {
            if (updated) upsertRecording(updated);
          },
          {
            durationMinutes,
            delaySec,
            testNumber: parseUiTestDisplayNumber(recording, recordings.findIndex((r) => r.recordingId === id)),
            onLoopSummary: (loopSummary, logFile) => appendLoopLog(loopSummary, logFile),
            onRunSummary: (runSummary, logFile) => appendRunEndLog(runSummary, logFile)
          }
        );
      } catch (err) {
        onError?.(err?.response?.data?.error || err?.message || 'Replay failed');
      } finally {
        setBusyId(null);
      }
    })();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      data-ui-test-ignore
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '56vh'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          mb: 0.5
        }}
      >
        <Box sx={{ flex: '1 1 280px', minWidth: 0 }}>
          <UiTestPgErrorCountsBar onError={onError} onReset={handleResetAllLogs} />
        </Box>
        {isFullHdAdjustEnabled() ? (
          <Box sx={{ flexShrink: 0, alignSelf: { xs: 'flex-start', sm: 'center' } }}>
            <FullHdAdjustButton />
          </Box>
        ) : null}
      </Box>
      <ColorTemplate9TableData.UiTestTable>
        <TestTableHeader />
        {recordings.length === 0 ? (
          <ColorTemplate9TableData.EmptyRow>
            <ColorTemplate9TableData.EmptyText sx={{ py: 2 }}>
              No tests yet. Click Add test below, then Record and use the app.
            </ColorTemplate9TableData.EmptyText>
          </ColorTemplate9TableData.EmptyRow>
        ) : (
          recordings.map((recording, index) => {
            const isRowRecording = isRecording && activeRecordingId === recording.recordingId;
            const isRowRunning = isRunning && runningRecordingId === recording.recordingId;
            const stepsDisplay = isRowRecording
              ? formatStepsLabel(liveStepsCount)
              : formatStepsLabel(recording.stepsCount);
            const durationDisplay = isRowRecording
              ? formatDurationSeconds(liveDurationSec)
              : formatDurationSeconds(recording.durationSeconds);
            const rowBusy = busyId === recording.recordingId;
            const testNumber = parseUiTestDisplayNumber(recording, index);

            return (
              <ColorTemplate9TableData.UiTestBodyRow key={recording.recordingId} rowIndex={index}>
                <ColorTemplate9TableData.UiTestCell>
                  <IconButton
                    size="small"
                    aria-label="Delete test"
                    disabled={rowBusy || isRowRecording || isRowRunning}
                    onClick={() => void handleDelete(recording)}
                    sx={{ color: 'var(--theme-primary-color)' }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </ColorTemplate9TableData.UiTestCell>
                <ColorTemplate9TableData.UiTestCell action>
                  <ColorTemplate9TableData.Button
                    type="button"
                    size="small"
                    disabled={rowBusy && !isRowRunning}
                    onClick={() => void handleRunToggle(recording)}
                    sx={runButtonSx(isRowRunning)}
                  >
                    {isRowRunning ? `Stop ${testNumber}` : `Run ${testNumber}`}
                  </ColorTemplate9TableData.Button>
                </ColorTemplate9TableData.UiTestCell>
                <ColorTemplate9TableData.UiTestCell action>
                  <ColorTemplate9TableData.Button
                    type="button"
                    size="small"
                    disabled={(rowBusy && !isRowRecording) || isRowRunning}
                    onClick={() => void handleRecordToggle(recording)}
                    sx={recordButtonSx(isRowRecording)}
                  >
                    {isRowRecording ? `Stop ${testNumber}` : `Record ${testNumber}`}
                  </ColorTemplate9TableData.Button>
                </ColorTemplate9TableData.UiTestCell>
                <ColorTemplate9TableData.UiTestCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <ColorTemplate9TableData.UiTestLoopValue>
                      {recording.loopCount ?? 0}
                    </ColorTemplate9TableData.UiTestLoopValue>
                    <Box
                      component="button"
                      type="button"
                      aria-label={`Reset loop count for ${recording.name}`}
                      disabled={rowBusy || isRowRunning || (recording.loopCount ?? 0) === 0}
                      onClick={() => void handleResetLoop(recording)}
                      sx={{
                        border: 'none',
                        bgcolor: 'transparent',
                        color: '#c62828',
                        fontWeight: 700,
                        fontSize: 'inherit',
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        p: 0,
                        m: 0,
                        minWidth: 0,
                        textDecoration: 'underline',
                        textUnderlineOffset: '2px',
                        '&:disabled': {
                          color: 'var(--theme-primary-color)',
                          opacity: 0.45,
                          cursor: 'not-allowed',
                          textDecoration: 'none'
                        },
                        '&:hover:not(:disabled)': {
                          color: '#b71c1c'
                        }
                      }}
                    >
                      Reset
                    </Box>
                  </Box>
                </ColorTemplate9TableData.UiTestCell>
                <ColorTemplate9TableData.UiTestCell name>
                  <TextField
                    defaultValue={recording.name}
                    key={`name-${recording.recordingId}-${recording.updatedAt}`}
                    size="small"
                    variant="standard"
                    fullWidth
                    disabled={isRowRecording || isRowRunning}
                    onBlur={(e) => void handleNameBlur(recording, e.target.value)}
                    InputProps={{
                      sx: {
                        fontWeight: 600,
                        fontSize: colorTemplate9TableBodyTextSx().fontSize
                      }
                    }}
                  />
                </ColorTemplate9TableData.UiTestCell>
                <ColorTemplate9TableData.UiTestCell>
                  <ColorTemplate9TableData.BodyText>{stepsDisplay}</ColorTemplate9TableData.BodyText>
                </ColorTemplate9TableData.UiTestCell>
                <ColorTemplate9TableData.UiTestCell>
                  <ColorTemplate9TableData.BodyText>{durationDisplay}</ColorTemplate9TableData.BodyText>
                </ColorTemplate9TableData.UiTestCell>
              </ColorTemplate9TableData.UiTestBodyRow>
            );
          })
        )}
      </ColorTemplate9TableData.UiTestTable>

      <ColorTemplate9TableData.FooterAction>
        <ColorTemplate9TableData.PrimaryActionButton
          type="button"
          variant="contained"
          disabled={busyId === 'new'}
          onClick={() => void handleAdd()}
        >
          Add test
        </ColorTemplate9TableData.PrimaryActionButton>
      </ColorTemplate9TableData.FooterAction>

      {runEvents.length ? (
        <ColorTemplate9TableData.Table sx={{ mt: 1.25 }} minTableWidth={645}>
          <ColorTemplate9TableData.HeaderRow gridTemplateColumns="130px 85px 70px 90px 1fr 170px">
            <ColorTemplate9TableData.HeaderCell>Time</ColorTemplate9TableData.HeaderCell>
            <ColorTemplate9TableData.HeaderCell>Event</ColorTemplate9TableData.HeaderCell>
            <ColorTemplate9TableData.HeaderCell>Test</ColorTemplate9TableData.HeaderCell>
            <ColorTemplate9TableData.HeaderCell>Reason</ColorTemplate9TableData.HeaderCell>
            <ColorTemplate9TableData.HeaderCell>Error</ColorTemplate9TableData.HeaderCell>
            <ColorTemplate9TableData.HeaderCell>memorySnapshotMb</ColorTemplate9TableData.HeaderCell>
          </ColorTemplate9TableData.HeaderRow>
          {runEvents.map((log, idx) => (
            <ColorTemplate9TableData.BodyRow
              key={`${log.event}-${log.endedAt}-${log.recordingId}-${log.runId}-${idx}`}
              rowIndex={idx}
              gridTemplateColumns="130px 85px 70px 90px 1fr 170px"
            >
              <ColorTemplate9TableData.BodyCell>
                <ColorTemplate9TableData.BodyText>
                  {log.endedAtHuman || String(log.endedAt ?? '').replace('T', ' ').replace('Z', '')}
                </ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell>
                <ColorTemplate9TableData.BodyText>{log.event ?? '-'}</ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell>
                <ColorTemplate9TableData.BodyText>{log.recordingId ?? '-'}</ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell>
                <ColorTemplate9TableData.BodyText>{log.endReason ?? '-'}</ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell>
                <ColorTemplate9TableData.BodyText>{log.endError || '-'}</ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell>
                <ColorTemplate9TableData.BodyText>
                  {log.memorySnapshotMb
                    ? `rss:${log.memorySnapshotMb.rssMb} heap:${log.memorySnapshotMb.heapUsedMb} | ${log.leakStatus || 'No leak detected'}`
                    : '-'}
                </ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
            </ColorTemplate9TableData.BodyRow>
          ))}
          <ColorTemplate9TableData.BodyText sx={{ px: 1.25, py: 0.75 }}>
            Log file: {runEvents[0]?.logFile || '~/code/main/be/logs/TEST_result_[date][time].log'}
          </ColorTemplate9TableData.BodyText>
        </ColorTemplate9TableData.Table>
      ) : null}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.25, mb: 0.5 }}>
        <ColorTemplate9TableData.BodyText sx={{ fontWeight: 700 }}>
          UI Test Log Viewer
        </ColorTemplate9TableData.BodyText>
        <Box
          component="button"
          type="button"
          onClick={() => setShowLeaksOnly((prev) => !prev)}
          sx={{
            borderRadius: 999,
            px: 1.5,
            py: 0.5,
            border: '1px solid var(--theme-primary-color)',
            bgcolor: showLeaksOnly ? '#4a0e0e' : 'transparent',
            color: showLeaksOnly ? '#ff8a80' : 'var(--theme-primary-color)',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          {showLeaksOnly ? 'Showing leaks only' : 'Only show leaks'}
        </Box>
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 220,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <ColorTemplate9TableData.Table
          topHorizontalScrollbar
          minTableWidth={1100}
          sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
          ref={logPanelScrollRef}
        >
        <ColorTemplate9TableData.HeaderRow gridTemplateColumns={LOG_VIEWER_GRID_COLUMNS}>
          <ColorTemplate9TableData.HeaderCell>Timestamp</ColorTemplate9TableData.HeaderCell>
          <ColorTemplate9TableData.HeaderCell>Leak Status</ColorTemplate9TableData.HeaderCell>
          <ColorTemplate9TableData.HeaderCell>Event</ColorTemplate9TableData.HeaderCell>
          <ColorTemplate9TableData.HeaderCell>Loop</ColorTemplate9TableData.HeaderCell>
          <ColorTemplate9TableData.HeaderCell>Details</ColorTemplate9TableData.HeaderCell>
        </ColorTemplate9TableData.HeaderRow>
        {logsLoading ? (
          <ColorTemplate9TableData.EmptyRow>
            <ColorTemplate9TableData.EmptyText sx={{ py: 2 }}>Loading logs...</ColorTemplate9TableData.EmptyText>
          </ColorTemplate9TableData.EmptyRow>
        ) : filteredLogEntries.length === 0 ? (
          <ColorTemplate9TableData.EmptyRow>
            <ColorTemplate9TableData.EmptyText sx={{ py: 2 }}>
              {showLeaksOnly ? 'No leak-detected rows found in current log.' : 'No UI test logs yet. Run a test to start logging.'}
            </ColorTemplate9TableData.EmptyText>
          </ColorTemplate9TableData.EmptyRow>
        ) : (
          filteredLogEntries.map((entry, idx) => {
            const isLeakDetected = entry?.leakDetected === true || String(entry?.leakStatus || '').toLowerCase() === 'leak detected';
            return (
            <ColorTemplate9TableData.BodyRow
              key={`persist-log-${entry.timestamp || idx}-${entry.event || 'row'}`}
              rowIndex={idx}
              gridTemplateColumns={LOG_VIEWER_GRID_COLUMNS}
              ref={idx === 0 ? newestLogRowRef : undefined}
              tabIndex={idx === 0 ? -1 : undefined}
              sx={
                isLeakDetected
                  ? {
                      bgcolor: '#4a0e0e',
                      borderTop: '1px solid #d32f2f',
                      borderBottom: '1px solid #d32f2f'
                    }
                  : undefined
              }
            >
              <ColorTemplate9TableData.BodyCell>
                <ColorTemplate9TableData.BodyText sx={logCellTextSx()}>
                  {entry.timestampHuman || entry.timestamp || '-'}
                </ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell>
                <ColorTemplate9TableData.BodyText
                  sx={{
                    ...logCellTextSx(),
                    ...(isLeakDetected ? { color: '#ff8a80', fontWeight: 700 } : {})
                  }}
                >
                  {entry.leakStatus || '-'}
                </ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell>
                <ColorTemplate9TableData.BodyText sx={logCellTextSx()}>{entry.event || '-'}</ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell>
                <ColorTemplate9TableData.BodyText sx={logCellTextSx()}>{entry.loopCount ?? '-'}</ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell>
                <ColorTemplate9TableData.BodyText sx={logCellTextSx()}>
                  {entry.raw
                    ? entry.raw
                    : `test:${entry.recordingId ?? '-'} run:${entry.runId ?? '-'} ${entry.leakDetail || ''} ${
                        entry.memorySnapshotMb
                          ? `rss:${entry.memorySnapshotMb.rssMb} heap:${entry.memorySnapshotMb.heapUsedMb}`
                          : ''
                      }`}
                </ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
            </ColorTemplate9TableData.BodyRow>
            );
          })
        )}
          <ColorTemplate9TableData.BodyText sx={{ px: 1.25, py: 0.75 }}>
            Log file: {logFilePath || '~/code/main/be/logs/TEST_result_[date][time].log'}{logFilesCount ? ` (${logFilesCount} file(s))` : ''}
          </ColorTemplate9TableData.BodyText>
        </ColorTemplate9TableData.Table>
      </Box>

      <UiTestRunConfigDialog
        open={runConfigTarget != null}
        recording={runConfigTarget}
        defaultDelaySec={Math.max(1, Math.round(Number(runConfigTarget?.stepIntervalMs ?? 5000) / 1000))}
        onClose={handleRunConfigClose}
        onRun={handleRunConfigConfirm}
      />
    </Box>
  );
}
