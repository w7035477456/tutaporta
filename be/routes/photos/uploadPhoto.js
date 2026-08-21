import path from 'path';
import fs from 'fs';
import os from 'os';
import sharp from 'sharp';
import crypto from 'crypto';
import pool from '../../db/connection.js';
import { sqlPhotoTypeParam } from '../../utils/pgEnumTypes.js';
import { appendPhotoThumbnailToInsert } from '../../utils/photoThumbnail.js';
import { debugMobilePhotoUpload, maskMobileUploadToken } from '../../utils/mobilePhotoUploadLog.js';
import { unlinkMemberPhotoFilesFromDisk } from '../../utils/photoFilePath.js';
import {
  ALBUM_PHOTO_EXTENSIONS_ERROR,
  contentTypeToExt as albumContentTypeToExt,
  extToContentType,
  isAllowedAlbumPhotoContentType,
  isPassthroughAlbumPhotoExtension,
  normalizePhotoExtension
} from '../../utils/albumUploadFormats.js';
import { isAdminImpersonationSession } from '../../utils/adminAuth.js';
import { resolveRegularMemberActivityTimestamp, loadLatestPhotoCreatedAt } from '../../utils/regularMemberActivityTimestamp.js';

// Max upload size from ~/.ssh/be/.env MAX_SIZE_UPLOAD_MB (legacy alias NOTES_MAX_SIZE_UPLOAD_MB), default 9 MiB.
export function getMaxUploadMb() {
  const raw = process.env.MAX_SIZE_UPLOAD_MB ?? process.env.NOTES_MAX_SIZE_UPLOAD_MB;
  const n = Number(raw);
  return Math.max(0.5, Math.min(999, Number.isFinite(n) && n > 0 ? n : 9));
}
export function getMaxUploadBytes() {
  return getMaxUploadMb() * 1024 * 1024;
}

export const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/tiff',
  'image/bmp',
  'image/svg+xml',
  'image/eps',
  'image/x-eps',
  'application/postscript',
  'image/vnd.adobe.photoshop',
  'application/x-photoshop',
  'image/x-canon-cr2',
  'image/x-nikon-nef',
  'image/x-raw',
  'application/octet-stream'
];

function logPhotoDirStats(label) {
  let folder;
  try {
    folder = getPhotoFolder();
  } catch (_) {
    folder = null;
  }
  if (!folder) {
    console.log('[uploadPhoto]', label, 'VSINGLES_PHOTO_FOLDER is not set');
    return;
  }
  try {
    const entries = fs.readdirSync(folder, { withFileTypes: true });
    const files = entries.filter((e) => e.isFile()).map((e) => e.name);
    console.log('[uploadPhoto]', label, 'folder =', folder, 'fileCount =', files.length);
    if (files.length >= 10) {
      console.log('[uploadPhoto]', 'MAX (10) photos reached in folder; new uploads should be disabled on FE.');
    }
  } catch (e) {
    console.error('[uploadPhoto]', label, 'failed to read folder', folder, e.message);
  }
}

/** Folder from VSINGLES_PHOTO_FOLDER only (~/.ssh/be/.env). Expands ~. Throws if not set. */
export function getPhotoFolder() {
  const folder = process.env.VSINGLES_PHOTO_FOLDER;
  if (!folder || typeof folder !== 'string' || !folder.trim()) {
    throw new Error('VSINGLES_PHOTO_FOLDER is not set in .env');
  }
  const t = folder.trim().replace(/\/+$/, '');
  const expanded = t.startsWith('~/') ? path.join(os.homedir(), t.slice(2)) : t;
  return expanded ? expanded + '/' : (() => { throw new Error('VSINGLES_PHOTO_FOLDER is not set in .env'); })();
}

export function contentTypeToExt(contentType, fileExtension = '') {
  const t = String(contentType || '').toLowerCase();
  if (t.includes('webm')) return 'webm';
  if (t.includes('mp4') || t.includes('quicktime')) return 'mp4';
  if (t.includes('mpeg') || t.includes('mp3')) return 'mp3';
  return albumContentTypeToExt(contentType, fileExtension);
}

async function resolveAlbumTypeColumn(client) {
  const result = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'helloworldjunktest'
       AND table_name = 'photos'
       AND column_name IN ('type', 'photo_type', 'album_type')
     ORDER BY CASE column_name
       WHEN 'type' THEN 0
       WHEN 'photo_type' THEN 1
       ELSE 2
     END
     LIMIT 1`
  );
  return result.rows[0]?.column_name || null;
}

async function resolvePhotoFileNameColumn(client) {
  const result = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'helloworldjunktest'
       AND table_name = 'photos'
       AND column_name = 'photo_file_name'
     LIMIT 1`
  );
  return result.rows[0]?.column_name || null;
}

async function resolveChecksumColumn(client) {
  const result = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'helloworldjunktest'
       AND table_name = 'photos'
       AND column_name = 'checksum'
     LIMIT 1`
  );
  return result.rows[0]?.column_name || null;
}

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function findDuplicatePhotoRows(client, singlesId, uploadedChecksum, checksumColumnName) {
  if (!checksumColumnName) return [];
  const { rows } = await client.query(
    `SELECT photos_id, photo_file_name, file_extension
     FROM helloworldjunktest.photos
     WHERE singles_id = $1
       AND checksum IS NOT NULL
       AND btrim(checksum::text) <> ''
       AND lower(btrim(checksum::text)) = $2`,
    [singlesId, uploadedChecksum.toLowerCase()]
  );
  return rows;
}

async function deleteDuplicatePhotosForSingles(client, singlesId, duplicateRows, photoFolder) {
  for (const row of duplicateRows) {
    const photosId = Number(row.photos_id);
    if (!Number.isFinite(photosId) || photosId < 1) continue;
    await client.query(
      `UPDATE helloworldjunktest.singles
       SET profile_image_fk = NULL
       WHERE singles_id = $1 AND profile_image_fk = $2`,
      [singlesId, photosId]
    );
    await client.query('DELETE FROM helloworldjunktest.photos WHERE photos_id = $1 AND singles_id = $2', [
      photosId,
      singlesId
    ]);
    unlinkMemberPhotoFilesFromDisk({
      photoFileName: row.photo_file_name,
      fileExtension: row.file_extension,
      photosId
    });
    console.log('[uploadPhoto] removed duplicate photo before re-upload', { singlesId, photosId });
  }
}

async function resolveMemberIdForSingles(client, singlesId) {
  const result = await client.query(
    `SELECT member_id
     FROM helloworldjunktest.singles
     WHERE singles_id = $1
     LIMIT 1`,
    [singlesId]
  );
  const memberIdStr = result.rows[0]?.member_id != null ? String(result.rows[0].member_id).trim() : '';
  if (memberIdStr) return memberIdStr;
  const sid = Number(singlesId);
  return Number.isFinite(sid) && sid > 0 ? String(Math.trunc(sid)) : '0';
}

async function generateUniquePhotoFileNameBase(client, singlesId) {
  const memberIdPart = await resolveMemberIdForSingles(client, singlesId);
  const base = `${memberIdPart}_${Date.now()}`;
  let candidate = base;
  let index = 0;
  while (index < 20) {
    const check = await client.query(
      `SELECT 1
       FROM helloworldjunktest.photos
       WHERE photo_file_name = $1
       LIMIT 1`,
      [candidate]
    );
    if (check.rows.length === 0) return candidate;
    index += 1;
    candidate = `${base}_${index}`;
  }
  return `${base}_${Math.floor(Math.random() * 100000)}`;
}

/** Human-readable size for logs (e.g. "314 KiB", "1.95 MiB") */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

/**
 * Resize image buffer to fit under targetBytes while keeping aspect ratio.
 * Chooses an output format that usually yields smaller files:
 * - jpeg input -> jpeg output
 * - webp input -> webp output
 * - png/gif input -> jpeg output (better size reduction)
 */
export async function resizeToFit(buffer, contentType, targetBytes) {
  const lower = String(contentType || '').toLowerCase();
  const isWebp = lower.includes('webp');
  const isJpeg = lower.includes('jpeg') || lower.includes('jpg');
  const isPng = lower.includes('png');
  // fallback: treat gif like png for resizing

  const format = isWebp ? 'webp' : isJpeg ? 'jpeg' : 'jpeg';
  const initialQuality = format === 'webp' ? 85 : 85;
  const formatOptions = format === 'webp' ? { quality: initialQuality } : { quality: initialQuality };

  const meta = await sharp(buffer).metadata();
  const w = meta.width || 1920;
  const h = meta.height || 1080;

  // Rough first guess: size ~ pixels, and quality also impacts size.
  const sizeRatio = targetBytes / buffer.length;
  const scale = Math.sqrt(Math.max(0.1, sizeRatio));
  let newW = Math.max(1, Math.round(w * scale));
  let newH = Math.max(1, Math.round(h * scale));

  // Start with a dimension-resized encode
  let out = await sharp(buffer)
    .resize(newW, newH, { fit: 'inside', withoutEnlargement: true })
    .toFormat(format, formatOptions)
    .toBuffer();

  if (out.length <= targetBytes) {
    return {
      buffer: out,
      contentType: format === 'jpeg' ? 'image/jpeg' : 'image/webp'
    };
  }

  // If still too big, reduce quality for jpeg/webp; if still too big, reduce dimensions once more.
  const qualitySteps = format === 'webp' ? [75, 65, 55, 45] : [75, 65, 55, 45];
  for (const q of qualitySteps) {
    out = await sharp(buffer)
      .resize(newW, newH, { fit: 'inside', withoutEnlargement: true })
      .toFormat(format, format === 'webp' ? { quality: q } : { quality: q })
      .toBuffer();
    if (out.length <= targetBytes) break;
  }

  if (out.length > targetBytes) {
    const scale2 = Math.sqrt(targetBytes / out.length);
    newW = Math.max(1, Math.round(newW * scale2));
    newH = Math.max(1, Math.round(newH * scale2));
    out = await sharp(buffer)
      .resize(newW, newH, { fit: 'inside', withoutEnlargement: true })
      .toFormat(format, format === 'webp' ? { quality: 60 } : { quality: 70 })
      .toBuffer();
  }

  return {
    buffer: out,
    contentType: format === 'jpeg' ? 'image/jpeg' : 'image/webp',
    inputWasPng: isPng
  };
}

/**
 * POST /api/myPhotos
 * Body (JSON): { image: "data:image/jpeg;base64,..." }
 * Auth required. Writes file to STORAGE_PHOTOS_PATH, inserts into helloworldjunktest.photos (join with singles via singles_id).
 * photos_id is the PK (nextval sequence); file_path + photos_id + '.' + file_extension is the on-disk path.
 */
export async function uploadPhoto(req, res) {
  try {
    console.log('[upload trace] 4-uploadPhoto-handler-ENTER');
    console.log('[uploadPhoto] START', {
      singlesId: req.auth?.singles_id,
      hasBody: !!req.body,
      hasImageField: !!req.body?.image
    });

    const singlesId = req.auth?.singles_id;
    if (!singlesId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let photoFolder;
    try {
      photoFolder = getPhotoFolder();
    } catch (e) {
      return res.status(500).json({ error: 'VSINGLES_PHOTO_FOLDER is not set in .env' });
    }

    const { image: dataUrl, file_extension: fileExtensionHint, originalFileName } = req.body || {};
    if (!dataUrl || typeof dataUrl !== 'string') {
      return res.status(400).json({ error: 'Missing image (data URL or base64)' });
    }

    const match = dataUrl.match(/^data:([^;]*);base64,(.+)$/);
    let contentType = match ? match[1].trim().toLowerCase() : 'image/jpeg';
    const base64 = match ? match[2] : dataUrl;
    let fileExtension = normalizePhotoExtension(fileExtensionHint);
    if (!fileExtension && originalFileName) {
      const name = String(originalFileName);
      const dot = name.lastIndexOf('.');
      if (dot > 0) fileExtension = normalizePhotoExtension(name.slice(dot + 1));
    }

    // Android often sends blank MIME or application/octet-stream — use filename extension.
    if (!contentType || contentType === 'application/octet-stream') {
      contentType = fileExtension ? extToContentType(fileExtension) : 'image/jpeg';
    }

    if (!isAllowedAlbumPhotoContentType(contentType, fileExtension)) {
      const base = contentType.split(';')[0].trim().toLowerCase();
      let illegalExt = fileExtension || 'unknown';
      if (!fileExtension && base.startsWith('image/')) {
        const sub = base.slice(6);
        illegalExt = sub.includes('+') ? sub.split('+')[0] : sub;
      } else if (!fileExtension && base.includes('/')) {
        illegalExt = base.split('/').pop() || 'unknown';
      }
      return res.status(400).json({
        error: `You upload file extension .${illegalExt} not allowed. Only allow extension are ${ALBUM_PHOTO_EXTENSIONS_ERROR}`
      });
    }

    let buffer = Buffer.from(base64, 'base64');
    let finalContentType = contentType;
    const sizeBefore = buffer.length;
    const skipUploadSizeLimit = isAdminImpersonationSession(req.auth);
    const maxMb = getMaxUploadMb();
    const maxBytes = getMaxUploadBytes();
    const targetBytes = Math.floor(maxBytes * 0.95);
    const resolvedExt = contentTypeToExt(contentType, fileExtension);
    const passthrough = isPassthroughAlbumPhotoExtension(resolvedExt);
    console.log(
      '[uploadPhoto] decoded image size:',
      sizeBefore,
      'bytes',
      `(${formatBytes(sizeBefore)})`,
      '| max allowed',
      maxBytes,
      `(${formatBytes(maxBytes)})`,
      '| process.env.MAX_SIZE_UPLOAD_MB raw=',
      JSON.stringify(process.env.MAX_SIZE_UPLOAD_MB),
      '| skipUploadSizeLimit=',
      skipUploadSizeLimit
    );
    if (!skipUploadSizeLimit && buffer.length > maxBytes) {
      if (passthrough) {
        const sizeMb = (sizeBefore / (1024 * 1024)).toFixed(2);
        return res.status(400).json({
          code: 'FILE_TOO_LARGE',
          error: `File size is ${sizeMb} mb. Maximum we allow is ${maxMb} mb`
        });
      }

      console.error(
        '[uploadPhoto] UPLOAD SIZE TOO LARGE — attempting resize. Decoded',
        sizeBefore,
        'bytes (',
        formatBytes(sizeBefore),
        ') exceeds max',
        maxBytes,
        'bytes (',
        maxMb,
        'MiB). process.env.MAX_SIZE_UPLOAD_MB=',
        JSON.stringify(process.env.MAX_SIZE_UPLOAD_MB),
        'singles_id=',
        singlesId
      );

      try {
        const resized = await resizeToFit(buffer, contentType, targetBytes);
        buffer = resized.buffer;
        finalContentType = resized.contentType;
        console.log('[uploadPhoto] AFTER resize:', buffer.length, 'bytes', `(${formatBytes(buffer.length)})`);
      } catch (resizeErr) {
        console.error('[uploadPhoto] resize failed:', resizeErr);
      }

      if (buffer.length > maxBytes) {
        console.error(
          '[uploadPhoto] resized still too large — rejected. decodedAfter=',
          buffer.length,
          'maxBytes=',
          maxBytes
        );
        const sizeMb = (sizeBefore / (1024 * 1024)).toFixed(2);
        return res.status(400).json({
          code: 'FILE_TOO_LARGE',
          error: `File size is ${sizeMb} mb. Maximum we allow is ${maxMb} mb`
        });
      }
    }

    const filePathDir = path.resolve(photoFolder);
    fs.mkdirSync(filePathDir, { recursive: true });

    const client = await pool.connect();
    let photosId;
    try {
      const albumTypeColumn = await resolveAlbumTypeColumn(client);
      const photoFileNameColumn = await resolvePhotoFileNameColumn(client);
      const checksumColumn = await resolveChecksumColumn(client);
      const uploadedChecksum = sha256Hex(buffer);
      const duplicateRows = await findDuplicatePhotoRows(client, singlesId, uploadedChecksum, checksumColumn);
      let replacedDuplicate = false;
      if (duplicateRows.length > 0) {
        await deleteDuplicatePhotosForSingles(client, singlesId, duplicateRows, filePathDir);
        replacedDuplicate = true;
      }
      req._replacedDuplicate = replacedDuplicate;
      let nextId;
      try {
        const seqResult = await client.query("SELECT nextval('helloworldjunktest.photos_id_seq') AS id");
        nextId = Number(seqResult.rows[0]?.id ?? 0);
      } catch (_) {
        const maxResult = await client.query('SELECT COALESCE(MAX(photos_id), 0) + 1 AS id FROM helloworldjunktest.photos');
        nextId = Number(maxResult.rows[0]?.id ?? 1);
      }
      if (!nextId || nextId < 1) {
        const maxResult = await client.query('SELECT COALESCE(MAX(photos_id), 0) + 1 AS id FROM helloworldjunktest.photos');
        nextId = Number(maxResult.rows[0]?.id ?? 1);
      }
      photosId = nextId; // files are 1.jpg, 2.jpg, 3.jpg by photos_id
      console.log('[uploadPhoto] assigned photos_id =', photosId, 'for singles_id =', singlesId);

      const ext = contentTypeToExt(finalContentType, fileExtension);
      const fileNameBase = photoFileNameColumn ? await generateUniquePhotoFileNameBase(client, singlesId) : `${photosId}`;
      const filename = `${fileNameBase}.${ext}`;
      const fullPath = path.join(filePathDir, filename);
      console.log('[uploadPhoto] writing file to', fullPath);
      fs.writeFileSync(fullPath, buffer);
      logPhotoDirStats('after writeFileSync');

      let optionalColumns = [];
      let optionalValues = [];
      if (photoFileNameColumn) {
        optionalColumns.push('photo_file_name');
        optionalValues.push(fileNameBase);
      }
      if (albumTypeColumn) {
        optionalColumns.push(albumTypeColumn);
        optionalValues.push('uploaded');
      }
      if (checksumColumn) {
        optionalColumns.push('checksum');
        optionalValues.push(uploadedChecksum);
      }
      const previousAt = await loadLatestPhotoCreatedAt(client, singlesId);
      const activityAt = await resolveRegularMemberActivityTimestamp(client, singlesId, { previousAt });
      if (activityAt) {
        optionalColumns.push('created_at');
        optionalValues.push(activityAt.toISOString());
      }
      ({ optionalColumns, optionalValues } = await appendPhotoThumbnailToInsert(client, {
        optionalColumns,
        optionalValues,
        buffer,
        fileNameBase,
        outputDir: filePathDir
      }));
      const insertColumns = ['photos_id', 'singles_id', 'display_order', 'file_path', 'file_extension', ...optionalColumns];
      const insertValues = [photosId, singlesId, photoFolder, ext, ...optionalValues];
      const valuePlaceholders = ['$1', '$2', '(SELECT COALESCE(MAX(display_order), -1) + 1 FROM helloworldjunktest.photos WHERE singles_id = $2)', '$3', '$4'];
      for (let idx = 0; idx < optionalValues.length; idx += 1) {
        const paramRef = `$${5 + idx}`;
        const columnName = optionalColumns[idx];
        valuePlaceholders.push(
          albumTypeColumn && columnName === albumTypeColumn ? sqlPhotoTypeParam(paramRef) : paramRef
        );
      }
      const insertSql = `
        INSERT INTO helloworldjunktest.photos (${insertColumns.join(', ')})
        VALUES (${valuePlaceholders.join(', ')})
      `;
      console.log('[uploadPhoto] inserting photos row', {
        photos_id: photosId,
        singles_id: singlesId,
        file_path: photoFolder,
        ext,
        photo_file_name: fileNameBase,
        checksum: checksumColumn ? uploadedChecksum : null
      });
      await client.query(insertSql, insertValues);
    } finally {
      client.release();
    }

    logPhotoDirStats('end of uploadPhoto handler');
    if (typeof req._afterPhotoUpload === 'function') {
      if (req._mobilePhotoUploadToken) {
        debugMobilePhotoUpload('uploadPhoto invoking mobile afterPhotoUpload hook', {
          token: maskMobileUploadToken(req._mobilePhotoUploadToken),
          singlesId: req.auth?.singles_id,
          photosId
        });
      }
      try {
        await req._afterPhotoUpload(photosId);
      } catch (afterErr) {
        // Photo is already on disk + in DB — do not fail the phone upload for session bookkeeping.
        console.error('[uploadPhoto] afterPhotoUpload hook failed (photo saved):', afterErr?.message ?? afterErr);
        if (req._mobilePhotoUploadToken) {
          debugMobilePhotoUpload('afterPhotoUpload hook FAIL (photo saved)', {
            token: maskMobileUploadToken(req._mobilePhotoUploadToken),
            singlesId: req.auth?.singles_id,
            photosId,
            message: afterErr?.message ?? String(afterErr)
          });
        }
      }
    }
    res.status(201).json({
      photos_id: photosId,
      ...(req._replacedDuplicate ? { replacedDuplicate: true } : {})
    });
  } catch (err) {
    console.error('Upload photo error:', err);
    // PostgreSQL undefined column (e.g. file_extension missing) → run migration
    if (err?.code === '42703') {
      return res.status(500).json({
        error: 'Database schema outdated. Run: psql -U <user> -d vsingles -f sql/migration_vsingles_photos_to_photos.sql',
      });
    }
    const detail = String(err?.message || '').trim();
    const safeDetail =
      detail &&
      detail.length <= 180 &&
      !/password|secret|token|ECONN|SASL|pg_/i.test(detail) &&
      !/\/Users\/|\/home\/|\\\\/i.test(detail)
        ? detail
        : '';
    res.status(500).json({
      error: safeDetail ? `Failed to upload photo: ${safeDetail}` : 'Failed to upload photo'
    });
  }
}
