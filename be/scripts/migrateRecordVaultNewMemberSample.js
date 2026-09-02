#!/usr/bin/env node
/**
 * Ensure SAMPLE NOTEBOOK + SAMPLE NOTE1/2 exist for every on-disk TutaNotes vault.
 *
 * Shared sample attachments use shared_content_key pointers (one media copy under
 * be/assets/recordVaultNewMemberSample/media for all members).
 *
 * Usage (from repo root, with ~/.ssh/be/.env loaded as usual for Node scripts):
 *   node be/scripts/migrateRecordVaultNewMemberSample.js
 *   node be/scripts/migrateRecordVaultNewMemberSample.js --dry-run
 *
 * Scans LARGE_CHEAP_STORAGE_FOLDER / STORAGE_FOLDER member TutaNotes vaults when present.
 * Unlocked vaults also self-heal on next unlock via ensureRecordVaultNewMemberSampleDb.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';

import '../loadEnv.js';
import { vaultMetaUsesPlaintextStorage } from '../utils/recordVaultIconEncryption.js';
import { openVaultBuffer, sealVaultBuffer, isPlaintextVaultKey } from '../utils/recordVaultUsb/vaultCrypto.js';
import {
  atomicWriteFileSync,
  isSqliteVaultDbBuffer,
  resolveVaultDbPath,
  vaultDbPath,
  vaultRootOnMount,
  VAULT_DIR_NAME,
  LEGACY_VAULT_DIR_NAMES
} from '../utils/recordVaultUsb/vaultPaths.js';
import { readVaultMeta } from '../utils/recordVaultUsb/usbScan.js';
import { VAULT_SCHEMA_SQL } from '../utils/recordVaultUsb/vaultSchema.js';
import {
  ensureRecordVaultNewMemberSampleDb,
  ensureRecordVaultSharedContentKeyColumn
} from '../utils/recordVaultNewMemberSample/seedRecordVaultNewMemberSample.js';
import { linkRecordVaultSharedSamplesIntoVault } from '../utils/recordVaultNewMemberSample/sharedSampleMedia.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes('--dry-run');

function storageRoots() {
  const roots = [];
  for (const key of ['LARGE_CHEAP_STORAGE_FOLDER', 'STORAGE_FOLDER']) {
    const raw = String(process.env[key] || '').trim();
    if (raw) roots.push(path.resolve(raw));
  }
  return [...new Set(roots)];
}

function findVaultMountPaths(root) {
  const out = [];
  const usersDir = path.join(root, 'users');
  if (!fs.existsSync(usersDir)) return out;
  for (const ent of fs.readdirSync(usersDir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const memberRoot = path.join(usersDir, ent.name);
    for (const notesName of ['notes', 'Notes']) {
      const notesRoot = path.join(memberRoot, notesName);
      if (!fs.existsSync(notesRoot)) continue;
      for (const vaultName of [VAULT_DIR_NAME, ...LEGACY_VAULT_DIR_NAMES]) {
        const vaultDir = path.join(notesRoot, vaultName);
        if (fs.existsSync(path.join(vaultDir, 'vault.meta.json'))) {
          out.push(vaultDir);
        }
      }
      // Some layouts use notes/ as the mount (meta at notes/vault.meta.json)
      if (fs.existsSync(path.join(notesRoot, 'vault.meta.json'))) {
        out.push(notesRoot);
      }
    }
  }
  return out;
}

async function migrateOneVault(mountPath, SQL) {
  const meta = readVaultMeta(mountPath);
  if (!meta) return { status: 'skip', reason: 'no-meta' };
  const dbPath = resolveVaultDbPath(mountPath) || vaultDbPath(mountPath, meta);
  if (!dbPath || !fs.existsSync(dbPath)) return { status: 'skip', reason: 'no-db' };

  const enc = fs.readFileSync(dbPath);
  // Offline migrate only plaintext vault DBs (encrypted needs member icon key).
  if (!vaultMetaUsesPlaintextStorage(meta) && !isPlaintextVaultKey(null)) {
    // Still try open as plaintext buffer (v3 / encryption none).
  }
  let plain;
  try {
    plain = openVaultBuffer(enc, null);
  } catch {
    return { status: 'skip', reason: 'encrypted-locked' };
  }
  if (!isSqliteVaultDbBuffer(plain)) return { status: 'skip', reason: 'not-sqlite' };

  const db = new SQL.Database(plain);
  try {
    db.run(VAULT_SCHEMA_SQL);
  } catch {
    // schema may already exist
  }
  ensureRecordVaultSharedContentKeyColumn(db);
  const before = ensureRecordVaultNewMemberSampleDb(db);
  if (dryRun) {
    db.close();
    return { status: 'dry-run', result: before };
  }
  if (before === 'inserted') {
    const sealed = sealVaultBuffer(Buffer.from(db.export()), null);
    atomicWriteFileSync(dbPath, sealed);
  }
  try {
    await linkRecordVaultSharedSamplesIntoVault({
      mountPath,
      key: null,
      meta,
      db
    });
  } catch {
    // ignore link failures
  }
  db.close();
  return { status: 'ok', result: before };
}

async function main() {
  const SQL = await initSqlJs();
  const mounts = [];
  for (const root of storageRoots()) {
    mounts.push(...findVaultMountPaths(root));
  }
  console.log(`[migrateRecordVaultNewMemberSample] roots=${storageRoots().join(', ') || '(none)'}`);
  console.log(`[migrateRecordVaultNewMemberSample] vaults found=${mounts.length} dryRun=${dryRun}`);

  const tallies = { inserted: 0, present: 0, skipped: 0, encrypted: 0, other: 0 };
  for (const mount of mounts) {
    const res = await migrateOneVault(mount, SQL);
    if (res.status === 'ok' || res.status === 'dry-run') {
      tallies[res.result] = (tallies[res.result] || 0) + 1;
      console.log(`  ${res.status} ${res.result}  ${mount}`);
    } else if (res.reason === 'encrypted-locked') {
      tallies.encrypted += 1;
      console.log(`  skip encrypted-locked  ${mount}`);
    } else {
      tallies.other += 1;
      console.log(`  skip ${res.reason}  ${mount}`);
    }
  }
  console.log('[migrateRecordVaultNewMemberSample] done', tallies);
  console.log(
    'Encrypted vaults pick up SAMPLE NOTE1/2 automatically on the member’s next unlock.'
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
