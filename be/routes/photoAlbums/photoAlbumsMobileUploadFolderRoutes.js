/**
 * Auth routes for Photo Albums mobile staging folder (UPLOAD_FOLDER).
 */
import fs from 'fs';
import {
  deleteMobileUploadFile,
  listMobileUploadFiles,
  readMobileUploadFile,
  writeMobileUploadFile
} from '../../utils/mobileUploadFolder.js';

function decodeUploadDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new Error('Missing file (data URL or base64)');
  }
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  const contentType = match ? match[1].trim().toLowerCase() : 'image/jpeg';
  const base64 = match ? match[2] : dataUrl;
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) {
    throw new Error('Empty file payload');
  }
  return { buffer, contentType };
}

function requireSinglesId(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return singlesId;
}

/** POST /api/photoAlbums/mobile-upload/files — stage a copy for desktop Mobile Upload tray (TutaNotes phone upload). */
export async function postPhotoAlbumsMobileUploadFile(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  try {
    const { buffer, contentType } = decodeUploadDataUrl(req.body?.file);
    const originalName =
      typeof req.body?.file_name === 'string' && req.body.file_name.trim()
        ? req.body.file_name.trim()
        : 'photo.jpg';
    const { fileName, size } = await writeMobileUploadFile(singlesId, {
      buffer,
      originalName,
      contentType
    });
    return res.json({ success: true, fileName, size });
  } catch (err) {
    console.error('[postPhotoAlbumsMobileUploadFile]', err?.message || err);
    const msg = err?.message || 'Failed to stage mobile upload file';
    const code = /not allowed|Missing|Empty|Invalid/i.test(msg) ? 400 : 500;
    return res.status(code).json({ error: msg });
  }
}

/** GET /api/photoAlbums/mobile-upload/files */
export async function listPhotoAlbumsMobileUploadFiles(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  try {
    const files = await listMobileUploadFiles(singlesId);
    return res.json({ files });
  } catch (err) {
    console.error('[listPhotoAlbumsMobileUploadFiles]', err?.message || err);
    return res.status(500).json({
      error: err?.message || 'Failed to list mobile upload files'
    });
  }
}

/** GET /api/photoAlbums/mobile-upload/files/:fileName */
export async function getPhotoAlbumsMobileUploadFile(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  const fileName = decodeURIComponent(String(req.params?.fileName || '').trim());
  try {
    const { absolutePath, contentType, size } = await readMobileUploadFile(singlesId, fileName);
    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    res.setHeader('Content-Length', String(size));
    const disposition = String(req.query?.download || '') === '1' ? 'attachment' : 'inline';
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${fileName.replace(/"/g, '')}"`
    );
    const stream = fs.createReadStream(absolutePath);
    stream.on('error', (err) => {
      console.error('[getPhotoAlbumsMobileUploadFile] stream', err?.message || err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to read file' });
      } else {
        res.end();
      }
    });
    return stream.pipe(res);
  } catch (err) {
    const msg = err?.message || 'File not found';
    const code = /not found|Invalid/i.test(msg) ? 404 : 500;
    return res.status(code).json({ error: msg });
  }
}

/** DELETE /api/photoAlbums/mobile-upload/files/:fileName */
export async function deletePhotoAlbumsMobileUploadFile(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  const fileName = decodeURIComponent(String(req.params?.fileName || '').trim());
  try {
    await deleteMobileUploadFile(singlesId, fileName);
    return res.json({ success: true, fileName });
  } catch (err) {
    const msg = err?.message || 'Failed to delete file';
    const code = /not found|Invalid/i.test(msg) ? 404 : 500;
    return res.status(code).json({ error: msg });
  }
}
