import pool from '../db/connection.js';
import { isPhotoAlbumsBridgeStandalone } from '../photoAlbumsBridge/standaloneMode.js';
import { PHOTO_ALBUMS_VAULT_TABLES } from './photoAlbumsUsb/vaultPgStore.js';

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
    usbTxRx: Number(row?.photoalbums_session_usb_tx_rx_count) || 0,
    uiTxRx: Number(row?.photoalbums_session_ui_tx_rx_count) || 0
  };
}

function mapLastCountRow(row) {
  return {
    usbTxRx: Number(row?.photoalbums_last_session_usb_tx_rx_count) || 0,
    uiTxRx: Number(row?.photoalbums_last_session_ui_tx_rx_count) || 0
  };
}

/**
 * Cluster-safe session file counters on singles (Primary writes).
 * No-op in USB bridge standalone (no Postgres) — FE reports via website API.
 */
export async function getVaultSessionFileCounts(singlesId) {
  const id = normalizeId(singlesId);
  if (!id || isPhotoAlbumsBridgeStandalone()) {
    return { usbTxRx: 0, uiTxRx: 0 };
  }
  try {
    const { rows } = await pool.query(
      `SELECT photoalbums_session_usb_tx_rx_count, photoalbums_session_ui_tx_rx_count
         FROM outdateddbsnapshotoct2024.singles
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
  if (!id || isPhotoAlbumsBridgeStandalone()) {
    return { usbTxRx: 0, uiTxRx: 0 };
  }
  try {
    const { rows } = await pool.query(
      `SELECT photoalbums_last_session_usb_tx_rx_count, photoalbums_last_session_ui_tx_rx_count
         FROM outdateddbsnapshotoct2024.singles
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
  if (!id || isPhotoAlbumsBridgeStandalone()) {
    return { usbTxRx: 0, uiTxRx: 0 };
  }
  try {
    const { rows } = await pool.query(
      `UPDATE outdateddbsnapshotoct2024.singles
          SET photoalbums_last_session_usb_tx_rx_count = photoalbums_session_usb_tx_rx_count,
              photoalbums_last_session_ui_tx_rx_count = photoalbums_session_ui_tx_rx_count
        WHERE singles_id = $1
    RETURNING photoalbums_last_session_usb_tx_rx_count, photoalbums_last_session_ui_tx_rx_count`,
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
  if (!id || isPhotoAlbumsBridgeStandalone()) {
    return { usbTxRx: 0, uiTxRx: 0 };
  }
  try {
    const { rows } = await pool.query(
      `UPDATE outdateddbsnapshotoct2024.singles
          SET photoalbums_session_usb_tx_rx_count = 0,
              photoalbums_session_ui_tx_rx_count = 0
        WHERE singles_id = $1
    RETURNING photoalbums_session_usb_tx_rx_count, photoalbums_session_ui_tx_rx_count`,
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
  if (!id || isPhotoAlbumsBridgeStandalone() || (usb <= 0 && ui <= 0)) {
    return getVaultSessionFileCounts(singlesId);
  }
  try {
    const { rows } = await pool.query(
      `UPDATE outdateddbsnapshotoct2024.singles
          SET photoalbums_session_usb_tx_rx_count = photoalbums_session_usb_tx_rx_count + $2,
              photoalbums_session_ui_tx_rx_count = photoalbums_session_ui_tx_rx_count + $3
        WHERE singles_id = $1
    RETURNING photoalbums_session_usb_tx_rx_count, photoalbums_session_ui_tx_rx_count`,
      [id, usb, ui]
    );
    return mapCountRow(rows[0]);
  } catch (err) {
    console.warn('[vault-session-file-counts] add failed:', err?.message || err);
    return getVaultSessionFileCounts(singlesId);
  }
}

/** Count notebooks + notes in an open vault session (logical USB open transfer units). */
export async function countVaultSessionNotebooksAndNotes(session) {
  if (!session?.db) return 0;
  try {
    const row = await session.db.one(
      `SELECT
         (SELECT COUNT(*)::int FROM ${PHOTO_ALBUMS_VAULT_TABLES.notebooks}
           WHERE singles_id = $1 AND deleted_at IS NULL) +
         (SELECT COUNT(*)::int FROM ${PHOTO_ALBUMS_VAULT_TABLES.notes}
           WHERE singles_id = $1 AND deleted_at IS NULL) AS c`,
      [session.db.singlesId]
    );
    return Number(row?.c) || 0;
  } catch {
    return 0;
  }
}
