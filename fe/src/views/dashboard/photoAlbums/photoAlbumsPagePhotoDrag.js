/**
 * Drag a thumbnail-tray photo onto an album page, or a page photo back to the tray
 * (or onto another page). Payloads only carry ids; `getData` is unreadable during
 * dragover, so drop targets check `types` there and read the payload on drop.
 */

/** Tray thumb → album page. Payload: attachment id. */
export const DRAG_TRAY_PHOTO = 'application/x-pa-tray-photo';
/** Album page photo → tray / another page. Payload: `pageKey|attachmentId`. */
export const DRAG_PAGE_PHOTO = 'application/x-pa-page-photo';

/** Background of the tray / album page while a photo drag is over it (until release). */
export const PHOTO_DROP_TARGET_BG = '#ff5252';

function dragTypes(dataTransfer) {
  return dataTransfer?.types ? Array.from(dataTransfer.types) : [];
}

export function isTrayPhotoDrag(dataTransfer) {
  return dragTypes(dataTransfer).includes(DRAG_TRAY_PHOTO);
}

export function isPagePhotoDrag(dataTransfer) {
  return dragTypes(dataTransfer).includes(DRAG_PAGE_PHOTO);
}

function readData(dataTransfer, type) {
  try {
    return String(dataTransfer?.getData?.(type) || '').trim();
  } catch {
    return '';
  }
}

/** @returns {number|null} */
export function readTrayPhotoDragAttachmentId(dataTransfer) {
  const n = Number(readData(dataTransfer, DRAG_TRAY_PHOTO));
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : null;
}

/** @returns {{ pageKey: string, attachmentId: number|null }} */
export function readPagePhotoDrag(dataTransfer) {
  const raw = readData(dataTransfer, DRAG_PAGE_PHOTO);
  const sep = raw.lastIndexOf('|');
  if (sep < 0) return { pageKey: raw, attachmentId: null };
  const n = Number(raw.slice(sep + 1));
  return {
    pageKey: raw.slice(0, sep),
    attachmentId: Number.isFinite(n) && n >= 1 ? Math.trunc(n) : null
  };
}

export function startTrayPhotoDrag(dataTransfer, attachmentId) {
  if (!dataTransfer) return;
  dataTransfer.setData(DRAG_TRAY_PHOTO, String(attachmentId));
  dataTransfer.effectAllowed = 'copyMove';
}

export function startPagePhotoDrag(dataTransfer, pageKey, attachmentId) {
  if (!dataTransfer) return;
  dataTransfer.setData(DRAG_PAGE_PHOTO, `${pageKey}|${attachmentId}`);
  dataTransfer.effectAllowed = 'move';
}
