/**
 * One-time backfill: remove the retired SAMPLE ALBUM tutorial hint labels from every
 * member's TutaPhoto album index in Postgres. Members whose vault.db is not imported yet
 * migrate automatically the next time they unlock TutaPhoto.
 *
 * Usage (Mac dev):
 *   node be/scripts/migrateSampleAlbumTutorialLabels.js
 */
import '../loadEnv.js';
import pool from '../db/connection.js';
import { PHOTO_ALBUMS_VAULT_TABLES, VaultPgDb } from '../utils/photoAlbumsUsb/vaultPgStore.js';
import { migrateSampleAlbumTutorialLabelsDb } from '../utils/photoAlbumsNewMemberSample/migrateSampleAlbumTutorialLabels.js';

async function main() {
  try {
    const { rows } = await pool.query(
      `SELECT singles_id FROM ${PHOTO_ALBUMS_VAULT_TABLES.memberVault} ORDER BY singles_id`
    );

    const stats = {
      migrated: 0,
      already_migrated: 0,
      no_sample_album: 0,
      not_bundled_sample: 0,
      inner_encrypted: 0,
      other: 0
    };

    for (const row of rows) {
      const singlesId = Number(row.singles_id);
      const outcome = await migrateSampleAlbumTutorialLabelsDb(new VaultPgDb(singlesId));
      const reason = outcome.reason || (outcome.migrated ? 'migrated' : 'unknown');
      if (outcome.migrated) {
        stats.migrated += 1;
        console.log(`[migrate] updated singles_id=${singlesId} note_id=${outcome.noteId}`);
      } else if (stats[reason] != null) {
        stats[reason] += 1;
      } else {
        stats.other += 1;
        console.log(`[migrate] skipped singles_id=${singlesId}: ${reason}`);
      }
    }

    console.log('\nSAMPLE ALBUM tutorial label migration summary:');
    console.log(`  migrated:           ${stats.migrated}`);
    console.log(`  already_migrated:   ${stats.already_migrated}`);
    console.log(`  no_sample_album:    ${stats.no_sample_album}`);
    console.log(`  not_bundled_sample: ${stats.not_bundled_sample}`);
    console.log(`  inner_encrypted:    ${stats.inner_encrypted}`);
    if (stats.other) console.log(`  other:              ${stats.other}`);
  } finally {
    await pool.end();
  }
}

void main().catch((err) => {
  console.error('Migration failed:', err?.message || err);
  process.exit(1);
});
