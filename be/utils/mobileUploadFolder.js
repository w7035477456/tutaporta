/**
 * Phone → desktop staging folder (UPLOAD_FOLDER).
 * Files live under UPLOAD_FOLDER (~/.ssh/be/.env, typically ${FAST_STORAGE_FOLDER}/mobile_upload).
 * Namespaced as `{singlesId}_{product}_*` so each product gallery only sees its own uploads.
 */
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  contentTypeToExt,
  extToContentType,
  isAllowedAlbumPhotoContentType,
  normalizePhotoExtension
} from './albumUploadFormats.js';

export const MOBILE_UPLOAD_PRODUCT_TUTAPHOTO = 'tutaphoto';
export const MOBILE_UPLOAD_PRODUCT_TUTANOTES = 'tutanotes';
export const MOBILE_UPLOAD_PRODUCT_TUTADATES = 'tutadates';

export const MOBILE_UPLOAD_PRODUCTS = [
  MOBILE_UPLOAD_PRODUCT_TUTAPHOTO,
  MOBILE_UPLOAD_PRODUCT_TUTANOTES,
  MOBILE_UPLOAD_PRODUCT_TUTADATES
];

const MOBILE_UPLOAD_VIDEO_EXTENSIONS = new Set(['mp4', 'mov']);
const MOBILE_UPLOAD_VIDEO_MIME = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-m4v',
  'video/m4v'
]);

/** Common album image + video types for mobile staging. */
const MOBILE_UPLOAD_IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'heic',
  'heif'
]);

export function normalizeMobileUploadProduct(raw) {
  const p = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (
    p === MOBILE_UPLOAD_PRODUCT_TUTAPHOTO ||
    p === 'photo_albums' ||
    p === 'photoalbums' ||
    p === 'photos' ||
    p === 'albums'
  ) {
    return MOBILE_UPLOAD_PRODUCT_TUTAPHOTO;
  }
  if (
    p === MOBILE_UPLOAD_PRODUCT_TUTANOTES ||
    p === 'notes' ||
    p === 'record_vault' ||
    p === 'recordvault'
  ) {
    return MOBILE_UPLOAD_PRODUCT_TUTANOTES;
  }
  if (p === MOBILE_UPLOAD_PRODUCT_TUTADATES || p === 'dates' || p === 'mystory' || p === 'my_story') {
    return MOBILE_UPLOAD_PRODUCT_TUTADATES;
  }
  return '';
}

export function requireMobileUploadProduct(raw) {
  const product = normalizeMobileUploadProduct(raw);
  if (!product) {
    throw new Error(
      `Invalid mobile upload product. Use one of: ${MOBILE_UPLOAD_PRODUCTS.join(', ')}`
    );
  }
  return product;
}

function expandTilde(folder) {
  const t = String(folder || '').trim().replace(/\/+$/, '');
  if (!t) return '';
  if (t === '~') return os.homedir();
  if (t.startsWith('~/')) return path.join(os.homedir(), t.slice(2));
  return t;
}

export function getMobileUploadFolder() {
  const folder = process.env.UPLOAD_FOLDER;
  if (!folder || typeof folder !== 'string' || !folder.trim()) {
    throw new Error('UPLOAD_FOLDER is not set in .env');
  }
  const expanded = expandTilde(folder);
  if (!expanded) {
    throw new Error('UPLOAD_FOLDER is not set in .env');
  }
  return expanded;
}

export async function ensureMobileUploadFolder() {
  const folder = getMobileUploadFolder();
  await fs.mkdir(folder, { recursive: true });
  return folder;
}

export function assertSafeMobileUploadFileName(name) {
  const raw = String(name ?? '').trim();
  if (!raw) {
    throw new Error('Missing file name');
  }
  const base = path.basename(raw);
  if (!base || base !== raw.replace(/\\/g, '/').split('/').pop()) {
    throw new Error('Invalid file name');
  }
  if (base.includes('..') || base.includes('/') || base.includes('\\') || base === '.' || base === '..') {
    throw new Error('Invalid file name');
  }
  return base;
}

function extensionOf(fileName) {
  const base = path.basename(String(fileName || ''));
  const dot = base.lastIndexOf('.');
  if (dot < 0) return '';
  return normalizePhotoExtension(base.slice(dot + 1));
}

function isAllowedMobileUploadExtension(ext) {
  const e = normalizePhotoExtension(ext);
  if (MOBILE_UPLOAD_VIDEO_EXTENSIONS.has(e)) return true;
  if (e === 'jpg' || e === 'jpeg') return true;
  return MOBILE_UPLOAD_IMAGE_EXTENSIONS.has(e);
}

function isAllowedMobileUploadContentType(contentType, fileExtension = '') {
  const base = String(contentType ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (MOBILE_UPLOAD_VIDEO_MIME.has(base)) return true;
  if (base.startsWith('image/')) {
    if (isAllowedAlbumPhotoContentType(base, fileExtension)) {
      const ext = fileExtension || contentTypeToExt(base, fileExtension);
      return isAllowedMobileUploadExtension(ext);
    }
  }
  return false;
}

function contentTypeForFileName(fileName) {
  const ext = extensionOf(fileName);
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'mov') return 'video/quicktime';
  return extToContentType(ext);
}

function singlesPrefix(singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) {
    throw new Error('Invalid singles_id');
  }
  return `${id}_`;
}

function productPrefix(singlesId, product) {
  const safeProduct = requireMobileUploadProduct(product);
  return `${singlesPrefix(singlesId)}${safeProduct}_`;
}

function fileProductFromName(singlesId, fileName) {
  const prefix = singlesPrefix(singlesId);
  const name = String(fileName || '');
  if (!name.startsWith(prefix)) return '';
  const rest = name.slice(prefix.length);
  const productToken = rest.split('_')[0] || '';
  return normalizeMobileUploadProduct(productToken);
}

function sanitizeOriginalBaseName(originalName, contentType) {
  const raw = path.basename(String(originalName || '').trim() || 'photo');
  const cleaned = raw.replace(/[^\w.\-()+ ]+/g, '_').replace(/\s+/g, '_').slice(0, 120);
  const hasExt = cleaned.includes('.') && extensionOf(cleaned);
  if (hasExt && isAllowedMobileUploadExtension(extensionOf(cleaned))) {
    return cleaned;
  }
  const ext = contentTypeToExt(contentType, extensionOf(cleaned)) || 'jpg';
  const stem = cleaned.replace(/\.[^.]+$/, '') || 'photo';
  return `${stem}.${ext === 'jpeg' ? 'jpg' : ext}`;
}

/**
 * @param {number} singlesId
 * @param {string} [product] — when set, only that product's files; omit to list all products (backup).
 */
export async function listMobileUploadFiles(singlesId, product) {
  const folder = await ensureMobileUploadFolder();
  const userPrefix = singlesPrefix(singlesId);
  const filterProduct = product ? requireMobileUploadProduct(product) : '';
  const productPref = filterProduct ? productPrefix(singlesId, filterProduct) : '';
  let names;
  try {
    names = await fs.readdir(folder);
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }
  const out = [];
  for (const name of names) {
    if (!name.startsWith(userPrefix)) continue;
    if (!isAllowedMobileUploadExtension(extensionOf(name))) continue;
    if (filterProduct) {
      // Strict: only `{id}_{product}_*` — legacy unscoped `{id}_*` files are excluded.
      if (!name.startsWith(productPref)) continue;
    } else {
      // Backup: include product-scoped files and legacy unscoped files for this user.
      const scoped = fileProductFromName(singlesId, name);
      if (!scoped) {
        // Legacy `{id}_{timestamp}_…` — keep for backup only.
      }
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      const st = await fs.stat(path.join(folder, name));
      if (!st.isFile()) continue;
      out.push({
        name,
        size: st.size,
        mtimeMs: st.mtimeMs,
        contentType: contentTypeForFileName(name),
        product: fileProductFromName(singlesId, name) || null
      });
    } catch {
      // skip unreadable
    }
  }
  out.sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
  return out;
}

export async function writeMobileUploadFile(singlesId, { buffer, originalName, contentType, product } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 1) {
    throw new Error('Missing file buffer');
  }
  const safeProduct = requireMobileUploadProduct(product);
  const ct = String(contentType || 'image/jpeg')
    .split(';')[0]
    .trim()
    .toLowerCase() || 'image/jpeg';
  const safeOriginal = sanitizeOriginalBaseName(originalName, ct);
  if (!isAllowedMobileUploadContentType(ct, extensionOf(safeOriginal))) {
    throw new Error(
      `File type not allowed for mobile upload (${ct}). Use jpeg, png, gif, webp, heic, mp4, or mov.`
    );
  }
  const folder = await ensureMobileUploadFolder();
  const fileName = `${productPrefix(singlesId, safeProduct)}${Date.now()}_${safeOriginal}`;
  assertSafeMobileUploadFileName(fileName);
  const absolutePath = path.join(folder, fileName);
  await fs.writeFile(absolutePath, buffer);
  return { fileName, size: buffer.length, product: safeProduct };
}

export function resolveMobileUploadFilePath(singlesId, fileName, product) {
  const folder = getMobileUploadFolder();
  const safeName = assertSafeMobileUploadFileName(fileName);
  const userPrefix = singlesPrefix(singlesId);
  if (!safeName.startsWith(userPrefix)) {
    throw new Error('File not found');
  }
  if (product) {
    const productPref = productPrefix(singlesId, product);
    if (!safeName.startsWith(productPref)) {
      throw new Error('File not found');
    }
  }
  const absolutePath = path.resolve(folder, safeName);
  const folderResolved = path.resolve(folder);
  if (absolutePath !== folderResolved && !absolutePath.startsWith(folderResolved + path.sep)) {
    throw new Error('Invalid file path');
  }
  return absolutePath;
}

export async function readMobileUploadFile(singlesId, fileName, product) {
  const absolutePath = resolveMobileUploadFilePath(singlesId, fileName, product);
  const st = await fs.stat(absolutePath);
  if (!st.isFile()) {
    throw new Error('File not found');
  }
  return {
    absolutePath,
    contentType: contentTypeForFileName(fileName),
    size: st.size,
    product: fileProductFromName(singlesId, fileName) || null
  };
}

export async function deleteMobileUploadFile(singlesId, fileName, product) {
  const absolutePath = resolveMobileUploadFilePath(singlesId, fileName, product);
  await fs.unlink(absolutePath);
}
