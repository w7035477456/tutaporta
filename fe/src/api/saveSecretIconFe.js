import api from './axios';

export async function saveSecretIcon(iconName) {
  const { data } = await api.post('/api/settings/secretIcon', { iconName });
  return data;
}

export async function verifySecretIcon(iconName) {
  const { data } = await api.post('/api/settings/secretIcon/verify', { iconName });
  return data;
}
