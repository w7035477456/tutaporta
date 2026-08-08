import { verifyPassword } from './passwordHash.js';
import pool from '../db/connection.js';
import { getDBSchema } from '../config/envConfig.js';

const GLOBAL_ROW_ID = 1;

function schemaName() {
  return String(getDBSchema() || 'helloworldjunktest').replace(/"/g, '');
}

function globalTableName() {
  return `"${schemaName()}"."global"`;
}

/** Verify plain text against global.password_hash (ADMIN password). */
export async function verifyGlobalToolsPassword(plain) {
  const password = String(plain ?? '').trim();
  if (!password) return false;

  const { rows } = await pool.query(
    `SELECT password_hash FROM ${globalTableName()} WHERE id = $1 LIMIT 1`,
    [GLOBAL_ROW_ID]
  );
  const storedHash = String(rows[0]?.password_hash ?? '').trim();
  if (!storedHash) return false;

  return verifyPassword(storedHash, password);
}
