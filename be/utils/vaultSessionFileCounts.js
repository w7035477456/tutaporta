import pool from '../db/connection.js';
import { isRecordVaultBridgeStandalone } from '../recordVaultBridge/standaloneMode.js';

function normalizeId(singlesId) {
  const id = Math.trunc(Number(singlesId));
  return Number.isFinite(id) && id >= 1 ? id : null;
}

function normalizeDelta(n) {
  const v = Math.trunc(Number(n));
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.min(v, 1_000_000);
}

function mapCountRow(row) {
  return {
    usbTxRx: Number(row?.notes_session_usb_tx_rx_count) || 0,
    uiTxRx: Number(row?.notes_session_ui_tx_rx_count) || 0
  };
}

function mapLastCountRow(row) {
  return {
    usbTxRx: Number(row?.notes_last_session_usb_tx_rx_count) || 0,
    uiTxRx: Number(row?.notes_last_session_ui_tx_rx_count) || 0
  };
}

/**
 * Cluster-safe session file counters on singles (Primary writes).
 * No-op in USB bridge standalone (no Postgres) — FE reports via website API.
 */
export async function getVaultSessionFileCounts(singlesId) {
  const id = normalizeId(singlesId);
  if (!id || isRecordVaultBridgeStandalone()) {
    return { usbTxRx: 0, uiTxRx: 0 };
  }
  try {
    const { rows } = await pool.query(
      `SELECT notes_session_usb_tx_rx_count, notes_session_ui_tx_rx_count
         FROM helloworldjunktest.singles
        WHERE singles_id = $1
        LIMIT 1`,
      [id]
    );
    return mapCountRow(rows[0]);
  } catch (err) {
    console.warn('[vault-session-file-counts] get failed:', err?.message || err);
    return { usbTxRx: 0, uiTxRx: 0 };
  }
}

/** Login-gate display: totals frozen at last Cloud/USB logoff. */
export async function getVaultLastSessionFileCounts(singlesId) {
  const id = normalizeId(singlesId);
  if (!id || isRecordVaultBridgeStandalone()) {
    return { usbTxRx: 0, uiTxRx: 0 };
  }
  try {
    const { rows } = await pool.query(
      `SELECT notes_last_session_usb_tx_rx_count, notes_last_session_ui_tx_rx_count
         FROM helloworldjunktest.singles
        WHERE singles_id = $1
        LIMIT 1`,
      [id]
    );
    return mapLastCountRow(rows[0]);
  } catch (err) {
    console.warn('[vault-session-file-counts] get last failed:', err?.message || err);
    return { usbTxRx: 0, uiTxRx: 0 };
  }
}

/**
 * Copy running session counts → last-session snapshot (call on logoff).
 * Keeps login-gate values even if session counters later reset/rehydrate.
 */
export async function snapshotVaultSessionFileCountsToLast(singlesId) {
  const id = normalizeId(singlesId);
  if (!id || isRecordVaultBridgeStandalone()) {
    return { usbTxRx: 0, uiTxRx: 0 };
  }
  try {
    const { rows } = await pool.query(
      `UPDATE helloworldjunktest.singles
          SET notes_last_session_usb_tx_rx_count = notes_session_usb_tx_rx_count,
              notes_last_session_ui_tx_rx_count = notes_session_ui_tx_rx_count
        WHERE singles_id = $1
    RETURNING notes_last_session_usb_tx_rx_count, notes_last_session_ui_tx_rx_count`,
      [id]
    );
    return mapLastCountRow(rows[0]);
  } catch (err) {
    console.warn('[vault-session-file-counts] snapshot failed:', err?.message || err);
    return getVaultLastSessionFileCounts(singlesId);
  }
}

export async function resetVaultSessionFileCounts(singlesId) {
  const id = normalizeId(singlesId);
  if (!id || isRecordVaultBridgeStandalone()) {
    return { usbTxRx: 0, uiTxRx: 0 };
  }
  try {
    const { rows } = await pool.query(
      `UPDATE helloworldjunktest.singles
          SET notes_session_usb_tx_rx_count = 0,
              notes_session_ui_tx_rx_count = 0
        WHERE singles_id = $1
    RETURNING notes_session_usb_tx_rx_count, notes_session_ui_tx_rx_count`,
      [id]
    );
    return mapCountRow(rows[0]);
  } catch (err) {
    console.warn('[vault-session-file-counts] reset failed:', err?.message || err);
    return { usbTxRx: 0, uiTxRx: 0 };
  }
}

/**
 * Atomically add to session counters. Returns updated totals.
 * @param {number} singlesId
 * @param {{ usbDelta?: number, uiDelta?: number }} deltas
 */
export async function addVaultSessionFileCounts(singlesId, { usbDelta = 0, uiDelta = 0 } = {}) {
  const id = normalizeId(singlesId);
  const usb = normalizeDelta(usbDelta);
  const ui = normalizeDelta(uiDelta);
  if (!id || isRecordVaultBridgeStandalone() || (usb <= 0 && ui <= 0)) {
    return getVaultSessionFileCounts(singlesId);
  }
  try {
    const { rows } = await pool.query(
      `UPDATE helloworldjunktest.singles
          SET notes_session_usb_tx_rx_count = notes_session_usb_tx_rx_count + $2,
              notes_session_ui_tx_rx_count = notes_session_ui_tx_rx_count + $3
        WHERE singles_id = $1
    RETURNING notes_session_usb_tx_rx_count, notes_session_ui_tx_rx_count`,
      [id, usb, ui]
    );
    return mapCountRow(rows[0]);
  } catch (err) {
    console.warn('[vault-session-file-counts] add failed:', err?.message || err);
    return getVaultSessionFileCounts(singlesId);
  }
}

/** Count notebooks + notes in an open vault session (logical USB open transfer units). */
export function countVaultSessionNotebooksAndNotes(session) {
  if (!session?.db) return 0;
  const countSql = (sql) => {
    const stmt = session.db.prepare(sql);
    try {
      if (!stmt.step()) return 0;
      const row = stmt.getAsObject();
      return Number(row?.c) || 0;
    } finally {
      stmt.free();
    }
  };
  try {
    return (
      countSql(`SELECT COUNT(*) AS c FROM notebooks WHERE deleted_at IS NULL`) +
      countSql(`SELECT COUNT(*) AS c FROM notes WHERE deleted_at IS NULL`)
    );
  } catch {
    return 0;
  }
}
