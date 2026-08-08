#!/usr/bin/env node
/**
 * Backfill videos.video_thumbnail for rows missing a thumbnail JPEG on disk.
 * Run from repo root: node be/scripts/backfillVideoThumbnails.mjs
 */
import '../loadEnv.js';
import pool from '../db/connection.js';
import path from 'path';
import { resolveVideoFilePath } from '../utils/videoFilePath.js';
import { generateAndSaveVideoThumbnail } from '../utils/generateVideoThumbnail.js';
import { resolveVideoThumbnailPath } from '../utils/videoThumbnailPath.js';

async function main() {
  const client = await pool.connect();
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const { rows } = await client.query(
      `SELECT video_id, singles_id, video_file_name, file_extension, file_path, video_thumbnail
       FROM helloworldjunktest.videos
       ORDER BY video_id ASC`
    );

    for (const row of rows) {
      const videoId = Number(row.video_id);
      const existingThumb = String(row.video_thumbnail ?? '').trim();
      if (existingThumb && resolveVideoThumbnailPath(existingThumb, row.file_path)) {
        skipped += 1;
        continue;
      }

      const videoPath = resolveVideoFilePath(null, row.video_file_name, videoId, row.file_extension, row.file_path);
      if (!videoPath) {
        console.warn(`[skip] video file missing video_id=${videoId}`);
        skipped += 1;
        continue;
      }

      const outputDir = path.dirname(videoPath);
      const thumbFileName = await generateAndSaveVideoThumbnail({
        videoFullPath: videoPath,
        videoFileName: row.video_file_name,
        outputDir
      });

      if (!thumbFileName) {
        console.warn(`[fail] could not generate thumbnail video_id=${videoId}`);
        failed += 1;
        continue;
      }

      await client.query(
        `UPDATE helloworldjunktest.videos SET video_thumbnail = $1 WHERE video_id = $2`,
        [thumbFileName, videoId]
      );
      updated += 1;
      console.log(`[ok] video_id=${videoId} -> ${thumbFileName}`);
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`Done. updated=${updated} skipped=${skipped} failed=${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
