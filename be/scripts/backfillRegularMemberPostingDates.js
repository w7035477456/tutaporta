#!/usr/bin/env node
/**
 * Re-stamp every RegularMember posting so timestamps increase with post_id
 * (creation order): first post random in the last 3 years, each later post a
 * few weeks after the previous one. Never the current date/time.
 *
 * Updates postings.created_at, posting_photos.post_created_at, and
 * posting_comments.photo_post_created_at together.
 *
 * Usage (Mac, from repo root):
 *   node be/scripts/backfillRegularMemberPostingDates.js
 *   node be/scripts/backfillRegularMemberPostingDates.js --dry-run
 */
import '../loadEnv.js';
import pool from '../db/connection.js';
import { getDBSchema } from '../config/envConfig.js';
import { ensurePostingQuarterlyPartitionsForRange } from '../utils/ensureQuarterlyPartitions.js';
import {
  DEFAULT_LOOKBACK_YEARS,
  planRegularMemberPostingTimestamps
} from '../utils/regularMemberActivityTimestamp.js';

function parseArgs(argv) {
  return { dryRun: argv.includes('--dry-run') };
}

function schemaIdent() {
  return String(getDBSchema() || 'helloworldjunktest').replace(/"/g, '""');
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const schema = schemaIdent();
  const rangeStart = new Date(Date.now() - DEFAULT_LOOKBACK_YEARS * 365.25 * 24 * 60 * 60 * 1000);

  await ensurePostingQuarterlyPartitionsForRange(rangeStart, new Date());

  const client = await pool.connect();
  try {
    const { rows: members } = await client.query(
      `SELECT s.singles_id, s.alias, s.email
       FROM "${schema}".singles s
       WHERE LOWER(TRIM(s.member_category::text)) = 'regularmember'
       ORDER BY s.singles_id`
    );

    const { rows: posts } = await client.query(
      `SELECT p.post_id, p.singles_id, p.created_at
       FROM "${schema}".postings p
       INNER JOIN "${schema}".singles s ON s.singles_id = p.singles_id
       WHERE LOWER(TRIM(s.member_category::text)) = 'regularmember'
       ORDER BY p.singles_id, p.post_id`
    );

    const byMember = new Map();
    for (const post of posts) {
      const id = Number(post.singles_id);
      if (!byMember.has(id)) byMember.set(id, []);
      byMember.get(id).push(post);
    }

    const plan = [];
    for (const member of members) {
      const memberPosts = byMember.get(Number(member.singles_id)) || [];
      if (memberPosts.length === 0) continue;
      const stamps = planRegularMemberPostingTimestamps(memberPosts.length);
      memberPosts.forEach((post, index) => {
        plan.push({
          singlesId: Number(member.singles_id),
          alias: member.alias,
          email: member.email,
          postId: Number(post.post_id),
          oldCreatedAt: post.created_at,
          newCreatedAt: stamps[index]
        });
      });
    }

    console.log(
      `${dryRun ? '[dry-run] ' : ''}RegularMember posting date backfill: ${members.length} members, ${plan.length} posts, lookback ${DEFAULT_LOOKBACK_YEARS} years, +2–4 weeks between posts`
    );
    if (plan.length === 0) return;
    if (dryRun) {
      for (const row of plan) {
        console.log(
          `  ${row.alias} post_id=${row.postId} ${new Date(row.oldCreatedAt).toISOString()} -> ${row.newCreatedAt.toISOString()}`
        );
      }
      return;
    }

    await client.query('BEGIN');
    await client.query('SET LOCAL session_replication_role = replica');

    for (const row of plan) {
      await client.query(
        `UPDATE "${schema}".postings
         SET created_at = $1
         WHERE post_id = $2`,
        [row.newCreatedAt, row.postId]
      );
      await client.query(
        `UPDATE "${schema}".posting_photos
         SET post_created_at = $1
         WHERE post_id = $2`,
        [row.newCreatedAt, row.postId]
      );
      await client.query(
        `UPDATE "${schema}".posting_comments pc
         SET photo_post_created_at = $1
         FROM "${schema}".posting_photos pp
         WHERE pc.photo_id = pp.photo_id
           AND pp.post_id = $2`,
        [row.newCreatedAt, row.postId]
      );
      console.log(
        `  ${row.alias} post_id=${row.postId} ${new Date(row.oldCreatedAt).toISOString()} -> ${row.newCreatedAt.toISOString()}`
      );
    }

    await client.query('COMMIT');
    console.log(`Updated ${plan.length} RegularMember posting timestamp(s).`);
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
