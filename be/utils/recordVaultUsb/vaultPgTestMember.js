/**
 * Test helper: borrow a dev-DB member that has no TutaNotes vault index, give it an empty
 * one, and remove it again afterwards. Returns null when Postgres is unreachable.
 */
import fs from 'node:fs';

import pool from '../../db/connection.js';
import { tutaDriveNotesMountPath } from '../tutaDriveMemberPaths.js';
import {
  NOTES_VAULT_TABLES as T,
  VaultPgDb,
  createNotesMemberVault,
  deleteNotesMemberVault
} from './vaultPgStore.js';

/** Never borrow a member who has a TutaNotes vault folder or an open vault session. */
function hasTutaNotesFolder(memberId) {
  if (!memberId) return false;
  try {
    return fs.existsSync(tutaDriveNotesMountPath(memberId));
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
    row = rows.find((r) => !hasTutaNotesFolder(Number(r.member_id)));
  } catch {
    return null;
  }
  if (!row) return null;
  const singlesId = Number(row.singles_id);
  const db = new VaultPgDb(singlesId);
  return {
    singlesId,
    db,
    /** Start from an empty notes index. */
    reset: () => db.tx((tx) => createNotesMemberVault(tx, { vaultId: 'test-vault', source: 'seed' })),
    release: async () => {
      await deleteNotesMemberVault(singlesId);
      await pool.end();
    }
  };
}
