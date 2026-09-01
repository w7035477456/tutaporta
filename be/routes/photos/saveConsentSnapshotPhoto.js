import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { contentTypeToExt, getPhotoFolder } from './uploadPhoto.js';
import { watermarkConsentImageBuffer } from '../../utils/watermarkConsentImage.js';
import { deletePriorSystemPhotosByPrefix } from '../../utils/deleteSystemPhotos.js';
import { appendPhotoThumbnailToInsert } from '../../utils/photoThumbnail.js';
import { sqlPhotoTypeParam } from '../../utils/pgEnumTypes.js';

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function parseDataUrl(dataUrl) {
  const raw = String(dataUrl ?? '').trim();
  const match = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    contentType: match[1].trim().toLowerCase(),
    base64: match[2]
  };
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

/**
 * Saves a consent snapshot PNG to TUTADATES_PHOTO_FOLDER and inserts helloworldjunktest.photos row.
 * Returns photos_id for linking from consent_record image FK columns.
 */
export async function saveConsentSnapshotPhoto(
  client,
  singlesId,
  dataUrl,
  {
    fileNamePrefix = 'consent_sig_',
    clientIp,
    recordedAt,
    watermarkTitleLine,
    watermarkStrokeColor,
    watermarkStrokeWidthRatio
  } = {}
) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    throw new Error('Invalid consent snapshot image');
  }

  let buffer = Buffer.from(parsed.base64, 'base64');
  if (!buffer.length) {
    throw new Error('Empty consent snapshot image');
  }

  buffer = await watermarkConsentImageBuffer(buffer, {
    clientIp,
    recordedAt: recordedAt || new Date(),
    titleLine: watermarkTitleLine,
    strokeColor: watermarkStrokeColor,
    strokeWidthRatio: watermarkStrokeWidthRatio
  });

  await deletePriorSystemPhotosByPrefix(client, singlesId, fileNamePrefix);

  const photoFolder = getPhotoFolder();
  const filePathDir = path.resolve(photoFolder);
  fs.mkdirSync(filePathDir, { recursive: true });

  const photosId = await nextPhotosId(client);
  const ext = contentTypeToExt(parsed.contentType || 'image/png');
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
