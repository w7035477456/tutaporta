import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import pool from '../db/connection.js';
import { getPhotoFolder as getPhotoFolderFromEnv } from '../utils/photoFilePath.js';
import { getPhotoFolder } from './photos/uploadPhoto.js';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);

function isImageFileName(fileName) {
  const ext = path.extname(String(fileName ?? '')).slice(1).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

function mimeLabelFromFileName(fileName) {
  const ext = path.extname(String(fileName ?? '')).slice(1).toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'JPEG image';
  if (ext === 'png') return 'PNG image';
  if (ext === 'gif') return 'GIF image';
  if (ext === 'webp') return 'WebP image';
  return ext ? `${ext.toUpperCase()} file` : 'File';
}

function contentTypeFromFileName(fileName) {
  const ext = path.extname(String(fileName ?? '')).slice(1).toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function resolveStorageFilePath(photoFolder, fileName) {
  const safeName = path.basename(String(fileName ?? '').trim());
  if (!safeName || !isImageFileName(safeName)) return null;
  const root = path.resolve(photoFolder);
  const fullPath = path.resolve(root, safeName);
  if (!fullPath.startsWith(root + path.sep) && fullPath !== root) return null;
  if (!fs.existsSync(fullPath)) return null;
  return fullPath;
}

function formatBytes(sizeBytes) {
  const n = Number(sizeBytes);
  if (!Number.isFinite(n) || n < 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatFileModified(mtimeMs) {
  const d = new Date(mtimeMs);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
    .format(d)
    .replace(',', ' at');
}

function readImageFilesFromFolder(photoFolder) {
  const dir = path.resolve(photoFolder);
  if (!fs.existsSync(dir)) {
    return { folder: dir, files: [] };
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const ent of entries) {
    if (!ent.isFile() || !isImageFileName(ent.name)) continue;
    const fullPath = path.join(dir, ent.name);
    let st;
    try {
      st = fs.statSync(fullPath);
    } catch {
      continue;
    }
    files.push({
      fileName: ent.name,
      fullPath,
      sizeBytes: st.size,
      mtimeMs: st.mtimeMs,
      sizeLabel: formatBytes(st.size),
      modifiedAt: new Date(st.mtimeMs).toISOString(),
      modifiedLabel: formatFileModified(st.mtimeMs),
      fileType: mimeLabelFromFileName(ent.name)
    });
  }
  files.sort((a, b) => b.mtimeMs - a.mtimeMs || a.fileName.localeCompare(b.fileName));
  return { folder: dir, files };
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function findDuplicateGroups(files) {
  const bySize = new Map();
  for (const file of files) {
    const size = file.sizeBytes;
    if (!bySize.has(size)) bySize.set(size, []);
    bySize.get(size).push(file);
  }

  const groups = [];
  for (const sizeGroup of bySize.values()) {
    if (sizeGroup.length < 2) continue;
    const byChecksum = new Map();
    for (const file of sizeGroup) {
      let checksum;
      try {
        checksum = await sha256File(file.fullPath);
      } catch {
        continue;
      }
      if (!byChecksum.has(checksum)) byChecksum.set(checksum, []);
      byChecksum.get(checksum).push({ ...file, checksum });
    }
    for (const checksumGroup of byChecksum.values()) {
      if (checksumGroup.length < 2) continue;
      groups.push({
        checksum: checksumGroup[0].checksum,
        sizeBytes: checksumGroup[0].sizeBytes,
        sizeLabel: checksumGroup[0].sizeLabel,
        files: checksumGroup.map(({ fullPath: _fp, ...rest }) => rest)
      });
    }
  }

  groups.sort((a, b) => {
    const nameA = a.files[0]?.fileName ?? '';
    const nameB = b.files[0]?.fileName ?? '';
    return b.files.length - a.files.length || nameA.localeCompare(nameB);
  });
  return groups;
}

function resolvePhotoFolderOrRespond(res) {
  try {
    const folder = getPhotoFolder();
    if (!folder) {
      res.status(500).json({ error: 'VSINGLES_PHOTO_FOLDER is not set in ~/.ssh/be/.env' });
      return null;
    }
    return folder;
  } catch (err) {
    res.status(500).json({ error: err?.message || 'VSINGLES_PHOTO_FOLDER is not configured' });
    return null;
  }
}

function toPublicFileRows(files) {
  return files.map(({ fullPath: _fp, ...row }) => row);
}

/**
 * GET /api/admin/photo-storage/files
 * Lists image files in VSINGLES_PHOTO_FOLDER (Backup tab).
 */
export async function getAdminPhotoStorageFiles(req, res) {
  const folder = resolvePhotoFolderOrRespond(res);
  if (!folder) return;
  try {
    const { folder: resolvedFolder, files } = readImageFilesFromFolder(folder);
    return res.json({
      folder: resolvedFolder,
      fileCount: files.length,
      files: toPublicFileRows(files)
    });
  } catch (err) {
    console.error('[getAdminPhotoStorageFiles]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to list photo storage files' });
  }
}

/**
 * GET /api/admin/photo-storage/duplicates
 * Groups files with matching byte size and SHA-256 checksum.
 */
/**
 * GET /api/admin/photo-storage/file/:fileName
 * Serves one on-disk image from VSINGLES_PHOTO_FOLDER (admin thumbnails).
 */
export async function getAdminPhotoStorageFile(req, res) {
  const folder = resolvePhotoFolderOrRespond(res);
  if (!folder) return;
  try {
    const fullPath = resolveStorageFilePath(folder, req.params.fileName);
    if (!fullPath) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.set('Content-Type', contentTypeFromFileName(req.params.fileName));
    res.set('Cache-Control', 'private, max-age=300');
    return res.sendFile(fullPath);
  } catch (err) {
    console.error('[getAdminPhotoStorageFile]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to load file' });
  }
}

export async function getAdminPhotoStorageDuplicates(req, res) {
  const folder = resolvePhotoFolderOrRespond(res);
  if (!folder) return;
  try {
    const { folder: resolvedFolder, files } = readImageFilesFromFolder(folder);
    const groups = await findDuplicateGroups(files);
    const duplicateFileCount = groups.reduce((sum, g) => sum + g.files.length, 0);
    return res.json({
      folder: resolvedFolder,
      groupCount: groups.length,
      duplicateFileCount,
      groups
    });
  } catch (err) {
    console.error('[getAdminPhotoStorageDuplicates]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to scan for duplicate photos' });
  }
}

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

function fileNameToBase(fileName) {
  const base = path.basename(String(fileName ?? '').trim());
  return base.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
}

function normalizePhotoFileNameBase(raw, fallbackId) {
  const value = String(raw ?? '').trim();
  if (!value) return String(fallbackId);
  return value.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
}

async function relationExists(schemaName, tableName) {
  const result = await pool.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = $1 AND table_name = $2
     LIMIT 1`,
    [schemaName, tableName]
  );
  return result.rows.length > 0;
}

async function resolvePostingsSchema() {
  for (const schemaName of ['helloworldjunktest', 'public']) {
    const hasPostings = await relationExists(schemaName, 'postings');
    const hasPostingPhotos = await relationExists(schemaName, 'posting_photos');
    if (hasPostings && hasPostingPhotos) return schemaName;
  }
  return 'helloworldjunktest';
}

async function findPhotosRowsForFileName(client, fileName) {
  const base = fileNameToBase(fileName);
  const byName = await client.query(
    `SELECT photos_id, singles_id, photo_file_name, file_extension
     FROM helloworldjunktest.photos
     WHERE photo_file_name = $1`,
    [base]
  );
  if (byName.rows.length) return byName.rows;
  const id = Number.parseInt(base, 10);
  if (Number.isFinite(id) && id > 0 && String(id) === base) {
    const byId = await client.query(
      `SELECT photos_id, singles_id, photo_file_name, file_extension
       FROM helloworldjunktest.photos
       WHERE photos_id = $1`,
      [id]
    );
    return byId.rows;
  }
  return [];
}

async function inferSinglesIdFromFileBase(client, base) {
  const memberPart = String(base).split('_')[0];
  const memberId = Number.parseInt(memberPart, 10);
  if (!Number.isFinite(memberId) || memberId <= 0) return null;
  const result = await client.query(`SELECT singles_id FROM helloworldjunktest.singles WHERE member_id = $1`, [memberId]);
  if (result.rows.length !== 1) return null;
  return Number(result.rows[0].singles_id);
}

function unlinkPhotoVariants(photoFolder, fileBase) {
  const removed = [];
  if (!photoFolder || !fileBase) return removed;
  for (const ext of IMAGE_EXTS) {
    const fullPath = path.join(photoFolder, `${fileBase}.${ext}`);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      removed.push(fullPath);
    }
  }
  const origBackup = path.join(photoFolder, `${fileBase}orig.jpg`);
  if (fs.existsSync(origBackup)) {
    fs.unlinkSync(origBackup);
    removed.push(origBackup);
  }
  return removed;
}

async function repointPhotoReferences(client, postingsSchema, keeperId, loserIds) {
  if (!loserIds.length) return { profileUpdates: 0, postingUpdates: 0 };
  const profileResult = await client.query(
    `UPDATE helloworldjunktest.singles
     SET profile_image_fk = $1
     WHERE profile_image_fk = ANY($2::int[])`,
    [keeperId, loserIds]
  );
  let postingUpdates = 0;
  for (const loserId of loserIds) {
    const postingResult = await client.query(
      `UPDATE ${postingsSchema}.posting_photos
       SET photo_url = regexp_replace(photo_url, '/api/photo/' || $1::text, '/api/photo/' || $2::text, 'g')
       WHERE photo_url LIKE '%/api/photo/' || $1::text || '%'`,
      [loserId, keeperId]
    );
    postingUpdates += postingResult.rowCount ?? 0;
  }
  return { profileUpdates: profileResult.rowCount ?? 0, postingUpdates };
}

async function mergeDuplicateBucket(client, postingsSchema, photoFolder, singlesId, fileEntries) {
  const photosByFile = new Map();
  for (const file of fileEntries) {
    const rows = await findPhotosRowsForFileName(client, file.fileName);
    photosByFile.set(file.fileName, rows);
  }

  const photoRows = [];
  for (const rows of photosByFile.values()) {
    for (const row of rows) {
      if (Number(row.singles_id) === Number(singlesId)) {
        photoRows.push(row);
      }
    }
  }

  const uniqueRows = [...new Map(photoRows.map((r) => [Number(r.photos_id), r])).values()];
  uniqueRows.sort((a, b) => Number(a.photos_id) - Number(b.photos_id));

  let keeperRow = uniqueRows[0] ?? null;
  if (!keeperRow && fileEntries.length) {
    const inferredBase = fileNameToBase(fileEntries[0].fileName);
    const inferredSinglesId = await inferSinglesIdFromFileBase(client, inferredBase);
    if (Number(inferredSinglesId) !== Number(singlesId)) {
      return { skipped: true, reason: 'Could not resolve keeper photo row for orphan files' };
    }
    keeperRow = null;
  }

  const keeperId = keeperRow ? Number(keeperRow.photos_id) : null;
  const loserRows = keeperRow ? uniqueRows.filter((r) => Number(r.photos_id) !== keeperId) : [];
  const loserIds = loserRows.map((r) => Number(r.photos_id));

  const keeperFileBase = keeperRow
    ? normalizePhotoFileNameBase(keeperRow.photo_file_name, keeperRow.photos_id)
    : fileNameToBase(
        [...fileEntries].sort((a, b) => a.mtimeMs - b.mtimeMs || a.fileName.localeCompare(b.fileName))[0]?.fileName
      );

  const filesToDelete = fileEntries.filter((f) => fileNameToBase(f.fileName) !== keeperFileBase);

  if (keeperId && loserIds.length) {
    await repointPhotoReferences(client, postingsSchema, keeperId, loserIds);
    await client.query(`DELETE FROM helloworldjunktest.photos WHERE photos_id = ANY($1::int[])`, [loserIds]);
  }

  const deletedFiles = [];
  for (const file of filesToDelete) {
    const base = fileNameToBase(file.fileName);
    if (base === keeperFileBase) continue;
    deletedFiles.push(...unlinkPhotoVariants(photoFolder, base));
  }

  return {
    skipped: false,
    singlesId,
    keeperPhotosId: keeperId,
    keeperFileBase,
    repointedPhotosIds: loserIds,
    deletedFiles: [...new Set(deletedFiles)],
    filesRemovedCount: filesToDelete.length
  };
}

function partitionGroupFilesBySinglesId(fileEntries, photosByFile, inferredSinglesByFile) {
  const buckets = new Map();
  const add = (singlesId, file) => {
    const sid = Number(singlesId);
    if (!Number.isFinite(sid) || sid < 1) return;
    if (!buckets.has(sid)) buckets.set(sid, []);
    const list = buckets.get(sid);
    if (!list.some((f) => f.fileName === file.fileName)) list.push(file);
  };

  for (const file of fileEntries) {
    const rows = photosByFile.get(file.fileName) ?? [];
    const ownedRows = rows.filter((r) => Number(r.singles_id) > 0);
    if (ownedRows.length) {
      for (const row of ownedRows) add(row.singles_id, file);
    } else {
      const inferred = inferredSinglesByFile.get(file.fileName);
      if (inferred) add(inferred, file);
    }
  }
  return buckets;
}

/**
 * POST /api/admin/photo-storage/duplicates/remove
 * Body: { checksum: string } — keep one file/photos_id per member, repoint DB refs, delete extras.
 */
export async function postAdminPhotoStorageRemoveDuplicates(req, res) {
  const checksum = String(req.body?.checksum ?? '')
    .trim()
    .toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(checksum)) {
    return res.status(400).json({ error: 'Invalid checksum' });
  }

  const folder = resolvePhotoFolderOrRespond(res);
  if (!folder) return;

  const photoFolder = getPhotoFolderFromEnv() || folder;

  try {
    const { files } = readImageFilesFromFolder(folder);
    const groups = await findDuplicateGroups(files);
    const group = groups.find((g) => String(g.checksum).toLowerCase() === checksum);
    if (!group || !Array.isArray(group.files) || group.files.length < 2) {
      return res.status(404).json({ error: 'Duplicate group not found or has fewer than 2 files' });
    }

    const client = await pool.connect();
    let inTransaction = false;
    try {
      await client.query('BEGIN');
      inTransaction = true;
      const postingsSchema = await resolvePostingsSchema();

      const photosByFile = new Map();
      const inferredSinglesByFile = new Map();
      for (const file of group.files) {
        const rows = await findPhotosRowsForFileName(client, file.fileName);
        photosByFile.set(file.fileName, rows);
        if (!rows.length) {
          const inferred = await inferSinglesIdFromFileBase(client, fileNameToBase(file.fileName));
          if (inferred) inferredSinglesByFile.set(file.fileName, inferred);
        }
      }

      const buckets = partitionGroupFilesBySinglesId(group.files, photosByFile, inferredSinglesByFile);
      if (buckets.size === 0) {
        await client.query('ROLLBACK');
        inTransaction = false;
        return res.status(400).json({
          error: 'Could not determine photo owner for this duplicate group (no photos rows or member prefix)'
        });
      }

      const merges = [];
      for (const [singlesId, fileEntries] of buckets) {
        if (fileEntries.length < 2) continue;
        const result = await mergeDuplicateBucket(client, postingsSchema, photoFolder, singlesId, fileEntries);
        merges.push(result);
      }

      if (!merges.some((m) => !m.skipped && (m.repointedPhotosIds?.length || m.filesRemovedCount))) {
        await client.query('ROLLBACK');
        inTransaction = false;
        return res.status(400).json({ error: 'Nothing to merge for this group' });
      }

      await client.query('COMMIT');
      inTransaction = false;

      const { folder: resolvedFolder, files: refreshedFiles } = readImageFilesFromFolder(folder);
      const refreshedGroups = await findDuplicateGroups(refreshedFiles);

      return res.json({
        ok: true,
        checksum,
        folder: resolvedFolder,
        merges,
        groups: refreshedGroups,
        groupCount: refreshedGroups.length,
        duplicateFileCount: refreshedGroups.reduce((sum, g) => sum + g.files.length, 0)
      });
    } catch (err) {
      if (inTransaction) {
        try {
          await client.query('ROLLBACK');
        } catch {
          /* ignore */
        }
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[postAdminPhotoStorageRemoveDuplicates]', err?.message ?? err);
    return res.status(500).json({ error: err?.message || 'Failed to remove duplicate photos' });
  }
}
