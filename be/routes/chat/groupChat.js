import pool from '../../db/connection.js';
import { ensureGroupChatLogQuarterlyPartitionsBeforeWrite } from '../../utils/ensureQuarterlyPartitions.js';
import { APPROVAL_STATUS_APPROVE, normalizeApprovalStatus } from '../../utils/approvalStatusEnum.js';
import { sqlBooleanEnumIsTrue } from '../../utils/booleanEnum.js';

const MAX_HISTORY = 200;
const MAX_MSG_LEN = 5000;
const GROUP_CHAT_BIO_UNLOCK_REQUIRED = 'GROUP_CHAT_BIO_UNLOCK_REQUIRED';

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function isApproveStatus(value) {
  return normalizeApprovalStatus(value) === APPROVAL_STATUS_APPROVE;
}

function formatInviteeLabel({ alias, prefix, memberId, singlesId }) {
  const aliasText = String(alias ?? '').trim();
  const member = Number(memberId);
  const code =
    Number.isFinite(member) && member >= 0
      ? `M${String(Math.trunc(member)).padStart(6, '0')}`
      : singlesId
        ? `M${String(singlesId).padStart(6, '0')}`
        : '';
  if (aliasText && code) return `${aliasText} (${code})`;
  if (aliasText) return aliasText;
  return code || 'this member';
}

/** Mutual full-bio approve = Buddies. */
async function assertMutualBuddy(me, other) {
  const result = await pool.query(
    `
    SELECT
      r_out.full_bio_request_approval AS out_approval,
      r_in.full_bio_request_approval AS in_approval
    FROM helloworldjunktest.requests r_out
    JOIN helloworldjunktest.requests r_in
      ON r_in.singles_id_from = r_out.singles_id_to
     AND r_in.singles_id_to = r_out.singles_id_from
    WHERE r_out.singles_id_from = $1
      AND r_out.singles_id_to = $2
    LIMIT 1
    `,
    [me, other]
  );
  const row = result.rows[0];
  if (!row || !isApproveStatus(row.out_approval) || !isApproveStatus(row.in_approval)) {
    const err = new Error('Invitee must be a Buddy (mutual full-bio approved)');
    err.statusCode = 400;
    throw err;
  }
}

/**
 * Group Chat invite unlock: requests.brief_paid OR requests.full_paid must be true
 * for inviter → invitee (viewed bio with tokens).
 */
async function assertGroupChatBioViewPaid(me, inviteeId) {
  const result = await pool.query(
    `
    SELECT
      s.alias,
      s.prefix,
      s.member_id,
      s.singles_id,
      r.brief_paid,
      r.full_paid,
      (${sqlBooleanEnumIsTrue('r', 'brief_paid')}) AS brief_paid_bool,
      (${sqlBooleanEnumIsTrue('r', 'full_paid')}) AS full_paid_bool
    FROM helloworldjunktest.singles s
    LEFT JOIN helloworldjunktest.requests r
      ON r.singles_id_from = $1
     AND r.singles_id_to = s.singles_id
    WHERE s.singles_id = $2
    LIMIT 1
    `,
    [me, inviteeId]
  );
  const row = result.rows[0];
  if (!row) {
    const err = new Error('Invitee not found');
    err.statusCode = 404;
    throw err;
  }
  const unlocked = Boolean(row.brief_paid_bool) || Boolean(row.full_paid_bool);
  if (unlocked) return;

  const label = formatInviteeLabel({
    alias: row.alias,
    prefix: row.prefix,
    memberId: row.member_id,
    singlesId: row.singles_id
  });
  const err = new Error(
    `Please view ${label} Bio in 'Buddies Biography' (which requires tokens) before you can Unlock Group Chat privilege.`
  );
  err.statusCode = 403;
  err.code = GROUP_CHAT_BIO_UNLOCK_REQUIRED;
  err.inviteeId = inviteeId;
  err.inviteeLabel = label;
  throw err;
}

async function getOrCreateHostGroup(me) {
  const existing = await pool.query(
    `
    SELECT group_id, created_by, title, status, created_at, updated_at
    FROM helloworldjunktest.group_chat
    WHERE created_by = $1 AND status = 'active'
    LIMIT 1
    `,
    [me]
  );
  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const inserted = await pool.query(
    `
    INSERT INTO helloworldjunktest.group_chat (created_by, title, status)
    VALUES ($1, 'Group Chat', 'active')
    RETURNING group_id, created_by, title, status, created_at, updated_at
    `,
    [me]
  );
  const group = inserted.rows[0];
  await pool.query(
    `
    INSERT INTO helloworldjunktest.group_chat_member (group_id, singles_id, role, status)
    VALUES ($1, $2, 'host', 'active')
    ON CONFLICT (group_id, singles_id)
    DO UPDATE SET role = 'host', status = 'active', left_at = NULL, joined_at = NOW()
    `,
    [group.group_id, me]
  );
  return group;
}

async function assertActiveMember(groupId, singlesId) {
  const result = await pool.query(
    `
    SELECT 1
    FROM helloworldjunktest.group_chat_member
    WHERE group_id = $1 AND singles_id = $2 AND status = 'active'
    LIMIT 1
    `,
    [groupId, singlesId]
  );
  if (!result.rows[0]) {
    const err = new Error('Not an active member of this group chat');
    err.statusCode = 403;
    throw err;
  }
}

function mapMessageRows(rows, me) {
  return rows.map((row) => ({
    id: Number(row.msg_id),
    senderId: Number(row.sender_id),
    sender: Number(row.sender_id) === Number(me) ? 'me' : 'friend',
    text: row.msg_text,
    sentAt: row.created_at,
    alias: row.alias ?? null,
    prefix: row.prefix ?? null,
    memberId: row.member_id ?? null,
    profileImageFk: row.profile_image_fk ?? null
  }));
}

/** GET /api/group-chat/mine — host group + members + pending outbound invites. */
export async function getMyGroupChat(req, res) {
  const me = toInt(req.auth?.singles_id);
  if (!me) return res.status(401).json({ error: 'Authentication required' });

  try {
    const group = await getOrCreateHostGroup(me);
    const members = await pool.query(
      `
      SELECT
        m.singles_id,
        m.role,
        m.status,
        m.joined_at,
        s.alias,
        s.prefix,
        s.member_id,
        s.profile_image_fk
      FROM helloworldjunktest.group_chat_member m
      JOIN helloworldjunktest.singles s ON s.singles_id = m.singles_id
      WHERE m.group_id = $1 AND m.status = 'active'
      ORDER BY CASE WHEN m.role = 'host' THEN 0 ELSE 1 END, m.joined_at ASC
      `,
      [group.group_id]
    );
    const outboundPending = await pool.query(
      `
      SELECT
        i.invite_id,
        i.invitee_id,
        i.status,
        i.created_at,
        s.alias,
        s.prefix,
        s.member_id,
        s.profile_image_fk
      FROM helloworldjunktest.group_chat_invite i
      JOIN helloworldjunktest.singles s ON s.singles_id = i.invitee_id
      WHERE i.group_id = $1 AND i.status = 'pending'
      ORDER BY i.created_at DESC
      `,
      [group.group_id]
    );
    return res.status(200).json({
      group: {
        groupId: Number(group.group_id),
        createdBy: Number(group.created_by),
        title: group.title,
        status: group.status,
        updatedAt: group.updated_at
      },
      members: members.rows.map((r) => ({
        singlesId: Number(r.singles_id),
        role: r.role,
        status: r.status,
        joinedAt: r.joined_at,
        alias: r.alias,
        prefix: r.prefix,
        memberId: r.member_id,
        profileImageFk: r.profile_image_fk
      })),
      pendingInvites: outboundPending.rows.map((r) => ({
        inviteId: Number(r.invite_id),
        inviteeId: Number(r.invitee_id),
        status: r.status,
        createdAt: r.created_at,
        alias: r.alias,
        prefix: r.prefix,
        memberId: r.member_id,
        profileImageFk: r.profile_image_fk
      }))
    });
  } catch (error) {
    console.error('[group-chat] getMyGroupChat failed:', error);
    return res.status(500).json({ error: 'Failed to load group chat' });
  }
}

/** GET /api/group-chat/invite-candidates — Buddies not already members / pending. */
export async function getGroupChatInviteCandidates(req, res) {
  const me = toInt(req.auth?.singles_id);
  if (!me) return res.status(401).json({ error: 'Authentication required' });

  try {
    const group = await getOrCreateHostGroup(me);
    const result = await pool.query(
      `
      SELECT
        s.singles_id,
        s.alias,
        s.prefix,
        s.member_id,
        s.profile_image_fk
      FROM helloworldjunktest.requests r_out
      JOIN helloworldjunktest.requests r_in
        ON r_in.singles_id_from = r_out.singles_id_to
       AND r_in.singles_id_to = r_out.singles_id_from
      JOIN helloworldjunktest.singles s ON s.singles_id = r_out.singles_id_to
      WHERE r_out.singles_id_from = $1
        AND LOWER(BTRIM(COALESCE(r_out.full_bio_request_approval::text, ''))) IN ('approve', 'approved', 'true', 'yes', '1')
        AND LOWER(BTRIM(COALESCE(r_in.full_bio_request_approval::text, ''))) IN ('approve', 'approved', 'true', 'yes', '1')
        AND NOT EXISTS (
          SELECT 1 FROM helloworldjunktest.group_chat_member m
          WHERE m.group_id = $2 AND m.singles_id = s.singles_id AND m.status = 'active'
        )
        AND NOT EXISTS (
          SELECT 1 FROM helloworldjunktest.group_chat_invite i
          WHERE i.group_id = $2 AND i.invitee_id = s.singles_id AND i.status = 'pending'
        )
      ORDER BY LOWER(COALESCE(s.alias, '')), s.singles_id
      `,
      [me, group.group_id]
    );
    return res.status(200).json({
      groupId: Number(group.group_id),
      candidates: result.rows.map((r) => ({
        singlesId: Number(r.singles_id),
        alias: r.alias,
        prefix: r.prefix,
        memberId: r.member_id,
        profileImageFk: r.profile_image_fk
      }))
    });
  } catch (error) {
    console.error('[group-chat] getGroupChatInviteCandidates failed:', error);
    return res.status(500).json({ error: 'Failed to load invite candidates' });
  }
}

/** POST /api/group-chat/invite { inviteeId } */
export async function postGroupChatInvite(req, res) {
  const me = toInt(req.auth?.singles_id);
  const inviteeId = toInt(req.body?.inviteeId);
  if (!me) return res.status(401).json({ error: 'Authentication required' });
  if (!inviteeId) return res.status(400).json({ error: 'inviteeId is required' });
  if (inviteeId === me) return res.status(400).json({ error: 'Cannot invite yourself' });

  try {
    await assertMutualBuddy(me, inviteeId);
    await assertGroupChatBioViewPaid(me, inviteeId);
    const group = await getOrCreateHostGroup(me);

    const memberCheck = await pool.query(
      `
      SELECT status FROM helloworldjunktest.group_chat_member
      WHERE group_id = $1 AND singles_id = $2
      LIMIT 1
      `,
      [group.group_id, inviteeId]
    );
    if (memberCheck.rows[0]?.status === 'active') {
      return res.status(409).json({ error: 'Already a group member' });
    }

    const inserted = await pool.query(
      `
      INSERT INTO helloworldjunktest.group_chat_invite (group_id, inviter_id, invitee_id, status)
      VALUES ($1, $2, $3, 'pending')
      ON CONFLICT (group_id, invitee_id) WHERE status = 'pending'
      DO NOTHING
      RETURNING invite_id, group_id, inviter_id, invitee_id, status, created_at
      `,
      [group.group_id, me, inviteeId]
    );

    if (!inserted.rows[0]) {
      // Unique pending index conflict
      return res.status(409).json({ error: 'Invite already pending for this buddy' });
    }

    const row = inserted.rows[0];
    return res.status(201).json({
      inviteId: Number(row.invite_id),
      groupId: Number(row.group_id),
      inviterId: Number(row.inviter_id),
      inviteeId: Number(row.invitee_id),
      status: row.status,
      createdAt: row.created_at
    });
  } catch (error) {
    console.error('[group-chat] postGroupChatInvite failed:', error);
    const statusCode = Number(error?.statusCode) || 500;
    const message = statusCode < 500 ? error?.message || 'Failed to send invite' : 'Failed to send invite';
    const body = { error: message };
    if (error?.code) body.code = error.code;
    if (error?.inviteeId) body.inviteeId = error.inviteeId;
    if (error?.inviteeLabel) body.inviteeLabel = error.inviteeLabel;
    return res.status(statusCode).json(body);
  }
}

/** GET /api/group-chat/invites/pending — invites sent TO me. */
export async function getPendingGroupChatInvites(req, res) {
  const me = toInt(req.auth?.singles_id);
  if (!me) return res.status(401).json({ error: 'Authentication required' });

  try {
    const result = await pool.query(
      `
      SELECT
        i.invite_id,
        i.group_id,
        i.inviter_id,
        i.status,
        i.created_at,
        s.alias,
        s.prefix,
        s.member_id,
        s.profile_image_fk,
        g.title
      FROM helloworldjunktest.group_chat_invite i
      JOIN helloworldjunktest.group_chat g ON g.group_id = i.group_id
      JOIN helloworldjunktest.singles s ON s.singles_id = i.inviter_id
      WHERE i.invitee_id = $1 AND i.status = 'pending'
      ORDER BY i.created_at DESC
      `,
      [me]
    );
    return res.status(200).json({
      invites: result.rows.map((r) => ({
        inviteId: Number(r.invite_id),
        groupId: Number(r.group_id),
        inviterId: Number(r.inviter_id),
        status: r.status,
        createdAt: r.created_at,
        title: r.title,
        alias: r.alias,
        prefix: r.prefix,
        memberId: r.member_id,
        profileImageFk: r.profile_image_fk
      }))
    });
  } catch (error) {
    console.error('[group-chat] getPendingGroupChatInvites failed:', error);
    return res.status(500).json({ error: 'Failed to load pending invites' });
  }
}

/** POST /api/group-chat/invite/:inviteId/accept */
export async function postAcceptGroupChatInvite(req, res) {
  const me = toInt(req.auth?.singles_id);
  const inviteId = toInt(req.params?.inviteId);
  if (!me) return res.status(401).json({ error: 'Authentication required' });
  if (!inviteId) return res.status(400).json({ error: 'inviteId is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inviteResult = await client.query(
      `
      SELECT invite_id, group_id, inviter_id, invitee_id, status
      FROM helloworldjunktest.group_chat_invite
      WHERE invite_id = $1
      FOR UPDATE
      `,
      [inviteId]
    );
    const invite = inviteResult.rows[0];
    if (!invite || Number(invite.invitee_id) !== me) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invite not found' });
    }
    if (invite.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Invite is already ${invite.status}` });
    }

    await client.query(
      `
      UPDATE helloworldjunktest.group_chat_invite
      SET status = 'accepted', responded_at = NOW()
      WHERE invite_id = $1
      `,
      [inviteId]
    );
    await client.query(
      `
      INSERT INTO helloworldjunktest.group_chat_member (group_id, singles_id, role, status)
      VALUES ($1, $2, 'member', 'active')
      ON CONFLICT (group_id, singles_id)
      DO UPDATE SET status = 'active', left_at = NULL, joined_at = NOW()
      `,
      [invite.group_id, me]
    );
    await client.query(
      `
      UPDATE helloworldjunktest.group_chat
      SET updated_at = NOW()
      WHERE group_id = $1
      `,
      [invite.group_id]
    );
    await client.query('COMMIT');
    return res.status(200).json({
      inviteId,
      groupId: Number(invite.group_id),
      status: 'accepted'
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    console.error('[group-chat] postAcceptGroupChatInvite failed:', error);
    return res.status(500).json({ error: 'Failed to accept invite' });
  } finally {
    client.release();
  }
}

/** POST /api/group-chat/invite/:inviteId/decline */
export async function postDeclineGroupChatInvite(req, res) {
  const me = toInt(req.auth?.singles_id);
  const inviteId = toInt(req.params?.inviteId);
  if (!me) return res.status(401).json({ error: 'Authentication required' });
  if (!inviteId) return res.status(400).json({ error: 'inviteId is required' });

  try {
    const result = await pool.query(
      `
      UPDATE helloworldjunktest.group_chat_invite
      SET status = 'declined', responded_at = NOW()
      WHERE invite_id = $1 AND invitee_id = $2 AND status = 'pending'
      RETURNING invite_id, group_id, status
      `,
      [inviteId, me]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Pending invite not found' });
    }
    return res.status(200).json({
      inviteId: Number(result.rows[0].invite_id),
      groupId: Number(result.rows[0].group_id),
      status: result.rows[0].status
    });
  } catch (error) {
    console.error('[group-chat] postDeclineGroupChatInvite failed:', error);
    return res.status(500).json({ error: 'Failed to decline invite' });
  }
}

/** GET /api/group-chat/:groupId/overview — group + members (active members only). */
export async function getGroupChatOverview(req, res) {
  const me = toInt(req.auth?.singles_id);
  const groupId = toInt(req.params?.groupId);
  if (!me) return res.status(401).json({ error: 'Authentication required' });
  if (!groupId) return res.status(400).json({ error: 'groupId is required' });

  try {
    await assertActiveMember(groupId, me);
    const groupResult = await pool.query(
      `
      SELECT group_id, created_by, title, status, created_at, updated_at
      FROM helloworldjunktest.group_chat
      WHERE group_id = $1
      LIMIT 1
      `,
      [groupId]
    );
    const group = groupResult.rows[0];
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const members = await pool.query(
      `
      SELECT
        m.singles_id,
        m.role,
        m.status,
        m.joined_at,
        s.alias,
        s.prefix,
        s.member_id,
        s.profile_image_fk
      FROM helloworldjunktest.group_chat_member m
      JOIN helloworldjunktest.singles s ON s.singles_id = m.singles_id
      WHERE m.group_id = $1 AND m.status = 'active'
      ORDER BY CASE WHEN m.role = 'host' THEN 0 ELSE 1 END, m.joined_at ASC
      `,
      [groupId]
    );

    return res.status(200).json({
      group: {
        groupId: Number(group.group_id),
        createdBy: Number(group.created_by),
        title: group.title,
        status: group.status,
        updatedAt: group.updated_at
      },
      members: members.rows.map((r) => ({
        singlesId: Number(r.singles_id),
        role: r.role,
        status: r.status,
        joinedAt: r.joined_at,
        alias: r.alias,
        prefix: r.prefix,
        memberId: r.member_id,
        profileImageFk: r.profile_image_fk
      }))
    });
  } catch (error) {
    console.error('[group-chat] getGroupChatOverview failed:', error);
    const statusCode = Number(error?.statusCode) || 500;
    const message = statusCode < 500 ? error?.message || 'Failed to load group' : 'Failed to load group';
    return res.status(statusCode).json({ error: message });
  }
}

/** GET /api/group-chat/:groupId/messages */
export async function getGroupChatMessages(req, res) {
  const me = toInt(req.auth?.singles_id);
  const groupId = toInt(req.params?.groupId);
  const limitRaw = Number(req.query?.limit);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.trunc(limitRaw))) : MAX_HISTORY;

  if (!me) return res.status(401).json({ error: 'Authentication required' });
  if (!groupId) return res.status(400).json({ error: 'groupId is required' });

  try {
    await assertActiveMember(groupId, me);
    const result = await pool.query(
      `
      SELECT
        l.msg_id,
        l.sender_id,
        l.msg_text,
        l.created_at,
        s.alias,
        s.prefix,
        s.member_id,
        s.profile_image_fk
      FROM helloworldjunktest.group_chat_log l
      JOIN helloworldjunktest.singles s ON s.singles_id = l.sender_id
      WHERE l.group_id = $1
      ORDER BY l.created_at DESC, l.msg_id DESC
      LIMIT $2
      `,
      [groupId, limit]
    );
    const messages = mapMessageRows([...result.rows].reverse(), me);
    return res.status(200).json({ groupId, messages });
  } catch (error) {
    console.error('[group-chat] getGroupChatMessages failed:', error);
    const statusCode = Number(error?.statusCode) || 500;
    const message = statusCode < 500 ? error?.message || 'Failed to load messages' : 'Failed to load messages';
    return res.status(statusCode).json({ error: message });
  }
}

/** POST /api/group-chat/:groupId/send { text } — one row; members read via membership. */
export async function postGroupChatMessage(req, res) {
  const me = toInt(req.auth?.singles_id);
  const groupId = toInt(req.params?.groupId);
  const text = String(req.body?.text ?? '')
    .trim()
    .normalize('NFC');

  if (!me) return res.status(401).json({ error: 'Authentication required' });
  if (!groupId) return res.status(400).json({ error: 'groupId is required' });
  if (!text) return res.status(400).json({ error: 'text is required' });
  if (text.length > MAX_MSG_LEN) return res.status(400).json({ error: 'text too long' });

  try {
    await assertActiveMember(groupId, me);
    await ensureGroupChatLogQuarterlyPartitionsBeforeWrite();
    const inserted = await pool.query(
      `
      INSERT INTO helloworldjunktest.group_chat_log (group_id, sender_id, msg_text, msg_data)
      VALUES ($1, $2, $3, $4::jsonb)
      RETURNING msg_id, sender_id, msg_text, created_at
      `,
      [groupId, me, text, JSON.stringify({ from: me, groupId })]
    );
    await pool.query(
      `
      UPDATE helloworldjunktest.group_chat
      SET updated_at = NOW()
      WHERE group_id = $1
      `,
      [groupId]
    );
    return res.status(201).json({
      groupId,
      message: mapMessageRows(inserted.rows, me)[0]
    });
  } catch (error) {
    console.error('[group-chat] postGroupChatMessage failed:', error);
    const statusCode = Number(error?.statusCode) || 500;
    const message = statusCode < 500 ? error?.message || 'Failed to send message' : 'Failed to send message';
    return res.status(statusCode).json({ error: message });
  }
}

/** POST /api/group-chat/:groupId/markVisited */
export async function postGroupChatMarkVisited(req, res) {
  const me = toInt(req.auth?.singles_id);
  const groupId = toInt(req.params?.groupId);
  if (!me) return res.status(401).json({ error: 'Authentication required' });
  if (!groupId) return res.status(400).json({ error: 'groupId is required' });

  try {
    await assertActiveMember(groupId, me);
    await pool.query(
      `
      INSERT INTO helloworldjunktest.group_chat_read_state (singles_id, group_id, last_read_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (singles_id, group_id)
      DO UPDATE SET last_read_at = EXCLUDED.last_read_at
      `,
      [me, groupId]
    );
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[group-chat] postGroupChatMarkVisited failed:', error);
    const statusCode = Number(error?.statusCode) || 500;
    const message = statusCode < 500 ? error?.message || 'Failed to mark visited' : 'Failed to mark visited';
    return res.status(statusCode).json({ error: message });
  }
}

/** Groups I belong to (host or member) — for UI switcher later. */
export async function getMyGroupChatMemberships(req, res) {
  const me = toInt(req.auth?.singles_id);
  if (!me) return res.status(401).json({ error: 'Authentication required' });

  try {
    const result = await pool.query(
      `
      SELECT
        g.group_id,
        g.created_by,
        g.title,
        g.status,
        g.updated_at,
        m.role
      FROM helloworldjunktest.group_chat_member m
      JOIN helloworldjunktest.group_chat g ON g.group_id = m.group_id
      WHERE m.singles_id = $1 AND m.status = 'active' AND g.status = 'active'
      ORDER BY g.updated_at DESC
      `,
      [me]
    );
    return res.status(200).json({
      groups: result.rows.map((r) => ({
        groupId: Number(r.group_id),
        createdBy: Number(r.created_by),
        title: r.title,
        status: r.status,
        updatedAt: r.updated_at,
        role: r.role
      }))
    });
  } catch (error) {
    console.error('[group-chat] getMyGroupChatMemberships failed:', error);
    return res.status(500).json({ error: 'Failed to load group memberships' });
  }
}
