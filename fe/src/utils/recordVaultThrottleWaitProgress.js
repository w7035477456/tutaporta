/**
 * Live "how far through the throttled wait are we" percent for busy overlays.
 *
 * When TutaNotes Tx/Rx refill is exhausted the backend does not fail the request —
 * it sleeps so wall time ≈ NOTES_OVERLIMIT_THROTTLE_MULTIPLE × the real transfer
 * (`throttleVaultTransferIfExhausted`). While it sleeps it publishes its 1–99 %
 * progress to Redis, which GET /api/recordVault/storage/logoff-progress already
 * returns. Nothing displayed it on the generic busy hourglass, so a throttled
 * upload/save showed a bare spinner with no idea how long was left.
 *
 * One shared poller for the whole app (several overlays may be mounted at once but
 * only one is open) — ref-counted so polling stops as soon as every overlay closes.
 */

import { useSyncExternalStore } from 'react';
import { fetchRecordVaultStorageLogoffProgress } from 'api/recordVaultFe';
import { getRecordVaultOverageThrottleActive } from './recordVaultOverageThrottleUi';

/** Fast enough that a 1s backend report never looks frozen, slow enough to be free. */
export const RECORD_VAULT_THROTTLE_WAIT_POLL_MS = 300;
const POLL_INTERVAL_MS = RECORD_VAULT_THROTTLE_WAIT_POLL_MS;

/** How far through the current throttle wait we are, or null when there is none. */
let percentSnapshot = null;
let timerId = null;
let inFlight = false;
let holderCount = 0;
const listeners = new Set();

function publish(next) {
  if (next === percentSnapshot) return;
  percentSnapshot = next;
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // A broken overlay must never stop the others from repainting.
    }
  });
}

function stopPoller() {
  if (timerId == null) return;
  clearInterval(timerId);
  timerId = null;
  publish(null);
}

function tick() {
  if (inFlight) return;
  inFlight = true;
  void fetchRecordVaultStorageLogoffProgress()
    .then(({ percent }) => {
      if (holderCount <= 0) return;
      const pct = Number(percent);
      if (!Number.isFinite(pct)) return;
      // 0 = no throttle sleep running (wait finished, or a normal request): drop
      // back to the plain spinner. A live sleep is re-published every second, so
      // this cannot flicker mid-wait.
      if (pct <= 0) {
        publish(null);
        return;
      }
      const next = Math.max(1, Math.min(99, Math.round(pct)));
      // Reports are ~1s apart and step forward only — ignore a stale lower value.
      if (percentSnapshot != null && next < percentSnapshot) return;
      publish(next);
    })
    .catch(() => {
      // Poll failures are cosmetic — the overlay still spins.
    })
    .finally(() => {
      inFlight = false;
    });
}

function startPoller() {
  if (timerId != null) return;
  timerId = setInterval(tick, POLL_INTERVAL_MS);
  tick();
}

export function subscribeRecordVaultThrottleWaitProgress(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  holderCount += 1;
  startPoller();
  return () => {
    listeners.delete(listener);
    holderCount = Math.max(0, holderCount - 1);
    if (holderCount === 0) stopPoller();
  };
}

export function getRecordVaultThrottleWaitProgressSnapshot() {
  return percentSnapshot;
}

function getServerSnapshot() {
  return null;
}

const NOOP_SUBSCRIBE = () => () => {};

/**
 * 1–99 while a throttled wait is running, null otherwise (full speed, or no wait).
 * `active` should be false when the overlay is closed so nothing is polled.
 */
export function useRecordVaultThrottleWaitProgress(active) {
  const livePercent = useSyncExternalStore(
    active && typeof window !== 'undefined' ? subscribeRecordVaultThrottleWaitProgress : NOOP_SUBSCRIBE,
    getRecordVaultThrottleWaitProgressSnapshot,
    getServerSnapshot
  );
  if (!active) return null;
  if (!getRecordVaultOverageThrottleActive()) return null;
  return livePercent;
}

/** Test/teardown helper — forget the cached percent and stop polling. */
export function resetRecordVaultThrottleWaitProgress() {
  holderCount = 0;
  listeners.clear();
  stopPoller();
  percentSnapshot = null;
}
