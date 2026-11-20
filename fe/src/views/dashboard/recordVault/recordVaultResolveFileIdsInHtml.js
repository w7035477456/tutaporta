/**
 * Resolve `<img data-file-id="N">` (and legacy data-attachment-id on img) to a
 * same-origin attachment URL so TipTap can display the picture. Bytes stay on
 * disk under TutaNotes/files/; body_text only keeps the pointer.
 */

function defaultFileUrl(noteId, fileId) {
  return `/api/recordVault/notes/${noteId}/attachments/${fileId}?inline=1`;
}

/**
 * @param {string} html
 * @param {number} noteId
 * @param {{ fileUrl?: (noteId: number, fileId: number) => string }} [opts]
 */
export function resolveRecordVaultFileIdsInHtml(html, noteId, opts = {}) {
  const note = Number(noteId);
  const raw = String(html ?? '');
  if (!raw || !Number.isFinite(note) || note < 1) return raw;
  const fileUrl = typeof opts.fileUrl === 'function' ? opts.fileUrl : defaultFileUrl;

  return raw.replace(/<img\b[^>]*>/gi, (tag) => {
    const idMatch =
      /\bdata-file-id\s*=\s*(["'])(\d+)\1/i.exec(tag) ||
      /\bdata-attachment-id\s*=\s*(["'])(\d+)\1/i.exec(tag);
    if (!idMatch) return tag;
    const fileId = Number(idMatch[2]);
    if (!Number.isFinite(fileId) || fileId < 1) return tag;
    const url = fileUrl(note, fileId);
    if (!url) return tag;

    let next = tag.replace(/\s*src\s*=\s*(["'])[^"']*\1/i, '');
    if (!/\bdata-file-id\s*=/i.test(next)) {
      next = next.replace(/^<img\b/i, `<img data-file-id="${fileId}"`);
    }
    return next.replace(/^<img\b/i, `<img src="${url}"`);
  });
}

/**
 * Before save: drop resolved src on pointer imgs so Postgres never stores URLs/bytes.
 * Keeps data-file-id.
 */
export function stripResolvedFileSrcFromHtml(html) {
  const raw = String(html ?? '');
  if (!raw) return raw;
  return raw.replace(/<img\b[^>]*>/gi, (tag) => {
    if (!/\bdata-file-id\s*=/i.test(tag) && !/\bdata-attachment-id\s*=/i.test(tag)) return tag;
    return tag.replace(/\s*src\s*=\s*(["'])[^"']*\1/i, '');
  });
}
