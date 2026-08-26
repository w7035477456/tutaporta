import pool from '../../db/connection.js';
import { readBillStorageBackend } from '../../utils/billScheduleStorageBackend.js';

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
      'Database schema for yearly_bill is outdated. On Postgres run: be/db/alterBillScheduleStorageBackend.sql';
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

/**
 * Derive Status for UI (not stored).
 * auto | paid | overdue | upcoming (future unpaid → black circle) | none
 */
export function computeYearlyBillStatus(row, year, today = new Date()) {
  const billType = String(row?.bill_type || 'Manual');
  if (billType === 'Auto') {
    return { status: '', status_tone: 'auto' };
  }
  const action = row?.action ?? null;
  if (action === 'Paid') {
    return { status: 'Paid', status_tone: 'paid' };
  }
  const dueMonth = toInt(row?.bill_month);
  const dueDay = toInt(row?.due_month_day);
  if (!dueMonth || !dueDay) {
    return { status: '', status_tone: 'none' };
  }
  const due = new Date(year, dueMonth - 1, dueDay);
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

function mapRow(row, year) {
  const y = year ?? Number(row.bill_year);
  const derived = computeYearlyBillStatus(row, y);
  return {
    yearly_bill_id: Number(row.yearly_bill_id),
    singles_id: Number(row.singles_id),
    bill_year: y,
    bill_month: row.bill_month != null ? Number(row.bill_month) : null,
    row_index: Number(row.row_index),
    bill_description: row.bill_description ?? '',
    due_month_day: row.due_month_day != null ? Number(row.due_month_day) : null,
    amount: row.amount ?? '',
    bill_type: row.bill_type === 'Auto' ? 'Auto' : 'Manual',
    action: row.action ?? null,
    paid_record_id: row.paid_record_id != null ? Number(row.paid_record_id) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ...derived
  };
}

async function countYearRows(client, singlesId, year, storageBackend) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS c
       FROM helloworldjunktest.yearly_bill
      WHERE singles_id = $1 AND storage_backend = $2 AND bill_year = $3`,
    [singlesId, storageBackend, year]
  );
  return Number(rows[0]?.c) || 0;
}

async function findPriorYearWithRows(client, singlesId, year, storageBackend) {
  const { rows } = await client.query(
    `SELECT bill_year
       FROM helloworldjunktest.yearly_bill
      WHERE singles_id = $1 AND storage_backend = $2 AND bill_year < $3
      GROUP BY bill_year
      ORDER BY bill_year DESC
      LIMIT 1`,
    [singlesId, storageBackend, year]
  );
  if (!rows[0]) return null;
  return Number(rows[0].bill_year);
}

async function ensureYearCloned(client, singlesId, year, storageBackend) {
  const existing = await countYearRows(client, singlesId, year, storageBackend);
  if (existing > 0) return { cloned: false, from: null };

  const priorYear = await findPriorYearWithRows(client, singlesId, year, storageBackend);
  if (!priorYear) return { cloned: false, from: null };

  await client.query(
    `INSERT INTO helloworldjunktest.yearly_bill (
       singles_id, storage_backend, bill_year, bill_month, row_index,
       bill_description, due_month_day, amount, bill_type,
       action, paid_record_id
     )
     SELECT
       singles_id, storage_backend, $3, bill_month, row_index,
       bill_description, due_month_day, amount, bill_type,
       NULL, NULL
       FROM helloworldjunktest.yearly_bill
      WHERE singles_id = $1 AND storage_backend = $2 AND bill_year = $4
      ORDER BY row_index ASC`,
    [singlesId, storageBackend, year, priorYear]
  );
  return { cloned: true, from: priorYear };
}

async function listYearRows(client, singlesId, year, storageBackend) {
  const { rows } = await client.query(
    `SELECT *
       FROM helloworldjunktest.yearly_bill
      WHERE singles_id = $1 AND storage_backend = $2 AND bill_year = $3
      ORDER BY row_index ASC, yearly_bill_id ASC`,
    [singlesId, storageBackend, year]
  );
  return rows.map((r) => mapRow(r, year));
}

/** GET /api/yearlyBill?year=&storageType=onedrive|usb — list (+ clone-on-first-open). */
export async function getYearlyBill(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const year = parseYear(req.query);
    const storageBackend = readBillStorageBackend(req);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const cloneInfo = await ensureYearCloned(client, singlesId, year, storageBackend);
      const rows = await listYearRows(client, singlesId, year, storageBackend);
      const peer = storageBackend === 'usb' ? 'onedrive' : 'usb';
      const { rows: peerCountRows } = await client.query(
        `SELECT COUNT(*)::int AS c
           FROM helloworldjunktest.yearly_bill
          WHERE singles_id = $1 AND storage_backend = $2`,
        [singlesId, peer]
      );
      await client.query('COMMIT');
      return res.json({
        bill_year: year,
        storage_backend: storageBackend,
        peer_storage_backend: peer,
        peer_has_rows: (Number(peerCountRows[0]?.c) || 0) > 0,
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
 * PUT /api/yearlyBill
 * Body: { year, storageType?, rows: [...] }
 */
export async function putYearlyBill(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const year = parseYear(req.body || {});
    const storageBackend = readBillStorageBackend(req);
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
        bill_description: String(row?.bill_description ?? '').slice(0, 500),
        bill_month: normalizeMonth(row?.bill_month),
        due_month_day: normalizeDueDay(row?.due_month_day),
        amount: normalizeAmount(row?.amount),
        bill_type: billType,
        action,
        paid_record_id:
          billType === 'Manual' && action === 'Paid' && paidRecordId && paidRecordId > 0
            ? paidRecordId
            : null
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
      await client.query(
        `DELETE FROM helloworldjunktest.yearly_bill
          WHERE singles_id = $1 AND storage_backend = $2 AND bill_year = $3`,
        [singlesId, storageBackend, year]
      );
      for (const r of normalized) {
        await client.query(
          `INSERT INTO helloworldjunktest.yearly_bill (
             singles_id, storage_backend, bill_year, bill_month, row_index,
             bill_description, due_month_day, amount, bill_type,
             action, paid_record_id
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            singlesId,
            storageBackend,
            year,
            r.bill_month,
            r.row_index,
            r.bill_description,
            r.due_month_day,
            r.amount,
            r.bill_type,
            r.action,
            r.paid_record_id
          ]
        );
      }
      const rows = await listYearRows(client, singlesId, year, storageBackend);
      await client.query('COMMIT');
      return res.json({
        ok: true,
        bill_year: year,
        storage_backend: storageBackend,
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
