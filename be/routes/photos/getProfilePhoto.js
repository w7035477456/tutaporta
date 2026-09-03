import fs from 'fs';
import pool from '../../db/connection.js';
import { extToContentType } from '../../utils/albumUploadFormats.js';
import {
  buildPhotoSearchFolders,
  getPhotoFolder,
  resolvePhotoFilePathInFolders
} from '../../utils/photoFilePath.js';
import { loadMemberIdForSinglesOrFallback } from '../../utils/tutaDatesMemberPaths.js';

function getBrowserPhotoCacheMaxAgeSeconds() {
  const raw = Number.parseInt(String(process.env.PHOTO_BROWSER_CACHE_MAX_AGE_SEC ?? ''), 10);
  if (Number.isFinite(raw)) return Math.max(0, Math.min(31536000, raw));
  return 300;
}

function getPhotoCacheControlHeaderValue() {
  const forever = ['1', 'true', 'yes', 'y', 'on'].includes(String(process.env.PHOTO_BROWSER_CACHE_FOREVER ?? '').trim().toLowerCase());
  if (forever) return 'private, max-age=31536000, immutable';
  return `private, max-age=${getBrowserPhotoCacheMaxAgeSeconds()}`;
}

export async function getProfilePhoto(req, res) {
  try {
    const authSinglesId = Number(req.auth?.singles_id);
    if (!Number.isFinite(authSinglesId) || authSinglesId < 1) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const targetSinglesId = Number.parseInt(String(req.params.singlesId ?? ''), 10);
    if (!Number.isFinite(targetSinglesId) || targetSinglesId < 1) {
      return res.status(400).json({ error: 'Invalid singles id' });
    }

    const result = await pool.query(
      `SELECT s.profile_image_fk, s.member_id, p.file_extension, p.photo_file_name, p.file_path, p.singles_id AS photo_owner_id
       FROM helloworldjunktest.singles s
       LEFT JOIN helloworldjunktest.photos p ON p.photos_id = s.profile_image_fk
       WHERE s.singles_id = $1
       LIMIT 1`,
      [targetSinglesId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const row = result.rows[0];
    const profilePhotoId = Number(row.profile_image_fk);
    if (!Number.isFinite(profilePhotoId) || profilePhotoId < 1) {
      return res.status(404).json({ error: 'Profile photo not found' });
    }
    // Safety: profile_image_fk must resolve to a photo owned by that same user.
    if (Number(row.photo_owner_id) !== targetSinglesId) {
      return res.status(404).json({ error: 'Profile photo not found' });
    }

    const ext = String(row.file_extension || 'jpg').replace(/^\./, '');
    const memberId = row.member_id ?? (await loadMemberIdForSinglesOrFallback(targetSinglesId));
    const searchFolders = buildPhotoSearchFolders({ filePathFromDb: row.file_path, memberId });
    if (!searchFolders.length && !getPhotoFolder()) {
      return res.status(500).json({ error: 'Tuta Dates photo storage not configured in ~/.ssh/be/.env' });
    }

    const resolved = resolvePhotoFilePathInFolders(searchFolders, row.photo_file_name, profilePhotoId, ext);
    if (!resolved) {
      return res.status(404).json({ error: 'Profile photo file not found' });
    }
    const st = fs.statSync(resolved);
    const etag = `"${st.mtimeMs}-${st.size}"`;
    res.set('ETag', etag);
    res.set('Last-Modified', st.mtime.toUTCString());
    res.set('Cache-Control', getPhotoCacheControlHeaderValue());
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    const contentType = extToContentType(ext);
    res.set('Content-Type', contentType);
    return res.sendFile(resolved);
  } catch (error) {
    console.error('Error serving profile photo:', error);
    return res.status(500).json({ error: 'Failed to load profile photo' });
  }
}
