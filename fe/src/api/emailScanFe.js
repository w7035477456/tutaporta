import api from './axios';

function storageParam(storageType) {
  return String(storageType || '').toLowerCase() === 'usb' ? 'usb' : 'onedrive';
}

function rethrow(err, fallback) {
  const e = new Error(err?.response?.data?.error || err?.message || fallback);
  e.status = err?.response?.status;
  throw e;
}

/** Create (first click) or load this member's bills+token forwarding address and scan status. */
export async function ensureEmailScanInbox({ storageType } = {}) {
  try {
    const { data } = await api.post('/api/emailScan/inbox', { storageType: storageParam(storageType) });
    return data;
  } catch (err) {
    return rethrow(err, 'Failed to load Auto Scan settings');
  }
}

export async function fetchEmailScanStatus() {
  try {
    const { data } = await api.get('/api/emailScan/status');
    return data;
  } catch (err) {
    return rethrow(err, 'Failed to load Auto Scan status');
  }
}

/** Ask the server to read the bills@ mailbox now (runs in the background). */
export async function runEmailScanNow() {
  try {
    const { data } = await api.post('/api/emailScan/run', {});
    return data;
  } catch (err) {
    return rethrow(err, 'Failed to start Auto Scan');
  }
}
