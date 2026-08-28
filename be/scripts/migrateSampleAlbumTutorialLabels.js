/**
 * One-time backfill: apply SAMPLE ALBUM tutorial text labels to existing vaults.
 *
 * Plaintext TutaDrive vaults are updated on disk immediately. Encrypted vaults are
 * skipped here and migrate automatically the next time the member unlocks TutaPhoto.
 *
 * Usage (Mac dev):
 *   node be/scripts/migrateSampleAlbumTutorialLabels.js
 */
import '../loadEnv.js';
import pool from '../db/connection.js';
import { tutaDrivePhotoAlbumsMountPath } from '../utils/tutaDriveMemberPaths.js';
import { vaultHasDbFile } from '../utils/photoAlbumsUsb/vaultPaths.js';
import {
  closePhotoAlbumsVaultDb,
  migrateSampleAlbumTutorialLabelsDb,
  openPhotoAlbumsVaultDbForMigration,
  persistPhotoAlbumsVaultDb
} from '../utils/photoAlbumsNewMemberSample/migrateSampleAlbumTutorialLabels.js';

async function migrateMount(mountPath, label) {
  const opened = await openPhotoAlbumsVaultDbForMigration(mountPath);
  if (opened.skipped) {
    return { label, ...opened };
  }

  try {
    const result = migrateSampleAlbumTutorialLabelsDb(opened.db);
    if (result.migrated) {
      persistPhotoAlbumsVaultDb(opened.db, mountPath, opened.meta, opened.key);
    }
    return { label, ...result };
  } finally {
    closePhotoAlbumsVaultDb(opened.db);
  }
}

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT singles_id, member_id, email
       FROM helloworldjunktest.singles
       WHERE member_id IS NOT NULL
       ORDER BY singles_id`
    );

    const stats = {
      migrated: 0,
      already_migrated: 0,
      no_sample_album: 0,
      not_bundled_sample: 0,
      inner_encrypted: 0,
      encrypted_vault: 0,
      missing_mount: 0,
      missing_db: 0,
      other: 0
    };

    for (const row of rows) {
      const memberId = Number(row.member_id);
      if (!Number.isFinite(memberId) || memberId < 1) continue;

      const mountPath = tutaDrivePhotoAlbumsMountPath(memberId);
      if (!vaultHasDbFile(mountPath)) {
        stats.missing_mount += 1;
        continue;
      }

      const label = `singles_id=${row.singles_id} member_id=${memberId} ${row.email || ''}`.trim();
      const outcome = await migrateMount(mountPath, label);
      const reason = outcome.reason || (outcome.migrated ? 'migrated' : 'unknown');

      if (outcome.migrated) {
        stats.migrated += 1;
        console.log(`[migrate] updated ${label} note_id=${outcome.noteId}`);
      } else if (stats[reason] != null) {
        stats[reason] += 1;
      } else {
        stats.other += 1;
        console.log(`[migrate] skipped ${label}: ${reason}`);
      }
    }

    console.log('\nSAMPLE ALBUM tutorial label migration summary:');
    console.log(`  migrated:           ${stats.migrated}`);
    console.log(`  already_migrated:   ${stats.already_migrated}`);
    console.log(`  no_sample_album:    ${stats.no_sample_album}`);
    console.log(`  not_bundled_sample: ${stats.not_bundled_sample}`);
    console.log(`  inner_encrypted:    ${stats.inner_encrypted}`);
    console.log(`  encrypted_vault:    ${stats.encrypted_vault} (will migrate on next unlock)`);
    console.log(`  missing_mount/db:   ${stats.missing_mount + stats.missing_db}`);
    if (stats.other) console.log(`  other:              ${stats.other}`);
  } finally {
    client.release();
    await pool.end();
    process.exit(process.exitCode || 0);
  }
}

void main().catch((err) => {
  console.error('Migration failed:', err?.message || err);
  process.exit(1);
});
