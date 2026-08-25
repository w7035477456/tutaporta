/**
 * Copy/move Bill Schedule data between Cloud (onedrive) and USB storage sides.
 * Body: { mode: 'copy'|'move', kind: 'bill_schedule'|'bill_monthly'|'bill_yearly',
 *         sourceStorageType, targetStorageType }
 */

import pool from '../../db/connection.js';
import { parseBillStorageBackend } from '../../utils/billScheduleStorageBackend.js';

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function httpError(statusCode, message, code = null) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (code) err.code = code;
  return err;
}

function requireSinglesId(req) {
  const singlesId = toInt(req.auth?.singles_id);
  if (!singlesId || singlesId < 1) throw httpError(401, 'Authentication required');
  return singlesId;
}

async function countMonthly(client, singlesId, storageBackend) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS c
       FROM helloworldjunktest.monthly_bill
      WHERE singles_id = $1 AND storage_backend = $2`,
    [singlesId, storageBackend]
  );
  return Number(rows[0]?.c) || 0;
}

async function countYearly(client, singlesId, storageBackend) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS c
       FROM helloworldjunktest.yearly_bill
      WHERE singles_id = $1 AND storage_backend = $2`,
    [singlesId, storageBackend]
  );
  return Number(rows[0]?.c) || 0;
}

async function copyMonthly(client, singlesId, source, target) {
  await client.query(
    `INSERT INTO helloworldjunktest.monthly_bill (
       singles_id, storage_backend, bill_year, bill_month, row_index,
       bill_description, due_day, amount, bill_type, action, paid_record_id
     )
     SELECT
       singles_id, $3, bill_year, bill_month, row_index,
       bill_description, due_day, amount, bill_type, action, paid_record_id
       FROM helloworldjunktest.monthly_bill
      WHERE singles_id = $1 AND storage_backend = $2`,
    [singlesId, source, target]
  );
}

async function copyYearly(client, singlesId, source, target) {
  await client.query(
    `INSERT INTO helloworldjunktest.yearly_bill (
       singles_id, storage_backend, bill_year, bill_month, row_index,
       bill_description, due_month_day, amount, bill_type, action, paid_record_id
     )
     SELECT
       singles_id, $3, bill_year, bill_month, row_index,
       bill_description, due_month_day, amount, bill_type, action, paid_record_id
       FROM helloworldjunktest.yearly_bill
      WHERE singles_id = $1 AND storage_backend = $2`,
    [singlesId, source, target]
  );
}

async function deleteMonthly(client, singlesId, storageBackend) {
  await client.query(
    `DELETE FROM helloworldjunktest.monthly_bill
      WHERE singles_id = $1 AND storage_backend = $2`,
    [singlesId, storageBackend]
  );
}

async function deleteYearly(client, singlesId, storageBackend) {
  await client.query(
    `DELETE FROM helloworldjunktest.yearly_bill
      WHERE singles_id = $1 AND storage_backend = $2`,
    [singlesId, storageBackend]
  );
}

function storageSideLabel(backend) {
  return backend === 'usb' ? 'USB' : 'Cloud';
}

function emptySourceMessage(kind, source, otherHasData) {
  const srcLabel = storageSideLabel(source);
  const otherLabel = storageSideLabel(source === 'usb' ? 'onedrive' : 'usb');
  const what =
    kind === 'bill_monthly'
      ? 'Monthly Bill Schedule'
      : kind === 'bill_yearly'
        ? 'Yearly Bill Schedule'
        : 'Bill Schedule';
  if (otherHasData) {
    return (
      `No ${what} data on ${srcLabel}. Your rows are on ${otherLabel} — ` +
      `drag ${what} from ${otherLabel} onto ${srcLabel} to copy.`
    );
  }
  return `No ${what} data on ${srcLabel} yet. Add rows there first, or copy from the other vault.`;
}

/** POST /api/billSchedule/transfer */
export async function transferBillSchedule(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const mode = String(req.body?.mode || '').trim().toLowerCase();
    if (mode !== 'copy' && mode !== 'move') {
      throw httpError(400, 'mode must be copy or move');
    }
    const kind = String(req.body?.kind || '').trim().toLowerCase();
    if (!['bill_schedule', 'bill_monthly', 'bill_yearly'].includes(kind)) {
      throw httpError(400, 'kind must be bill_schedule, bill_monthly, or bill_yearly');
    }
    const source = parseBillStorageBackend(req.body?.sourceStorageType);
    const target = parseBillStorageBackend(req.body?.targetStorageType);
    if (source === target) throw httpError(400, 'Source and destination must differ');

    const doMonthly = kind === 'bill_schedule' || kind === 'bill_monthly';
    const doYearly = kind === 'bill_schedule' || kind === 'bill_yearly';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const srcMonthlyBefore = doMonthly ? await countMonthly(client, singlesId, source) : 0;
      const srcYearlyBefore = doYearly ? await countYearly(client, singlesId, source) : 0;
      const other = source === 'usb' ? 'onedrive' : 'usb';
      const otherMonthly = doMonthly ? await countMonthly(client, singlesId, other) : 0;
      const otherYearly = doYearly ? await countYearly(client, singlesId, other) : 0;
      const otherHas =
        (doMonthly && otherMonthly > 0) || (doYearly && otherYearly > 0);

      if (kind === 'bill_schedule' && srcMonthlyBefore < 1 && srcYearlyBefore < 1) {
        throw httpError(400, emptySourceMessage(kind, source, otherHas));
      }

      if (doMonthly) {
        if (srcMonthlyBefore > 0) {
          // Overwrite destination — clear first, do not ask the user.
          await deleteMonthly(client, singlesId, target);
          await copyMonthly(client, singlesId, source, target);
          if (mode === 'move') await deleteMonthly(client, singlesId, source);
        } else if (kind === 'bill_monthly') {
          throw httpError(400, emptySourceMessage(kind, source, otherMonthly > 0));
        }
      }

      if (doYearly) {
        if (srcYearlyBefore > 0) {
          // Overwrite destination — clear first, do not ask the user.
          await deleteYearly(client, singlesId, target);
          await copyYearly(client, singlesId, source, target);
          if (mode === 'move') await deleteYearly(client, singlesId, source);
        } else if (kind === 'bill_yearly') {
          throw httpError(400, emptySourceMessage(kind, source, otherYearly > 0));
        }
      }

      await client.query('COMMIT');
      return res.json({
        ok: true,
        mode,
        kind,
        sourceStorageType: source,
        targetStorageType: target
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
    const statusCode = Number(err?.statusCode) || 500;
    const body = { error: statusCode < 500 ? err.message : 'Bill Schedule transfer failed' };
    if (err?.code) body.code = err.code;
    if (statusCode >= 500) console.error('[billScheduleTransfer]', err);
    return res.status(statusCode).json(body);
  }
}
