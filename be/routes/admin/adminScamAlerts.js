import pool from '../../db/connection.js';
import { listScamAlerts, runChatScamScan, updateScamAlert } from '../../utils/chatScamDetect.js';
import { allowSinglesMutationForId } from '../../utils/systemToolsAdmin.js';
import { recordAuditRegistrationSinglesStatusChange } from '../../utils/insertAuditRegistration.js';
import { invalidateAuthUserCache } from '../../utils/authUserLookupCache.js';

const T_SINGLES = 'outdateddbsnapshotoct2024.singles';
const T_LOCK = 'outdateddbsnapshotoct2024.singles_suspend_lock';

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

/** GET /api/admin/scam-alerts?status=open|confirmed|dismissed */
export async function getAdminScamAlerts(req, res) {
  try {
    const alerts = await listScamAlerts({ status: req.query?.status, limit: req.query?.limit });
    return res.json({ alerts });
  } catch (err) {
    console.error('[adminScamAlerts] list failed:', err?.message || err);
    return res.status(500).json({ error: 'Failed to load scam alerts' });
  }
}

/** PATCH /api/admin/scam-alerts/:scamAlertId  { status?, admin_note? } */
export async function patchAdminScamAlert(req, res) {
  try {
    const row = await updateScamAlert(req.params?.scamAlertId, {
      status: req.body?.status,
      adminNote: req.body?.admin_note
    });
    return res.json({ alert: row });
  } catch (err) {
    const statusCode = Number(err?.statusCode) || 500;
    if (statusCode >= 500) console.error('[adminScamAlerts] update failed:', err?.message || err);
    return res.status(statusCode).json({ error: statusCode < 500 ? err.message : 'Failed to update scam alert' });
  }
}

/**
 * POST /api/admin/scam-alerts/suspend  { singlesId, suspend: boolean, scamAlertId? }
 * suspend=true pins singles.status to 'suspend' (DB trigger blocks every other writer);
 * suspend=false removes the lock and restores the status saved when it was locked.
 */
export async function postAdminScamSuspend(req, res) {
  const singlesId = toInt(req.body?.singlesId);
  if (!singlesId) return res.status(400).json({ error: 'singlesId is required' });
  const suspend = req.body?.suspend === true;
  if (!(await allowSinglesMutationForId(res, singlesId))) return undefined;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT singles_id, status::text AS status, email, phone FROM ${T_SINGLES} WHERE singles_id = $1 FOR UPDATE`,
      [singlesId]
    );
    const member = rows[0];
    if (!member) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Singles row not found' });
    }

    let nextStatus = member.status;
    if (suspend) {
      await client.query(
        `INSERT INTO ${T_LOCK} (singles_id, prev_status, scam_alert_id, locked_by_singles_id)
         VALUES ($1, $2::outdateddbsnapshotoct2024.singles_status, $3, $4)
         ON CONFLICT (singles_id) DO NOTHING`,
        [singlesId, member.status, toInt(req.body?.scamAlertId), toInt(req.auth?.singles_id)]
      );
      nextStatus = 'suspend';
    } else {
      const removed = await client.query(
        `DELETE FROM ${T_LOCK} WHERE singles_id = $1 RETURNING prev_status::text AS prev_status`,
        [singlesId]
      );
      if (removed.rowCount && removed.rows[0].prev_status) nextStatus = removed.rows[0].prev_status;
    }

    if (nextStatus !== member.status) {
      await client.query(
        `UPDATE ${T_SINGLES}
            SET status = $1::outdateddbsnapshotoct2024.singles_status, updated_at = CURRENT_TIMESTAMP
          WHERE singles_id = $2`,
        [nextStatus, singlesId]
      );
      await recordAuditRegistrationSinglesStatusChange(client, {
        singlesId,
        singlesStatus: nextStatus,
        email: member.email,
        phone: member.phone
      });
    }
    await client.query('COMMIT');
    await invalidateAuthUserCache(singlesId);
    return res.json({ singlesId, suspendLocked: suspend, status: nextStatus });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[adminScamAlerts] suspend toggle failed:', err?.message || err);
    return res.status(500).json({ error: 'Failed to update suspend' });
  } finally {
    client.release();
  }
}

/**
 * POST /api/admin/scam-alerts/scan  { singlesIdA, singlesIdB }
 * Scan one conversation right now (bypasses "already scanned"), e.g. for an existing chat.
 */
export async function postAdminScamScan(req, res) {
  const a = toInt(req.body?.singlesIdA);
  const b = toInt(req.body?.singlesIdB);
  if (!a || !b || a === b) return res.status(400).json({ error: 'Two different singles ids are required' });
  const convId = [a, b].sort((x, y) => x - y).join('_');
  try {
    const exists = await pool.query(
      'SELECT 1 FROM outdateddbsnapshotoct2024.chat_log WHERE conv_id = $1 LIMIT 1',
      [convId]
    );
    if (!exists.rowCount) return res.status(404).json({ error: 'No chat between these members' });
    const result = await runChatScamScan(convId, { force: true });
    return res.json({ convId, ...result });
  } catch (err) {
    console.error('[adminScamAlerts] scan failed:', err?.message || err);
    return res.status(502).json({ error: `Scam scan failed: ${err?.message || err}` });
  }
}
