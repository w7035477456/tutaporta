import { requireVaultAccessSession } from '../../utils/photoAlbumsAccessPassword.js';
import fs from 'fs';
import {
  createEnvVaultKeyMaterial,
  listEnvVaultUnlockKeys
} from '../../utils/photoAlbumsIconKeys.js';
import {
  getVaultSession,
  initializeVaultOnUsbWithKey,
  logoffVaultUsb,
  flushAndAwaitCloudSync,
  discardVaultSessionWithoutCloudSync,
  unlockVaultUsbWithKey,
  vaultUsbStatus
} from '../../utils/photoAlbumsUsb/vaultSession.js';
import { PhotoAlbumsUnlockError } from '../../utils/photoAlbumsUsb/unlockGuard.js';
import { clearOneDriveConnection } from '../../utils/photoAlbumsOneDrive/oneDriveTokenStore.js';
import { clearAllOneDriveDirty } from '../../utils/photoAlbumsOneDrive/oneDriveVaultDirty.js';
import { registerVaultClusterUnlock } from '../../utils/photoAlbumsClusterSession.js';
import { snapshotVaultSessionFileCountsToLast } from '../../utils/photoAlbumsSessionFileCounts.js';
import { readVaultMeta } from '../../utils/photoAlbumsUsb/usbScan.js';
import {
  loadOneDriveEmailsForPicker,
  rememberOneDriveEmail
} from '../../utils/photoAlbumsOneDrive/oneDriveEmailHistory.js';
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
} from '../../utils/photoAlbumsOneDrive/oneDriveVaultSync.js';
import { isOneDriveVaultOAuthConfigured } from './photoAlbumsOneDriveOAuth.js';
import { getOneDriveVaultFolderName } from '../../utils/photoAlbumsOneDrive/oneDriveApi.js';
import {
  buildVaultStorageChoice,
  isVaultOneDriveOffered
} from '../../utils/photoAlbumsStorageFlags.js';
import {
  isPhotoAlbumsIconEncryptionEnabled
} from '../../utils/photoAlbumsIconEncryption.js';
import {
  isPhotoAlbumsCloudColumnMissingError,
  logPhotoAlbumsCloudSchemaMissingOnce,
  photoAlbumsCloudSchemaErrorResponse
} from '../../utils/photoAlbumsCloudSchema.js';
import { rvCloudError, rvCloudLog, rvCloudWarn } from '../../utils/photoAlbumsCloudDebugLog.js';
import {
  restoreOneDriveVaultFromZipFile,
  streamOneDriveVaultBackupZip
} from '../../utils/photoAlbumsOneDrive/oneDriveVaultBackup.js';
import { parseOneDriveBackupZipUpload } from '../../utils/photoAlbumsOneDrive/parseOneDriveBackupZipUpload.js';
import { readPhotoAlbumsCacheIcon, clearPhotoAlbumsCacheIcon } from '../../utils/photoAlbumsCacheIcon.js';
import {
  clearVaultLogoffProgress,
  getVaultLogoffProgress,
  setVaultLogoffProgress
} from '../../utils/photoAlbumsOneDrive/vaultLogoffProgress.js';
import {
  clearVaultOpenProgress,
  getVaultOpenProgress,
  setVaultOpenProgress
} from '../../utils/photoAlbumsOneDrive/vaultOpenProgress.js';
import {
  getVaultSyncProgress,
  setVaultSyncProgress
} from '../../utils/photoAlbumsOneDrive/vaultSyncProgress.js';

function requireSinglesId(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return singlesId;
}

function unlockErrorResponse(err) {
  if (err instanceof PhotoAlbumsUnlockError) {
    return {
      status: err.vaultWiped ? 410 : err.code === 'PHOTO_ALBUMS_USB_UNLOCK_LOCKED' ? 423 : 400,
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
  if (!isPhotoAlbumsIconEncryptionEnabled()) {
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
  if (isPhotoAlbumsIconEncryptionEnabled()) {
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

/** GET /api/photoAlbums/onedrive/config */
export function getPhotoAlbumsOneDriveConfig(req, res) {
  const choice = buildVaultStorageChoice(isVaultOneDriveOffered(), isOneDriveVaultOAuthConfigured());
  return res.json({
    ...choice,
    enabled: choice.enabled,
    iconEncryptionRequired: isPhotoAlbumsIconEncryptionEnabled(),
    folderName: getOneDriveVaultFolderName()
  });
}

/** GET /api/photoAlbums/onedrive/status */
export async function getPhotoAlbumsOneDriveStatus(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    const cacheIcon = await readPhotoAlbumsCacheIcon(singlesId, 'onedrive');
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
    if (isPhotoAlbumsCloudColumnMissingError(err)) {
      const once = logPhotoAlbumsCloudSchemaMissingOnce('OneDrive', err);
      if (once) rvCloudWarn('OneDrive', 'cloud schema missing — run addSinglesPhotoAlbumsCloud.sql on Primary', once);
      const mapped = photoAlbumsCloudSchemaErrorResponse('OneDrive', err);
      return res.status(mapped.status).json(mapped.body);
    }
    console.error('[getPhotoAlbumsOneDriveStatus]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Unable to read OneDrive status' });
  }
}

/** POST /api/photoAlbums/onedrive/disconnect */
export async function disconnectPhotoAlbumsOneDrive(req, res) {
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
    console.error('[disconnectPhotoAlbumsOneDrive]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Unable to disconnect OneDrive' });
  }
}

/** GET /api/photoAlbums/onedrive/unlock-guard */
export async function getPhotoAlbumsOneDriveUnlockGuard(req, res) {
  if (!(await requireVaultAccessSession(req, res))) return;

  const singlesId = Number(req.auth?.singles_id);
  try {
    const status = await getOneDriveUnlockGuardStatus(singlesId);
    if (!status.ok) {
      return res.status(400).json({ error: status.error || 'Unable to read unlock guard' });
    }
    return res.json(status);
  } catch (err) {
    console.error('[getPhotoAlbumsOneDriveUnlockGuard]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Unable to read unlock guard' });
  }
}

/** POST /api/photoAlbums/onedrive/init */
export async function initPhotoAlbumsOneDrive(req, res) {
  const singlesId = await requireVaultAccessSession(req, res);
  if (!singlesId) return;

  try {
    const oneDriveStatus = await probeOneDriveVaultStatus(singlesId);
    if (!oneDriveStatus.connected) {
      return res.status(400).json({ error: 'Connect OneDrive first' });
    }
    if (oneDriveStatus.hasVault) {
      if (oneDriveStatus.needsReformat && isPhotoAlbumsIconEncryptionEnabled()) {
        return res.status(400).json({ error: ONEDRIVE_VAULT_REFORMAT_MESSAGE, needsReformat: true });
      }
      if (!isPhotoAlbumsIconEncryptionEnabled()) {
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
    console.error('[initPhotoAlbumsOneDrive]', err?.message || err);
    const msg = String(err?.message || '');
    if (/not be found|itemnotfound|resource could not be found/i.test(msg)) {
      return res.status(400).json({
        error:
          'OneDrive vault folder was missing (stale link after Format). Click Format MyVault folder, then Login OneDrive for MyPhotoAlbums again.',
        needsReformat: true
      });
    }
    return res.status(400).json({ error: err?.message || 'Unable to create OneDrive vault' });
  }
}

/** GET /api/photoAlbums/onedrive/open-progress — poll honest 0–100% during Cloud open */
export async function getPhotoAlbumsOneDriveOpenProgress(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  try {
    const progress = await getVaultOpenProgress(singlesId);
    return res.json(progress);
  } catch (err) {
    console.error('[getPhotoAlbumsOneDriveOpenProgress]', err?.message || err);
    return res.json({ percent: 0, label: '' });
  }
}

/** POST /api/photoAlbums/onedrive/unlock */
export async function unlockPhotoAlbumsOneDrive(req, res) {
  const singlesId = await requireVaultAccessSession(req, res);
  if (!singlesId) return;

  try {
    await setVaultOpenProgress(singlesId, { percent: 0, label: 'Opening TutaPhotoAlbums Cloud' });
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
    if (!skipStagingUpload && err instanceof PhotoAlbumsUnlockError && !mapped.body?.vaultWiped) {
      try {
        const stagingPath = stagingMountPath(singlesId);
        await uploadOneDriveVaultMetaOnly(singlesId, stagingPath);
      } catch (syncErr) {
        console.error('[unlockPhotoAlbumsOneDrive] unlock-guard meta sync failed:', syncErr?.message || syncErr);
      }
    }
    if (mapped.body?.vaultWiped) {
      try {
        await wipeOneDriveVaultFolder(singlesId);
        cleanupOneDriveStaging(singlesId);
      } catch (wipeErr) {
        console.error('[unlockPhotoAlbumsOneDrive] wipe failed:', wipeErr?.message || wipeErr);
      }
    }
    console.error('[unlockPhotoAlbumsOneDrive]', err?.message || err);
    if (/vault\.meta\.json/i.test(String(mapped.body?.error || '')) && isPhotoAlbumsIconEncryptionEnabled()) {
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

/** GET /api/photoAlbums/onedrive/logoff-progress — poll honest 0–100% during Cloud logoff */
export async function getPhotoAlbumsOneDriveLogoffProgress(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  try {
    const progress = await getVaultLogoffProgress(singlesId);
    return res.json(progress);
  } catch (err) {
    console.error('[getPhotoAlbumsOneDriveLogoffProgress]', err?.message || err);
    return res.json({ percent: 0, label: '' });
  }
}

/** POST /api/photoAlbums/onedrive/logoff */
export async function logoffPhotoAlbumsOneDrive(req, res) {
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
    await clearPhotoAlbumsCacheIcon(singlesId, 'onedrive');
    await setVaultLogoffProgress(singlesId, { percent: 100, label: 'Done' });
    return res.json({ success: true, cacheOneDriveIcon: '' });
  } catch (err) {
    console.error('[logoffPhotoAlbumsOneDrive]', err?.message || err);
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
 * POST /api/photoAlbums/onedrive/sync
 * Await OneDrive vault.db upload without logging off (used after PIN encrypt).
 */
export async function syncPhotoAlbumsOneDrive(req, res) {
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
    console.error('[syncPhotoAlbumsOneDrive]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Cloud sync failed' });
  }
}

/** GET /api/photoAlbums/onedrive/sync-progress — poll honest 0–100% during mid-session Cloud sync */
export async function getPhotoAlbumsOneDriveSyncProgress(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  try {
    const progress = await getVaultSyncProgress(singlesId);
    return res.json(progress);
  } catch (err) {
    console.error('[getPhotoAlbumsOneDriveSyncProgress]', err?.message || err);
    return res.json({ percent: 0, label: '' });
  }
}

/** POST /api/photoAlbums/onedrive/format */
export async function formatPhotoAlbumsOneDrive(req, res) {
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
      if (isPhotoAlbumsIconEncryptionEnabled()) {
        vaultKeyMaterial = await createEnvVaultKeyMaterial('onedrive');
      }
      await formatEmptyOneDriveVaultFolderIfNeeded(singlesId, accessToken, newFolderId, vaultKeyMaterial);
    } catch (layoutErr) {
      console.error('[formatPhotoAlbumsOneDrive] layout init failed:', layoutErr?.message || layoutErr);
    }
    return res.json({
      success: true,
      hasVault: false,
      needsReformat: false,
      folderId: newFolderId
    });
  } catch (err) {
    console.error('[formatPhotoAlbumsOneDrive]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Unable to format OneDrive vault' });
  }
}

/** GET /api/photoAlbums/onedrive/vault-tree — read-only OneDrive folder tree (any cluster node). */
export async function getPhotoAlbumsOneDriveVaultTree(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    const result = await listOneDriveVaultTree(singlesId);
    return res.json(result);
  } catch (err) {
    if (isPhotoAlbumsCloudColumnMissingError(err)) {
      const once = logPhotoAlbumsCloudSchemaMissingOnce('OneDrive', err);
      if (once) rvCloudWarn('OneDrive', 'cloud schema missing — run addSinglesPhotoAlbumsCloud.sql on Primary', once);
      const mapped = photoAlbumsCloudSchemaErrorResponse('OneDrive', err);
      return res.status(mapped.status).json(mapped.body);
    }
    console.error('[getPhotoAlbumsOneDriveVaultTree]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Unable to list OneDrive vault folder' });
  }
}

/** POST /api/photoAlbums/onedrive/test-write */
export async function testWritePhotoAlbumsOneDrive(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  rvCloudLog('OneDrive', 'POST /api/photoAlbums/onedrive/test-write', {
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

/** GET /api/photoAlbums/onedrive/emails */
export async function getPhotoAlbumsOneDriveEmails(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    const emails = await loadOneDriveEmailsForPicker(singlesId);
    return res.json({ emails });
  } catch (err) {
    console.error('[getPhotoAlbumsOneDriveEmails]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Unable to load OneDrive emails' });
  }
}

/** POST /api/photoAlbums/onedrive/emails  Body: { email } */
export async function rememberPhotoAlbumsOneDriveEmail(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    const email = String(req.body?.email || '').trim();
    const result = await rememberOneDriveEmail(singlesId, email);
    return res.json({ success: true, emails: result.emails, added: result.added });
  } catch (err) {
    console.error('[rememberPhotoAlbumsOneDriveEmail]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Unable to save OneDrive email' });
  }
}

/** GET /api/photoAlbums/onedrive/backup-zip — zip onlinemallwebsitevault and download. */
export async function downloadPhotoAlbumsOneDriveBackupZip(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    await streamOneDriveVaultBackupZip(singlesId, res);
  } catch (err) {
    if (isPhotoAlbumsCloudColumnMissingError(err)) {
      const once = logPhotoAlbumsCloudSchemaMissingOnce('OneDrive', err);
      if (once) rvCloudWarn('OneDrive', 'cloud schema missing — run addSinglesPhotoAlbumsCloud.sql on Primary', once);
      const mapped = photoAlbumsCloudSchemaErrorResponse('OneDrive', err);
      if (!res.headersSent) return res.status(mapped.status).json(mapped.body);
      return;
    }
    console.error('[downloadPhotoAlbumsOneDriveBackupZip]', err?.message || err);
    if (!res.headersSent) {
      return res.status(400).json({ error: err?.message || 'Unable to create OneDrive backup zip' });
    }
  }
}

/** POST /api/photoAlbums/onedrive/restore-zip — multipart field backup (.zip). */
export async function restorePhotoAlbumsOneDriveBackupZip(req, res) {
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
    if (isPhotoAlbumsCloudColumnMissingError(err)) {
      const once = logPhotoAlbumsCloudSchemaMissingOnce('OneDrive', err);
      if (once) rvCloudWarn('OneDrive', 'cloud schema missing — run addSinglesPhotoAlbumsCloud.sql on Primary', once);
      const mapped = photoAlbumsCloudSchemaErrorResponse('OneDrive', err);
      return res.status(mapped.status).json(mapped.body);
    }
    console.error('[restorePhotoAlbumsOneDriveBackupZip]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Unable to restore OneDrive backup zip' });
  } finally {
    if (upload?.tmpDir) {
      fs.rmSync(upload.tmpDir, { recursive: true, force: true });
    }
  }
}
