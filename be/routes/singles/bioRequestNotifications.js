import pool from '../../db/connection.js';
import { resolveRequestsAppSchema } from './resolveRequestsAppSchema.js';
import { buildIncomingBioRequestBellMessage } from '../../lib/bioRequestNotificationEmail.js';
import { buildSinglesActiveStatusWhereSql } from './memberVisibility.js';
import { APPROVAL_STATUS_NO_RESPONSE_SQL_IN } from '../../utils/approvalStatusEnum.js';

let bioRequestNotificationSchemaPromise = null;

async function ensureBioRequestNotificationSchemaReady() {
  if (bioRequestNotificationSchemaPromise) return bioRequestNotificationSchemaPromise;
  bioRequestNotificationSchemaPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS helloworldjunktest.user_bio_request_notification_dismissed (
        singles_id bigint NOT NULL,
        requester_singles_id bigint NOT NULL,
        dismissed_at timestamptz NOT NULL DEFAULT NOW(),
        PRIMARY KEY (singles_id, requester_singles_id)
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_bio_request_notification_dismissed_singles
      ON helloworldjunktest.user_bio_request_notification_dismissed (singles_id, dismissed_at DESC)
    `);
  })().catch((err) => {
    bioRequestNotificationSchemaPromise = null;
    throw err;
  });
  return bioRequestNotificationSchemaPromise;
}

function formatMemberLabel(row, fallback = 'Member') {
  const name = String(row?.alias ?? '').trim();
  const code =
    row?.prefix != null && row?.member_id != null && String(row.member_id).trim() !== ''
      ? `${String(row.prefix).trim()}${String(row.member_id).trim()}`
      : '';
  if (name && code) return `${name} (${code})`;
  if (name) return name;
  if (code) return code;
  return fallback;
}

function isRequestedFlag(value) {
  return String(value ?? '').trim().toLowerCase() === 'requested';
}

export async function clearBioRequestNotificationDismissed(recipientSinglesId, requesterSinglesId) {
  const recipient = Number(recipientSinglesId);
  const requester = Number(requesterSinglesId);
  if (!Number.isFinite(recipient) || recipient < 1 || !Number.isFinite(requester) || requester < 1) return;
  await ensureBioRequestNotificationSchemaReady();
  await pool.query(
    `DELETE FROM helloworldjunktest.user_bio_request_notification_dismissed
     WHERE singles_id = $1 AND requester_singles_id = $2`,
    [recipient, requester]
  );
}

/** GET /api/bioRequests/notifications — pending incoming brief/full bio requests for bell. */
export async function getBioRequestNotifications(req, res) {
  const me = Number(req.auth?.singles_id);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    await ensureBioRequestNotificationSchemaReady();
    const schemaName = await resolveRequestsAppSchema();

    const { rows: meRows } = await pool.query(
      `SELECT alias, prefix, member_id FROM ${schemaName}.singles WHERE singles_id = $1 LIMIT 1`,
      [me]
    );
    const recipientLabel = formatMemberLabel(meRows[0], 'you');

    const result = await pool.query(
      `SELECT
         r.singles_id_from AS requester_singles_id,
         COALESCE(r.updated_at, r.created_at) AS created_at,
         s_from.alias,
         s_from.prefix,
         s_from.member_id,
         LOWER(BTRIM(COALESCE(r.brief_bio_request::text, 'notrequested'))) AS brief_bio_request,
         LOWER(BTRIM(COALESCE(r.full_bio_request::text, 'notrequested'))) AS full_bio_request
       FROM ${schemaName}.requests r
       JOIN ${schemaName}.singles s_from ON s_from.singles_id = r.singles_id_from
       WHERE r.singles_id_to = $1
         AND ${buildSinglesActiveStatusWhereSql('s_from')}
         AND NOT EXISTS (
           SELECT 1
           FROM helloworldjunktest.user_bio_request_notification_dismissed d
           WHERE d.singles_id = $1
             AND d.requester_singles_id = r.singles_id_from
         )
         AND (
           (
             LOWER(BTRIM(COALESCE(r.brief_bio_request::text, 'notrequested'))) = 'requested'
             AND LOWER(BTRIM(COALESCE(r.brief_bio_request_approval::text, 'noresponse'))) IN ${APPROVAL_STATUS_NO_RESPONSE_SQL_IN}
           )
           OR (
             LOWER(BTRIM(COALESCE(r.full_bio_request::text, 'notrequested'))) = 'requested'
             AND LOWER(BTRIM(COALESCE(r.full_bio_request_approval::text, 'noresponse'))) IN ${APPROVAL_STATUS_NO_RESPONSE_SQL_IN}
           )
         )
       ORDER BY COALESCE(r.updated_at, r.created_at) DESC, r.singles_id_from DESC
       LIMIT 20`,
      [me]
    );

    return res.json({
      notifications: (result.rows || []).map((row) => {
        const briefRequested = isRequestedFlag(row.brief_bio_request);
        const fullRequested = isRequestedFlag(row.full_bio_request);
        const requesterLabel = formatMemberLabel(row);
        return {
          requester_singles_id: Number(row.requester_singles_id),
          created_at: row.created_at ?? null,
          alias: row.alias ?? null,
          prefix: row.prefix ?? null,
          member_id: row.member_id ?? null,
          brief_bio_request: briefRequested ? 'requested' : 'notrequested',
          full_bio_request: fullRequested ? 'requested' : 'notrequested',
          message: buildIncomingBioRequestBellMessage({
            requesterLabel,
            recipientLabel,
            briefRequested,
            fullRequested
          })
        };
      })
    });
  } catch (error) {
    console.error('getBioRequestNotifications error:', error);
    return res.status(500).json({ error: 'Failed to load bio request notifications' });
  }
}

/** GET /api/bioRequests/pendingCount — unanswered brief/full requests for sidebar badge. */
export async function getReceivedBioRequestsPendingCount(req, res) {
  const me = Number(req.auth?.singles_id);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const schemaName = await resolveRequestsAppSchema();
    const result = await pool.query(
      `SELECT COALESCE(SUM(
         (CASE
            WHEN LOWER(BTRIM(COALESCE(r.brief_bio_request::text, 'notrequested'))) = 'requested'
             AND LOWER(BTRIM(COALESCE(r.brief_bio_request_approval::text, 'noresponse'))) IN ${APPROVAL_STATUS_NO_RESPONSE_SQL_IN}
            THEN 1 ELSE 0 END)
         +
         (CASE
            WHEN LOWER(BTRIM(COALESCE(r.full_bio_request::text, 'notrequested'))) = 'requested'
             AND LOWER(BTRIM(COALESCE(r.full_bio_request_approval::text, 'noresponse'))) IN ${APPROVAL_STATUS_NO_RESPONSE_SQL_IN}
            THEN 1 ELSE 0 END)
       ), 0)::int AS pending_count
       FROM ${schemaName}.requests r
       JOIN ${schemaName}.singles s_from ON s_from.singles_id = r.singles_id_from
       WHERE r.singles_id_to = $1
         AND ${buildSinglesActiveStatusWhereSql('s_from')}`,
      [me]
    );
    const pendingCount = Number(result.rows[0]?.pending_count ?? 0);
    return res.json({ pending_count: Number.isFinite(pendingCount) && pendingCount > 0 ? pendingCount : 0 });
  } catch (error) {
    console.error('getReceivedBioRequestsPendingCount error:', error);
    return res.status(500).json({ error: 'Failed to load bio request pending count' });
  }
}

export async function dismissBioRequestNotification(req, res) {
  const me = Number(req.auth?.singles_id);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const requesterSinglesId = Number(req.body?.requesterSinglesId ?? req.body?.requester_singles_id);
  if (!Number.isFinite(requesterSinglesId) || requesterSinglesId < 1) {
    return res.status(400).json({ error: 'Invalid requester singles id' });
  }
  try {
    await ensureBioRequestNotificationSchemaReady();
    await pool.query(
      `INSERT INTO helloworldjunktest.user_bio_request_notification_dismissed
         (singles_id, requester_singles_id, dismissed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (singles_id, requester_singles_id)
       DO UPDATE SET dismissed_at = EXCLUDED.dismissed_at`,
      [me, requesterSinglesId]
    );
    return res.json({ ok: true });
  } catch (error) {
    console.error('dismissBioRequestNotification error:', error);
    return res.status(500).json({ error: 'Failed to dismiss bio request notification' });
  }
}

export async function dismissAllBioRequestNotifications(req, res) {
  const me = Number(req.auth?.singles_id);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const requesterIdsRaw = Array.isArray(req.body?.requesterSinglesIds) ? req.body.requesterSinglesIds : [];
  const requesterIds = [...new Set(requesterIdsRaw.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0))];
  try {
    await ensureBioRequestNotificationSchemaReady();
    if (requesterIds.length) {
      await pool.query(
        `INSERT INTO helloworldjunktest.user_bio_request_notification_dismissed
           (singles_id, requester_singles_id, dismissed_at)
         SELECT $1, unnest($2::bigint[]), NOW()
         ON CONFLICT (singles_id, requester_singles_id)
         DO UPDATE SET dismissed_at = EXCLUDED.dismissed_at`,
        [me, requesterIds]
      );
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error('dismissAllBioRequestNotifications error:', error);
    return res.status(500).json({ error: 'Failed to dismiss bio request notifications' });
  }
}
