import {
  changeVaultAccessPassword,
  getVaultAccessStatus,
  logoffVaultAccessSession,
  setVaultAccessPassword,
  setVaultAccessPasswordEnabled,
  setVaultAccessPasswordHint,
  verifyVaultAccessPassword
} from '../../utils/recordVaultAccessPassword.js';
import {
  clearVaultAccessFailStatus,
  getVaultAccessFailStatus,
  recordVaultAccessFail
} from '../../utils/recordVaultAccessFailGuard.js';

function requireSinglesId(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return singlesId;
}

function readStorageType(req) {
  const raw =
    req.body?.storageType ??
    req.body?.storage_type ??
    req.query?.storageType ??
    req.query?.storage_type ??
    'onedrive';
  return String(raw).trim().toLowerCase() === 'usb' ? 'usb' : 'onedrive';
}

/** GET /api/recordVault/access/status */
export async function getRecordVaultAccessStatus(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    const status = await getVaultAccessStatus(singlesId);
    return res.json(status);
  } catch (err) {
    console.error('[getRecordVaultAccessStatus]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Unable to load vault access status' });
  }
}

/** POST /api/recordVault/access/verify  Body: { password } */
export async function verifyRecordVaultAccess(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  const password = String(req.body?.password ?? '').trim();
  if (!password) {
    return res.status(400).json({ error: 'password is required' });
  }

  try {
    const ok = await verifyVaultAccessPassword(singlesId, password);
    if (!ok) {
      return res.status(401).json({ error: 'Incorrect Encrypt Password' });
    }
    return res.json({ success: true, unlocked: true });
  } catch (err) {
    console.error('[verifyRecordVaultAccess]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Verification failed' });
  }
}

/** POST /api/recordVault/access/set  Body: { password, confirmPassword } — first-time setup */
export async function setRecordVaultAccessPassword(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  const password = String(req.body?.password ?? '').trim();
  const confirmPassword = String(req.body?.confirmPassword ?? req.body?.confirm_password ?? '').trim();
  const hint = req.body?.hint ?? req.body?.password_hint ?? '';
  if (!password) {
    return res.status(400).json({ error: 'password is required' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Password confirmation does not match' });
  }

  try {
    await setVaultAccessPassword(singlesId, password, hint);
    return res.json({ success: true, configured: true, unlocked: true });
  } catch (err) {
    console.error('[setRecordVaultAccessPassword]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Unable to set Encrypt Password' });
  }
}

/** POST /api/recordVault/access/change  Body: { currentPassword, newPassword, confirmPassword } */
export async function changeRecordVaultAccessPassword(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  const currentPassword = String(req.body?.currentPassword ?? req.body?.current_password ?? '').trim();
  const newPassword = String(req.body?.newPassword ?? req.body?.new_password ?? '').trim();
  const confirmPassword = String(req.body?.confirmPassword ?? req.body?.confirm_password ?? '').trim();
  const hint = req.body?.hint ?? req.body?.password_hint;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'New password confirmation does not match' });
  }

  try {
    await changeVaultAccessPassword(singlesId, currentPassword, newPassword, hint);
    return res.json({ success: true, configured: true, unlocked: true });
  } catch (err) {
    console.error('[changeRecordVaultAccessPassword]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Unable to change Encrypt Password' });
  }
}

/** POST /api/recordVault/access/hint  Body: { hint } */
export async function setRecordVaultAccessPasswordHint(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  const hint = req.body?.hint ?? req.body?.password_hint ?? '';

  try {
    const status = await setVaultAccessPasswordHint(singlesId, hint);
    return res.json({ success: true, ...status });
  } catch (err) {
    console.error('[setRecordVaultAccessPasswordHint]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Unable to update vault access hint' });
  }
}

/** POST /api/recordVault/access/logoff */
export async function logoffRecordVaultAccess(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  await logoffVaultAccessSession(singlesId);
  return res.json({ success: true });
}

/** GET /api/recordVault/access/fail-status?storageType=onedrive|usb */
export async function getRecordVaultAccessFailStatus(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    const status = await getVaultAccessFailStatus(singlesId, readStorageType(req));
    return res.json(status);
  } catch (err) {
    console.error('[getRecordVaultAccessFailStatus]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Unable to load Encrypt Password fail status' });
  }
}

/**
 * POST /api/recordVault/access/fail
 * Body: { storageType: 'onedrive'|'usb', mountPath? }
 * Call after client-side vault-password verify fails (password never sent here).
 */
export async function postRecordVaultAccessFail(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    const mountPath = req.body?.mountPath ?? req.body?.mount_path ?? '';
    const status = await recordVaultAccessFail(singlesId, readStorageType(req), { mountPath });
    const httpStatus = status.vaultFormatted || status.needsClientFormat ? 403 : status.locked ? 429 : 401;
    return res.status(httpStatus).json(status);
  } catch (err) {
    console.error('[postRecordVaultAccessFail]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Unable to record Encrypt Password failure' });
  }
}

/** POST /api/recordVault/access/fail/clear  Body: { storageType } — after successful verify */
export async function clearRecordVaultAccessFail(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    const storageType = readStorageType(req);
    await clearVaultAccessFailStatus(singlesId, storageType);
    return res.json({ success: true, storageType });
  } catch (err) {
    console.error('[clearRecordVaultAccessFail]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Unable to clear Encrypt Password fail status' });
  }
}

/** POST /api/recordVault/access/enabled  Body: { enabled: true|false } */
export async function setRecordVaultAccessPasswordEnabled(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  if (req.body?.enabled === undefined || req.body?.enabled === null) {
    return res.status(400).json({ error: 'enabled is required' });
  }

  try {
    const status = await setVaultAccessPasswordEnabled(singlesId, Boolean(req.body.enabled), {
      password: req.body?.password ?? req.body?.currentPassword ?? '',
      keepSessionUnlocked: Boolean(req.body?.keepSessionUnlocked)
    });
    return res.json({ success: true, ...status });
  } catch (err) {
    console.error('[setRecordVaultAccessPasswordEnabled]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Unable to update Encrypt Password setting' });
  }
}
