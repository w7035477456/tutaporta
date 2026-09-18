import api from 'api/axios';

/** @param {'tutadates'|'tutanotes'|'tutaphoto'} app */
export async function fetchTutaMallBackupStatus(app) {
  const { data } = await api.get('/api/tutaMall/backup-status', {
    params: app ? { app } : undefined
  });
  return data;
}

/** @param {'tutadates'|'tutanotes'|'tutaphoto'} app */
export async function postTutaMallBackupApp(app) {
  const { data } = await api.post('/api/tutaMall/backup', { app });
  return data;
}

/** @param {'tutadates'|'tutanotes'|'tutaphoto'} app */
export async function postTutaMallRestoreApp(app) {
  const { data } = await api.post('/api/tutaMall/restore', { app, confirm: true });
  return data;
}

/** Legacy — all apps (CLI). */
export async function postTutaMallBackupAll() {
  const { data } = await api.post('/api/tutaMall/backup-all');
  return data;
}

/** Legacy — all apps (CLI). */
export async function postTutaMallRestoreAll() {
  const { data } = await api.post('/api/tutaMall/restore-all', { confirm: true });
  return data;
}
