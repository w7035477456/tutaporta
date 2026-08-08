import pool from '../../db/connection.js';
import { getDBSchema } from '../../config/envConfig.js';
import { ensureChatLogQuarterlyPartitionsBeforeWrite } from '../../utils/ensureQuarterlyPartitions.js';

const MAX_HISTORY_PER_FRIEND = 200;

const SEND_MESSAGE_NOT_APPROVED_ERROR = 'Error, user have not approved viewing bio.  Once view bio approved, you can then send message.';

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function getConversationId(userA, userB) {
  return [Number(userA), Number(userB)].sort((a, b) => a - b).join('_');
}

function getChatSchemaSqlIdent() {
  return String(getDBSchema() || 'public').replace(/"/g, '""');
}

async function ensureChatLogPartitionsBeforeWrite() {
  await ensureChatSchemaReady();
  await ensureChatLogQuarterlyPartitionsBeforeWrite();
}

async function enforceChatMessagingPrefixRule(senderId, targetUserId) {
  const prefixResult = await pool.query(
    `SELECT singles_id, prefix
     FROM helloworldjunktest.singles
     WHERE singles_id IN ($1, $2)`,
    [senderId, targetUserId]
  );
  const senderPrefix = Number(prefixResult.rows.find((x) => Number(x.singles_id) === Number(senderId))?.prefix);
  const targetPrefix = Number(prefixResult.rows.find((x) => Number(x.singles_id) === Number(targetUserId))?.prefix);
  const bypassTargetPrefixCheck = Number.isFinite(senderPrefix) && senderPrefix !== 0;
  if (bypassTargetPrefixCheck) return;
  if (Number.isFinite(targetPrefix) && targetPrefix === 0) return;
  const err = new Error(SEND_MESSAGE_NOT_APPROVED_ERROR);
  err.statusCode = 400;
  throw err;
}

let bootstrapPromise = null;
async function ensureChatSchemaReady() {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    const schema = getChatSchemaSqlIdent();
    await pool.query(
      `
      CREATE TABLE IF NOT EXISTS "${schema}".chat_conversation (
        conversation_id text PRIMARY KEY,
        user_low bigint NOT NULL,
        user_high bigint NOT NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (user_low, user_high)
      );
      `
    );
    await pool.query(
      `
      CREATE TABLE IF NOT EXISTS "${schema}".chat_log (
        msg_id bigserial,
        conv_id text NOT NULL,
        user1_id bigint NOT NULL,
        user2_id bigint NOT NULL,
        sender_id bigint NOT NULL,
        receiver_id bigint NOT NULL,
        msg_text text NOT NULL,
        msg_data jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        PRIMARY KEY (created_at, msg_id)
      ) PARTITION BY RANGE (created_at);
      `
    );
    await ensureChatLogQuarterlyPartitionsBeforeWrite();
    await pool.query(
      `
      CREATE INDEX IF NOT EXISTS idx_chat_perf
      ON "${schema}".chat_log (conv_id, created_at DESC, msg_id DESC);
      `
    );
    await pool.query(
      `
      CREATE TABLE IF NOT EXISTS "${schema}".chat_read_state (
        user_id bigint NOT NULL,
        partner_id bigint NOT NULL,
        last_read_at timestamptz NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, partner_id)
      );
      `
    );
    await pool.query(
      `
      CREATE INDEX IF NOT EXISTS idx_chat_read_state_user_id
      ON "${schema}".chat_read_state (user_id);
      `
    );
  })().catch((err) => {
    bootstrapPromise = null;
    throw err;
  });
  return bootstrapPromise;
}

function mapRowsToMessages(rows, me) {
  return rows.map((row) => ({
    id: row.msg_id,
    sender: Number(row.sender_id) === Number(me) ? 'me' : 'friend',
    text: row.msg_text,
    sentAt: row.created_at
  }));
}

/** Distinct senders with inbound messages after the user last opened that chat. */
export async function getUnreadChatSenders(userId) {
  const me = toInt(userId);
  if (!me) return [];
  await ensureChatSchemaReady();
  const result = await pool.query(
    `
    SELECT
      l.sender_id AS singles_id,
      s.prefix,
      s.member_id,
      s.alias,
      MAX(l.created_at) AS latest_message_at
    FROM helloworldjunktest.chat_log l
    JOIN helloworldjunktest.singles s ON s.singles_id = l.sender_id
    LEFT JOIN helloworldjunktest.chat_read_state r
      ON r.user_id = $1 AND r.partner_id = l.sender_id
    WHERE l.receiver_id = $1
      AND l.sender_id <> $1
      AND l.created_at > COALESCE(r.last_read_at, TIMESTAMPTZ '1970-01-01')
    GROUP BY l.sender_id, s.prefix, s.member_id, s.alias
    ORDER BY latest_message_at DESC
    `,
    [me]
  );
  return result.rows.map((row) => ({
    singles_id: Number(row.singles_id),
    prefix: row.prefix,
    member_id: row.member_id,
    alias: row.alias ?? null
  }));
}

export async function getUnreadChatSenderCount(userId) {
  const senders = await getUnreadChatSenders(userId);
  return senders.length;
}

/** Total unread inbound messages (all senders), for HUD/socket push without polling. */
export async function getUnreadChatMessageCount(userId) {
  const me = toInt(userId);
  if (!me) return 0;
  await ensureChatSchemaReady();
  const result = await pool.query(
    `
    SELECT COUNT(*)::int AS n
    FROM helloworldjunktest.chat_log l
    LEFT JOIN helloworldjunktest.chat_read_state r
      ON r.user_id = $1 AND r.partner_id = l.sender_id
    WHERE l.receiver_id = $1
      AND l.sender_id <> $1
      AND l.created_at > COALESCE(r.last_read_at, TIMESTAMPTZ '1970-01-01')
    `,
    [me]
  );
  const n = Number(result.rows[0]?.n);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

export async function markChatVisited(userId, partnerId) {
  const me = toInt(userId);
  const partner = toInt(partnerId);
  if (!me) throw new Error('Authentication required');
  if (!partner) throw new Error('partnerId is required');
  if (partner === me) return { count: 0 };
  await ensureChatSchemaReady();
  await pool.query(
    `
    INSERT INTO helloworldjunktest.chat_read_state (user_id, partner_id, last_read_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (user_id, partner_id)
    DO UPDATE SET last_read_at = EXCLUDED.last_read_at
    `,
    [me, partner]
  );
  return { count: await getUnreadChatSenderCount(me) };
}

export async function sendMessage({ senderId, targetUserId, text }) {
  const me = toInt(senderId);
  const to = toInt(targetUserId);
  const cleanText = String(text ?? '')
    .trim()
    .normalize('NFC');

  if (!me) throw new Error('Authentication required');
  if (!to) throw new Error('targetUserId is required');
  if (!cleanText) throw new Error('text is required');
  if (cleanText.length > 5000) throw new Error('text too long');

  await enforceChatMessagingPrefixRule(me, to);
  await ensureChatLogPartitionsBeforeWrite();
  const low = Math.min(me, to);
  const high = Math.max(me, to);
  const convId = getConversationId(me, to);
  const payload = { from: me, to, text: cleanText };

  await pool.query(
    `
    INSERT INTO helloworldjunktest.chat_conversation (conversation_id, user_low, user_high, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (conversation_id)
    DO UPDATE SET updated_at = EXCLUDED.updated_at
    `,
    [convId, low, high]
  );

  const inserted = await pool.query(
    `
    INSERT INTO helloworldjunktest.chat_log (conv_id, user1_id, user2_id, sender_id, receiver_id, msg_text, msg_data)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    RETURNING msg_id, sender_id, msg_text, created_at
    `,
    [convId, low, high, me, to, cleanText, JSON.stringify(payload)]
  );

  return {
    conversationId: convId,
    message: mapRowsToMessages(inserted.rows, me)[0]
  };
}

export async function sendChatMessage(req, res) {
  const me = toInt(req.auth?.singles_id);
  const targetUserId = toInt(req.body?.targetUserId);
  const text = String(req.body?.text ?? '').trim();

  if (!me) return res.status(401).json({ error: 'Authentication required' });
  if (!targetUserId) return res.status(400).json({ error: 'targetUserId is required' });
  if (!text) return res.status(400).json({ error: 'text is required' });
  if (text.length > 5000) return res.status(400).json({ error: 'text too long' });

  try {
    const result = await sendMessage({ senderId: me, targetUserId, text });
    return res.status(201).json(result);
  } catch (error) {
    console.error('[chat] sendChatMessage failed:', error);
    const statusCode = Number(error?.statusCode) || 500;
    const message = statusCode < 500 ? error?.message || 'Failed to send chat message' : 'Failed to send chat message';
    return res.status(statusCode).json({ error: message });
  }
}

export async function getChatHistory(req, res) {
  const me = toInt(req.auth?.singles_id);
  const targetUserId = toInt(req.params?.targetUserId);
  const limitRaw = Number(req.query?.limit);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.trunc(limitRaw))) : MAX_HISTORY_PER_FRIEND;
  const beforeSentAtRaw = String(req.query?.beforeSentAt ?? '').trim();
  const beforeSentAtDate = beforeSentAtRaw ? new Date(beforeSentAtRaw) : null;
  const beforeSentAt = beforeSentAtDate && !Number.isNaN(beforeSentAtDate.getTime()) ? beforeSentAtDate.toISOString() : null;
  const beforeMsgIdRaw = Number(req.query?.beforeMsgId);
  const beforeMsgId = Number.isFinite(beforeMsgIdRaw) && beforeMsgIdRaw > 0 ? Math.trunc(beforeMsgIdRaw) : null;

  if (!me) return res.status(401).json({ error: 'Authentication required' });
  if (!targetUserId) return res.status(400).json({ error: 'targetUserId is required' });

  try {
    await ensureChatSchemaReady();
    const convId = getConversationId(me, targetUserId);
    const result = await pool.query(
      `
      SELECT msg_id, sender_id, msg_text, created_at
      FROM helloworldjunktest.chat_log
      WHERE conv_id = $1
        AND (
          $3::timestamptz IS NULL
          OR $4::bigint IS NULL
          OR (created_at, msg_id) < ($3::timestamptz, $4::bigint)
        )
      ORDER BY created_at DESC, msg_id DESC
      LIMIT $2
      `,
      [convId, limit + 1, beforeSentAt, beforeMsgId]
    );
    const hasMore = result.rows.length > limit;
    const visibleRows = hasMore ? result.rows.slice(0, limit) : result.rows;
    const messages = mapRowsToMessages([...visibleRows].reverse(), me);
    const oldestRow = messages.length > 0 ? messages[0] : null;
    const nextCursor = hasMore && oldestRow
      ? {
          sentAt: oldestRow.sentAt,
          id: Number(oldestRow.id)
        }
      : null;
    return res.status(200).json({ conversationId: convId, messages, has_more: hasMore, next_cursor: nextCursor });
  } catch (error) {
    console.error('[chat] getChatHistory failed:', error);
    return res.status(500).json({ error: 'Failed to fetch chat history' });
  }
}

export async function getChatHistoryBatch(req, res) {
  const me = toInt(req.auth?.singles_id);
  const targetUserIds = Array.isArray(req.body?.targetUserIds) ? req.body.targetUserIds.map(toInt).filter(Boolean) : [];

  if (!me) return res.status(401).json({ error: 'Authentication required' });
  if (!targetUserIds.length) return res.status(200).json({ conversations: {} });

  try {
    await ensureChatSchemaReady();
    const uniqueTargetIds = [...new Set(targetUserIds)];
    const convPairs = uniqueTargetIds.map((targetUserId) => ({
      targetUserId,
      conversationId: getConversationId(me, targetUserId)
    }));
    const convIds = convPairs.map((x) => x.conversationId);

    const rows = await pool.query(
      `
      SELECT msg_id, conv_id, sender_id, msg_text, created_at
      FROM (
        SELECT
          l.msg_id,
          l.conv_id,
          l.sender_id,
          l.msg_text,
          l.created_at,
          ROW_NUMBER() OVER (PARTITION BY l.conv_id ORDER BY l.created_at DESC, l.msg_id DESC) AS rn
        FROM helloworldjunktest.chat_log l
        WHERE l.conv_id = ANY($1::text[])
      ) ranked
      WHERE rn <= $2
      ORDER BY conv_id, created_at ASC, msg_id ASC
      `,
      [convIds, MAX_HISTORY_PER_FRIEND]
    );

    const byConv = new Map(convPairs.map((p) => [p.conversationId, []]));
    for (const row of rows.rows) {
      const bucket = byConv.get(row.conv_id);
      if (!bucket) continue;
      bucket.push({
        id: row.msg_id,
        sender: Number(row.sender_id) === Number(me) ? 'me' : 'friend',
        text: row.msg_text,
        sentAt: row.created_at
      });
    }

    const conversations = {};
    for (const { targetUserId, conversationId } of convPairs) {
      conversations[String(targetUserId)] = {
        conversationId,
        messages: byConv.get(conversationId) ?? []
      };
    }

    return res.status(200).json({ conversations });
  } catch (error) {
    console.error('[chat] getChatHistoryBatch failed:', error);
    return res.status(500).json({ error: 'Failed to fetch chat history' });
  }
}

export async function getUnreadChatSenderCountHandler(req, res) {
  const me = toInt(req.auth?.singles_id);
  if (!me) return res.status(401).json({ error: 'Authentication required' });
  try {
    const senders = await getUnreadChatSenders(me);
    return res.status(200).json({ count: senders.length, senders });
  } catch (error) {
    console.error('[chat] getUnreadChatSenderCount failed:', error);
    return res.status(500).json({ error: 'Failed to fetch unread chat count' });
  }
}

/** Unread inbound chat messages (one row per message), newest first. */
export async function getUnreadChatMessagesHandler(req, res) {
  const me = toInt(req.auth?.singles_id);
  const limitRaw = Number(req.query?.limit);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.trunc(limitRaw))) : 50;
  if (!me) return res.status(401).json({ error: 'Authentication required' });
  try {
    await ensureChatSchemaReady();
    const result = await pool.query(
      `
      SELECT
        l.msg_id,
        l.sender_id AS singles_id,
        l.msg_text,
        l.created_at,
        s.prefix,
        s.member_id,
        s.alias
      FROM helloworldjunktest.chat_log l
      JOIN helloworldjunktest.singles s ON s.singles_id = l.sender_id
      LEFT JOIN helloworldjunktest.chat_read_state r
        ON r.user_id = $1 AND r.partner_id = l.sender_id
      WHERE l.receiver_id = $1
        AND l.sender_id <> $1
        AND l.created_at > COALESCE(r.last_read_at, TIMESTAMPTZ '1970-01-01')
      ORDER BY l.created_at DESC, l.msg_id DESC
      LIMIT $2
      `,
      [me, limit]
    );
    return res.status(200).json({
      messages: result.rows.map((row) => ({
        msg_id: Number(row.msg_id),
        singles_id: Number(row.singles_id),
        msg_text: row.msg_text ?? '',
        created_at: row.created_at,
        prefix: row.prefix,
        member_id: row.member_id,
        alias: row.alias ?? null
      }))
    });
  } catch (error) {
    console.error('[chat] getUnreadChatMessages failed:', error);
    return res.status(500).json({ error: 'Failed to fetch unread chat messages' });
  }
}

export async function markChatVisitedHandler(req, res) {
  const me = toInt(req.auth?.singles_id);
  const partnerId = toInt(req.params?.targetUserId);
  if (!me) return res.status(401).json({ error: 'Authentication required' });
  if (!partnerId) return res.status(400).json({ error: 'targetUserId is required' });
  try {
    const result = await markChatVisited(me, partnerId);
    return res.status(200).json(result);
  } catch (error) {
    console.error('[chat] markChatVisited failed:', error);
    const statusCode = Number(error?.statusCode) || 500;
    const message = statusCode < 500 ? error?.message || 'Failed to mark chat visited' : 'Failed to mark chat visited';
    return res.status(statusCode).json({ error: message });
  }
}

export async function getChatFriends(req, res) {
  const me = toInt(req.auth?.singles_id);
  if (!me) return res.status(401).json({ error: 'Authentication required' });

  try {
    await ensureChatSchemaReady();
    const rows = await pool.query(
      `
      SELECT
        CASE WHEN c.user_low = $1 THEN c.user_high ELSE c.user_low END AS singles_id_to,
        s.prefix,
        s.member_id,
        s.profile_image_fk,
        s.alias,
        c.updated_at
      FROM helloworldjunktest.chat_conversation c
      JOIN helloworldjunktest.singles s
        ON s.singles_id = CASE WHEN c.user_low = $1 THEN c.user_high ELSE c.user_low END
      WHERE c.user_low = $1 OR c.user_high = $1
      ORDER BY c.updated_at DESC
      `,
      [me]
    );

    return res.status(200).json(rows.rows);
  } catch (error) {
    console.error('[chat] getChatFriends failed:', error);
    return res.status(500).json({ error: 'Failed to fetch chat friends' });
  }
}
