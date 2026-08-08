export const LIVE_FACE_SCAN_POPUP_MESSAGE_TYPE = 'live-face-scan-popup';
export const LIVE_FACE_SCAN_POPUP_ACK_TYPE = 'live-face-scan-popup-ack';

export const LIVE_FACE_SCAN_POPUP_PHASE = {
  PASSED: 'passed',
  FAILED: 'failed',
  ERROR: 'error',
  CLOSED: 'closed',
  SUBMIT_VIDEO: 'submit_video'
};

export function isLiveFaceScanPopupMessage(data) {
  return Boolean(data && data.type === LIVE_FACE_SCAN_POPUP_MESSAGE_TYPE);
}

export function buildLiveFaceScanPopupAck() {
  return { type: LIVE_FACE_SCAN_POPUP_ACK_TYPE, received: true };
}

export function postLiveFaceScanPopupResult(targetWindow, payload, targetOrigin) {
  if (!targetWindow || targetWindow.closed) return;
  try {
    targetWindow.postMessage(
      {
        type: LIVE_FACE_SCAN_POPUP_MESSAGE_TYPE,
        ...payload
      },
      targetOrigin
    );
  } catch {
    // ignore
  }
}
