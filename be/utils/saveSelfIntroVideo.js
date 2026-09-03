import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { resolveTutaDatesVideoFolderForSingles } from './tutaDatesMemberPaths.js';
import { sqlPhotoTypeParam } from './pgEnumTypes.js';
import { parseMediaDataUrl } from './parseMediaDataUrl.js';
import {
  allSelfIntroVideoSlotsFull,
  assignSelfIntroVideoToFirstEmptySlot,
  loadSelfIntroVideoSlotRow
} from './selfIntroVideoSlots.js';
import { purgeOrphanSelfIntroVideosInTx } from './hardDeleteMemberSelfIntroVideo.js';
import { generateAndSaveVideoThumbnail } from './generateVideoThumbnail.js';
import { PUBLIC_VIDEO_ALBUM_MAX, countAlbumVideosInType } from './albumMediaCapacity.js';
import { duplicateVaultVideoError, findSameUserVaultVideoWithByteSize } from './duplicateVaultVideoPolicy.js';
import { resolveRegularMemberActivityTimestamp, loadLatestVideoCreatedAt } from './regularMemberActivityTimestamp.js';

export const SELF_INTRO_VIDEO_FILE_PREFIX = 'selfintro_';
export const SELF_INTRO_VIDEO_KEEP_COUNT = 3;
export const SELF_INTRO_VIDEO_MAX_BYTES = 30 * 1024 * 1024;
export const PUBLIC_VAULT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function videoContentTypeToExt(contentType) {
  const t = String(contentType || '').toLowerCase();
  if (t.includes('mpeg') || t.includes('mp3')) return 'mp3';
  if (t.includes('webm')) return 'webm';
  if (t.includes('quicktime')) return 'mov';
  if (t.includes('x-msvideo') || t.includes('avi')) return 'avi';
  if (t.includes('x-ms-wmv') || t.includes('wmv')) return 'wmv';
  if (t.includes('mp4')) return 'mp4';
  return 'mp4';
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

/** Save self intro video into Public Video Vault (type public, max 3) and intro library slot. */
export async function saveSelfIntroVideo(
  client,
  singlesId,
  dataUrl,
  { allowedContentTypes, normalizeContentType = null, maxBytes = SELF_INTRO_VIDEO_MAX_BYTES } = {}
) {
  const purgedOrphans = await purgeOrphanSelfIntroVideosInTx(client, singlesId);

  const publicVaultCount = await countAlbumVideosInType(client, singlesId, 'public');
  if (publicVaultCount >= PUBLIC_VIDEO_ALBUM_MAX) {
    throw new Error('Public Video Vault is full. Delete one video before adding another.');
  }

  const slotRow = await loadSelfIntroVideoSlotRow(client, singlesId);
  if (allSelfIntroVideoSlotsFull(slotRow)) {
    throw new Error('Public Video Vault is full. Delete one video before adding another.');
  }

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
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    throw new Error(`Video exceeds ${maxMb} MB limit`);
  }

  const duplicateVideo = await findSameUserVaultVideoWithByteSize(client, singlesId, buffer.length);
  if (duplicateVideo) {
    throw duplicateVaultVideoError();
  }

  const videoFolder = await resolveTutaDatesVideoFolderForSingles(singlesId);
  if (!videoFolder) {
    throw new Error('Tuta Dates video storage not configured');
  }

  const filePathDir = path.resolve(videoFolder.replace(/\/+$/, ''));
  fs.mkdirSync(filePathDir, { recursive: true });

  const videoId = await nextVideoId(client);
  const ext = videoContentTypeToExt(contentType || 'video/webm');
  const timestamp = Date.now();
  const videoFileName = `${SELF_INTRO_VIDEO_FILE_PREFIX}${singlesId}_${timestamp}`;
  const filename = `${videoFileName}.${ext}`;
  const fullPath = path.join(filePathDir, filename);
  fs.writeFileSync(fullPath, buffer);

  const uploadedChecksum = sha256Hex(buffer);
  const videoThumbnail = await generateAndSaveVideoThumbnail({
    videoFullPath: fullPath,
    videoFileName,
    outputDir: filePathDir
  });

  const previousAt = await loadLatestVideoCreatedAt(client, singlesId);
  const activityAt = await resolveRegularMemberActivityTimestamp(client, singlesId, { previousAt });

  await client.query(
    `INSERT INTO helloworldjunktest.videos
       (video_id, singles_id, file_path, file_extension, type, video_file_name, checksum, video_thumbnail${
         activityAt ? ', created_at' : ''
       })
     VALUES ($1, $2, $3, $4, ${sqlPhotoTypeParam('$5')}, $6, $7, $8${activityAt ? ', $9' : ''})`,
    activityAt
      ? [videoId, singlesId, videoFolder, ext, 'public', videoFileName, uploadedChecksum, videoThumbnail, activityAt.toISOString()]
      : [videoId, singlesId, videoFolder, ext, 'public', videoFileName, uploadedChecksum, videoThumbnail]
  );

  const assigned = await assignSelfIntroVideoToFirstEmptySlot(client, singlesId, videoId);

  return {
    videoId,
    videoFileName,
    fileExtension: ext,
    slot: assigned.slot,
    slotColumn: assigned.column,
    purgedOrphans
  };
}
