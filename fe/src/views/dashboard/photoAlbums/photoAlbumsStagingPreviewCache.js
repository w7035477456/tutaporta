/** Ephemeral object URLs for staging-tray thumbnails (not persisted in note HTML). */

import { createPhotoStagingPreviewObjectUrl } from './photoAlbumsFilesExplorerDrag';

const previewByAttachmentId = new Map();

export function setStagingAttachmentPreview(attachmentId, objectUrl) {
  const id = Number(attachmentId);
  if (!Number.isFinite(id) || id < 1 || !objectUrl) return;
  const prev = previewByAttachmentId.get(id);
  if (prev && prev !== objectUrl) {
    try {
      URL.revokeObjectURL(prev);
    } catch {
      // ignore
    }
  }
  previewByAttachmentId.set(id, objectUrl);
}

export function getStagingAttachmentPreview(attachmentId) {
  const id = Number(attachmentId);
  if (!Number.isFinite(id) || id < 1) return '';
  return previewByAttachmentId.get(id) || '';
}

export function clearStagingAttachmentPreview(attachmentId) {
  const id = Number(attachmentId);
  if (!Number.isFinite(id) || id < 1) return;
  const prev = previewByAttachmentId.get(id);
  previewByAttachmentId.delete(id);
  if (prev) {
    try {
      URL.revokeObjectURL(prev);
    } catch {
      // ignore
    }
  }
}

export function clearAllStagingAttachmentPreviews() {
  for (const url of previewByAttachmentId.values()) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }
  previewByAttachmentId.clear();
}

/** Keep tray thumb URL when sync rebuilds staging list from vault attachments. */
export function mergeStagingItemPreview(item) {
  if (!item || typeof item !== 'object') return item;
  const id = Number(item.attachmentId);
  if (!Number.isFinite(id) || id < 1) return item;
  const cached = getStagingAttachmentPreview(id);
  const url = String(item.localPreviewUrl || cached || '').trim();
  if (!url) return item;
  if (!cached || cached !== url) setStagingAttachmentPreview(id, url);
  if (item.localPreviewUrl === url) return item;
  return { ...item, localPreviewUrl: url };
}

/** Register preview from a dropped/staged File before vault upload returns an attachment id. */
export function primeStagingAttachmentPreview(attachmentId, file, fileName = '') {
  const id = Number(attachmentId);
  if (!Number.isFinite(id) || id < 1 || !(file instanceof Blob) || file.size < 1) return '';
  const url = createPhotoStagingPreviewObjectUrl(file, fileName);
  if (url) setStagingAttachmentPreview(id, url);
  return url;
}
