import {
  createMobilePhotoUploadSession,
  getMobilePhotoUploadSession,
  markMobilePhotoUploadCompleted,
  markMobilePhotoUploadInProgress,
  clearMobilePhotoUploadInProgress,
  isMobilePhotoUploadInProgress,
  normalizeMobilePhotoUploadPurpose,
  readMobilePhotoUploadTokenFromRequest,
  sessionExpired
} from '../../utils/mobilePhotoUploadSession.js';
import { setProfileImageForSingles } from '../../utils/setProfileImageForSingles.js';
import {
  debugMobilePhotoUpload,
  errorMobilePhotoUpload,
  formatMobileUploadBytes,
  maskMobileUploadToken,
  mobileUploadRequestContext,
  traceMobilePhotoUpload,
  warnMobilePhotoUpload,
  infoMobilePhotoUpload
} from '../../utils/mobilePhotoUploadLog.js';
import { uploadPhoto } from './uploadPhoto.js';
import pool from '../../db/connection.js';
import {
  installMobilePhotoFormRedirect,
  parseMobilePhotoMultipart
} from '../../utils/parseMobilePhotoMultipart.js';
import { writeMobileUploadFile } from '../../utils/mobileUploadFolder.js';
import {
  isStoragePermissionError,
  logStoragePermissionFailure,
  STORAGE_PERMISSION_CODE,
  STORAGE_PERMISSION_USER_MESSAGE
} from '../../utils/storagePermissionError.js';
import { attachBufferToPaidRecord } from '../recordVault/paidRecordRoutes.js';

function sessionStatusPayload(row) {
  const expired = sessionExpired(row);
  const purpose = normalizeMobilePhotoUploadPurpose(row?.purpose);
  return {
    valid: Boolean(row) && !expired,
    expired,
    completed: Boolean(row?.completed_at),
    photosId: row?.photos_id ?? null,
    expiresAt: row?.expires_at ?? null,
    replacedDuplicate: Boolean(row?.replaced_duplicate),
    purpose,
    fileName: row?.stored_file_name ?? null,
    paidRecordId: row?.paid_record_id != null ? Number(row.paid_record_id) : null
  };
}

function clientIp(req) {
  return req?.ip || req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
}

function decodeImageDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new Error('Missing image (data URL or base64)');
  }
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  const contentType = match ? match[1].trim().toLowerCase() : 'image/jpeg';
  const base64 = match ? match[2] : dataUrl;
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) {
    throw new Error('Empty image payload');
  }
  return { buffer, contentType };
}

async function respondPublicMobilePhotoUploadSession(req, res, token) {
  infoMobilePhotoUpload('validate START', {
    token: maskMobileUploadToken(token),
    ip: clientIp(req)
  });
  debugMobilePhotoUpload('validate START detail', {
    token: maskMobileUploadToken(token),
    ip: clientIp(req),
    userAgent: String(req.headers?.['user-agent'] ?? '').slice(0, 120)
  });
  try {
    const row = await getMobilePhotoUploadSession(token);
    if (!row) {
      warnMobilePhotoUpload('validate NOT FOUND', {
        token: maskMobileUploadToken(token),
        ip: clientIp(req)
      });
      return res.status(404).json({ error: 'Upload link not found. Tap New QR code on your computer and scan again.' });
    }
    const payload = sessionStatusPayload(row);
    if (!payload.valid && !payload.completed) {
      warnMobilePhotoUpload('validate EXPIRED', {
        token: maskMobileUploadToken(token),
        singlesId: row.singles_id,
        expiresAt: row.expires_at
      });
      return res.status(410).json({
        ...payload,
        error: 'This upload link has expired. Scan the QR code again from your computer.'
      });
    }
    infoMobilePhotoUpload('validate OK', {
      token: maskMobileUploadToken(token),
      singlesId: row.singles_id,
      completed: payload.completed,
      purpose: payload.purpose
    });
    debugMobilePhotoUpload('validate OK detail', {
      token: maskMobileUploadToken(token),
      singlesId: row.singles_id,
      ...payload
    });
    return res.json(payload);
  } catch (err) {
    errorMobilePhotoUpload('validate FAIL', err, mobileUploadRequestContext(req));
    return res.status(500).json({ error: 'Failed to read upload session' });
  }
}

/** POST /api/mobilePhotoUpload/session — desktop creates a phone-upload link (auth required). */
export async function postMobilePhotoUploadSession(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  const purpose = normalizeMobilePhotoUploadPurpose(req.body?.purpose);
  debugMobilePhotoUpload('POST /session START', { singlesId, purpose, ip: clientIp(req) });
  try {
    if (!Number.isFinite(singlesId) || singlesId < 1) {
      debugMobilePhotoUpload('POST /session REJECT auth', { singlesId });
      return res.status(401).json({ error: 'Authentication required' });
    }
    const paidRecordId = Number(req.body?.paid_record_id ?? req.body?.paidRecordId);
    const session = await createMobilePhotoUploadSession(singlesId, {
      purpose,
      paidRecordId: Number.isFinite(paidRecordId) ? paidRecordId : null
    });
    infoMobilePhotoUpload('POST /session OK', {
      singlesId,
      purpose: session.purpose,
      paidRecordId: session.paidRecordId,
      token: maskMobileUploadToken(session.token)
    });
    debugMobilePhotoUpload('POST /session OK detail', {
      singlesId,
      purpose: session.purpose,
      paidRecordId: session.paidRecordId,
      token: maskMobileUploadToken(session.token),
      expiresAt: session.expiresAt
    });
    return res.json(session);
  } catch (err) {
    if (err?.code === '42P01') {
      errorMobilePhotoUpload('POST /session table missing — run addMobilePhotoUploadSessions.sql', err, { singlesId });
      return res.status(503).json({
        error: 'mobile_upload_not_configured',
        message: 'Run be/db/addMobilePhotoUploadSessions.sql on Primary.'
      });
    }
    errorMobilePhotoUpload('POST /session FAIL', err, { singlesId, purpose, ...mobileUploadRequestContext(req) });
    return res.status(500).json({ error: 'Failed to create mobile upload session' });
  }
}

/** GET /api/mobilePhotoUpload/session/:token/status — desktop polls completion (auth required). */
export async function getMobilePhotoUploadSessionStatus(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  const token = readMobilePhotoUploadTokenFromRequest(req);
  debugMobilePhotoUpload('GET /session/:token/status START', {
    singlesId,
    token: maskMobileUploadToken(token),
    ip: clientIp(req)
  });
  try {
    if (!Number.isFinite(singlesId) || singlesId < 1) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const row = await getMobilePhotoUploadSession(token);
    if (!row || Number(row.singles_id) !== singlesId) {
      debugMobilePhotoUpload('GET /session/:token/status NOT FOUND', {
        singlesId,
        token: maskMobileUploadToken(token),
        rowSinglesId: row?.singles_id ?? null
      });
      return res.status(404).json({ error: 'Upload session not found' });
    }
    const payload = sessionStatusPayload(row);
    payload.uploading = await isMobilePhotoUploadInProgress(token);
    debugMobilePhotoUpload('GET /session/:token/status OK', {
      singlesId,
      token: maskMobileUploadToken(token),
      ...payload
    });
    return res.json(payload);
  } catch (err) {
    errorMobilePhotoUpload('GET /session/:token/status FAIL', err, mobileUploadRequestContext(req));
    return res.status(500).json({ error: 'Failed to read upload session' });
  }
}

/** POST /api/mobilePhotoUpload/uploading?token= — phone signals upload started (public). */
export async function postMobilePhotoUploadInProgress(req, res) {
  const token = readMobilePhotoUploadTokenFromRequest(req);
  if (!token) {
    return res.status(400).json({ error: 'Missing upload token.' });
  }
  try {
    const row = await getMobilePhotoUploadSession(token);
    if (!row) {
      return res.status(404).json({ error: 'Upload session not found' });
    }
    if (sessionExpired(row)) {
      return res.status(410).json({ error: 'Upload link expired' });
    }
    await markMobilePhotoUploadInProgress(token);
    return res.json({ ok: true, uploading: true });
  } catch (err) {
    errorMobilePhotoUpload('POST /uploading FAIL', err, mobileUploadRequestContext(req));
    return res.status(500).json({ error: 'Failed to mark upload in progress' });
  }
}

/** GET /api/mobilePhotoUpload/ping — public health for phone upload API (no auth). */
export function getMobilePhotoUploadPing(req, res) {
  traceMobilePhotoUpload('ping', mobileUploadRequestContext(req));
  return res.json({ ok: true, apiVersion: 2 });
}

/** GET /api/mobilePhotoUpload/validate?token= — phone page (public, query string). */
export async function getMobilePhotoUploadValidate(req, res) {
  const token = readMobilePhotoUploadTokenFromRequest(req);
  if (!token) {
    return res.status(400).json({ error: 'Missing upload token. Scan the QR code again from your computer.' });
  }
  return respondPublicMobilePhotoUploadSession(req, res, token);
}

/** GET /api/mobilePhotoUpload/session/:token — phone page (public, legacy path param). */
export async function getMobilePhotoUploadSessionPublic(req, res) {
  const token = readMobilePhotoUploadTokenFromRequest(req);
  if (!token) {
    return res.status(400).json({ error: 'Missing upload token. Scan the QR code again from your computer.' });
  }
  return respondPublicMobilePhotoUploadSession(req, res, token);
}

async function handleBillReceiptMobileUpload(req, res, token, singlesId, paidRecordId) {
  let buffer;
  let contentType;
  if (Buffer.isBuffer(req._mobilePhotoBuffer) && req._mobilePhotoBuffer.length) {
    buffer = req._mobilePhotoBuffer;
    contentType = String(req._mobilePhotoContentType || 'image/jpeg');
  } else {
    const dataUrl = req.body?.image;
    try {
      ({ buffer, contentType } = decodeImageDataUrl(dataUrl));
    } catch (decodeErr) {
      await clearMobilePhotoUploadInProgress(token);
      return res.status(400).json({ error: decodeErr?.message || 'Missing image (data URL or base64)' });
    }
  }
  const originalName =
    req.body?.originalFileName || req.body?.file_name || req.body?.filename || 'receipt.jpg';
  try {
    const result = await attachBufferToPaidRecord(singlesId, paidRecordId, {
      buffer,
      originalName,
      mimeType: contentType
    });
    await markMobilePhotoUploadCompleted(token, null, { storedFileName: result.fileName });
    infoMobilePhotoUpload('POST bill_receipt OK', {
      token: maskMobileUploadToken(token),
      singlesId,
      paidRecordId,
      fileName: result.fileName,
      size: result.size
    });
    return res.status(200).json({
      success: true,
      fileName: result.fileName,
      purpose: 'bill_receipt',
      paidRecordId,
      attachmentId: result.attachmentId,
      size: result.size
    });
  } catch (err) {
    await clearMobilePhotoUploadInProgress(token);
    errorMobilePhotoUpload('bill_receipt write FAIL', err, {
      token: maskMobileUploadToken(token),
      singlesId,
      paidRecordId
    });
    return res.status(400).json({ error: err?.message || 'Failed to save bill receipt upload' });
  }
}

async function handlePhotoAlbumsMobileUpload(req, res, token, singlesId) {
  let buffer;
  let contentType;
  if (Buffer.isBuffer(req._mobilePhotoBuffer) && req._mobilePhotoBuffer.length) {
    buffer = req._mobilePhotoBuffer;
    contentType = String(req._mobilePhotoContentType || 'image/jpeg');
  } else {
    const dataUrl = req.body?.image;
    try {
      ({ buffer, contentType } = decodeImageDataUrl(dataUrl));
    } catch (decodeErr) {
      await clearMobilePhotoUploadInProgress(token);
      return res.status(400).json({ error: decodeErr?.message || 'Missing image (data URL or base64)' });
    }
  }
  const originalName =
    req.body?.originalFileName || req.body?.file_name || req.body?.filename || 'photo';
  try {
    const { fileName, size } = await writeMobileUploadFile(singlesId, {
      buffer,
      originalName,
      contentType
    });
    await markMobilePhotoUploadCompleted(token, null, { storedFileName: fileName });
    infoMobilePhotoUpload('POST photo albums OK', {
      token: maskMobileUploadToken(token),
      singlesId,
      fileName,
      size
    });
    return res.status(200).json({
      success: true,
      fileName,
      purpose: 'photo_albums',
      size
    });
  } catch (err) {
    await clearMobilePhotoUploadInProgress(token);
    if (/UPLOAD_FOLDER is not set/i.test(String(err?.message || ''))) {
      errorMobilePhotoUpload('albums write FAIL — UPLOAD_FOLDER missing', err, { singlesId });
      return res.status(500).json({ error: 'UPLOAD_FOLDER is not set in .env' });
    }
    if (isStoragePermissionError(err)) {
      logStoragePermissionFailure(err, {
        route: 'mobilePhotoUpload (photo albums QR)',
        envKey: 'UPLOAD_FOLDER',
        folder: process.env.UPLOAD_FOLDER,
        singlesId
      });
      return res.status(500).json({
        code: STORAGE_PERMISSION_CODE,
        error: STORAGE_PERMISSION_USER_MESSAGE
      });
    }
    errorMobilePhotoUpload('albums write FAIL', err, {
      token: maskMobileUploadToken(token),
      singlesId,
      bufferBytes: buffer?.length,
      bufferSize: formatMobileUploadBytes(buffer?.length)
    });
    return res.status(400).json({ error: err?.message || 'Failed to save phone upload' });
  }
}

async function handleMobilePhotoUploadPost(req, res, token) {
  traceMobilePhotoUpload('POST photo handler ENTER', {
    ...mobileUploadRequestContext(req),
    token: maskMobileUploadToken(token)
  });
  let isMultipart = false;
  try {
    isMultipart = await parseMobilePhotoMultipart(req);
    traceMobilePhotoUpload('POST photo multipart result', { isMultipart });
    if (isMultipart) {
      installMobilePhotoFormRedirect(req, res, token);
    }
  } catch (parseErr) {
    errorMobilePhotoUpload('POST photo multipart parse FAIL', parseErr, {
      ...mobileUploadRequestContext(req),
      token: maskMobileUploadToken(token)
    });
    if (String(req.headers['content-type'] || '').includes('multipart/form-data')) {
      installMobilePhotoFormRedirect(req, res, token);
      return res.status(400).json({ error: parseErr?.message || 'Missing photo file' });
    }
    return res.status(400).json({ error: parseErr?.message || 'Missing photo file' });
  }

  const hasImage =
    Boolean(req.body?.image && typeof req.body.image === 'string') ||
    (Buffer.isBuffer(req._mobilePhotoBuffer) && req._mobilePhotoBuffer.length > 0);
  if (hasImage && !req.body?.file_extension) {
    const originalName = req.body?.originalFileName || req.body?.file_name || req.body?.filename || '';
    const extMatch = String(originalName).match(/\.([^.]+)$/);
    if (extMatch) {
      req.body.file_extension = extMatch[1].toLowerCase();
    }
  }
  const imageChars = hasImage ? String(req.body.image).length : 0;
  const mobileBytes = Buffer.isBuffer(req._mobilePhotoBuffer) ? req._mobilePhotoBuffer.length : 0;
  traceMobilePhotoUpload('POST photo payload', {
    token: maskMobileUploadToken(token),
    ip: clientIp(req),
    hasImage,
    imagePayloadChars: imageChars,
    mobileBufferBytes: mobileBytes,
    mobileBufferSize: mobileBytes ? formatMobileUploadBytes(mobileBytes) : null,
    originalFileName: req.body?.originalFileName || null,
    fileExtension: req.body?.file_extension || null,
    userAgent: String(req.headers?.['user-agent'] ?? '').slice(0, 120)
  });
  try {
    const row = await getMobilePhotoUploadSession(token);
    if (!row) {
      warnMobilePhotoUpload('POST photo NOT FOUND', { token: maskMobileUploadToken(token), ip: clientIp(req) });
      return res.status(404).json({ error: 'Upload link not found. Scan a fresh QR code from your computer.' });
    }
    if (sessionExpired(row)) {
      warnMobilePhotoUpload('POST photo EXPIRED', {
        token: maskMobileUploadToken(token),
        singlesId: row.singles_id,
        expiresAt: row.expires_at
      });
      return res.status(410).json({ error: 'This upload link has expired. Scan the QR code again from your computer.' });
    }

    await markMobilePhotoUploadInProgress(token);

    const singlesId = Number(row.singles_id);
    const purpose = normalizeMobilePhotoUploadPurpose(row.purpose);

    if (purpose === 'photo_albums') {
      debugMobilePhotoUpload('POST photo albums path', {
        token: maskMobileUploadToken(token),
        singlesId
      });
      return handlePhotoAlbumsMobileUpload(req, res, token, singlesId);
    }

    if (purpose === 'bill_receipt') {
      const paidRecordId = Number(row.paid_record_id);
      if (!Number.isFinite(paidRecordId) || paidRecordId < 1) {
        await clearMobilePhotoUploadInProgress(token);
        return res.status(400).json({ error: 'Upload link is missing paid_record_id' });
      }
      debugMobilePhotoUpload('POST bill_receipt path', {
        token: maskMobileUploadToken(token),
        singlesId,
        paidRecordId
      });
      return handleBillReceiptMobileUpload(req, res, token, singlesId, paidRecordId);
    }

    req.auth = { singles_id: singlesId };
    req._mobilePhotoUploadToken = token;
    req._afterPhotoUpload = async (photosId) => {
      debugMobilePhotoUpload('afterPhotoUpload hook START', {
        token: maskMobileUploadToken(token),
        singlesId,
        photosId
      });
      await markMobilePhotoUploadCompleted(token, photosId, {
        replacedDuplicate: Boolean(req._replacedDuplicate)
      });
      const profile = await pool.query(
        `SELECT profile_image_fk FROM helloworldjunktest.singles WHERE singles_id = $1 LIMIT 1`,
        [singlesId]
      );
      const currentProfileId = Number(profile.rows[0]?.profile_image_fk);
      if (!Number.isFinite(currentProfileId) || currentProfileId < 1) {
        debugMobilePhotoUpload('afterPhotoUpload set profile_image_fk', { singlesId, photosId });
        await setProfileImageForSingles(singlesId, photosId);
      } else {
        debugMobilePhotoUpload('afterPhotoUpload skip profile (already set)', {
          singlesId,
          photosId,
          currentProfileId
        });
      }
      debugMobilePhotoUpload('afterPhotoUpload hook OK', {
        token: maskMobileUploadToken(token),
        singlesId,
        photosId
      });
    };

    debugMobilePhotoUpload('POST photo delegating to uploadPhoto', {
      token: maskMobileUploadToken(token),
      singlesId,
      purpose
    });
    return uploadPhoto(req, res);
  } catch (err) {
    await clearMobilePhotoUploadInProgress(token);
    errorMobilePhotoUpload('POST photo FAIL', err, {
      ...mobileUploadRequestContext(req),
      token: maskMobileUploadToken(token)
    });
    return res.status(500).json({ error: 'Failed to upload photo from phone' });
  }
}

/** POST /api/mobilePhotoUpload/photo?token= — phone upload (public, query string). */
export async function postMobilePhotoUploadPhotoQuery(req, res) {
  const token = readMobilePhotoUploadTokenFromRequest(req);
  if (!token) {
    return res.status(400).json({ error: 'Missing upload token. Scan the QR code again from your computer.' });
  }
  return handleMobilePhotoUploadPost(req, res, token);
}

/** POST /api/mobilePhotoUpload/session/:token/photo — phone upload (public, legacy path param). */
export async function postMobilePhotoUploadViaSession(req, res) {
  const token = readMobilePhotoUploadTokenFromRequest(req);
  if (!token) {
    return res.status(400).json({ error: 'Missing upload token. Scan the QR code again from your computer.' });
  }
  return handleMobilePhotoUploadPost(req, res, token);
}
