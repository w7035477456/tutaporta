#!/usr/bin/env node
/**
 * One-time: encrypt existing plaintext Bills/Receipts files (notes/bill_receipts/{id}/x.png)
 * into `x.png.enc` and point paid_record_attachment.relative_path / stored_file_name at them.
 * New uploads are already sealed by be/utils/paidRecordStorage.js.
 *
 * Per file: read plaintext → (checksum must match when the row has one) → seal → verify the
 * sealed bytes open back to the plaintext → write `.enc` → UPDATE row → delete plaintext.
 * If the UPDATE fails the new `.enc` is removed and the plaintext is left as it was.
 *
 * Usage (repo root):
 *   node be/scripts/sealBillReceipts.mjs            # dry run (default)
 *   node be/scripts/sealBillReceipts.mjs --apply    # write
 *   node be/scripts/sealBillReceipts.mjs --apply --singles 66
 *
 * Never prints secrets; the key is derived in-process from TEMPKEY_TUTADRIVE.
 */
import '../loadEnv.js';
import fs from 'fs';
import crypto from 'crypto';
import pool from '../db/connection.js';
import {
  BILL_RECEIPT_SEALED_SUFFIX,
  atomicWriteReceiptFile,
  isSealedBillReceiptPath,
  openBillReceiptBuffer,
  resolvePaidRecordAttachmentAbsPath,
  sealBillReceiptBuffer
} from '../utils/paidRecordStorage.js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const singlesArgIdx = args.indexOf('--singles');
const onlySingles = singlesArgIdx >= 0 ? Number(args[singlesArgIdx + 1]) : null;

const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const T = 'outdateddbsnapshotoct2024.paid_record_attachment';

async function main() {
  const params = [];
  let where = `relative_path NOT LIKE '%${BILL_RECEIPT_SEALED_SUFFIX}'`;
  if (Number.isFinite(onlySingles) && onlySingles > 0) {
    params.push(onlySingles);
    where += ` AND singles_id = $1`;
  }
  const { rows } = await pool.query(
    `SELECT paid_record_attachment_id AS id, singles_id, relative_path, stored_file_name, checksum
       FROM ${T} WHERE ${where} ORDER BY paid_record_attachment_id`,
    params
  );
  console.log(`[seal-receipts] mode=${apply ? 'APPLY' : 'DRY-RUN'} plaintext rows=${rows.length}`);

  const counts = { sealed: 0, wouldSeal: 0, missing: 0, checksumMismatch: 0, failed: 0 };
  for (const row of rows) {
    const label = `id=${row.id} singles=${row.singles_id} ${row.relative_path}`;
    let absPath;
    try {
      absPath = await resolvePaidRecordAttachmentAbsPath(row.singles_id, row.relative_path);
    } catch (err) {
      console.warn(`[failed] ${label} — ${err?.message || err}`);
      counts.failed += 1;
      continue;
    }
    if (isSealedBillReceiptPath(absPath)) continue;
    if (!fs.existsSync(absPath)) {
      console.warn(`[missing] ${label}`);
      counts.missing += 1;
      continue;
    }
    const plain = fs.readFileSync(absPath);
    if (row.checksum && sha256(plain) !== String(row.checksum).toLowerCase()) {
      console.warn(`[checksum-mismatch] ${label} — left untouched`);
      counts.checksumMismatch += 1;
      continue;
    }
    const sealed = sealBillReceiptBuffer(plain);
    if (!openBillReceiptBuffer(sealed).equals(plain)) {
      console.warn(`[failed] ${label} — seal round-trip mismatch`);
      counts.failed += 1;
      continue;
    }
    if (!apply) {
      counts.wouldSeal += 1;
      continue;
    }
    const dest = `${absPath}${BILL_RECEIPT_SEALED_SUFFIX}`;
    try {
      atomicWriteReceiptFile(dest, sealed);
      await pool.query(
        `UPDATE ${T}
            SET relative_path = relative_path || $2, stored_file_name = stored_file_name || $2
          WHERE paid_record_attachment_id = $1 AND relative_path = $3`,
        [row.id, BILL_RECEIPT_SEALED_SUFFIX, row.relative_path]
      );
    } catch (err) {
      try {
        fs.unlinkSync(dest);
      } catch {
        // nothing written
      }
      console.warn(`[failed] ${label} — ${err?.message || err}`);
      counts.failed += 1;
      continue;
    }
    fs.unlinkSync(absPath);
    counts.sealed += 1;
  }

  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(counts, null, 2));
  if (!apply && counts.wouldSeal) console.log('\nRe-run with --apply to encrypt them.');
}

main()
  .catch((err) => {
    console.error('[seal-receipts] fatal:', err?.message || err);
    process.exitCode = 1;
  })
  // loadEnv starts a 10s config-refresh timer that would keep node alive.
  .finally(() => pool.end().finally(() => process.exit(process.exitCode ?? 0)));
