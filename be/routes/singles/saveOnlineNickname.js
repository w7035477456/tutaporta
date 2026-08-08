import pool from '../../db/connection.js';
import { getReqSinglesId, resolveSessionAuth } from '../../utils/resolveSessionAuth.js';
import { respondSessionInvalid } from '../../utils/sessionInvalidResponse.js';
import { persistMemberAlias } from '../../utils/persistMemberAlias.js';

/**
 * POST /api/settings/nickname
 * Body: { alias: string }
 * Validates alias uniqueness via helloworldjunktest.singles.alias, then saves singles.alias.
 * Uses session cookie only (no separate "authentication" step in the UI).
 */
export async function saveOnlineNickname(req, res) {
  let singlesId = getReqSinglesId(req);
  if (singlesId == null) {
    const session = await resolveSessionAuth(req);
    if (session) {
      req.auth = session;
      singlesId = session.singles_id;
    }
  }

  if (singlesId == null) {
    return respondSessionInvalid(res);
  }

  const client = await pool.connect();
  try {
    const result = await persistMemberAlias(client, singlesId, req.body?.alias);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json({
      alias: result.alias,
      message: result.message
    });
  } catch (error) {
    console.error('[saveOnlineNickname]', error);
    return res.status(500).json({ error: 'Failed to save nickname' });
  } finally {
    client.release();
  }
}
