import fs from 'fs';
import pool from '../../db/connection.js';
import { SELF_INTRO_VIDEO_FILE_PREFIX } from '../../utils/saveSelfIntroVideo.js';
import { VALID_ALBUM_TYPES } from '../../utils/albumMediaCapacity.js';
import { resolveVideoFilePath } from '../../utils/videoFilePath.js';

function normalizeAlbumType(value) {
  if (value == null) return 'uploaded';
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'deleted') return null;
  return VALID_ALBUM_TYPES.has(normalized) ? normalized : 'uploaded';
}

/**
 * GET /api/myAlbumVideos
 * Self-intro library videos with album type (uploaded / public / private).
 */
export async function getMyAlbumVideos(req, res) {
  let client;
  try {
    const singlesId = req.auth?.singles_id;
    if (!singlesId) return res.status(401).json({ error: 'Authentication required' });

    client = await pool.connect();
    const { rows } = await client.query(
      `SELECT video_id, file_path, file_extension, type::text AS album_type_raw, video_file_name, created_at, video_thumbnail
       FROM helloworldjunktest.videos
       WHERE singles_id = $1
         AND video_file_name LIKE $2
         AND LOWER(type::text) <> 'deleted'
       ORDER BY video_id ASC`,
      [singlesId, `${SELF_INTRO_VIDEO_FILE_PREFIX}%`]
    );

    return res.json(
      rows
        .map((row) => {
          const fullPath = resolveVideoFilePath(
            null,
            row.video_file_name,
            row.video_id,
            row.file_extension,
            row.file_path
          );
          let fileSizeBytes = null;
          if (fullPath) {
            try {
              fileSizeBytes = fs.statSync(fullPath).size ?? null;
            } catch {
              fileSizeBytes = null;
            }
          }
          return {
            video_id: Number(row.video_id),
            file_extension: row.file_extension ?? 'webm',
            type: normalizeAlbumType(row.album_type_raw),
            video_file_name: row.video_file_name ?? null,
            created_at: row.created_at ?? null,
            video_thumbnail: row.video_thumbnail ?? null,
            file_size_bytes: fileSizeBytes
          };
        })
        .filter((row) => row.type != null)
    );
  } catch (err) {
    console.error('getMyAlbumVideos error:', err);
    return res.status(500).json({ error: 'Failed to load album videos' });
  } finally {
    client?.release();
  }
}
