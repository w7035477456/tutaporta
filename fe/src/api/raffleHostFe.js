import api from './axios';

/** /vr host page. Every call carries the host password (kept in page memory only — no session). */

export async function fetchRaffleHostEvents() {
  const { data } = await api.get('/api/raffle/host/events');
  return Array.isArray(data?.events) ? data.events : [];
}

/** → { eventId, eventTitle, hostName, issued, drawn, claimed } */
export async function loginRaffleHost(eventId, password) {
  const { data } = await api.post('/api/raffle/host/login', { eventId, password });
  return data;
}

/** → { raffleNumber, issued, drawn, claimed } */
export async function drawRaffleHostWinner(eventId, password, previousNumber = null) {
  const { data } = await api.post('/api/raffle/host/draw', { eventId, password, previousNumber });
  return data;
}

/**
 * Scan (QR text + photo) or typed code.
 * → { status: 'valid'|'invalid'|'already_claimed', valid, message, raffleNumber, memberName, verifyCode, … }
 */
export async function verifyRaffleHostTicket({ eventId, password, winNumber, code, source, imageBlob }) {
  const form = new FormData();
  form.append('eventId', String(eventId));
  form.append('password', password);
  form.append('winNumber', winNumber ? String(winNumber) : '');
  form.append('code', code || '');
  form.append('source', source);
  if (imageBlob) form.append('image', imageBlob, 'raffle-scan.jpg');
  const { data } = await api.post('/api/raffle/host/verify', form);
  return data;
}
