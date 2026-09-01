import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getPhotoFolder } from './photoFilePath.js';
import { getVideoFolder, unlinkMemberVideoFilesFromDisk } from './videoFilePath.js';
import { sqlPhotoTypeParam } from './pgEnumTypes.js';
import { parseMediaDataUrl } from './parseMediaDataUrl.js';
import { generateAndSaveVideoThumbnail } from './generateVideoThumbnail.js';

export const RECORD4SUPPORT_FILE_PREFIX = 'record4support_';

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function videoContentTypeToExt(contentType) {
  const t = String(contentType || '').toLowerCase();
  if (t.includes('webm')) return 'webm';
  if (t.includes('mp4') || t.includes('quicktime')) return 'mp4';
  if (t.includes('mpeg') || t.includes('mp3')) return 'mp3';
  return 'webm';
}

async function nextVideoId(client) {
  try {
    const seqResult = await client.query("SELECT nextval('helloworldjunktest.video_id_seq') AS id");
    const nextId = Number(seqResult.rows[0]?.id ?? 0);
    if (Number.isFinite(nextId) && nextId > 0) return nextId;
  } catch {
    // fall through
  }
  const maxResult = await client.query('SELECT COALESCE(MAX(video_id), 0) + 1 AS id FROM helloworldjunktest.videos');
  return Number(maxResult.rows[0]?.id ?? 1);
}

/**
 * Remove prior record4support_* rows (and on-disk files) for one member.
 * @param {import('pg').PoolClient} client
 */
export async function deletePriorRecord4SupportVideos(client, singlesId) {
  const { rows } = await client.query(
    `SELECT video_id, video_file_name, file_extension, file_path
     FROM helloworldjunktest.videos
     WHERE singles_id = $1
       AND video_file_name LIKE $2`,
    [singlesId, `${RECORD4SUPPORT_FILE_PREFIX}%`]
  );

  for (const row of rows) {
    unlinkMemberVideoFilesFromDisk(row);
    await client.query('DELETE FROM helloworldjunktest.videos WHERE video_id = $1 AND singles_id = $2', [
      row.video_id,
      singlesId
    ]);
  }
}

/**
 * Save live face scan support video as record4support_{singles_id}_{timestamp}.webm (overwrites prior).
 * @returns {Promise<{ videoId: number, videoFileName: string, fileExtension: string }>}
 */
export async function saveRecord4SupportVideo(
  client,
  singlesId,
  dataUrl,
  { allowedContentTypes, normalizeContentType = null, maxBytes = 25 * 1024 * 1024 } = {}
) {
  const parsed = parseMediaDataUrl(dataUrl);
  if (!parsed) {
    throw new Error('Invalid video data URL');
  }

  const contentType = normalizeContentType ? normalizeContentType(parsed.contentType) : parsed.contentType;
  if (allowedContentTypes?.size && !allowedContentTypes.has(contentType)) {
    throw new Error(`Unsupported video type: ${contentType}`);
  }

  const buffer = Buffer.from(parsed.base64, 'base64');
  if (!buffer.length) {
    throw new Error('Empty video file');
  }
  if (buffer.length > maxBytes) {
    throw new Error('Video exceeds 25 MB limit');
  }

  const videoFolder = getVideoFolder() || getPhotoFolder();
  if (!videoFolder) {
    throw new Error('TUTADATES_VIDEO_FOLDER or TUTADATES_PHOTO_FOLDER not configured');
  }

  await deletePriorRecord4SupportVideos(client, singlesId);

  const filePathDir = path.resolve(videoFolder.replace(/\/+$/, ''));
  fs.mkdirSync(filePathDir, { recursive: true });

  const videoId = await nextVideoId(client);
  const ext = videoContentTypeToExt(contentType || 'video/webm');
  const timestamp = Date.now();
  const videoFileName = `${RECORD4SUPPORT_FILE_PREFIX}${singlesId}_${timestamp}`;
  const filename = `${videoFileName}.${ext}`;
  const fullPath = path.join(filePathDir, filename);
  fs.writeFileSync(fullPath, buffer);

  const uploadedChecksum = sha256Hex(buffer);
  const videoThumbnail = await generateAndSaveVideoThumbnail({
    videoFullPath: fullPath,
    videoFileName,
    outputDir: filePathDir
  });

  await client.query(
    `INSERT INTO helloworldjunktest.videos
       (video_id, singles_id, file_path, file_extension, type, video_file_name, checksum, video_thumbnail)
     VALUES ($1, $2, $3, $4, ${sqlPhotoTypeParam('$5')}, $6, $7, $8)`,
    [videoId, singlesId, videoFolder, ext, 'uploaded', videoFileName, uploadedChecksum, videoThumbnail]
  );

  return { videoId, videoFileName, fileExtension: ext };
}
