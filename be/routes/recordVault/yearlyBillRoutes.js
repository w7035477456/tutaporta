import pool from '../../db/connection.js';
import { readBillStorageBackend } from '../../utils/billScheduleStorageBackend.js';
import { normalizeBillIcon } from '../../utils/billIconName.js';

export const DEFAULT_YEARLY_TAB_LABEL = 'home1';

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function sendError(res, error, fallback = 'Yearly bill request failed') {
  const statusCode = Number(error?.statusCode) || 500;
  const pgCode = String(error?.code || '');
  let message = error?.message || fallback;
  if (pgCode === '42P01') {
    message =
      'Database table yearly_bill is missing. On Postgres run: be/db/createYearlyBill.sql then be/db/alterBillScheduleStorageBackend.sql';
  } else if (pgCode === '42703') {
    message =
      'Database schema for yearly_bill is outdated. On Postgres run: be/db/alterYearlyBillTabs.sql';
  }
  if (statusCode >= 500) {
    console.error('[yearly-bill]', {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      hint: error?.hint
    });
  }
  return res.status(statusCode).json({
    error: message,
    ...(pgCode ? { code: pgCode } : {})
  });
}

function requireSinglesId(req) {
  const singlesId = toInt(req.auth?.singles_id);
  if (!singlesId || singlesId < 1) throw httpError(401, 'Authentication required');
  return singlesId;
}

function parseYear(queryOrBody) {
  const year = toInt(queryOrBody?.year ?? queryOrBody?.bill_year);
  if (!year || year < 2000 || year > 2100) throw httpError(400, 'year must be 2000–2100');
  return year;
}

export function normalizeTabLabel(raw) {
  const s = String(raw ?? '').trim().slice(0, 64);
  return s || DEFAULT_YEARLY_TAB_LABEL;
}

export function nextHomeTabLabel(existingLabels) {
  const used = new Set(
    (existingLabels || []).map((l) => String(l || '').trim().toLowerCase()).filter(Boolean)
  );
  let n = 1;
  while (used.has(`home${n}`)) n += 1;
  return `home${n}`;
}

function normalizeAmount(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^varied$/i.test(s)) return 'Varied';
  const cleaned = s.replace(/[$,\s]/g, '');
  if (!cleaned) return '';
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return s.slice(0, 64);
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function normalizeBillType(raw) {
  const s = String(raw ?? '').trim();
  if (/^auto$/i.test(s)) return 'Auto';
  return 'Manual';
}

function normalizeAction(billType, raw) {
  if (billType === 'Auto') return null;
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (/^paid$/i.test(s)) return 'Paid';
  if (/^not\s*paid$/i.test(s)) return 'Not Paid';
  return null;
}

const BILL_PERIODS = new Set(['Monthly', 'Yearly', 'BiYearly', 'Quarterly', '2Year']);
const BILL_SOURCES = new Set(['Visa', 'Check', 'Other']);

function normalizeBillPeriod(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (BILL_PERIODS.has(s)) return s;
  const lower = s.toLowerCase();
  if (lower === 'monthly') return 'Monthly';
  if (lower === 'yearly' || lower === 'annual' || lower === 'annually') return 'Yearly';
  if (lower === 'biyearly' || lower === 'bi-yearly' || lower === 'bi yearly') return 'BiYearly';
  if (lower === 'quarterly') return 'Quarterly';
  if (
    lower === '2year' ||
    lower === '2-year' ||
    lower === '2 year' ||
    lower === 'twoyear' ||
    lower === 'two-year'
  ) {
    return '2Year';
  }
  return null;
}

function normalizeDueYear(raw) {
  if (raw == null || raw === '') return null;
  const n = toInt(raw);
  if (!n || n < 2000 || n > 2100) return null;
  return n;
}

function normalizeBillSource(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (BILL_SOURCES.has(s)) return s;
  const lower = s.toLowerCase();
  if (lower === 'visa') return 'Visa';
  if (lower === 'check' || lower === 'cheque') return 'Check';
  if (lower === 'other') return 'Other';
  return null;
}

function normalizeMonth(raw) {
  if (raw == null || raw === '') return null;
  const n = toInt(raw);
  if (!n || n < 1 || n > 12) return null;
  return n;
}

function normalizeDueDay(raw) {
  if (raw == null || raw === '') return null;
  const n = toInt(raw);
  if (!n || n < 1 || n > 31) return null;
  return n;
}

export function computeYearlyBillStatus(row, year, today = new Date()) {
  const billType = String(row?.bill_type || 'Manual');
  if (billType === 'Auto') {
    return { status: '', status_tone: 'auto' };
  }
  const action = row?.action ?? null;
  if (action === 'Paid') {
    return { status: 'Paid', status_tone: 'paid' };
  }
  const dueDay = toInt(row?.due_month_day);
  if (!dueDay) {
    return { status: '', status_tone: 'none' };
  }
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const unpaid = action !== 'Paid';
  const period = String(row?.bill_period || '').trim();

  // Monthly period: day-only (no bill_month) — due that day every month.
  if (period === 'Monthly') {
    if (year < today.getFullYear()) {
      return unpaid
        ? { status: 'Over Due', status_tone: 'overdue' }
        : { status: '', status_tone: 'none' };
    }
    if (year > today.getFullYear()) {
      return unpaid ? { status: '', status_tone: 'upcoming' } : { status: '', status_tone: 'none' };
    }
    const dim = new Date(year, today.getMonth() + 1, 0).getDate();
    const due = new Date(year, today.getMonth(), Math.min(dueDay, dim));
    if (unpaid && todayStart > due) {
      return { status: 'Over Due', status_tone: 'overdue' };
    }
    if (unpaid && todayStart <= due) {
      return { status: '', status_tone: 'upcoming' };
    }
    return { status: '', status_tone: 'none' };
  }

  const dueMonth = toInt(row?.bill_month);
  if (!dueMonth) {
    return { status: '', status_tone: 'none' };
  }
  // 2Year: due date is year + month + day (due_year). Others use the viewed bill_year slice.
  const dueYear = period === '2Year' ? toInt(row?.due_year) || year : year;
  const due = new Date(dueYear, dueMonth - 1, dueDay);
  if (unpaid && todayStart > due) {
    return { status: 'Over Due', status_tone: 'overdue' };
  }
  if (unpaid && todayStart <= due) {
    return { status: '', status_tone: 'upcoming' };
  }
  return { status: '', status_tone: 'none' };
}

function mapRow(row, year) {
  const y = year ?? Number(row.bill_year);
  const derived = computeYearlyBillStatus(row, y);
  return {
    yearly_bill_id: Number(row.yearly_bill_id),
    singles_id: Number(row.singles_id),
    tab_label: row.tab_label || DEFAULT_YEARLY_TAB_LABEL,
    soft_delete: Boolean(row.soft_delete),
    bill_year: y,
    bill_month: row.bill_month != null ? Number(row.bill_month) : null,
    row_index: Number(row.row_index),
    bill_description: row.bill_description ?? '',
    due_month_day: row.due_month_day != null ? Number(row.due_month_day) : null,
    due_year: row.due_year != null ? Number(row.due_year) : null,
    amount: row.amount ?? '',
    bill_type: row.bill_type === 'Auto' ? 'Auto' : 'Manual',
    bill_period: normalizeBillPeriod(row.bill_period),
    bill_source: normalizeBillSource(row.bill_source),
    action: row.action ?? null,
    paid_record_id: row.paid_record_id != null ? Number(row.paid_record_id) : null,
    bill_icon: row.bill_icon || null,
    has_bill_content: Boolean(row.has_bill_content),
    email_scan_pending: Boolean(row.email_scan_pending),
    created_at: row.created_at,
    updated_at: row.updated_at,
    ...derived
  };
}

async function listTabLabels(client, singlesId, storageBackend, { softDelete }) {
  const { rows } = await client.query(
    `SELECT tab_label, MIN(yearly_bill_id) AS first_id
       FROM outdateddbsnapshotoct2024.yearly_bill
      WHERE singles_id = $1 AND storage_backend = $2 AND soft_delete = $3
      GROUP BY tab_label
      ORDER BY first_id ASC`,
    [singlesId, storageBackend, softDelete]
  );
  return rows.map((r) => String(r.tab_label || '').trim()).filter(Boolean);
}

async function listAllTabLabels(client, singlesId, storageBackend) {
  const { rows } = await client.query(
    `SELECT DISTINCT tab_label
       FROM outdateddbsnapshotoct2024.yearly_bill
      WHERE singles_id = $1 AND storage_backend = $2`,
    [singlesId, storageBackend]
  );
  return rows.map((r) => String(r.tab_label || '').trim()).filter(Boolean);
}

async function listActiveTabs(client, singlesId, storageBackend) {
  const tabs = await listTabLabels(client, singlesId, storageBackend, { softDelete: false });
  return tabs.length ? tabs : [DEFAULT_YEARLY_TAB_LABEL];
}

async function listDeletedTabs(client, singlesId, storageBackend) {
  return listTabLabels(client, singlesId, storageBackend, { softDelete: true });
}

async function countYearRows(client, singlesId, year, storageBackend, tabLabel) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS c
       FROM outdateddbsnapshotoct2024.yearly_bill
      WHERE singles_id = $1 AND storage_backend = $2
        AND tab_label = $3 AND soft_delete = false AND bill_year = $4`,
    [singlesId, storageBackend, tabLabel, year]
  );
  return Number(rows[0]?.c) || 0;
}

async function findPriorYearWithRows(client, singlesId, year, storageBackend, tabLabel) {
  const { rows } = await client.query(
    `SELECT bill_year
       FROM outdateddbsnapshotoct2024.yearly_bill
      WHERE singles_id = $1 AND storage_backend = $2
        AND tab_label = $3 AND soft_delete = false AND bill_year < $4
      GROUP BY bill_year
      ORDER BY bill_year DESC
      LIMIT 1`,
    [singlesId, storageBackend, tabLabel, year]
  );
  if (!rows[0]) return null;
  return Number(rows[0].bill_year);
}

export async function ensureYearCloned(
  client,
  singlesId,
  year,
  storageBackend,
  tabLabel = DEFAULT_YEARLY_TAB_LABEL
) {
  const label = normalizeTabLabel(tabLabel);
  const existing = await countYearRows(client, singlesId, year, storageBackend, label);
  if (existing > 0) return { cloned: false, from: null };

  const priorYear = await findPriorYearWithRows(client, singlesId, year, storageBackend, label);
  if (!priorYear) return { cloned: false, from: null };

  await client.query(
    `INSERT INTO outdateddbsnapshotoct2024.yearly_bill (
       singles_id, storage_backend, tab_label, soft_delete, bill_year, bill_month, row_index,
       bill_description, due_month_day, due_year, amount, bill_type, bill_period, bill_source,
       action, paid_record_id, bill_icon
     )
     SELECT
       singles_id, storage_backend, tab_label, false, $4, bill_month, row_index,
       bill_description, due_month_day, due_year, amount, bill_type, bill_period, bill_source,
       NULL, NULL, bill_icon
       FROM outdateddbsnapshotoct2024.yearly_bill
      WHERE singles_id = $1 AND storage_backend = $2
        AND tab_label = $3 AND soft_delete = false AND bill_year = $5
        AND email_scan_pending = false
      ORDER BY row_index ASC`,
    [singlesId, storageBackend, label, year, priorYear]
  );
  return { cloned: true, from: priorYear };
}

async function listYearRows(client, singlesId, year, storageBackend, tabLabel) {
  const label = normalizeTabLabel(tabLabel);
  const { rows } = await client.query(
    `SELECT yb.*,
            (
              COALESCE(LENGTH(TRIM(pr.notes_text)), 0) > 0
              OR EXISTS (
                SELECT 1
                  FROM outdateddbsnapshotoct2024.paid_record_attachment a
                 WHERE a.paid_record_id = pr.paid_record_id
              )
            ) AS has_bill_content
       FROM outdateddbsnapshotoct2024.yearly_bill yb
       LEFT JOIN outdateddbsnapshotoct2024.paid_record pr
         ON pr.paid_record_id = yb.paid_record_id
      WHERE yb.singles_id = $1 AND yb.storage_backend = $2
        AND yb.tab_label = $3 AND yb.soft_delete = false AND yb.bill_year = $4
      ORDER BY yb.row_index ASC, yb.yearly_bill_id ASC`,
    [singlesId, storageBackend, label, year]
  );
  return rows.map((r) => mapRow(r, year));
}

async function tabsPayload(client, singlesId, storageBackend) {
  const [tabs, deleted_tabs] = await Promise.all([
    listActiveTabs(client, singlesId, storageBackend),
    listDeletedTabs(client, singlesId, storageBackend)
  ]);
  return { tabs, deleted_tabs };
}

function resolveRequestedTab(requested, activeTabs) {
  const list = activeTabs?.length ? activeTabs : [DEFAULT_YEARLY_TAB_LABEL];
  const want = String(requested ?? '').trim();
  if (want && list.includes(want)) return want;
  return list[0];
}

/** GET /api/yearlyBill?year=&tab_label=&storageType= */
export async function getYearlyBill(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const year = parseYear(req.query);
    const storageBackend = readBillStorageBackend(req);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tabMeta = await tabsPayload(client, singlesId, storageBackend);
      const tabLabel = resolveRequestedTab(req.query?.tab_label, tabMeta.tabs);
      const cloneInfo = await ensureYearCloned(client, singlesId, year, storageBackend, tabLabel);
      const rows = await listYearRows(client, singlesId, year, storageBackend, tabLabel);
      const peer = storageBackend === 'usb' ? 'tutaCloud' : 'usb';
      const { rows: peerCountRows } = await client.query(
        `SELECT COUNT(*)::int AS c
           FROM outdateddbsnapshotoct2024.yearly_bill
          WHERE singles_id = $1 AND storage_backend = $2 AND soft_delete = false`,
        [singlesId, peer]
      );
      await client.query('COMMIT');
      return res.json({
        bill_year: year,
        storage_backend: storageBackend,
        peer_storage_backend: peer,
        peer_has_rows: (Number(peerCountRows[0]?.c) || 0) > 0,
        tab_label: tabLabel,
        tabs: tabMeta.tabs,
        deleted_tabs: tabMeta.deleted_tabs,
        cloned: cloneInfo.cloned,
        cloned_from: cloneInfo.from,
        rows
      });
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    return sendError(res, err);
  }
}

/** PUT /api/yearlyBill — Body: { year, tab_label, rows } */
export async function putYearlyBill(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const year = parseYear(req.body || {});
    const storageBackend = readBillStorageBackend(req);
    const tabLabel = normalizeTabLabel(req.body?.tab_label);
    const incoming = Array.isArray(req.body?.rows) ? req.body.rows : null;
    if (!incoming) throw httpError(400, 'rows array required');
    if (incoming.length > 500) throw httpError(400, 'Too many rows (max 500)');

    const normalized = incoming.map((row, i) => {
      const billType = normalizeBillType(row?.bill_type);
      const action = normalizeAction(billType, row?.action);
      const rowIndex = toInt(row?.row_index) || i + 1;
      if (rowIndex < 1) throw httpError(400, 'row_index must be >= 1');
      const paidRecordId = toInt(row?.paid_record_id);
      const billPeriod = normalizeBillPeriod(row?.bill_period);
      // Monthly period: day-only due date — clear bill_month.
      // 2Year: due date is year + month + day (due_year). Clear due_year otherwise.
      const billMonth = billPeriod === 'Monthly' ? null : normalizeMonth(row?.bill_month);
      const dueYear = billPeriod === '2Year' ? normalizeDueYear(row?.due_year) : null;
      return {
        row_index: rowIndex,
        prior_bill_id: toInt(row?.yearly_bill_id) || null,
        bill_description: String(row?.bill_description ?? '').slice(0, 500),
        bill_month: billMonth,
        due_month_day: normalizeDueDay(row?.due_month_day),
        due_year: dueYear,
        amount: normalizeAmount(row?.amount),
        bill_type: billType,
        bill_period: billPeriod,
        bill_source: normalizeBillSource(row?.bill_source),
        action,
        paid_record_id: paidRecordId && paidRecordId > 0 ? paidRecordId : null,
        bill_icon: normalizeBillIcon(row?.bill_icon),
        email_scan_pending: row?.email_scan_pending === true
      };
    });

    const seen = new Set();
    for (const r of normalized) {
      if (seen.has(r.row_index)) throw httpError(400, `Duplicate row_index ${r.row_index}`);
      seen.add(r.row_index);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: priorLinks } = await client.query(
        `SELECT yearly_bill_id, paid_record_id
           FROM outdateddbsnapshotoct2024.yearly_bill
          WHERE singles_id = $1 AND storage_backend = $2
            AND tab_label = $3 AND soft_delete = false AND bill_year = $4
            AND paid_record_id IS NOT NULL`,
        [singlesId, storageBackend, tabLabel, year]
      );
      const priorPaidByBillId = new Map(
        priorLinks.map((p) => [Number(p.yearly_bill_id), Number(p.paid_record_id)])
      );
      for (const r of normalized) {
        if (!r.paid_record_id && r.prior_bill_id) {
          r.paid_record_id = priorPaidByBillId.get(r.prior_bill_id) || null;
        }
      }
      await client.query(
        `DELETE FROM outdateddbsnapshotoct2024.yearly_bill
          WHERE singles_id = $1 AND storage_backend = $2
            AND tab_label = $3 AND soft_delete = false AND bill_year = $4`,
        [singlesId, storageBackend, tabLabel, year]
      );
      for (const r of normalized) {
        const { rows: inserted } = await client.query(
          `INSERT INTO outdateddbsnapshotoct2024.yearly_bill (
             singles_id, storage_backend, tab_label, soft_delete, bill_year, bill_month, row_index,
             bill_description, due_month_day, due_year, amount, bill_type, bill_period, bill_source,
             action, paid_record_id, bill_icon, email_scan_pending
           ) VALUES ($1,$2,$3,false,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
           RETURNING yearly_bill_id`,
          [
            singlesId,
            storageBackend,
            tabLabel,
            year,
            r.bill_month,
            r.row_index,
            r.bill_description,
            r.due_month_day,
            r.due_year,
            r.amount,
            r.bill_type,
            r.bill_period,
            r.bill_source,
            r.action,
            r.paid_record_id,
            r.bill_icon,
            r.email_scan_pending
          ]
        );
        const newBillId = Number(inserted[0]?.yearly_bill_id);
        if (r.paid_record_id && newBillId) {
          await client.query(
            `UPDATE outdateddbsnapshotoct2024.paid_record
                SET yearly_bill_id = $1, updated_at = now()
              WHERE paid_record_id = $2 AND singles_id = $3`,
            [newBillId, r.paid_record_id, singlesId]
          );
        }
      }
      const rows = await listYearRows(client, singlesId, year, storageBackend, tabLabel);
      const tabMeta = await tabsPayload(client, singlesId, storageBackend);
      await client.query('COMMIT');
      return res.json({
        ok: true,
        bill_year: year,
        storage_backend: storageBackend,
        tab_label: tabLabel,
        tabs: tabMeta.tabs,
        deleted_tabs: tabMeta.deleted_tabs,
        rows
      });
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    return sendError(res, err);
  }
}

/** POST /api/yearlyBill/tab/add */
export async function postYearlyBillTabAdd(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const year = parseYear(req.body || {});
    const storageBackend = readBillStorageBackend(req);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let allLabels = await listAllTabLabels(client, singlesId, storageBackend);
      if (allLabels.length === 0) {
        await client.query(
          `INSERT INTO outdateddbsnapshotoct2024.yearly_bill (
             singles_id, storage_backend, tab_label, soft_delete, bill_year, bill_month, row_index,
             bill_description, due_month_day, amount, bill_type, action, paid_record_id
           ) VALUES ($1,$2,$3,false,$4,NULL,1,'',NULL,'','Manual',NULL,NULL)`,
          [singlesId, storageBackend, DEFAULT_YEARLY_TAB_LABEL, year]
        );
        allLabels = [DEFAULT_YEARLY_TAB_LABEL];
      }
      const tabLabel = nextHomeTabLabel(allLabels);
      await client.query(
        `INSERT INTO outdateddbsnapshotoct2024.yearly_bill (
           singles_id, storage_backend, tab_label, soft_delete, bill_year, bill_month, row_index,
           bill_description, due_month_day, amount, bill_type, action, paid_record_id
         ) VALUES ($1,$2,$3,false,$4,NULL,1,'',NULL,'','Manual',NULL,NULL)`,
        [singlesId, storageBackend, tabLabel, year]
      );
      const tabMeta = await tabsPayload(client, singlesId, storageBackend);
      await client.query('COMMIT');
      return res.json({
        ok: true,
        tab_label: tabLabel,
        tabs: tabMeta.tabs,
        deleted_tabs: tabMeta.deleted_tabs
      });
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    return sendError(res, err);
  }
}

/** POST /api/yearlyBill/tab/remove */
export async function postYearlyBillTabRemove(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const storageBackend = readBillStorageBackend(req);
    const tabLabel = normalizeTabLabel(req.body?.tab_label);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const active = await listActiveTabs(client, singlesId, storageBackend);
      if (active.length <= 1) throw httpError(400, 'Cannot remove the only tab');
      if (!active.includes(tabLabel)) throw httpError(404, 'Tab not found');

      const { rowCount } = await client.query(
        `UPDATE outdateddbsnapshotoct2024.yearly_bill
            SET soft_delete = true, updated_at = now()
          WHERE singles_id = $1 AND storage_backend = $2
            AND tab_label = $3 AND soft_delete = false`,
        [singlesId, storageBackend, tabLabel]
      );
      const tabMeta = await tabsPayload(client, singlesId, storageBackend);
      await client.query('COMMIT');
      return res.json({
        ok: true,
        removed: tabLabel,
        rows_updated: Number(rowCount) || 0,
        tabs: tabMeta.tabs,
        deleted_tabs: tabMeta.deleted_tabs,
        tab_label: tabMeta.tabs[0] || DEFAULT_YEARLY_TAB_LABEL
      });
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    return sendError(res, err);
  }
}

/** POST /api/yearlyBill/tab/undelete */
export async function postYearlyBillTabUndelete(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const storageBackend = readBillStorageBackend(req);
    const tabLabel = normalizeTabLabel(req.body?.tab_label);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const deleted = await listDeletedTabs(client, singlesId, storageBackend);
      if (!deleted.includes(tabLabel)) throw httpError(404, 'Deleted tab not found');
      const active = await listActiveTabs(client, singlesId, storageBackend);
      if (active.includes(tabLabel)) throw httpError(409, 'An active tab already uses that name');

      const { rowCount } = await client.query(
        `UPDATE outdateddbsnapshotoct2024.yearly_bill
            SET soft_delete = false, updated_at = now()
          WHERE singles_id = $1 AND storage_backend = $2
            AND tab_label = $3 AND soft_delete = true`,
        [singlesId, storageBackend, tabLabel]
      );
      const tabMeta = await tabsPayload(client, singlesId, storageBackend);
      await client.query('COMMIT');
      return res.json({
        ok: true,
        tab_label: tabLabel,
        rows_updated: Number(rowCount) || 0,
        tabs: tabMeta.tabs,
        deleted_tabs: tabMeta.deleted_tabs
      });
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    return sendError(res, err);
  }
}

/** POST /api/yearlyBill/tab/rename */
export async function postYearlyBillTabRename(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const storageBackend = readBillStorageBackend(req);
    const fromLabel = normalizeTabLabel(req.body?.from ?? req.body?.tab_label);
    const toLabel = normalizeTabLabel(req.body?.to ?? req.body?.new_tab_label);
    if (fromLabel === toLabel) {
      return res.json({ ok: true, tab_label: toLabel, renamed: false });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const allLabels = await listAllTabLabels(client, singlesId, storageBackend);
      const active = await listActiveTabs(client, singlesId, storageBackend);

      if (!allLabels.includes(fromLabel)) {
        if (fromLabel !== DEFAULT_YEARLY_TAB_LABEL || active[0] !== DEFAULT_YEARLY_TAB_LABEL) {
          throw httpError(404, 'Tab not found');
        }
        if (allLabels.map((l) => l.toLowerCase()).includes(toLabel.toLowerCase())) {
          throw httpError(409, 'Tab name already exists');
        }
        const year = parseYear(req.body || {});
        await client.query(
          `INSERT INTO outdateddbsnapshotoct2024.yearly_bill (
             singles_id, storage_backend, tab_label, soft_delete, bill_year, bill_month, row_index,
             bill_description, due_month_day, amount, bill_type, action, paid_record_id
           ) VALUES ($1,$2,$3,false,$4,NULL,1,'',NULL,'','Manual',NULL,NULL)`,
          [singlesId, storageBackend, toLabel, year]
        );
      } else {
        if (!active.includes(fromLabel)) throw httpError(404, 'Tab not found');
        if (allLabels.map((l) => l.toLowerCase()).includes(toLabel.toLowerCase())) {
          throw httpError(409, 'Tab name already exists');
        }
        await client.query(
          `UPDATE outdateddbsnapshotoct2024.yearly_bill
              SET tab_label = $4, updated_at = now()
            WHERE singles_id = $1 AND storage_backend = $2
              AND tab_label = $3 AND soft_delete = false`,
          [singlesId, storageBackend, fromLabel, toLabel]
        );
      }
      const tabMeta = await tabsPayload(client, singlesId, storageBackend);
      await client.query('COMMIT');
      return res.json({
        ok: true,
        renamed: true,
        from: fromLabel,
        tab_label: toLabel,
        tabs: tabMeta.tabs,
        deleted_tabs: tabMeta.deleted_tabs
      });
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    return sendError(res, err);
  }
}
