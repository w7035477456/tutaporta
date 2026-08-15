import api from './axios';

export async function fetchMyGroupChat() {
  const { data } = await api.get('/api/group-chat/mine');
  return data;
}

export async function fetchGroupChatInviteCandidates() {
  const { data } = await api.get('/api/group-chat/invite-candidates');
  return data;
}

export async function postGroupChatInviteApi(inviteeId) {
  const { data } = await api.post('/api/group-chat/invite', { inviteeId: Number(inviteeId) });
  return data;
}

export async function fetchPendingGroupChatInvites() {
  const { data } = await api.get('/api/group-chat/invites/pending');
  return data;
}

export async function acceptGroupChatInviteApi(inviteId) {
  const { data } = await api.post(`/api/group-chat/invite/${Number(inviteId)}/accept`);
  return data;
}

export async function declineGroupChatInviteApi(inviteId) {
  const { data } = await api.post(`/api/group-chat/invite/${Number(inviteId)}/decline`);
  return data;
}

export async function fetchGroupChatMessages(groupId, limit = 100) {
  const id = Number(groupId);
  if (!Number.isFinite(id) || id < 1) return { groupId: null, messages: [] };
  const { data } = await api.get(`/api/group-chat/${id}/messages`, { params: { limit } });
  return data;
}

export async function sendGroupChatMessageApi(groupId, text) {
  const { data } = await api.post(`/api/group-chat/${Number(groupId)}/send`, { text });
  return data;
}

export async function markGroupChatVisitedApi(groupId) {
  const { data } = await api.post(`/api/group-chat/${Number(groupId)}/markVisited`);
  return data;
}

export async function fetchGroupChatOverview(groupId) {
  const id = Number(groupId);
  if (!Number.isFinite(id) || id < 1) return null;
  const { data } = await api.get(`/api/group-chat/${id}/overview`);
  return data;
}

export async function fetchMyGroupChatMemberships() {
  const { data } = await api.get('/api/group-chat/memberships');
  return data;
}
