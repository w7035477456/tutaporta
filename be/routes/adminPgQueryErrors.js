import { getPgQueryErrorCounts, resetPgQueryErrorCounts } from '../db/pgQueryErrorCounts.js';

/**
 * GET /api/admin/pg-query-errors
 */
export async function getAdminPgQueryErrors(req, res) {
  try {
    const counts = await getPgQueryErrorCounts();
    return res.json({ counts });
  } catch (err) {
    console.error('[getAdminPgQueryErrors]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to load query error counts' });
  }
}

/**
 * POST /api/admin/pg-query-errors/reset
 */
export async function postAdminPgQueryErrorsReset(req, res) {
  try {
    const counts = await resetPgQueryErrorCounts();
    return res.json({ counts });
  } catch (err) {
    console.error('[postAdminPgQueryErrorsReset]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to reset query error counts' });
  }
}
