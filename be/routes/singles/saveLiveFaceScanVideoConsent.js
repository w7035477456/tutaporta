import pool from '../../db/connection.js';
import { resolveBioSchema, sqlIdent } from './checkrBioReviewDb.js';
import { saveConsentVideoFile } from '../videos/saveConsentVideoFile.js';
import { CONSENT_DESCRIPTION_LIVE_FACE_SCAN_VIDEO } from '../../constants/consentRecordVariants.js';
import { getPhotoFolder } from '../../utils/photoFilePath.js';
import { getVideoFolder } from '../../utils/videoFilePath.js';
import { sendLiveFaceScanVideoSupportEmail } from '../../lib/liveFaceScanVideoSupportEmail.js';
import { parseMediaDataUrl, normalizeVideoContentType } from '../../utils/parseMediaDataUrl.js';
import { deleteLiveFaceScanVideoConsentsForMember } from '../../utils/deleteLiveFaceScanVideoConsents.js';

const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = new Set(['video/webm', 'video/mp4', 'video/quicktime']);

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

function formatMemberLabel({ alias, prefix, member_id: memberId } = {}) {
  const name = String(alias ?? '').trim();
  const code =
    prefix != null && memberId != null && String(memberId).trim() !== ''
      ? `${String(prefix).trim()}${String(memberId).trim()}`
      : '';
  if (name && code) return `${name} (${code})`;
  if (name) return name;
  if (code) return code;
  return 'Member';
}

async function deletePriorLiveFaceScanVideoConsents(client, schema, singlesId) {
  await deleteLiveFaceScanVideoConsentsForMember(client, schema, singlesId);
}

/**
 * POST /api/consent-record/save-live-face-scan-video
 * Body: { full_name_signed, viewer_approved, consent_video (data URL webm/mp4) }
 */
export async function saveLiveFaceScanVideoConsent(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const fullNameSigned = String(req.body?.full_name_signed ?? '').trim();
  const viewerApproved = Number(req.body?.viewer_approved);
  const consentVideo = String(req.body?.consent_video ?? '').trim();
  const dateSigned = new Date();

  if (!fullNameSigned) {
    return res.status(400).json({ error: 'Full name is required' });
  }
  if (!Number.isFinite(viewerApproved) || viewerApproved < 1) {
    return res.status(400).json({ error: 'viewer_approved is required' });
  }
  if (!consentVideo) {
    return res.status(400).json({ error: 'consent_video is required' });
  }

  const parsed = parseMediaDataUrl(consentVideo);
  if (!parsed) {
    return res.status(400).json({ error: 'Invalid consent video data URL' });
  }
  const contentType = normalizeVideoContentType(parsed.contentType);
  if (!ALLOWED_VIDEO_TYPES.has(contentType)) {
    return res.status(400).json({ error: 'Consent video must be WebM or MP4' });
  }
  const buffer = Buffer.from(parsed.base64, 'base64');
  if (!buffer.length) {
    return res.status(400).json({ error: 'Empty consent video' });
  }
  if (buffer.length > MAX_VIDEO_BYTES) {
    return res.status(400).json({ error: 'Consent video exceeds 25 MB limit' });
  }

  let client;
  try {
    const schemaName = await resolveBioSchema();
    const schema = sqlIdent(schemaName);
    const consentColumns = await loadConsentRecordColumns(schemaName);
    const hasVideoFk = consentColumns.has('consent_signature_video_fk');
    const hasDescription = consentColumns.has('description');
    if (!hasVideoFk || !hasDescription) {
      return res.status(500).json({ error: 'consent_record schema is missing required columns (run addVideosTable.sql)' });
    }
    if (!getVideoFolder() && !getPhotoFolder()) {
      return res.status(500).json({ error: 'TUTADATES_VIDEO_FOLDER or TUTADATES_PHOTO_FOLDER not configured' });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    await deletePriorLiveFaceScanVideoConsents(client, schema, singlesId);

    const vetResult = await client.query(
      `SELECT to_jsonb(vb) AS info_snapshot
       FROM ${schema}.vet_bio vb
       WHERE vb.singles_id = $1
       LIMIT 1`,
      [singlesId]
    );
    const infoSnapshot = vetResult.rows[0]?.info_snapshot ?? {};

    const consentVideoFk = await saveConsentVideoFile(client, singlesId, consentVideo, {
      allowedContentTypes: ALLOWED_VIDEO_TYPES,
      normalizeContentType: normalizeVideoContentType
    });

    const insertResult = await client.query(
      `INSERT INTO ${schema}.consent_record
         (member_id, full_name_signed, viewer_approved, date_signed, info_snapshot, description, consent_signature_video_fk)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
       RETURNING consent_record_id, date_signed, description, consent_signature_video_fk`,
      [
        singlesId,
        fullNameSigned,
        viewerApproved,
        dateSigned,
        JSON.stringify(infoSnapshot),
        CONSENT_DESCRIPTION_LIVE_FACE_SCAN_VIDEO,
        consentVideoFk
      ]
    );

    const userResult = await client.query(
      `SELECT email, alias, prefix, member_id
       FROM helloworldjunktest.singles
       WHERE singles_id = $1
       LIMIT 1`,
      [singlesId]
    );
    const userRow = userResult.rows[0] || {};

    await client.query('COMMIT');

    let emailResult = { sent: false };
    try {
      emailResult = await sendLiveFaceScanVideoSupportEmail({
        singlesId,
        memberLabel: formatMemberLabel(userRow),
        email: String(userRow.email ?? '').trim(),
        fullNameSigned,
        videoId: consentVideoFk
      });
    } catch (emailErr) {
      console.error('[consent:saveLiveFaceScanVideoConsent] email failed', emailErr?.message || emailErr);
    }

    return res.json({
      success: true,
      consent_record_id: insertResult.rows[0]?.consent_record_id ?? null,
      date_signed: insertResult.rows[0]?.date_signed ?? dateSigned.toISOString(),
      description: insertResult.rows[0]?.description ?? CONSENT_DESCRIPTION_LIVE_FACE_SCAN_VIDEO,
      consent_signature_video_fk: consentVideoFk,
      emailSent: Boolean(emailResult.sent),
      emailTo: emailResult.to ?? null
    });
  } catch (error) {
    try {
      await client?.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    console.error('[consent:saveLiveFaceScanVideoConsent]', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Failed to save live face scan video' });
  } finally {
    client?.release();
  }
}
