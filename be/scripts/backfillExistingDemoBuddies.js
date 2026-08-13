#!/usr/bin/env node
/**
 * ONE-TIME backfill for existing singles rows:
 *   WHERE seeded_demo_buddies_boolean is false (or --force)
 *     AND gender_self_report IN ('M','F')
 *   → F: seedFemaleDemoFriends (JazzyJeff, BrainyBobby, LuckyLuke)
 *   → M: seedMaleDemoFriends (RapidRuth, GiddyGail, SillySue)
 *   (sets seeded_demo_buddies_boolean = true on success)
 *
 * Does NOT change the new-login gender popup flow.
 *
 * Usage (from repo root, with BE env loaded):
 *   node be/scripts/backfillExistingDemoBuddies.js --dry-run
 *   node be/scripts/backfillExistingDemoBuddies.js
 *   node be/scripts/backfillExistingDemoBuddies.js --email=regularmember4@gmail.com
 *   node be/scripts/backfillExistingDemoBuddies.js --force
 */
import '../loadEnv.js';
import pool from '../db/connection.js';
import {
  ensureSeededDemoBuddiesOnLogin,
  normalizeGenderSelfReport
} from '../utils/ensureSeededDemoBuddiesOnLogin.js';
import { SCHEMA } from '../utils/seedMaleDemoFriends.js';
import { parseBooleanEnumRaw } from '../utils/booleanEnum.js';

const Q = `"${SCHEMA}"`;

function parseArgs(argv) {
  const out = { dryRun: false, help: false, force: false, email: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] ?? '').trim();
    const next = String(argv[i + 1] ?? '').trim();
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--force') out.force = true;
    else if (arg.startsWith('--email=')) out.email = arg.slice('--email='.length).trim().toLowerCase();
    else if (arg === '--email' && next && !next.startsWith('-')) {
      out.email = next.trim().toLowerCase();
      i += 1;
    }
  }
  return out;
}

function printHelp() {
  console.log(`Backfill demo buddies for existing users (one-time)

Usage:
  node be/scripts/backfillExistingDemoBuddies.js --dry-run
  node be/scripts/backfillExistingDemoBuddies.js
  node be/scripts/backfillExistingDemoBuddies.js --email=regularmember4@gmail.com
  node be/scripts/backfillExistingDemoBuddies.js --force

gender_self_report F → JazzyJeff, BrainyBobby, LuckyLuke (guys)
gender_self_report M → RapidRuth, GiddyGail, SillySue (girls)
Wrong-gender leftover demo pack is removed.
Skips NULL / unknown gender (those use the new-login popup later).
Requires profile photo for welcome posting (same as seed utils).`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
    return;
  }

  const params = [];
  const where = [
    `UPPER(BTRIM(COALESCE(gender_self_report::text, ''))) IN ('M', 'F')`
  ];
  if (!args.force) {
    where.push(
      `LOWER(BTRIM(COALESCE(seeded_demo_buddies_boolean::text, 'false'))) <> 'true'`
    );
  }
  if (args.email) {
    params.push(args.email);
    where.push(`LOWER(TRIM(email)) = $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT singles_id, email, alias, gender_self_report, seeded_demo_buddies_boolean
     FROM ${Q}.singles
     WHERE ${where.join('\n       AND ')}
     ORDER BY singles_id`,
    params
  );

  console.log(
    `[backfillExistingDemoBuddies] candidates=${rows.length} dryRun=${args.dryRun} force=${args.force}` +
      (args.email ? ` email=${args.email}` : '')
  );

  let ok = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    const id = Number(row.singles_id);
    const gender = normalizeGenderSelfReport(row.gender_self_report);
    const pack = gender === 'M' ? 'male' : 'female';
    const label = `singles_id=${id} email=${row.email} gender=${gender} pack=${pack}`;

    if (args.dryRun) {
      console.log(`[dry-run] would seed ${label}`);
      skipped += 1;
      continue;
    }

    if (!args.force && parseBooleanEnumRaw(row.seeded_demo_buddies_boolean)) {
      console.log(`[skip] already seeded ${label}`);
      skipped += 1;
      continue;
    }

    try {
      const result = await ensureSeededDemoBuddiesOnLogin(pool, id, { force: args.force });
      if (result.seeded) {
        console.log(`[ok] seeded ${label}`);
        ok += 1;
      } else if (result.reason === 'already_seeded') {
        console.log(`[skip] already seeded ${label}`);
        skipped += 1;
      } else {
        console.warn(`[fail] ${label} reason=${result.reason} error=${result.error ?? ''}`);
        failed += 1;
      }
    } catch (err) {
      console.error(`[fail] ${label}: ${err?.message ?? err}`);
      failed += 1;
    }
  }

  console.log(
    `[backfillExistingDemoBuddies] done ok=${ok} failed=${failed} skipped_or_dry=${skipped}`
  );
  await pool.end().catch(() => {});
  process.exit(failed > 0 ? 1 : 0);
}

void main();
