const STORAGE_PREFIX = 'photoAlbumsInnerUnlockPin';
const LOCKOUT_PREFIX = 'photoAlbumsInnerUnlockLockout';

/** Default 5 minutes — matches unlock UI copy / VAULT-style icon delay. */
export const INNER_UNLOCK_LOCKOUT_MS = 5 * 60 * 1000;

function innerUnlockLockoutKey(storageType, singlesId, noteId) {
  const storage = String(storageType || 'usb').trim() || 'usb';
  const owner = Number(singlesId) > 0 ? String(Number(singlesId)) : 'anon';
  const id = Number(noteId);
  if (!Number.isFinite(id) || id < 1) return '';
  return `${LOCKOUT_PREFIX}:${storage}:${owner}:${id}`;
}

export function parseInnerUnlockLockedUntilMs(raw) {
  if (raw == null || raw === '') return 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw > 0 ? raw : 0;
  const ms = Date.parse(String(raw).trim());
  return Number.isFinite(ms) ? ms : 0;
}

/** Seconds remaining until unlock may be tried again (0 when allowed). */
export function remainingInnerUnlockLockoutSeconds(lockedUntilMs, nowMs = Date.now()) {
  const until = Number(lockedUntilMs) || 0;
  if (!until || until <= nowMs) return 0;
  return Math.max(1, Math.ceil((until - nowMs) / 1000));
}

export function formatInnerUnlockLockoutLabel(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  if (seconds <= 0) return '';
  if (seconds < 60) return seconds === 1 ? '1 second' : `${seconds} seconds`;
  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  if (rem === 0) return mins === 1 ? '1 minute' : `${mins} minutes`;
  const minPart = mins === 1 ? '1 minute' : `${mins} minutes`;
  const secPart = rem === 1 ? '1 second' : `${rem} seconds`;
  return `${minPart} ${secPart}`;
}

/**
 * Remove any legacy plaintext PIN keys from older builds.
 * PINs are never cached (not localStorage, not durable session memory).
 */
export function wipeAllPersistedInnerUnlockPins() {
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${STORAGE_PREFIX}:`)) toRemove.push(key);
    }
    toRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
}

/** Browser cache of vault lockout — survives round-robin; vault column is source of truth when synced. */
export function loadPersistedInnerUnlockLockoutMs(storageType, singlesId, noteId) {
  try {
    const key = innerUnlockLockoutKey(storageType, singlesId, noteId);
    if (!key) return 0;
    return parseInnerUnlockLockedUntilMs(localStorage.getItem(key));
  } catch {
    return 0;
  }
}

export function persistInnerUnlockLockoutMs(storageType, singlesId, noteId, lockedUntilMs) {
  const until = Number(lockedUntilMs) || 0;
  try {
    const key = innerUnlockLockoutKey(storageType, singlesId, noteId);
    if (!key) return;
    if (until <= Date.now()) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, String(until));
  } catch {
    // ignore
  }
}

export function clearPersistedInnerUnlockLockout(storageType, singlesId, noteId) {
  try {
    const key = innerUnlockLockoutKey(storageType, singlesId, noteId);
    if (key) localStorage.removeItem(key);
    if (Number(singlesId) > 0) {
      const anonKey = innerUnlockLockoutKey(storageType, null, noteId);
      if (anonKey) localStorage.removeItem(anonKey);
    }
  } catch {
    // ignore
  }
}

export function resolveInnerUnlockLockedUntilMs({
  storageType,
  singlesId,
  noteId,
  vaultLockedUntil
} = {}) {
  const fromVault = parseInnerUnlockLockedUntilMs(vaultLockedUntil);
  const fromBrowser = loadPersistedInnerUnlockLockoutMs(storageType, singlesId, noteId);
  const until = Math.max(fromVault || 0, fromBrowser || 0);
  return until > Date.now() ? until : 0;
}
