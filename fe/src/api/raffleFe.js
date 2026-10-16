import api from './axios';

/**
 * events: [{ eventId, label, url, nightDatetime, address, raffleStart, raffleEnd, timeZone }] (event_show_combo = true)
 * tickets: [{ eventId, eventLabel, raffleNumber, verifyCode, verifyPath, createdAt }]
 */
export async function fetchRaffleState() {
  const { data } = await api.get('/api/raffle');
  return {
    events: Array.isArray(data?.events) ? data.events : [],
    tickets: Array.isArray(data?.tickets) ? data.tickets : [],
    alreadyGeneratedMessage: String(data?.alreadyGeneratedMessage || '')
  };
}

/** Member picked an event — links singles ↔ host ↔ event (raffle_user row, number still empty). */
export async function selectRaffleEvent(eventId) {
  await api.post('/api/raffle/select', { eventId });
}

/** Generate My Raffle — new ticket, or the existing one with `message` when already generated. */
export async function createRaffleTicket(eventId) {
  const { data } = await api.post('/api/raffle/tickets', { eventId });
  return { ticket: data?.ticket || null, alreadyHad: Boolean(data?.alreadyHad), message: String(data?.message || '') };
}
