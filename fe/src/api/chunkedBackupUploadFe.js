import api from './axios';

/** Cloudflare (Free plan) rejects request bodies over 100 MB with a bare 413; stay well below it. */
export const CHUNKED_UPLOAD_THRESHOLD_BYTES = 90 * 1024 * 1024;
const CHUNK_BYTES = 32 * 1024 * 1024;
const CHUNK_ATTEMPTS = 3;

function newChunkedUploadId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function isRetryableChunkError(err) {
  const status = Number(err?.response?.status) || 0;
  return !status || status === 408 || status === 429 || status >= 500;
}

/**
 * Send `blob` to PUT /api/tutadrive/upload-chunk in 32 MiB pieces (each retried up to 3 times).
 * `onProgress(loadedBytes, totalBytes)` covers the whole blob.
 */
export async function uploadBlobInChunks(blob, { onProgress } = {}) {
  const totalBytes = blob.size;
  const chunkCount = Math.ceil(totalBytes / CHUNK_BYTES);
  const chunkedUploadId = newChunkedUploadId();
  let sentBytes = 0;
  for (let index = 0; index < chunkCount; index += 1) {
    const piece = blob.slice(index * CHUNK_BYTES, Math.min(totalBytes, (index + 1) * CHUNK_BYTES));
    for (let attempt = 1; ; attempt += 1) {
      try {
        await api.put('/api/tutadrive/upload-chunk', piece, {
          params: { uploadId: chunkedUploadId, index },
          headers: { 'Content-Type': 'application/octet-stream' },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          timeout: 0,
          onUploadProgress: (event) => {
            const loaded = Math.min(Number(event?.loaded) || 0, piece.size);
            onProgress?.(sentBytes + loaded, totalBytes);
          }
        });
        break;
      } catch (err) {
        if (attempt >= CHUNK_ATTEMPTS || !isRetryableChunkError(err)) throw err;
      }
    }
    sentBytes += piece.size;
    onProgress?.(sentBytes, totalBytes);
  }
  return { chunkedUploadId, chunkCount, totalBytes };
}

/**
 * When the FormData `backup` file is over the Cloudflare-safe size, upload it in chunks first and
 * return a FormData that references the chunks instead of carrying the file. Small files pass through.
 */
export async function prepareLargeBackupFormData(formData, { onProgress } = {}) {
  const file = formData.get('backup');
  if (!(file instanceof Blob) || file.size <= CHUNKED_UPLOAD_THRESHOLD_BYTES) {
    return { formData, chunked: false };
  }
  const { chunkedUploadId, chunkCount, totalBytes } = await uploadBlobInChunks(file, { onProgress });
  const next = new FormData();
  for (const [key, value] of formData.entries()) {
    if (key !== 'backup') next.append(key, value);
  }
  next.append('chunkedUploadId', chunkedUploadId);
  next.append('chunkCount', String(chunkCount));
  next.append('totalBytes', String(totalBytes));
  return { formData: next, chunked: true };
}
