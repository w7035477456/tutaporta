import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import pool from '../../db/connection.js';
import {
  getPhotoFolder,
  ALLOWED_TYPES,
  resizeToFit,
  getMaxUploadBytes,
  getMaxUploadMb,
  contentTypeToExt
} from '../photos/uploadPhoto.js';

const INLINE_SUBDIR = 'chat_inline';

function detectImageContentType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  // JPEG/JFIF/EXIF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  // PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  // GIF
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return 'image/gif';
  // WEBP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

function parseDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  const contentType = match ? match[1].trim().toLowerCase() : 'image/jpeg';
  const base64 = match ? match[2] : dataUrl;
  return { contentType, base64 };
}

function extToContentType(ext) {
  const e = String(ext || '').toLowerCase().replace(/^\./, '');
  if (e === 'png') return 'image/png';
  if (e === 'gif') return 'image/gif';
  if (e === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * POST /api/chat/uploadImage
 * Stores a chat-only image (not vsingles_photos). Returns a path suitable for msg_text, e.g. /api/chat/image/<token>.jpg
 */
export async function uploadChatInlineImage(req, res) {
  try {
    const singlesId = req.auth?.singles_id;
    if (!singlesId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let photoFolder;
    try {
      photoFolder = getPhotoFolder();
    } catch (e) {
      return res.status(500).json({ error: 'VSINGLES_PHOTO_FOLDER is not set in .env' });
    }

    const parsed = parseDataUrl(req.body?.image);
    if (!parsed) {
      return res.status(400).json({ error: 'Missing image (data URL or base64)' });
    }

    const { contentType: rawType, base64 } = parsed;
    let buffer = Buffer.from(base64, 'base64');
    const declaredType = rawType.split(';')[0].trim().toLowerCase();
    let contentType = declaredType === 'image/jfif' ? 'image/jpeg' : declaredType;
    if (!ALLOWED_TYPES.includes(contentType)) {
      const sniffedType = detectImageContentType(buffer);
      if (sniffedType && ALLOWED_TYPES.includes(sniffedType)) {
        contentType = sniffedType;
      } else {
        return res.status(400).json({
          error: 'Only jpg, jpeg, png, gif, and webp are allowed for chat images.'
        });
      }
    }

    let finalContentType = contentType;
    const maxBytes = getMaxUploadBytes();
    const targetBytes = Math.floor(maxBytes * 0.95);
    const maxMb = getMaxUploadMb();
    const sizeBefore = buffer.length;

    if (buffer.length > maxBytes) {
      try {
        const resized = await resizeToFit(buffer, contentType, targetBytes);
        buffer = resized.buffer;
        finalContentType = resized.contentType;
      } catch (resizeErr) {
        console.error('[uploadChatInlineImage] resize failed:', resizeErr);
      }
      if (buffer.length > maxBytes) {
        const sizeMb = (sizeBefore / (1024 * 1024)).toFixed(2);
        return res.status(400).json({
          code: 'FILE_TOO_LARGE',
          error: `File size is ${sizeMb} mb. Maximum we allow is ${maxMb} mb`
        });
      }
    }

    const ext = contentTypeToExt(finalContentType);
    const token = crypto.randomBytes(24).toString('hex');
    const filename = `${token}.${ext}`;
    const dir = path.join(path.resolve(photoFolder), INLINE_SUBDIR);
    fs.mkdirSync(dir, { recursive: true });
    const fullPath = path.join(dir, filename);
    fs.writeFileSync(fullPath, buffer);
    // Bind each uploaded chat image to the uploader so direct URL access cannot leak across users.
    fs.writeFileSync(`${fullPath}.owner`, String(singlesId), 'utf8');

    const relativePath = `/api/chat/image/${filename}`;
    console.log('[uploadChatInlineImage] saved', { singlesId, bytes: buffer.length, relativePath });
    return res.status(201).json({ path: relativePath });
  } catch (err) {
    console.error('[uploadChatInlineImage] error:', err);
    return res.status(500).json({ error: 'Failed to upload chat image' });
  }
}

const SAFE_NAME = /^[a-f0-9]{48}\.(jpe?g|png|gif|webp)$/i;

/**
 * GET /api/chat/image/:filename
 * Serves a file written by uploadChatInlineImage (auth required).
 */
export async function getChatInlineImage(req, res) {
  try {
    if (!req.auth?.singles_id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const raw = String(req.params.filename || '').trim();
    if (!SAFE_NAME.test(raw)) {
      return res.status(400).json({ error: 'Invalid image name' });
    }

    let photoFolder;
    try {
      photoFolder = getPhotoFolder();
    } catch (e) {
      return res.status(500).json({ error: 'VSINGLES_PHOTO_FOLDER is not set in .env' });
    }

    const fullPath = path.join(path.resolve(photoFolder), INLINE_SUBDIR, raw);
    const resolved = path.resolve(fullPath);
    const allowedDir = path.resolve(path.join(path.resolve(photoFolder), INLINE_SUBDIR));
    const rel = path.relative(allowedDir, resolved);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'Image not found' });
    }
    const ownerMarkerPath = `${resolved}.owner`;
    if (!fs.existsSync(ownerMarkerPath)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const ownerIdRaw = fs.readFileSync(ownerMarkerPath, 'utf8').trim();
    const ownerId = Number(ownerIdRaw);
    const me = Number(req.auth?.singles_id);
    if (!Number.isFinite(ownerId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (ownerId !== me) {
      const relativePath = `/api/chat/image/${raw}`;
      const accessCheck = await pool.query(
        `SELECT 1
         FROM helloworldjunktest.chat_log
         WHERE (sender_id = $1 OR receiver_id = $1)
           AND (msg_text = $2 OR msg_text LIKE $3)
         LIMIT 1`,
        [me, relativePath, `%${relativePath}%`]
      );
      if (!accessCheck.rows.length) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const ext = path.extname(resolved).slice(1).toLowerCase();
    const ct = extToContentType(ext);
    res.set('Content-Type', ct);
    res.set('Cache-Control', 'private, no-cache');
    return res.sendFile(resolved);
  } catch (err) {
    console.error('[getChatInlineImage] error:', err);
    return res.status(500).json({ error: 'Failed to load image' });
  }
}
