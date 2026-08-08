import api from 'api/axios';

export async function completePasswordReset({ email, code, password }) {
  const { data } = await api.post('/api/completePasswordReset', { email, code, password });
  return data;
}
