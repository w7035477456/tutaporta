import api from './axios';

/** GET month rows (server clones from prior month on first open if empty). */
export async function fetchMonthlyBill(year, month) {
  const { data } = await api.get('/api/monthlyBill', {
    params: { year, month }
  });
  return data;
}

/** Full-replace save for one calendar month. */
export async function saveMonthlyBill(year, month, rows) {
  const { data } = await api.put('/api/monthlyBill', {
    year,
    month,
    rows
  });
  return data;
}

/** GET year rows (server clones from prior year on first open if empty). */
export async function fetchYearlyBill(year) {
  const { data } = await api.get('/api/yearlyBill', {
    params: { year }
  });
  return data;
}

/** Full-replace save for one calendar year. */
export async function saveYearlyBill(year, rows) {
  const { data } = await api.put('/api/yearlyBill', {
    year,
    rows
  });
  return data;
}
