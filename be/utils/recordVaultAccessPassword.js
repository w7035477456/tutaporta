import { hashPassword, verifyPassword } from './passwordHash.js';
import pool from '../db/connection.js';
import { invalidateAuthUserCache } from './authUserLookupCache.js';
import { validateNewPasswordRequirements } from './passwordRequirements.js';
import {
  clusterRedisDel,
  clusterRedisGet,
  clusterRedisSet
} from './clusterRedisState.js';
import { isVaultE2eYellow } from './vaultE2eYellowConfig.js';

const ACCESS_UNLOCK_PREFIX = 'v1:record_vault:access_unlock:';
const ACCESS_UNLOCK_TTL_SEC = 24 * 60 * 60;

function accessUnlockKey(singlesId) {
  return `${ACCESS_UNLOCK_PREFIX}${Math.trunc(Number(singlesId))}`;
}

async function loadVaultAccessRow(singlesId) {
  const result = await pool.query(
    `SELECT notes_access_password_hash,
            notes_access_password_hint,
            notes_access_password_enabled
     FROM helloworldjunktest.singles
     WHERE singles_id = $1
     LIMIT 1`,
    [Number(singlesId)]
  );
  return result.rows[0] ?? null;
}

async function loadVaultAccessHash(singlesId) {
  const row = await loadVaultAccessRow(singlesId);
  return String(row?.notes_access_password_hash ?? '').trim();
}

function normalizeVaultAccessHint(raw) {
  return String(raw ?? '').trim().slice(0, 200);
}

export async function isVaultAccessUnlocked(singlesId) {
  const raw = await clusterRedisGet(accessUnlockKey(singlesId));
  return raw != null && raw !== '';
}

export async function unlockVaultAccessSession(singlesId) {
  await clusterRedisSet(accessUnlockKey(singlesId), String(Date.now()), ACCESS_UNLOCK_TTL_SEC);
}

export async function logoffVaultAccessSession(singlesId) {
  await clusterRedisDel(accessUnlockKey(singlesId));
}

export async function isVaultAccessPasswordEnabled(singlesId) {
  const row = await loadVaultAccessRow(singlesId);
  return Boolean(row?.notes_access_password_enabled);
}

export async function getVaultAccessStatus(singlesId) {
  const id = Number(singlesId);
  const row = await loadVaultAccessRow(id);
  const hash = String(row?.notes_access_password_hash ?? '').trim();
  const hint = normalizeVaultAccessHint(row?.notes_access_password_hint);
  const enabled = Boolean(row?.notes_access_password_enabled);
  const unlocked = await isVaultAccessUnlocked(id);

  // NOTES_SKIP_PASSWORD_CHECK is ignored — Encrypt Password always applies when enabled.
  return {
    enabled,
    configured: Boolean(hash),
    unlocked,
    hint: hint || null,
    skipPasswordCheck: false
  };
}

export async function verifyVaultAccessPassword(singlesId, plainPassword) {
  const password = String(plainPassword ?? '').trim();
  if (!password) return false;

  const enabled = await isVaultAccessPasswordEnabled(singlesId);
  if (!enabled) {
    await unlockVaultAccessSession(singlesId);
    return true;
  }

  const storedHash = await loadVaultAccessHash(singlesId);
  if (!storedHash) return false;

  const ok = await verifyPassword(storedHash, password);

  if (ok) {
    await unlockVaultAccessSession(singlesId);
  }
  return ok;
}

export async function setVaultAccessPassword(singlesId, plainPassword, hint = '') {
  const validation = validateNewPasswordRequirements(plainPassword);
  if (!validation.ok) {
    throw new Error(validation.error || 'Invalid Encrypt Password');
  }

  const existing = await loadVaultAccessHash(singlesId);
  if (existing) {
    const enabled = await isVaultAccessPasswordEnabled(singlesId);
    if (enabled) {
      throw new Error('Encrypt Password is already set — use change password instead');
    }
  }

  const passwordHash = await hashPassword(String(plainPassword).trim());
  const hintText = normalizeVaultAccessHint(hint);
  await pool.query(
    `UPDATE helloworldjunktest.singles
     SET notes_access_password_hash = $2,
         notes_access_password_hint = $3,
         notes_access_password_enabled = true,
         notes_access_password_updated_at = CURRENT_TIMESTAMP
     WHERE singles_id = $1`,
    [Number(singlesId), passwordHash, hintText || null]
  );
  await invalidateAuthUserCache(singlesId);
  await unlockVaultAccessSession(singlesId);
  return { enabled: true, configured: true, hint: hintText || null };
}

export async function changeVaultAccessPassword(singlesId, currentPassword, newPassword, hint) {
  const ok = await verifyVaultAccessPassword(singlesId, currentPassword);
  if (!ok) {
    throw new Error('Current Encrypt Password is incorrect');
  }

  const validation = validateNewPasswordRequirements(newPassword);
  if (!validation.ok) {
    throw new Error(validation.error || 'Invalid Encrypt Password');
  }

  const passwordHash = await hashPassword(String(newPassword).trim());
  const hintProvided = hint !== undefined && hint !== null;
  const hintText = hintProvided ? normalizeVaultAccessHint(hint) : null;
  await pool.query(
    hintProvided
      ? `UPDATE helloworldjunktest.singles
         SET notes_access_password_hash = $2,
             notes_access_password_hint = $3,
             notes_access_password_enabled = true,
             notes_access_password_updated_at = CURRENT_TIMESTAMP
         WHERE singles_id = $1`
      : `UPDATE helloworldjunktest.singles
         SET notes_access_password_hash = $2,
             notes_access_password_enabled = true,
             notes_access_password_updated_at = CURRENT_TIMESTAMP
         WHERE singles_id = $1`,
    hintProvided
      ? [Number(singlesId), passwordHash, hintText || null]
      : [Number(singlesId), passwordHash]
  );
  await invalidateAuthUserCache(singlesId);
  await unlockVaultAccessSession(singlesId);
  return { enabled: true, configured: true, hint: hintText };
}

export async function setVaultAccessPasswordHint(singlesId, hint) {
  const hintText = normalizeVaultAccessHint(hint);
  await pool.query(
    `UPDATE helloworldjunktest.singles
     SET notes_access_password_hint = $2
     WHERE singles_id = $1`,
    [Number(singlesId), hintText || null]
  );
  return getVaultAccessStatus(singlesId);
}

export async function setVaultAccessPasswordEnabled(singlesId, enabled, options = {}) {
  const id = Number(singlesId);
  const nextEnabled = Boolean(enabled);

  if (!nextEnabled) {
    const row = await loadVaultAccessRow(id);
    const hash = String(row?.notes_access_password_hash ?? '').trim();
    const currentlyEnabled = Boolean(row?.notes_access_password_enabled);
    if (hash && currentlyEnabled && !(await isVaultAccessUnlocked(id))) {
      const password = String(options.password ?? '').trim();
      if (!password) {
        throw new Error('Encrypt Password required to turn off Encrypt Password protection');
      }
      const ok = await verifyVaultAccessPassword(id, password);
      if (!ok) {
        throw new Error('Incorrect Encrypt Password');
      }
    }
  }

  await pool.query(
    `UPDATE helloworldjunktest.singles
     SET notes_access_password_enabled = $2
     WHERE singles_id = $1`,
    [id, nextEnabled]
  );
  await invalidateAuthUserCache(id);

  if (nextEnabled) {
    if (options.keepSessionUnlocked) {
      await unlockVaultAccessSession(id);
    } else {
      await logoffVaultAccessSession(id);
    }
  } else {
    await unlockVaultAccessSession(id);
  }

  return getVaultAccessStatus(id);
}

export async function requireVaultAccessSession(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  // Yellow E2E: Encrypt Password / DEK live only in the browser tab — no server unlock session.
  if (isVaultE2eYellow()) {
    return singlesId;
  }

  const enabled =
    req.auth?.notes_access_password_enabled != null
      ? Boolean(req.auth.notes_access_password_enabled)
      : await isVaultAccessPasswordEnabled(singlesId);
  // NOTES_SKIP_PASSWORD_CHECK is ignored — never skip this gate via env.
  if (!enabled) {
    return singlesId;
  }

  if (!(await isVaultAccessUnlocked(singlesId))) {
    res.status(428).json({
      error: 'Record Encrypt Password required',
      code: 'RECORD_VAULT_ACCESS_REQUIRED'
    });
    return null;
  }
  return singlesId;
}
