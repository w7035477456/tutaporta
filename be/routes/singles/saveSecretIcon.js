import pool from '../../db/connection.js';
import { getReqSinglesId, resolveSessionAuth } from '../../utils/resolveSessionAuth.js';
import { respondSessionInvalid } from '../../utils/sessionInvalidResponse.js';
import { verifySecretIconWithAttemptTracking } from '../../utils/secretIconAttemptTracking.js';
import { hashSecretIconName, isAllowedSecretIconName, normalizeSecretIconName } from '../../utils/secretIconHash.js';

/**
 * POST /api/settings/secretIcon — body: { iconName }
 * Saves SHA-256 hash of lowercase FA5 object icon name to singles.secret_icon.
 */
export async function saveSecretIcon(req, res) {
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

  const iconName = normalizeSecretIconName(req.body?.iconName ?? req.body?.icon);
  if (!iconName || !isAllowedSecretIconName(iconName)) {
    return res.status(400).json({ error: 'Please choose a valid security icon.' });
  }

  const secretIconHash = hashSecretIconName(iconName);
  if (!secretIconHash) {
    return res.status(400).json({ error: 'Please choose a valid security icon.' });
  }

  try {
    const result = await pool.query(
      `UPDATE helloworldjunktest.singles
       SET secret_icon = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE singles_id = $2
       RETURNING singles_id`,
      [secretIconHash, singlesId]
    );
    if (!result.rows.length) {
      return respondSessionInvalid(res);
    }
    return res.json({
      success: true,
      hasSecretIcon: true,
      iconName,
      message: 'Security icon saved.'
    });
  } catch (error) {
    console.error('[saveSecretIcon]', error);
    return res.status(500).json({ error: 'Failed to save security icon' });
  }
}

/**
 * POST /api/settings/secretIcon/verify — body: { iconName }
 * Compares hash of chosen icon to stored singles.secret_icon (for phone change, etc.).
 * Failed attempts tracked in PostgreSQL (3 per 24 hours, cluster-wide).
 */
export async function verifySecretIcon(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return respondSessionInvalid(res);
  }

  const iconName = normalizeSecretIconName(req.body?.iconName ?? req.body?.icon);
  if (!iconName) {
    return res.status(400).json({ valid: false, error: 'Please choose a valid security icon.' });
  }

  const candidateHash = hashSecretIconName(iconName);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const gate = await verifySecretIconWithAttemptTracking(client, singlesId, candidateHash);
    if (!gate.ok) {
      await client.query('COMMIT');
      return res.status(gate.response.statusCode).json(gate.response.body);
    }
    await client.query('COMMIT');
    return res.json({ valid: true });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('[verifySecretIcon]', error);
    return res.status(500).json({ valid: false, error: 'Failed to verify security icon' });
  } finally {
    client.release();
  }
}
