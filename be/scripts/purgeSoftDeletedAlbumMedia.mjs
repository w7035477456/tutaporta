#!/usr/bin/env node
/**
 * Permanently remove all photos/videos rows still using type = deleted.
 * Run from repo root: node be/scripts/purgeSoftDeletedAlbumMedia.mjs
 */
import '../loadEnv.js';
import pool from '../db/connection.js';
import { purgeAllDeletedTypeMedia } from '../utils/deleteSystemPhotos.js';

async function main() {
  const client = await pool.connect();
  try {
    const result = await purgeAllDeletedTypeMedia(client);
    console.log(`Purged ${result.purgedPhotos} photo(s) and ${result.purgedVideos} video(s) with type = deleted.`);
  } finally {
    client.release();
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pool.end();
    } catch {
      // ignore
    }
  });
