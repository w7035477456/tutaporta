import { browseMountPath, listMountLocations, readVaultMeta, resolveVolumeRootMountPath, scanForRecordVaultUsb } from '../../utils/recordVaultUsb/usbScan.js';
import { requireVaultAccessSession } from '../../utils/recordVaultAccessPassword.js';
import {
  createEnvVaultKeyMaterial,
  getRecordVaultEnvEncryptionKey,
  listEnvVaultUnlockKeys
} from '../../utils/recordVaultIconKeys.js';
import {
  getVaultSession,
  initializeVaultOnUsbWithKey,
  logoffVaultUsb,
  unlockVaultUsbWithKey,
  vaultUsbStatus,
  wipeVaultAtMountPath,
  listUsbVaultFolderListing
} from '../../utils/recordVaultUsb/vaultSession.js';
import { RecordVaultUnlockError, getUnlockGuardStatus } from '../../utils/recordVaultUsb/unlockGuard.js';
import { clearRecordVaultCacheIcon, readRecordVaultCacheIcon } from '../../utils/recordVaultCacheIcon.js';
import { isVaultBackupUsbEnabled } from '../../utils/recordVaultStorageFlags.js';
import fs from 'fs';
import { streamUsbVaultBackupZip, restoreUsbVaultFromZipFile } from '../../utils/recordVaultUsb/usbVaultBackup.js';
import { parseOneDriveBackupZipUpload } from '../../utils/recordVaultOneDrive/parseOneDriveBackupZipUpload.js';
import {
  clearVaultLogoffProgress,
  setVaultLogoffProgress
} from '../../utils/recordVaultOneDrive/vaultLogoffProgress.js';

function requireSinglesId(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return singlesId;
}

function resolveOptionalBackupMountPath(req) {
  if (!isVaultBackupUsbEnabled()) return null;
  const backupRaw = String(req.body?.backupMountPath ?? req.body?.backup_mount_path ?? '').trim();
  return backupRaw ? normalizeMountPath(backupRaw) : null;
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
    body: { error: err?.message || 'Unable to unlock vault USB' }
  };
}

/** GET /api/recordVault/usb/unlock-guard?mountPath= */
export async function getRecordVaultUsbUnlockGuard(req, res) {
  if (!(await requireVaultAccessSession(req, res))) return;

  const mountPath = String(req.query?.mountPath ?? req.query?.mount_path ?? '').trim();
  if (!mountPath) {
    return res.status(400).json({ error: 'mountPath is required' });
  }
  try {
    const status = getUnlockGuardStatus(mountPath);
    if (!status.ok) {
      return res.status(400).json({ error: status.error || 'Unable to read unlock guard' });
    }
    return res.json(status);
  } catch (err) {
    console.error('[getRecordVaultUsbUnlockGuard]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Unable to read unlock guard' });
  }
}

/** GET /api/recordVault/usb/icons — display names only (no encryption keys) */
export async function listRecordVaultUsbIcons(req, res) {
  if (!(await requireVaultAccessSession(req, res))) return;

  try {
    return res.json({ icons: listRecordVaultIconCatalog() });
  } catch (err) {
    console.error('[listRecordVaultUsbIcons]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Unable to list icons' });
  }
}

/** GET /api/recordVault/usb/locations — all mounted volumes (Finder sidebar style) */
export async function listRecordVaultUsbLocations(req, res) {
  if (!(await requireVaultAccessSession(req, res))) return;

  try {
    const locations = listMountLocations();
    return res.json({ locations });
  } catch (err) {
    console.error('[listRecordVaultUsbLocations]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Unable to list volumes' });
  }
}

/** Local bridge: list drives on this computer (127.0.0.1 only, no server session). */
export async function listRecordVaultUsbLocationsLocal(_req, res) {
  try {
    const locations = listMountLocations();
    return res.json({ locations, localBridge: true });
  } catch (err) {
    console.error('[listRecordVaultUsbLocationsLocal]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Unable to list volumes' });
  }
}

/** Local bridge: unlock guard for a mount on this computer. */
export async function getRecordVaultUsbUnlockGuardLocal(req, res) {
  const mountPath = String(req.query?.mountPath ?? req.query?.mount_path ?? '').trim();
  if (!mountPath) {
    return res.status(400).json({ error: 'mountPath is required' });
  }
  try {
    const status = getUnlockGuardStatus(mountPath);
    if (!status.ok) {
      return res.status(400).json({ error: status.error || 'Unable to read unlock guard' });
    }
    return res.json(status);
  } catch (err) {
    console.error('[getRecordVaultUsbUnlockGuardLocal]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Unable to read unlock guard' });
  }
}

/** GET /api/recordVault/usb/browse?path= */
export async function browseRecordVaultUsbPath(req, res) {
  if (!(await requireVaultAccessSession(req, res))) return;

  const rawPath = String(req.query?.path ?? '').trim();
  try {
    const result = browseMountPath(rawPath);
    if (!result.ok) {
      return res.status(400).json({ error: result.error || 'Unable to browse path' });
    }
    return res.json(result);
  } catch (err) {
    console.error('[browseRecordVaultUsbPath]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Browse failed' });
  }
}

/** GET /api/recordVault/usb/vault-tree — nested listing of unlocked USB .recordvault folder */
export async function getRecordVaultUsbVaultTree(req, res) {
  const singlesId = await requireVaultAccessSession(req, res);
  if (!singlesId) return;

  try {
    const listing = listUsbVaultFolderListing(singlesId);
    if (!listing) {
      return res.status(428).json({
        error: 'Record Vault USB not unlocked',
        code: 'RECORD_VAULT_USB_REQUIRED'
      });
    }
    return res.json(listing);
  } catch (err) {
    console.error('[getRecordVaultUsbVaultTree]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Unable to list USB vault folder' });
  }
}

/** GET /api/recordVault/usb/backup-zip — zip unlocked USB .recordvault and download. */
export async function downloadRecordVaultUsbBackupZip(req, res) {
  const singlesId = await requireVaultAccessSession(req, res);
  if (!singlesId) return;

  try {
    await streamUsbVaultBackupZip(singlesId, res);
  } catch (err) {
    console.error('[downloadRecordVaultUsbBackupZip]', err?.message || err);
    if (!res.headersSent) {
      const message = err?.message || 'Unable to create USB backup zip';
      const status = /not unlocked/i.test(message) ? 428 : 400;
      return res.status(status).json({
        error: message,
        ...(status === 428 ? { code: 'RECORD_VAULT_USB_REQUIRED' } : null)
      });
    }
  }
}

/** POST /api/recordVault/usb/restore-zip — multipart field backup (.zip) onto unlocked USB. */
export async function restoreRecordVaultUsbBackupZip(req, res) {
  const singlesId = await requireVaultAccessSession(req, res);
  if (!singlesId) return;

  let upload = null;
  try {
    upload = await parseOneDriveBackupZipUpload(req);
    const result = await restoreUsbVaultFromZipFile(singlesId, upload.zipPath);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[restoreRecordVaultUsbBackupZip]', err?.message || err);
    const message = err?.message || 'Unable to restore USB backup zip';
    const status = /not unlocked/i.test(message) ? 428 : 400;
    return res.status(status).json({
      error: message,
      ...(status === 428 ? { code: 'RECORD_VAULT_USB_REQUIRED' } : null)
    });
  } finally {
    if (upload?.tmpDir) {
      fs.rmSync(upload.tmpDir, { recursive: true, force: true });
    }
  }
}

/** GET /api/recordVault/usb/scan */
export async function scanRecordVaultUsb(req, res) {
  const singlesId = await requireVaultAccessSession(req, res);
  if (!singlesId) return;

  try {
    const detected = scanForRecordVaultUsb();
    const status = await vaultUsbStatus(singlesId);
    return res.json({
      detected,
      session: status
    });
  } catch (err) {
    console.error('[scanRecordVaultUsb]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'USB scan failed' });
  }
}

/** GET /api/recordVault/usb/status */
export async function getRecordVaultUsbStatus(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  let cacheUsbIcon = null;
  try {
    cacheUsbIcon = await readRecordVaultCacheIcon(singlesId, 'usb');
  } catch {
    cacheUsbIcon = null;
  }
  return res.json({
    usbMode: true,
    cacheUsbIcon,
    session: await vaultUsbStatus(singlesId, 'usb')
  });
}

function normalizeMountPath(raw) {
  const mountPath = String(raw ?? '').trim();
  if (!mountPath) {
    throw new Error('mountPath is required');
  }
  const match = resolveVolumeRootMountPath(mountPath);
  return match.mountPath;
}

/** POST /api/recordVault/usb/format  Body: { mountPath? } — wipe .recordvault on a USB root */
export async function formatRecordVaultUsb(req, res) {
  const singlesId = await requireVaultAccessSession(req, res);
  if (!singlesId) return;

  try {
    const session = getVaultSession(singlesId, 'usb');
    const rawMount = req.body?.mountPath ?? req.body?.mount_path;
    let mountPath;
    if (rawMount != null && String(rawMount).trim()) {
      mountPath = normalizeMountPath(rawMount);
    } else if (session?.mountPath) {
      mountPath = session.mountPath;
    } else {
      throw new Error('mountPath is required');
    }

    // Format while unlocked (Backup & Restore dialog): close session so wipe is allowed.
    if (session && (session.mountPath === mountPath || session.backupMountPath === mountPath)) {
      await logoffVaultUsb(singlesId, 'usb');
    }

    const result = wipeVaultAtMountPath(mountPath, singlesId);
    // Fresh vault setup — clear remembered icon so picker does not preselect the old one.
    await clearRecordVaultCacheIcon(singlesId, 'usb');
    const refreshed = resolveVolumeRootMountPath(mountPath);
    return res.json({
      success: true,
      wiped: result.wiped,
      mountPath: refreshed.mountPath,
      label: refreshed.label,
      hasVault: false,
      legacyPinVault: false,
      cacheUsbIcon: '',
      requiresReunlock: true
    });
  } catch (err) {
    console.error('[formatRecordVaultUsb]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Unable to format USB vault' });
  }
}

/** POST /api/recordVault/usb/icon-derived-key — for local bridge unlock (authenticated)
 * Body: { forInit?, kdfSalt? }
 *  - forInit:true → new Argon2id salt + key (format/create vault)
 *  - kdfSalt → Argon2id derive for existing vault
 *  - neither → legacy SHA-256 (migrate on next unlock)
 */
export async function getRecordVaultUsbIconDerivedKey(req, res) {
  const singlesId = await requireVaultAccessSession(req, res);
  if (!singlesId) return;

  try {
    const forInit = Boolean(req.body?.forInit ?? req.body?.for_init);
    const kdfSalt = String(req.body?.kdfSalt ?? req.body?.kdf_salt ?? '').trim();

    if (forInit) {
      const material = await createEnvVaultKeyMaterial('usb');
      return res.json({
        keyB64: material.key.toString('base64'),
        kdf: material.kdf,
        kdfSalt: material.kdfSalt,
        kdfMemory: material.kdfMemory,
        kdfIterations: material.kdfIterations,
        kdfParallelism: material.kdfParallelism
      });
    }

    if (kdfSalt) {
      const key = await getRecordVaultEnvEncryptionKey('usb', { kdf: 'argon2id', salt: kdfSalt });
      return res.json({ keyB64: key.toString('base64'), kdf: 'argon2id', kdfSalt });
    }

    const key = await getRecordVaultEnvEncryptionKey('usb', { kdf: 'sha256' });
    return res.json({ keyB64: key.toString('base64'), kdf: 'sha256' });
  } catch (err) {
    console.error('[getRecordVaultUsbIconDerivedKey]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Unable to derive vault key' });
  }
}

/** POST /api/recordVault/usb/unlock-bridge  Body: { mountPath, keyB64, backupMountPath? } */
export async function unlockRecordVaultUsbBridge(req, res) {
  const singlesId = await requireVaultAccessSession(req, res);
  if (!singlesId) return;

  const keyB64 = String(req.body?.keyB64 ?? req.body?.key_b64 ?? '').trim();
  if (!keyB64) {
    return res.status(400).json({ error: 'keyB64 is required' });
  }
  let key;
  try {
    key = Buffer.from(keyB64, 'base64');
    if (key.length !== 32) {
      return res.status(400).json({ error: 'Invalid vault key' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid vault key' });
  }

  try {
    const mountPath = normalizeMountPath(req.body?.mountPath ?? req.body?.mount_path);
    const backupMountPath = resolveOptionalBackupMountPath(req);
    const session = await unlockVaultUsbWithKey(singlesId, mountPath, key, {
      backupMountPath
    });
    return res.json({ success: true, session });
  } catch (err) {
    console.error('[unlockRecordVaultUsbBridge]', err?.message || err);
    const { status, body } = unlockErrorResponse(err);
    return res.status(status).json(body);
  }
}

/** POST /api/recordVault/usb/init-bridge  Body: { mountPath, keyB64, kdfSalt?, backupMountPath? } */
export async function initRecordVaultUsbBridge(req, res) {
  const singlesId = await requireVaultAccessSession(req, res);
  if (!singlesId) return;

  const keyB64 = String(req.body?.keyB64 ?? req.body?.key_b64 ?? '').trim();
  if (!keyB64) {
    return res.status(400).json({ error: 'keyB64 is required' });
  }
  let key;
  try {
    key = Buffer.from(keyB64, 'base64');
    if (key.length !== 32) {
      return res.status(400).json({ error: 'Invalid vault key' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid vault key' });
  }

  try {
    const mountPath = normalizeMountPath(req.body?.mountPath ?? req.body?.mount_path);
    const backupMountPath = resolveOptionalBackupMountPath(req);
    const kdfSalt = String(req.body?.kdfSalt ?? req.body?.kdf_salt ?? '').trim();
    const kdfMaterial = kdfSalt
      ? {
          kdf: String(req.body?.kdf || 'argon2id').trim() || 'argon2id',
          kdfSalt,
          kdfMemory: req.body?.kdfMemory ?? req.body?.kdf_memory,
          kdfIterations: req.body?.kdfIterations ?? req.body?.kdf_iterations,
          kdfParallelism: req.body?.kdfParallelism ?? req.body?.kdf_parallelism
        }
      : null;
    const meta = await initializeVaultOnUsbWithKey(mountPath, key, kdfMaterial);
    const session = await unlockVaultUsbWithKey(singlesId, mountPath, key, {
      backupMountPath
    });
    return res.json({ success: true, meta: { vaultId: meta.vaultId, createdAt: meta.createdAt }, session });
  } catch (err) {
    console.error('[initRecordVaultUsbBridge]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Unable to initialize vault USB' });
  }
}

/** POST /api/recordVault/usb/unlock  Body: { mountPath, backupMountPath? } */
export async function unlockRecordVaultUsb(req, res) {
  const singlesId = await requireVaultAccessSession(req, res);
  if (!singlesId) return;

  try {
    const mountPath = normalizeMountPath(req.body?.mountPath ?? req.body?.mount_path);
    const backupMountPath = resolveOptionalBackupMountPath(req);
    const keys = await listEnvVaultUnlockKeys('usb', readVaultMeta(mountPath));
    const session = await unlockVaultUsbWithKey(singlesId, mountPath, keys[0]?.key ?? null, {
      backupMountPath,
      unlockKdf: keys[0]?.kdf || null
    });
    return res.json({ success: true, session });
  } catch (err) {
    console.error('[unlockRecordVaultUsb]', err?.message || err);
    const { status, body } = unlockErrorResponse(err);
    return res.status(status).json(body);
  }
}

/** POST /api/recordVault/usb/logoff */
export async function logoffRecordVaultUsb(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    await setVaultLogoffProgress(singlesId, { percent: 0, label: 'Logging off USB' });
    const result = await logoffVaultUsb(singlesId, 'usb', {
      onProgress: async ({ percent, label }) => {
        await setVaultLogoffProgress(singlesId, { percent, label });
      }
    });
    // Drop remembered USB icon so the bottom pane returns to login / icon decrypt.
    await clearRecordVaultCacheIcon(singlesId, 'usb');
    await setVaultLogoffProgress(singlesId, { percent: 100, label: 'Done' });
    setTimeout(() => {
      void clearVaultLogoffProgress(singlesId);
    }, 2000);
    return res.json({ ...result, cacheUsbIcon: '' });
  } catch (err) {
    console.error('[logoffRecordVaultUsb]', err?.message || err);
    try {
      await clearVaultLogoffProgress(singlesId);
    } catch {
      // ignore
    }
    return res.status(500).json({ error: err?.message || 'Logoff failed' });
  }
}

/** POST /api/recordVault/usb/init  Body: { mountPath, backupMountPath? } — first-time USB setup */
export async function initRecordVaultUsb(req, res) {
  const singlesId = await requireVaultAccessSession(req, res);
  if (!singlesId) return;

  try {
    const mountPath = normalizeMountPath(req.body?.mountPath ?? req.body?.mount_path);
    const backupMountPath = resolveOptionalBackupMountPath(req);
    const material = await createEnvVaultKeyMaterial('usb');
    const meta = await initializeVaultOnUsbWithKey(mountPath, material.key, material);
    const session = await unlockVaultUsbWithKey(singlesId, mountPath, material.key, { backupMountPath });
    return res.json({ success: true, meta: { vaultId: meta.vaultId, createdAt: meta.createdAt }, session });
  } catch (err) {
    console.error('[initRecordVaultUsb]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Unable to initialize vault USB' });
  }
}

export function recordVaultRequiresUsbSession(req, res) {
  const session = getVaultSession(Number(req.auth?.singles_id));
  if (session) return session;
  res.status(428).json({
    error: 'Record Vault USB not unlocked',
    code: 'RECORD_VAULT_USB_REQUIRED'
  });
  return false;
}
