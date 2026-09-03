import fs from 'fs';
import pool, { getDBSchema } from '../../db/connection.js';
import { respondSessionInvalid } from '../../utils/sessionInvalidResponse.js';
import {
  buildPhotoSearchFolders,
  getPhotoFolder,
  isMemberAlbumPhotoRow,
  resolvePhotoFilePathForListingInFolders
} from '../../utils/photoFilePath.js';

const VALID_ALBUM_TYPES = new Set(['uploaded', 'public', 'private']);
const PHOTOS_TABLE = 'helloworldjunktest.photos';

function logPhotoDirStats(label) {
  const folder = getPhotoFolder();
  if (!folder) {
    console.log('[getMyPhotos]', label, 'TUTADATES_PHOTO_FOLDER is not set');
    return;
  }
  try {
    const entries = fs.readdirSync(folder, { withFileTypes: true });
    const files = entries.filter((e) => e.isFile()).map((e) => e.name);
    console.log('[getMyPhotos]', label, 'folder =', folder, 'fileCount =', files.length);
  } catch (e) {
    console.error('[getMyPhotos]', label, 'failed to read folder', folder, e.message);
  }
}

function normalizeAlbumType(value) {
  if (value == null) return 'uploaded';
  const normalized = String(value).trim().toLowerCase();
  return VALID_ALBUM_TYPES.has(normalized) ? normalized : 'uploaded';
}

async function resolveChecksumColumn(client) {
  const schemaName = getDBSchema();
  const result = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = 'photos'
       AND column_name = 'checksum'
     LIMIT 1`,
    [schemaName]
  );
  return result.rows[0]?.column_name || null;
}

async function resolveAlbumTypeColumn(client) {
  const schemaName = getDBSchema();
  const result = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = 'photos'
       AND column_name IN ('type', 'photo_type', 'album_type')
     ORDER BY CASE column_name
       WHEN 'type' THEN 0
       WHEN 'photo_type' THEN 1
       ELSE 2
     END
     LIMIT 1`,
    [schemaName]
  );
  return result.rows[0]?.column_name || null;
}

/**
 * GET /api/myPhotos
 * Returns list of { photos_id, display_order, file_extension, file_size_bytes } for the authenticated single.
 * photos_id in response is photos.photos_id (PK); file_extension is stored image extension (jpg/png/webp/etc).
 * file_size_bytes comes from TUTADATES_PHOTO_FOLDER on disk.
 */
export async function getMyPhotos(req, res) {
  let client;
  try {
    const singlesId = req.auth?.singles_id;
    if (!singlesId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    client = await pool.connect();
    const schemaName = getDBSchema();
    const albumTypeColumn = await resolveAlbumTypeColumn(client);
    const checksumColumn = await resolveChecksumColumn(client);

    const singlesResult = await client.query(
      `SELECT member_id, profile_image_fk
       FROM helloworldjunktest.singles
       WHERE singles_id = $1
       LIMIT 1`,
      [singlesId]
    );
    if (!singlesResult.rows.length) {
      return respondSessionInvalid(res);
    }
    const memberId = singlesResult.rows[0]?.member_id ?? null;
    const profileImageFk = singlesResult.rows[0]?.profile_image_fk ?? null;

    const queryText = `SELECT p.photos_id, p.display_order, p.file_extension, p.photo_file_name, p.file_path${
      albumTypeColumn ? `, p.${albumTypeColumn} AS album_type_raw` : ''
    }${checksumColumn ? `, p.${checksumColumn} AS photo_checksum` : ''}
       FROM ${PHOTOS_TABLE} p
       WHERE p.singles_id = $1
         ${
           albumTypeColumn
             ? `AND LOWER(COALESCE(p.${albumTypeColumn}::text, 'uploaded')) <> 'deleted'`
             : ''
         }
       ORDER BY p.display_order ASC, p.photos_id ASC`;
    const result = await client.query(queryText, [singlesId]);

    const searchFolders = buildPhotoSearchFolders({ memberId });
    const photoFolder = searchFolders[0] || getPhotoFolder(memberId);
    const visibleRows = result.rows.filter((r) =>
      isMemberAlbumPhotoRow({
        photoFileName: r.photo_file_name,
        memberId,
        profileImageFk,
        photosId: r.photos_id,
        checksum: checksumColumn ? r.photo_checksum : null
      })
    );

    console.log('[getMyPhotos] schema =', schemaName, 'singles_id =', singlesId, 'rows =', visibleRows.length);
    logPhotoDirStats('after SELECT');

    res.json(
      visibleRows
        .map((r) => {
          const ext = (r.file_extension || 'jpg').replace(/^\./, '');
          const rowFolders = buildPhotoSearchFolders({ filePathFromDb: r.file_path, memberId });
          const fullPath = resolvePhotoFilePathForListingInFolders(rowFolders, r.photo_file_name, ext);
          let fileSizeBytes = null;
          if (fullPath) {
            try {
              fileSizeBytes = fs.statSync(fullPath).size ?? null;
            } catch (_) {
              fileSizeBytes = null;
            }
          }
          return {
            photos_id: r.photos_id,
            display_order: r.display_order,
            file_extension: r.file_extension,
            photo_file_name: r.photo_file_name ?? null,
            type: albumTypeColumn ? normalizeAlbumType(r.album_type_raw) : 'uploaded',
            file_size_bytes: fileSizeBytes
          };
        })
        .filter((r) => r.file_size_bytes != null)
    );
  } catch (err) {
    console.error('Get my photos error:', err);
    res.status(500).json({ error: 'Failed to load photos' });
  } finally {
    client?.release();
  }
}
