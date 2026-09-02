#!/usr/bin/env node
/**
 * Ensure SAMPLE NOTEBOOK + SAMPLE NOTE1/2 exist for every on-disk TutaNotes vault.
 * Also soft-deletes the legacy registration default "Notebook 1" / "NOTEBOOK 1".
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
  const seen = new Set();
  const usersDir = path.join(root, 'users');
  if (!fs.existsSync(usersDir)) return out;

  const pushMount = (mountPath) => {
    let resolved;
    try {
      resolved = fs.realpathSync(mountPath);
    } catch {
      resolved = path.resolve(mountPath);
    }
    // Case-insensitive FS (macOS): notes vs Notes
    const key = resolved.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(resolved);
  };

  for (const ent of fs.readdirSync(usersDir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const memberRoot = path.join(usersDir, ent.name);
    for (const notesName of ['notes', 'Notes']) {
      const notesRoot = path.join(memberRoot, notesName);
      if (!fs.existsSync(notesRoot)) continue;
      // USB/session APIs expect the mount = parent of TutaNotes (vaultRootOnMount appends VAULT_DIR_NAME).
      let foundNested = false;
      for (const vaultName of [VAULT_DIR_NAME, ...LEGACY_VAULT_DIR_NAMES]) {
        const vaultDir = path.join(notesRoot, vaultName);
        if (fs.existsSync(path.join(vaultDir, 'vault.meta.json'))) {
          pushMount(notesRoot);
          foundNested = true;
          break;
        }
      }
      // Some layouts use notes/ as the vault root itself (meta at notes/vault.meta.json).
      if (!foundNested && fs.existsSync(path.join(notesRoot, 'vault.meta.json'))) {
        pushMount(notesRoot);
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
  // Persist inserted notes, purged garbage, revived SAMPLE NOTE1, and shared_content_key relinks.
  if (before === 'inserted' || before === 'upgraded') {
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

  const tallies = { inserted: 0, present: 0, upgraded: 0, skipped: 0, encrypted: 0, other: 0 };
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
}).finally(() => {
  // loadEnv starts a config-refresh interval — force exit so CLI migrations finish.
  setTimeout(() => process.exit(process.exitCode || 0), 50);
});
