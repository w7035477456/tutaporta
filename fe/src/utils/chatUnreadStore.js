export const CHAT_UNREAD_UPDATED_EVENT = 'chat-unread-updated';

export function dispatchChatUnreadUpdated(count, source = null, messageCount = null, senders = null) {
  if (typeof window === 'undefined') return;
  const n = Number(count);
  const safe = Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
  const mcRaw = messageCount == null ? safe : Number(messageCount);
  const messageCountSafe = Number.isFinite(mcRaw) && mcRaw > 0 ? Math.trunc(mcRaw) : 0;
  const detail = { count: safe, messageCount: messageCountSafe, source };
  if (Array.isArray(senders)) detail.senders = senders;
  window.dispatchEvent(new CustomEvent(CHAT_UNREAD_UPDATED_EVENT, { detail }));
}

export function getChatUnreadUpdatedEventName() {
  return CHAT_UNREAD_UPDATED_EVENT;
}
