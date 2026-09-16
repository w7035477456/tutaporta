#!/usr/bin/env node
/**
 * CLI: backup TutaNotes + TutaPhoto + TutaDates for one member by email.
 *
 * Usage (Ubuntu / Mac, from repo root):
 *   node be/scripts/backupUserAll.js --email=dm0@gmail.com
 *   node be/scripts/backupUserAll.js --email=… --backup-root=~/tutamallBackup/dm0
 *   node be/scripts/backupUserAll.js --email=… --dry-run
 */
import '../loadEnv.js';
import pool from '../db/connection.js';
import { backupUserAll, defaultBackupRootForEmail } from '../utils/tutaMallUserBackup.js';

function parseArgs(argv) {
  const out = { email: null, backupRoot: null, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] ?? '').trim();
    if (!arg) continue;
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--dry-run') out.dryRun = true;
    else if (arg.startsWith('--email=')) out.email = arg.slice('--email='.length).trim();
    else if (arg.startsWith('--backup-root=')) out.backupRoot = arg.slice('--backup-root='.length).trim();
    else if (arg === '--email') out.email = String(argv[i + 1] ?? '').trim();
    else if (arg === '--backup-root') out.backupRoot = String(argv[i + 1] ?? '').trim();
    else if (arg.includes('@') && !out.email) out.email = arg;
  }
  return out;
}

function printHelp() {
  console.log(`Backup TutaNotes, TutaPhotoAlbums, and TutaDates for one member.

Usage:
  node be/scripts/backupUserAll.js --email=<member@email>
  node be/scripts/backupUserAll.js --email=… --backup-root=~/tutamallBackup/dm0

Default backup folder: ~/tutamallBackup/{email-prefix}/`);
}

async function exitCli(code) {
  try {
    await pool.end();
  } catch {
    // ignore pool shutdown errors on CLI exit
  }
  // envConfig + connection.js start setInterval timers; must exit explicitly for shell prompt.
  process.exit(code);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.email) {
    printHelp();
    await exitCli(args.help ? 0 : 1);
  }

  const backupRoot = args.backupRoot || defaultBackupRootForEmail(args.email);
  if (args.dryRun) {
    console.log(`[backupUserAll] dry-run — would write to ${backupRoot}`);
    await exitCli(0);
  }

  try {
    const result = await backupUserAll(pool, { email: args.email, backupRoot });
    console.log('[backupUserAll] complete');
    console.log(`  email:      ${result.email}`);
    console.log(`  singles_id: ${result.singlesId}`);
    console.log(`  member_id:  ${result.memberId}`);
    console.log(`  backupDir:  ${result.backupDir}`);
    console.log(`  copied:     ${result.summary.copied.length} path(s)`);
    console.log(`  skipped:    ${result.summary.skipped.length} path(s)`);
    await exitCli(0);
  } catch (err) {
    console.error('[backupUserAll] failed:', err?.message ?? err);
    await exitCli(1);
  }
}

void main();
