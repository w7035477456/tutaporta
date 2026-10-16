import api from './axios';

/**
 * events: [{ eventId, label, title, url, nightDatetime, nightPassed, showCombo, address, raffleStart, raffleEnd, timeZone }]
 *   (event_show_combo = true, plus every event this member won)
 * tickets: [{ eventId, eventLabel, eventAddress, raffleNumber, verifyCode, verifyPath, createdAt,
 *             claimed, claimedAt, paypalInfo, venmoInfo, prizePaid, prizePaidAt }]
 */
export async function fetchRaffleState() {
  const { data } = await api.get('/api/raffle');
  return {
    events: Array.isArray(data?.events) ? data.events : [],
    tickets: Array.isArray(data?.tickets) ? data.tickets : [],
    prizeDollars: Number(data?.prizeDollars) || 200,
    alreadyGeneratedMessage: String(data?.alreadyGeneratedMessage || '')
  };
}

/** Winner picks where the prize goes: method 'paypal' | 'venmo', info = ID / email / phone / handle. */
export async function submitRafflePayout(eventId, method, info) {
  await api.post('/api/raffle/payout', { eventId, method, info });
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
