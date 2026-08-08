import pool from '../../db/connection.js';
import { booleanEnumCast, toBooleanEnumLabel } from '../../utils/booleanEnum.js';

/**
 * Next requests_id for schemas where the column is NOT NULL without a working serial default.
 * @param {string} requestSchema
 * @param {string} quotedSchema
 * @param {import('pg').Pool | import('pg').PoolClient} [db]
 */
export async function allocateRequestsId(requestSchema, quotedSchema, db = pool) {
  const seqResult = await db.query(`SELECT pg_get_serial_sequence($1, 'requests_id') AS seq_name`, [
    `${requestSchema}.requests`
  ]);
  const seqName = seqResult.rows[0]?.seq_name;
  if (seqName) {
    const next = await db.query(`SELECT nextval($1::regclass) AS next_id`, [seqName]);
    const id = Number(next.rows[0]?.next_id);
    if (Number.isFinite(id) && id >= 1) return id;
  }

  const maxResult = await db.query(
    `SELECT COALESCE(MAX(requests_id), 0) + 1 AS next_id FROM ${quotedSchema}.requests`
  );
  const id = Number(maxResult.rows[0]?.next_id);
  return Number.isFinite(id) && id >= 1 ? id : 1;
}

/**
 * Set interested=true for (from -> to), updating an existing row or inserting with requests_id.
 */
export async function upsertMarkInterested(requestSchema, from, to) {
  const quotedSchema = `"${String(requestSchema).replace(/"/g, '""')}"`;
  const cast = booleanEnumCast(requestSchema);
  const interestedTrue = toBooleanEnumLabel(true);

  const updated = await pool.query(
    `UPDATE ${quotedSchema}.requests
     SET interested = $3::${cast}, updated_at = CURRENT_TIMESTAMP
     WHERE singles_id_from = $1 AND singles_id_to = $2`,
    [from, to, interestedTrue]
  );
  if (updated.rowCount > 0) return;

  const requestsId = await allocateRequestsId(requestSchema, quotedSchema);
  try {
    await pool.query(
      `INSERT INTO ${quotedSchema}.requests (requests_id, singles_id_from, singles_id_to, interested)
       VALUES ($1, $2, $3, $4::${cast})`,
      [requestsId, from, to, interestedTrue]
    );
  } catch (insertErr) {
    if (insertErr?.code !== '23505') throw insertErr;
    const retry = await pool.query(
      `UPDATE ${quotedSchema}.requests
       SET interested = $3::${cast}, updated_at = CURRENT_TIMESTAMP
       WHERE singles_id_from = $1 AND singles_id_to = $2`,
      [from, to, interestedTrue]
    );
    if (retry.rowCount === 0) throw insertErr;
  }
}
