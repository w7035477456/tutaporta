import path from 'path';
import fs from 'fs';
import pool from '../../db/connection.js';
import { extToContentType } from '../../utils/albumUploadFormats.js';
import { getPhotoFolder, resolvePhotoFilePath } from '../../utils/photoFilePath.js';
import { resolvePhotoThumbnailPath } from '../../utils/photoThumbnail.js';
import { resolveRequestsAppSchema } from '../singles/resolveRequestsAppSchema.js';
import { logMyStoryPhotos, logMyStoryPhotosAlways, myStoryPhotoDebugEnabled } from '../../utils/myStoryPhotoDebug.js';
import { recordPhotoCacheResult } from '../../utils/photoCacheStats.js';
import { sqlBooleanEnumIsTrue } from '../../utils/booleanEnum.js';

function normalizeAlbumType(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'public' || raw === 'private' || raw === 'deleted' || raw === 'uploaded') return raw;
  return 'uploaded';
}

function getBrowserPhotoCacheMaxAgeSeconds() {
  const raw = Number.parseInt(String(process.env.PHOTO_BROWSER_CACHE_MAX_AGE_SEC ?? ''), 10);
  if (Number.isFinite(raw)) return Math.max(0, Math.min(31536000, raw));
  return 300;
}

function getClientIp(req) {
  return (
    req.ip ||
    (typeof req.headers['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'].split(',')[0].trim() : '') ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

function getPhotoCacheControlHeaderValue() {
  const forever = ['1', 'true', 'yes', 'y', 'on'].includes(String(process.env.PHOTO_BROWSER_CACHE_FOREVER ?? '').trim().toLowerCase());
  if (forever) return 'private, max-age=31536000, immutable';
  return `private, max-age=${getBrowserPhotoCacheMaxAgeSeconds()}`;
}

function isApprovedValue(value) {
  if (value === true || value === 1) return true;
  const text = String(value ?? '').trim().toLowerCase();
  return ['approve', 'approved', 'true', '1', 't', 'yes', 'y'].includes(text);
}

async function relationExists(schemaName, tableName) {
  const result = await pool.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = $1
       AND table_name = $2
     LIMIT 1`,
    [schemaName, tableName]
  );
  return result.rows.length > 0;
}

async function resolvePostingsSchema() {
  const candidates = ['helloworldjunktest', 'public'];
  for (const schemaName of candidates) {
    const hasPostings = await relationExists(schemaName, 'postings');
    const hasPostingPhotos = await relationExists(schemaName, 'posting_photos');
    if (hasPostings && hasPostingPhotos) return schemaName;
  }
  return 'helloworldjunktest';
}

async function resolvePostingVisibilityColumn(postingsSchema) {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = 'postings'
       AND column_name IN ('posting_visibility', 'is_private', 'post_visibility', 'visibility', 'audience', 'is_public')
     ORDER BY CASE column_name
       WHEN 'posting_visibility' THEN 0
       WHEN 'is_private' THEN 1
       WHEN 'post_visibility' THEN 2
       WHEN 'visibility' THEN 3
       WHEN 'audience' THEN 4
       ELSE 5
     END
     LIMIT 1`,
    [postingsSchema]
  );
  return result.rows[0]?.column_name || null;
}

function postingVisibilityExpr(postingVisibilityColumn, alias = 'p') {
  if (!postingVisibilityColumn) return "'public'";
  if (postingVisibilityColumn === 'is_private') {
    return `CASE WHEN ${sqlBooleanEnumIsTrue(alias, 'is_private')} THEN 'mySelf' ELSE 'public' END`;
  }
  if (postingVisibilityColumn === 'is_public') {
    return `CASE WHEN ${sqlBooleanEnumIsTrue(alias, 'is_public')} THEN 'public' ELSE 'mySelf' END`;
  }
  return `CASE
    WHEN LOWER(COALESCE(${alias}.${postingVisibilityColumn}::text, 'public')) = 'public' THEN 'public'
    WHEN LOWER(COALESCE(${alias}.${postingVisibilityColumn}::text, 'public')) = 'friends' THEN 'friends'
    WHEN LOWER(COALESCE(${alias}.${postingVisibilityColumn}::text, 'public')) IN ('myself', 'me_only', 'me-only', 'private') THEN 'mySelf'
    ELSE 'public'
  END`;
}

async function requestColumns(schemaName) {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = 'requests'`,
    [schemaName]
  );
  return new Set(result.rows.map((r) => r.column_name));
}

function pickFullBioExpr(columns) {
  if (columns.has('full_bio_request')) return `LOWER(BTRIM(COALESCE(r.full_bio_request::text, 'notrequested')))`;
  return `'notrequested'`;
}

async function canViewTargetFullBio(requestSchema, viewerSinglesId, ownerSinglesId) {
  if (Number(viewerSinglesId) === Number(ownerSinglesId)) return true;
  const cols = await requestColumns(requestSchema);
  const fullExpr = pickFullBioExpr(cols);
  const result = await pool.query(
    `SELECT
       COALESCE(MAX(CASE WHEN (${fullExpr}) = 'requested' THEN 1 ELSE 0 END), 0) AS has_full
     FROM ${requestSchema}.requests r
     WHERE (r.singles_id_from = $1 AND r.singles_id_to = $2)
        OR (r.singles_id_from = $2 AND r.singles_id_to = $1)`,
    [viewerSinglesId, ownerSinglesId]
  );
  return Number(result.rows[0]?.has_full ?? 0) > 0;
}

/** Buddy access: Full Bio approved (brief-only does not qualify). */
async function canViewTargetFriendsPosts(requestSchema, viewerSinglesId, ownerSinglesId) {
  if (Number(viewerSinglesId) === Number(ownerSinglesId)) return true;
  const result = await pool.query(
    `SELECT 1
     FROM ${requestSchema}.requests r
     WHERE (
       (r.singles_id_from = $1 AND r.singles_id_to = $2)
       OR (r.singles_id_from = $2 AND r.singles_id_to = $1)
     )
       AND LOWER(COALESCE(r.full_bio_request_approval::text, '')) IN ('approve','approved','true','1','t','yes','y')
     LIMIT 1`,
    [viewerSinglesId, ownerSinglesId]
  );
  return result.rows.length > 0;
}

async function isPostingPhotoForOwner(postingsSchema, photoId, ownerSinglesId, viewerSinglesId, requestSchema) {
  const postingVisibilityColumn = await resolvePostingVisibilityColumn(postingsSchema);
  const visibilityExpr = postingVisibilityExpr(postingVisibilityColumn, 'p');
  const hasFullBioAccess = await canViewTargetFullBio(requestSchema, viewerSinglesId, ownerSinglesId);
  const hasFriendsAccess = await canViewTargetFriendsPosts(requestSchema, viewerSinglesId, ownerSinglesId);
  const visibilityWhere = hasFullBioAccess
    ? `(${visibilityExpr}) <> 'mySelf'`
    : hasFriendsAccess
      ? `(${visibilityExpr}) IN ('public','friends')`
      : `(${visibilityExpr}) = 'public'`;
  const result = await pool.query(
    `SELECT 1
     FROM ${postingsSchema}.posting_photos pp
     JOIN ${postingsSchema}.postings p ON p.post_id = pp.post_id
     WHERE p.singles_id = $2
       AND ${visibilityWhere}
       AND pp.photo_url ~ ('/api/photo/' || $1::text || '([?#].*)?$')
     LIMIT 1`,
    [photoId, ownerSinglesId]
  );
  return result.rows.length > 0;
}

async function canViewPhotoViaPosting(viewerSinglesId, ownerSinglesId, photoId) {
  if (Number(viewerSinglesId) === Number(ownerSinglesId)) return true;
  const [requestSchema, postingsSchema] = await Promise.all([resolveRequestsAppSchema(), resolvePostingsSchema()]);
  const postingLinked = await isPostingPhotoForOwner(postingsSchema, photoId, ownerSinglesId, viewerSinglesId, requestSchema);
  return postingLinked;
}

async function resolveAlbumTypeColumn() {
  const result = await pool.query(
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

async function resolveRequestApprovalColumns(schemaName) {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = 'requests'
       AND column_name IN (
         'brief_bio_request_approval',
         'full_bio_request_approval'
       )`,
    [schemaName]
  );
  const set = new Set(result.rows.map((r) => r.column_name));
  return {
    basic: set.has('brief_bio_request_approval') ? 'brief_bio_request_approval' : null,
    detail: set.has('full_bio_request_approval') ? 'full_bio_request_approval' : null
  };
}

async function canViewPrivatePhoto(viewerSinglesId, ownerSinglesId) {
  if (Number(viewerSinglesId) === Number(ownerSinglesId)) return true;
  const requestSchema = await resolveRequestsAppSchema();
  const approvalCols = await resolveRequestApprovalColumns(requestSchema);
  if (!approvalCols.basic && !approvalCols.detail) return false;
  const selectCols = [
    approvalCols.basic ? `r.${approvalCols.basic} AS basic_approval` : 'NULL AS basic_approval',
    approvalCols.detail ? `r.${approvalCols.detail} AS detail_approval` : 'NULL AS detail_approval'
  ].join(', ');
  const result = await pool.query(
    `SELECT ${selectCols}
     FROM ${requestSchema}.requests r
     WHERE r.singles_id_from = $1
       AND r.singles_id_to = $2
     ORDER BY COALESCE(r.updated_at, r.created_at) DESC
     LIMIT 1`,
    [viewerSinglesId, ownerSinglesId]
  );
  const row = result.rows[0];
  // Buddies Photo Album: Full Bio approved only (brief does not qualify).
  return isApprovedValue(row?.detail_approval);
}

async function isProfilePhoto(photoId, ownerSinglesId) {
  const result = await pool.query(
    `SELECT 1
     FROM helloworldjunktest.singles
     WHERE singles_id = $1
       AND profile_image_fk = $2
     LIMIT 1`,
    [ownerSinglesId, photoId]
  );
  return result.rows.length > 0;
}

export async function getPhoto(req, res) {
  try {
    const authSinglesId = Number(req.auth?.singles_id);
    if (!Number.isFinite(authSinglesId) || authSinglesId < 1) {
      logMyStoryPhotosAlways('[getPhoto] 401', { reason: 'no auth singles_id' });
      return res.status(401).json({ error: 'Authentication required' });
    }

    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id < 1) {
      logMyStoryPhotosAlways('[getPhoto] 400 bad id', { raw: req.params.id });
      return res.status(400).json({ error: 'Invalid photo id' });
    }

    logMyStoryPhotos('[getPhoto] request', { id, authSinglesId, ifNoneMatch: req.headers['if-none-match'] ?? null });

    const wantThumbnail = String(req.query?.thumbnail ?? '').trim() === '1' || String(req.path ?? '').includes('/thumbnail');
    const albumTypeColumn = await resolveAlbumTypeColumn();
    const row = await pool.query(
      `SELECT file_extension, singles_id, photo_file_name, photo_thumbnail, file_path${
        albumTypeColumn ? `, ${albumTypeColumn}::text AS album_type_raw` : ''
      }
       FROM helloworldjunktest.photos
       WHERE photos_id = $1
       LIMIT 1`,
      [id]
    );

    if (row.rows.length === 0) {
      logMyStoryPhotosAlways('[getPhoto] 404 no photos row', { id, authSinglesId });
      return res.status(404).json({ error: 'Photo not found' });
    }

    const {
      file_extension: fileExt,
      singles_id: photoOwnerId,
      photo_file_name: photoFileName,
      photo_thumbnail: photoThumbnail,
      file_path: filePathFromDb
    } = row.rows[0];
    const albumType = normalizeAlbumType(row.rows[0]?.album_type_raw);
    if (Number(photoOwnerId) !== authSinglesId) {
      const canViewPublic = albumType === 'public' || (await isProfilePhoto(id, Number(photoOwnerId)));
      if (!canViewPublic) {
        const allowPostingPhoto = await canViewPhotoViaPosting(authSinglesId, Number(photoOwnerId), id);
        if (allowPostingPhoto) {
          // Photo is referenced by a posting visible to this viewer.
        } else if (albumType === 'private') {
          const allowPrivate = await canViewPrivatePhoto(authSinglesId, Number(photoOwnerId));
          if (!allowPrivate) {
            logMyStoryPhotosAlways('[getPhoto] 403 private album', {
              id,
              viewer: authSinglesId,
              owner: photoOwnerId,
              albumType
            });
            return res.status(403).json({ error: 'Forbidden' });
          }
        } else {
          logMyStoryPhotosAlways('[getPhoto] 403 not public / not profile', {
            id,
            viewer: authSinglesId,
            owner: photoOwnerId,
            albumType
          });
          return res.status(403).json({ error: 'Forbidden' });
        }
      }
    }
    const ext = (fileExt || 'jpg').replace(/^\./, '');
    const videoExts = new Set(['webm', 'mp4', 'mp3']);
    if (videoExts.has(ext.toLowerCase())) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    const photoFolder = getPhotoFolder();
    if (!photoFolder) {
      logMyStoryPhotosAlways('[getPhoto] 500 VSINGLES_PHOTO_FOLDER missing', { id, authSinglesId });
      return res.status(500).json({ error: 'VSINGLES_PHOTO_FOLDER not configured in ~/.ssh/be/.env' });
    }

    if (wantThumbnail) {
      const thumbPath = resolvePhotoThumbnailPath(photoThumbnail, filePathFromDb || photoFolder);
      if (thumbPath) {
        const resolvedThumb = path.resolve(thumbPath);
        const stThumb = fs.statSync(resolvedThumb);
        const etagThumb = `"${stThumb.mtimeMs}-${stThumb.size}"`;
        res.set('ETag', etagThumb);
        res.set('Last-Modified', stThumb.mtime.toUTCString());
        res.set('Cache-Control', getPhotoCacheControlHeaderValue());
        if (req.headers['if-none-match'] === etagThumb) {
          res.set('X-Photo-Cache', 'HIT');
          void recordPhotoCacheResult(getClientIp(req), true, id);
          return res.status(304).end();
        }
        res.set('Content-Type', 'image/jpeg');
        res.set('X-Photo-Cache', 'MISS');
        void recordPhotoCacheResult(getClientIp(req), false, id);
        return res.sendFile(resolvedThumb);
      }
    }

    const fullPath = resolvePhotoFilePath(photoFolder, photoFileName, id, ext);
    if (!fullPath) {
      logMyStoryPhotosAlways('[getPhoto] 404 file not on disk', {
        id,
        authSinglesId,
        photoOwnerId,
        photoFolder,
        triedPath: fullPath,
        photoFileNameFromDb: photoFileName,
        ext
      });
      return res.status(404).json({ error: 'Photo not found' });
    }
    const resolved = path.resolve(fullPath);
    const st = fs.statSync(resolved);
    const etag = `"${st.mtimeMs}-${st.size}"`;
    res.set('ETag', etag);
    res.set('Last-Modified', st.mtime.toUTCString());
    res.set('Cache-Control', getPhotoCacheControlHeaderValue());
    if (req.headers['if-none-match'] === etag) {
      logMyStoryPhotos('[getPhoto] 304', { id, etag });
      res.set('X-Photo-Cache', 'HIT');
      void recordPhotoCacheResult(getClientIp(req), true, id);
      return res.status(304).end();
    }
    const contentType = extToContentType(ext);
    res.set('Content-Type', contentType);
    res.set('X-Photo-Cache', 'MISS');
    void recordPhotoCacheResult(getClientIp(req), false, id);
    if (myStoryPhotoDebugEnabled()) {
      logMyStoryPhotos('[getPhoto] 200 sendFile', { id, resolved, bytes: st.size, contentType });
    }
    return res.sendFile(resolved);
  } catch (error) {
    console.error('Error serving photo:', error);
    logMyStoryPhotosAlways('[getPhoto] 500 exception', { message: error?.message });
    res.status(500).json({ error: 'Failed to load photo' });
  }
}
