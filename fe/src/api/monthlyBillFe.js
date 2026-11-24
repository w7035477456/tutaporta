import api from './axios';

function withStorage(params, storageType) {
  const st = String(storageType || '').toLowerCase() === 'usb' ? 'usb' : 'tutaCloud';
  return { ...params, storageType: st };
}

/** GET month rows (server clones from prior month on first open if empty). */
export async function fetchMonthlyBill(year, month, { storageType, tabLabel } = {}) {
  const { data } = await api.get('/api/monthlyBill', {
    params: withStorage({ year, month, tab_label: tabLabel || undefined }, storageType)
  });
  return data;
}

/** Full-replace save for one calendar month + tab. */
export async function saveMonthlyBill(year, month, rows, { storageType, tabLabel } = {}) {
  const { data } = await api.put('/api/monthlyBill', {
    ...withStorage({ year, month, tab_label: tabLabel || 'home1', rows }, storageType)
  });
  return data;
}

/** Create next homeN tab for the current month. */
export async function addMonthlyBillTab(year, month, { storageType } = {}) {
  const { data } = await api.post('/api/monthlyBill/tab/add', {
    ...withStorage({ year, month }, storageType)
  });
  return data;
}

/** Soft-delete a tab (all months). */
export async function removeMonthlyBillTab(tabLabel, { storageType } = {}) {
  const { data } = await api.post('/api/monthlyBill/tab/remove', {
    ...withStorage({ tab_label: tabLabel }, storageType)
  });
  return data;
}

/** Restore a soft-deleted tab. */
export async function undeleteMonthlyBillTab(tabLabel, { storageType } = {}) {
  const { data } = await api.post('/api/monthlyBill/tab/undelete', {
    ...withStorage({ tab_label: tabLabel }, storageType)
  });
  return data;
}

/** Rename a tab across all months. */
export async function renameMonthlyBillTab(fromLabel, toLabel, { storageType, year, month } = {}) {
  const { data } = await api.post('/api/monthlyBill/tab/rename', {
    ...withStorage({ from: fromLabel, to: toLabel, year, month }, storageType)
  });
  return data;
}

/** GET year rows (server clones from prior year on first open if empty). */
export async function fetchYearlyBill(year, { storageType, tabLabel } = {}) {
  const { data } = await api.get('/api/yearlyBill', {
    params: withStorage({ year, tab_label: tabLabel || undefined }, storageType)
  });
  return data;
}

/** Full-replace save for one calendar year + tab. */
export async function saveYearlyBill(year, rows, { storageType, tabLabel } = {}) {
  const { data } = await api.put('/api/yearlyBill', {
    ...withStorage({ year, tab_label: tabLabel || 'home1', rows }, storageType)
  });
  return data;
}

/** Create next homeN yearly tab for the given year. */
export async function addYearlyBillTab(year, { storageType } = {}) {
  const { data } = await api.post('/api/yearlyBill/tab/add', {
    ...withStorage({ year }, storageType)
  });
  return data;
}

/** Soft-delete a yearly tab (all years). */
export async function removeYearlyBillTab(tabLabel, { storageType } = {}) {
  const { data } = await api.post('/api/yearlyBill/tab/remove', {
    ...withStorage({ tab_label: tabLabel }, storageType)
  });
  return data;
}

/** Restore a soft-deleted yearly tab. */
export async function undeleteYearlyBillTab(tabLabel, { storageType } = {}) {
  const { data } = await api.post('/api/yearlyBill/tab/undelete', {
    ...withStorage({ tab_label: tabLabel }, storageType)
  });
  return data;
}

/** Rename a yearly tab across all years. */
export async function renameYearlyBillTab(fromLabel, toLabel, { storageType, year } = {}) {
  const { data } = await api.post('/api/yearlyBill/tab/rename', {
    ...withStorage({ from: fromLabel, to: toLabel, year }, storageType)
  });
  return data;
}

/** GET subscription month rows (server clones from prior month on first open if empty). */
export async function fetchSubscriptionBill(year, month, { storageType } = {}) {
  const { data } = await api.get('/api/subscriptionBill', {
    params: withStorage({ year, month }, storageType)
  });
  return data;
}

/** Full-replace save for one subscription calendar month. */
export async function saveSubscriptionBill(year, month, rows, { storageType } = {}) {
  const { data } = await api.put('/api/subscriptionBill', {
    ...withStorage({ year, month, rows }, storageType)
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

/** GET ToDo board tasks ({ items: [{ todo_item_id, lane, seq, body }] }). */
export async function fetchTodoItems({ storageType } = {}) {
  const { data } = await api.get('/api/todoItems', { params: withStorage({}, storageType) });
  return data;
}

/** Full-replace save of the ToDo board; array order within each lane is the sequence. */
export async function saveTodoItems(items, { storageType } = {}) {
  const { data } = await api.put('/api/todoItems', { ...withStorage({ items }, storageType) });
  return data;
}
