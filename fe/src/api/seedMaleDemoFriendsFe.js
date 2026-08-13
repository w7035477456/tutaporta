import api from './axios';

/** Seed authenticated male member with demo friends + welcome posting (idempotent). */
export async function seedMaleDemoFriendsForCurrentUser() {
  const { data } = await api.post('/api/singles/seed-male-demo-friends');
  return data;
}
