import api from './axios';

export async function fetchAdminGithubAsnList() {
  const { data } = await api.get('/api/admin/blocked-asn-vpn/github');
  return data;
}

export async function fetchAdminPostgresAsnList() {
  const { data } = await api.get('/api/admin/blocked-asn-vpn');
  return data;
}

export async function fetchAdminCloudflareAsnList() {
  const { data } = await api.get('/api/admin/blocked-asn-vpn/cloudflare');
  return data;
}

export async function syncAdminPostgresFromGithub() {
  const { data } = await api.post('/api/admin/blocked-asn-vpn/sync-from-github');
  return data;
}

export async function syncAdminCloudflareFromPostgres() {
  const { data } = await api.post('/api/admin/blocked-asn-vpn/sync-cloudflare');
  return data;
}

export async function refreshAdminAsnFromGithubFull() {
  const { data } = await api.post('/api/admin/blocked-asn-vpn/refresh-from-github');
  return data;
}
