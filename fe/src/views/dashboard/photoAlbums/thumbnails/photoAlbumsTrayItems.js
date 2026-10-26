/**
 * Thumbnail tray items are derived only from the album's vault attachments (DB rows).
 * Nothing about the tray is stored in the album HTML, so the tray can never drift
 * from what is actually saved in the vault.
 */
import {
  extensionFromPhotoAlbumsAttachment,
  isPhotoAlbumsStagingPhotoExtension,
  isPhotoAlbumsStagingVideoExtension
} from 'utils/photoAlbumsFileFormats';

function positiveIntOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : null;
}

function finiteOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Normalize one vault attachment row (snake_case or camelCase) into a tray item, or null. */
export function toPhotoAlbumsTrayItem(attachment) {
  if (!attachment || typeof attachment !== 'object') return null;
  const attachmentId = positiveIntOrNull(attachment.attachment_id ?? attachment.attachmentId ?? attachment.id);
  if (attachmentId == null) return null;
  const fileExtension = extensionFromPhotoAlbumsAttachment(attachment);
  const isVideo = isPhotoAlbumsStagingVideoExtension(fileExtension);
  if (!isVideo && !isPhotoAlbumsStagingPhotoExtension(fileExtension)) return null;
  return {
    attachmentId,
    fileName: String(attachment.file_name ?? attachment.fileName ?? ''),
    fileExtension,
    fileSizeBytes: finiteOrNull(attachment.file_size_bytes ?? attachment.fileSizeBytes),
    albumPhotoSeq: positiveIntOrNull(attachment.album_photo_seq ?? attachment.albumPhotoSeq),
    isVideo
  };
}

function compareTrayItems(a, b) {
  const sa = a.albumPhotoSeq;
  const sb = b.albumPhotoSeq;
  if (sa != null && sb != null && sa !== sb) return sa - sb;
  if (sa != null && sb == null) return -1;
  if (sa == null && sb != null) return 1;
  return a.attachmentId - b.attachmentId;
}

/**
 * Photo/video attachments → tray items: deduped by attachment id, ordered by album photo
 * sequence (then id). Non-media attachments are skipped.
 */
export function buildPhotoAlbumsTrayItems(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];
  const byId = new Map();
  for (const attachment of attachments) {
    const item = toPhotoAlbumsTrayItem(attachment);
    if (item && !byId.has(item.attachmentId)) byId.set(item.attachmentId, item);
  }
  return Array.from(byId.values()).sort(compareTrayItems);
}

/** Tray items not shown on any album page (`pages[].attachmentId`); same array when none are placed. */
export function excludePlacedTrayItems(items, pages) {
  const list = Array.isArray(items) ? items : [];
  const placed = new Set();
  for (const page of Array.isArray(pages) ? pages : []) {
    const id = positiveIntOrNull(page?.attachmentId);
    if (id != null) placed.add(id);
  }
  return placed.size ? list.filter((item) => !placed.has(item.attachmentId)) : list;
}

/** Full original filename with extension, for hover labels. */
export function photoAlbumsTrayItemDisplayName(item) {
  const attachmentId = item?.attachmentId;
  const name = String(item?.fileName || '').trim();
  const ext = String(item?.fileExtension || '')
    .trim()
    .replace(/^\./, '');
  if (!name) return ext ? `photo-${attachmentId}.${ext}` : `photo-${attachmentId}`;
  if (!ext) return name;
  if (name.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) return name;
  return `${name}.${ext}`;
}
