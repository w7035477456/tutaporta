/**
 * TutaDrive Cloud — left-panel replacement for OneDrive when LEFT_SIDE=TutaDrive.
 * Vault under ${LARGE_CHEAP_STORAGE_FOLDER}/users/M{member_id}/notes (encrypted at rest).
 * Photos under …/photos (symlinked from vault photos when possible).
 * Reuses the 'onedrive' session slot (workspace pane); no Microsoft sync.
 */

import fs from 'fs';
import path from 'path';
import {
  getVaultSession,
  initializeVaultOnUsbWithKey,
  unlockVaultUsbWithKey,
  logoffVaultUsb
} from '../../utils/recordVaultUsb/vaultSession.js';
import { RecordVaultUnlockError } from '../../utils/recordVaultUsb/unlockGuard.js';
import {
  createEnvVaultKeyMaterial,
  listEnvVaultUnlockKeys
} from '../../utils/recordVaultIconKeys.js';
import { isRecordVaultIconEncryptionEnabled } from '../../utils/recordVaultIconEncryption.js';
import { requireVaultAccessSession } from '../../utils/recordVaultAccessPassword.js';
import { readVaultMeta, validateVaultOnMount } from '../../utils/recordVaultUsb/usbScan.js';
import { vaultHasDbFile, vaultMetaPath } from '../../utils/recordVaultUsb/vaultPaths.js';
import {
  ensureTutaDriveMemberLayout,
  getLeftSideMode,
  isLeftSideTutaDrive,
  loadMemberIdForSingles,
  wipeTutaDriveMemberVault
} from '../../utils/tutaDriveMemberPaths.js';
import {
  listTutaDriveBackups,
  readTutaDriveEncryptedBackup,
  restoreTutaDriveVaultFromZipFile,
  storeTutaDriveEncryptedBackup,
  streamTutaDriveVaultBackupZip
} from '../../utils/recordVaultTutaDriveBackup.js';
import { parseOneDriveBackupZipUpload } from '../../utils/recordVaultOneDrive/parseOneDriveBackupZipUpload.js';
import { isStoragePermissionError } from '../../utils/storagePermissionError.js';
import { sendRecordVaultError } from '../../utils/recordVaultRouteErrors.js';

const TUTADRIVE_ENV_KEY_TYPE = 'tutadrive';

function requireSinglesId(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return singlesId;
}

function unlockErrorResponse(err) {
  if (isStoragePermissionError(err)) {
    return {
      status: 500,
      body: {
        code: 'STORAGE_PERMISSION',
        error: 'Folder permission error. Please contact your admin'
      },
      permission: true
    };
  }
  if (err?.name === 'RecordVaultUnlockError' || err instanceof RecordVaultUnlockError) {
    return {
      status: Number(err.statusCode) || 403,
      body: {
        error: err.message || 'Unable to unlock TutaDrive vault',
        remainingAttempts: err.remainingAttempts,
        lockedUntil: err.lockedUntil
      }
    };
  }
  return {
    status: 400,
    body: { error: err?.message || 'Unable to unlock TutaDrive vault' }
  };
}

async function resolveMemberContext(singlesId) {
  if (!isLeftSideTutaDrive()) {
    throw new Error('LEFT_SIDE is not TutaDrive');
  }
  const memberId = await loadMemberIdForSingles(singlesId);
  if (!memberId) {
    throw new Error('Your member number is not set; cannot open TutaDrive storage.');
  }
  // Creates users/M{id}/notes/TutaNotes + photos for this user; migrates OneDrive staging once.
  const layout = ensureTutaDriveMemberLayout(memberId, { singlesId });
  return { memberId, ...layout };
}

/**
 * Drop a leftover OneDrive-staging session so writes go to TutaDrive M{id} path.
 * Same 'onedrive' session slot is reused for TutaDrive.
 */
async function dropStaleCloudSessionIfWrongMount(singlesId, notesMount) {
  const session = getVaultSession(singlesId, 'onedrive');
  if (!session?.unlocked || !session.mountPath) return;
  const expected = path.resolve(notesMount);
  const actual = path.resolve(String(session.mountPath));
  if (actual === expected) {
    session.tutaDrive = true;
    session.label = 'TutaDrive';
    return;
  }
  console.warn(
    `[tutaDrive] clearing stale cloud session mount ${actual} (expected ${expected})`
  );
  await logoffVaultUsb(singlesId, 'onedrive').catch(() => {});
}

function sessionPayload(singlesId, memberId, notesMount) {
  const session = getVaultSession(singlesId, 'onedrive');
  const expected = path.resolve(notesMount);
  const actual = session?.mountPath ? path.resolve(String(session.mountPath)) : null;
  const unlocked = Boolean(session?.unlocked && actual === expected);
  return {
    unlocked,
    storageType: 'onedrive',
    tutaDrive: true,
    memberId,
    memberFolder: `M${String(memberId).replace(/^M/i, '')}`,
    mountPath: notesMount,
    label: 'TutaDrive'
  };
}

function vaultStatusFlags(notesMount) {
  const hasMeta = fs.existsSync(vaultMetaPath(notesMount));
  const hasDb = vaultHasDbFile(notesMount);
  const check = hasMeta ? validateVaultOnMount(notesMount) : { ok: false };
  return {
    hasVault: Boolean(hasMeta && hasDb && check.ok),
    needsReformat: Boolean(hasMeta && (!hasDb || !check.ok)),
    vaultFilesystemInvalid: Boolean(hasMeta && !check.ok)
  };
}

async function resolveTutaDriveKeyMaterial() {
  if (!isRecordVaultIconEncryptionEnabled()) return null;
  return createEnvVaultKeyMaterial(TUTADRIVE_ENV_KEY_TYPE);
}

async function resolveTutaDriveUnlockKey(notesMount) {
  if (!isRecordVaultIconEncryptionEnabled()) return null;
  const meta = readVaultMeta(notesMount);
  const keys = await listEnvVaultUnlockKeys(TUTADRIVE_ENV_KEY_TYPE, meta);
  return keys[0]?.key ?? null;
}

function tagSessionAsTutaDrive(singlesId) {
  const session = getVaultSession(singlesId, 'onedrive');
  if (session) {
    session.driveSinglesId = null;
    session.tutaDrive = true;
    session.label = 'TutaDrive';
  }
  return session;
}

/** GET /api/recordVault/tutadrive/status */
export async function getRecordVaultTutaDriveStatus(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  try {
    if (!isLeftSideTutaDrive()) {
      return res.json({
        leftSide: getLeftSideMode(),
        tutadrive: { enabled: false },
        session: { unlocked: false }
      });
    }
    const { memberId, notesMount, vaultRoot, memberFolder } = await resolveMemberContext(singlesId);
    await dropStaleCloudSessionIfWrongMount(singlesId, notesMount);
    const flags = vaultStatusFlags(notesMount);
    return res.json({
      leftSide: 'TutaDrive',
      tutadrive: {
        enabled: true,
        memberId,
        memberFolder: memberFolder || `M${String(memberId).replace(/^M/i, '')}`,
        notesPath: notesMount,
        vaultPath: vaultRoot,
        ...flags
      },
      session: sessionPayload(singlesId, memberId, notesMount)
    });
  } catch (err) {
    console.error('[getRecordVaultTutaDriveStatus]', err?.message || err);
    return sendRecordVaultError(res, err, 'Unable to read TutaDrive status', {
      route: 'getRecordVaultTutaDriveStatus',
      singlesId,
      status: isStoragePermissionError(err) ? 500 : 400
    });
  }
}

/** POST /api/recordVault/tutadrive/format — wipe member notes vault only. */
export async function formatRecordVaultTutaDrive(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  try {
    await logoffVaultUsb(singlesId, 'onedrive').catch(() => {});
    const { memberId } = await resolveMemberContext(singlesId);
    wipeTutaDriveMemberVault(memberId);
    return res.json({
      success: true,
      memberId,
      memberFolder: `M${String(memberId).replace(/^M/i, '')}`
    });
  } catch (err) {
    console.error('[formatRecordVaultTutaDrive]', err?.message || err);
    return sendRecordVaultError(res, err, 'Unable to format TutaDrive', {
      route: 'formatRecordVaultTutaDrive',
      singlesId,
      status: isStoragePermissionError(err) ? 500 : 400
    });
  }
}

/** POST /api/recordVault/tutadrive/init */
export async function initRecordVaultTutaDrive(req, res) {
  const singlesId = await requireVaultAccessSession(req, res);
  if (!singlesId) return;
  try {
    const { memberId, notesMount } = await resolveMemberContext(singlesId);
    if (fs.existsSync(vaultMetaPath(notesMount))) {
      return res.status(400).json({ error: 'A TutaDrive vault already exists. Format first to recreate.' });
    }
    const keyMaterial = await resolveTutaDriveKeyMaterial();
    await initializeVaultOnUsbWithKey(notesMount, keyMaterial?.key ?? null, keyMaterial);
    ensureTutaDriveMemberLayout(memberId, { singlesId });
    return res.json({ success: true, memberId, hasVault: true });
  } catch (err) {
    console.error('[initRecordVaultTutaDrive]', err?.message || err);
    return sendRecordVaultError(res, err, 'Unable to initialize TutaDrive vault', {
      route: 'initRecordVaultTutaDrive',
      singlesId,
      status: isStoragePermissionError(err) ? 500 : 400
    });
  }
}

/**
 * POST /api/recordVault/tutadrive/unlock
 * Requires Encrypt Password session (same as Open TutaNotes Cloud).
 */
export async function unlockRecordVaultTutaDrive(req, res) {
  const singlesId = await requireVaultAccessSession(req, res);
  if (!singlesId) return;
  try {
    const { memberId, notesMount } = await resolveMemberContext(singlesId);
    await dropStaleCloudSessionIfWrongMount(singlesId, notesMount);
    let flags = vaultStatusFlags(notesMount);

    if (!flags.hasVault) {
      const keyMaterial = await resolveTutaDriveKeyMaterial();
      if (!fs.existsSync(vaultMetaPath(notesMount))) {
        await initializeVaultOnUsbWithKey(notesMount, keyMaterial?.key ?? null, keyMaterial);
        ensureTutaDriveMemberLayout(memberId, { singlesId });
      }
      flags = vaultStatusFlags(notesMount);
    }

    const key = await resolveTutaDriveUnlockKey(notesMount);
    await unlockVaultUsbWithKey(singlesId, notesMount, key, {
      storageType: 'onedrive',
      skipBackup: true
    });
    tagSessionAsTutaDrive(singlesId);

    return res.json({
      success: true,
      tutaDrive: true,
      session: sessionPayload(singlesId, memberId, notesMount),
      ...flags
    });
  } catch (err) {
    if (isStoragePermissionError(err)) {
      return sendRecordVaultError(res, err, 'Folder permission error. Please contact your admin', {
        route: 'unlockRecordVaultTutaDrive',
        singlesId
      });
    }
    const mapped = unlockErrorResponse(err);
    if (mapped.status >= 500) console.error('[unlockRecordVaultTutaDrive]', err);
    return res.status(mapped.status).json(mapped.body);
  }
}

/** POST /api/recordVault/tutadrive/logoff */
export async function logoffRecordVaultTutaDrive(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  try {
    await logoffVaultUsb(singlesId, 'onedrive');
    return res.json({ success: true });
  } catch (err) {
    console.error('[logoffRecordVaultTutaDrive]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Logoff failed' });
  }
}

/** GET /api/recordVault/tutadrive/backup-zip — plain vault zip for client Encrypt-Password seal. */
export async function downloadRecordVaultTutaDriveBackupZip(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  try {
    if (!isLeftSideTutaDrive()) {
      return res.status(400).json({ error: 'LEFT_SIDE is not TutaDrive' });
    }
    await streamTutaDriveVaultBackupZip(singlesId, res);
  } catch (err) {
    console.error('[downloadRecordVaultTutaDriveBackupZip]', err?.message || err);
    if (!res.headersSent) {
      return sendRecordVaultError(res, err, 'Unable to build TutaDrive backup zip', {
        route: 'downloadRecordVaultTutaDriveBackupZip',
        singlesId,
        status: isStoragePermissionError(err) ? 500 : 400
      });
    }
  }
}

/**
 * POST /api/recordVault/tutadrive/backup
 * Multipart field `backup` = Encrypt-Password-sealed bytes (TNBAK1).
 * Stores as users/M{id}/backup_YYYY-MM-DD.zip and deletes any prior backup_*.zip.
 */
export async function storeRecordVaultTutaDriveBackup(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  let upload = null;
  try {
    if (!isLeftSideTutaDrive()) {
      return res.status(400).json({ error: 'LEFT_SIDE is not TutaDrive' });
    }
    const memberId = await loadMemberIdForSingles(singlesId);
    if (!memberId) {
      return res.status(400).json({ error: 'Your member number is not set; cannot store backup.' });
    }
    upload = await parseOneDriveBackupZipUpload(req);
    const encrypted = fs.readFileSync(upload.zipPath);
    const stored = storeTutaDriveEncryptedBackup(memberId, encrypted);
    return res.json({
      success: true,
      ...stored,
      message: `Backup saved (Encrypt Password sealed). Only one backup is kept; previous backup was replaced.`
    });
  } catch (err) {
    console.error('[storeRecordVaultTutaDriveBackup]', err?.message || err);
    return sendRecordVaultError(res, err, 'Unable to store TutaDrive backup', {
      route: 'storeRecordVaultTutaDriveBackup',
      singlesId,
      status: isStoragePermissionError(err) ? 500 : 400
    });
  } finally {
    if (upload?.tmpDir) {
      try {
        fs.rmSync(upload.tmpDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }
}

/** GET /api/recordVault/tutadrive/backup — download the sealed backup file (if any). */
export async function downloadRecordVaultTutaDriveStoredBackup(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  try {
    if (!isLeftSideTutaDrive()) {
      return res.status(400).json({ error: 'LEFT_SIDE is not TutaDrive' });
    }
    const memberId = await loadMemberIdForSingles(singlesId);
    if (!memberId) {
      return res.status(400).json({ error: 'Your member number is not set' });
    }
    const current = readTutaDriveEncryptedBackup(memberId);
    if (!current) {
      return res.status(404).json({ error: 'No TutaDrive backup found' });
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${current.fileName}"`);
    res.setHeader('Content-Length', String(current.data.length));
    return res.end(current.data);
  } catch (err) {
    console.error('[downloadRecordVaultTutaDriveStoredBackup]', err?.message || err);
    return sendRecordVaultError(res, err, 'Unable to read TutaDrive backup', {
      route: 'downloadRecordVaultTutaDriveStoredBackup',
      singlesId,
      status: isStoragePermissionError(err) ? 500 : 400
    });
  }
}

/** GET /api/recordVault/tutadrive/backup/status — list current single backup. */
export async function getRecordVaultTutaDriveBackupStatus(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  try {
    if (!isLeftSideTutaDrive()) {
      return res.json({ enabled: false, backups: [] });
    }
    const memberId = await loadMemberIdForSingles(singlesId);
    if (!memberId) {
      return res.json({ enabled: true, backups: [], memberId: null });
    }
    ensureTutaDriveMemberLayout(memberId, { singlesId });
    const backups = listTutaDriveBackups(memberId).map(({ fileName, sizeBytes, mtimeMs, absPath }) => ({
      fileName,
      sizeBytes,
      mtimeMs,
      absPath
    }));
    return res.json({ enabled: true, memberId, backups });
  } catch (err) {
    console.error('[getRecordVaultTutaDriveBackupStatus]', err?.message || err);
    return sendRecordVaultError(res, err, 'Unable to read backup status', {
      route: 'getRecordVaultTutaDriveBackupStatus',
      singlesId,
      status: 400
    });
  }
}

/**
 * POST /api/recordVault/tutadrive/restore-zip
 * Multipart field `backup` = plaintext vault zip (client already decrypted with Encrypt Password).
 */
export async function restoreRecordVaultTutaDriveBackupZip(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  let upload = null;
  try {
    if (!isLeftSideTutaDrive()) {
      return res.status(400).json({ error: 'LEFT_SIDE is not TutaDrive' });
    }
    upload = await parseOneDriveBackupZipUpload(req);
    const result = await restoreTutaDriveVaultFromZipFile(singlesId, upload.zipPath);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[restoreRecordVaultTutaDriveBackupZip]', err?.message || err);
    return sendRecordVaultError(res, err, 'Unable to restore TutaDrive backup', {
      route: 'restoreRecordVaultTutaDriveBackupZip',
      singlesId,
      status: isStoragePermissionError(err) ? 500 : 400
    });
  } finally {
    if (upload?.tmpDir) {
      try {
        fs.rmSync(upload.tmpDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }
}
