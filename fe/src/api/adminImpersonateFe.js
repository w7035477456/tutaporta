import api from './axios';

/**
 * POST /api/admin/impersonate
 * @param {{ targetSinglesId: number, password?: string }} params
 */
export async function postAdminImpersonate({ targetSinglesId, password }) {
  const { data } = await api.post('/api/admin/impersonate', {
    target_singles_id: Number(targetSinglesId),
    password: password ?? undefined
  });
  return data;
}

/** POST /api/admin/return-admin — end impersonation, restore tools-only Admin. */
export async function postAdminReturnAdmin() {
  const { data } = await api.post('/api/admin/return-admin');
  return data;
}
