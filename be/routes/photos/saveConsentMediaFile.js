import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { contentTypeToExt } from './uploadPhoto.js';
import { resolveTutaDatesPhotoFolderForSingles } from '../../utils/tutaDatesMemberPaths.js';
import { sqlPhotoTypeParam } from '../../utils/pgEnumTypes.js';
import { parseMediaDataUrl } from '../../utils/parseMediaDataUrl.js';
import { deletePriorSystemPhotosByPrefix } from '../../utils/deleteSystemPhotos.js';
import { appendPhotoThumbnailToInsert } from '../../utils/photoThumbnail.js';

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
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

async function nextPhotosId(client) {
  try {
    const seqResult = await client.query("SELECT nextval('helloworldjunktest.photos_id_seq') AS id");
    const nextId = Number(seqResult.rows[0]?.id ?? 0);
    if (Number.isFinite(nextId) && nextId > 0) return nextId;
  } catch {
    // fall through
  }
  const maxResult = await client.query('SELECT COALESCE(MAX(photos_id), 0) + 1 AS id FROM helloworldjunktest.photos');
  return Number(maxResult.rows[0]?.id ?? 1);
}

const ALLOWED_CONSENT_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif'
]);

/**
 * Saves consent images to TUTADATES_PHOTO_FOLDER and inserts photos row.
 * Video (webm/mp4/mp3) must use saveConsentVideoFile → helloworldjunktest.videos.
 * @returns {Promise<number>} photos_id
 */
export async function saveConsentMediaFile(
  client,
  singlesId,
  dataUrl,
  {
    fileNamePrefix = 'consent_media_',
    allowedContentTypes = ALLOWED_CONSENT_IMAGE_TYPES,
    normalizeContentType = null
  } = {}
) {
  const parsed = parseMediaDataUrl(dataUrl);
  if (!parsed) {
    throw new Error('Invalid consent media data URL');
  }
  const contentType = normalizeContentType
    ? normalizeContentType(parsed.contentType)
    : parsed.contentType;
  if (allowedContentTypes.size && !allowedContentTypes.has(contentType)) {
    throw new Error(`Unsupported consent media type: ${contentType}`);
  }

  const buffer = Buffer.from(parsed.base64, 'base64');
  if (!buffer.length) {
    throw new Error('Empty consent media file');
  }

  await deletePriorSystemPhotosByPrefix(client, singlesId, fileNamePrefix);

  const photoFolder = await resolveTutaDatesPhotoFolderForSingles(singlesId);
  const filePathDir = path.resolve(photoFolder);
  fs.mkdirSync(filePathDir, { recursive: true });

  const photosId = await nextPhotosId(client);
  const ext = contentTypeToExt(contentType || 'video/webm');
  const memberIdPart = await resolveMemberIdForSingles(client, singlesId);
  const fileNameBase = `${fileNamePrefix}${memberIdPart}_${Date.now()}`;
  const filename = `${fileNameBase}.${ext}`;
  const fullPath = path.join(filePathDir, filename);
  fs.writeFileSync(fullPath, buffer);

  const albumTypeColumn = await resolveAlbumTypeColumn(client);
  const photoFileNameColumn = await resolvePhotoFileNameColumn(client);
  const checksumColumn = await resolveChecksumColumn(client);
  const uploadedChecksum = sha256Hex(buffer);

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

  ({ optionalColumns, optionalValues } = await appendPhotoThumbnailToInsert(client, {
    optionalColumns,
    optionalValues,
    buffer,
    fileNameBase,
    outputDir: filePathDir
  }));

  const insertColumns = ['photos_id', 'singles_id', 'display_order', 'file_path', 'file_extension', ...optionalColumns];
  const insertValues = [photosId, singlesId, photoFolder, ext, ...optionalValues];
  const valuePlaceholders = [
    '$1',
    '$2',
    '(SELECT COALESCE(MAX(display_order), -1) + 1 FROM helloworldjunktest.photos WHERE singles_id = $2)',
    '$3',
    '$4'
  ];
  for (let idx = 0; idx < optionalValues.length; idx += 1) {
    const paramRef = `$${5 + idx}`;
    const columnName = optionalColumns[idx];
    valuePlaceholders.push(
      albumTypeColumn && columnName === albumTypeColumn ? sqlPhotoTypeParam(paramRef) : paramRef
    );
  }

  await client.query(
    `INSERT INTO helloworldjunktest.photos (${insertColumns.join(', ')})
     VALUES (${valuePlaceholders.join(', ')})`,
    insertValues
  );

  return photosId;
}
