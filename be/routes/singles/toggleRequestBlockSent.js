import pool from '../../db/connection.js';
import { resolveRequestsAppSchema } from './resolveRequestsAppSchema.js';
import { upsertRequestBlockUser } from './upsertRequestBlockUser.js';
import { parseBooleanEnumRaw } from '../../utils/booleanEnum.js';

async function getRequestColumns(schemaName) {
  const cols = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = 'requests'
       AND column_name = 'block_user'`,
    [schemaName]
  );
  return new Set(cols.rows.map((r) => r.column_name));
}

/** Outgoing request block: JWT user is singles_id_from; friend is singles_id_to. */
export async function toggleRequestBlockSent(req, res) {
  const me = Number(req.auth?.singles_id);
  const to = Number(req.body?.singles_id_to);
  const block = req.body?.block;

  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!Number.isFinite(to) || to < 1) {
    return res.status(400).json({ error: 'Invalid singles_id_to' });
  }
  if (typeof block !== 'boolean') {
    return res.status(400).json({ error: 'block must be a boolean' });
  }

  try {
    const schemaName = await resolveRequestsAppSchema();
    const has = await getRequestColumns(schemaName);
    if (!has.has('block_user')) {
      return res.status(500).json({ error: 'block_user column is missing in database schema' });
    }

    // Sender blocks friend on outgoing row: from=me, to=friend.
    const row = await upsertRequestBlockUser(schemaName, me, to, block);

    return res.status(200).json({
      ok: true,
      requests_id: row?.requests_id ?? null,
      singles_id_from: me,
      singles_id_to: to,
      block_user: parseBooleanEnumRaw(row?.block_user)
    });
  } catch (error) {
    console.error('toggleRequestBlockSent', error);
    return res.status(500).json({ error: 'Failed to update request block status' });
  }
}
