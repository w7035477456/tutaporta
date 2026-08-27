/**
 * Ephemeral object-URL cache for album attachment variants (display / thumb).
 * Seeded when opening an album so page tiles paint from prefetched *_1000px.jpg.
 */

const previewByKey = new Map();

function cacheKey(noteId, attachmentId, variant) {
  const n = Number(noteId);
  const a = Number(attachmentId);
  const v = String(variant || 'display').toLowerCase();
  if (!Number.isFinite(n) || n < 1 || !Number.isFinite(a) || a < 1) return '';
  return `${n}:${a}:${v}`;
}

export function setAttachmentVariantPreview(noteId, attachmentId, variant, objectUrl) {
  const key = cacheKey(noteId, attachmentId, variant);
  if (!key || !objectUrl) return;
  const prev = previewByKey.get(key);
  if (prev && prev !== objectUrl) {
    try {
      URL.revokeObjectURL(prev);
    } catch {
      // ignore
    }
  }
  previewByKey.set(key, objectUrl);
}

export function getAttachmentVariantPreview(noteId, attachmentId, variant) {
  const key = cacheKey(noteId, attachmentId, variant);
  if (!key) return '';
  return previewByKey.get(key) || '';
}

export function clearAttachmentVariantPreview(noteId, attachmentId, variant) {
  const key = cacheKey(noteId, attachmentId, variant);
  if (!key) return;
  const prev = previewByKey.get(key);
  previewByKey.delete(key);
  if (prev) {
    try {
      URL.revokeObjectURL(prev);
    } catch {
      // ignore
    }
  }
}

/** Drop all cached variants for one note (album switch). */
export function clearAttachmentVariantPreviewsForNote(noteId) {
  const n = Number(noteId);
  if (!Number.isFinite(n) || n < 1) return;
  const prefix = `${n}:`;
  for (const key of [...previewByKey.keys()]) {
    if (!key.startsWith(prefix)) continue;
    const prev = previewByKey.get(key);
    previewByKey.delete(key);
    if (prev) {
      try {
        URL.revokeObjectURL(prev);
      } catch {
        // ignore
      }
    }
  }
}
