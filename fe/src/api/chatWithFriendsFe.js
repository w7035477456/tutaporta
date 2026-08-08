import api from './axios';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import { formatMemberLabel } from 'utils/memberLabel';
import useSWR from 'swr';
import { useMemo } from 'react';

const API_BASE_URL = getApiBaseUrl();
const CHAT_UNREAD_DEBUG_ENABLED = Boolean(import.meta.env.DEV);
let unreadSenderCountRequestCounter = 0;
let unreadSenderCountInFlight = null;

function logUnreadSenderCountDebug(step, detail) {
  if (!CHAT_UNREAD_DEBUG_ENABLED) return;
  console.info('[chat-unread-debug]', step, detail ?? '');
}

export async function fetchChatHistoryBatch(targetUserIds) {
  const ids = Array.isArray(targetUserIds)
    ? [...new Set(targetUserIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))]
    : [];
  if (!ids.length) return {};

  const { data } = await api.post('/api/chat/historyBatch', { targetUserIds: ids });
  return data?.conversations ?? {};
}

export async function fetchChatHistory(targetUserId, limit = 200) {
  const id = Number(targetUserId);
  if (!Number.isFinite(id) || id < 1) return [];
  const { data } = await api.get(`/api/chat/history/${id}`, {
    params: { limit }
  });
  return Array.isArray(data?.messages) ? data.messages : [];
}

export async function fetchChatHistoryPage(targetUserId, options = {}) {
  const id = Number(targetUserId);
  if (!Number.isFinite(id) || id < 1) return { messages: [], has_more: false, next_cursor: null };
  const limitRaw = Number(options?.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.trunc(limitRaw) : 5;
  const params = { limit };
  const beforeSentAt = String(options?.beforeSentAt ?? '').trim();
  if (beforeSentAt) params.beforeSentAt = beforeSentAt;
  const beforeMsgIdRaw = Number(options?.beforeMsgId);
  if (Number.isFinite(beforeMsgIdRaw) && beforeMsgIdRaw > 0) {
    params.beforeMsgId = Math.trunc(beforeMsgIdRaw);
  }
  const { data } = await api.get(`/api/chat/history/${id}`, { params });
  return {
    messages: Array.isArray(data?.messages) ? data.messages : [],
    has_more: data?.has_more === true || data?.has_more === 1,
    next_cursor:
      data?.next_cursor && typeof data.next_cursor === 'object'
        ? {
            sentAt: data.next_cursor.sentAt ?? null,
            id: Number(data.next_cursor.id)
          }
        : null
  };
}

export async function sendChatMessageApi(targetUserId, text) {
  const id = Number(targetUserId);
  const payload = {
    targetUserId: id,
    text: String(text ?? '')
  };
  const { data } = await api.post('/api/chat/send', payload);
  return data?.message ?? null;
}

/** Upload a chat-only image (not saved to My Photo album). Returns a path like `/api/chat/image/<token>.jpg`. */
export async function uploadChatInlineImage(dataUrl) {
  const { data } = await api.post('/api/chat/uploadImage', { image: dataUrl });
  const p = data?.path;
  if (!p || typeof p !== 'string') return null;
  return p;
}

export async function fetchUnreadChatSenderCount() {
  if (unreadSenderCountInFlight) return unreadSenderCountInFlight;

  const requestId = ++unreadSenderCountRequestCounter;
  const startedAt = Date.now();
  logUnreadSenderCountDebug('request:start', { requestId, path: '/api/chat/unreadSenderCount' });

  unreadSenderCountInFlight = (async () => {
    try {
      const { data } = await api.get('/api/chat/unreadSenderCount');
      const n = Number(data?.count);
      const count = Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
      const senders = Array.isArray(data?.senders) ? data.senders : [];
      logUnreadSenderCountDebug('request:ok', {
        requestId,
        elapsedMs: Date.now() - startedAt,
        count,
        senderRows: senders.length
      });
      return { count, senders };
    } catch (err) {
      logUnreadSenderCountDebug('request:error', {
        requestId,
        elapsedMs: Date.now() - startedAt,
        status: err?.response?.status ?? null,
        message: err?.message ?? 'request failed'
      });
      throw err;
    } finally {
      unreadSenderCountInFlight = null;
    }
  })();

  return unreadSenderCountInFlight;
}

export async function fetchUnreadChatMessages(limit = 50) {
  const { data } = await api.get('/api/chat/unreadMessages', { params: { limit } });
  const rows = Array.isArray(data?.messages) ? data.messages : [];
  return rows.map((row) => ({
    msg_id: Number(row.msg_id),
    singles_id: Number(row.singles_id),
    msg_text: row.msg_text ?? '',
    created_at: row.created_at ?? null,
    prefix: row.prefix ?? null,
    member_id: row.member_id ?? null,
    alias: row.alias ?? null
  }));
}

const UNREAD_CHAT_MESSAGES_URL = `${API_BASE_URL}/api/chat/unreadMessages?limit=50`;

/**
 * Bell chat notifications — no interval polling.
 * @param {boolean} enabled — hook active
 * @param {{ autoFetch?: boolean }} options — autoFetch false: only fetch on mutate (Refresh Chat / bell open)
 */
export function useGetUnreadChatNotifications(enabled = true, options = {}) {
  const autoFetch = options.autoFetch !== false;
  const url = enabled ? UNREAD_CHAT_MESSAGES_URL : null;
  const fetcher = async (requestUrl) => {
    const response = await fetch(requestUrl, { credentials: 'include' });
    if (!response.ok) throw new Error(`Failed to load unread chat messages (${response.status})`);
    const data = await response.json();
    const rows = Array.isArray(data?.messages) ? data.messages : [];
    return rows.map((row) => ({
      msg_id: Number(row.msg_id),
      singles_id: Number(row.singles_id),
      msg_text: row.msg_text ?? '',
      created_at: row.created_at ?? null,
      prefix: row.prefix ?? null,
      member_id: row.member_id ?? null,
      alias: row.alias ?? null
    }));
  };

  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateOnMount: autoFetch,
    refreshInterval: 0
  });

  const unreadChatMessages = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  return useMemo(
    () => ({
      unreadChatMessages,
      unreadChatMessagesLoading: isLoading,
      unreadChatMessagesError: error,
      refetchUnreadChatMessages: mutate
    }),
    [unreadChatMessages, isLoading, error, mutate]
  );
}

/** Mark chat with partner as visited (clears that sender from unread count). */
export async function markChatVisitedApi(targetUserId) {
  const id = Number(targetUserId);
  if (!Number.isFinite(id) || id < 1) return { count: 0 };
  const { data } = await api.post(`/api/chat/markVisited/${id}`);
  const n = Number(data?.count);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

export async function fetchChatFriends() {
  const { data } = await api.get('/api/chat/friends');
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      const id = Number(row?.singles_id_to);
      if (!Number.isFinite(id) || id < 1) return null;
      return {
        singles_id_to: id,
        memberLabel: formatMemberLabel({
          alias: row?.alias,
          singlesId: id,
          prefix: row?.prefix,
          memberId: row?.member_id
        }),
        profile_image_url: `${API_BASE_URL}/api/profile-photo/${id}`,
        gallery_image_urls: [],
        unreadCount: 0
      };
    })
    .filter(Boolean);
}
