/**
 * When TutaPhotoAlbums data remaining is exhausted (≤ 0 MB), interactive album
 * actions wait behind a non-dismissible queue-position popup (start 30–60).
 */

import { getPhotoAlbumsOverageThrottleActive } from 'utils/photoAlbumsOverageThrottleUi';

/** Inclusive random starting queue position (30–60). */
export function randomPhotoAlbumsTrafficWaitSeconds() {
  return 30 + Math.floor(Math.random() * 31);
}

let openWaitDialog = null;
/** @type {(() => void)|null} */
let dismissWaitDialog = null;
/** @type {Promise<void>|null} */
let activeWait = null;
/** @type {(() => void)|null} */
let activeFinish = null;

/**
 * Workspace mounts the dialog and registers: (delaySec, onDone) => void
 * @returns {() => void} unregister
 */
export function registerPhotoAlbumsTrafficWaitOpener(opener) {
  openWaitDialog = typeof opener === 'function' ? opener : null;
  return () => {
    if (openWaitDialog === opener) openWaitDialog = null;
  };
}

/**
 * Host registers a closer so VIP refill / Data Remain > 0 can skip the queue UI.
 * @returns {() => void} unregister
 */
export function registerPhotoAlbumsTrafficWaitDismisser(dismisser) {
  dismissWaitDialog = typeof dismisser === 'function' ? dismisser : null;
  return () => {
    if (dismissWaitDialog === dismisser) dismissWaitDialog = null;
  };
}

/**
 * Close an in-progress traffic wait and resolve waiters (e.g. after data purchase).
 */
export function dismissPhotoAlbumsTrafficWait() {
  if (typeof dismissWaitDialog === 'function') {
    try {
      dismissWaitDialog();
    } catch {
      // ignore host errors; still clear wait promise below
    }
  }
  if (typeof activeFinish === 'function') {
    activeFinish();
  }
}

/**
 * If overage throttle is active, show the wait popup and resolve when countdown ends.
 * Concurrent callers share one wait. No-op when data remaining is still positive.
 */
export function runPhotoAlbumsTrafficWaitIfNeeded() {
  if (!getPhotoAlbumsOverageThrottleActive()) {
    return Promise.resolve();
  }
  if (activeWait) return activeWait;

  const delaySec = randomPhotoAlbumsTrafficWaitSeconds();
  activeWait = new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      activeWait = null;
      activeFinish = null;
      resolve();
    };
    activeFinish = finish;
    if (typeof openWaitDialog !== 'function') {
      finish();
      return;
    }
    try {
      openWaitDialog(delaySec, finish);
    } catch {
      finish();
    }
  });
  return activeWait;
}
