import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { contentTypeToExt, getPhotoFolder } from '../photos/uploadPhoto.js';
import { getVideoFolder } from '../../utils/videoFilePath.js';
import { sqlPhotoTypeParam } from '../../utils/pgEnumTypes.js';
import { parseMediaDataUrl } from '../../utils/parseMediaDataUrl.js';
import { generateAndSaveVideoThumbnail } from '../../utils/generateVideoThumbnail.js';

const ALLOWED_VIDEO_CONTENT_TYPES = new Set([
  'video/webm',
  'video/mp4',
  'video/quicktime',
  'audio/mpeg',
  'audio/mp3'
]);

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function videoContentTypeToExt(contentType) {
  const t = String(contentType || '').toLowerCase();
  if (t.includes('mpeg') || t.includes('mp3')) return 'mp3';
  if (t.includes('webm')) return 'webm';
  if (t.includes('mp4') || t.includes('quicktime')) return 'mp4';
  return contentTypeToExt(contentType);
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
 * Saves consent video to VSINGLES_VIDEO_FOLDER (or VSINGLES_PHOTO_FOLDER fallback) and inserts videos row.
 * File base name: video_{singles_id}_{Date.now()}
 * @returns {Promise<number>} video_id
 */
export async function saveConsentVideoFile(
  client,
  singlesId,
  dataUrl,
  { allowedContentTypes = ALLOWED_VIDEO_CONTENT_TYPES, normalizeContentType = null } = {}
) {
  const parsed = parseMediaDataUrl(dataUrl);
  if (!parsed) {
    throw new Error('Invalid consent video data URL');
  }
  const contentType = normalizeContentType
    ? normalizeContentType(parsed.contentType)
    : parsed.contentType;
  if (allowedContentTypes.size && !allowedContentTypes.has(contentType)) {
    throw new Error(`Unsupported consent video type: ${contentType}`);
  }

  const buffer = Buffer.from(parsed.base64, 'base64');
  if (!buffer.length) {
    throw new Error('Empty consent video file');
  }

  const videoFolder = getVideoFolder() || getPhotoFolder();
  if (!videoFolder) {
    throw new Error('VSINGLES_VIDEO_FOLDER or VSINGLES_PHOTO_FOLDER not configured');
  }
  const filePathDir = path.resolve(videoFolder.replace(/\/+$/, ''));
  fs.mkdirSync(filePathDir, { recursive: true });

  const videoId = await nextVideoId(client);
  const ext = videoContentTypeToExt(contentType || 'video/webm');
  const fileNameBase = `video_${singlesId}_${Date.now()}`;
  const filename = `${fileNameBase}.${ext}`;
  const fullPath = path.join(filePathDir, filename);
  fs.writeFileSync(fullPath, buffer);

  const uploadedChecksum = sha256Hex(buffer);
  const videoThumbnail = await generateAndSaveVideoThumbnail({
    videoFullPath: fullPath,
    videoFileName: fileNameBase,
    outputDir: filePathDir
  });

  await client.query(
    `INSERT INTO helloworldjunktest.videos
       (video_id, singles_id, file_path, file_extension, type, video_file_name, checksum, video_thumbnail)
     VALUES ($1, $2, $3, $4, ${sqlPhotoTypeParam('$5')}, $6, $7, $8)`,
    [videoId, singlesId, videoFolder, ext, 'uploaded', fileNameBase, uploadedChecksum, videoThumbnail]
  );

  return videoId;
}
