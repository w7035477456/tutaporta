/**
 * Bill Schedule (Monthly / Yearly / Subscription) inside the TutaNotes Cloud backup zip.
 * Bill rows and Bills/Receipts records live in Postgres and their files under
 * notes/bill_receipts/ — both outside the TutaNotes vault folder — so the zip
 * carries them separately:
 *   bill_schedule.json          rows + paid_record notes + attachment metadata
 *   bill_receipts/{id}/{file}   receipt files (same relative_path as in Postgres)
 * Only the Cloud side (storage_backend 'tutaCloud') is backed up / restored.
 */
import fs from 'fs';
import path from 'path';
import pool, { getDBSchema } from '../db/connection.js';
import { loadTableColumns } from '../routes/singles/checkrBioReviewDb.js';
import { billReceiptRelativePath, billReceiptsDirAbs } from './paidRecordStorage.js';
import { normalizeBillIcon } from './billIconName.js';
import {
  legacyBillScheduleTabsWouldCollapse,
  normalizeBackupTabLabel
} from './billScheduleBackupTabs.js';

export { legacyBillScheduleTabsWouldCollapse, normalizeBackupTabLabel } from './billScheduleBackupTabs.js';

export const BILL_SCHEDULE_BACKUP_FILE = 'bill_schedule.json';
/** v2 = monthly/yearly rows include tab_label + soft_delete (required for Medford/Rockfield/… tabs). */
const BILL_SCHEDULE_BACKUP_VERSION = 2;
const CLOUD_BACKEND = 'tutaCloud';
const BILL_RECEIPTS_PREFIX = 'bill_receipts/';

function safeReceiptRelativePath(raw) {
  const rel = String(raw || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  if (!rel.startsWith(BILL_RECEIPTS_PREFIX) || rel.split('/').includes('..')) return null;
  return rel;
}

/** Prefer zip-root bill_schedule.json; also check next to the vault folder. */
export function findBillScheduleBackupFile(extractDir, vaultRoot = null) {
  const candidates = [
    path.join(extractDir, BILL_SCHEDULE_BACKUP_FILE),
    vaultRoot ? path.join(path.dirname(vaultRoot), BILL_SCHEDULE_BACKUP_FILE) : null,
    vaultRoot ? path.join(vaultRoot, BILL_SCHEDULE_BACKUP_FILE) : null
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    } catch {
      // try next
    }
  }
  return null;
}

async function attachmentHasChecksumColumn() {
  const cols = await loadTableColumns(getDBSchema(), 'paid_record_attachment');
  return cols.has('checksum');
}

/**
 * Collect the member's Cloud bill schedule for the backup zip.
 * @returns {Promise<{ json: string, files: { absPath: string, zipPath: string }[], rowCount: number }>}
 */
export async function exportBillScheduleForBackup(singlesId, notesMount) {
  const { rows: monthly } = await pool.query(
    `SELECT tab_label, soft_delete, bill_year, bill_month, row_index, bill_description, due_day, amount,
            bill_type, action, paid_record_id, bill_icon, email_scan_pending
       FROM outdateddbsnapshotoct2024.monthly_bill
      WHERE singles_id = $1 AND storage_backend = $2
      ORDER BY tab_label, bill_year, bill_month, row_index`,
    [singlesId, CLOUD_BACKEND]
  );
  const { rows: yearly } = await pool.query(
    `SELECT tab_label, soft_delete, bill_year, bill_month, row_index, bill_description, due_month_day, due_year, amount,
            bill_type, bill_period, bill_source, action, paid_record_id, bill_icon, email_scan_pending
       FROM outdateddbsnapshotoct2024.yearly_bill
      WHERE singles_id = $1 AND storage_backend = $2
      ORDER BY tab_label, bill_year, row_index`,
    [singlesId, CLOUD_BACKEND]
  );
  const { rows: subscription } = await pool.query(
    `SELECT bill_year, bill_month, row_index, bill_description, due_day, amount,
            bill_type, action, paid_record_id, bill_icon
       FROM outdateddbsnapshotoct2024.subscription_bill
      WHERE singles_id = $1 AND storage_backend = $2
      ORDER BY bill_year, bill_month, row_index`,
    [singlesId, CLOUD_BACKEND]
  );

  const paidIds = [
    ...new Set(
      [...monthly, ...yearly, ...subscription]
        .map((r) => Number(r.paid_record_id))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  ];

  const paidRecords = [];
  const files = [];
  if (paidIds.length) {
    const { rows: records } = await pool.query(
      `SELECT paid_record_id, schedule_kind, notes_text, created_at, updated_at
         FROM outdateddbsnapshotoct2024.paid_record
        WHERE singles_id = $1 AND paid_record_id = ANY($2::bigint[])
        ORDER BY paid_record_id`,
      [singlesId, paidIds]
    );
    const { rows: attachments } = await pool.query(
      `SELECT *
         FROM outdateddbsnapshotoct2024.paid_record_attachment
        WHERE singles_id = $1 AND paid_record_id = ANY($2::bigint[])
        ORDER BY paid_record_id, created_at, paid_record_attachment_id`,
      [singlesId, paidIds]
    );
    const byRecord = new Map();
    for (const att of attachments) {
      const rel = safeReceiptRelativePath(att.relative_path);
      if (!rel) continue;
      const absPath = path.resolve(notesMount, rel);
      if (!fs.existsSync(absPath)) continue;
      files.push({ absPath, zipPath: rel });
      const list = byRecord.get(Number(att.paid_record_id)) || [];
      list.push({
        original_file_name: att.original_file_name,
        stored_file_name: att.stored_file_name,
        mime_type: att.mime_type,
        byte_size: Number(att.byte_size) || 0,
        checksum: att.checksum ?? null,
        relative_path: rel,
        created_at: att.created_at
      });
      byRecord.set(Number(att.paid_record_id), list);
    }
    for (const rec of records) {
      paidRecords.push({
        paid_record_id: Number(rec.paid_record_id),
        schedule_kind: rec.schedule_kind,
        notes_text: rec.notes_text ?? '',
        created_at: rec.created_at,
        updated_at: rec.updated_at,
        attachments: byRecord.get(Number(rec.paid_record_id)) || []
      });
    }
  }

  const payload = {
    version: BILL_SCHEDULE_BACKUP_VERSION,
    storage_backend: CLOUD_BACKEND,
    exported_at: new Date().toISOString(),
    monthly,
    yearly,
    subscription,
    paid_records: paidRecords
  };
  return {
    json: `${JSON.stringify(payload, null, 2)}\n`,
    files,
    rowCount: monthly.length + yearly.length + subscription.length
  };
}

function toIntOrNull(value) {
  if (value == null || value === '') return null;
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? n : null;
}

function normalizeBillType(raw) {
  const s = String(raw ?? '').trim();
  if (/^auto$/i.test(s)) return 'Auto';
  if (/^paid\s*off$/i.test(s)) return 'Paid Off';
  return 'Manual';
}

function normalizeAction(billType, raw) {
  if (billType === 'Auto' || billType === 'Paid Off') return null;
  const s = String(raw ?? '').trim();
  if (/^paid$/i.test(s)) return 'Paid';
  if (/^not\s*paid$/i.test(s)) return 'Not Paid';
  return null;
}

/**
 * Replace the member's Cloud bill schedule with the one inside an extracted backup.
 * No-op (returns null) for backups made before bills were included.
 */
export async function restoreBillScheduleFromBackup(singlesId, extractDir, notesMount) {
  const jsonPath = findBillScheduleBackupFile(extractDir);
  if (!jsonPath) return null;

  const payload = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const monthly = Array.isArray(payload?.monthly) ? payload.monthly : [];
  const yearly = Array.isArray(payload?.yearly) ? payload.yearly : [];
  const subscription = Array.isArray(payload?.subscription) ? payload.subscription : [];
  const paidRecords = Array.isArray(payload?.paid_records) ? payload.paid_records : [];

  // Backups made before tab_label was zipped would collapse Medford/Rockfield/… into home1
  // and hit the unique (tab, year, month, row) key — fail loudly instead of half-restoring.
  if (legacyBillScheduleTabsWouldCollapse(monthly, yearly)) {
    throw new Error(
      'This backup was made before Bill Schedule tabs were included. Make a new Backup/Restore zip from the current app so Medford / Rockfield / Auto tabs are preserved.'
    );
  }

  const hasChecksum = await attachmentHasChecksumColumn();

  const createdReceiptDirs = [];
  const staleReceiptDirs = [];
  let restoredPaidRecords = 0;
  let restoredAttachments = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Bills/Receipts records only the Cloud rows point at (USB copies may share them).
    const { rows: stale } = await client.query(
      `SELECT pr.paid_record_id
         FROM outdateddbsnapshotoct2024.paid_record pr
        WHERE pr.singles_id = $1
          AND pr.paid_record_id IN (
            SELECT paid_record_id FROM outdateddbsnapshotoct2024.monthly_bill
             WHERE singles_id = $1 AND storage_backend = $2 AND paid_record_id IS NOT NULL
            UNION
            SELECT paid_record_id FROM outdateddbsnapshotoct2024.yearly_bill
             WHERE singles_id = $1 AND storage_backend = $2 AND paid_record_id IS NOT NULL
            UNION
            SELECT paid_record_id FROM outdateddbsnapshotoct2024.subscription_bill
             WHERE singles_id = $1 AND storage_backend = $2 AND paid_record_id IS NOT NULL
          )
          AND pr.paid_record_id NOT IN (
            SELECT paid_record_id FROM outdateddbsnapshotoct2024.monthly_bill
             WHERE singles_id = $1 AND storage_backend <> $2 AND paid_record_id IS NOT NULL
            UNION
            SELECT paid_record_id FROM outdateddbsnapshotoct2024.yearly_bill
             WHERE singles_id = $1 AND storage_backend <> $2 AND paid_record_id IS NOT NULL
            UNION
            SELECT paid_record_id FROM outdateddbsnapshotoct2024.subscription_bill
             WHERE singles_id = $1 AND storage_backend <> $2 AND paid_record_id IS NOT NULL
          )`,
      [singlesId, CLOUD_BACKEND]
    );
    const staleIds = stale.map((r) => Number(r.paid_record_id));

    await client.query(
      `DELETE FROM outdateddbsnapshotoct2024.monthly_bill WHERE singles_id = $1 AND storage_backend = $2`,
      [singlesId, CLOUD_BACKEND]
    );
    await client.query(
      `DELETE FROM outdateddbsnapshotoct2024.yearly_bill WHERE singles_id = $1 AND storage_backend = $2`,
      [singlesId, CLOUD_BACKEND]
    );
    await client.query(
      `DELETE FROM outdateddbsnapshotoct2024.subscription_bill WHERE singles_id = $1 AND storage_backend = $2`,
      [singlesId, CLOUD_BACKEND]
    );
    if (staleIds.length) {
      await client.query(
        `DELETE FROM outdateddbsnapshotoct2024.paid_record
          WHERE singles_id = $1 AND paid_record_id = ANY($2::bigint[])`,
        [singlesId, staleIds]
      );
      for (const id of staleIds) staleReceiptDirs.push(billReceiptsDirAbs(notesMount, id));
    }

    const kindByOldId = new Map();
    const newIdByOldId = new Map();
    for (const rec of paidRecords) {
      const oldId = toIntOrNull(rec?.paid_record_id);
      const kindRaw = String(rec?.schedule_kind || '').toLowerCase();
      const kind =
        kindRaw === 'yearly' ? 'yearly' : kindRaw === 'subscription' ? 'subscription' : 'monthly';
      if (!oldId) continue;
      const { rows: created } = await client.query(
        `INSERT INTO outdateddbsnapshotoct2024.paid_record (
           singles_id, schedule_kind, monthly_bill_id, yearly_bill_id, subscription_bill_id, storage_backend,
           notes_text, created_at, updated_at
         ) VALUES ($1, $2, NULL, NULL, NULL, $3, $4, COALESCE($5::timestamptz, now()), COALESCE($6::timestamptz, now()))
         RETURNING paid_record_id`,
        [singlesId, kind, CLOUD_BACKEND, String(rec?.notes_text ?? ''), rec?.created_at ?? null, rec?.updated_at ?? null]
      );
      const newId = Number(created[0].paid_record_id);
      newIdByOldId.set(oldId, newId);
      kindByOldId.set(oldId, kind);
      restoredPaidRecords += 1;

      const attachments = Array.isArray(rec?.attachments) ? rec.attachments : [];
      for (const att of attachments) {
        const rel = safeReceiptRelativePath(att?.relative_path);
        if (!rel) continue;
        const src = path.resolve(extractDir, rel);
        if (!src.startsWith(path.resolve(extractDir) + path.sep) || !fs.existsSync(src)) continue;
        const storedFileName = path.basename(String(att?.stored_file_name || rel));
        const destDir = billReceiptsDirAbs(notesMount, newId);
        if (!createdReceiptDirs.includes(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
          createdReceiptDirs.push(destDir);
        }
        fs.copyFileSync(src, path.join(destDir, storedFileName));
        const newRel = billReceiptRelativePath(newId, storedFileName);
        const columns = [
          'paid_record_id',
          'singles_id',
          'original_file_name',
          'stored_file_name',
          'mime_type',
          'byte_size',
          'relative_path',
          'created_at'
        ];
        const values = [
          newId,
          singlesId,
          String(att?.original_file_name || storedFileName).slice(0, 255),
          storedFileName,
          String(att?.mime_type || 'application/octet-stream'),
          Math.max(0, Number(att?.byte_size) || fs.statSync(src).size),
          newRel,
          att?.created_at ?? new Date().toISOString()
        ];
        if (hasChecksum) {
          columns.push('checksum');
          values.push(att?.checksum ?? null);
        }
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        await client.query(
          `INSERT INTO outdateddbsnapshotoct2024.paid_record_attachment (${columns.join(', ')})
           VALUES (${placeholders})`,
          values
        );
        restoredAttachments += 1;
      }
    }

    const linkPaidRecord = async (oldPaidId, kind, billId) => {
      const newPaidId = newIdByOldId.get(oldPaidId);
      if (!newPaidId || kindByOldId.get(oldPaidId) !== kind) return null;
      const column =
        kind === 'monthly'
          ? 'monthly_bill_id'
          : kind === 'yearly'
            ? 'yearly_bill_id'
            : 'subscription_bill_id';
      await client.query(
        `UPDATE outdateddbsnapshotoct2024.paid_record
            SET ${column} = $1
          WHERE paid_record_id = $2 AND singles_id = $3 AND ${column} IS NULL`,
        [billId, newPaidId, singlesId]
      );
      return newPaidId;
    };

    for (const r of monthly) {
      const billType = normalizeBillType(r?.bill_type);
      const oldPaidId = toIntOrNull(r?.paid_record_id);
      const { rows: inserted } = await client.query(
        `INSERT INTO outdateddbsnapshotoct2024.monthly_bill (
           singles_id, storage_backend, tab_label, soft_delete, bill_year, bill_month, row_index,
           bill_description, due_day, amount, bill_type, action, paid_record_id, bill_icon,
           email_scan_pending
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING monthly_bill_id`,
        [
          singlesId,
          CLOUD_BACKEND,
          normalizeBackupTabLabel(r?.tab_label),
          r?.soft_delete === true,
          toIntOrNull(r?.bill_year),
          toIntOrNull(r?.bill_month),
          toIntOrNull(r?.row_index),
          String(r?.bill_description ?? '').slice(0, 500),
          toIntOrNull(r?.due_day),
          String(r?.amount ?? ''),
          billType,
          normalizeAction(billType, r?.action),
          oldPaidId ? newIdByOldId.get(oldPaidId) ?? null : null,
          normalizeBillIcon(r?.bill_icon),
          r?.email_scan_pending === true
        ]
      );
      if (oldPaidId) await linkPaidRecord(oldPaidId, 'monthly', Number(inserted[0].monthly_bill_id));
    }

    for (const r of yearly) {
      const billType = r?.bill_type === 'Auto' ? 'Auto' : 'Manual';
      const oldPaidId = toIntOrNull(r?.paid_record_id);
      const billPeriodRaw = String(r?.bill_period ?? '').trim();
      const billPeriod = ['Monthly', 'Yearly', 'BiYearly', 'Quarterly', '2Year'].includes(billPeriodRaw)
        ? billPeriodRaw
        : null;
      const billSourceRaw = String(r?.bill_source ?? '').trim();
      const billSource = ['Visa', 'Check', 'Other'].includes(billSourceRaw) ? billSourceRaw : null;
      const { rows: inserted } = await client.query(
        `INSERT INTO outdateddbsnapshotoct2024.yearly_bill (
           singles_id, storage_backend, tab_label, soft_delete, bill_year, bill_month, row_index,
           bill_description, due_month_day, due_year, amount, bill_type, bill_period, bill_source,
           action, paid_record_id, bill_icon, email_scan_pending
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         RETURNING yearly_bill_id`,
        [
          singlesId,
          CLOUD_BACKEND,
          normalizeBackupTabLabel(r?.tab_label),
          r?.soft_delete === true,
          toIntOrNull(r?.bill_year),
          toIntOrNull(r?.bill_month),
          toIntOrNull(r?.row_index),
          String(r?.bill_description ?? '').slice(0, 500),
          toIntOrNull(r?.due_month_day),
          billPeriod === '2Year' ? toIntOrNull(r?.due_year) : null,
          String(r?.amount ?? ''),
          billType,
          billPeriod,
          billSource,
          normalizeAction(billType, r?.action),
          oldPaidId ? newIdByOldId.get(oldPaidId) ?? null : null,
          normalizeBillIcon(r?.bill_icon),
          r?.email_scan_pending === true
        ]
      );
      if (oldPaidId) await linkPaidRecord(oldPaidId, 'yearly', Number(inserted[0].yearly_bill_id));
    }

    for (const r of subscription) {
      const billType = normalizeBillType(r?.bill_type);
      const oldPaidId = toIntOrNull(r?.paid_record_id);
      const { rows: inserted } = await client.query(
        `INSERT INTO outdateddbsnapshotoct2024.subscription_bill (
           singles_id, storage_backend, bill_year, bill_month, row_index,
           bill_description, due_day, amount, bill_type, action, paid_record_id, bill_icon
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING subscription_bill_id`,
        [
          singlesId,
          CLOUD_BACKEND,
          toIntOrNull(r?.bill_year),
          toIntOrNull(r?.bill_month),
          toIntOrNull(r?.row_index),
          String(r?.bill_description ?? '').slice(0, 500),
          toIntOrNull(r?.due_day),
          String(r?.amount ?? ''),
          billType,
          normalizeAction(billType, r?.action),
          oldPaidId ? newIdByOldId.get(oldPaidId) ?? null : null,
          normalizeBillIcon(r?.bill_icon)
        ]
      );
      if (oldPaidId) await linkPaidRecord(oldPaidId, 'subscription', Number(inserted[0].subscription_bill_id));
    }

    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    for (const dir of createdReceiptDirs) fs.rmSync(dir, { recursive: true, force: true });
    throw err;
  } finally {
    client.release();
  }

  for (const dir of staleReceiptDirs) fs.rmSync(dir, { recursive: true, force: true });

  return {
    monthlyRows: monthly.length,
    yearlyRows: yearly.length,
    subscriptionRows: subscription.length,
    paidRecords: restoredPaidRecords,
    attachments: restoredAttachments
  };
}
