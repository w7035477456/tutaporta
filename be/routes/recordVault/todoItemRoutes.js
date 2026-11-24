import pool from '../../db/connection.js';
import { readBillStorageBackend } from '../../utils/billScheduleStorageBackend.js';

export const TODO_LANES = ['repo', 'scheduled', 'done'];
const MAX_ITEMS = 2000;
const MAX_BODY = 4000;

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function sendError(res, error) {
  const statusCode = Number(error?.statusCode) || 500;
  const pgCode = String(error?.code || '');
  let message = error?.message || 'ToDo request failed';
  if (pgCode === '42P01') {
    message = 'Database table todo_item is missing. On Postgres run: be/db/createTodoItem.sql';
  } else if (pgCode === '42703') {
    message = 'Database column todo_item.kind is missing. On Postgres run: be/db/alterTodoItemKind.sql';
  }
  if (statusCode >= 500) {
    console.error('[todo-item]', { message: error?.message, code: error?.code, detail: error?.detail });
  }
  return res.status(statusCode).json({ error: message, ...(pgCode ? { code: pgCode } : {}) });
}

/** 'YYYY-MM-DD' (a real calendar date, 2000–2100) or null. */
function normalizeDueDate(raw) {
  const s = String(raw ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 2000 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return s;
}

/** ISO timestamp (2000–2100) or null. */
function normalizeTimestamp(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return null;
  const y = new Date(ms).getUTCFullYear();
  if (y < 2000 || y > 2100) return null;
  return new Date(ms).toISOString();
}

function requireSinglesId(req) {
  const singlesId = toInt(req.auth?.singles_id);
  if (!singlesId || singlesId < 1) throw httpError(401, 'Authentication required');
  return singlesId;
}

async function listItems(client, singlesId, storageBackend) {
  const { rows } = await client.query(
    `SELECT t.todo_item_id, t.kind, t.lane, t.seq, t.body, t.paid_record_id,
            to_char(t.due_date, 'YYYY-MM-DD') AS due_date,
            t.done_at,
            t.lane_entered_at,
            (
              COALESCE(LENGTH(TRIM(pr.notes_text)), 0) > 0
              OR EXISTS (
                SELECT 1
                  FROM outdateddbsnapshotoct2024.paid_record_attachment a
                 WHERE a.paid_record_id = pr.paid_record_id
              )
            ) AS has_bill_content
       FROM outdateddbsnapshotoct2024.todo_item t
       LEFT JOIN outdateddbsnapshotoct2024.paid_record pr
         ON pr.paid_record_id = t.paid_record_id
      WHERE t.singles_id = $1 AND t.storage_backend = $2
      ORDER BY t.lane, t.seq`,
    [singlesId, storageBackend]
  );
  return rows.map((r) => ({
    todo_item_id: Number(r.todo_item_id),
    kind: r.kind === 'divider' ? 'divider' : 'task',
    lane: r.lane,
    seq: Number(r.seq),
    body: r.body ?? '',
    paid_record_id: r.paid_record_id != null ? Number(r.paid_record_id) : null,
    due_date: r.due_date || null,
    done_at: r.done_at ? new Date(r.done_at).toISOString() : null,
    lane_entered_at: r.lane_entered_at ? new Date(r.lane_entered_at).toISOString() : null,
    has_bill_content: Boolean(r.has_bill_content)
  }));
}

/** GET /api/todoItems?storageType= → { items: [{ todo_item_id, lane, seq, body }] } */
export async function getTodoItems(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const storageBackend = readBillStorageBackend(req);
    const items = await listItems(pool, singlesId, storageBackend);
    return res.json({ storage_backend: storageBackend, items });
  } catch (err) {
    return sendError(res, err);
  }
}

/**
 * PUT /api/todoItems
 * Body: { storageType, items: [{ kind? ('task' | 'divider'), lane, body, paid_record_id?, due_date? ('YYYY-MM-DD'), done_at? (ISO, Done lane only), lane_entered_at? (ISO) }] } — array order within each lane is the sequence.
 * Full replace for this user + storage backend; seq is renumbered 1..n per lane.
 */
export async function putTodoItems(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const storageBackend = readBillStorageBackend(req);
    const incoming = Array.isArray(req.body?.items) ? req.body.items : null;
    if (!incoming) throw httpError(400, 'items array required');
    if (incoming.length > MAX_ITEMS) throw httpError(400, `Too many items (max ${MAX_ITEMS})`);

    const nextSeq = { repo: 0, scheduled: 0, done: 0 };
    const normalized = incoming.map((item) => {
      const lane = String(item?.lane ?? '').trim();
      if (!TODO_LANES.includes(lane)) throw httpError(400, `lane must be one of ${TODO_LANES.join(', ')}`);
      nextSeq[lane] += 1;
      if (item?.kind === 'divider') {
        // Divider line: position only — no text, paperclip, due date or done time.
        return {
          kind: 'divider',
          lane,
          seq: nextSeq[lane],
          body: '',
          paid_record_id: null,
          due_date: null,
          done_at: null,
          lane_entered_at: normalizeTimestamp(item?.lane_entered_at)
        };
      }
      const paidRecordId = toInt(item?.paid_record_id);
      return {
        kind: 'task',
        lane,
        seq: nextSeq[lane],
        body: String(item?.body ?? '').slice(0, MAX_BODY),
        paid_record_id: paidRecordId && paidRecordId > 0 ? paidRecordId : null,
        due_date: normalizeDueDate(item?.due_date),
        // Only tasks in Todo Done carry a completion time.
        done_at: lane === 'done' ? normalizeTimestamp(item?.done_at) : null,
        // Missing / invalid → now (task just landed in this lane).
        lane_entered_at: normalizeTimestamp(item?.lane_entered_at)
      };
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Only keep paperclip links to this user's own 'todo' Bills/Receipts records.
      const wantedIds = [...new Set(normalized.map((r) => r.paid_record_id).filter(Boolean))];
      if (wantedIds.length) {
        const { rows: owned } = await client.query(
          `SELECT paid_record_id
             FROM outdateddbsnapshotoct2024.paid_record
            WHERE singles_id = $1 AND schedule_kind = 'todo' AND paid_record_id = ANY($2::bigint[])`,
          [singlesId, wantedIds]
        );
        const ownedIds = new Set(owned.map((o) => Number(o.paid_record_id)));
        for (const r of normalized) {
          if (r.paid_record_id && !ownedIds.has(r.paid_record_id)) r.paid_record_id = null;
        }
      }
      await client.query(
        `DELETE FROM outdateddbsnapshotoct2024.todo_item
          WHERE singles_id = $1 AND storage_backend = $2`,
        [singlesId, storageBackend]
      );
      for (const r of normalized) {
        await client.query(
          `INSERT INTO outdateddbsnapshotoct2024.todo_item (
             singles_id, storage_backend, lane, seq, body, paid_record_id, due_date, done_at, lane_entered_at, kind
           ) VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8::timestamptz, COALESCE($9::timestamptz, now()), $10)`,
          [singlesId, storageBackend, r.lane, r.seq, r.body, r.paid_record_id, r.due_date, r.done_at, r.lane_entered_at, r.kind]
        );
      }
      const items = await listItems(client, singlesId, storageBackend);
      await client.query('COMMIT');
      return res.json({ ok: true, storage_backend: storageBackend, items });
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
