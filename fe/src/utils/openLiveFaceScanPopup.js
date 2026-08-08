import { LIVE_FACE_SCAN_POPUP_PATH } from 'constants/liveFaceScanPopupRoute';
import {
  buildLiveFaceScanPopupAck,
  isLiveFaceScanPopupMessage,
  LIVE_FACE_SCAN_POPUP_PHASE
} from 'utils/liveFaceScanPopupProtocol';

const POPUP_POLL_MS = 200;

/** Large draggable window for ColorTemplate7PopupLargeDark live scan UI. */
export function getLiveFaceScanPopupWindowSize() {
  if (typeof window === 'undefined') {
    return { width: 960, height: 900 };
  }
  const availW = window.screen?.availWidth ?? 1200;
  const availH = window.screen?.availHeight ?? 900;
  return {
    width: Math.min(1020, Math.max(920, Math.round(availW * 0.78))),
    height: Math.min(980, Math.max(860, Math.round(availH * 0.86)))
  };
}

/**
 * Opens a draggable browser popup for live face scan. Resolves when liveness passes in the popup.
 * @returns {Promise<{ sessionId: string, region: string, identityPoolId: string, checkResult: object }>}
 */
export function openLiveFaceScanPopup({
  returnOrigin = typeof window !== 'undefined' ? window.location.origin : '',
  onPopupPhase
} = {}) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Live face scan is only available in the browser.'));
      return;
    }

    const { width, height } = getLiveFaceScanPopupWindowSize();
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
    const url = `${window.location.origin}${LIVE_FACE_SCAN_POPUP_PATH}?popup=1&returnOrigin=${encodeURIComponent(returnOrigin)}`;
    const popup = window.open(
      url,
      'liveFaceScanPopup',
      `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`
    );

    if (!popup) {
      reject(new Error('Popup blocked. Allow popups for this site and try again.'));
      return;
    }

    let settled = false;
    let pollTimer = null;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      if (pollTimer != null) clearInterval(pollTimer);
    };

    const finishResolve = (payload) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(payload);
    };

    const finishReject = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err || 'Live face scan failed')));
    };

    const rejectWithPhase = (message, phase, extra = {}) => {
      const err = new Error(message);
      err.phase = phase;
      if (extra.checkResult) err.checkResult = extra.checkResult;
      finishReject(err);
    };

    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!isLiveFaceScanPopupMessage(data)) return;

      try {
        if (event.source && event.source !== window) {
          event.source.postMessage(buildLiveFaceScanPopupAck(), window.location.origin);
        }
      } catch {
        // ignore
      }

      if (typeof onPopupPhase === 'function') {
        try {
          onPopupPhase(data);
        } catch {
          // ignore
        }
      }

      if (data.phase === LIVE_FACE_SCAN_POPUP_PHASE.SUBMIT_VIDEO) {
        finishResolve({
          submitVideo: true,
          message: String(data.message || '')
        });
        return;
      }

      if (settled) return;

      if (data.phase === LIVE_FACE_SCAN_POPUP_PHASE.PASSED) {
        finishResolve({
          sessionId: String(data.sessionId || ''),
          region: String(data.region || ''),
          identityPoolId: String(data.identityPoolId || ''),
          checkResult: data.checkResult || null
        });
        return;
      }

      if (data.phase === LIVE_FACE_SCAN_POPUP_PHASE.FAILED) {
        // Popup stays open for Record Again / Submit Video — do not settle yet.
        return;
      }

      if (data.phase === LIVE_FACE_SCAN_POPUP_PHASE.ERROR) {
        rejectWithPhase(String(data.message || 'Live face scan failed.'), LIVE_FACE_SCAN_POPUP_PHASE.ERROR);
        return;
      }

      if (data.phase === LIVE_FACE_SCAN_POPUP_PHASE.CLOSED) {
        rejectWithPhase('Live face scan window was closed.', LIVE_FACE_SCAN_POPUP_PHASE.CLOSED);
      }
    };

    window.addEventListener('message', onMessage);

    pollTimer = setInterval(() => {
      if (popup.closed) {
        rejectWithPhase('Live face scan window was closed.', LIVE_FACE_SCAN_POPUP_PHASE.CLOSED);
      }
    }, POPUP_POLL_MS);
  });
}
