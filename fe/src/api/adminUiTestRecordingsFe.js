import api from './axios';

export async function fetchGraphicalTestRecordings() {
  const { data } = await api.get('/api/admin/ui-test-recordings');
  return data;
}

export async function createGraphicalTestRecording(name) {
  const { data } = await api.post('/api/admin/ui-test-recordings', { name });
  return data;
}

export async function patchGraphicalTestRecording(recordingId, payload) {
  const { data } = await api.patch(`/api/admin/ui-test-recordings/${recordingId}`, payload);
  return data;
}

export async function deleteGraphicalTestRecording(recordingId) {
  await api.delete(`/api/admin/ui-test-recordings/${recordingId}`);
}

export async function resetGraphicalTestRecordingLoop(recordingId) {
  const { data } = await api.post(`/api/admin/ui-test-recordings/${recordingId}/loop/reset`);
  return data;
}

export async function fetchGraphicalTestRecordingSteps(recordingId) {
  const { data } = await api.get(`/api/admin/ui-test-recordings/${recordingId}/steps`);
  return data;
}

export async function startGraphicalTestRecording(recordingId) {
  const { data } = await api.post(`/api/admin/ui-test-recordings/${recordingId}/record/start`);
  return data;
}

export async function stopGraphicalTestRecording(recordingId, payload) {
  const { data } = await api.post(`/api/admin/ui-test-recordings/${recordingId}/record/stop`, payload);
  return data;
}

export async function startGraphicalTestRun(recordingId, payload = {}) {
  const { data } = await api.post(`/api/admin/ui-test-recordings/${recordingId}/run/start`, payload);
  return data;
}

export async function stopGraphicalTestRun(recordingId, runId, payload = {}) {
  const { data } = await api.post(`/api/admin/ui-test-recordings/${recordingId}/run/stop`, { runId, ...payload });
  return data;
}

export async function completeGraphicalTestRunLoop(recordingId, runId) {
  const { data } = await api.post(`/api/admin/ui-test-recordings/${recordingId}/run/loop-complete`, { runId });
  return data;
}

export async function fetchGraphicalTestLogs() {
  const { data } = await api.get('/api/admin/ui-test-recordings/logs');
  return data;
}

export async function resetGraphicalTestLogs() {
  const { data } = await api.post('/api/admin/ui-test-recordings/logs/reset');
  return data;
}
