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

export async function toggleRequestBlockAboutMe(req, res) {
  const me = Number(req.auth?.singles_id);
  const from = Number(req.body?.singles_id_from);
  const block = req.body?.block;

  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!Number.isFinite(from) || from < 1) {
    return res.status(400).json({ error: 'Invalid singles_id_from' });
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

    // Recipient blocks requester on reverse row: from=me, to=requester.
    const row = await upsertRequestBlockUser(schemaName, me, from, block);

    return res.status(200).json({
      ok: true,
      requests_id: row?.requests_id ?? null,
      singles_id_from: from,
      singles_id_to: me,
      block_user: parseBooleanEnumRaw(row?.block_user)
    });
  } catch (error) {
    console.error('toggleRequestBlockAboutMe', error);
    return res.status(500).json({ error: 'Failed to update request block status' });
  }
}
