import api from './axios';

/** { events: [{ key, label, url }], tickets: [{ eventKey, eventLabel, raffleNumber, verifyCode, verifyPath, createdAt }] } */
export async function fetchRaffleState() {
  const { data } = await api.get('/api/raffle');
  return {
    events: Array.isArray(data?.events) ? data.events : [],
    tickets: Array.isArray(data?.tickets) ? data.tickets : []
  };
}

/** Issue (or return the existing) ticket for this account + event. */
export async function createRaffleTicket(eventKey) {
  const { data } = await api.post('/api/raffle/tickets', { eventKey });
  return { ticket: data?.ticket || null, alreadyHad: Boolean(data?.alreadyHad) };
}
