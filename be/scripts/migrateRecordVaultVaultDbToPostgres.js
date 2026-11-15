/**
 * One-time cutover: import every member's TutaNotes vault.db (TutaCloud folder under
 * LARGE_CHEAP_STORAGE_FOLDER) into the notes_* Postgres tables, then rename the file
 * to vault-imported-to-postgres-<stamp>.db. Safe to re-run; members already in Postgres are
 * skipped. Anything missed here is imported automatically on the member's next unlock.
 *
 * Run on the server that writes Postgres Primary and sees LARGE_CHEAP_STORAGE_FOLDER:
 *   node be/scripts/migrateRecordVaultVaultDbToPostgres.js
 */
import '../loadEnv.js';
import pool from '../db/connection.js';
import { tutaDriveNotesMountPath } from '../utils/tutaDriveMemberPaths.js';
import { listEnvVaultUnlockKeys } from '../utils/recordVaultIconKeys.js';
import { isRecordVaultIconEncryptionEnabled } from '../utils/recordVaultIconEncryption.js';
import { readVaultMeta } from '../utils/recordVaultUsb/usbScan.js';
import { importLegacyRecordVaultVaultDb } from '../utils/recordVaultUsb/vaultSession.js';

async function tutaDriveUnlockKey(mountPath) {
  if (!isRecordVaultIconEncryptionEnabled()) return null;
  const keys = await listEnvVaultUnlockKeys('tutadrive', readVaultMeta(mountPath));
  return keys[0]?.key ?? null;
}

async function main() {
  const { rows } = await pool.query(
    `SELECT singles_id, member_id FROM outdateddbsnapshotoct2024.singles
      WHERE member_id IS NOT NULL ORDER BY singles_id`
  );
  const stats = { imported: 0, already_in_postgres: 0, no_vault_db: 0, key_required: 0, failed: 0 };
  for (const row of rows) {
    const singlesId = Number(row.singles_id);
    const mountPath = tutaDriveNotesMountPath(Number(row.member_id));
    try {
      const result = await importLegacyRecordVaultVaultDb(singlesId, mountPath, await tutaDriveUnlockKey(mountPath));
      stats[result.reason] = (stats[result.reason] || 0) + 1;
      if (result.reason !== 'no_vault_db') {
        console.log(`[migrate] singles_id=${singlesId} M${row.member_id}: ${result.reason}`);
      }
    } catch (err) {
      stats.failed += 1;
      console.error(`[migrate] singles_id=${singlesId} M${row.member_id} failed:`, err?.message || err);
    }
  }
  console.log('\nTutaNotes vault.db → Postgres summary:', stats);
  if (stats.failed) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error('Migration failed:', err?.message || err);
    process.exitCode = 1;
  })
  .finally(() => pool.end().finally(() => process.exit(process.exitCode || 0)));
