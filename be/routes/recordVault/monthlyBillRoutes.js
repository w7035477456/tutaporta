import pool from '../../db/connection.js';

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
  const message = statusCode < 500 ? error?.message || fallback : fallback;
  if (statusCode >= 500) console.error('[monthly-bill]', error);
  return res.status(statusCode).json({ error: message });
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
    bill_year: y,
    bill_month: m,
    bill_month_key: billMonthKey(y, m),
    row_index: Number(row.row_index),
    bill_description: row.bill_description ?? '',
    due_day: row.due_day != null ? Number(row.due_day) : null,
    amount: row.amount ?? '',
    bill_type: row.bill_type === 'Auto' ? 'Auto' : 'Manual',
    action: row.action ?? null,
    paid_record_id: row.paid_record_id != null ? Number(row.paid_record_id) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ...derived
  };
}

async function countMonthRows(client, singlesId, year, month) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS c
       FROM helloworldjunktest.monthly_bill
      WHERE singles_id = $1 AND bill_year = $2 AND bill_month = $3`,
    [singlesId, year, month]
  );
  return Number(rows[0]?.c) || 0;
}

async function findPriorMonthWithRows(client, singlesId, year, month) {
  const { rows } = await client.query(
    `SELECT bill_year, bill_month
       FROM helloworldjunktest.monthly_bill
      WHERE singles_id = $1
        AND (bill_year < $2 OR (bill_year = $2 AND bill_month < $3))
      GROUP BY bill_year, bill_month
      ORDER BY bill_year DESC, bill_month DESC
      LIMIT 1`,
    [singlesId, year, month]
  );
  if (!rows[0]) return null;
  return { year: Number(rows[0].bill_year), month: Number(rows[0].bill_month) };
}

/**
 * If target month has no rows, clone template fields from latest prior month
 * (action + paid_record_id left NULL).
 */
async function ensureMonthCloned(client, singlesId, year, month) {
  const existing = await countMonthRows(client, singlesId, year, month);
  if (existing > 0) return { cloned: false, from: null };

  const prior = await findPriorMonthWithRows(client, singlesId, year, month);
  if (!prior) return { cloned: false, from: null };

  await client.query(
    `INSERT INTO helloworldjunktest.monthly_bill (
       singles_id, bill_year, bill_month, row_index,
       bill_description, due_day, amount, bill_type,
       action, paid_record_id
     )
     SELECT
       singles_id, $2, $3, row_index,
       bill_description, due_day, amount, bill_type,
       NULL, NULL
       FROM helloworldjunktest.monthly_bill
      WHERE singles_id = $1 AND bill_year = $4 AND bill_month = $5
      ORDER BY row_index ASC`,
    [singlesId, year, month, prior.year, prior.month]
  );
  return { cloned: true, from: prior };
}

async function listMonthRows(client, singlesId, year, month) {
  const { rows } = await client.query(
    `SELECT *
       FROM helloworldjunktest.monthly_bill
      WHERE singles_id = $1 AND bill_year = $2 AND bill_month = $3
      ORDER BY row_index ASC, monthly_bill_id ASC`,
    [singlesId, year, month]
  );
  return rows.map((r) => mapRow(r, year, month));
}

/** GET /api/monthlyBill?year=&month= — list (+ clone-on-first-open). */
export async function getMonthlyBill(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const { year, month } = parseYearMonth(req.query);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const cloneInfo = await ensureMonthCloned(client, singlesId, year, month);
      const rows = await listMonthRows(client, singlesId, year, month);
      await client.query('COMMIT');
      return res.json({
        bill_year: year,
        bill_month: month,
        bill_month_key: billMonthKey(year, month),
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
 * Body: { year, month, rows: [{ row_index?, bill_description, due_day, amount, bill_type, action, paid_record_id? }] }
 * Full replace for that month (keeps forever history for other months).
 */
export async function putMonthlyBill(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const { year, month } = parseYearMonth(req.body || {});
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
        due_day: normalizeDueDay(row?.due_day),
        amount: normalizeAmount(row?.amount),
        bill_type: billType,
        action,
        paid_record_id:
          billType === 'Manual' && action === 'Paid' && paidRecordId && paidRecordId > 0
            ? paidRecordId
            : null
      };
    });

    // Ensure unique row_index
    const seen = new Set();
    for (const r of normalized) {
      if (seen.has(r.row_index)) throw httpError(400, `Duplicate row_index ${r.row_index}`);
      seen.add(r.row_index);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM helloworldjunktest.monthly_bill
          WHERE singles_id = $1 AND bill_year = $2 AND bill_month = $3`,
        [singlesId, year, month]
      );
      for (const r of normalized) {
        await client.query(
          `INSERT INTO helloworldjunktest.monthly_bill (
             singles_id, bill_year, bill_month, row_index,
             bill_description, due_day, amount, bill_type,
             action, paid_record_id
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            singlesId,
            year,
            month,
            r.row_index,
            r.bill_description,
            r.due_day,
            r.amount,
            r.bill_type,
            r.action,
            r.paid_record_id
          ]
        );
      }
      const rows = await listMonthRows(client, singlesId, year, month);
      await client.query('COMMIT');
      return res.json({
        ok: true,
        bill_year: year,
        bill_month: month,
        bill_month_key: billMonthKey(year, month),
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
