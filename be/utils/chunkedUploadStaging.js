/**
 * Chunked uploads for large backup zips.
 *
 * Cloudflare (Free plan) rejects any request body over 100 MB with a bare HTML 413, so the browser
 * sends big zips as several smaller `PUT /api/tutadrive/upload-chunk` requests. Each chunk is
 * written to its own part file under LARGE_CHEAP_STORAGE_FOLDER (shared storage, not process
 * memory), so any app server in the round-robin pool can receive any chunk. The final
 * multipart request carries `chunkedUploadId` instead of the file, and
 * `assembleChunkedUpload` concatenates the parts into one zip.
 */
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { getLargeCheapStorageFolderRoot } from './tutaDriveMemberPaths.js';

/** Largest single chunk the server accepts (browser sends 32 MiB chunks). */
export const CHUNKED_UPLOAD_MAX_CHUNK_BYTES = 48 * 1024 * 1024;
export const CHUNKED_UPLOAD_MAX_CHUNKS = 64;
const STALE_UPLOAD_MS = 6 * 60 * 60 * 1000;
const UPLOAD_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;

function chunkedUploadsRootForSingles(singlesId) {
  const sid = Number(singlesId);
  if (!Number.isFinite(sid) || sid < 1) throw new Error('Authentication required');
  return path.join(getLargeCheapStorageFolderRoot(), '.chunked-uploads', `S${Math.trunc(sid)}`);
}

function chunkedUploadDir(singlesId, uploadId) {
  const id = String(uploadId || '').trim();
  if (!UPLOAD_ID_RE.test(id)) throw new Error('Invalid chunked upload id');
  return path.join(chunkedUploadsRootForSingles(singlesId), id);
}

function partPath(dir, index) {
  return path.join(dir, `${String(index).padStart(4, '0')}.part`);
}

function pruneStaleChunkedUploads(singlesId) {
  let root;
  try {
    root = chunkedUploadsRootForSingles(singlesId);
  } catch {
    return;
  }
  if (!fs.existsSync(root)) return;
  const now = Date.now();
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const abs = path.join(root, entry.name);
    try {
      if (now - fs.statSync(abs).mtimeMs > STALE_UPLOAD_MS) {
        fs.rmSync(abs, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  }
}

/** Remove a chunked upload's staging folder (after assembly or on failure). */
export function discardChunkedUpload(singlesId, uploadId) {
  try {
    fs.rmSync(chunkedUploadDir(singlesId, uploadId), { recursive: true, force: true });
  } catch {
    // ignore
  }
}

/**
 * Stream the request body (application/octet-stream) into part `index` of `uploadId`.
 * Re-sending the same index overwrites that part, so the browser can retry a failed chunk.
 */
export async function receiveUploadChunk(req, singlesId, uploadId, index) {
  const idx = Number(index);
  if (!Number.isInteger(idx) || idx < 0 || idx >= CHUNKED_UPLOAD_MAX_CHUNKS) {
    throw new Error('Invalid chunk index');
  }
  const declared = Number(req.get?.('content-length') || req.headers['content-length'] || 0);
  if (declared > CHUNKED_UPLOAD_MAX_CHUNK_BYTES) {
    throw new Error(`Upload chunk exceeds ${CHUNKED_UPLOAD_MAX_CHUNK_BYTES / (1024 * 1024)} MiB`);
  }
  if (idx === 0) pruneStaleChunkedUploads(singlesId);

  const dir = chunkedUploadDir(singlesId, uploadId);
  fs.mkdirSync(dir, { recursive: true });
  const finalPath = partPath(dir, idx);
  const tmpPath = `${finalPath}.${process.pid}.tmp`;

  let received = 0;
  req.on('data', (chunk) => {
    received += chunk?.length || 0;
    if (received > CHUNKED_UPLOAD_MAX_CHUNK_BYTES) {
      req.destroy(new Error(`Upload chunk exceeds ${CHUNKED_UPLOAD_MAX_CHUNK_BYTES / (1024 * 1024)} MiB`));
    }
  });
  try {
    await pipeline(req, fs.createWriteStream(tmpPath));
  } catch (err) {
    fs.rmSync(tmpPath, { force: true });
    throw err;
  }
  if (!received) {
    fs.rmSync(tmpPath, { force: true });
    throw new Error('Upload chunk is empty');
  }
  fs.renameSync(tmpPath, finalPath);
  return { index: idx, bytes: received };
}

/**
 * Concatenate parts 0..chunkCount-1 into `destPath`, check the total size, then remove staging.
 * @returns {Promise<number>} bytes written
 */
export async function assembleChunkedUpload(singlesId, uploadId, { chunkCount, totalBytes, maxBytes, destPath }) {
  const dir = chunkedUploadDir(singlesId, uploadId);
  const count = Number(chunkCount);
  const expected = Number(totalBytes);
  if (!Number.isInteger(count) || count < 1 || count > CHUNKED_UPLOAD_MAX_CHUNKS) {
    throw new Error('Invalid chunk count');
  }
  if (!Number.isFinite(expected) || expected < 1) throw new Error('Invalid chunked upload size');
  if (maxBytes && expected > maxBytes) {
    discardChunkedUpload(singlesId, uploadId);
    throw new Error(`Backup zip exceeds ${maxBytes / (1024 * 1024)} MiB limit`);
  }

  let sum = 0;
  for (let i = 0; i < count; i += 1) {
    const p = partPath(dir, i);
    if (!fs.existsSync(p)) {
      throw new Error(`Upload chunk ${i + 1} of ${count} is missing — please try the upload again`);
    }
    sum += fs.statSync(p).size;
  }
  if (sum !== expected) {
    throw new Error(`Uploaded chunks total ${sum} bytes but ${expected} were expected — please try again`);
  }

  const out = fs.createWriteStream(destPath);
  try {
    for (let i = 0; i < count; i += 1) {
      await pipeline(fs.createReadStream(partPath(dir, i)), out, { end: false });
    }
  } finally {
    await new Promise((resolve, reject) => {
      out.end((err) => (err ? reject(err) : resolve()));
    });
  }
  discardChunkedUpload(singlesId, uploadId);
  return sum;
}
