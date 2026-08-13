#!/usr/bin/env node
/**
 * Re-stamp every DemoUser posting to January 1, 2024 at noon (America/New_York).
 * Updates postings.created_at, posting_photos.post_created_at, and
 * posting_comments.photo_post_created_at together.
 *
 * Usage (Mac, from repo root):
 *   node be/scripts/backfillDemoUserPostingDates.js
 *   node be/scripts/backfillDemoUserPostingDates.js --dry-run
 */
import '../loadEnv.js';
import pool from '../db/connection.js';
import { getDBSchema } from '../config/envConfig.js';
import { ensurePostingQuarterlyPartitionsBeforeWrite } from '../utils/ensureQuarterlyPartitions.js';

const DEMO_POSTING_AT = new Date('2024-01-01T12:00:00-05:00');

function parseArgs(argv) {
  return { dryRun: argv.includes('--dry-run') };
}

function schemaIdent() {
  return String(getDBSchema() || 'helloworldjunktest').replace(/"/g, '""');
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const schema = schemaIdent();

  await ensurePostingQuarterlyPartitionsBeforeWrite(DEMO_POSTING_AT);

  const client = await pool.connect();
  try {
    const { rows: posts } = await client.query(
      `SELECT p.post_id, p.singles_id, s.alias, p.created_at
       FROM "${schema}".postings p
       INNER JOIN "${schema}".singles s ON s.singles_id = p.singles_id
       WHERE LOWER(TRIM(s.member_category::text)) = 'demouser'
       ORDER BY p.singles_id, p.post_id`
    );

    console.log(
      `${dryRun ? '[dry-run] ' : ''}DemoUser posting date backfill: ${posts.length} posts -> ${DEMO_POSTING_AT.toISOString()} (Jan 1, 2024 noon ET)`
    );
    if (posts.length === 0) return;

    if (dryRun) {
      for (const row of posts) {
        console.log(
          `  ${row.alias} post_id=${row.post_id} ${new Date(row.created_at).toISOString()} -> ${DEMO_POSTING_AT.toISOString()}`
        );
      }
      return;
    }

    await client.query('BEGIN');
    await client.query('SET LOCAL session_replication_role = replica');

    for (const row of posts) {
      await client.query(
        `UPDATE "${schema}".postings
         SET created_at = $1
         WHERE post_id = $2`,
        [DEMO_POSTING_AT, row.post_id]
      );
      await client.query(
        `UPDATE "${schema}".posting_photos
         SET post_created_at = $1
         WHERE post_id = $2`,
        [DEMO_POSTING_AT, row.post_id]
      );
      await client.query(
        `UPDATE "${schema}".posting_comments pc
         SET photo_post_created_at = $1
         FROM "${schema}".posting_photos pp
         WHERE pc.photo_id = pp.photo_id
           AND pp.post_id = $2`,
        [DEMO_POSTING_AT, row.post_id]
      );
      console.log(
        `  ${row.alias} post_id=${row.post_id} ${new Date(row.created_at).toISOString()} -> ${DEMO_POSTING_AT.toISOString()}`
      );
    }

    await client.query('COMMIT');
    console.log(`Updated ${posts.length} DemoUser posting timestamp(s).`);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('Backfill failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
    process.exit(process.exitCode || 0);
  }
}

void main();
