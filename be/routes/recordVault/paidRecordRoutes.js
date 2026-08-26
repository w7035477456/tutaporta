import Busboy from 'busboy';
import crypto from 'crypto';
import pool from '../../db/connection.js';
import { readBillStorageBackend, parseBillStorageBackend } from '../../utils/billScheduleStorageBackend.js';
import {
  writePaidRecordAttachmentFile,
  readPaidRecordAttachmentFile,
  deletePaidRecordAttachmentFile
} from '../../utils/paidRecordStorage.js';

export const SKIP_DUPLICATE_UPLOAD_MESSAGE = 'Skipping upload duplicate file';

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function sendError(res, error, fallback = 'Paid record request failed') {
  const statusCode = Number(error?.statusCode) || 500;
  const pgCode = String(error?.code || '');
  let message = error?.message || fallback;
  if (pgCode === '42P01') {
    message =
      'Database table paid_record is missing. On Postgres run: be/db/createPaidRecord.sql';
  } else if (pgCode === '42703') {
    message =
      'Database schema for paid_record is outdated. On Postgres run: be/db/createPaidRecord.sql';
  }
  if (statusCode >= 500) {
    console.error('[paid-record]', {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      hint: error?.hint
    });
  }
  return res.status(statusCode).json({
    error: message,
    ...(pgCode ? { code: pgCode } : {})
  });
}

function requireSinglesId(req) {
  const singlesId = toInt(req.auth?.singles_id);
  if (!singlesId || singlesId < 1) throw httpError(401, 'Authentication required');
  return singlesId;
}

function mapAttachment(row) {
  return {
    paid_record_attachment_id: Number(row.paid_record_attachment_id),
    paid_record_id: Number(row.paid_record_id),
    original_file_name: row.original_file_name || '',
    stored_file_name: row.stored_file_name || '',
    mime_type: row.mime_type || 'application/octet-stream',
    byte_size: Number(row.byte_size) || 0,
    checksum: row.checksum ? String(row.checksum).toLowerCase() : null,
    relative_path: row.relative_path || '',
    created_at: row.created_at
  };
}

function hasBillContentFromParts(notesText, attachmentCount) {
  const notes = String(notesText ?? '').trim();
  return notes.length > 0 || (Number(attachmentCount) || 0) > 0;
}

async function loadPaidRecordOwned(client, paidRecordId, singlesId) {
  const { rows } = await client.query(
    `SELECT *
       FROM helloworldjunktest.paid_record
      WHERE paid_record_id = $1 AND singles_id = $2
      LIMIT 1`,
    [paidRecordId, singlesId]
  );
  return rows[0] || null;
}

async function listAttachments(client, paidRecordId) {
  const { rows } = await client.query(
    `SELECT *
       FROM helloworldjunktest.paid_record_attachment
      WHERE paid_record_id = $1
      ORDER BY created_at ASC, paid_record_attachment_id ASC`,
    [paidRecordId]
  );
  return rows.map(mapAttachment);
}

async function countAttachments(client, paidRecordId) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS c
       FROM helloworldjunktest.paid_record_attachment
      WHERE paid_record_id = $1`,
    [paidRecordId]
  );
  return Number(rows[0]?.c) || 0;
}

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Duplicate check for one paid_record: size first, then SHA-256 checksum.
 * Backfills checksum on size-matched rows that are missing it (read from disk once).
 * @returns {object|null} existing attachment row mapped, or null if not a duplicate
 */
async function findDuplicatePaidRecordAttachment(singlesId, paidRecordId, buffer) {
  const byteSize = Buffer.isBuffer(buffer) ? buffer.length : 0;
  if (!byteSize) return null;
  const checksum = sha256Hex(buffer);

  const { rows } = await pool.query(
    `SELECT *
       FROM helloworldjunktest.paid_record_attachment
      WHERE paid_record_id = $1
        AND byte_size = $2
      ORDER BY created_at ASC, paid_record_attachment_id ASC`,
    [paidRecordId, byteSize]
  );
  if (!rows.length) return null;

  for (const row of rows) {
    let rowChecksum = row.checksum ? String(row.checksum).toLowerCase() : '';
    if (!rowChecksum) {
      try {
        const { buffer: existingBuf } = await readPaidRecordAttachmentFile(
          singlesId,
          row.relative_path
        );
        rowChecksum = sha256Hex(existingBuf);
        await pool.query(
          `UPDATE helloworldjunktest.paid_record_attachment
              SET checksum = $1
            WHERE paid_record_attachment_id = $2`,
          [rowChecksum, row.paid_record_attachment_id]
        );
      } catch {
        continue;
      }
    }
    if (rowChecksum === checksum) {
      return mapAttachment({ ...row, checksum: rowChecksum });
    }
  }
  return null;
}

/**
 * Write file + insert row, or skip when size+checksum already exist for this paid_record.
 * @returns {{ skipped: boolean, attachment, attachments, has_bill_content, message? }}
 */
async function savePaidRecordAttachmentOrSkipDuplicate(
  singlesId,
  paidRecordId,
  { buffer, originalFileName, mimeType }
) {
  const duplicate = await findDuplicatePaidRecordAttachment(singlesId, paidRecordId, buffer);
  if (duplicate) {
    const attachments = await listAttachments(pool, paidRecordId);
    return {
      skipped: true,
      message: SKIP_DUPLICATE_UPLOAD_MESSAGE,
      attachment: duplicate,
      attachments,
      has_bill_content: true
    };
  }

  const checksum = sha256Hex(buffer);
  const written = await writePaidRecordAttachmentFile(singlesId, paidRecordId, {
    buffer,
    originalFileName
  });

  let rows;
  try {
    ({ rows } = await pool.query(
      `INSERT INTO helloworldjunktest.paid_record_attachment (
         paid_record_id, singles_id, original_file_name, stored_file_name,
         mime_type, byte_size, checksum, relative_path
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        paidRecordId,
        singlesId,
        String(originalFileName || '').slice(0, 255),
        written.storedFileName,
        String(mimeType || 'application/octet-stream').slice(0, 120),
        written.byteSize,
        checksum,
        written.relativePath
      ]
    ));
  } catch (err) {
    // Schema without checksum column yet — insert without it, still dedupe via size+disk.
    if (String(err?.code) === '42703') {
      ({ rows } = await pool.query(
        `INSERT INTO helloworldjunktest.paid_record_attachment (
           paid_record_id, singles_id, original_file_name, stored_file_name,
           mime_type, byte_size, relative_path
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [
          paidRecordId,
          singlesId,
          String(originalFileName || '').slice(0, 255),
          written.storedFileName,
          String(mimeType || 'application/octet-stream').slice(0, 120),
          written.byteSize,
          written.relativePath
        ]
      ));
    } else {
      throw err;
    }
  }

  await pool.query(
    `UPDATE helloworldjunktest.paid_record SET updated_at = now() WHERE paid_record_id = $1`,
    [paidRecordId]
  );
  const attachments = await listAttachments(pool, paidRecordId);
  return {
    skipped: false,
    attachment: mapAttachment(rows[0]),
    attachments,
    has_bill_content: true
  };
}

function parseMultipartFile(req, fieldNames = ['file', 'attachment', 'photo']) {
  return new Promise((resolve, reject) => {
    const ct = String(req.headers['content-type'] || '');
    if (!ct.includes('multipart/form-data')) {
      reject(httpError(400, 'Expected multipart/form-data upload'));
      return;
    }
    const wanted = new Set(fieldNames.map((f) => String(f).toLowerCase()));
    const busboy = Busboy({ headers: req.headers, limits: { files: 1, fileSize: 40 * 1024 * 1024 } });
    let fileBuffer = null;
    let fileName = '';
    let mimeType = 'application/octet-stream';
    let sawFile = false;

    busboy.on('file', (fieldname, stream, info) => {
      const name = String(fieldname || '').toLowerCase();
      if (!wanted.has(name) && sawFile) {
        stream.resume();
        return;
      }
      if (!wanted.has(name) && wanted.size > 0 && !wanted.has('*')) {
        // Accept first file if field name unexpected
      }
      sawFile = true;
      fileName = info?.filename || 'file';
      mimeType = info?.mimeType || info?.mime || 'application/octet-stream';
      const chunks = [];
      stream.on('data', (d) => chunks.push(d));
      stream.on('limit', () => {
        reject(httpError(413, 'File too large (max 40MB)'));
      });
      stream.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });
    busboy.on('error', reject);
    busboy.on('finish', () => {
      if (!fileBuffer || !fileBuffer.length) {
        reject(httpError(400, 'Missing file'));
        return;
      }
      resolve({ buffer: fileBuffer, originalFileName: fileName, mimeType });
    });
    req.pipe(busboy);
  });
}

/**
 * Ensure a monthly_bill / yearly_bill row exists, then ensure paid_record linked.
 * Body: { kind, storageType, monthly_bill_id?, yearly_bill_id?, year, month?, row_index,
 *         bill_description?, due_day?, amount?, bill_type?, action? }
 */
export async function postPaidRecordEnsure(req, res) {
  const client = await pool.connect();
  try {
    const singlesId = requireSinglesId(req);
    const body = req.body || {};
    const kind = String(body.kind || body.schedule_kind || '').trim().toLowerCase();
    if (kind !== 'monthly' && kind !== 'yearly') {
      throw httpError(400, 'kind must be monthly or yearly');
    }
    const storageBackend = parseBillStorageBackend(
      body.storageType ?? body.storage_backend ?? readBillStorageBackend(req)
    );
    const year = toInt(body.year ?? body.bill_year);
    const rowIndex = toInt(body.row_index);
    if (!year || year < 2000 || year > 2100) throw httpError(400, 'year must be 2000–2100');
    if (!rowIndex || rowIndex < 1) throw httpError(400, 'row_index must be >= 1');

    await client.query('BEGIN');

    let monthlyBillId = toInt(body.monthly_bill_id);
    let yearlyBillId = toInt(body.yearly_bill_id);
    let paidRecordId = null;

    if (kind === 'monthly') {
      const month = toInt(body.month ?? body.bill_month);
      if (!month || month < 1 || month > 12) throw httpError(400, 'month must be 1–12');

      if (monthlyBillId && monthlyBillId > 0) {
        const { rows } = await client.query(
          `SELECT monthly_bill_id, paid_record_id
             FROM helloworldjunktest.monthly_bill
            WHERE monthly_bill_id = $1 AND singles_id = $2 AND storage_backend = $3
            LIMIT 1`,
          [monthlyBillId, singlesId, storageBackend]
        );
        if (!rows[0]) throw httpError(404, 'monthly_bill row not found');
        monthlyBillId = Number(rows[0].monthly_bill_id);
        paidRecordId = rows[0].paid_record_id != null ? Number(rows[0].paid_record_id) : null;
      } else {
        const { rows: existing } = await client.query(
          `SELECT monthly_bill_id, paid_record_id
             FROM helloworldjunktest.monthly_bill
            WHERE singles_id = $1 AND storage_backend = $2
              AND bill_year = $3 AND bill_month = $4 AND row_index = $5
            LIMIT 1`,
          [singlesId, storageBackend, year, month, rowIndex]
        );
        if (existing[0]) {
          monthlyBillId = Number(existing[0].monthly_bill_id);
          paidRecordId =
            existing[0].paid_record_id != null ? Number(existing[0].paid_record_id) : null;
        } else {
          const desc = String(body.bill_description ?? '').slice(0, 500);
          const dueDay = toInt(body.due_day);
          const amount = String(body.amount ?? '').slice(0, 64);
          const billType = /^auto$/i.test(String(body.bill_type || '')) ? 'Auto' : 'Manual';
          let action = null;
          if (billType === 'Manual') {
            const a = String(body.action ?? '').trim();
            if (/^paid$/i.test(a)) action = 'Paid';
            else if (/^not\s*paid$/i.test(a)) action = 'Not Paid';
          }
          const { rows: inserted } = await client.query(
            `INSERT INTO helloworldjunktest.monthly_bill (
               singles_id, storage_backend, bill_year, bill_month, row_index,
               bill_description, due_day, amount, bill_type, action, paid_record_id
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL)
             RETURNING monthly_bill_id, paid_record_id`,
            [
              singlesId,
              storageBackend,
              year,
              month,
              rowIndex,
              desc,
              dueDay && dueDay >= 1 && dueDay <= 31 ? dueDay : null,
              amount,
              billType,
              action
            ]
          );
          monthlyBillId = Number(inserted[0].monthly_bill_id);
          paidRecordId = null;
        }
      }

      if (paidRecordId && paidRecordId > 0) {
        const pr = await loadPaidRecordOwned(client, paidRecordId, singlesId);
        if (!pr) paidRecordId = null;
      }

      if (!paidRecordId) {
        const { rows: byBill } = await client.query(
          `SELECT paid_record_id
             FROM helloworldjunktest.paid_record
            WHERE singles_id = $1 AND schedule_kind = 'monthly' AND monthly_bill_id = $2
            LIMIT 1`,
          [singlesId, monthlyBillId]
        );
        if (byBill[0]) {
          paidRecordId = Number(byBill[0].paid_record_id);
        } else {
          const { rows: created } = await client.query(
            `INSERT INTO helloworldjunktest.paid_record (
               singles_id, schedule_kind, monthly_bill_id, yearly_bill_id, storage_backend, notes_text
             ) VALUES ($1, 'monthly', $2, NULL, $3, '')
             RETURNING paid_record_id`,
            [singlesId, monthlyBillId, storageBackend]
          );
          paidRecordId = Number(created[0].paid_record_id);
        }
        await client.query(
          `UPDATE helloworldjunktest.monthly_bill
              SET paid_record_id = $1, updated_at = now()
            WHERE monthly_bill_id = $2 AND singles_id = $3`,
          [paidRecordId, monthlyBillId, singlesId]
        );
        await client.query(
          `UPDATE helloworldjunktest.paid_record
              SET monthly_bill_id = $1, updated_at = now()
            WHERE paid_record_id = $2 AND singles_id = $3`,
          [monthlyBillId, paidRecordId, singlesId]
        );
      }
    } else {
      // yearly
      if (yearlyBillId && yearlyBillId > 0) {
        const { rows } = await client.query(
          `SELECT yearly_bill_id, paid_record_id
             FROM helloworldjunktest.yearly_bill
            WHERE yearly_bill_id = $1 AND singles_id = $2 AND storage_backend = $3
            LIMIT 1`,
          [yearlyBillId, singlesId, storageBackend]
        );
        if (!rows[0]) throw httpError(404, 'yearly_bill row not found');
        yearlyBillId = Number(rows[0].yearly_bill_id);
        paidRecordId = rows[0].paid_record_id != null ? Number(rows[0].paid_record_id) : null;
      } else {
        const { rows: existing } = await client.query(
          `SELECT yearly_bill_id, paid_record_id
             FROM helloworldjunktest.yearly_bill
            WHERE singles_id = $1 AND storage_backend = $2
              AND bill_year = $3 AND row_index = $4
            LIMIT 1`,
          [singlesId, storageBackend, year, rowIndex]
        );
        if (existing[0]) {
          yearlyBillId = Number(existing[0].yearly_bill_id);
          paidRecordId =
            existing[0].paid_record_id != null ? Number(existing[0].paid_record_id) : null;
        } else {
          const desc = String(body.bill_description ?? '').slice(0, 500);
          const billMonth = toInt(body.bill_month ?? body.due_month);
          const dueMonthDay = toInt(body.due_month_day ?? body.due_day);
          const amount = String(body.amount ?? '').slice(0, 64);
          const billType = /^auto$/i.test(String(body.bill_type || '')) ? 'Auto' : 'Manual';
          let action = null;
          if (billType === 'Manual') {
            const a = String(body.action ?? '').trim();
            if (/^paid$/i.test(a)) action = 'Paid';
            else if (/^not\s*paid$/i.test(a)) action = 'Not Paid';
          }
          const { rows: inserted } = await client.query(
            `INSERT INTO helloworldjunktest.yearly_bill (
               singles_id, storage_backend, bill_year, bill_month, row_index,
               bill_description, due_month_day, amount, bill_type, action, paid_record_id
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL)
             RETURNING yearly_bill_id, paid_record_id`,
            [
              singlesId,
              storageBackend,
              year,
              billMonth && billMonth >= 1 && billMonth <= 12 ? billMonth : null,
              rowIndex,
              desc,
              dueMonthDay && dueMonthDay >= 1 && dueMonthDay <= 31 ? dueMonthDay : null,
              amount,
              billType,
              action
            ]
          );
          yearlyBillId = Number(inserted[0].yearly_bill_id);
          paidRecordId = null;
        }
      }

      if (paidRecordId && paidRecordId > 0) {
        const pr = await loadPaidRecordOwned(client, paidRecordId, singlesId);
        if (!pr) paidRecordId = null;
      }

      if (!paidRecordId) {
        const { rows: byBill } = await client.query(
          `SELECT paid_record_id
             FROM helloworldjunktest.paid_record
            WHERE singles_id = $1 AND schedule_kind = 'yearly' AND yearly_bill_id = $2
            LIMIT 1`,
          [singlesId, yearlyBillId]
        );
        if (byBill[0]) {
          paidRecordId = Number(byBill[0].paid_record_id);
        } else {
          const { rows: created } = await client.query(
            `INSERT INTO helloworldjunktest.paid_record (
               singles_id, schedule_kind, monthly_bill_id, yearly_bill_id, storage_backend, notes_text
             ) VALUES ($1, 'yearly', NULL, $2, $3, '')
             RETURNING paid_record_id`,
            [singlesId, yearlyBillId, storageBackend]
          );
          paidRecordId = Number(created[0].paid_record_id);
        }
        await client.query(
          `UPDATE helloworldjunktest.yearly_bill
              SET paid_record_id = $1, updated_at = now()
            WHERE yearly_bill_id = $2 AND singles_id = $3`,
          [paidRecordId, yearlyBillId, singlesId]
        );
        await client.query(
          `UPDATE helloworldjunktest.paid_record
              SET yearly_bill_id = $1, updated_at = now()
            WHERE paid_record_id = $2 AND singles_id = $3`,
          [yearlyBillId, paidRecordId, singlesId]
        );
      }
    }

    const pr = await loadPaidRecordOwned(client, paidRecordId, singlesId);
    const attachments = await listAttachments(client, paidRecordId);
    const has_bill_content = hasBillContentFromParts(pr?.notes_text, attachments.length);

    await client.query('COMMIT');
    return res.json({
      ok: true,
      paid_record_id: paidRecordId,
      schedule_kind: kind,
      monthly_bill_id: kind === 'monthly' ? monthlyBillId : null,
      yearly_bill_id: kind === 'yearly' ? yearlyBillId : null,
      storage_backend: storageBackend,
      notes_text: pr?.notes_text ?? '',
      attachments,
      has_bill_content
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    return sendError(res, err);
  } finally {
    client.release();
  }
}

/** GET /api/paidRecord/:id */
export async function getPaidRecord(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const paidRecordId = toInt(req.params.id);
    if (!paidRecordId || paidRecordId < 1) throw httpError(400, 'Invalid paid_record id');

    const pr = await loadPaidRecordOwned(pool, paidRecordId, singlesId);
    if (!pr) throw httpError(404, 'Paid record not found');
    const attachments = await listAttachments(pool, paidRecordId);
    return res.json({
      paid_record_id: Number(pr.paid_record_id),
      singles_id: Number(pr.singles_id),
      schedule_kind: pr.schedule_kind,
      monthly_bill_id: pr.monthly_bill_id != null ? Number(pr.monthly_bill_id) : null,
      yearly_bill_id: pr.yearly_bill_id != null ? Number(pr.yearly_bill_id) : null,
      storage_backend: pr.storage_backend,
      notes_text: pr.notes_text ?? '',
      created_at: pr.created_at,
      updated_at: pr.updated_at,
      attachments,
      has_bill_content: hasBillContentFromParts(pr.notes_text, attachments.length)
    });
  } catch (err) {
    return sendError(res, err);
  }
}

/** PUT /api/paidRecord/:id/notes  body: { notes_text } */
export async function putPaidRecordNotes(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const paidRecordId = toInt(req.params.id);
    if (!paidRecordId || paidRecordId < 1) throw httpError(400, 'Invalid paid_record id');
    const notesText = String(req.body?.notes_text ?? req.body?.notesText ?? '').slice(0, 20000);

    const { rows } = await pool.query(
      `UPDATE helloworldjunktest.paid_record
          SET notes_text = $1, updated_at = now()
        WHERE paid_record_id = $2 AND singles_id = $3
        RETURNING *`,
      [notesText, paidRecordId, singlesId]
    );
    if (!rows[0]) throw httpError(404, 'Paid record not found');
    const attachmentCount = await countAttachments(pool, paidRecordId);
    return res.json({
      ok: true,
      paid_record_id: paidRecordId,
      notes_text: rows[0].notes_text ?? '',
      has_bill_content: hasBillContentFromParts(rows[0].notes_text, attachmentCount)
    });
  } catch (err) {
    return sendError(res, err);
  }
}

/** POST /api/paidRecord/:id/attachments — multipart field file|attachment|photo */
export async function postPaidRecordAttachment(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const paidRecordId = toInt(req.params.id);
    if (!paidRecordId || paidRecordId < 1) throw httpError(400, 'Invalid paid_record id');

    const pr = await loadPaidRecordOwned(pool, paidRecordId, singlesId);
    if (!pr) throw httpError(404, 'Paid record not found');

    let buffer;
    let originalFileName;
    let mimeType;
    const ct = String(req.headers['content-type'] || '');
    if (ct.includes('multipart/form-data')) {
      ({ buffer, originalFileName, mimeType } = await parseMultipartFile(req));
    } else if (req.body?.file && typeof req.body.file === 'string') {
      const match = String(req.body.file).match(/^data:([^;]+);base64,(.+)$/);
      if (!match) throw httpError(400, 'Invalid data URL');
      mimeType = match[1];
      buffer = Buffer.from(match[2], 'base64');
      originalFileName = req.body?.file_name || req.body?.originalFileName || 'file';
    } else {
      throw httpError(400, 'Expected multipart file or data URL');
    }

    const result = await savePaidRecordAttachmentOrSkipDuplicate(singlesId, paidRecordId, {
      buffer,
      originalFileName,
      mimeType
    });

    if (result.skipped) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        message: result.message || SKIP_DUPLICATE_UPLOAD_MESSAGE,
        error: result.message || SKIP_DUPLICATE_UPLOAD_MESSAGE,
        attachment: result.attachment,
        attachments: result.attachments,
        has_bill_content: true
      });
    }

    return res.status(201).json({
      ok: true,
      attachment: result.attachment,
      attachments: result.attachments,
      has_bill_content: true
    });
  } catch (err) {
    return sendError(res, err);
  }
}

async function sendAttachment(req, res, { download }) {
  const singlesId = requireSinglesId(req);
  const paidRecordId = toInt(req.params.id);
  const attachmentId = toInt(req.params.attachmentId);
  if (!paidRecordId || paidRecordId < 1 || !attachmentId || attachmentId < 1) {
    throw httpError(400, 'Invalid paid_record or attachment id');
  }

  const pr = await loadPaidRecordOwned(pool, paidRecordId, singlesId);
  if (!pr) throw httpError(404, 'Paid record not found');

  const { rows } = await pool.query(
    `SELECT *
       FROM helloworldjunktest.paid_record_attachment
      WHERE paid_record_attachment_id = $1 AND paid_record_id = $2 AND singles_id = $3
      LIMIT 1`,
    [attachmentId, paidRecordId, singlesId]
  );
  if (!rows[0]) throw httpError(404, 'Attachment not found');

  const { absPath, buffer } = await readPaidRecordAttachmentFile(singlesId, rows[0].relative_path);
  const mime = rows[0].mime_type || 'application/octet-stream';
  const fileName = rows[0].original_file_name || rows[0].stored_file_name || 'file';
  res.setHeader('Content-Type', mime);
  res.setHeader(
    'Content-Disposition',
    `${download ? 'attachment' : 'inline'}; filename="${encodeURIComponent(fileName)}"`
  );
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('X-Paid-Record-File', pathBase(absPath));
  return res.send(buffer);
}

function pathBase(p) {
  try {
    return String(p).split(/[/\\]/).pop() || '';
  } catch {
    return '';
  }
}

/** GET /api/paidRecord/:id/attachments/:attachmentId — inline preview */
export async function getPaidRecordAttachment(req, res) {
  try {
    return await sendAttachment(req, res, { download: false });
  } catch (err) {
    return sendError(res, err);
  }
}

/** GET /api/paidRecord/:id/attachments/:attachmentId/download */
export async function downloadPaidRecordAttachment(req, res) {
  try {
    return await sendAttachment(req, res, { download: true });
  } catch (err) {
    return sendError(res, err);
  }
}

/** DELETE /api/paidRecord/:id/attachments/:attachmentId */
export async function deletePaidRecordAttachment(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const paidRecordId = toInt(req.params.id);
    const attachmentId = toInt(req.params.attachmentId);
    if (!paidRecordId || paidRecordId < 1 || !attachmentId || attachmentId < 1) {
      throw httpError(400, 'Invalid paid_record or attachment id');
    }

    const pr = await loadPaidRecordOwned(pool, paidRecordId, singlesId);
    if (!pr) throw httpError(404, 'Paid record not found');

    const { rows } = await pool.query(
      `DELETE FROM helloworldjunktest.paid_record_attachment
        WHERE paid_record_attachment_id = $1 AND paid_record_id = $2 AND singles_id = $3
        RETURNING *`,
      [attachmentId, paidRecordId, singlesId]
    );
    if (!rows[0]) throw httpError(404, 'Attachment not found');

    await deletePaidRecordAttachmentFile(singlesId, rows[0].relative_path);
    await pool.query(
      `UPDATE helloworldjunktest.paid_record SET updated_at = now() WHERE paid_record_id = $1`,
      [paidRecordId]
    );

    const attachments = await listAttachments(pool, paidRecordId);
    return res.json({
      ok: true,
      deleted: true,
      attachments,
      has_bill_content: hasBillContentFromParts(pr.notes_text, attachments.length)
    });
  } catch (err) {
    return sendError(res, err);
  }
}

/**
 * Insert attachment for phone QR bill_receipt uploads (called from mobilePhotoUpload).
 * @returns {{ attachment, has_bill_content }}
 */
export async function addPaidRecordAttachmentFromBuffer(
  singlesId,
  paidRecordId,
  { buffer, originalFileName, mimeType }
) {
  const pr = await loadPaidRecordOwned(pool, paidRecordId, singlesId);
  if (!pr) {
    const err = new Error('Paid record not found');
    err.statusCode = 404;
    throw err;
  }
  const result = await savePaidRecordAttachmentOrSkipDuplicate(singlesId, paidRecordId, {
    buffer,
    originalFileName,
    mimeType
  });
  if (result.skipped) {
    const err = new Error(result.message || SKIP_DUPLICATE_UPLOAD_MESSAGE);
    err.statusCode = 200;
    err.skipped = true;
    err.attachment = result.attachment;
    err.attachments = result.attachments;
    // Callers that expect throw-on-fail: return soft-skip shape instead of throw.
    return {
      skipped: true,
      message: result.message || SKIP_DUPLICATE_UPLOAD_MESSAGE,
      attachment: result.attachment,
      attachments: result.attachments,
      has_bill_content: true
    };
  }
  return {
    skipped: false,
    attachment: result.attachment,
    attachments: result.attachments,
    has_bill_content: true
  };
}

/** Alias for phone QR bill_receipt uploads (mobilePhotoUpload.js). */
export async function attachBufferToPaidRecord(
  singlesId,
  paidRecordId,
  { buffer, originalName, originalFileName, mimeType }
) {
  const result = await addPaidRecordAttachmentFromBuffer(singlesId, paidRecordId, {
    buffer,
    originalFileName: originalName || originalFileName || 'receipt.jpg',
    mimeType
  });
  const att = result.attachment || {};
  return {
    fileName: att.storedFileName || att.stored_file_name || att.originalFileName || 'file',
    size: Number(att.byteSize ?? att.byte_size) || 0,
    attachmentId: Number(att.attachmentId ?? att.paid_record_attachment_id) || null,
    attachment: att,
    has_bill_content: true
  };
}
