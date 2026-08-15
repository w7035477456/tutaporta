import api from './axios';

export async function listSpeedDateEvents() {
  const { data } = await api.get('/api/speed-date/events');
  return data;
}

export async function createSpeedDateEvent(payload) {
  const { data } = await api.post('/api/speed-date/events', payload);
  return data?.event ?? null;
}

export async function rsvpSpeedDateEvent(eventId, leave = false) {
  const { data } = await api.post(`/api/speed-date/events/${eventId}/rsvp`, { leave: leave === true });
  return data;
}

export async function heartbeatSpeedDate(eventId, cameraReady) {
  const { data } = await api.post(`/api/speed-date/events/${eventId}/heartbeat`, {
    camera_ready: cameraReady === true
  });
  return data;
}

export async function fetchSpeedDateSession(eventId) {
  const params = {};
  if (eventId) params.eventId = eventId;
  const { data } = await api.get('/api/speed-date/session', { params });
  return data;
}

export async function startSpeedDateEvent(eventId) {
  const { data } = await api.post(`/api/speed-date/events/${eventId}/start`);
  return data;
}

export async function nextSpeedDateRound(eventId) {
  const { data } = await api.post(`/api/speed-date/events/${eventId}/next-round`);
  return data;
}

export async function endSpeedDateEvent(eventId) {
  const { data } = await api.post(`/api/speed-date/events/${eventId}/end`);
  return data;
}

export async function postSpeedDateSignal(pairId, kind, payload) {
  const { data } = await api.post('/api/speed-date/signal', {
    pair_id: pairId,
    kind,
    payload
  });
  return data;
}

export async function fetchSpeedDateSignals(pairId, afterId) {
  const { data } = await api.get('/api/speed-date/signals', {
    params: { pairId, afterId: afterId || 0 }
  });
  return Array.isArray(data?.signals) ? data.signals : [];
}

export async function postSpeedDateInterest(pairId, wantMeet) {
  const { data } = await api.post(`/api/speed-date/pairs/${pairId}/interest`, {
    want_meet: wantMeet === true
  });
  return data;
}
