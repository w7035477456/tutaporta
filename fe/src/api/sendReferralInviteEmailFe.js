import api from 'api/axios';

/** POST /api/settings/referralInviteEmail */
export async function sendReferralInviteEmail(email, { forwardedMessage } = {}) {
  const { data } = await api.post('/api/settings/referralInviteEmail', {
    email,
    forwardedMessage: String(forwardedMessage ?? '').trim() || undefined
  });
  return data;
}
