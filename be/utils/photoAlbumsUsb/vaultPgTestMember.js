/**
 * Test helper: borrow a dev-DB member that has no TutaPhoto album index, give it an empty
 * one, and remove it again afterwards. Returns null when Postgres is unreachable.
 */
import fs from 'node:fs';

import pool from '../../db/connection.js';
import { tutaDrivePhotoAlbumsMountPath } from '../tutaDriveMemberPaths.js';
import {
  PHOTO_ALBUMS_VAULT_TABLES as T,
  VaultPgDb,
  createPhotoAlbumsMemberVault,
  deletePhotoAlbumsMemberVault
} from './vaultPgStore.js';

/** Never borrow a member who has a TutaPhoto vault folder or an open vault session. */
function hasTutaPhotoFolder(memberId) {
  if (!memberId) return false;
  try {
    return fs.existsSync(tutaDrivePhotoAlbumsMountPath(memberId));
  } catch {
    return true;
  }
}

export async function acquireTestVaultMember() {
  let row;
  try {
    const { rows } = await pool.query(
      `SELECT s.singles_id, s.member_id
         FROM outdateddbsnapshotoct2024.singles s
        WHERE NOT EXISTS (SELECT 1 FROM ${T.memberVault} mv WHERE mv.singles_id = s.singles_id)
          AND NOT EXISTS (
            SELECT 1 FROM outdateddbsnapshotoct2024.vault_cluster_state v WHERE v.singles_id = s.singles_id
          )
        ORDER BY s.singles_id DESC`
    );
    row = rows.find((r) => !hasTutaPhotoFolder(Number(r.member_id)));
  } catch {
    return null;
  }
  if (!row) return null;
  const singlesId = Number(row.singles_id);
  const db = new VaultPgDb(singlesId);
  return {
    singlesId,
    db,
    /** Start from an empty album index. */
    reset: () => db.tx((tx) => createPhotoAlbumsMemberVault(tx, { vaultId: 'test-vault', source: 'seed' })),
    release: async () => {
      await deletePhotoAlbumsMemberVault(singlesId);
      await pool.end();
    }
  };
}
