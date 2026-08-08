import api from 'api/axios';

export async function requestPasswordReset(email) {
  const { data } = await api.post('/api/requestPasswordReset', { email });
  return data;
}
