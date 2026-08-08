import fs from 'fs';
import { vaultMetaPath, vaultRootOnMount } from './vaultPaths.js';
import { readVaultMeta } from './usbScan.js';

export const UNLOCK_MAX_FAILED_ATTEMPTS = 5;

/** Default: 5 minutes expressed in seconds. */
const DEFAULT_NOTES_ICON_RETRY_DELAY_SEC = 300;

/** Seconds to wait after each wrong security icon — env NOTES_ICON_RETRY_DELAY_SEC (default 300). */
export function getVaultIconRetryDelaySeconds() {
  const raw = process.env.NOTES_ICON_RETRY_DELAY_SEC;
  if (raw === undefined || String(raw).trim() === '') return DEFAULT_NOTES_ICON_RETRY_DELAY_SEC;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) return DEFAULT_NOTES_ICON_RETRY_DELAY_SEC;
  return seconds;
}

export function getVaultIconUnlockLockoutMs() {
  return getVaultIconRetryDelaySeconds() * 1000;
}

/** @deprecated Use getVaultIconUnlockLockoutMs() — kept for imports expecting a constant name. */
export const UNLOCK_LOCKOUT_MS = getVaultIconUnlockLockoutMs();

export const UNLOCK_MISMATCH_ERROR = 'Incorrect security icon or corrupt vault data';

export function formatVaultIconRetryDelayLabel(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  if (seconds === 1) return '1 second';
  if (seconds < 60) return `${seconds} seconds`;
  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  if (rem === 0) {
    return mins === 1 ? '1 minute' : `${mins} minutes`;
  }
  const minPart = mins === 1 ? '1 minute' : `${mins} minutes`;
  const secPart = rem === 1 ? '1 second' : `${rem} seconds`;
  return `${minPart} ${secPart}`;
}

export function vaultIconUnlockPolicyHint() {
  const delayLabel = formatVaultIconRetryDelayLabel(getVaultIconRetryDelaySeconds());
  return `You must wait ${delayLabel} to retry. Five consecutive wrong guesses will security-wipe clean the USB.`;
}

export const UNLOCK_POLICY_HINT = vaultIconUnlockPolicyHint();
export const UNLOCK_WIPED_MESSAGE =
  'Five incorrect security icons in a row. This USB vault has been security-wiped clean.';

export class RecordVaultUnlockError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'RecordVaultUnlockError';
    this.code = details.code || 'RECORD_VAULT_USB_UNLOCK_FAILED';
    this.lockedUntil = details.lockedUntil || null;
    this.remainingSeconds = details.remainingSeconds ?? null;
    this.failedAttempts = details.failedAttempts ?? null;
    this.vaultWiped = Boolean(details.vaultWiped);
    this.errorSecondary = details.errorSecondary || null;
  }
}

function normalizeGuard(raw) {
  const failedAttempts = Math.max(0, Math.floor(Number(raw?.failedAttempts ?? 0)));
  const lockedUntilRaw = String(raw?.lockedUntil ?? '').trim();
  const lockedUntilMs = lockedUntilRaw ? Date.parse(lockedUntilRaw) : NaN;
  return {
    failedAttempts,
    lockedUntil: Number.isFinite(lockedUntilMs) ? new Date(lockedUntilMs).toISOString() : null
  };
}

export function readUnlockGuard(meta) {
  return normalizeGuard(meta?.unlockGuard);
}

function writeVaultMeta(mountPath, meta) {
  fs.writeFileSync(vaultMetaPath(mountPath), JSON.stringify(meta, null, 2));
}

export function remainingLockSeconds(guard, nowMs = Date.now()) {
  if (!guard?.lockedUntil) return 0;
  const untilMs = Date.parse(guard.lockedUntil);
  if (!Number.isFinite(untilMs)) return 0;
  return Math.max(0, Math.ceil((untilMs - nowMs) / 1000));
}

export function isUnlockGuardLocked(guard, nowMs = Date.now()) {
  return remainingLockSeconds(guard, nowMs) > 0;
}

export function getUnlockGuardStatusFromMeta(meta, notFoundError = 'No vault found at this location') {
  if (!meta?.vaultId) {
    return {
      ok: false,
      error: notFoundError
    };
  }
  const guard = readUnlockGuard(meta);
  const remainingSeconds = remainingLockSeconds(guard);
  return {
    ok: true,
    locked: remainingSeconds > 0,
    lockedUntil: guard.lockedUntil,
    remainingSeconds,
    failedAttempts: guard.failedAttempts,
    maxFailedAttempts: UNLOCK_MAX_FAILED_ATTEMPTS,
    lockoutSeconds: getVaultIconRetryDelaySeconds(),
    kdf: meta.kdf || null,
    kdfSalt: meta.kdfSalt || null
  };
}

export function getUnlockGuardStatus(mountPath) {
  const meta = readVaultMeta(mountPath);
  return getUnlockGuardStatusFromMeta(meta);
}

export function assertUnlockNotLocked(mountPath, meta) {
  const guard = readUnlockGuard(meta);
  const remainingSeconds = remainingLockSeconds(guard);
  if (remainingSeconds <= 0) return guard;

  throw new RecordVaultUnlockError('You must wait before trying again.', {
    code: 'RECORD_VAULT_USB_UNLOCK_LOCKED',
    lockedUntil: guard.lockedUntil,
    remainingSeconds,
    failedAttempts: guard.failedAttempts,
    errorSecondary: formatLockoutSecondary(remainingSeconds)
  });
}

function formatLockoutSecondary(remainingSeconds) {
  const delayLabel = formatVaultIconRetryDelayLabel(getVaultIconRetryDelaySeconds());
  return `You must wait ${delayLabel} to retry (${formatCountdown(remainingSeconds)} remaining). Five consecutive wrong guesses will security-wipe clean the USB.`;
}

export function formatCountdown(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function secureWipeVault(mountPath) {
  const root = vaultRootOnMount(mountPath);
  if (!fs.existsSync(root)) return;
  fs.rmSync(root, { recursive: true, force: true });
}

export function recordFailedUnlockAttempt(mountPath, meta) {
  const guard = readUnlockGuard(meta);
  const nextAttempts = guard.failedAttempts + 1;

  if (nextAttempts >= UNLOCK_MAX_FAILED_ATTEMPTS) {
    secureWipeVault(mountPath);
    throw new RecordVaultUnlockError(UNLOCK_WIPED_MESSAGE, {
      code: 'RECORD_VAULT_USB_WIPED',
      failedAttempts: nextAttempts,
      vaultWiped: true,
      errorSecondary: 'Create a new vault in this folder if you still want to use this USB.'
    });
  }

  const lockedUntil = new Date(Date.now() + getVaultIconUnlockLockoutMs()).toISOString();
  const nextGuard = {
    failedAttempts: nextAttempts,
    lockedUntil
  };
  const nextMeta = { ...meta, unlockGuard: nextGuard };
  writeVaultMeta(mountPath, nextMeta);

  const remainingSeconds = remainingLockSeconds(nextGuard);
  throw new RecordVaultUnlockError(UNLOCK_MISMATCH_ERROR, {
    code: 'RECORD_VAULT_USB_UNLOCK_FAILED',
    lockedUntil,
    remainingSeconds,
    failedAttempts: nextAttempts,
    errorSecondary: formatLockoutSecondary(remainingSeconds)
  });
}

export function clearUnlockGuard(mountPath, meta) {
  if (!meta?.unlockGuard) return meta;
  const nextMeta = { ...meta };
  delete nextMeta.unlockGuard;
  writeVaultMeta(mountPath, nextMeta);
  return nextMeta;
}
