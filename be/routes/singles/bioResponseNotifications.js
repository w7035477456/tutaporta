import pool from '../../db/connection.js';
import { resolveRequestsAppSchema } from './resolveRequestsAppSchema.js';
import { buildSinglesActiveStatusWhereSql } from './memberVisibility.js';
import { APPROVAL_STATUS_RESPONDED_SQL_NOT_IN } from '../../utils/approvalStatusEnum.js';

let bioResponseNotificationSchemaPromise = null;

async function ensureBioResponseNotificationSchemaReady() {
  if (bioResponseNotificationSchemaPromise) return bioResponseNotificationSchemaPromise;
  bioResponseNotificationSchemaPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS helloworldjunktest.user_bio_response_notification_dismissed (
        requester_singles_id bigint NOT NULL,
        recipient_singles_id bigint NOT NULL,
        bio_kind text NOT NULL CHECK (bio_kind IN ('brief', 'full')),
        dismissed_at timestamptz NOT NULL DEFAULT NOW(),
        PRIMARY KEY (requester_singles_id, recipient_singles_id, bio_kind)
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_bio_response_notification_dismissed_requester
      ON helloworldjunktest.user_bio_response_notification_dismissed (requester_singles_id, dismissed_at DESC)
    `);
  })().catch((err) => {
    bioResponseNotificationSchemaPromise = null;
    throw err;
  });
  return bioResponseNotificationSchemaPromise;
}

function approvalTypeToBioKind(approvalType) {
  return String(approvalType ?? '').trim().toLowerCase() === 'details' ? 'full' : 'brief';
}

/** After recipient submits approve/deny, show badge again on requester side until dismissed. */
export async function clearBioResponseNotificationDismissed(requesterSinglesId, recipientSinglesId, bioKind) {
  const requester = Number(requesterSinglesId);
  const recipient = Number(recipientSinglesId);
  const kind = String(bioKind ?? '').trim().toLowerCase();
  if (!Number.isFinite(requester) || requester < 1 || !Number.isFinite(recipient) || recipient < 1) return;
  if (kind !== 'brief' && kind !== 'full') return;
  await ensureBioResponseNotificationSchemaReady();
  await pool.query(
    `DELETE FROM helloworldjunktest.user_bio_response_notification_dismissed
     WHERE requester_singles_id = $1
       AND recipient_singles_id = $2
       AND bio_kind = $3`,
    [requester, recipient, kind]
  );
}

const RESPONDED_BRIEF_SQL = `
  LOWER(BTRIM(COALESCE(r.brief_bio_request::text, 'notrequested'))) = 'requested'
  AND LOWER(BTRIM(COALESCE(r.brief_bio_request_approval::text, 'noresponse'))) NOT IN ${APPROVAL_STATUS_RESPONDED_SQL_NOT_IN}
`;

const RESPONDED_FULL_SQL = `
  LOWER(BTRIM(COALESCE(r.full_bio_request::text, 'notrequested'))) = 'requested'
  AND LOWER(BTRIM(COALESCE(r.full_bio_request_approval::text, 'noresponse'))) NOT IN ${APPROVAL_STATUS_RESPONDED_SQL_NOT_IN}
`;

/** GET /api/bioResponses/pendingCount — unread brief/full responses for Vetted Friends sidebar badge. */
export async function getVettedFriendsBioResponsePendingCount(req, res) {
  const me = Number(req.auth?.singles_id);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    await ensureBioResponseNotificationSchemaReady();
    const schemaName = await resolveRequestsAppSchema();
    const result = await pool.query(
      `SELECT COALESCE(SUM(
         (CASE
            WHEN ${RESPONDED_BRIEF_SQL}
             AND NOT EXISTS (
               SELECT 1
               FROM helloworldjunktest.user_bio_response_notification_dismissed d
               WHERE d.requester_singles_id = $1
                 AND d.recipient_singles_id = r.singles_id_to
                 AND d.bio_kind = 'brief'
             )
            THEN 1 ELSE 0 END)
         +
         (CASE
            WHEN ${RESPONDED_FULL_SQL}
             AND NOT EXISTS (
               SELECT 1
               FROM helloworldjunktest.user_bio_response_notification_dismissed d
               WHERE d.requester_singles_id = $1
                 AND d.recipient_singles_id = r.singles_id_to
                 AND d.bio_kind = 'full'
             )
            THEN 1 ELSE 0 END)
       ), 0)::int AS pending_count
       FROM ${schemaName}.requests r
       JOIN ${schemaName}.singles s_to ON s_to.singles_id = r.singles_id_to
       WHERE r.singles_id_from = $1
         AND ${buildSinglesActiveStatusWhereSql('s_to')}`,
      [me]
    );
    const pendingCount = Number(result.rows[0]?.pending_count ?? 0);
    return res.json({ pending_count: Number.isFinite(pendingCount) && pendingCount > 0 ? pendingCount : 0 });
  } catch (error) {
    console.error('getVettedFriendsBioResponsePendingCount error:', error);
    return res.status(500).json({ error: 'Failed to load bio response pending count' });
  }
}

export async function dismissBioResponseNotification(req, res) {
  const me = Number(req.auth?.singles_id);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const recipientSinglesId = Number(req.body?.recipientSinglesId ?? req.body?.recipient_singles_id);
  const bioKindRaw = String(req.body?.bioKind ?? req.body?.bio_kind ?? '').trim().toLowerCase();
  const bioKinds =
    bioKindRaw === 'brief' || bioKindRaw === 'full'
      ? [bioKindRaw]
      : Array.isArray(req.body?.bioKinds)
        ? [...new Set(req.body.bioKinds.map((v) => String(v).trim().toLowerCase()).filter((k) => k === 'brief' || k === 'full'))]
        : ['brief', 'full'];
  if (!Number.isFinite(recipientSinglesId) || recipientSinglesId < 1) {
    return res.status(400).json({ error: 'Invalid recipient singles id' });
  }
  if (!bioKinds.length) {
    return res.status(400).json({ error: 'Invalid bio kind' });
  }

  try {
    await ensureBioResponseNotificationSchemaReady();
    await pool.query(
      `INSERT INTO helloworldjunktest.user_bio_response_notification_dismissed
         (requester_singles_id, recipient_singles_id, bio_kind, dismissed_at)
       SELECT $1, $2, unnest($3::text[]), NOW()
       ON CONFLICT (requester_singles_id, recipient_singles_id, bio_kind)
       DO UPDATE SET dismissed_at = EXCLUDED.dismissed_at`,
      [me, recipientSinglesId, bioKinds]
    );
    return res.json({ ok: true });
  } catch (error) {
    console.error('dismissBioResponseNotification error:', error);
    return res.status(500).json({ error: 'Failed to dismiss bio response notification' });
  }
}

/** Mark all current unread bio responses as seen (Vetted Friends page open). */
export async function dismissAllBioResponseNotifications(req, res) {
  const me = Number(req.auth?.singles_id);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    await ensureBioResponseNotificationSchemaReady();
    const schemaName = await resolveRequestsAppSchema();
    await pool.query(
      `INSERT INTO helloworldjunktest.user_bio_response_notification_dismissed
         (requester_singles_id, recipient_singles_id, bio_kind, dismissed_at)
       SELECT $1, r.singles_id_to, 'brief', NOW()
       FROM ${schemaName}.requests r
       JOIN ${schemaName}.singles s_to ON s_to.singles_id = r.singles_id_to
       WHERE r.singles_id_from = $1
         AND ${buildSinglesActiveStatusWhereSql('s_to')}
         AND ${RESPONDED_BRIEF_SQL}
       ON CONFLICT (requester_singles_id, recipient_singles_id, bio_kind)
       DO UPDATE SET dismissed_at = EXCLUDED.dismissed_at`,
      [me]
    );
    await pool.query(
      `INSERT INTO helloworldjunktest.user_bio_response_notification_dismissed
         (requester_singles_id, recipient_singles_id, bio_kind, dismissed_at)
       SELECT $1, r.singles_id_to, 'full', NOW()
       FROM ${schemaName}.requests r
       JOIN ${schemaName}.singles s_to ON s_to.singles_id = r.singles_id_to
       WHERE r.singles_id_from = $1
         AND ${buildSinglesActiveStatusWhereSql('s_to')}
         AND ${RESPONDED_FULL_SQL}
       ON CONFLICT (requester_singles_id, recipient_singles_id, bio_kind)
       DO UPDATE SET dismissed_at = EXCLUDED.dismissed_at`,
      [me]
    );
    return res.json({ ok: true });
  } catch (error) {
    console.error('dismissAllBioResponseNotifications error:', error);
    return res.status(500).json({ error: 'Failed to dismiss bio response notifications' });
  }
}

export { approvalTypeToBioKind };
