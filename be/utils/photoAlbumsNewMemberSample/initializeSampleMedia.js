import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import {
  buildPhotoAlbumsDisplay1000pxBuffer,
  buildPhotoAlbumsThumbnailBuffer,
  fileRelativePathForVariant,
  isPhotoAlbumsRasterImageExtension,
  normalizePhotoAlbumsAttachmentBuffer,
  PHOTO_ALBUMS_NORMALIZE_OVER_BYTES,
  photoAlbumsExtensionRequiresJpegFullFile
} from '../photoAlbumsAttachmentVariants.js';
import { isPhotoAlbumsStagingVideoExtension } from '../photoAlbumsFileFormats.js';
import { openVaultBuffer, sealVaultBuffer } from '../photoAlbumsUsb/vaultCrypto.js';
import { vaultFileStoragePath } from '../photoAlbumsUsb/vaultPaths.js';
import {
  initializeSampleVariantsRoot,
  resolveInitializeSampleDir
} from './initializeSampleDir.js';
import { loadInitializeSampleManifest } from './initializeSampleManifest.js';

const SAMPLE_ATTACHMENT_IDS = new Set([1, 2, 3, 4, 5, 6, 7]);
let cacheBuildPromise = null;

function parseAttachmentIdFromRelativePath(relativePath) {
  const rel = String(relativePath || '').replace(/\\/g, '/');
  let m = rel.match(/\/att_(\d+)_\d+(?:_1000px|_thumbnail)?\.[^/]+$/i);
  if (!m) m = rel.match(/\/att_(\d+)(?:_1000px|_thumbnail)?\.[^/]+$/i);
  return m ? Number(m[1]) : null;
}

function variantKindFromRelativePath(relativePath) {
  const rel = String(relativePath || '').replace(/\\/g, '/');
  if (/_1000px\.jpg$/i.test(rel)) return 'display';
  if (/_thumbnail\.jpg$/i.test(rel)) return 'thumb';
  return 'full';
}

export function isBundledInitializeSampleAttachmentId(attachmentId) {
  return SAMPLE_ATTACHMENT_IDS.has(Number(attachmentId));
}

export function isInitializeSampleRelativePath(relativePath) {
  const id = parseAttachmentIdFromRelativePath(relativePath);
  return id != null && isBundledInitializeSampleAttachmentId(id);
}

function manifestEntryForAttachmentId(attachmentId) {
  const manifest = loadInitializeSampleManifest();
  return (manifest.attachments || []).find((a) => Number(a.attachmentId) === Number(attachmentId)) || null;
}

function sourceFilePath(entry, sampleDir = resolveInitializeSampleDir()) {
  const name = String(entry?.sourceFile || entry?.fileName || '').trim();
  if (!name) return null;
  return path.join(sampleDir, name);
}

function cacheFilePath(attachmentId, kind, sampleDir = resolveInitializeSampleDir()) {
  const entry = manifestEntryForAttachmentId(attachmentId);
  const ext = String(entry?.fileExtension || 'bin').replace(/^\./, '').toLowerCase();
  const root = initializeSampleVariantsRoot(sampleDir);
  if (kind === 'display') return path.join(root, String(attachmentId), 'display.jpg');
  if (kind === 'thumb') return path.join(root, String(attachmentId), 'thumb.jpg');
  const src = sourceFilePath(entry, sampleDir);
  if (
    kind === 'full' &&
    src &&
    fs.existsSync(src) &&
    (isPhotoAlbumsStagingVideoExtension(ext) ||
      (!photoAlbumsExtensionRequiresJpegFullFile(ext) &&
        fs.statSync(src).size <= PHOTO_ALBUMS_NORMALIZE_OVER_BYTES))
  ) {
    return src;
  }
  if (photoAlbumsExtensionRequiresJpegFullFile(ext)) return path.join(root, String(attachmentId), 'full.jpg');
  return path.join(root, String(attachmentId), `full.${ext}`);
}

async function buildEntryCache(entry, sampleDir) {
  const attachmentId = Number(entry.attachmentId);
  const srcPath = sourceFilePath(entry, sampleDir);
  if (!srcPath || !fs.existsSync(srcPath)) {
    throw new Error(`Initialize sample missing source file: ${entry.sourceFile || entry.fileName}`);
  }

  const ext = String(entry.fileExtension || path.extname(srcPath).slice(1))
    .replace(/^\./, '')
    .toLowerCase();
  const outDir = path.join(initializeSampleVariantsRoot(sampleDir), String(attachmentId));
  fs.mkdirSync(outDir, { recursive: true });

  const original = fs.readFileSync(srcPath);
  let fullBuffer = original;
  let fullPath = cacheFilePath(attachmentId, 'full', sampleDir);

  if (isPhotoAlbumsRasterImageExtension(ext)) {
    const canUseSourceDirectly =
      !photoAlbumsExtensionRequiresJpegFullFile(ext) && original.length <= PHOTO_ALBUMS_NORMALIZE_OVER_BYTES;
    if (canUseSourceDirectly) {
      fullPath = srcPath;
    } else if (photoAlbumsExtensionRequiresJpegFullFile(ext)) {
      const normalized = await normalizePhotoAlbumsAttachmentBuffer(original, { forceJpeg: true, ext });
      fullBuffer = normalized.buffer;
      fullPath = path.join(outDir, 'full.jpg');
      fs.writeFileSync(fullPath, fullBuffer);
    } else {
      const normalized = await normalizePhotoAlbumsAttachmentBuffer(original, { ext });
      if (normalized.changed) {
        fullBuffer = normalized.buffer;
        fullPath = path.join(outDir, 'full.jpg');
        fs.writeFileSync(fullPath, fullBuffer);
      } else {
        fullPath = srcPath;
      }
    }

    const variantSource =
      fullPath === srcPath ? original : fs.readFileSync(fullPath);
    const displayBuf = await buildPhotoAlbumsDisplay1000pxBuffer(variantSource, ext);
    const thumbBuf = await buildPhotoAlbumsThumbnailBuffer(variantSource, ext);
    fs.writeFileSync(path.join(outDir, 'display.jpg'), displayBuf);
    fs.writeFileSync(path.join(outDir, 'thumb.jpg'), thumbBuf);
    return;
  }

  if (isPhotoAlbumsStagingVideoExtension(ext)) {
    return;
  }
}

/** Build shared JPEG variants once under initializeSample/.variants/ (safe to re-run). */
export async function ensureInitializeSampleSharedCache() {
  if (cacheBuildPromise) return cacheBuildPromise;
  cacheBuildPromise = (async () => {
    const sampleDir = resolveInitializeSampleDir();
    const manifest = loadInitializeSampleManifest();
    for (const entry of manifest.attachments || []) {
      await buildEntryCache(entry, sampleDir);
    }
  })().catch((err) => {
    cacheBuildPromise = null;
    throw err;
  });
  return cacheBuildPromise;
}

function readPlainFile(absPath) {
  if (!absPath || !fs.existsSync(absPath)) return null;
  try {
    return fs.readFileSync(absPath);
  } catch {
    return null;
  }
}

/**
 * Read bytes for a vault relative_path from the shared initializeSample store.
 * Used when per-user vault files are symlinks or not materialized yet.
 */
export function readInitializeSampleVaultBuffer(relativePath, key = null) {
  if (!isInitializeSampleRelativePath(relativePath)) return null;
  const attachmentId = parseAttachmentIdFromRelativePath(relativePath);
  if (!attachmentId) return null;

  const kind = variantKindFromRelativePath(relativePath);
  const abs = cacheFilePath(attachmentId, kind);
  let plain = readPlainFile(abs);
  if (!plain && kind !== 'full') {
    plain = readPlainFile(cacheFilePath(attachmentId, 'full'));
  }
  if (!plain) {
    const entry = manifestEntryForAttachmentId(attachmentId);
    plain = readPlainFile(sourceFilePath(entry));
  }
  if (!plain?.length) return null;
  return openVaultBuffer(plain, key);
}

function linkFile(targetAbs, linkAbs) {
  fs.mkdirSync(path.dirname(linkAbs), { recursive: true });
  if (fs.existsSync(linkAbs)) return true;
  try {
    fs.symlinkSync(path.resolve(targetAbs), linkAbs, 'file');
    return true;
  } catch {
    return false;
  }
}

function queryOne(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

/**
 * Point vault storage paths at shared cache files via symlinks (plaintext vaults).
 * Encrypted vaults skip links — reads fall back to shared cache in readEncryptedVaultFile.
 */
export async function linkInitializeSampleIntoVault({ mountPath, key, meta, db }) {
  await ensureInitializeSampleSharedCache();

  const manifest = loadInitializeSampleManifest();
  const usePlainFiles = key == null;

  for (const entry of manifest.attachments || []) {
    const attachmentId = Number(entry.attachmentId);
    const row = queryOne(
      db,
      `SELECT relative_path FROM note_attachments WHERE attachment_id = ? AND deleted_at IS NULL`,
      [attachmentId]
    );
    const relativePath = row?.relative_path;
    if (!relativePath) continue;

    const paths = [relativePath];
    if (isPhotoAlbumsRasterImageExtension(entry.fileExtension)) {
      paths.push(fileRelativePathForVariant(relativePath, 'display'));
      paths.push(fileRelativePathForVariant(relativePath, 'thumb'));
    }

    for (const rel of paths) {
      const kind = variantKindFromRelativePath(rel);
      const sharedAbs = cacheFilePath(attachmentId, kind);
      if (!fs.existsSync(sharedAbs)) continue;

      const vaultAbs = vaultFileStoragePath(mountPath, rel, meta);
      if (usePlainFiles) {
        linkFile(sharedAbs, vaultAbs);
        continue;
      }

      if (fs.existsSync(vaultAbs)) continue;
      const plain = fs.readFileSync(sharedAbs);
      fs.mkdirSync(path.dirname(vaultAbs), { recursive: true });
      fs.writeFileSync(vaultAbs, sealVaultBuffer(plain, key));
    }
  }

  return true;
}

export function sha256File(absPath) {
  const buf = fs.readFileSync(absPath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}
