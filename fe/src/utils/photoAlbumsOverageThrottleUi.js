/**
 * Shared flag: TutaPhotoAlbums Tx/Rx refill exhausted → PHOTOALBUMS_OVERLIMIT_THROTTLE_MULTIPLE is active.
 * BusyHourglassOverlay reads this so every busy icon can show the refill notice.
 */

export const VAULT_OVERAGE_THROTTLE_BUSY_MESSAGE =
  'Data Transfer Refill Depleted. Transfer Speed is being throttled. Please REFILL to return to maximum speed.';

/** Split for UI: only the middle phrase blinks red (matches usage-bar depleted blink). */
export const VAULT_OVERAGE_THROTTLE_BUSY_MESSAGE_PARTS = {
  before: 'Data Transfer Refill Depleted. ',
  blink: 'Transfer Speed is being throttled',
  after: '. Please REFILL to return to maximum speed.'
};

/** Match backend/FE throttle lines so busy UIs can strip + restyle them. */
export const VAULT_OVERAGE_THROTTLE_STATUS_LINE_RE =
  /Transfer Speed is being throttled|Data Transfer Refill Depleted|Remain Transfer Data exceeded|Please REFILL/i;

/** Same cadence as PhotoAlbumsUsageBar depleted blink. */
export const vaultOverageThrottleBlinkSx = {
  color: 'var(--theme-error-color)',
  WebkitTextFillColor: 'var(--theme-error-color)',
  '@keyframes vaultOverageThrottleBlink': {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.35 }
  },
  animation: 'vaultOverageThrottleBlink 1.1s ease-in-out infinite'
};

let overageThrottleActive = false;
/** How many mounted usage bars currently report depleted quota. */
let depletedHolders = 0;
const listeners = new Set();

function publish() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore subscriber errors
    }
  });
}

function setActive(next) {
  const value = Boolean(next);
  if (value === overageThrottleActive) return;
  overageThrottleActive = value;
  publish();
}

export function getPhotoAlbumsOverageThrottleActive() {
  return overageThrottleActive;
}

/**
 * Usage bars call this when depleted state changes.
 * Uses a holder count so compare-mode (two bars) does not clear the flag early.
 * @returns {() => void} cleanup for useEffect
 */
export function reportPhotoAlbumsOverageThrottleDepleted(depleted) {
  if (depleted) {
    depletedHolders += 1;
    setActive(true);
    return () => {
      depletedHolders = Math.max(0, depletedHolders - 1);
      setActive(depletedHolders > 0);
    };
  }
  setActive(depletedHolders > 0);
  return () => {};
}

export function subscribePhotoAlbumsOverageThrottle(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
