import pool from '../../db/connection.js';
import { allocateRequestsId } from './requestsUpsert.js';
import { booleanEnumCast, toBooleanEnumLabel } from '../../utils/booleanEnum.js';

/**
 * Set block_user on directed row (singles_id_from -> singles_id_to), upserting when missing.
 */
export async function upsertRequestBlockUser(schemaName, from, to, block) {
  const quotedSchema = `"${String(schemaName).replace(/"/g, '""')}"`;
  const cast = booleanEnumCast(schemaName);
  const blockValue = toBooleanEnumLabel(block);

  const updated = await pool.query(
    `UPDATE ${quotedSchema}.requests
     SET block_user = $1::${cast},
         updated_at = CURRENT_TIMESTAMP
     WHERE singles_id_from = $2
       AND singles_id_to = $3
     RETURNING requests_id, singles_id_from, singles_id_to, block_user`,
    [blockValue, from, to]
  );
  if (updated.rows.length > 0) {
    return updated.rows[0];
  }

  const requestsId = await allocateRequestsId(schemaName, quotedSchema);
  try {
    const inserted = await pool.query(
      `INSERT INTO ${quotedSchema}.requests (requests_id, singles_id_from, singles_id_to, block_user)
       VALUES ($1, $2, $3, $4::${cast})
       RETURNING requests_id, singles_id_from, singles_id_to, block_user`,
      [requestsId, from, to, blockValue]
    );
    return inserted.rows[0];
  } catch (insertErr) {
    if (insertErr?.code !== '23505') throw insertErr;
    const retry = await pool.query(
      `UPDATE ${quotedSchema}.requests
       SET block_user = $1::${cast},
           updated_at = CURRENT_TIMESTAMP
       WHERE singles_id_from = $2
         AND singles_id_to = $3
       RETURNING requests_id, singles_id_from, singles_id_to, block_user`,
      [blockValue, from, to]
    );
    if (!retry.rows.length) throw insertErr;
    return retry.rows[0];
  }
}
