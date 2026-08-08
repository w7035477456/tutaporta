import api from './axios';

export async function fetchAdminStatistics() {
  const { data } = await api.get('/api/admin/statistics');
  return data;
}

