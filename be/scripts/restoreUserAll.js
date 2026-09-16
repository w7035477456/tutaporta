#!/usr/bin/env node
/**
 * CLI: restore TutaNotes + TutaPhoto + TutaDates for one member from ~/tutamallBackup/{prefix}/.
 *
 * Usage (Ubuntu / Mac, from repo root):
 *   node be/scripts/restoreUserAll.js --email=dm0@gmail.com
 *   node be/scripts/restoreUserAll.js --email=… --dry-run
 */
import '../loadEnv.js';
import pool from '../db/connection.js';
import { defaultBackupRootForEmail, restoreUserAll } from '../utils/tutaMallUserBackup.js';

function parseArgs(argv) {
  const out = { email: null, backupRoot: null, dryRun: false, help: false, yes: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] ?? '').trim();
    if (!arg) continue;
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--yes' || arg === '-y') out.yes = true;
    else if (arg.startsWith('--email=')) out.email = arg.slice('--email='.length).trim();
    else if (arg.startsWith('--backup-root=')) out.backupRoot = arg.slice('--backup-root='.length).trim();
    else if (arg === '--email') out.email = String(argv[i + 1] ?? '').trim();
    else if (arg === '--backup-root') out.backupRoot = String(argv[i + 1] ?? '').trim();
    else if (arg.includes('@') && !out.email) out.email = arg;
  }
  return out;
}

function printHelp() {
  console.log(`Restore TutaNotes, TutaPhotoAlbums, and TutaDates for one member.

Usage:
  node be/scripts/restoreUserAll.js --email=<member@email>
  node be/scripts/restoreUserAll.js --email=… --dry-run
  node be/scripts/restoreUserAll.js --email=… --yes

Default restore folder: ~/tutamallBackup/{email-prefix}/`);
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
    const preview = await restoreUserAll(pool, { email: args.email, backupRoot, dryRun: true });
    console.log('[restoreUserAll] dry-run — backup found');
    console.log(`  email:      ${preview.email}`);
    console.log(`  backupDir:  ${preview.backupDir}`);
    console.log(`  createdAt:  ${preview.manifest?.createdAt ?? '(unknown)'}`);
    await exitCli(0);
  }

  if (!args.yes) {
    console.error('[restoreUserAll] Refusing to restore without --yes (overwrites live data).');
    await exitCli(1);
  }

  try {
    const result = await restoreUserAll(pool, { email: args.email, backupRoot });
    console.log('[restoreUserAll] complete');
    console.log(`  email:      ${result.email}`);
    console.log(`  singles_id: ${result.singlesId}`);
    console.log(`  backupDir:  ${result.backupDir}`);
    console.log(`  restored:   ${result.summary.restored.length} path(s)`);
    console.log(`  skipped:    ${result.summary.skipped.length} path(s)`);
    await exitCli(0);
  } catch (err) {
    console.error('[restoreUserAll] failed:', err?.message ?? err);
    await exitCli(1);
  }
}

void main();
