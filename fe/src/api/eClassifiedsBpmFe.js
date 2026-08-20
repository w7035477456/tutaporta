import api from './axios';

export async function fetchBpmDiagram() {
  const { data } = await api.get('/api/eClassifieds/bpm/diagram');
  return data;
}

export async function fetchBpmListings() {
  const { data } = await api.get('/api/eClassifieds/bpm/listings');
  return data?.listings ?? [];
}

export async function fetchBpmInstances() {
  const { data } = await api.get('/api/eClassifieds/bpm/instances');
  return data?.instances ?? [];
}

export async function fetchBpmPending() {
  const { data } = await api.get('/api/eClassifieds/bpm/pending');
  return data?.pending ?? [];
}

export async function fetchBpmInstance(instanceId) {
  const { data } = await api.get(`/api/eClassifieds/bpm/instances/${encodeURIComponent(instanceId)}`);
  return data;
}

export async function startBpmInstance(listingId) {
  const { data } = await api.post('/api/eClassifieds/bpm/instances', { listingId });
  return data;
}

export async function completeBpmInstance(instanceId, decision) {
  const { data } = await api.post(`/api/eClassifieds/bpm/instances/${encodeURIComponent(instanceId)}/complete`, {
    decision
  });
  return data;
}

export async function resetBpmAll() {
  const { data } = await api.post('/api/eClassifieds/bpm/reset');
  return data;
}
