import { requireVaultAccessSession } from '../../utils/recordVaultAccessPassword.js';
import fs from 'fs';
import {
  createEnvVaultKeyMaterial,
  listEnvVaultUnlockKeys
} from '../../utils/recordVaultIconKeys.js';
import {
  getVaultSession,
  initializeVaultOnUsbWithKey,
  logoffVaultUsb,
  flushAndAwaitCloudSync,
  discardVaultSessionWithoutCloudSync,
  unlockVaultUsbWithKey,
  vaultUsbStatus
} from '../../utils/recordVaultUsb/vaultSession.js';
import { RecordVaultUnlockError } from '../../utils/recordVaultUsb/unlockGuard.js';
import { clearOneDriveConnection } from '../../utils/recordVaultOneDrive/oneDriveTokenStore.js';
import { clearAllOneDriveDirty } from '../../utils/recordVaultOneDrive/oneDriveVaultDirty.js';
import { registerVaultClusterUnlock } from '../../utils/recordVaultClusterSession.js';
import { snapshotVaultSessionFileCountsToLast } from '../../utils/vaultSessionFileCounts.js';
import { readVaultMeta } from '../../utils/recordVaultUsb/usbScan.js';
import {
  loadOneDriveEmailsForPicker,
  rememberOneDriveEmail
} from '../../utils/recordVaultOneDrive/oneDriveEmailHistory.js';
import {
  cleanupOneDriveStaging,
  downloadVaultToStaging,
  formatEmptyOneDriveVaultFolderIfNeeded,
  getAccessTokenForSingles,
  getOneDriveUnlockGuardStatus,
  ONEDRIVE_VAULT_REFORMAT_MESSAGE,
  prepareEmptyOneDriveStaging,
  probeOneDriveVaultStatus,
  stagingMountPath,
  uploadOneDriveVaultMetaOnly,
  uploadOneDriveVaultEssentials,
  wipeOneDriveVaultFolder,
  writeOneDriveTestFile,
  listOneDriveVaultTree
} from '../../utils/recordVaultOneDrive/oneDriveVaultSync.js';
import { isOneDriveVaultOAuthConfigured } from './recordVaultOneDriveOAuth.js';
import { getOneDriveVaultFolderName } from '../../utils/recordVaultOneDrive/oneDriveApi.js';
import {
  buildVaultStorageChoice,
  isVaultOneDriveOffered
} from '../../utils/recordVaultStorageFlags.js';
import {
  isRecordVaultIconEncryptionEnabled
} from '../../utils/recordVaultIconEncryption.js';
import {
  isRecordVaultCloudColumnMissingError,
  logRecordVaultCloudSchemaMissingOnce,
  recordVaultCloudSchemaErrorResponse
} from '../../utils/recordVaultCloudSchema.js';
import { rvCloudError, rvCloudLog, rvCloudWarn } from '../../utils/recordVaultCloudDebugLog.js';
import {
  restoreOneDriveVaultFromZipFile,
  streamOneDriveVaultBackupZip
} from '../../utils/recordVaultOneDrive/oneDriveVaultBackup.js';
import { parseOneDriveBackupZipUpload } from '../../utils/recordVaultOneDrive/parseOneDriveBackupZipUpload.js';
import { readRecordVaultCacheIcon, clearRecordVaultCacheIcon } from '../../utils/recordVaultCacheIcon.js';
import {
  clearVaultLogoffProgress,
  getVaultLogoffProgress,
  setVaultLogoffProgress
} from '../../utils/recordVaultOneDrive/vaultLogoffProgress.js';
import {
  clearVaultOpenProgress,
  getVaultOpenProgress,
  setVaultOpenProgress
} from '../../utils/recordVaultOneDrive/vaultOpenProgress.js';
import {
  getVaultSyncProgress,
  setVaultSyncProgress
} from '../../utils/recordVaultOneDrive/vaultSyncProgress.js';

function requireSinglesId(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return singlesId;
}

function unlockErrorResponse(err) {
  if (err instanceof RecordVaultUnlockError) {
    return {
      status: err.vaultWiped ? 410 : err.code === 'RECORD_VAULT_USB_UNLOCK_LOCKED' ? 423 : 400,
      body: {
        error: err.message,
        code: err.code,
        lockedUntil: err.lockedUntil,
        remainingSeconds: err.remainingSeconds,
        failedAttempts: err.failedAttempts,
        vaultWiped: err.vaultWiped,
        errorSecondary: err.errorSecondary
      }
    };
  }
  return {
    status: 400,
    body: { error: err?.message || 'Unable to unlock OneDrive vault' }
  };
}

async function tagSessionAsOneDrive(session, singlesId, folderId) {
  if (!session) return;
  session.storageType = 'onedrive';
  session.driveSinglesId = Number(singlesId);
  session.driveFolderId = folderId;
  clearAllOneDriveDirty(Number(singlesId));
  await registerVaultClusterUnlock({
    singlesId,
    storageType: 'onedrive',
    mountPath: session.mountPath,
    backupMountPath: session.backupMountPath,
    driveFolderId: folderId
  });
}

/** New vault: Argon2id key + salt material. Existing unlock derives from vault meta. */
async function resolveOneDriveVaultKeyMaterial() {
  if (!isRecordVaultIconEncryptionEnabled()) {
    return null;
  }
  return createEnvVaultKeyMaterial('onedrive');
}

async function openOneDriveVaultSession(singlesId, oneDriveStatus, { onProgress } = {}) {
  const report = async (percent, label) => {
    if (typeof onProgress !== 'function') return;
    try {
      await onProgress({ percent, label });
    } catch {
      // ignore
    }
  };
  const { mountPath, folderId } = await downloadVaultToStaging(singlesId, null, { onProgress });
  let key = null;
  if (isRecordVaultIconEncryptionEnabled()) {
    const meta = readVaultMeta(mountPath);
    const keys = await listEnvVaultUnlockKeys('onedrive', meta);
    key = keys[0]?.key ?? null;
  }
  await report(92, 'Unlocking vault');
  const result = await unlockVaultUsbWithKey(singlesId, mountPath, key, {
    skipBackup: true,
    storageType: 'onedrive'
  });
  const session = getVaultSession(singlesId, 'onedrive');
  await tagSessionAsOneDrive(session, singlesId, folderId);
  await report(100, 'Done');
  // Do not re-upload on unlock — logoff already syncs vault.db + photos to OneDrive.
  return {
    ...result,
    storageType: 'onedrive',
    oneDriveEmail: oneDriveStatus.email,
    folderId
  };
}

/** GET /api/recordVault/onedrive/config */
export function getRecordVaultOneDriveConfig(req, res) {
  const choice = buildVaultStorageChoice(isVaultOneDriveOffered(), isOneDriveVaultOAuthConfigured());
  return res.json({
    ...choice,
    enabled: choice.enabled,
    iconEncryptionRequired: isRecordVaultIconEncryptionEnabled(),
    folderName: getOneDriveVaultFolderName()
  });
}

/** GET /api/recordVault/onedrive/status */
export async function getRecordVaultOneDriveStatus(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    const cacheIcon = await readRecordVaultCacheIcon(singlesId, 'onedrive');
    const onedrive = await probeOneDriveVaultStatus(singlesId);
    const session = await vaultUsbStatus(singlesId, 'onedrive');
    return res.json({
      enabled: buildVaultStorageChoice(isVaultOneDriveOffered(), isOneDriveVaultOAuthConfigured()).enabled,
      cacheIcon,
      cacheOneDriveIcon: cacheIcon,
      onedrive,
      session: session?.unlocked && session?.storageType === 'onedrive' ? session : { unlocked: false }
    });
  } catch (err) {
    if (isRecordVaultCloudColumnMissingError(err)) {
      const once = logRecordVaultCloudSchemaMissingOnce('OneDrive', err);
      if (once) rvCloudWarn('OneDrive', 'cloud schema missing — run addSinglesRecordVaultCloud.sql on Primary', once);
      const mapped = recordVaultCloudSchemaErrorResponse('OneDrive', err);
      return res.status(mapped.status).json(mapped.body);
    }
    console.error('[getRecordVaultOneDriveStatus]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Unable to read OneDrive status' });
  }
}

/** POST /api/recordVault/onedrive/disconnect */
export async function disconnectRecordVaultOneDrive(req, res) {
  const singlesId = await requireVaultAccessSession(req, res);
  if (!singlesId) return;

  try {
    const session = getVaultSession(singlesId, 'onedrive');
    if (session) {
      await logoffVaultUsb(singlesId, 'onedrive');
    }
    cleanupOneDriveStaging(singlesId);
    await clearOneDriveConnection(singlesId);
    return res.json({ success: true });
  } catch (err) {
    console.error('[disconnectRecordVaultOneDrive]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Unable to disconnect OneDrive' });
  }
}

/** GET /api/recordVault/onedrive/unlock-guard */
export async function getRecordVaultOneDriveUnlockGuard(req, res) {
  if (!(await requireVaultAccessSession(req, res))) return;

  const singlesId = Number(req.auth?.singles_id);
  try {
    const status = await getOneDriveUnlockGuardStatus(singlesId);
    if (!status.ok) {
      return res.status(400).json({ error: status.error || 'Unable to read unlock guard' });
    }
    return res.json(status);
  } catch (err) {
    console.error('[getRecordVaultOneDriveUnlockGuard]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Unable to read unlock guard' });
  }
}

/** POST /api/recordVault/onedrive/init */
export async function initRecordVaultOneDrive(req, res) {
  const singlesId = await requireVaultAccessSession(req, res);
  if (!singlesId) return;

  try {
    const oneDriveStatus = await probeOneDriveVaultStatus(singlesId);
    if (!oneDriveStatus.connected) {
      return res.status(400).json({ error: 'Connect OneDrive first' });
    }
    if (oneDriveStatus.hasVault) {
      if (oneDriveStatus.needsReformat && isRecordVaultIconEncryptionEnabled()) {
        return res.status(400).json({ error: ONEDRIVE_VAULT_REFORMAT_MESSAGE, needsReformat: true });
      }
      if (!isRecordVaultIconEncryptionEnabled()) {
        const payload = await openOneDriveVaultSession(singlesId, oneDriveStatus);
        return res.json(payload);
      }
      return res.status(400).json({ error: 'A vault already exists on OneDrive. Click Use One Drive instead.' });
    }

    const keyMaterial = await resolveOneDriveVaultKeyMaterial();
    const { mountPath, folderId, accessToken } = await prepareEmptyOneDriveStaging(singlesId);
    const formatResult = await formatEmptyOneDriveVaultFolderIfNeeded(
      singlesId,
      accessToken,
      folderId,
      keyMaterial
    );
    if (!formatResult.formatted) {
      await initializeVaultOnUsbWithKey(mountPath, keyMaterial?.key ?? null, keyMaterial);
      await uploadOneDriveVaultEssentials(singlesId, mountPath);
    }
    const result = await unlockVaultUsbWithKey(singlesId, mountPath, keyMaterial?.key ?? null, {
      skipBackup: true,
      storageType: 'onedrive'
    });
    const session = getVaultSession(singlesId, 'onedrive');
    await tagSessionAsOneDrive(session, singlesId, folderId);

    return res.json({
      ...result,
      storageType: 'onedrive',
      oneDriveEmail: oneDriveStatus.email,
      folderId
    });
  } catch (err) {
    console.error('[initRecordVaultOneDrive]', err?.message || err);
    const msg = String(err?.message || '');
    if (/not be found|itemnotfound|resource could not be found/i.test(msg)) {
      return res.status(400).json({
        error:
          'OneDrive vault folder was missing (stale link after Format). Click Format MyVault folder, then Login OneDrive for MyNote again.',
        needsReformat: true
      });
    }
    return res.status(400).json({ error: err?.message || 'Unable to create OneDrive vault' });
  }
}

/** GET /api/recordVault/onedrive/open-progress — poll honest 0–100% during Cloud open */
export async function getRecordVaultOneDriveOpenProgress(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  try {
    const progress = await getVaultOpenProgress(singlesId);
    return res.json(progress);
  } catch (err) {
    console.error('[getRecordVaultOneDriveOpenProgress]', err?.message || err);
    return res.json({ percent: 0, label: '' });
  }
}

/** POST /api/recordVault/onedrive/unlock */
export async function unlockRecordVaultOneDrive(req, res) {
  const singlesId = await requireVaultAccessSession(req, res);
  if (!singlesId) return;

  try {
    await setVaultOpenProgress(singlesId, { percent: 0, label: 'Opening TutaNotes Cloud' });
    const oneDriveStatus = await probeOneDriveVaultStatus(singlesId);
    if (!oneDriveStatus.connected) {
      return res.status(400).json({ error: 'Connect OneDrive first' });
    }
    if (!oneDriveStatus.hasVault) {
      return res.status(400).json({ error: 'No vault found on OneDrive. Create one first.' });
    }
    if (oneDriveStatus.legacyPinVault) {
      return res.status(400).json({
        error: 'This OneDrive vault uses the retired 6-digit PIN format. Create a new vault instead.'
      });
    }

    const payload = await openOneDriveVaultSession(singlesId, oneDriveStatus, {
      onProgress: async ({ percent, label }) => {
        await setVaultOpenProgress(singlesId, { percent, label });
      }
    });
    await setVaultOpenProgress(singlesId, { percent: 100, label: 'Done' });
    return res.json(payload);
  } catch (err) {
    const mapped = unlockErrorResponse(err);
    const errText = String(err?.message || mapped.body?.error || '');
    const skipStagingUpload =
      mapped.body?.vaultWiped ||
      /vault\.meta\.json/i.test(errText) ||
      /older format|unreadable|reformat/i.test(errText);
    if (!skipStagingUpload && err instanceof RecordVaultUnlockError && !mapped.body?.vaultWiped) {
      try {
        const stagingPath = stagingMountPath(singlesId);
        await uploadOneDriveVaultMetaOnly(singlesId, stagingPath);
      } catch (syncErr) {
        console.error('[unlockRecordVaultOneDrive] unlock-guard meta sync failed:', syncErr?.message || syncErr);
      }
    }
    if (mapped.body?.vaultWiped) {
      try {
        await wipeOneDriveVaultFolder(singlesId);
        cleanupOneDriveStaging(singlesId);
      } catch (wipeErr) {
        console.error('[unlockRecordVaultOneDrive] wipe failed:', wipeErr?.message || wipeErr);
      }
    }
    console.error('[unlockRecordVaultOneDrive]', err?.message || err);
    if (/vault\.meta\.json/i.test(String(mapped.body?.error || '')) && isRecordVaultIconEncryptionEnabled()) {
      mapped.body.error = ONEDRIVE_VAULT_REFORMAT_MESSAGE;
      mapped.body.needsReformat = true;
    }
    try {
      await clearVaultOpenProgress(singlesId);
    } catch {
      // ignore
    }
    return res.status(mapped.status).json(mapped.body);
  } finally {
    // Keep 100% briefly for the last poll, then clear.
    setTimeout(() => {
      void clearVaultOpenProgress(singlesId);
    }, 2000);
  }
}

/** GET /api/recordVault/onedrive/logoff-progress — poll honest 0–100% during Cloud logoff */
export async function getRecordVaultOneDriveLogoffProgress(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  try {
    const progress = await getVaultLogoffProgress(singlesId);
    return res.json(progress);
  } catch (err) {
    console.error('[getRecordVaultOneDriveLogoffProgress]', err?.message || err);
    return res.json({ percent: 0, label: '' });
  }
}

/** POST /api/recordVault/onedrive/logoff */
export async function logoffRecordVaultOneDrive(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    await setVaultLogoffProgress(singlesId, { percent: 2, label: 'Saving notes to OneDrive…' });
    const session = getVaultSession(singlesId, 'onedrive');
    if (session) {
      await logoffVaultUsb(singlesId, 'onedrive', {
        onProgress: async ({ percent, label }) => {
          await setVaultLogoffProgress(singlesId, { percent, label });
        }
      });
      cleanupOneDriveStaging(singlesId);
    } else {
      // No in-memory session on this node — still freeze login-gate counters.
      await snapshotVaultSessionFileCountsToLast(singlesId);
    }
    await clearRecordVaultCacheIcon(singlesId, 'onedrive');
    await setVaultLogoffProgress(singlesId, { percent: 100, label: 'Done' });
    return res.json({ success: true, cacheOneDriveIcon: '' });
  } catch (err) {
    console.error('[logoffRecordVaultOneDrive]', err?.message || err);
    try {
      await clearVaultLogoffProgress(singlesId);
    } catch {
      // ignore
    }
    return res.status(400).json({ error: err?.message || 'Logoff failed' });
  } finally {
    // Keep 100% briefly for the last poll, then clear.
    setTimeout(() => {
      void clearVaultLogoffProgress(singlesId);
    }, 2000);
  }
}

/**
 * POST /api/recordVault/onedrive/sync
 * Await OneDrive vault.db upload without logging off (used after PIN encrypt).
 */
export async function syncRecordVaultOneDrive(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    await setVaultSyncProgress(singlesId, { percent: 0, label: 'Saving to Cloud…' });
    const result = await flushAndAwaitCloudSync(singlesId, 'onedrive', {
      onProgress: async ({ percent, label }) => {
        await setVaultSyncProgress(singlesId, { percent, label });
      }
    });
    await setVaultSyncProgress(singlesId, { percent: 100, label: 'Done' });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[syncRecordVaultOneDrive]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Cloud sync failed' });
  }
}

/** GET /api/recordVault/onedrive/sync-progress — poll honest 0–100% during mid-session Cloud sync */
export async function getRecordVaultOneDriveSyncProgress(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  try {
    const progress = await getVaultSyncProgress(singlesId);
    return res.json(progress);
  } catch (err) {
    console.error('[getRecordVaultOneDriveSyncProgress]', err?.message || err);
    return res.json({ percent: 0, label: '' });
  }
}

/** POST /api/recordVault/onedrive/format */
export async function formatRecordVaultOneDrive(req, res) {
  const singlesId = await requireVaultAccessSession(req, res);
  if (!singlesId) return;

  try {
    const session = getVaultSession(singlesId, 'onedrive');
    if (session) {
      await logoffVaultUsb(singlesId, 'onedrive');
    }
    const newFolderId = await wipeOneDriveVaultFolder(singlesId);
    cleanupOneDriveStaging(singlesId);
    try {
      const { accessToken } = await getAccessTokenForSingles(singlesId);
      let vaultKeyMaterial = null;
      if (isRecordVaultIconEncryptionEnabled()) {
        vaultKeyMaterial = await createEnvVaultKeyMaterial('onedrive');
      }
      await formatEmptyOneDriveVaultFolderIfNeeded(singlesId, accessToken, newFolderId, vaultKeyMaterial);
    } catch (layoutErr) {
      console.error('[formatRecordVaultOneDrive] layout init failed:', layoutErr?.message || layoutErr);
    }
    return res.json({
      success: true,
      hasVault: false,
      needsReformat: false,
      folderId: newFolderId
    });
  } catch (err) {
    console.error('[formatRecordVaultOneDrive]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Unable to format OneDrive vault' });
  }
}

/** GET /api/recordVault/onedrive/vault-tree — read-only OneDrive folder tree (any cluster node). */
export async function getRecordVaultOneDriveVaultTree(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    const result = await listOneDriveVaultTree(singlesId);
    return res.json(result);
  } catch (err) {
    if (isRecordVaultCloudColumnMissingError(err)) {
      const once = logRecordVaultCloudSchemaMissingOnce('OneDrive', err);
      if (once) rvCloudWarn('OneDrive', 'cloud schema missing — run addSinglesRecordVaultCloud.sql on Primary', once);
      const mapped = recordVaultCloudSchemaErrorResponse('OneDrive', err);
      return res.status(mapped.status).json(mapped.body);
    }
    console.error('[getRecordVaultOneDriveVaultTree]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Unable to list OneDrive vault folder' });
  }
}

/** POST /api/recordVault/onedrive/test-write */
export async function testWriteRecordVaultOneDrive(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  rvCloudLog('OneDrive', 'POST /api/recordVault/onedrive/test-write', {
    singlesId,
    path: req.originalUrl
  });

  try {
    const result = await writeOneDriveTestFile(singlesId);
    rvCloudLog('OneDrive', 'test-write route success', { singlesId, result });
    return res.json(result);
  } catch (err) {
    rvCloudError('OneDrive', 'test-write route failed', err, { singlesId });
    return res.status(400).json({ error: err?.message || 'OneDrive test write failed' });
  }
}

/** GET /api/recordVault/onedrive/emails */
export async function getRecordVaultOneDriveEmails(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    const emails = await loadOneDriveEmailsForPicker(singlesId);
    return res.json({ emails });
  } catch (err) {
    console.error('[getRecordVaultOneDriveEmails]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Unable to load OneDrive emails' });
  }
}

/** POST /api/recordVault/onedrive/emails  Body: { email } */
export async function rememberRecordVaultOneDriveEmail(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    const email = String(req.body?.email || '').trim();
    const result = await rememberOneDriveEmail(singlesId, email);
    return res.json({ success: true, emails: result.emails, added: result.added });
  } catch (err) {
    console.error('[rememberRecordVaultOneDriveEmail]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Unable to save OneDrive email' });
  }
}

/** GET /api/recordVault/onedrive/backup-zip — zip onlinemallwebsitevault and download. */
export async function downloadRecordVaultOneDriveBackupZip(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    await streamOneDriveVaultBackupZip(singlesId, res);
  } catch (err) {
    if (isRecordVaultCloudColumnMissingError(err)) {
      const once = logRecordVaultCloudSchemaMissingOnce('OneDrive', err);
      if (once) rvCloudWarn('OneDrive', 'cloud schema missing — run addSinglesRecordVaultCloud.sql on Primary', once);
      const mapped = recordVaultCloudSchemaErrorResponse('OneDrive', err);
      if (!res.headersSent) return res.status(mapped.status).json(mapped.body);
      return;
    }
    console.error('[downloadRecordVaultOneDriveBackupZip]', err?.message || err);
    if (!res.headersSent) {
      return res.status(400).json({ error: err?.message || 'Unable to create OneDrive backup zip' });
    }
  }
}

/** POST /api/recordVault/onedrive/restore-zip — multipart field backup (.zip). */
export async function restoreRecordVaultOneDriveBackupZip(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  let upload = null;
  try {
    upload = await parseOneDriveBackupZipUpload(req);
    const result = await restoreOneDriveVaultFromZipFile(singlesId, upload.zipPath);
    if (getVaultSession(singlesId, 'onedrive')) {
      await discardVaultSessionWithoutCloudSync(singlesId, 'onedrive');
    }
    cleanupOneDriveStaging(singlesId);
    return res.json({ success: true, ...result, requiresReunlock: true });
  } catch (err) {
    if (isRecordVaultCloudColumnMissingError(err)) {
      const once = logRecordVaultCloudSchemaMissingOnce('OneDrive', err);
      if (once) rvCloudWarn('OneDrive', 'cloud schema missing — run addSinglesRecordVaultCloud.sql on Primary', once);
      const mapped = recordVaultCloudSchemaErrorResponse('OneDrive', err);
      return res.status(mapped.status).json(mapped.body);
    }
    console.error('[restoreRecordVaultOneDriveBackupZip]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Unable to restore OneDrive backup zip' });
  } finally {
    if (upload?.tmpDir) {
      fs.rmSync(upload.tmpDir, { recursive: true, force: true });
    }
  }
}
