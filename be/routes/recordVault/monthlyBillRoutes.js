import pool from '../../db/connection.js';
import { readBillStorageBackend } from '../../utils/billScheduleStorageBackend.js';
import { normalizeBillIcon } from '../../utils/billIconName.js';

export const DEFAULT_MONTHLY_TAB_LABEL = 'home1';

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function sendError(res, error, fallback = 'Monthly bill request failed') {
  const statusCode = Number(error?.statusCode) || 500;
  const pgCode = String(error?.code || '');
  let message = error?.message || fallback;
  if (pgCode === '42P01') {
    message =
      'Database table monthly_bill is missing. On Postgres run: be/db/createMonthlyBill.sql then be/db/alterBillScheduleStorageBackend.sql';
  } else if (pgCode === '42703') {
    message =
      'Database schema for monthly_bill is outdated. On Postgres run: be/db/alterMonthlyBillTabs.sql';
  }
  if (statusCode >= 500) {
    console.error('[monthly-bill]', {
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

function parseYearMonth(queryOrBody) {
  const year = toInt(queryOrBody?.year ?? queryOrBody?.bill_year);
  const month = toInt(queryOrBody?.month ?? queryOrBody?.bill_month);
  if (!year || year < 2000 || year > 2100) throw httpError(400, 'year must be 2000–2100');
  if (!month || month < 1 || month > 12) throw httpError(400, 'month must be 1–12');
  return { year, month };
}

/** Normalize tab label; empty → home1. Max 64 chars. */
export function normalizeTabLabel(raw) {
  const s = String(raw ?? '').trim().slice(0, 64);
  return s || DEFAULT_MONTHLY_TAB_LABEL;
}

/** Next unused homeN among existing labels (case-insensitive). */
export function nextHomeTabLabel(existingLabels) {
  const used = new Set(
    (existingLabels || []).map((l) => String(l || '').trim().toLowerCase()).filter(Boolean)
  );
  let n = 1;
  while (used.has(`home${n}`)) n += 1;
  return `home${n}`;
}

/** MMYYYY display key matching the design sketch (e.g. 082026). */
export function billMonthKey(year, month) {
  return `${String(month).padStart(2, '0')}${year}`;
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
  if (/^paid\s*off$/i.test(s)) return 'Paid Off';
  return 'Manual';
}

function normalizeAction(billType, raw) {
  if (billType === 'Auto' || billType === 'Paid Off') return null;
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (/^paid$/i.test(s)) return 'Paid';
  if (/^not\s*paid$/i.test(s)) return 'Not Paid';
  return null;
}

function normalizeDueDay(raw) {
  if (raw == null || raw === '') return null;
  const n = toInt(raw);
  if (!n || n < 1 || n > 31) return null;
  return n;
}

/** Derive Status for UI (not stored).
 * auto | paid | overdue | upcoming (future unpaid → black circle) | none
 */
export function computeBillStatus(row, year, month, today = new Date()) {
  const billType = String(row?.bill_type || 'Manual');
  if (billType === 'Auto') {
    return { status: '', status_tone: 'auto' };
  }
  if (billType === 'Paid Off') {
    return { status: '', status_tone: 'paid_off' };
  }
  const action = row?.action ?? null;
  if (action === 'Paid') {
    return { status: 'Paid', status_tone: 'paid' };
  }
  const dueDay = toInt(row?.due_day);
  if (!dueDay) {
    return { status: '', status_tone: 'none' };
  }
  const due = new Date(year, month - 1, dueDay);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const unpaid = action !== 'Paid';
  if (unpaid && todayStart > due) {
    return { status: 'Over Due', status_tone: 'overdue' };
  }
  if (unpaid && todayStart <= due) {
    return { status: '', status_tone: 'upcoming' };
  }
  return { status: '', status_tone: 'none' };
}

function mapRow(row, year, month) {
  const y = year ?? Number(row.bill_year);
  const m = month ?? Number(row.bill_month);
  const derived = computeBillStatus(row, y, m);
  return {
    monthly_bill_id: Number(row.monthly_bill_id),
    singles_id: Number(row.singles_id),
    tab_label: row.tab_label || DEFAULT_MONTHLY_TAB_LABEL,
    soft_delete: Boolean(row.soft_delete),
    bill_year: y,
    bill_month: m,
    bill_month_key: billMonthKey(y, m),
    row_index: Number(row.row_index),
    bill_description: row.bill_description ?? '',
    due_day: row.due_day != null ? Number(row.due_day) : null,
    amount: row.amount ?? '',
    bill_type:
      row.bill_type === 'Auto' ? 'Auto' : row.bill_type === 'Paid Off' ? 'Paid Off' : 'Manual',
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
    `SELECT tab_label, MIN(monthly_bill_id) AS first_id
       FROM outdateddbsnapshotoct2024.monthly_bill
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
       FROM outdateddbsnapshotoct2024.monthly_bill
      WHERE singles_id = $1 AND storage_backend = $2`,
    [singlesId, storageBackend]
  );
  return rows.map((r) => String(r.tab_label || '').trim()).filter(Boolean);
}

/** Active tabs; if none in DB yet, virtual default home1. */
async function listActiveTabs(client, singlesId, storageBackend) {
  const tabs = await listTabLabels(client, singlesId, storageBackend, { softDelete: false });
  return tabs.length ? tabs : [DEFAULT_MONTHLY_TAB_LABEL];
}

async function listDeletedTabs(client, singlesId, storageBackend) {
  return listTabLabels(client, singlesId, storageBackend, { softDelete: true });
}

async function countMonthRows(client, singlesId, year, month, storageBackend, tabLabel) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS c
       FROM outdateddbsnapshotoct2024.monthly_bill
      WHERE singles_id = $1 AND storage_backend = $2
        AND tab_label = $3
        AND soft_delete = false
        AND bill_year = $4 AND bill_month = $5`,
    [singlesId, storageBackend, tabLabel, year, month]
  );
  return Number(rows[0]?.c) || 0;
}

async function findPriorMonthWithRows(client, singlesId, year, month, storageBackend, tabLabel) {
  const { rows } = await client.query(
    `SELECT bill_year, bill_month
       FROM outdateddbsnapshotoct2024.monthly_bill
      WHERE singles_id = $1
        AND storage_backend = $2
        AND tab_label = $3
        AND soft_delete = false
        AND (bill_year < $4 OR (bill_year = $4 AND bill_month < $5))
      GROUP BY bill_year, bill_month
      ORDER BY bill_year DESC, bill_month DESC
      LIMIT 1`,
    [singlesId, storageBackend, tabLabel, year, month]
  );
  if (!rows[0]) return null;
  return { year: Number(rows[0].bill_year), month: Number(rows[0].bill_month) };
}

/**
 * If target month has no rows for this tab, clone template fields from latest prior month
 * (action + paid_record_id left NULL). Unapproved Auto Scan rows are not cloned.
 */
export async function ensureMonthCloned(
  client,
  singlesId,
  year,
  month,
  storageBackend,
  tabLabel = DEFAULT_MONTHLY_TAB_LABEL
) {
  const label = normalizeTabLabel(tabLabel);
  const existing = await countMonthRows(client, singlesId, year, month, storageBackend, label);
  if (existing > 0) return { cloned: false, from: null };

  const prior = await findPriorMonthWithRows(client, singlesId, year, month, storageBackend, label);
  if (!prior) return { cloned: false, from: null };

  await client.query(
    `INSERT INTO outdateddbsnapshotoct2024.monthly_bill (
       singles_id, storage_backend, tab_label, soft_delete, bill_year, bill_month, row_index,
       bill_description, due_day, amount, bill_type,
       action, paid_record_id, bill_icon
     )
     SELECT
       singles_id, storage_backend, tab_label, false, $4, $5, row_index,
       bill_description, due_day, amount, bill_type,
       NULL, NULL, bill_icon
       FROM outdateddbsnapshotoct2024.monthly_bill
      WHERE singles_id = $1 AND storage_backend = $2
        AND tab_label = $3
        AND soft_delete = false
        AND bill_year = $6 AND bill_month = $7
        AND email_scan_pending = false
      ORDER BY row_index ASC`,
    [singlesId, storageBackend, label, year, month, prior.year, prior.month]
  );
  return { cloned: true, from: prior };
}

async function listMonthRows(client, singlesId, year, month, storageBackend, tabLabel) {
  const label = normalizeTabLabel(tabLabel);
  const { rows } = await client.query(
    `SELECT mb.*,
            (
              COALESCE(LENGTH(TRIM(pr.notes_text)), 0) > 0
              OR EXISTS (
                SELECT 1
                  FROM outdateddbsnapshotoct2024.paid_record_attachment a
                 WHERE a.paid_record_id = pr.paid_record_id
              )
            ) AS has_bill_content
       FROM outdateddbsnapshotoct2024.monthly_bill mb
       LEFT JOIN outdateddbsnapshotoct2024.paid_record pr
         ON pr.paid_record_id = mb.paid_record_id
      WHERE mb.singles_id = $1 AND mb.storage_backend = $2
        AND mb.tab_label = $3
        AND mb.soft_delete = false
        AND mb.bill_year = $4 AND mb.bill_month = $5
      ORDER BY mb.row_index ASC, mb.monthly_bill_id ASC`,
    [singlesId, storageBackend, label, year, month]
  );
  return rows.map((r) => mapRow(r, year, month));
}

async function tabsPayload(client, singlesId, storageBackend) {
  const [tabs, deleted_tabs] = await Promise.all([
    listActiveTabs(client, singlesId, storageBackend),
    listDeletedTabs(client, singlesId, storageBackend)
  ]);
  return { tabs, deleted_tabs };
}

/** Resolve requested tab; fall back to first active (or home1). */
function resolveRequestedTab(requested, activeTabs) {
  const list = activeTabs?.length ? activeTabs : [DEFAULT_MONTHLY_TAB_LABEL];
  const want = String(requested ?? '').trim();
  if (want && list.includes(want)) return want;
  return list[0];
}

/** GET /api/monthlyBill?year=&month=&tab_label=&storageType= — list (+ clone-on-first-open). */
export async function getMonthlyBill(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const { year, month } = parseYearMonth(req.query);
    const storageBackend = readBillStorageBackend(req);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tabMeta = await tabsPayload(client, singlesId, storageBackend);
      const tabLabel = resolveRequestedTab(req.query?.tab_label, tabMeta.tabs);
      const cloneInfo = await ensureMonthCloned(
        client,
        singlesId,
        year,
        month,
        storageBackend,
        tabLabel
      );
      const rows = await listMonthRows(client, singlesId, year, month, storageBackend, tabLabel);
      const peer = storageBackend === 'usb' ? 'tutaCloud' : 'usb';
      const { rows: peerCountRows } = await client.query(
        `SELECT COUNT(*)::int AS c
           FROM outdateddbsnapshotoct2024.monthly_bill
          WHERE singles_id = $1 AND storage_backend = $2 AND soft_delete = false`,
        [singlesId, peer]
      );
      await client.query('COMMIT');
      return res.json({
        bill_year: year,
        bill_month: month,
        bill_month_key: billMonthKey(year, month),
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

/**
 * PUT /api/monthlyBill
 * Body: { year, month, tab_label, rows: [...] }
 * Full replace for that tab + month (keeps forever history for other months/tabs).
 */
export async function putMonthlyBill(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const { year, month } = parseYearMonth(req.body || {});
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
      return {
        row_index: rowIndex,
        prior_bill_id: toInt(row?.monthly_bill_id) || null,
        bill_description: String(row?.bill_description ?? '').slice(0, 500),
        due_day: normalizeDueDay(row?.due_day),
        amount: normalizeAmount(row?.amount),
        bill_type: billType,
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
        `SELECT monthly_bill_id, paid_record_id
           FROM outdateddbsnapshotoct2024.monthly_bill
          WHERE singles_id = $1 AND storage_backend = $2
            AND tab_label = $3 AND soft_delete = false
            AND bill_year = $4 AND bill_month = $5
            AND paid_record_id IS NOT NULL`,
        [singlesId, storageBackend, tabLabel, year, month]
      );
      const priorPaidByBillId = new Map(
        priorLinks.map((p) => [Number(p.monthly_bill_id), Number(p.paid_record_id)])
      );
      for (const r of normalized) {
        if (!r.paid_record_id && r.prior_bill_id) {
          r.paid_record_id = priorPaidByBillId.get(r.prior_bill_id) || null;
        }
      }
      await client.query(
        `DELETE FROM outdateddbsnapshotoct2024.monthly_bill
          WHERE singles_id = $1 AND storage_backend = $2
            AND tab_label = $3 AND soft_delete = false
            AND bill_year = $4 AND bill_month = $5`,
        [singlesId, storageBackend, tabLabel, year, month]
      );
      for (const r of normalized) {
        const { rows: inserted } = await client.query(
          `INSERT INTO outdateddbsnapshotoct2024.monthly_bill (
             singles_id, storage_backend, tab_label, soft_delete, bill_year, bill_month, row_index,
             bill_description, due_day, amount, bill_type,
             action, paid_record_id, bill_icon, email_scan_pending
           ) VALUES ($1,$2,$3,false,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           RETURNING monthly_bill_id`,
          [
            singlesId,
            storageBackend,
            tabLabel,
            year,
            month,
            r.row_index,
            r.bill_description,
            r.due_day,
            r.amount,
            r.bill_type,
            r.action,
            r.paid_record_id,
            r.bill_icon,
            r.email_scan_pending
          ]
        );
        const newBillId = Number(inserted[0]?.monthly_bill_id);
        if (r.paid_record_id && newBillId) {
          await client.query(
            `UPDATE outdateddbsnapshotoct2024.paid_record
                SET monthly_bill_id = $1, updated_at = now()
              WHERE paid_record_id = $2 AND singles_id = $3`,
            [newBillId, r.paid_record_id, singlesId]
          );
        }
      }
      const rows = await listMonthRows(client, singlesId, year, month, storageBackend, tabLabel);
      const tabMeta = await tabsPayload(client, singlesId, storageBackend);
      await client.query('COMMIT');
      return res.json({
        ok: true,
        bill_year: year,
        bill_month: month,
        bill_month_key: billMonthKey(year, month),
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

/** POST /api/monthlyBill/tab/add — create next homeN tab (blank anchor row for year/month). */
export async function postMonthlyBillTabAdd(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const { year, month } = parseYearMonth(req.body || {});
    const storageBackend = readBillStorageBackend(req);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let allLabels = await listAllTabLabels(client, singlesId, storageBackend);
      // Materialize virtual home1 so it remains listed after the first Add Tab.
      if (allLabels.length === 0) {
        await client.query(
          `INSERT INTO outdateddbsnapshotoct2024.monthly_bill (
             singles_id, storage_backend, tab_label, soft_delete, bill_year, bill_month, row_index,
             bill_description, due_day, amount, bill_type, action, paid_record_id
           ) VALUES ($1,$2,$3,false,$4,$5,1,'',NULL,'','Manual',NULL,NULL)`,
          [singlesId, storageBackend, DEFAULT_MONTHLY_TAB_LABEL, year, month]
        );
        allLabels = [DEFAULT_MONTHLY_TAB_LABEL];
      }
      const tabLabel = nextHomeTabLabel(allLabels);
      await client.query(
        `INSERT INTO outdateddbsnapshotoct2024.monthly_bill (
           singles_id, storage_backend, tab_label, soft_delete, bill_year, bill_month, row_index,
           bill_description, due_day, amount, bill_type, action, paid_record_id
         ) VALUES ($1,$2,$3,false,$4,$5,1,'',NULL,'','Manual',NULL,NULL)`,
        [singlesId, storageBackend, tabLabel, year, month]
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

/** POST /api/monthlyBill/tab/remove — soft-delete all rows for tab_label. */
export async function postMonthlyBillTabRemove(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const storageBackend = readBillStorageBackend(req);
    const tabLabel = normalizeTabLabel(req.body?.tab_label);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const active = await listActiveTabs(client, singlesId, storageBackend);
      if (!active.includes(tabLabel) && tabLabel === DEFAULT_MONTHLY_TAB_LABEL && active.length === 1) {
        throw httpError(400, 'Cannot remove the only tab');
      }
      if (active.length <= 1) throw httpError(400, 'Cannot remove the only tab');
      if (!active.includes(tabLabel)) throw httpError(404, 'Tab not found');

      const { rowCount } = await client.query(
        `UPDATE outdateddbsnapshotoct2024.monthly_bill
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
        tab_label: tabMeta.tabs[0] || DEFAULT_MONTHLY_TAB_LABEL
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

/** POST /api/monthlyBill/tab/undelete — restore soft-deleted tab. */
export async function postMonthlyBillTabUndelete(req, res) {
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
        `UPDATE outdateddbsnapshotoct2024.monthly_bill
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

/** POST /api/monthlyBill/tab/rename — rename tab_label across all months. */
export async function postMonthlyBillTabRename(req, res) {
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

      // Virtual home1 with no DB rows yet: materialize under the new name.
      if (!allLabels.includes(fromLabel)) {
        if (fromLabel !== DEFAULT_MONTHLY_TAB_LABEL || active[0] !== DEFAULT_MONTHLY_TAB_LABEL) {
          throw httpError(404, 'Tab not found');
        }
        if (allLabels.map((l) => l.toLowerCase()).includes(toLabel.toLowerCase())) {
          throw httpError(409, 'Tab name already exists');
        }
        const { year, month } = parseYearMonth(req.body || {});
        await client.query(
          `INSERT INTO outdateddbsnapshotoct2024.monthly_bill (
             singles_id, storage_backend, tab_label, soft_delete, bill_year, bill_month, row_index,
             bill_description, due_day, amount, bill_type, action, paid_record_id
           ) VALUES ($1,$2,$3,false,$4,$5,1,'',NULL,'','Manual',NULL,NULL)`,
          [singlesId, storageBackend, toLabel, year, month]
        );
      } else {
        if (!active.includes(fromLabel)) throw httpError(404, 'Tab not found');
        if (allLabels.map((l) => l.toLowerCase()).includes(toLabel.toLowerCase())) {
          throw httpError(409, 'Tab name already exists');
        }
        await client.query(
          `UPDATE outdateddbsnapshotoct2024.monthly_bill
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
