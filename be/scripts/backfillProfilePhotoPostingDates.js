#!/usr/bin/env node
/**
 * Re-stamp every "User changed Profile Photo" posting so it is dated before all
 * other posts for that member (random within 6 months before the oldest other post).
 *
 * Usage (Mac, from repo root):
 *   node be/scripts/backfillProfilePhotoPostingDates.js
 *   node be/scripts/backfillProfilePhotoPostingDates.js --dry-run
 */
import '../loadEnv.js';
import pool from '../db/connection.js';
import { getDBSchema } from '../config/envConfig.js';
import { ensurePostingQuarterlyPartitionsBeforeWrite } from '../utils/ensureQuarterlyPartitions.js';
import {
  PROFILE_PHOTO_CHANGE_POST_CONTENT,
  loadOldestOtherPostingCreatedAt,
  profilePhotoPostingNeedsEarlierTimestamp,
  resolveProfilePhotoChangePostingTimestamp,
  restampPostingCreatedAt
} from '../utils/profilePhotoPostingTimestamp.js';

function parseArgs(argv) {
  return { dryRun: argv.includes('--dry-run') };
}

function schemaIdent() {
  return String(getDBSchema() || 'helloworldjunktest').replace(/"/g, '""');
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const schema = schemaIdent();

  const client = await pool.connect();
  try {
    const { rows: posts } = await client.query(
      `SELECT p.post_id, p.singles_id, s.alias, p.created_at
       FROM "${schema}".postings p
       INNER JOIN "${schema}".singles s ON s.singles_id = p.singles_id
       WHERE p.parent_post_id IS NULL
         AND BTRIM(COALESCE(p.content, '')) = $1
       ORDER BY p.singles_id, p.post_id`,
      [PROFILE_PHOTO_CHANGE_POST_CONTENT]
    );

    console.log(
      `${dryRun ? '[dry-run] ' : ''}Profile-photo posting date backfill: ${posts.length} post(s)`
    );

    let updated = 0;
    let skipped = 0;

    for (const row of posts) {
      const postId = Number(row.post_id);
      const singlesId = Number(row.singles_id);
      const oldestOther = await loadOldestOtherPostingCreatedAt(client, schema, singlesId, { excludePostId: postId });
      if (!profilePhotoPostingNeedsEarlierTimestamp(row.created_at, oldestOther)) {
        skipped += 1;
        continue;
      }

      const newCreatedAt = await resolveProfilePhotoChangePostingTimestamp(client, schema, singlesId, {
        excludePostId: postId
      });
      const oldIso = new Date(row.created_at).toISOString();
      const newIso = newCreatedAt.toISOString();

      if (dryRun) {
        console.log(
          `  ${row.alias} post_id=${postId} ${oldIso} -> ${newIso}` +
            (oldestOther ? ` (oldest other ${new Date(oldestOther).toISOString()})` : '')
        );
        updated += 1;
        continue;
      }

      await ensurePostingQuarterlyPartitionsBeforeWrite(newCreatedAt);
      await client.query('BEGIN');
      try {
        await restampPostingCreatedAt(client, schema, postId, newCreatedAt);
        await client.query('COMMIT');
        console.log(`  ${row.alias} post_id=${postId} ${oldIso} -> ${newIso}`);
        updated += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log(`Done. updated=${updated} skipped=${skipped}`);
  } catch (err) {
    console.error('Backfill failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end().catch(() => {});
    process.exit(process.exitCode || 0);
  }
}

void main();
