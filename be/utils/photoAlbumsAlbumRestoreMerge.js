import fs from 'fs';
import os from 'os';
import path from 'path';
import { Extract } from 'unzipper';

import { getOneDriveVaultFolderName } from './photoAlbumsOneDrive/oneDriveApi.js';
import {
  flushDbToUsb,
  getVaultSession,
  vaultAddNoteAttachment,
  vaultCreateNotebook,
  vaultCreateNote,
  vaultGetTree
} from './photoAlbumsUsb/vaultSession.js';
import { fileRelativePathForVariant } from './photoAlbumsAttachmentVariants.js';
import {
  VAULT_DIR_NAME,
  VAULT_FILES_DIR,
  vaultFilesRoot
} from './photoAlbumsUsb/vaultPaths.js';
import { writeEncryptedVaultFile } from './photoAlbumsUsb/vaultSession.js';

const ALBUM_MANIFEST_NAME = 'album-backup.manifest.json';

function resolveAlbumBackupVaultRoot(extractDir) {
  const candidates = [
    path.join(extractDir, getOneDriveVaultFolderName()),
    path.join(extractDir, VAULT_DIR_NAME)
  ];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, ALBUM_MANIFEST_NAME))) return root;
  }
  for (const root of candidates) {
    if (fs.existsSync(root)) return root;
  }
  return null;
}

function readAlbumBackupManifest(vaultRoot) {
  const manifestPath = path.join(vaultRoot, ALBUM_MANIFEST_NAME);
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
}

/** Pick base, base_2, base_3, … when name already exists (case-insensitive). */
export function nextAvailableAlbumDisplayName(baseName, existingNames) {
  const base = String(baseName || 'Album').trim() || 'Album';
  const taken = new Set(
    (existingNames || []).map((name) => String(name || '').trim().toLowerCase()).filter(Boolean)
  );
  if (!taken.has(base.toLowerCase())) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`.toLowerCase())) n += 1;
  return `${base}_${n}`;
}

function isAttachmentVariantBaseName(fileName) {
  return /_(1000px|thumbnail|thumb)\.[^.]+$/i.test(String(fileName || ''));
}

function listMainAttachmentFiles(vaultRoot, notebookId, noteId) {
  const dir = path.join(vaultFilesRoot(vaultRoot), String(notebookId), String(noteId));
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => {
      if (!name || name.startsWith('.')) return false;
      if (isAttachmentVariantBaseName(name)) return false;
      try {
        return fs.statSync(path.join(dir, name)).isFile();
      } catch {
        return false;
      }
    })
    .map((name) => path.join(dir, name));
}

function copyAttachmentVariants(session, srcVaultRoot, srcRelPath, destRelPath) {
  for (const variant of ['display', 'thumb']) {
    const srcVariant = fileRelativePathForVariant(srcRelPath, variant);
    const destVariant = fileRelativePathForVariant(destRelPath, variant);
    const srcAbs = path.join(vaultFilesRoot(srcVaultRoot), srcVariant.replace(/\\/g, '/'));
    if (!fs.existsSync(srcAbs)) continue;
    const buf = fs.readFileSync(srcAbs);
    writeEncryptedVaultFile(session, destVariant, buf);
  }
}

/**
 * Merge one album-backup zip into an unlocked TutaPhotoAlbums vault (Cloud or USB).
 * Album set / album names get _2, _3, … suffixes when they already exist.
 */
export async function restorePhotoAlbumsAlbumBackupZipMerge(singlesId, storageType, zipFilePath) {
  const session = getVaultSession(singlesId, storageType);
  if (!session?.mountPath) {
    throw new Error('TutaPhotoAlbums is not unlocked — open with your Encrypt Password first');
  }

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-album-restore-'));
  const extractDir = path.join(tmpRoot, 'extract');
  fs.mkdirSync(extractDir, { recursive: true });

  try {
    await fs.createReadStream(zipFilePath).pipe(Extract({ path: extractDir })).promise();

    const vaultRoot = resolveAlbumBackupVaultRoot(extractDir);
    if (!vaultRoot) {
      throw new Error('Backup zip is missing TutaPhotoAlbums album data');
    }

    const manifest = readAlbumBackupManifest(vaultRoot);
    if (!manifest || manifest.kind !== 'photo_albums_album_backup') {
      throw new Error('Backup zip is not an album backup (missing album-backup.manifest.json)');
    }

    const srcNotebookId = Number(manifest.notebookId);
    const srcNoteId = Number(manifest.noteId);
    if (!Number.isFinite(srcNotebookId) || !Number.isFinite(srcNoteId)) {
      throw new Error('Album backup manifest is missing notebookId or noteId');
    }

    const tree = vaultGetTree(session);
    const notebookNames = tree.notebooks.map((nb) => nb.notebook_name);
    const allNoteNames = tree.notebooks.flatMap((nb) => (nb.notes || []).map((n) => n.note_name));

    const sourceSetName =
      String(manifest.notebookName || '').trim() || `Set ${srcNotebookId}`;
    const sourceAlbumName =
      String(manifest.albumLabel || manifest.noteName || '').trim() || `Album ${srcNoteId}`;

    const targetSetName = nextAvailableAlbumDisplayName(sourceSetName, notebookNames);
    const targetAlbumName = nextAvailableAlbumDisplayName(sourceAlbumName, allNoteNames);

    const notebook = vaultCreateNotebook(session, targetSetName);
    const notebookId = Number(notebook.notebook_id);
    const note = await vaultCreateNote(session, notebookId, {
      noteName: targetAlbumName,
      bodyText: String(manifest.bodyText || ''),
      keywords: Array.isArray(manifest.keywords) ? manifest.keywords : undefined
    });
    const noteId = Number(note.note_id);

    let restoredFiles = 0;
    let restoredBytes = 0;

    const attachmentFiles = listMainAttachmentFiles(vaultRoot, srcNotebookId, srcNoteId);
    const manifestAttachments = Array.isArray(manifest.attachments) ? manifest.attachments : [];

    if (manifestAttachments.length) {
      for (const att of manifestAttachments) {
        const rel = String(att.relative_path || '').replace(/\\/g, '/');
        const baseName = path.basename(rel);
        const srcAbs = path.join(vaultFilesRoot(vaultRoot), String(srcNotebookId), String(srcNoteId), baseName);
        if (!fs.existsSync(srcAbs)) continue;
        const buffer = fs.readFileSync(srcAbs);
        const added = await vaultAddNoteAttachment(session, noteId, {
          buffer,
          fileName: att.file_name || baseName,
          ext: att.file_extension || path.extname(baseName).slice(1),
          mimeType: att.mime_type || undefined,
          sourceTakenAtMs: att.source_taken_at_ms
        });
        if (added?.relative_path && rel) {
          copyAttachmentVariants(session, vaultRoot, rel, added.relative_path);
        }
        restoredFiles += 1;
        restoredBytes += buffer.length;
      }
    } else {
      for (const srcAbs of attachmentFiles) {
        const buffer = fs.readFileSync(srcAbs);
        const baseName = path.basename(srcAbs);
        const ext = path.extname(baseName).slice(1) || 'bin';
        await vaultAddNoteAttachment(session, noteId, {
          buffer,
          fileName: baseName,
          ext
        });
        restoredFiles += 1;
        restoredBytes += buffer.length;
      }
    }

    flushDbToUsb(session);

    return {
      merged: true,
      restoredFiles,
      restoredBytes,
      notebookName: targetSetName,
      albumName: targetAlbumName,
      notebookId,
      noteId,
      requiresReunlock: false
    };
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}
