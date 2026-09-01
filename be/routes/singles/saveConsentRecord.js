import pool from '../../db/connection.js';
import { isAdminImpersonationSession } from '../../utils/adminAuth.js';
import { resolveBioSchema, sqlIdent } from './checkrBioReviewDb.js';
import { saveConsentSnapshotPhoto } from '../photos/saveConsentSnapshotPhoto.js';
import {
  resolveConsentDescription,
  resolveConsentWatermarkVariant
} from '../../constants/consentRecordVariants.js';

function getClientIp(req) {
  return (
    req.ip ||
    (typeof req.headers['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'].split(',')[0].trim() : '') ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

async function loadConsentRecordColumns(schemaName) {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = 'consent_record'`,
    [schemaName]
  );
  return new Set(result.rows.map((row) => row.column_name));
}

/**
 * POST /api/consent-record/save
 * Saves consent with a full vet_bio row snapshot as JSON.
 * Optional consent_signature_image (PNG data URL) is stored in TUTADATES_PHOTO_FOLDER
 * and linked via consent_record.consent_signature_image_fk -> photos.photos_id.
 */
export async function saveConsentRecord(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (isAdminImpersonationSession(req.auth)) {
    return res.json({
      success: true,
      skipped: true,
      reason: 'admin_impersonation',
      date_signed: new Date().toISOString()
    });
  }

  const fullNameSigned = String(req.body?.full_name_signed ?? '').trim();
  const viewerApproved = Number(req.body?.viewer_approved);
  const rawDateSigned = req.body?.date_signed;
  const dateSigned = rawDateSigned ? new Date(rawDateSigned) : new Date();
  const consentSignatureImage = String(req.body?.consent_signature_image ?? '').trim();
  const watermarkVariant = String(req.body?.watermark_variant ?? '').trim();
  const description = resolveConsentDescription(watermarkVariant, req.body?.description);
  const watermark = resolveConsentWatermarkVariant(watermarkVariant);

  if (!fullNameSigned) {
    return res.status(400).json({ error: 'Full name is required' });
  }
  if (!Number.isFinite(viewerApproved) || viewerApproved < 1) {
    return res.status(400).json({ error: 'viewer_approved is required' });
  }
  if (Number.isNaN(dateSigned.getTime())) {
    return res.status(400).json({ error: 'Invalid date_signed' });
  }

  let client;
  try {
    const schemaName = await resolveBioSchema();
    const schema = sqlIdent(schemaName);
    const consentColumns = await loadConsentRecordColumns(schemaName);
    const hasSignatureFk = consentColumns.has('consent_signature_image_fk');
    const hasDescription = consentColumns.has('description');

    client = await pool.connect();
    await client.query('BEGIN');

    const vetResult = await client.query(
      `SELECT to_jsonb(vb) AS info_snapshot
       FROM ${schema}.vet_bio vb
       WHERE vb.singles_id = $1
       LIMIT 1`,
      [singlesId]
    );

    const infoSnapshot = vetResult.rows[0]?.info_snapshot ?? {};

    let consentSignatureImageFk = null;
    if (consentSignatureImage) {
      if (!hasSignatureFk) {
        throw new Error('consent_signature_image_fk column is missing on consent_record');
      }
      consentSignatureImageFk = await saveConsentSnapshotPhoto(client, singlesId, consentSignatureImage, {
        fileNamePrefix: 'consent_sig_',
        clientIp: getClientIp(req),
        recordedAt: dateSigned,
        watermarkTitleLine: watermark.titleLine,
        watermarkStrokeColor: watermark.strokeColor,
        watermarkStrokeWidthRatio: watermark.strokeWidthRatio
      });
    }

    const insertColumns = ['member_id', 'full_name_signed', 'viewer_approved', 'date_signed', 'info_snapshot'];
    const insertValues = [singlesId, fullNameSigned, viewerApproved, dateSigned, JSON.stringify(infoSnapshot)];
    if (hasDescription) {
      insertColumns.push('description');
      insertValues.push(description);
    }
    if (consentSignatureImageFk != null) {
      insertColumns.push('consent_signature_image_fk');
      insertValues.push(consentSignatureImageFk);
    }

    const valueRefs = insertValues.map((_, index) => {
      const position = index + 1;
      return insertColumns[index] === 'info_snapshot' ? `$${position}::jsonb` : `$${position}`;
    });

    const returningColumns = ['consent_record_id', 'date_signed'];
    if (hasDescription) {
      returningColumns.push('description');
    }
    if (hasSignatureFk) {
      returningColumns.push('consent_signature_image_fk');
    }

    const insertResult = await client.query(
      `INSERT INTO ${schema}.consent_record (${insertColumns.map((column) => sqlIdent(column)).join(', ')})
       VALUES (${valueRefs.join(', ')})
       RETURNING ${returningColumns.map((column) => sqlIdent(column)).join(', ')}`,
      insertValues
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      consent_record_id: insertResult.rows[0]?.consent_record_id ?? null,
      date_signed: insertResult.rows[0]?.date_signed ?? dateSigned.toISOString(),
      description: insertResult.rows[0]?.description ?? description,
      consent_signature_image_fk: insertResult.rows[0]?.consent_signature_image_fk ?? consentSignatureImageFk
    });
  } catch (error) {
    try {
      await client?.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    console.error('[consent:saveConsentRecord]', error?.message || error);
    return res.status(500).json({ error: 'Failed to save consent record' });
  } finally {
    client?.release();
  }
}
