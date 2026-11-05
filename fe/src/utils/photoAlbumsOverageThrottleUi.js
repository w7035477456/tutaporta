/**
 * Shared flag: TutaPhotoAlbums Tx/Rx refill exhausted → PHOTOALBUMS_OVERLIMIT_THROTTLE_MULTIPLE is active.
 * BusyHourglassOverlay reads this so every busy icon can show the refill notice.
 * The live multiple (e.g. "speed throttled 10x") is published by the usage bar.
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

/**
 * Human label for the throttle multiple — "10x", "2.5x". Blank for full speed
 * so callers can omit the suffix entirely at 1×.
 */
export function throttleMultipleLabel(factor) {
  const n = Number(factor);
  if (!Number.isFinite(n) || n <= 1) return '';
  const rounded = Math.round(n * 10) / 10;
  return `${rounded}x`;
}

/** "speed throttled 10x" (or just "speed throttled" when the multiple is unknown). */
export function speedThrottledPhrase(factor) {
  const multiple = throttleMultipleLabel(factor);
  return multiple ? `speed throttled ${multiple}` : 'speed throttled';
}

/** "Transfer Speed is being throttled 10x" — same rule for the full notice. */
export function transferSpeedThrottledPhrase(factor) {
  const multiple = throttleMultipleLabel(factor);
  return multiple ? `Transfer Speed is being throttled ${multiple}` : 'Transfer Speed is being throttled';
}

/** Full notice sentence including the live multiple (for aria-labels). */
export function vaultOverageThrottleAriaMessage(factor) {
  const parts = VAULT_OVERAGE_THROTTLE_BUSY_MESSAGE_PARTS;
  return `${parts.before}${transferSpeedThrottledPhrase(factor)}${parts.after}`;
}

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

/** 1 = full speed; >1 = current slowdown multiple from the backend. */
let overageThrottleFactor = 1;

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

/** Publish the live slowdown multiple (from `transfer.throttleFactor`). */
export function setPhotoAlbumsOverageThrottleFactor(factor) {
  const n = Number(factor);
  const value = Number.isFinite(n) && n >= 1 ? n : 1;
  if (value === overageThrottleFactor) return;
  overageThrottleFactor = value;
  publish();
}

export function getPhotoAlbumsOverageThrottleActive() {
  return overageThrottleActive;
}

/** Current slowdown multiple — 1 at full speed, e.g. 10 while depleted. */
export function getPhotoAlbumsOverageThrottleFactor() {
  return overageThrottleActive ? overageThrottleFactor : 1;
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
