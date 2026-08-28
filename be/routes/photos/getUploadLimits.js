/**
 * GET /api/myPhotos/uploadLimits
 * Returns max upload size (MiB) from ~/.ssh/be/.env NOTES_MAX_SIZE_UPLOAD_MB — same as uploadPhoto.js.
 * When ~/.ssh/be/.env has DEBUG_PHOTO_INFO=true (or 1/yes), debugPhotoInfo is true so the FE can show extra UI (e.g. filenames).
 */
import { getMaxUploadMb, getMaxVideoUploadMb } from './uploadPhoto.js';

function envTruthy(v) {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

export function getUploadLimits(req, res) {
  const maxMb = getMaxUploadMb();
  const videoMaxMb = getMaxVideoUploadMb();
  const debugPhotoInfo = envTruthy(process.env.DEBUG_PHOTO_INFO);
  res.json({ maxUploadMb: maxMb, videoMaxUploadMb: videoMaxMb, debugPhotoInfo });
}
