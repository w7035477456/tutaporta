/**
 * Full-member backup/restore for TutaNotes, TutaPhotoAlbums, and TutaDates.
 * Server-side archive under ~/tutamallBackup/{emailPrefix}/.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

import {
  ensureTutaDriveMemberLayout,
  ensureTutaDrivePhotoAlbumsLayout,
  loadMemberIdForSingles,
  memberFolderName,
  tutaDriveMemberRoot,
  tutaDriveNotesMountPath,
  tutaDrivePhotoAlbumsMountPath,
  tutaDrivePhotosPath
} from './tutaDriveMemberPaths.js';
import {
  ensureTutaDatesMemberLayout,
  tutaDatesPhotosPath,
  tutaDatesVideosPath
} from './tutaDatesMemberPaths.js';
import { oneDriveStagingMountPath as notesOneDriveStagingMountPath } from './recordVaultOneDriveStagingRoot.js';
import { oneDriveStagingMountPath as photoAlbumsOneDriveStagingMountPath } from './photoAlbumsOneDriveStagingRoot.js';
import { fetchPhotoRowsForSinglesId } from './deletePhotoFromFolder.js';
import { fetchVideoRowsForSinglesId } from './deleteVideoFromFolder.js';
import { listMemberPhotoFilesOnDisk, listPhotoFolderFilesForMemberId } from './photoFilePath.js';
import { resolveVideoFilePath } from './videoFilePath.js';
import { listMobileUploadFiles, getMobileUploadFolder } from './mobileUploadFolder.js';

const SCHEMA = 'helloworldjunktest';
const BACKUP_VERSION = 1;

const NOTES_SINGLES_COLUMNS = [
  'record_notes_onedrive_refresh_token_enc',
  'record_notes_onedrive_folder_id',
  'record_notes_onedrive_email'
];

const PHOTO_SINGLES_COLUMNS = [
  'record_photoalbums_onedrive_refresh_token_enc',
  'record_photoalbums_onedrive_folder_id',
  'record_photoalbums_onedrive_email',
  'record_photoalbums_drive_refresh_token_enc',
  'record_photoalbums_drive_folder_id',
  'record_photoalbums_drive_email',
  'record_photoalbums_dropbox_refresh_token_enc',
  'record_photoalbums_dropbox_folder_path',
  'record_photoalbums_dropbox_email'
];

const TUTADATES_SINGLES_COLUMNS = ['profile_image_fk'];

function expandHome(p) {
  const raw = String(p || '').trim();
  if (!raw) return '';
  return raw.startsWith('~/') ? path.join(os.homedir(), raw.slice(2)) : raw;
}

export function emailPrefixFromAddress(email) {
  const local = String(email || '').trim().split('@')[0];
  if (!local) throw new Error('Invalid email — cannot derive backup folder prefix');
  return local.replace(/[^\w.-]+/g, '_');
}

export function defaultBackupRootForEmail(email) {
  return path.join(os.homedir(), 'tutamallBackup', emailPrefixFromAddress(email));
}

export async function resolveUserByEmail(pool, email) {
  const normalized = String(email || '').trim();
  if (!normalized) throw new Error('Email is required');
  const { rows } = await pool.query(
    `SELECT singles_id, member_id, email::text AS email
       FROM ${SCHEMA}.singles
      WHERE lower(email::text) = lower($1::text)
      LIMIT 1`,
    [normalized]
  );
  const row = rows[0];
  if (!row?.singles_id) throw new Error(`No singles row found for email ${normalized}`);
  const singlesId = Number(row.singles_id);
  const memberId = row.member_id != null ? String(row.member_id).trim() : null;
  if (!memberId) throw new Error(`Member number not set for ${normalized}`);
  return {
    singlesId,
    memberId,
    email: String(row.email || normalized).trim(),
    memberFolder: memberFolderName(memberId)
  };
}

async function tableExists(pool, tableName) {
  const { rows } = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = $2
     ) AS ok`,
    [SCHEMA, tableName]
  );
  return rows[0]?.ok === true;
}

function serializeRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (Buffer.isBuffer(value)) out[key] = { __bytea: value.toString('base64') };
    else if (value instanceof Date) out[key] = value.toISOString();
    else out[key] = value;
  }
  return out;
}

function deserializeRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && value.__bytea) {
      out[key] = Buffer.from(String(value.__bytea), 'base64');
    } else out[key] = value;
  }
  return out;
}

async function queryRows(pool, sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows.map(serializeRow);
}

function writeJson(absPath, data) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function readJson(absPath) {
  if (!fs.existsSync(absPath)) return null;
  return JSON.parse(fs.readFileSync(absPath, 'utf8'));
}

function copyTreeIfExists(src, dest, summary, label) {
  const resolved = path.resolve(String(src || ''));
  if (!resolved || !fs.existsSync(resolved)) {
    summary.skipped.push({ label, reason: 'missing', src: resolved || src });
    return;
  }
  const resolvedDest = path.resolve(String(dest || ''));
  // Re-backup must wipe first: a prior copy may have left notes/TutaNotes/photos as an
  // absolute symlink to sibling users/M{id}/photos. Node fs.cpSync then errors with
  // "Cannot copy …/photos to a subdirectory of self …/photos".
  if (fs.existsSync(resolvedDest)) {
    fs.rmSync(resolvedDest, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(resolvedDest), { recursive: true });
  fs.cpSync(resolved, resolvedDest, {
    recursive: true,
    force: true,
    dereference: false,
    filter: (srcPath) => {
      try {
        const st = fs.lstatSync(srcPath);
        if (!st.isSymbolicLink()) return true;
        // Skip outbound symlinks (vault photos/ → sibling member photos/). They are
        // machine-absolute and recreated on restore by ensureTutaDriveMemberLayout.
        const linkTarget = fs.readlinkSync(srcPath);
        const targetAbs = path.resolve(path.dirname(srcPath), linkTarget);
        const insideSrc =
          targetAbs === resolved || targetAbs.startsWith(`${resolved}${path.sep}`);
        return insideSrc;
      } catch {
        return true;
      }
    }
  });
  summary.copied.push({ label, src: resolved, dest: resolvedDest });
}

function copyFileIfExists(src, destDir, summary, label) {
  const resolved = path.resolve(String(src || ''));
  if (!resolved || !fs.existsSync(resolved)) return;
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, path.basename(resolved));
  fs.copyFileSync(resolved, dest);
  summary.copied.push({ label, src: resolved, dest });
}

function copyMemberBackupZips(memberRoot, destDir, summary) {
  if (!memberRoot || !fs.existsSync(memberRoot)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const name of fs.readdirSync(memberRoot)) {
    if (!/^(?:EncryptedBackup|backup)_\d{4}-\d{2}-\d{2}(?:_\d{2}-\d{2}-\d{2})?\.zip$/i.test(name)) continue;
    const src = path.join(memberRoot, name);
    try {
      if (!fs.statSync(src).isFile()) continue;
      const dest = path.join(destDir, name);
      fs.copyFileSync(src, dest);
      summary.copied.push({ label: 'member-backup-zip', src, dest });
    } catch {
      // skip unreadable
    }
  }
}

async function copyMobileUploadStaging(singlesId, destDir, summary) {
  try {
    const files = await listMobileUploadFiles(singlesId);
    if (!files.length) return;
    fs.mkdirSync(destDir, { recursive: true });
    const folder = getMobileUploadFolder();
    for (const file of files) {
      const src = path.join(folder, file.name);
      const dest = path.join(destDir, file.name);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        summary.copied.push({ label: 'mobile-upload', src, dest });
      }
    }
  } catch (err) {
    summary.skipped.push({ label: 'mobile-upload', reason: err?.message || String(err) });
  }
}

function optionalRecordNotesFolder(singlesId) {
  const root = expandHome(process.env.RECORD_NOTES_FOLDER);
  if (!root) return null;
  const candidate = path.join(root, String(singlesId));
  return fs.existsSync(candidate) ? candidate : null;
}

async function exportSinglesColumns(pool, singlesId, columns) {
  const existing = [];
  for (const col of columns) {
    const { rows } = await pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = 'singles' AND column_name = $2
       ) AS ok`,
      [SCHEMA, col]
    );
    if (rows[0]?.ok) existing.push(col);
  }
  if (!existing.length) return {};
  const selectList = existing.map((c) => `"${c}"`).join(', ');
  const { rows } = await pool.query(
    `SELECT ${selectList} FROM ${SCHEMA}.singles WHERE singles_id = $1 LIMIT 1`,
    [singlesId]
  );
  return serializeRow(rows[0] || {});
}

async function exportTutaNotesPostgres(pool, singlesId, destDir) {
  const out = { notes_vault: [], record_vault_item: [], record_vault_file: [], singles: {} };
  if (!(await tableExists(pool, 'notes_vault'))) return out;

  out.notes_vault = await queryRows(
    pool,
    `SELECT * FROM ${SCHEMA}.notes_vault WHERE singles_id = $1 ORDER BY vault_id`,
    [singlesId]
  );
  const vaultIds = out.notes_vault.map((r) => Number(r.vault_id)).filter((n) => Number.isFinite(n));
  if (vaultIds.length && (await tableExists(pool, 'record_vault_item'))) {
    out.record_vault_item = await queryRows(
      pool,
      `SELECT * FROM ${SCHEMA}.record_vault_item
        WHERE vault_id = ANY($1::bigint[])
        ORDER BY item_id`,
      [vaultIds]
    );
  }
  if (vaultIds.length && (await tableExists(pool, 'record_vault_file'))) {
    out.record_vault_file = await queryRows(
      pool,
      `SELECT * FROM ${SCHEMA}.record_vault_file
        WHERE vault_id = ANY($1::bigint[])
        ORDER BY file_id`,
      [vaultIds]
    );
  }
  out.singles = await exportSinglesColumns(pool, singlesId, NOTES_SINGLES_COLUMNS);
  writeJson(path.join(destDir, 'postgres.json'), out);
  return out;
}

async function exportTutaPhotoPostgres(pool, singlesId, destDir) {
  const out = {
    photo_albums_vault: [],
    photo_albums_invites: [],
    photo_albums_shared_albums: [],
    singles: {}
  };
  if (await tableExists(pool, 'photo_albums_vault')) {
    out.photo_albums_vault = await queryRows(
      pool,
      `SELECT * FROM ${SCHEMA}.photo_albums_vault WHERE singles_id = $1 ORDER BY vault_id`,
      [singlesId]
    );
  }
  if (await tableExists(pool, 'photo_albums_invites')) {
    out.photo_albums_invites = await queryRows(
      pool,
      `SELECT * FROM ${SCHEMA}.photo_albums_invites
        WHERE owner_singles_id = $1 OR accepted_by_singles_id = $1
        ORDER BY invite_id`,
      [singlesId]
    );
  }
  if (await tableExists(pool, 'photo_albums_shared_albums')) {
    out.photo_albums_shared_albums = await queryRows(
      pool,
      `SELECT * FROM ${SCHEMA}.photo_albums_shared_albums
        WHERE owner_singles_id = $1 OR recipient_singles_id = $1
        ORDER BY shared_album_id`,
      [singlesId]
    );
  }
  out.singles = await exportSinglesColumns(pool, singlesId, PHOTO_SINGLES_COLUMNS);
  writeJson(path.join(destDir, 'postgres.json'), out);
  return out;
}

async function exportTutaDatesPostgres(pool, singlesId, destDir) {
  const out = { photos: [], videos: [], singles: {} };
  if (await tableExists(pool, 'photos')) {
    out.photos = await queryRows(
      pool,
      `SELECT * FROM ${SCHEMA}.photos WHERE singles_id = $1 ORDER BY photos_id`,
      [singlesId]
    );
  }
  if (await tableExists(pool, 'videos')) {
    out.videos = await queryRows(
      pool,
      `SELECT * FROM ${SCHEMA}.videos WHERE singles_id = $1 ORDER BY video_id`,
      [singlesId]
    );
  }
  out.singles = await exportSinglesColumns(pool, singlesId, TUTADATES_SINGLES_COLUMNS);
  writeJson(path.join(destDir, 'postgres.json'), out);
  return out;
}

async function backupTutaNotesFiles(user, backupDir, summary) {
  const { memberId, singlesId } = user;
  const filesRoot = path.join(backupDir, 'tutanotes', 'files');
  ensureTutaDriveMemberLayout(memberId, { singlesId });
  copyTreeIfExists(tutaDriveNotesMountPath(memberId), path.join(filesRoot, 'tutadrive-notes'), summary, 'tutadrive-notes');
  copyTreeIfExists(tutaDrivePhotosPath(memberId), path.join(filesRoot, 'tutadrive-photos'), summary, 'tutadrive-photos');
  copyTreeIfExists(
    notesOneDriveStagingMountPath(singlesId),
    path.join(filesRoot, 'notes-onedrive-staging'),
    summary,
    'notes-onedrive-staging'
  );
  const recordNotes = optionalRecordNotesFolder(singlesId);
  if (recordNotes) {
    copyTreeIfExists(recordNotes, path.join(filesRoot, 'record-notes-folder'), summary, 'record-notes-folder');
  }
  copyMemberBackupZips(tutaDriveMemberRoot(memberId), path.join(filesRoot, 'member-backup-zips'), summary);
}

async function backupTutaPhotoFiles(user, backupDir, summary) {
  const { memberId, singlesId } = user;
  const filesRoot = path.join(backupDir, 'tutaphoto', 'files');
  ensureTutaDrivePhotoAlbumsLayout(memberId, { singlesId });
  copyTreeIfExists(
    tutaDrivePhotoAlbumsMountPath(memberId),
    path.join(filesRoot, 'tutadrive-photoalbums'),
    summary,
    'tutadrive-photoalbums'
  );
  copyTreeIfExists(
    photoAlbumsOneDriveStagingMountPath(singlesId),
    path.join(filesRoot, 'photoalbums-onedrive-staging'),
    summary,
    'photoalbums-onedrive-staging'
  );
  await copyMobileUploadStaging(singlesId, path.join(filesRoot, 'mobile-upload'), summary);
}

async function backupTutaDatesFiles(pool, user, backupDir, summary) {
  const { memberId, singlesId } = user;
  const filesRoot = path.join(backupDir, 'tutadates', 'files');
  ensureTutaDatesMemberLayout(memberId);
  copyTreeIfExists(
    tutaDatesPhotosPath(memberId),
    path.join(filesRoot, 'tutadates-photos'),
    summary,
    'tutadates-photos'
  );
  copyTreeIfExists(
    tutaDatesVideosPath(memberId),
    path.join(filesRoot, 'tutadates-videos'),
    summary,
    'tutadates-videos'
  );

  const photoRows = await fetchPhotoRowsForSinglesId(pool, singlesId);
  const legacyPhotoDir = path.join(filesRoot, 'legacy-flat-photos');
  const seenPhotos = new Set();
  for (const row of photoRows) {
    for (const abs of listMemberPhotoFilesOnDisk(row, { memberId })) {
      if (seenPhotos.has(abs)) continue;
      seenPhotos.add(abs);
      copyFileIfExists(abs, legacyPhotoDir, summary, 'legacy-flat-photo');
    }
  }
  for (const abs of listPhotoFolderFilesForMemberId(memberId)) {
    if (seenPhotos.has(abs)) continue;
    seenPhotos.add(abs);
    copyFileIfExists(abs, legacyPhotoDir, summary, 'legacy-flat-photo');
  }

  const videoRows = await fetchVideoRowsForSinglesId(pool, singlesId);
  const legacyVideoDir = path.join(filesRoot, 'legacy-flat-videos');
  const seenVideos = new Set();
  for (const row of videoRows) {
    const resolved = resolveVideoFilePath(
      null,
      row.video_file_name,
      row.video_id,
      row.file_extension,
      row.file_path,
      memberId
    );
    if (resolved && !seenVideos.has(resolved)) {
      seenVideos.add(resolved);
      copyFileIfExists(resolved, legacyVideoDir, summary, 'legacy-flat-video');
    }
  }
}

async function restoreTree(src, dest, summary, label, { wipeDest = true } = {}) {
  const resolvedSrc = path.resolve(src);
  if (!fs.existsSync(resolvedSrc)) {
    summary.skipped.push({ label, reason: 'backup missing', src: resolvedSrc });
    return;
  }
  if (wipeDest && fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(resolvedSrc, dest, { recursive: true, force: true, dereference: false });
  summary.restored.push({ label, src: resolvedSrc, dest });
}

async function restoreFilesFromDir(srcDir, destDir, summary, label) {
  if (!fs.existsSync(srcDir)) {
    summary.skipped.push({ label, reason: 'backup missing', src: srcDir });
    return;
  }
  fs.mkdirSync(destDir, { recursive: true });
  for (const name of fs.readdirSync(srcDir)) {
    const src = path.join(srcDir, name);
    const dest = path.join(destDir, name);
    try {
      if (fs.statSync(src).isFile()) {
        fs.copyFileSync(src, dest);
        summary.restored.push({ label, src, dest });
      }
    } catch {
      // skip
    }
  }
}

async function restoreSinglesColumns(client, singlesId, columns, data) {
  if (!data || typeof data !== 'object') return;
  const sets = [];
  const values = [];
  let idx = 1;
  for (const col of columns) {
    if (!(col in data)) continue;
    const { rows } = await client.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = 'singles' AND column_name = $2
       ) AS ok`,
      [SCHEMA, col]
    );
    if (!rows[0]?.ok) continue;
    sets.push(`"${col}" = $${idx++}`);
    values.push(deserializeRow({ v: data[col] }).v);
  }
  if (!sets.length) return;
  values.push(singlesId);
  await client.query(
    `UPDATE ${SCHEMA}.singles SET ${sets.join(', ')} WHERE singles_id = $${idx}`,
    values
  );
}

async function deleteRows(client, tableName, whereSql, params) {
  if (!(await tableExists(client, tableName))) return;
  await client.query(`DELETE FROM ${SCHEMA}.${tableName} WHERE ${whereSql}`, params);
}

async function insertRows(client, tableName, rows) {
  if (!rows?.length || !(await tableExists(client, tableName))) return;
  for (const raw of rows) {
    const row = deserializeRow(raw);
    const cols = Object.keys(row);
    if (!cols.length) continue;
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    const colList = cols.map((c) => `"${c}"`).join(', ');
    await client.query(
      `INSERT INTO ${SCHEMA}.${tableName} (${colList}) VALUES (${placeholders})`,
      cols.map((c) => row[c])
    );
  }
}

async function insertVaultItems(client, items) {
  if (!items?.length) return;
  const pending = items.map(deserializeRow);
  const inserted = new Set();
  let guard = pending.length * 2 + 1;
  while (pending.length && guard > 0) {
    guard -= 1;
    let progress = false;
    for (let i = pending.length - 1; i >= 0; i -= 1) {
      const row = pending[i];
      const parentId = row.parent_id != null ? Number(row.parent_id) : null;
      if (parentId != null && !inserted.has(parentId)) continue;
      const cols = Object.keys(row);
      const placeholders = cols.map((_, j) => `$${j + 1}`).join(', ');
      const colList = cols.map((c) => `"${c}"`).join(', ');
      await client.query(
        `INSERT INTO ${SCHEMA}.record_vault_item (${colList}) VALUES (${placeholders})
         ON CONFLICT (item_id) DO UPDATE SET
           vault_id = EXCLUDED.vault_id,
           item_type = EXCLUDED.item_type,
           parent_id = EXCLUDED.parent_id,
           display_order = EXCLUDED.display_order,
           content = EXCLUDED.content,
           content_bytes = EXCLUDED.content_bytes,
           rev = EXCLUDED.rev,
           updated_at = EXCLUDED.updated_at,
           deleted_at = EXCLUDED.deleted_at`,
        cols.map((c) => row[c])
      );
      inserted.add(Number(row.item_id));
      pending.splice(i, 1);
      progress = true;
    }
    if (!progress && pending.length) {
      throw new Error('Could not restore record_vault_item rows — unresolved parent_id chain');
    }
  }
}

async function restoreTutaNotesPostgres(client, singlesId, backupDir) {
  const payload = readJson(path.join(backupDir, 'tutanotes', 'postgres.json'));
  if (!payload) return;
  const vaultIds = (payload.notes_vault || []).map((r) => Number(r.vault_id)).filter(Boolean);
  if (vaultIds.length) {
    await deleteRows(client, 'record_vault_file', 'vault_id = ANY($1::bigint[])', [vaultIds]);
    await deleteRows(client, 'record_vault_item', 'vault_id = ANY($1::bigint[])', [vaultIds]);
  }
  await deleteRows(client, 'notes_vault', 'singles_id = $1', [singlesId]);
  await insertRows(client, 'notes_vault', payload.notes_vault);
  await insertVaultItems(client, payload.record_vault_item);
  await insertRows(client, 'record_vault_file', payload.record_vault_file);
  await restoreSinglesColumns(client, singlesId, NOTES_SINGLES_COLUMNS, payload.singles);
  await resetSerialSequence(client, 'notes_vault', 'vault_id');
  await resetSerialSequence(client, 'record_vault_item', 'item_id');
  await resetSerialSequence(client, 'record_vault_file', 'file_id');
}

async function restoreTutaPhotoPostgres(client, singlesId, backupDir) {
  const payload = readJson(path.join(backupDir, 'tutaphoto', 'postgres.json'));
  if (!payload) return;
  await deleteRows(
    client,
    'photo_albums_shared_albums',
    'owner_singles_id = $1 OR recipient_singles_id = $1',
    [singlesId]
  );
  await deleteRows(
    client,
    'photo_albums_invites',
    'owner_singles_id = $1 OR accepted_by_singles_id = $1',
    [singlesId]
  );
  await deleteRows(client, 'photo_albums_vault', 'singles_id = $1', [singlesId]);
  await insertRows(client, 'photo_albums_vault', payload.photo_albums_vault);
  await insertRows(client, 'photo_albums_invites', payload.photo_albums_invites);
  await insertRows(client, 'photo_albums_shared_albums', payload.photo_albums_shared_albums);
  await restoreSinglesColumns(client, singlesId, PHOTO_SINGLES_COLUMNS, payload.singles);
  await resetSerialSequence(client, 'photo_albums_vault', 'vault_id');
  await resetSerialSequence(client, 'photo_albums_invites', 'invite_id');
  await resetSerialSequence(client, 'photo_albums_shared_albums', 'shared_album_id');
}

async function restoreTutaDatesPostgres(client, singlesId, backupDir) {
  const payload = readJson(path.join(backupDir, 'tutadates', 'postgres.json'));
  if (!payload) return;
  await deleteRows(client, 'photos', 'singles_id = $1', [singlesId]);
  await deleteRows(client, 'videos', 'singles_id = $1', [singlesId]);
  await insertRows(client, 'photos', payload.photos);
  await insertRows(client, 'videos', payload.videos);
  await restoreSinglesColumns(client, singlesId, TUTADATES_SINGLES_COLUMNS, payload.singles);
  await resetSerialSequence(client, 'photos', 'photos_id');
  await resetSerialSequence(client, 'videos', 'video_id');
}

async function resetSerialSequence(client, tableName, columnName) {
  if (!(await tableExists(client, tableName))) return;
  await client.query(
    `SELECT setval(
       pg_get_serial_sequence('${SCHEMA}.${tableName}', '${columnName}'),
       COALESCE((SELECT MAX("${columnName}") FROM ${SCHEMA}.${tableName}), 1)
     )`
  );
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ email?: string, singlesId?: number, backupRoot?: string }} opts
 */
export async function backupUserAll(pool, opts = {}) {
  let user;
  if (opts.email) {
    user = await resolveUserByEmail(pool, opts.email);
  } else if (opts.singlesId) {
    const singlesId = Number(opts.singlesId);
    const memberId = await loadMemberIdForSingles(singlesId);
    if (!memberId) throw new Error(`Member number not set for singles_id ${singlesId}`);
    const { rows } = await pool.query(
      `SELECT email::text AS email FROM ${SCHEMA}.singles WHERE singles_id = $1 LIMIT 1`,
      [singlesId]
    );
    user = {
      singlesId,
      memberId,
      email: String(rows[0]?.email || '').trim(),
      memberFolder: memberFolderName(memberId)
    };
  } else {
    throw new Error('email or singlesId is required');
  }

  const backupDir = path.resolve(opts.backupRoot || defaultBackupRootForEmail(user.email));
  const summary = { copied: [], skipped: [], backupDir };

  fs.mkdirSync(backupDir, { recursive: true });

  await backupTutaNotesFiles(user, backupDir, summary);
  await exportTutaNotesPostgres(pool, user.singlesId, path.join(backupDir, 'tutanotes'));

  await backupTutaPhotoFiles(user, backupDir, summary);
  await exportTutaPhotoPostgres(pool, user.singlesId, path.join(backupDir, 'tutaphoto'));

  await backupTutaDatesFiles(pool, user, backupDir, summary);
  await exportTutaDatesPostgres(pool, user.singlesId, path.join(backupDir, 'tutadates'));

  const manifest = {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    email: user.email,
    singlesId: user.singlesId,
    memberId: user.memberId,
    memberFolder: user.memberFolder,
    summary: {
      copied: summary.copied.length,
      skipped: summary.skipped.length
    }
  };
  writeJson(path.join(backupDir, 'manifest.json'), manifest);

  return { ...user, backupDir, manifest, summary };
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ email?: string, singlesId?: number, backupRoot?: string, dryRun?: boolean }} opts
 */
export async function restoreUserAll(pool, opts = {}) {
  let user;
  if (opts.email) {
    user = await resolveUserByEmail(pool, opts.email);
  } else if (opts.singlesId) {
    const singlesId = Number(opts.singlesId);
    const memberId = await loadMemberIdForSingles(singlesId);
    if (!memberId) throw new Error(`Member number not set for singles_id ${singlesId}`);
    const { rows } = await pool.query(
      `SELECT email::text AS email FROM ${SCHEMA}.singles WHERE singles_id = $1 LIMIT 1`,
      [singlesId]
    );
    user = {
      singlesId,
      memberId,
      email: String(rows[0]?.email || '').trim(),
      memberFolder: memberFolderName(memberId)
    };
  } else {
    throw new Error('email or singlesId is required');
  }

  const backupDir = path.resolve(opts.backupRoot || defaultBackupRootForEmail(user.email));
  if (!fs.existsSync(path.join(backupDir, 'manifest.json'))) {
    throw new Error(`Backup not found at ${backupDir} (missing manifest.json)`);
  }

  if (opts.dryRun) {
    return { ...user, backupDir, dryRun: true, manifest: readJson(path.join(backupDir, 'manifest.json')) };
  }

  const summary = { restored: [], skipped: [] };
  const { memberId, singlesId } = user;
  const filesRoot = (section) => path.join(backupDir, section, 'files');

  await restoreTree(
    path.join(filesRoot('tutanotes'), 'tutadrive-notes'),
    tutaDriveNotesMountPath(memberId),
    summary,
    'tutadrive-notes'
  );
  await restoreTree(
    path.join(filesRoot('tutanotes'), 'tutadrive-photos'),
    tutaDrivePhotosPath(memberId),
    summary,
    'tutadrive-photos'
  );
  // Recreate notes/TutaNotes/photos → sibling photos/ (skipped as outbound symlink on backup).
  try {
    ensureTutaDriveMemberLayout(memberId, { singlesId });
  } catch (err) {
    summary.skipped.push({
      label: 'tutadrive-photos-symlink',
      reason: err?.message || String(err)
    });
  }
  await restoreTree(
    path.join(filesRoot('tutanotes'), 'notes-onedrive-staging'),
    notesOneDriveStagingMountPath(singlesId),
    summary,
    'notes-onedrive-staging'
  );
  const recordNotes = optionalRecordNotesFolder(singlesId);
  if (recordNotes) {
    await restoreTree(
      path.join(filesRoot('tutanotes'), 'record-notes-folder'),
      recordNotes,
      summary,
      'record-notes-folder'
    );
  }
  await restoreFilesFromDir(
    path.join(filesRoot('tutanotes'), 'member-backup-zips'),
    tutaDriveMemberRoot(memberId),
    summary,
    'member-backup-zip'
  );

  await restoreTree(
    path.join(filesRoot('tutaphoto'), 'tutadrive-photoalbums'),
    tutaDrivePhotoAlbumsMountPath(memberId),
    summary,
    'tutadrive-photoalbums'
  );
  await restoreTree(
    path.join(filesRoot('tutaphoto'), 'photoalbums-onedrive-staging'),
    photoAlbumsOneDriveStagingMountPath(singlesId),
    summary,
    'photoalbums-onedrive-staging'
  );
  try {
    await restoreFilesFromDir(
      path.join(filesRoot('tutaphoto'), 'mobile-upload'),
      getMobileUploadFolder(),
      summary,
      'mobile-upload'
    );
  } catch (err) {
    summary.skipped.push({ label: 'mobile-upload', reason: err?.message || String(err) });
  }

  await restoreTree(
    path.join(filesRoot('tutadates'), 'tutadates-photos'),
    tutaDatesPhotosPath(memberId),
    summary,
    'tutadates-photos'
  );
  await restoreTree(
    path.join(filesRoot('tutadates'), 'tutadates-videos'),
    tutaDatesVideosPath(memberId),
    summary,
    'tutadates-videos'
  );
  await restoreFilesFromDir(
    path.join(filesRoot('tutadates'), 'legacy-flat-photos'),
    tutaDatesPhotosPath(memberId),
    summary,
    'legacy-flat-photo'
  );
  await restoreFilesFromDir(
    path.join(filesRoot('tutadates'), 'legacy-flat-videos'),
    tutaDatesVideosPath(memberId),
    summary,
    'legacy-flat-video'
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await restoreTutaNotesPostgres(client, singlesId, backupDir);
    await restoreTutaPhotoPostgres(client, singlesId, backupDir);
    await restoreTutaDatesPostgres(client, singlesId, backupDir);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { ...user, backupDir, summary, manifest: readJson(path.join(backupDir, 'manifest.json')) };
}
