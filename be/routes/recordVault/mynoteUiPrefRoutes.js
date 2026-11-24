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

/** GET /api/mynoteUiPref → { list_font_pct } (100 when never set). */
export async function getMynoteUiPref(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const { rows } = await pool.query(
      `SELECT list_font_pct FROM outdateddbsnapshotoct2024.mynote_ui_pref WHERE singles_id = $1`,
      [singlesId]
    );
    return res.json({ list_font_pct: rows[0] ? Number(rows[0].list_font_pct) : LIST_FONT_PCT_DEFAULT });
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
