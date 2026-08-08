import { getDBSchema } from '../db/connection.js';
import { VAULT_REFILL_BLOCK_MB } from './photoAlbumsTransferTracking.js';

/** Exact Balance History description for the new-member courtesy Tx/Rx grant. */
export const COMPLIMENTARY_NEW_MEMBER_DATA_DESCRIPTION =
  '10GB of Complimentary New membership Free Data';

export const COMPLIMENTARY_NEW_MEMBER_DATA_GB = 10;
export const COMPLIMENTARY_NEW_MEMBER_DATA_MB = COMPLIMENTARY_NEW_MEMBER_DATA_GB * 1024;

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pickColumn(existingColumns, candidates) {
  for (const candidate of candidates) {
    if (existingColumns.has(candidate)) return candidate;
  }
  return null;
}

function sqlIdent(columnName) {
  const raw = String(columnName || '').trim();
  if (!raw) return raw;
  if (/^[a-z][a-z0-9_]*$/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

async function getTableColumns(client, tableName) {
  const schema = getDBSchema();
  const colRes = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = $2`,
    [schema, tableName]
  );
  return new Set((colRes.rows || []).map((r) => String(r.column_name || '').trim()).filter(Boolean));
}

function randomIntInclusive(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function makePaymentTransactionIdBigInt(paymentId) {
  const id = Math.trunc(toFiniteNumber(paymentId, 0));
  if (!Number.isFinite(id) || id < 1) return null;
  const prefix = String(randomIntInclusive(1, 99)).padStart(2, '0');
  const suffix = String(id % 1_000_000).padStart(6, '0');
  const combined = `${prefix}${suffix}`;
  const n = Number(combined);
  return Number.isFinite(n) ? n : null;
}

async function ensurePaymentTransactionId(client, paymentColumns, paymentId) {
  const paymentIdColumn = pickColumn(paymentColumns, ['payment_id']);
  const transactionIdColumn = pickColumn(paymentColumns, ['transactionId', 'transaction_id']);
  if (!paymentIdColumn || !transactionIdColumn) return null;
  const pid = Math.trunc(toFiniteNumber(paymentId, 0));
  if (!Number.isFinite(pid) || pid < 1) return null;

  const paymentIdSql = sqlIdent(paymentIdColumn);
  const transactionIdSql = sqlIdent(transactionIdColumn);

  const existing = await client.query(
    `SELECT ${transactionIdSql} AS transaction_id
     FROM helloworldjunktest.payment
     WHERE ${paymentIdSql} = $1
     LIMIT 1`,
    [pid]
  );
  const current = existing.rows[0]?.transaction_id;
  if (current != null && String(current).trim() !== '') {
    const n = Number(current);
    return Number.isFinite(n) ? n : current;
  }

  const generated = makePaymentTransactionIdBigInt(pid);
  if (generated == null) return null;
  await client.query(
    `UPDATE helloworldjunktest.payment
     SET ${transactionIdSql} = $1
     WHERE ${paymentIdSql} = $2`,
    [generated, pid]
  );
  return generated;
}

/**
 * Credit complimentary TutaPhotoAlbums Tx/Rx data for a brand-new member and write a $0
 * Balance History row. Intended to run inside the signup Primary transaction.
 */
export async function grantComplimentaryNewMemberVaultData(client, singlesId) {
  const id = Math.trunc(Number(singlesId));
  if (!Number.isFinite(id) || id < 1) {
    throw new Error('singles_id required for complimentary vault data');
  }

  const courtesyMb = Math.max(COMPLIMENTARY_NEW_MEMBER_DATA_MB, VAULT_REFILL_BLOCK_MB);
  const singlesColumns = await getTableColumns(client, 'singles');
  const paymentColumns = await getTableColumns(client, 'payment');
  const descriptionColumn = pickColumn(paymentColumns, [
    'transaction_description',
    'transaction_descripition',
    'payment_history',
    'description'
  ]);
  if (!descriptionColumn) {
    throw new Error('payment description column missing for complimentary vault data');
  }

  const descriptionSql = sqlIdent(descriptionColumn);
  const already = await client.query(
    `SELECT payment_id
     FROM helloworldjunktest.payment
     WHERE singles_id = $1
       AND COALESCE(${descriptionSql}, '') = $2
     LIMIT 1`,
    [id, COMPLIMENTARY_NEW_MEMBER_DATA_DESCRIPTION]
  );
  if (already.rows.length) {
    return { paymentId: Number(already.rows[0].payment_id), courtesyMb, alreadyGranted: true };
  }

  // Remain = courtesy credit minus lifetime usage (may be negative if already over quota).
  // Lifetime bought starts at the courtesy block (purchases add via add_vault_refill_mb).
  if (singlesColumns.has('refill_remain_mb')) {
    const setBought = singlesColumns.has('refill_bought_mb')
      ? ', refill_bought_mb = $1'
      : '';
    await client.query(
      `UPDATE helloworldjunktest.singles
       SET refill_remain_mb = $1 - COALESCE(photoalbums_total_transfer_mb, 0)${setBought}
       WHERE singles_id = $2`,
      [courtesyMb, id]
    );
  }

  const now = new Date();
  const insertColumns = [];
  const insertValues = [];
  const placeholders = [];
  const pushIfExists = (column, value) => {
    if (!paymentColumns.has(column) || insertColumns.includes(column)) return;
    insertColumns.push(column);
    insertValues.push(value);
    placeholders.push(`$${insertValues.length}`);
  };

  pushIfExists('singles_id', id);
  pushIfExists(descriptionColumn, COMPLIMENTARY_NEW_MEMBER_DATA_DESCRIPTION);
  // Mirror onto payment_history when it is a separate column from transaction_description.
  if (descriptionColumn !== 'payment_history') {
    pushIfExists('payment_history', COMPLIMENTARY_NEW_MEMBER_DATA_DESCRIPTION);
  }
  pushIfExists('account_balance_token', 0);
  pushIfExists('paid_total_dollar', 0);
  pushIfExists('paid_total_token', 0);
  pushIfExists('token_add_or_debit', 0);
  pushIfExists('transaction_date_time', now);
  pushIfExists('last_paid_date', now);
  if (paymentColumns.has('created_at')) {
    insertColumns.push('created_at');
    placeholders.push('CURRENT_TIMESTAMP');
  }
  if (paymentColumns.has('updated_at')) {
    insertColumns.push('updated_at');
    placeholders.push('CURRENT_TIMESTAMP');
  }

  if (!insertColumns.length) {
    throw new Error('payment table has no writable columns');
  }

  const inserted = await client.query(
    `INSERT INTO helloworldjunktest.payment (${insertColumns.join(', ')})
     VALUES (${placeholders.join(', ')})
     RETURNING payment_id`,
    insertValues
  );
  const paymentId = Number(inserted.rows[0]?.payment_id);
  await ensurePaymentTransactionId(client, paymentColumns, paymentId);

  if (Number.isFinite(paymentId) && paymentId > 0 && singlesColumns.has('payment_id_fk')) {
    const updates = ['payment_id_fk = $1'];
    if (singlesColumns.has('updated_at')) updates.push('updated_at = CURRENT_TIMESTAMP');
    await client.query(
      `UPDATE helloworldjunktest.singles
       SET ${updates.join(', ')}
       WHERE singles_id = $2`,
      [paymentId, id]
    );
  }

  return { paymentId, courtesyMb, alreadyGranted: false };
}
