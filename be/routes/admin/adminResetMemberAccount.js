import { hardResetMemberAccount, softResetMemberAccount } from '../../utils/adminResetMemberAccount.js';
import { allowSinglesMutationForId } from '../../utils/systemToolsAdmin.js';

function parseSinglesId(raw) {
  const id = Math.trunc(Number(raw));
  return Number.isFinite(id) && id >= 1 ? id : null;
}

/**
 * POST /api/admin/singles/soft-reset
 * Body: { singlesId } — Task 1: re-init defaults without deleting user content.
 */
export async function postAdminSinglesSoftReset(req, res) {
  const singlesId = parseSinglesId(req.body?.singlesId ?? req.body?.singles_id);
  if (!singlesId) {
    return res.status(400).json({ error: 'singlesId is required.' });
  }
  if (!(await allowSinglesMutationForId(res, singlesId))) {
    return;
  }

  try {
    const result = await softResetMemberAccount(singlesId);
    return res.json(result);
  } catch (err) {
    const status = Number(err?.statusCode) || 500;
    console.error('[postAdminSinglesSoftReset]', err?.message ?? err);
    return res.status(status).json({ error: err?.message || 'Failed to soft-reset member account.' });
  }
}

/**
 * POST /api/admin/singles/hard-reset
 * Body: { singlesId } — Task 2: cascade-delete user content, then re-init defaults.
 */
export async function postAdminSinglesHardReset(req, res) {
  const singlesId = parseSinglesId(req.body?.singlesId ?? req.body?.singles_id);
  if (!singlesId) {
    return res.status(400).json({ error: 'singlesId is required.' });
  }
  if (!(await allowSinglesMutationForId(res, singlesId))) {
    return;
  }

  try {
    const result = await hardResetMemberAccount(singlesId);
    return res.json(result);
  } catch (err) {
    const status = Number(err?.statusCode) || 500;
    console.error('[postAdminSinglesHardReset]', err?.message ?? err);
    return res.status(status).json({ error: err?.message || 'Failed to hard-reset member account.' });
  }
}
