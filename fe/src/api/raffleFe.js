import api from './axios';

/**
 * referCode: this member's permanent Friend Refer Code (R####) (same on every raffle)
 * referCredit / referFriends / rafflePerRefer: unspent referral credits, friends registered, tickets per credit
 * referRemaining: bonus tickets still available to generate (unspent credits × per + leftover of a partly used credit)
 * tickets[].bonus: true for extra tickets bought with referral credits (several per event)
 * events: [{ eventId, label, title, url, nightDatetime, nightPassed, showCombo, address, raffleStart, raffleEnd, timeZone }]
 *   (event_show_combo = true, plus every event this member won)
 * tickets: [{ eventId, eventLabel, eventAddress, raffleNumber, verifyCode, verifyPath, createdAt,
 *             claimed, claimedAt, paypalInfo, venmoInfo, prizePaid, prizePaidAt }]
 */
export async function fetchRaffleState() {
  const { data } = await api.get('/api/raffle');
  return {
    referCode: String(data?.referCode || ''),
    referCredit: Number(data?.referCredit) || 0,
    referRemaining: Number(data?.referRemaining) || 0,
    referFriends: Number(data?.referFriends) || 0,
    rafflePerRefer: Number(data?.rafflePerRefer) || 2,
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

/** Spend referral credits on `count` bonus tickets for this event → { tickets, referCredit, referRemaining }. */
export async function createRaffleBonusTickets(eventId, count) {
  const { data } = await api.post('/api/raffle/bonus-tickets', { eventId, count });
  return {
    tickets: Array.isArray(data?.tickets) ? data.tickets : [],
    referCredit: Number(data?.referCredit) || 0,
    referRemaining: Number(data?.referRemaining) || 0
  };
}

/**
 * Members related to me (same-event raffle tickets, raffle referrer / referee, Refer Email / Post FB referrer / referee)
 * → [{ singlesId, events: [{ eventId, title, hostName, eventDate }], isMyReferrer, isMyReferee,
 *      isMyMemberReferrer, isMyMemberReferee }].
 */
export async function fetchRaffleRelationships() {
  const { data } = await api.get('/api/raffle/relationships');
  return Array.isArray(data?.relationships) ? data.relationships : [];
}

/** Generate My Raffle — new ticket, or the existing one with `message` when already generated. */
export async function createRaffleTicket(eventId) {
  const { data } = await api.post('/api/raffle/tickets', { eventId });
  return { ticket: data?.ticket || null, alreadyHad: Boolean(data?.alreadyHad), message: String(data?.message || '') };
}
