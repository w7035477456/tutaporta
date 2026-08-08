import { getPhoto } from './getPhoto.js';

/** GET /api/photo/:id/thumbnail — stored JPEG when available; else full image (same auth as getPhoto). */
export async function getPhotoThumbnail(req, res) {
  req.query = { ...req.query, thumbnail: '1' };
  return getPhoto(req, res);
}
