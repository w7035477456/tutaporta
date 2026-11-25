import pool from '../../db/connection.js';

export const LIST_FONT_PCT_MIN = 50;
export const LIST_FONT_PCT_MAX = 250;
export const LIST_FONT_PCT_DEFAULT = 100;

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function requireSinglesId(req) {
  const singlesId = toInt(req.auth?.singles_id);
  if (!singlesId || singlesId < 1) {
    const err = new Error('Authentication required');
    err.statusCode = 401;
    throw err;
  }
  return singlesId;
}

function sendError(res, error) {
  const statusCode = Number(error?.statusCode) || 500;
  let message = error?.message || 'TutaNotes preference request failed';
  if (String(error?.code || '') === '42P01') {
    message = 'Database table mynote_ui_pref is missing. On Postgres run: be/db/createMynoteUiPref.sql';
  }
  if (statusCode >= 500) console.error('[mynote-ui-pref]', { message: error?.message, code: error?.code });
  return res.status(statusCode).json({ error: message });
}

const BILL_ICON_NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const BILL_ICON_ORDER_MAX = 3000;

/** GET /api/mynoteUiPref → { list_font_pct, bill_icon_order } (100 / null when never set). */
export async function getMynoteUiPref(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const { rows } = await pool.query(
      `SELECT list_font_pct, bill_icon_order FROM outdateddbsnapshotoct2024.mynote_ui_pref WHERE singles_id = $1`,
      [singlesId]
    );
    return res.json({
      list_font_pct: rows[0] ? Number(rows[0].list_font_pct) : LIST_FONT_PCT_DEFAULT,
      bill_icon_order: Array.isArray(rows[0]?.bill_icon_order) ? rows[0].bill_icon_order : null
    });
  } catch (err) {
    return sendError(res, err);
  }
}

/** PUT /api/mynoteUiPref  body: { list_font_pct } (50–250). */
export async function putMynoteUiPref(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const pct = toInt(req.body?.list_font_pct);
    if (pct == null || pct < LIST_FONT_PCT_MIN || pct > LIST_FONT_PCT_MAX) {
      return res.status(400).json({ error: `list_font_pct must be ${LIST_FONT_PCT_MIN}–${LIST_FONT_PCT_MAX}` });
    }
    await pool.query(
      `INSERT INTO outdateddbsnapshotoct2024.mynote_ui_pref (singles_id, list_font_pct, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (singles_id) DO UPDATE SET list_font_pct = EXCLUDED.list_font_pct, updated_at = now()`,
      [singlesId, pct]
    );
    return res.json({ ok: true, list_font_pct: pct });
  } catch (err) {
    return sendError(res, err);
  }
}

/** PUT /api/mynoteUiPref/billIconOrder  body: { order: string[] | null } (null = back to default order). */
export async function putBillIconOrder(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const raw = req.body?.order;
    let order = null;
    if (raw != null) {
      if (!Array.isArray(raw) || raw.length > BILL_ICON_ORDER_MAX) {
        return res.status(400).json({ error: `order must be an array of at most ${BILL_ICON_ORDER_MAX} icon names` });
      }
      const seen = new Set();
      order = [];
      for (const name of raw) {
        const n = String(name ?? '');
        if (!BILL_ICON_NAME_RE.test(n)) return res.status(400).json({ error: `Invalid icon name: ${n.slice(0, 64)}` });
        if (!seen.has(n)) {
          seen.add(n);
          order.push(n);
        }
      }
    }
    await pool.query(
      `INSERT INTO outdateddbsnapshotoct2024.mynote_ui_pref (singles_id, bill_icon_order, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (singles_id) DO UPDATE SET bill_icon_order = EXCLUDED.bill_icon_order, updated_at = now()`,
      [singlesId, order]
    );
    return res.json({ ok: true, bill_icon_order: order });
  } catch (err) {
    if (String(err?.code || '') === '42703') {
      err.message = 'Column mynote_ui_pref.bill_icon_order is missing — run dbmigrate (scripts/db-migrate.sh).';
    }
    return sendError(res, err);
  }
}
