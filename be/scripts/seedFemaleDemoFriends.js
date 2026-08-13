#!/usr/bin/env node
/**
 * CLI: seed an existing female member with RapidRuth-style demo friends + 1 sample posting.
 *
 * Usage (Mac, from repo root):
 *   node be/scripts/seedFemaleDemoFriends.js --email=regularmember2@gmail.com
 *   node be/scripts/seedFemaleDemoFriends.js --singles-id=36
 *   node be/scripts/seedFemaleDemoFriends.js --email=… --dry-run
 *   node be/scripts/seedFemaleDemoFriends.js --email=… --force-post
 *
 * Later: import seedFemaleDemoFriendsForSinglesId from be/utils/seedFemaleDemoFriends.js
 * and call it on first female login (not wired yet).
 */
import '../loadEnv.js';
import pool from '../db/connection.js';
import { seedFemaleDemoFriends } from '../utils/seedFemaleDemoFriends.js';

function parseArgs(argv) {
  const out = { email: null, singlesId: null, dryRun: false, forcePost: false, help: false };
  for (const raw of argv) {
    const arg = String(raw ?? '').trim();
    if (!arg) continue;
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--force-post') out.forcePost = true;
    else if (arg.startsWith('--email=')) out.email = arg.slice('--email='.length).trim();
    else if (arg.startsWith('--singles-id=')) out.singlesId = Number(arg.slice('--singles-id='.length).trim());
    else if (arg === '--email' || arg === '--singles-id') {
      // value is next token — handled below in a second pass if needed
    } else if (!arg.startsWith('-') && !out.email && !out.singlesId) {
      if (/^\d+$/.test(arg)) out.singlesId = Number(arg);
      else if (arg.includes('@')) out.email = arg;
    }
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = String(argv[i] ?? '').trim();
    const next = String(argv[i + 1] ?? '').trim();
    if (a === '--email' && next && !next.startsWith('-')) out.email = next;
    if (a === '--singles-id' && next && !next.startsWith('-')) out.singlesId = Number(next);
  }
  return out;
}

function printHelp() {
  console.log(`Seed female demo friends (RapidRuth pack)

Usage:
  node be/scripts/seedFemaleDemoFriends.js --email=<female@email>
  node be/scripts/seedFemaleDemoFriends.js --singles-id=<id>
  node be/scripts/seedFemaleDemoFriends.js --email=… --dry-run
  node be/scripts/seedFemaleDemoFriends.js --email=… --force-post

Creates / upserts:
  • My Picks → JazzyJeff, BrainyBobby, LuckyLuke
  • Mutual Buddy with JazzyJeff (approved full bio) + full_paid=true (no token popup)
  • Mutual Acquaint with BrainyBobby (approved brief bio) + brief_paid=true (no token popup)
  • Pending Buddy request to LuckyLuke (noresponse)
  • One public welcome posting with profile photo attached (requires profile_image_fk)
    created_at is a few weeks after this member's previous post (first post: random in last 3 years)
  • Skips duplicate welcome content; upgrades legacy hiking seed post if present

Does NOT create a new singles row — target female must already exist.
Does NOT wire first-login yet (library export is ready).`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.email && !Number.isFinite(args.singlesId))) {
    printHelp();
    process.exitCode = args.help ? 0 : 1;
    return;
  }

  try {
    const result = await seedFemaleDemoFriends(pool, {
      email: args.email,
      singlesId: args.singlesId,
      dryRun: args.dryRun,
      forcePost: args.forcePost
    });

    console.log(args.dryRun ? '[dry-run] would seed:' : '[ok] seeded:');
    console.log(
      `  female: singles_id=${result.female.singles_id} alias=${result.female.alias} email=${result.female.email}`
    );
    console.log('  friends:', result.friends);
    if (result.requests?.length) {
      for (const r of result.requests) {
        console.log(
          `  request ${r.label}: requests_id=${r.requestsId} (${r.inserted ? 'inserted' : 'updated'})`
        );
      }
    } else {
      for (const line of result.relationships) console.log(`  - ${line}`);
    }
    if (result.posting) {
      console.log(
        `  posting: post_id=${result.posting.postId ?? '—'} ` +
          `created_at=${result.posting.createdAt ? new Date(result.posting.createdAt).toISOString() : '—'} ` +
          `photo=${result.posting.photoUrl ?? '—'} ` +
          `(${
            result.posting.dryRun
              ? 'would insert'
              : result.posting.inserted
                ? 'inserted'
                : result.posting.upgraded || result.posting.photoInserted
                  ? 'updated'
                  : 'already existed'
          })`
      );
    }
    process.exit(0);
  } catch (err) {
    console.error('[seedFemaleDemoFriends] failed:', err?.message ?? err);
    process.exit(1);
  }
}

void main();
