import fs from 'fs';
import { SELF_INTRO_VIDEO_FILE_PREFIX } from './saveSelfIntroVideo.js';
import { resolveVideoFilePath } from './videoFilePath.js';

/**
 * Same-user duplicate check for Public Video Vault media by exact on-disk byte size.
 * Different users may upload files with the same size independently.
 */
export async function findSameUserVaultVideoWithByteSize(client, singlesId, byteSize) {
  if (!Number.isFinite(byteSize) || byteSize < 1) return null;

  const { rows } = await client.query(
    `SELECT video_id, file_path, file_extension, video_file_name
     FROM helloworldjunktest.videos
     WHERE singles_id = $1
       AND video_file_name LIKE $2
       AND LOWER(type::text) <> 'deleted'
     ORDER BY video_id ASC`,
    [singlesId, `${SELF_INTRO_VIDEO_FILE_PREFIX}%`]
  );

  for (const row of rows) {
    const fullPath = resolveVideoFilePath(
      null,
      row.video_file_name,
      row.video_id,
      row.file_extension,
      row.file_path
    );
    if (!fullPath) continue;
    try {
      const size = fs.statSync(fullPath).size;
      if (size === byteSize) {
        return { video_id: Number(row.video_id), file_size_bytes: size };
      }
    } catch {
      // skip missing or unreadable files
    }
  }

  return null;
}

export function duplicateVaultVideoError() {
  const err = new Error('You upload a duplicate file. PLease check again');
  err.code = 'DUPLICATE_UPLOAD';
  return err;
}
