/**
 * TutaDrive Cloud for TutaPhotoAlbums — left-panel replacement when LEFT_SIDE=TutaDrive.
 * Vault under ${LARGE_CHEAP_STORAGE_FOLDER}/users/M{member_id}/photoalbums/TutaPhotoAlbums.
 * Reuses the 'onedrive' session slot (workspace pane); no Microsoft sync.
 */

import fs from 'fs';
import path from 'path';
import pool from '../../db/connection.js';
import { getDBSchema } from '../../config/envConfig.js';
import { sharedInviteAttachmentDir } from '../../utils/photoAlbumsSharedSnapshot.js';
import {
  getVaultSession,
  initializeVaultOnUsbWithKey,
  unlockVaultUsbWithKey,
  logoffVaultUsb
} from '../../utils/photoAlbumsUsb/vaultSession.js';
import { PhotoAlbumsUnlockError } from '../../utils/photoAlbumsUsb/unlockGuard.js';
import {
  createEnvVaultKeyMaterial,
  listEnvVaultUnlockKeys
} from '../../utils/photoAlbumsIconKeys.js';
import { isPhotoAlbumsIconEncryptionEnabled } from '../../utils/photoAlbumsIconEncryption.js';
import { requireVaultAccessSession } from '../../utils/photoAlbumsAccessPassword.js';
import { readVaultMeta, validateVaultOnMount } from '../../utils/photoAlbumsUsb/usbScan.js';
import { vaultMetaPath } from '../../utils/photoAlbumsUsb/vaultPaths.js';
import { deletePhotoAlbumsMemberVault } from '../../utils/photoAlbumsUsb/vaultPgStore.js';
import {
  ensureTutaDrivePhotoAlbumsLayout,
  getLeftSideMode,
  isLeftSideTutaDrive,
  loadMemberIdForSingles,
  wipeTutaDrivePhotoAlbumsVault
} from '../../utils/tutaDriveMemberPaths.js';
import { isStoragePermissionError } from '../../utils/storagePermissionError.js';
import { sendRecordVaultError } from '../../utils/recordVaultRouteErrors.js';
import {
  clearVaultOpenProgress,
  getVaultOpenProgress,
  setVaultOpenProgress
} from '../../utils/photoAlbumsVaultOpenProgress.js';
import { parseVaultBackupZipUpload } from '../../utils/parseVaultBackupZipUpload.js';
import { restoreTutaCloudVaultFromZipFile } from '../../utils/photoAlbumsUsb/usbVaultBackup.js';

const TUTADRIVE_ENV_KEY_TYPE = 'tutadrive';

function schemaTable(name) {
  const schema = String(getDBSchema() || 'outdateddbsnapshotoct2024').replace(/"/g, '');
  return `"${schema}"."${name}"`;
}

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
  if (err?.name === 'PhotoAlbumsUnlockError' || err instanceof PhotoAlbumsUnlockError) {
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
  const layout = ensureTutaDrivePhotoAlbumsLayout(memberId, { singlesId });
  return { memberId, ...layout };
}

async function dropStaleCloudSessionIfWrongMount(singlesId, albumsMount) {
  const session = getVaultSession(singlesId, 'onedrive');
  if (!session?.unlocked || !session.mountPath) return;
  const expected = path.resolve(albumsMount);
  const actual = path.resolve(String(session.mountPath));
  if (actual === expected) {
    session.tutaDrive = true;
    session.label = 'TutaDrive';
    return;
  }
  console.warn(
    `[tutaDrive/photoAlbums] clearing stale cloud session mount ${actual} (expected ${expected})`
  );
  await logoffVaultUsb(singlesId, 'onedrive').catch(() => {});
}

function sessionPayload(singlesId, memberId, albumsMount) {
  const session = getVaultSession(singlesId, 'onedrive');
  const expected = path.resolve(albumsMount);
  const actual = session?.mountPath ? path.resolve(String(session.mountPath)) : null;
  const unlocked = Boolean(session?.unlocked && actual === expected);
  return {
    unlocked,
    storageType: 'onedrive',
    tutaDrive: true,
    memberId,
    memberFolder: `M${String(memberId).replace(/^M/i, '')}`,
    mountPath: albumsMount,
    label: 'TutaDrive'
  };
}

/** Album index is in Postgres, so a vault folder needs only vault.meta.json + layout (no vault.db). */
function vaultStatusFlags(albumsMount) {
  const hasMeta = fs.existsSync(vaultMetaPath(albumsMount));
  const check = hasMeta ? validateVaultOnMount(albumsMount, { requireDbFile: false }) : { ok: false };
  return {
    hasVault: Boolean(hasMeta && check.ok),
    needsReformat: Boolean(hasMeta && !check.ok),
    vaultFilesystemInvalid: Boolean(hasMeta && !check.ok)
  };
}

async function resolveTutaDriveKeyMaterial() {
  if (!isPhotoAlbumsIconEncryptionEnabled()) return null;
  return createEnvVaultKeyMaterial(TUTADRIVE_ENV_KEY_TYPE);
}

async function resolveTutaDriveUnlockKey(albumsMount) {
  if (!isPhotoAlbumsIconEncryptionEnabled()) return null;
  const meta = readVaultMeta(albumsMount);
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

/** GET /api/photoAlbums/tutadrive/status */
export async function getPhotoAlbumsTutaDriveStatus(req, res) {
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
    const { memberId, albumsMount, vaultRoot, memberFolder } = await resolveMemberContext(singlesId);
    await dropStaleCloudSessionIfWrongMount(singlesId, albumsMount);
    const flags = vaultStatusFlags(albumsMount);
    return res.json({
      leftSide: 'TutaDrive',
      tutadrive: {
        enabled: true,
        memberId,
        memberFolder: memberFolder || `M${String(memberId).replace(/^M/i, '')}`,
        albumsPath: albumsMount,
        vaultPath: vaultRoot,
        ...flags
      },
      session: sessionPayload(singlesId, memberId, albumsMount)
    });
  } catch (err) {
    console.error('[getPhotoAlbumsTutaDriveStatus]', err?.message || err);
    return sendRecordVaultError(res, err, 'Unable to read TutaDrive status', {
      route: 'getPhotoAlbumsTutaDriveStatus',
      singlesId,
      status: isStoragePermissionError(err) ? 500 : 400
    });
  }
}

/** POST /api/photoAlbums/tutadrive/format */
export async function formatPhotoAlbumsTutaDrive(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  try {
    await logoffVaultUsb(singlesId, 'onedrive').catch(() => {});
    const { memberId } = await resolveMemberContext(singlesId);
    await deletePhotoAlbumsMemberVault(singlesId);
    wipeTutaDrivePhotoAlbumsVault(memberId);
    return res.json({
      success: true,
      memberId,
      memberFolder: `M${String(memberId).replace(/^M/i, '')}`
    });
  } catch (err) {
    console.error('[formatPhotoAlbumsTutaDrive]', err?.message || err);
    return sendRecordVaultError(res, err, 'Unable to format TutaDrive', {
      route: 'formatPhotoAlbumsTutaDrive',
      singlesId,
      status: isStoragePermissionError(err) ? 500 : 400
    });
  }
}

/**
 * POST /api/photoAlbums/tutadrive/reset-album — wipe this member's TutaPhotos on TutaCloud:
 * vault folder (albums, pages, photos), shared-invite snapshots, and the Postgres rows
 * that point at them. USB vault keys and other members' shares are not touched.
 */
export async function resetPhotoAlbumsTutaDrive(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  try {
    const { memberId } = await resolveMemberContext(singlesId);
    await logoffVaultUsb(singlesId, 'onedrive').catch(() => {});

    const client = await pool.connect();
    let inviteIds = [];
    try {
      await client.query('BEGIN');
      const invites = await client.query(
        `DELETE FROM ${schemaTable('photo_albums_invites')}
          WHERE owner_singles_id = $1 AND storage_type = 'onedrive'
          RETURNING invite_id`,
        [singlesId]
      );
      inviteIds = invites.rows.map((row) => Number(row.invite_id)).filter((id) => id > 0);
      const vaultKeys = await client.query(
        `DELETE FROM ${schemaTable('photo_albums_vault')}
          WHERE singles_id = $1 AND storage_backend = 'onedrive'`,
        [singlesId]
      );
      const hasClusterState = await client.query('SELECT to_regclass($1) IS NOT NULL AS ok', [
        schemaTable('vault_cluster_state')
      ]);
      const clusterState = hasClusterState.rows[0]?.ok
        ? await client.query(
            `DELETE FROM ${schemaTable('vault_cluster_state')}
              WHERE product = 'photo_albums' AND singles_id = $1 AND storage_type = 'onedrive'`,
            [singlesId]
          )
        : { rowCount: 0 };
      const albumIndex = await deletePhotoAlbumsMemberVault(singlesId, client);
      await client.query('COMMIT');
      console.log('[resetPhotoAlbumsTutaDrive] db cleared', {
        singlesId,
        invites: inviteIds.length,
        vaultKeys: vaultKeys.rowCount,
        clusterState: clusterState.rowCount,
        albumIndex
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    for (const inviteId of inviteIds) {
      try {
        fs.rmSync(sharedInviteAttachmentDir(inviteId), { recursive: true, force: true });
      } catch (err) {
        console.warn('[resetPhotoAlbumsTutaDrive] snapshot folder not removed', {
          inviteId,
          error: err?.message || String(err)
        });
      }
    }

    wipeTutaDrivePhotoAlbumsVault(memberId);
    return res.json({
      success: true,
      memberId,
      memberFolder: `M${String(memberId).replace(/^M/i, '')}`,
      invitesRemoved: inviteIds.length
    });
  } catch (err) {
    console.error('[resetPhotoAlbumsTutaDrive]', err?.message || err);
    return sendRecordVaultError(res, err, 'Unable to reset TutaPhotos', {
      route: 'resetPhotoAlbumsTutaDrive',
      singlesId,
      status: isStoragePermissionError(err) ? 500 : 400
    });
  }
}

/** POST /api/photoAlbums/tutadrive/init */
export async function initPhotoAlbumsTutaDrive(req, res) {
  const singlesId = await requireVaultAccessSession(req, res);
  if (!singlesId) return;
  try {
    const { memberId, albumsMount } = await resolveMemberContext(singlesId);
    if (fs.existsSync(vaultMetaPath(albumsMount))) {
      return res.status(400).json({ error: 'A TutaDrive vault already exists. Format first to recreate.' });
    }
    const keyMaterial = await resolveTutaDriveKeyMaterial();
    await initializeVaultOnUsbWithKey(albumsMount, keyMaterial?.key ?? null, keyMaterial);
    ensureTutaDrivePhotoAlbumsLayout(memberId, { singlesId });
    return res.json({ success: true, memberId, hasVault: true });
  } catch (err) {
    console.error('[initPhotoAlbumsTutaDrive]', err?.message || err);
    return sendRecordVaultError(res, err, 'Unable to initialize TutaDrive vault', {
      route: 'initPhotoAlbumsTutaDrive',
      singlesId,
      status: isStoragePermissionError(err) ? 500 : 400
    });
  }
}

/** GET /api/photoAlbums/tutadrive/open-progress — poll 0–100% during TutaDrive open */
export async function getPhotoAlbumsTutaDriveOpenProgress(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  try {
    const progress = await getVaultOpenProgress(singlesId);
    return res.json(progress);
  } catch (err) {
    console.error('[getPhotoAlbumsTutaDriveOpenProgress]', err?.message || err);
    return res.json({ percent: 0, label: '' });
  }
}

/** POST /api/photoAlbums/tutadrive/unlock */
export async function unlockPhotoAlbumsTutaDrive(req, res) {
  const singlesId = await requireVaultAccessSession(req, res);
  if (!singlesId) return;
  try {
    await setVaultOpenProgress(singlesId, { percent: 0, label: 'Opening TutaPhotos on TutaCloud' });
    const { memberId, albumsMount } = await resolveMemberContext(singlesId);
    await setVaultOpenProgress(singlesId, { percent: 12, label: 'Checking member folder' });
    await dropStaleCloudSessionIfWrongMount(singlesId, albumsMount);
    let flags = vaultStatusFlags(albumsMount);

    if (!flags.hasVault) {
      await setVaultOpenProgress(singlesId, { percent: 28, label: 'Creating new album vault' });
      const keyMaterial = await resolveTutaDriveKeyMaterial();
      if (!fs.existsSync(vaultMetaPath(albumsMount))) {
        await initializeVaultOnUsbWithKey(albumsMount, keyMaterial?.key ?? null, keyMaterial);
        ensureTutaDrivePhotoAlbumsLayout(memberId, { singlesId });
      }
      flags = vaultStatusFlags(albumsMount);
    }

    await setVaultOpenProgress(singlesId, { percent: 55, label: 'Reading vault database' });
    const key = await resolveTutaDriveUnlockKey(albumsMount);
    await setVaultOpenProgress(singlesId, { percent: 78, label: 'Loading sample albums' });
    await unlockVaultUsbWithKey(singlesId, albumsMount, key, {
      storageType: 'onedrive',
      skipBackup: true
    });
    tagSessionAsTutaDrive(singlesId);
    await setVaultOpenProgress(singlesId, { percent: 100, label: 'Done' });

    return res.json({
      success: true,
      tutaDrive: true,
      session: sessionPayload(singlesId, memberId, albumsMount),
      ...flags
    });
  } catch (err) {
    try {
      await clearVaultOpenProgress(singlesId);
    } catch {
      // ignore
    }
    if (isStoragePermissionError(err)) {
      return sendRecordVaultError(res, err, 'Folder permission error. Please contact your admin', {
        route: 'unlockPhotoAlbumsTutaDrive',
        singlesId
      });
    }
    const mapped = unlockErrorResponse(err);
    if (mapped.status >= 500) console.error('[unlockPhotoAlbumsTutaDrive]', err);
    return res.status(mapped.status).json(mapped.body);
  } finally {
    setTimeout(() => {
      void clearVaultOpenProgress(singlesId);
    }, 3000);
  }
}

/** POST /api/photoAlbums/tutadrive/restore-zip — multipart field backup (.zip) onto unlocked TutaCloud vault. */
export async function restorePhotoAlbumsTutaDriveBackupZip(req, res) {
  const singlesId = await requireVaultAccessSession(req, res);
  if (!singlesId) return;

  let upload = null;
  try {
    upload = await parseVaultBackupZipUpload(req);
    const result = await restoreTutaCloudVaultFromZipFile(singlesId, upload.zipPath);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[restorePhotoAlbumsTutaDriveBackupZip]', err?.message || err);
    const message = err?.message || 'Unable to restore TutaCloud backup zip';
    const status = /not unlocked/i.test(message) ? 428 : 400;
    return res.status(status).json({ error: message });
  } finally {
    if (upload?.tmpDir) {
      fs.rmSync(upload.tmpDir, { recursive: true, force: true });
    }
  }
}

/** POST /api/photoAlbums/tutadrive/logoff */
export async function logoffPhotoAlbumsTutaDrive(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  try {
    await logoffVaultUsb(singlesId, 'onedrive');
    return res.json({ success: true });
  } catch (err) {
    console.error('[logoffPhotoAlbumsTutaDrive]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Logoff failed' });
  }
}
