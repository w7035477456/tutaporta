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
  tutaDatesPhotosPathLegacyLargeCheap,
  tutaDatesVideosPath,
  tutaDatesVideosPathLegacyLargeCheap
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

/** Per-app backup keys (profile menu shows one app at a time). */
export const TUTA_MALL_BACKUP_APPS = ['tutadates', 'tutanotes', 'tutaphoto'];

export function normalizeBackupApp(app) {
  const section = String(app || '').trim().toLowerCase();
  if (!TUTA_MALL_BACKUP_APPS.includes(section)) {
    throw new Error(`Invalid backup app: ${app}`);
  }
  return section;
}

export function sectionBackupExists(backupDir, app) {
  const section = String(app || '').trim().toLowerCase();
  return fs.existsSync(path.join(backupDir, section, 'postgres.json'));
}

export function sectionCreatedAt(manifest, app, backupDir) {
  if (!manifest) return null;
  const section = String(app || '').trim().toLowerCase();
  const fromSection = manifest.sections?.[section]?.createdAt;
  if (fromSection) return fromSection;
  if (backupDir && sectionBackupExists(backupDir, section) && manifest.createdAt) {
    return manifest.createdAt;
  }
  return null;
}

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

/** Album media pointers only — not buddies/acquaints, posts, or chats. */
const TUTADATES_SINGLES_COLUMNS = ['profile_image_fk', 'video1_fk', 'video2_fk', 'video3_fk'];

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

/** Merge files from src into dest (create dest if needed; do not wipe). */
function copyTreeMergeFiles(src, dest, summary, label) {
  const resolvedSrc = path.resolve(String(src || ''));
  if (!resolvedSrc || !fs.existsSync(resolvedSrc)) {
    summary.skipped.push({ label, reason: 'missing', src: resolvedSrc || src });
    return;
  }
  const resolvedDest = path.resolve(String(dest || ''));
  fs.mkdirSync(resolvedDest, { recursive: true });
  let n = 0;
  for (const name of fs.readdirSync(resolvedSrc)) {
    const from = path.join(resolvedSrc, name);
    const to = path.join(resolvedDest, name);
    try {
      const st = fs.lstatSync(from);
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) {
        copyTreeMergeFiles(from, to, summary, `${label}/${name}`);
        continue;
      }
      if (st.isFile()) {
        fs.copyFileSync(from, to);
        n += 1;
      }
    } catch {
      // skip unreadable
    }
  }
  if (n > 0) {
    summary.copied.push({ label, src: resolvedSrc, dest: resolvedDest, files: n });
  }
}

function countFilesInDir(dir) {
  if (!dir || !fs.existsSync(dir)) return 0;
  let n = 0;
  for (const name of fs.readdirSync(dir)) {
    try {
      const p = path.join(dir, name);
      const st = fs.lstatSync(p);
      if (st.isFile()) n += 1;
      else if (st.isDirectory() && !st.isSymbolicLink()) n += countFilesInDir(p);
    } catch {
      // ignore
    }
  }
  return n;
}

/** Wipe a live media directory so restore replaces (not merges) album contents. */
function wipeDirContents(dir, summary, label) {
  const resolved = path.resolve(String(dir || ''));
  if (resolved && fs.existsSync(resolved)) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
  fs.mkdirSync(resolved, { recursive: true });
  summary.restored.push({ label: `${label}-wiped`, dest: resolved });
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

async function exportTutaDatesPostgres(pool, singlesId, destDir, memberId) {
  const layout = ensureTutaDatesMemberLayout(memberId);
  const photosFolder = layout.photosFolder;
  const videosFolder = layout.videosFolder;
  const out = { photos: [], videos: [], singles: {} };
  if (await tableExists(pool, 'photos')) {
    // All album types: uploaded, public, private (Acquaint & Buddies) — not relationships/posts/chats.
    out.photos = await queryRows(
      pool,
      `SELECT * FROM ${SCHEMA}.photos WHERE singles_id = $1 ORDER BY photos_id`,
      [singlesId]
    );
    for (const row of out.photos) {
      row.file_path = photosFolder;
    }
  }
  if (await tableExists(pool, 'videos')) {
    // Public Video Vault (+ any other album video types for this member).
    out.videos = await queryRows(
      pool,
      `SELECT * FROM ${SCHEMA}.videos WHERE singles_id = $1 ORDER BY video_id`,
      [singlesId]
    );
    for (const row of out.videos) {
      row.file_path = videosFolder;
    }
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

  // Primary per-member album media under FAST_STORAGE_FOLDER.
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

  // Pre-migration location (LARGE_CHEAP) — merge into same backup trees so restore lands in FAST_STORAGE.
  const cheapPhotos = tutaDatesPhotosPathLegacyLargeCheap(memberId);
  if (cheapPhotos && fs.existsSync(cheapPhotos)) {
    copyTreeMergeFiles(cheapPhotos, path.join(filesRoot, 'tutadates-photos'), summary, 'tutadates-photos-largecheap');
  }
  const cheapVideos = tutaDatesVideosPathLegacyLargeCheap(memberId);
  if (cheapVideos && fs.existsSync(cheapVideos)) {
    copyTreeMergeFiles(cheapVideos, path.join(filesRoot, 'tutadates-videos'), summary, 'tutadates-videos-largecheap');
  }

  // Also scoop any files still referenced by DB rows (legacy flat / odd file_path).
  const photoRows = await fetchPhotoRowsForSinglesId(pool, singlesId);
  // Need file_path for odd locations — fetch full rows when the thin helper omits it.
  let photoRowsFull = photoRows;
  try {
    const { rows } = await pool.query(
      `SELECT photos_id, photo_file_name, file_extension, file_path, photo_thumbnail
         FROM ${SCHEMA}.photos WHERE singles_id = $1`,
      [singlesId]
    );
    photoRowsFull = rows;
  } catch {
    // keep thin rows
  }
  const legacyPhotoDir = path.join(filesRoot, 'legacy-flat-photos');
  const seenPhotos = new Set();
  for (const row of photoRowsFull) {
    for (const abs of listMemberPhotoFilesOnDisk(row, { memberId, filePathFromDb: row.file_path })) {
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
  let videoRowsFull = videoRows;
  try {
    const { rows } = await pool.query(
      `SELECT video_id, video_file_name, file_extension, file_path, video_thumbnail
         FROM ${SCHEMA}.videos WHERE singles_id = $1`,
      [singlesId]
    );
    videoRowsFull = rows;
  } catch {
    // keep thin rows
  }
  const legacyVideoDir = path.join(filesRoot, 'legacy-flat-videos');
  const seenVideos = new Set();
  for (const row of videoRowsFull) {
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
    // Thumbnail beside the video when present.
    const thumbName = String(row.video_thumbnail || '').trim();
    if (thumbName) {
      const videoDir = resolved ? path.dirname(resolved) : tutaDatesVideosPath(memberId);
      const thumbAbs = path.join(videoDir, thumbName);
      if (!seenVideos.has(thumbAbs)) {
        seenVideos.add(thumbAbs);
        copyFileIfExists(thumbAbs, legacyVideoDir, summary, 'legacy-flat-video-thumb');
      }
    }
  }

  const photoFileCount =
    (countFilesInDir(path.join(filesRoot, 'tutadates-photos')) || 0) +
    (countFilesInDir(legacyPhotoDir) || 0);
  const videoFileCount =
    (countFilesInDir(path.join(filesRoot, 'tutadates-videos')) || 0) +
    (countFilesInDir(legacyVideoDir) || 0);
  summary.copied.push({
    label: 'tutadates-media-summary',
    src: `photos=${photoRowsFull.length} videos=${videoRowsFull.length}`,
    dest: `files photos≈${photoFileCount} videos≈${videoFileCount}`
  });
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

async function restoreTutaDatesPostgres(client, singlesId, backupDir, memberId) {
  const payload = readJson(path.join(backupDir, 'tutadates', 'postgres.json'));
  if (!payload) return;
  const layout = ensureTutaDatesMemberLayout(memberId);
  const photosFolder = layout.photosFolder;
  const videosFolder = layout.videosFolder;

  // Clear album media FKs before delete so restore can re-point cleanly.
  await restoreSinglesColumns(client, singlesId, TUTADATES_SINGLES_COLUMNS, {
    profile_image_fk: null,
    video1_fk: null,
    video2_fk: null,
    video3_fk: null
  });

  await deleteRows(client, 'photos', 'singles_id = $1', [singlesId]);
  await deleteRows(client, 'videos', 'singles_id = $1', [singlesId]);

  const photos = (payload.photos || []).map((raw) => {
    const row = { ...raw, file_path: photosFolder };
    return row;
  });
  const videos = (payload.videos || []).map((raw) => {
    const row = { ...raw, file_path: videosFolder };
    return row;
  });

  await insertRows(client, 'photos', photos);
  await insertRows(client, 'videos', videos);
  await restoreSinglesColumns(client, singlesId, TUTADATES_SINGLES_COLUMNS, payload.singles || {});
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

async function resolveBackupUser(pool, opts) {
  if (opts.email) {
    return resolveUserByEmail(pool, opts.email);
  }
  if (opts.singlesId) {
    const singlesId = Number(opts.singlesId);
    const memberId = await loadMemberIdForSingles(singlesId);
    if (!memberId) throw new Error(`Member number not set for singles_id ${singlesId}`);
    const { rows } = await pool.query(
      `SELECT email::text AS email FROM ${SCHEMA}.singles WHERE singles_id = $1 LIMIT 1`,
      [singlesId]
    );
    return {
      singlesId,
      memberId,
      email: String(rows[0]?.email || '').trim(),
      memberFolder: memberFolderName(memberId)
    };
  }
  throw new Error('email or singlesId is required');
}

function updateManifestSection(backupDir, user, section, summary) {
  const manifestPath = path.join(backupDir, 'manifest.json');
  let manifest = readJson(manifestPath) || {
    version: BACKUP_VERSION,
    email: user.email,
    singlesId: user.singlesId,
    memberId: user.memberId,
    memberFolder: user.memberFolder,
    sections: {}
  };
  if (!manifest.sections || typeof manifest.sections !== 'object') {
    manifest.sections = {};
  }
  manifest.email = user.email;
  manifest.singlesId = user.singlesId;
  manifest.memberId = user.memberId;
  manifest.memberFolder = user.memberFolder;
  manifest.sections[section] = {
    createdAt: new Date().toISOString(),
    copied: summary.copied?.length ?? 0,
    skipped: summary.skipped?.length ?? 0
  };
  manifest.updatedAt = new Date().toISOString();
  writeJson(manifestPath, manifest);
  return manifest;
}

async function runBackupSection(pool, user, backupDir, section, summary) {
  if (section === 'tutanotes') {
    await backupTutaNotesFiles(user, backupDir, summary);
    await exportTutaNotesPostgres(pool, user.singlesId, path.join(backupDir, 'tutanotes'));
    return;
  }
  if (section === 'tutaphoto') {
    await backupTutaPhotoFiles(user, backupDir, summary);
    await exportTutaPhotoPostgres(pool, user.singlesId, path.join(backupDir, 'tutaphoto'));
    return;
  }
  if (section === 'tutadates') {
    await backupTutaDatesFiles(pool, user, backupDir, summary);
    await exportTutaDatesPostgres(pool, user.singlesId, path.join(backupDir, 'tutadates'), user.memberId);
  }
}

async function restoreSectionFiles(user, backupDir, section, summary) {
  const { memberId, singlesId } = user;
  const filesRoot = (app) => path.join(backupDir, app, 'files');

  if (section === 'tutanotes') {
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
    return;
  }

  if (section === 'tutaphoto') {
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
    return;
  }

  if (section === 'tutadates') {
    ensureTutaDatesMemberLayout(memberId);
    wipeDirContents(tutaDatesPhotosPath(memberId), summary, 'tutadates-photos');
    wipeDirContents(tutaDatesVideosPath(memberId), summary, 'tutadates-videos');
    await restoreTree(
      path.join(filesRoot('tutadates'), 'tutadates-photos'),
      tutaDatesPhotosPath(memberId),
      summary,
      'tutadates-photos',
      { wipeDest: false }
    );
    await restoreTree(
      path.join(filesRoot('tutadates'), 'tutadates-videos'),
      tutaDatesVideosPath(memberId),
      summary,
      'tutadates-videos',
      { wipeDest: false }
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
  }
}

async function restoreSectionPostgres(client, singlesId, backupDir, section, memberId) {
  if (section === 'tutanotes') {
    await restoreTutaNotesPostgres(client, singlesId, backupDir);
    return;
  }
  if (section === 'tutaphoto') {
    await restoreTutaPhotoPostgres(client, singlesId, backupDir);
    return;
  }
  if (section === 'tutadates') {
    await restoreTutaDatesPostgres(client, singlesId, backupDir, memberId);
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ email?: string, singlesId?: number, backupRoot?: string, section?: string, app?: string }} opts
 */
export async function backupUserSection(pool, opts = {}) {
  const section = normalizeBackupApp(opts.section || opts.app);
  const user = await resolveBackupUser(pool, opts);
  const backupDir = path.resolve(opts.backupRoot || defaultBackupRootForEmail(user.email));
  fs.mkdirSync(backupDir, { recursive: true });

  const sectionDir = path.join(backupDir, section);
  if (fs.existsSync(sectionDir)) {
    fs.rmSync(sectionDir, { recursive: true, force: true });
  }

  const summary = { copied: [], skipped: [], backupDir, errors: [] };
  try {
    await runBackupSection(pool, user, backupDir, section, summary);
  } catch (err) {
    throw new Error(`${section} backup failed: ${err?.message || String(err)}`);
  }

  const manifest = updateManifestSection(backupDir, user, section, summary);
  return { ...user, backupDir, manifest, section, summary };
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ email?: string, singlesId?: number, backupRoot?: string, section?: string, app?: string, dryRun?: boolean }} opts
 */
export async function restoreUserSection(pool, opts = {}) {
  const section = normalizeBackupApp(opts.section || opts.app);
  const user = await resolveBackupUser(pool, opts);
  const backupDir = path.resolve(opts.backupRoot || defaultBackupRootForEmail(user.email));

  if (!sectionBackupExists(backupDir, section)) {
    throw new Error(`No ${section} backup found at ${backupDir}`);
  }

  const manifestPath = path.join(backupDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Backup not found at ${backupDir} (missing manifest.json)`);
  }

  if (opts.dryRun) {
    return {
      ...user,
      backupDir,
      section,
      dryRun: true,
      manifest: readJson(manifestPath)
    };
  }

  const summary = { restored: [], skipped: [] };
  await restoreSectionFiles(user, backupDir, section, summary);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await restoreSectionPostgres(client, user.singlesId, backupDir, section, user.memberId);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return {
    ...user,
    backupDir,
    section,
    summary,
    manifest: readJson(manifestPath)
  };
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ email?: string, singlesId?: number, backupRoot?: string }} opts
 */
export async function backupUserAll(pool, opts = {}) {
  const user = await resolveBackupUser(pool, opts);
  const backupDir = path.resolve(opts.backupRoot || defaultBackupRootForEmail(user.email));
  const summary = { copied: [], skipped: [], backupDir, errors: [] };

  if (fs.existsSync(backupDir)) {
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
  fs.mkdirSync(backupDir, { recursive: true });

  for (const section of TUTA_MALL_BACKUP_APPS) {
    try {
      const sectionResult = await backupUserSection(pool, {
        ...opts,
        singlesId: user.singlesId,
        email: user.email,
        backupRoot: backupDir,
        section
      });
      summary.copied.push(...(sectionResult.summary.copied || []));
      summary.skipped.push(...(sectionResult.summary.skipped || []));
    } catch (err) {
      const reason = err?.message || String(err);
      summary.errors.push({ label: section, reason });
      summary.skipped.push({ label: section, reason });
    }
  }

  if (summary.errors.some((e) => e.label === 'tutadates')) {
    const tutaErr = summary.errors.find((e) => e.label === 'tutadates');
    throw new Error(`TutaDates backup failed: ${tutaErr?.reason || 'unknown'}`);
  }

  const manifest = readJson(path.join(backupDir, 'manifest.json')) || {};
  manifest.createdAt = new Date().toISOString();
  manifest.summary = {
    copied: summary.copied.length,
    skipped: summary.skipped.length,
    errors: summary.errors
  };
  writeJson(path.join(backupDir, 'manifest.json'), manifest);

  return { ...user, backupDir, manifest, summary };
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ email?: string, singlesId?: number, backupRoot?: string, dryRun?: boolean }} opts
 */
export async function restoreUserAll(pool, opts = {}) {
  const user = await resolveBackupUser(pool, opts);
  const backupDir = path.resolve(opts.backupRoot || defaultBackupRootForEmail(user.email));
  if (!fs.existsSync(path.join(backupDir, 'manifest.json'))) {
    throw new Error(`Backup not found at ${backupDir} (missing manifest.json)`);
  }

  if (opts.dryRun) {
    return { ...user, backupDir, dryRun: true, manifest: readJson(path.join(backupDir, 'manifest.json')) };
  }

  const summary = { restored: [], skipped: [] };
  for (const section of TUTA_MALL_BACKUP_APPS) {
    if (!sectionBackupExists(backupDir, section)) continue;
    const sectionResult = await restoreUserSection(pool, {
      ...opts,
      singlesId: user.singlesId,
      email: user.email,
      backupRoot: backupDir,
      section
    });
    summary.restored.push(...(sectionResult.summary.restored || []));
    summary.skipped.push(...(sectionResult.summary.skipped || []));
  }

  return { ...user, backupDir, summary, manifest: readJson(path.join(backupDir, 'manifest.json')) };
}
