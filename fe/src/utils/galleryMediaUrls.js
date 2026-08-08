import { getApiBaseUrl } from 'config/apiBaseUrl';

function normalizeMediaIds(list) {
  if (!Array.isArray(list)) return [];
  return list.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id >= 1);
}

/** Build /api/photo and /api/video URLs from id arrays returned by list endpoints. */
export function mediaUrlsFromPhotoAndVideoIds(photoIds, videoIds, apiBase = getApiBaseUrl()) {
  const photos = normalizeMediaIds(photoIds).map((id) => `${apiBase}/api/photo/${id}`);
  const videos = normalizeMediaIds(videoIds).map((id) => `${apiBase}/api/video/${id}`);
  return [...photos, ...videos];
}

export function publicGalleryMediaUrlsFromRow(row, apiBase = getApiBaseUrl()) {
  return mediaUrlsFromPhotoAndVideoIds(row?.public_gallery_photo_ids ?? row?.gallery_photo_ids, row?.public_gallery_video_ids ?? row?.gallery_video_ids, apiBase);
}

export function privateGalleryMediaUrlsFromRow(row, apiBase = getApiBaseUrl()) {
  return mediaUrlsFromPhotoAndVideoIds(row?.private_gallery_photo_ids, row?.private_gallery_video_ids, apiBase);
}

export function galleryMediaUrlsFromRow(row, apiBase = getApiBaseUrl()) {
  return mediaUrlsFromPhotoAndVideoIds(row?.gallery_photo_ids, row?.gallery_video_ids, apiBase);
}
