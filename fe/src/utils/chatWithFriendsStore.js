import { formatMemberLabel } from './memberLabel';

const CHAT_WITH_FRIENDS_KEY = 'chat_with_friends_v1';
const CHAT_WITH_FRIENDS_UPDATED_EVENT = 'chat-with-friends-updated';

function safeParse(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function defaultState() {
  return {
    friends: [],
    conversations: {},
    activeFriendId: null,
    updatedAt: nowIso()
  };
}

export function loadChatWithFriendsState() {
  if (typeof window === 'undefined') return defaultState();
  const raw = localStorage.getItem(CHAT_WITH_FRIENDS_KEY);
  if (!raw) return defaultState();
  const parsed = safeParse(raw, defaultState());
  if (!Array.isArray(parsed.friends)) parsed.friends = [];
  if (!parsed.conversations || typeof parsed.conversations !== 'object') parsed.conversations = {};
  return parsed;
}

export function saveChatWithFriendsState(state) {
  if (typeof window === 'undefined') return;
  const nextState = {
    ...state,
    updatedAt: nowIso()
  };
  localStorage.setItem(
    CHAT_WITH_FRIENDS_KEY,
    JSON.stringify(nextState)
  );
  window.dispatchEvent(new CustomEvent(CHAT_WITH_FRIENDS_UPDATED_EVENT, { detail: { state: nextState } }));
}

export function getChatWithFriendsUpdatedEventName() {
  return CHAT_WITH_FRIENDS_UPDATED_EVENT;
}

export function getUnrespondedChatCount() {
  const state = loadChatWithFriendsState();
  const conversations = state?.conversations && typeof state.conversations === 'object' ? state.conversations : {};
  let total = 0;
  for (const key of Object.keys(conversations)) {
    const msgs = Array.isArray(conversations[key]) ? conversations[key] : [];
    if (!msgs.length) continue;
    const last = msgs[msgs.length - 1];
    if (last?.sender !== 'me') total += 1;
  }
  return total;
}

export function upsertFriendFromRequestRow(row) {
  const state = loadChatWithFriendsState();
  const id = Number(row?.singles_id_to);
  if (!Number.isFinite(id)) return state;
  const friend = {
    singles_id_to: id,
    memberLabel: formatMemberLabel({
      alias: row?.alias,
      singlesId: id,
      prefix: row?.prefix,
      memberId: row?.member_id
    }),
    profile_image_url: row?.profile_image_url ?? 'profile.jpeg',
    gallery_image_urls: Array.isArray(row?.gallery_image_urls) ? row.gallery_image_urls : [],
    unreadCount: 0,
    addedAt: nowIso()
  };
  const existingIdx = state.friends.findIndex((x) => Number(x?.singles_id_to) === id);
  if (existingIdx >= 0) {
    state.friends[existingIdx] = { ...state.friends[existingIdx], ...friend };
  } else {
    state.friends.push(friend);
  }
  if (!Array.isArray(state.conversations[String(id)])) {
    state.conversations[String(id)] = [];
  }
  state.activeFriendId = id;
  saveChatWithFriendsState(state);
  return state;
}

export function appendOutgoingMessage(friendId, messageText) {
  const id = Number(friendId);
  if (!Number.isFinite(id)) return;
  const text = String(messageText ?? '').trim();
  if (!text) return;
  const state = loadChatWithFriendsState();
  const key = String(id);
  if (!Array.isArray(state.conversations[key])) state.conversations[key] = [];
  state.conversations[key].push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    sender: 'me',
    text,
    sentAt: nowIso()
  });
  state.activeFriendId = id;
  saveChatWithFriendsState(state);
}
