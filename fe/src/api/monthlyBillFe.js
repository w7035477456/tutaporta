import api from './axios';

function withStorage(params, storageType) {
  const st = String(storageType || '').toLowerCase() === 'usb' ? 'usb' : 'onedrive';
  return { ...params, storageType: st };
}

/** GET month rows (server clones from prior month on first open if empty). */
export async function fetchMonthlyBill(year, month, { storageType } = {}) {
  const { data } = await api.get('/api/monthlyBill', {
    params: withStorage({ year, month }, storageType)
  });
  return data;
}

/** Full-replace save for one calendar month. */
export async function saveMonthlyBill(year, month, rows, { storageType } = {}) {
  const { data } = await api.put('/api/monthlyBill', {
    ...withStorage({ year, month, rows }, storageType)
  });
  return data;
}

/** GET year rows (server clones from prior year on first open if empty). */
export async function fetchYearlyBill(year, { storageType } = {}) {
  const { data } = await api.get('/api/yearlyBill', {
    params: withStorage({ year }, storageType)
  });
  return data;
}

/** Full-replace save for one calendar year. */
export async function saveYearlyBill(year, rows, { storageType } = {}) {
  const { data } = await api.put('/api/yearlyBill', {
    ...withStorage({ year, rows }, storageType)
  });
  return data;
}

/** Copy/move Bill Schedule between Cloud and USB. */
export async function transferBillSchedule({
  mode,
  kind,
  sourceStorageType,
  targetStorageType
}) {
  try {
    const { data } = await api.post('/api/billSchedule/transfer', {
      mode,
      kind,
      sourceStorageType,
      targetStorageType
    });
    return data;
  } catch (err) {
    const code = err?.response?.data?.code;
    const message = err?.response?.data?.error || err?.message || 'Transfer failed';
    const e = new Error(message);
    if (code) e.code = code;
    throw e;
  }
}
