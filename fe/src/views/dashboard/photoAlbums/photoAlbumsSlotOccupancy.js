/** Slot occupancy helpers — one framed photo per template slot. */

const PHOTO_ALBUMS_ATTACHMENT_NODE = 'photoAlbumsAttachment';

function parseOptionalPx(value) {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/px$/i, ''));
  return Number.isFinite(n) ? n : null;
}

/** Framed photo whose frame center sits inside `frame` (optionally skip `excludePos`). */
export function findFramedPhotoInFrame(state, frame, excludePos) {
  if (!state || !frame) return null;
  const fLeft = frame.left;
  const fTop = frame.top;
  const fW = Math.max(1, frame.width);
  const fH = Math.max(1, frame.height);
  let found = null;
  state.doc.descendants((node, pos) => {
    if (found || node.type.name !== PHOTO_ALBUMS_ATTACHMENT_NODE) return;
    if (typeof excludePos === 'number' && pos === excludePos) return;
    const fl = parseOptionalPx(node.attrs.frameLeft);
    const ft = parseOptionalPx(node.attrs.frameTop);
    const fw = parseOptionalPx(node.attrs.frameWidth);
    const fh = parseOptionalPx(node.attrs.frameHeight);
    if (fl == null || ft == null || fw == null || fh == null) return;
    const cx = fl + fw / 2;
    const cy = ft + fh / 2;
    if (cx < fLeft || cx > fLeft + fW || cy < fTop || cy > fTop + fH) return;
    found = { node, pos, fl, ft, fw, fh };
  });
  return found;
}

/** Move the occupant of `frame` back to the staging tray so a new photo can take the slot. */
export function evictFramedPhotoInFrameToStaging(editor, frame, excludePos) {
  if (!editor?.state || !frame) return null;
  const store = editor.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE];
  if (typeof store?.returnAttachmentToStaging !== 'function') return null;
  const other = findFramedPhotoInFrame(editor.state, frame, excludePos);
  if (!other) return null;
  const attrs = other.node.attrs;
  const returned = store.returnAttachmentToStaging({
    attachmentId: attrs.attachmentId,
    fileName: attrs.fileName,
    fileExtension: attrs.fileExtension,
    fileSizeBytes: attrs.fileSizeBytes,
    checksum: attrs.checksum,
    _photoRect: { left: other.fl, top: other.ft, width: other.fw, height: other.fh }
  });
  return returned ? other : null;
}

function frameOccupancyKey(fl, ft, fw, fh) {
  return `${Math.round(fl)}|${Math.round(ft)}|${Math.round(fw)}|${Math.round(fh)}`;
}

/** Keep one framed photo per slot; return extras to the staging tray. */
export function evictDuplicateFramedPhotosInSlots(editor) {
  if (!editor?.state) return 0;
  const store = editor.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE];
  if (typeof store?.returnAttachmentToStaging !== 'function') return 0;

  const byFrame = new Map();
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== PHOTO_ALBUMS_ATTACHMENT_NODE) return;
    const fl = parseOptionalPx(node.attrs.frameLeft);
    const ft = parseOptionalPx(node.attrs.frameTop);
    const fw = parseOptionalPx(node.attrs.frameWidth);
    const fh = parseOptionalPx(node.attrs.frameHeight);
    if (fl == null || ft == null || fw == null || fh == null) return;
    const key = frameOccupancyKey(fl, ft, fw, fh);
    const list = byFrame.get(key) || [];
    list.push({ node, pos, fl, ft, fw, fh });
    byFrame.set(key, list);
  });

  let evicted = 0;
  for (const list of byFrame.values()) {
    if (list.length <= 1) continue;
    list.sort((a, b) => a.pos - b.pos);
    for (let i = 1; i < list.length; i += 1) {
      const item = list[i];
      const attrs = item.node.attrs;
      const returned = store.returnAttachmentToStaging({
        attachmentId: attrs.attachmentId,
        fileName: attrs.fileName,
        fileExtension: attrs.fileExtension,
        fileSizeBytes: attrs.fileSizeBytes,
        checksum: attrs.checksum,
        _photoRect: { left: item.fl, top: item.ft, width: item.fw, height: item.fh }
      });
      if (returned) evicted += 1;
    }
  }
  return evicted;
}
