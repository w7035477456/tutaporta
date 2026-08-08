import api from './axios';

export async function fetchAdminPgQueryErrors() {
  const { data } = await api.get('/api/admin/pg-query-errors');
  return data;
}

export async function resetAdminPgQueryErrors() {
  const { data } = await api.post('/api/admin/pg-query-errors/reset');
  return data;
}
