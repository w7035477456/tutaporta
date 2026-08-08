import api from './axios';

export async function upgradeLegacyPassword({ newPassword, confirmPassword }) {
  const { data } = await api.post('/api/upgradeLegacyPassword', { newPassword, confirmPassword });
  return data;
}
