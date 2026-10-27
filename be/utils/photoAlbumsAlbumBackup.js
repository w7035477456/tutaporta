import fs from 'fs';
import path from 'path';
import { ZipArchive } from 'archiver';
import { buildPhotoAlbumsAlbumBackupZipFileName } from './photoAlbumsBackupZipNames.js';
import {
  clearAlbumBackupProgress,
  setAlbumBackupProgress
} from './photoAlbumsAlbumBackupProgress.js';
import { getVaultSession, vaultGetNote, vaultGetTree } from './photoAlbumsUsb/vaultSession.js';
import {
  VAULT_DIR_NAME,
  VAULT_FILES_DIR,
  VAULT_PHOTOS_DIR,
  vaultFilesRoot,
  vaultPhotosRoot
} from './photoAlbumsUsb/vaultPaths.js';

export { buildPhotoAlbumsAlbumBackupZipFileName } from './photoAlbumsBackupZipNames.js';

function resolveNoteIds(noteId, notebookId) {
  const nid = Number(noteId);
  const nbid = Number(notebookId);
  if (!Number.isFinite(nid) || nid < 1) throw new Error('Choose an album to back up first');
  if (!Number.isFinite(nbid) || nbid < 1) throw new Error('Album set is missing');
  return { noteId: nid, notebookId: nbid };
}

function collectAlbumDiskEntries(session, notebookId, noteId) {
  const entries = [];
  const seen = new Set();
  const pushFile = (zipPath, absPath) => {
    const key = zipPath.toLowerCase();
    if (seen.has(key)) return;
    if (!fs.existsSync(absPath)) return;
    const stat = fs.statSync(absPath);
    if (!stat.isFile()) return;
    seen.add(key);
    entries.push({ zipPath, absPath, size: stat.size });
  };

  const filesDir = path.join(vaultFilesRoot(session.mountPath), String(notebookId), String(noteId));
  if (fs.existsSync(filesDir)) {
    for (const name of fs.readdirSync(filesDir)) {
      pushFile(`${VAULT_FILES_DIR}/${notebookId}/${noteId}/${name}`, path.join(filesDir, name));
    }
  }

  const photoNbDir = path.join(vaultPhotosRoot(session.mountPath), String(notebookId));
  if (fs.existsSync(photoNbDir)) {
    const notePrefix = String(noteId);
    for (const name of fs.readdirSync(photoNbDir)) {
      if (!name.startsWith(notePrefix)) continue;
      pushFile(`${VAULT_PHOTOS_DIR}/${notebookId}/${name}`, path.join(photoNbDir, name));
    }
  }

  return entries;
}

function buildAlbumManifest(note, albumLabel, notebookName = '') {
  const attachments = Array.isArray(note?.attachments)
    ? note.attachments.map((a) => ({
        file_name: a.file_name,
        file_extension: a.file_extension,
        relative_path: a.relative_path,
        file_size_bytes: a.file_size_bytes,
        checksum: a.checksum,
        mime_type: a.mime_type,
        display_order: a.display_order,
        album_photo_seq: a.album_photo_seq,
        source_taken_at_ms: a.source_taken_at_ms
      }))
    : [];
  return {
    version: 1,
    kind: 'photo_albums_album_backup',
    albumLabel: String(albumLabel || note.note_name || '').trim(),
    notebookId: Number(note.notebook_id),
    noteId: Number(note.note_id),
    notebookName: String(notebookName || '').trim(),
    noteName: String(note.note_name || ''),
    bodyText: String(note.body_text || ''),
    keywords: Array.isArray(note?.keywords)
      ? note.keywords.map((k) => String(k).trim()).filter(Boolean)
      : [],
    attachments,
    attachmentCount: attachments.length,
    createdAt: note.created_at || null,
    updatedAt: note.updated_at || null,
    exportedAt: new Date().toISOString()
  };
}

async function ensureAlbumEntriesOnDisk(session, _singlesId, entries, _onProgress) {
  return entries;
}

async function reportProgress(singlesId, payload) {
  await setAlbumBackupProgress(singlesId, payload);
}

/**
 * Zip only the currently open album (note) from an unlocked vault session.
 * Paths inside the zip mirror the vault layout under TutaPhotoAlbums/.
 */
export async function streamPhotoAlbumsAlbumBackupZip(
  singlesId,
  storageType,
  { noteId, notebookId, albumLabel = '' } = {},
  res
) {
  const ids = resolveNoteIds(noteId, notebookId);
  const session = getVaultSession(singlesId, storageType);
  if (!session?.mountPath) {
    throw new Error('TutaPhotoAlbums is not unlocked — open your album first');
  }

  const note = await vaultGetNote(session, ids.noteId);
  if (!note) throw new Error('Album not found');
  if (Number(note.notebook_id) !== ids.notebookId) {
    throw new Error('Album does not belong to the selected album set');
  }

  const tree = await vaultGetTree(session);
  const nb = tree.notebooks.find((row) => Number(row.notebook_id) === ids.notebookId);
  const notebookName = String(nb?.notebook_name || '').trim();

  const resolvedLabel =
    String(albumLabel || note.note_name || '').trim() ||
    `Set ${ids.notebookId}/Album ${ids.noteId}`;
  const zipName = buildPhotoAlbumsAlbumBackupZipFileName(resolvedLabel, storageType === 'usb' ? 'usb' : 'cloud');

  await clearAlbumBackupProgress(singlesId);
  await reportProgress(singlesId, {
    percent: 1,
    label: `Backing up only photo album: '${resolvedLabel}' as zip`,
    fileIndex: 0,
    fileTotal: 0,
    bytesDone: 0
  });

  let entries = collectAlbumDiskEntries(session, ids.notebookId, ids.noteId);
  const manifest = buildAlbumManifest(note, resolvedLabel, notebookName);
  const manifestJson = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8');
  entries.push({
    zipPath: 'album-backup.manifest.json',
    absPath: null,
    size: manifestJson.length,
    buffer: manifestJson
  });

  await reportProgress(singlesId, {
    percent: 5,
    label: `Backing up only photo album: '${resolvedLabel}' as zip`,
    fileIndex: 0,
    fileTotal: entries.length,
    bytesDone: 0
  });

  entries = await ensureAlbumEntriesOnDisk(session, singlesId, entries, async (info) => {
    await reportProgress(singlesId, {
      ...info,
      label: `Backing up only photo album: '${resolvedLabel}' as zip\n${info.label || ''}`.trim()
    });
  });

  const fileTotal = entries.length;
  let bytesDone = 0;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

  let packed = 0;
  for (const entry of entries) {
    packed += 1;
    bytesDone += Number(entry.size) || 0;
    const zipPercent = 75 + (fileTotal ? Math.round((packed / fileTotal) * 24) : 0);
    await reportProgress(singlesId, {
      percent: Math.min(99, zipPercent),
      label: `Backing up only photo album: '${resolvedLabel}' as zip\nFile ${packed} of ${fileTotal}`,
      fileIndex: packed,
      fileTotal,
      bytesDone
    });
  }

  const archive = new ZipArchive({ zlib: { level: 6 } });
  await new Promise((resolve, reject) => {
    archive.on('error', reject);
    archive.on('end', resolve);
    archive.pipe(res);
    for (const entry of entries) {
      const vaultRel = String(entry.zipPath || '');
      const archivePath = path.posix.join(VAULT_DIR_NAME, vaultRel.replace(/\\/g, '/'));
      if (entry.buffer) {
        archive.append(entry.buffer, { name: archivePath });
      } else if (entry.absPath && fs.existsSync(entry.absPath)) {
        archive.file(entry.absPath, { name: archivePath });
      }
    }
    void archive.finalize();
  });

  await reportProgress(singlesId, {
    percent: 100,
    label: `Backup complete — ${fileTotal} file${fileTotal === 1 ? '' : 's'}`,
    fileIndex: fileTotal,
    fileTotal,
    bytesDone
  });

  return { fileName: zipName, fileTotal, bytesDone };
}
