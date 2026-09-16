import api from 'api/axios';

export async function fetchTutaMallBackupStatus() {
  const { data } = await api.get('/api/tutaMall/backup-status');
  return data;
}

export async function postTutaMallBackupAll() {
  const { data } = await api.post('/api/tutaMall/backup-all');
  return data;
}

export async function postTutaMallRestoreAll() {
  const { data } = await api.post('/api/tutaMall/restore-all', { confirm: true });
  return data;
}
