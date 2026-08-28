import { PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME, newLabelId } from './photoAlbumsTextLabelNode';
import {
  listTextAndEmojiForPhotoPos,
  listTextAndEmojiNearPhoto,
  PHOTO_ALBUMS_ATTACHMENT_NODE_NAME,
  photoPageRectFromAttrs
} from './photoAlbumsAttachmentNode';
import { PLACE_TEXT_DEFAULTS } from './PhotoAlbumsPlaceTextDialog';
import { isPhotoAlbumsStagingVideoExtension } from 'utils/photoAlbumsFileFormats';
import {
  PLACE_TEXT_PREVIEW_MIN_REL_H,
  PLACE_TEXT_PREVIEW_MIN_REL_W
} from './photoAlbumsPlaceTextPreviewShared';

function parseOptionalPx(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function isEmojiStickerLabel(text, fontFamily) {
  if (/Emoji/i.test(String(fontFamily || ''))) return true;
  const t = String(text || '').trim();
  if (!t || /\s/.test(t)) return false;
  if (/[A-Za-z0-9]/.test(t)) return false;
  return [...t].length <= 8;
}

/**
 * Caption for a new text overlay. "Sample Feb 2025" only when the photo has no text or emoji yet.
 * @param {{ explicitText?: unknown, existingOverlayCount?: number, editing?: boolean }} opts
 */
export function resolvePlaceTextCaption({ explicitText, existingOverlayCount = 0, editing = false }) {
  const trimmed = String(explicitText ?? '').trim();
  const hasOverlays = (Number(existingOverlayCount) || 0) >= 1;
  if (hasOverlays && !editing) {
    if (trimmed && trimmed !== PLACE_TEXT_DEFAULTS.text) return trimmed;
    return trimmed || '';
  }
  if (editing) return trimmed;
  if (trimmed) return trimmed;
  return PLACE_TEXT_DEFAULTS.text;
}

/** Corner offset after CSS rotate (clockwise +), y-down screen coords. */
function rotateCornerCss(localX, localY, deg) {
  const rad = (Number(deg) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: localX * cos + localY * sin,
    y: -localX * sin + localY * cos
  };
}

/**
 * Place label box so its rotated extent sits flush on the photo bottom-right edge.
 * relW/relH are fractions of photo width/height; margin is also relative (0 = flush).
 */
export function computePlaceTextBottomRightRel({ relW, relH, rotationDeg, margin = 0 }) {
  const w = Math.max(PLACE_TEXT_PREVIEW_MIN_REL_W, Number(relW) || 0);
  const h = Math.max(PLACE_TEXT_PREVIEW_MIN_REL_H, Number(relH) || 0);
  const deg = Number.isFinite(Number(rotationDeg)) ? Number(rotationDeg) : PLACE_TEXT_DEFAULTS.rotationDeg;
  const m = Math.max(0, Number(margin) || 0);
  const corners = [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2]
  ].map(([lx, ly]) => rotateCornerCss(lx, ly, deg));
  const maxDx = Math.max(...corners.map((c) => c.x));
  const maxDy = Math.max(...corners.map((c) => c.y));
  const cx = 1 - m - maxDx;
  const cy = 1 - m - maxDy;
  return {
    relX: Math.max(0, cx - w / 2),
    relY: Math.max(0, cy - h / 2)
  };
}

/**
 * Bottom-right of the visible photo inside a slot (not the letterbox/pillarbox).
 * relW/relH are fractions of the slot width/height.
 */
export function computePlaceTextBottomRightOnFramedPhoto({
  frameW,
  frameH,
  photoW,
  photoH,
  panX,
  panY,
  relW,
  relH,
  rotationDeg,
  margin = 0
}) {
  const fw = Math.max(1, Number(frameW) || 1);
  const fh = Math.max(1, Number(frameH) || 1);
  const pw = Math.max(1, Number(photoW) || fw);
  const ph = Math.max(1, Number(photoH) || fh);
  const px = Number(panX) || 0;
  const py = Number(panY) || 0;
  const w = Math.max(PLACE_TEXT_PREVIEW_MIN_REL_W, Number(relW) || 0);
  const h = Math.max(PLACE_TEXT_PREVIEW_MIN_REL_H, Number(relH) || 0);
  const labelRelWInPhoto = Math.min(1, (w * fw) / pw);
  const labelRelHInPhoto = Math.min(1, (h * fh) / ph);
  const { relX: lx, relY: ly } = computePlaceTextBottomRightRel({
    relW: labelRelWInPhoto,
    relH: labelRelHInPhoto,
    rotationDeg,
    margin
  });
  return {
    relX: (px + lx * pw) / fw,
    relY: (py + ly * ph) / fh,
    relW: w,
    relH: h
  };
}

/** Visible photo/video rect inside a slot frame (contain fit). */
export function computeContainedMediaInFrame(frameW, frameH, mediaAspect) {
  const fw = Math.max(1, Number(frameW) || 1);
  const fh = Math.max(1, Number(frameH) || 1);
  const a = mediaAspect > 0 ? mediaAspect : 16 / 9;
  let photoW = fw;
  let photoH = photoW / a;
  if (photoH > fh) {
    photoH = fh;
    photoW = photoH * a;
  }
  const panX = (fw - photoW) / 2;
  const panY = (fh - photoH) / 2;
  return { photoW, photoH, panX, panY };
}

/**
 * Default text on a video slot — starts in the letterbox below the visible video
 * (drag anywhere in the slot frame: over video, beside, or below).
 */
export function buildSeededPlaceTextVideoLabel({
  caption,
  style,
  frameW,
  frameH,
  mediaAspect,
  placement = 'below'
}) {
  const fw = Math.max(1, Number(frameW) || 1);
  const fh = Math.max(1, Number(frameH) || 1);
  const text = String(caption || '').trim() || PLACE_TEXT_DEFAULTS.text;
  const fs = Math.max(10, Math.round(Number(style?.fontSize) || PLACE_TEXT_DEFAULTS.fontSize));
  const charFactor = Math.max(6, Math.min(Math.max(text.length, 6), 24));
  const estW = Math.max(0.18, Math.min(0.92, (fs * charFactor) / fw));
  const estH = Math.max(0.06, Math.min(0.28, (fs * 1.4) / fh));
  const rotationDeg = Number.isFinite(Number(style?.rotationDeg))
    ? Math.round(Number(style.rotationDeg))
    : PLACE_TEXT_DEFAULTS.rotationDeg;

  const { photoW, photoH, panX, panY } = computeContainedMediaInFrame(fw, fh, mediaAspect);

  if (placement === 'over') {
    return buildSeededPlaceTextSampleLabel({
      caption: text,
      style,
      frameW: fw,
      frameH: fh,
      photoW,
      photoH,
      panX,
      panY
    });
  }

  const gap = 0.015;
  const videoBottomRel = (panY + photoH) / fh;
  let relX = Math.max(0, (1 - estW) / 2);
  let relY = Math.min(1 - estH, videoBottomRel + gap);

  if (placement === 'side') {
    const videoRightRel = (panX + photoW) / fw;
    relX = Math.min(1 - estW, videoRightRel + gap);
    relY = Math.max(0, Math.min(1 - estH, panY / fh + 0.08));
  }

  if (relY + estH > 1 && placement === 'below') {
    relY = Math.max(0, panY / fh + gap);
    placement = 'over';
  }

  return {
    clientKey: `new_${Date.now()}`,
    isNew: true,
    docPos: null,
    labelId: newLabelId(),
    rotationDeg,
    relX,
    relY,
    relW: estW,
    relH: estH,
    text,
    color: style?.color || PLACE_TEXT_DEFAULTS.color,
    outlineColor: style?.outlineColor || PLACE_TEXT_DEFAULTS.outlineColor,
    outlineWidth:
      style?.outlineWidth != null ? style.outlineWidth : PLACE_TEXT_DEFAULTS.outlineWidth,
    fontSize: fs,
    fontFamily: style?.fontFamily || PLACE_TEXT_DEFAULTS.fontFamily,
    fontWeight: style?.fontWeight || PLACE_TEXT_DEFAULTS.fontWeight
  };
}

/** Default "Sample Feb 2025" label on the visible photo after auto Full/Zoom. */
export function buildSeededPlaceTextSampleLabel({
  caption,
  style,
  frameW,
  frameH,
  photoW,
  photoH,
  panX,
  panY
}) {
  const fw = Math.max(1, Number(frameW) || 1);
  const fh = Math.max(1, Number(frameH) || 1);
  const text = String(caption || '').trim() || PLACE_TEXT_DEFAULTS.text;
  const fs = Math.max(10, Math.round(Number(style?.fontSize) || PLACE_TEXT_DEFAULTS.fontSize));
  const charFactor = Math.max(6, Math.min(Math.max(text.length, 6), 24));
  const estW = Math.max(0.18, Math.min(0.75, (fs * charFactor) / fw));
  const estH = Math.max(0.08, Math.min(0.35, (fs * 1.4) / fh));
  const rotationDeg = Number.isFinite(Number(style?.rotationDeg))
    ? Math.round(Number(style.rotationDeg))
    : PLACE_TEXT_DEFAULTS.rotationDeg;
  const { relX, relY, relW, relH } = computePlaceTextBottomRightOnFramedPhoto({
    frameW: fw,
    frameH: fh,
    photoW,
    photoH,
    panX,
    panY,
    relW: estW,
    relH: estH,
    rotationDeg,
    margin: 0
  });
  return {
    clientKey: `new_${Date.now()}`,
    isNew: true,
    docPos: null,
    labelId: newLabelId(),
    rotationDeg,
    relX,
    relY,
    relW,
    relH,
    text,
    color: style?.color || PLACE_TEXT_DEFAULTS.color,
    outlineColor: style?.outlineColor || PLACE_TEXT_DEFAULTS.outlineColor,
    outlineWidth:
      style?.outlineWidth != null ? style.outlineWidth : PLACE_TEXT_DEFAULTS.outlineWidth,
    fontSize: fs,
    fontFamily: style?.fontFamily || PLACE_TEXT_DEFAULTS.fontFamily,
    fontWeight: style?.fontWeight || PLACE_TEXT_DEFAULTS.fontWeight
  };
}

/** @returns {import('./PhotoAlbumsPlaceTextPositionOverlay').PlaceTextPositionSession | null} */
export function buildPlaceTextPositionSession(editor, photoPos, style, editMeta = {}) {
  if (!editor?.state || !Number.isFinite(photoPos)) return null;
  const photoNode = editor.state.doc.nodeAt(photoPos);
  if (!photoNode || photoNode.type.name !== 'photoAlbumsAttachment') return null;

  const photoRect = photoPageRectFromAttrs(photoNode.attrs);
  if (!photoRect) return null;

  const ext = String(photoNode.attrs?.fileExtension || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
  const isVideo = isPhotoAlbumsStagingVideoExtension(ext);

  const near = listTextAndEmojiForPhotoPos(editor.state, photoPos);
  const preExistingOverlayCount = Math.max(
    near.length,
    Number(editMeta.existingOverlayCount) || 0
  );

  const labels = near.map((item) => ({
    clientKey: String(item.attrs?.labelId || item.pos),
    isNew: false,
    docPos: item.pos,
    labelId: String(item.attrs?.labelId || newLabelId()),
    text: String(item.attrs?.text || '').trim() || 'Text',
    color: item.attrs?.color,
    outlineColor: item.attrs?.outlineColor,
    outlineWidth: item.attrs?.outlineWidth,
    fontSize: item.attrs?.fontSize,
    fontFamily: item.attrs?.fontFamily,
    fontWeight: item.attrs?.fontWeight,
    rotationDeg: item.attrs?.rotationDeg,
    relX: item.relX,
    relY: item.relY,
    relW: item.relBoxW,
    relH: item.relBoxH,
    isEmoji: isEmojiStickerLabel(item.attrs?.text, item.attrs?.fontFamily)
  }));

  const applyStyle = (base) => ({
    text: String(style?.text || '').trim() || base.text || 'Text',
    color: style?.color || base.color || PLACE_TEXT_DEFAULTS.color,
    outlineColor: style?.outlineColor || base.outlineColor || PLACE_TEXT_DEFAULTS.outlineColor,
    outlineWidth:
      style?.outlineWidth != null ? style.outlineWidth : base.outlineWidth ?? PLACE_TEXT_DEFAULTS.outlineWidth,
    fontSize: style?.fontSize || base.fontSize || PLACE_TEXT_DEFAULTS.fontSize,
    fontFamily: style?.fontFamily || base.fontFamily || PLACE_TEXT_DEFAULTS.fontFamily,
    fontWeight: style?.fontWeight || base.fontWeight || PLACE_TEXT_DEFAULTS.fontWeight
  });

  const editingLabelId =
    editMeta.editLabelId ||
    (style && Object.prototype.hasOwnProperty.call(style, 'editLabelId') ? style.editLabelId : null);
  const editingPos =
    editMeta.editPos ??
    (style && Object.prototype.hasOwnProperty.call(style, 'editPos') ? style.editPos : null);

  if (editingLabelId || editingPos != null) {
    const idx = labels.findIndex(
      (l) =>
        (editingLabelId && l.labelId === String(editingLabelId)) ||
        (editingPos != null && l.docPos === editingPos)
    );
    if (idx >= 0) {
      labels[idx] = { ...labels[idx], ...applyStyle(style) };
    }
  }
  // Sample label is seeded in PhotoAlbumsPlaceTextDialog after auto Full/Zoom.

  if (preExistingOverlayCount >= 1) {
    for (let i = labels.length - 1; i >= 0; i -= 1) {
      if (labels[i]?.isNew) labels.splice(i, 1);
    }
  }

  return {
    photoPos,
    attachmentId: Number(photoNode.attrs?.attachmentId),
    fileName: String(photoNode.attrs?.fileName || ''),
    fileExtension: ext,
    isVideo,
    photoRect,
    existingOverlayCount: preExistingOverlayCount,
    labels,
    rotationDeg: Number.isFinite(Number(photoNode.attrs?.rotationDeg))
      ? Number(photoNode.attrs.rotationDeg)
      : 0,
    slotFit: String(photoNode.attrs?.slotFit || 'cover').toLowerCase() === 'contain' ? 'contain' : 'cover',
    panX: Number.isFinite(Number(photoNode.attrs?.panX)) ? Number(photoNode.attrs.panX) : null,
    panY: Number.isFinite(Number(photoNode.attrs?.panY)) ? Number(photoNode.attrs.panY) : null,
    photoW: Number.isFinite(Number(photoNode.attrs?.width))
      ? Number(photoNode.attrs.width)
      : null,
    photoH: Number.isFinite(Number(photoNode.attrs?.height))
      ? Number(photoNode.attrs.height)
      : null,
    hasFrame:
      Number.isFinite(Number(photoNode.attrs?.frameWidth)) &&
      Number.isFinite(Number(photoNode.attrs?.frameHeight)) &&
      Number(photoNode.attrs.frameWidth) > 0 &&
      Number(photoNode.attrs.frameHeight) > 0
  };
}

function labelToPageAttrs(label, photoRect, attachmentId = null) {
  const pw = Math.max(1, photoRect.width);
  const ph = Math.max(1, photoRect.height);
  const fs = Math.max(10, Math.round(Number(label.fontSize) || PLACE_TEXT_DEFAULTS.fontSize));
  const emoji =
    Boolean(label.isEmoji) || isEmojiStickerLabel(label.text, label.fontFamily);
  const boxW = Math.max(
    emoji ? 24 : 48,
    Math.round((Number(label.relW) || (emoji ? (fs + 12) / pw : 0.35)) * pw)
  );
  const boxH = Math.max(
    emoji ? 24 : 28,
    Math.round((Number(label.relH) || (emoji ? (fs + 12) / ph : 0.12)) * ph)
  );
  return {
    labelId: String(label.labelId || newLabelId()),
    text: String(label.text || '').trim() || 'Text',
    color: label.color || PLACE_TEXT_DEFAULTS.color,
    outlineColor: label.outlineColor || PLACE_TEXT_DEFAULTS.outlineColor,
    outlineWidth:
      label.outlineWidth != null ? label.outlineWidth : PLACE_TEXT_DEFAULTS.outlineWidth,
    fontSize: fs,
    fontFamily: label.fontFamily || PLACE_TEXT_DEFAULTS.fontFamily,
    fontWeight: label.fontWeight || PLACE_TEXT_DEFAULTS.fontWeight,
    rotationDeg: Number.isFinite(Number(label.rotationDeg))
      ? Math.round(Number(label.rotationDeg))
      : emoji
        ? 0
        : PLACE_TEXT_DEFAULTS.rotationDeg,
    posLeft: Math.round(photoRect.left + (Number(label.relX) || 0) * pw),
    posTop: Math.round(photoRect.top + (Number(label.relY) || 0) * ph),
    boxWidth: boxW,
    boxHeight: boxH,
    ...(Number.isFinite(Number(attachmentId)) && Number(attachmentId) >= 1
      ? { hostAttachmentId: Number(attachmentId) }
      : null)
  };
}

/** Apply overlay label positions/styles onto the album document. */
export function commitPlaceTextPositionSession(editor, session) {
  if (!editor || !session?.photoRect || !Array.isArray(session.labels)) return false;
  let photoRect = session.photoRect;
  const photoPos = Number(session.photoPos);
  if (Number.isFinite(photoPos)) {
    const liveNode = editor.state.doc.nodeAt(photoPos);
    if (liveNode?.type?.name === PHOTO_ALBUMS_ATTACHMENT_NODE_NAME) {
      photoRect = photoPageRectFromAttrs(liveNode.attrs) || photoRect;
    }
  }
  const { labels } = session;
  const hostAttachmentId = Number.isFinite(Number(session.attachmentId)) ? Number(session.attachmentId) : null;

  const keptIds = new Set(
    labels.map((l) => String(l.labelId || '').trim()).filter(Boolean)
  );

  // Remove stickers/text deleted in Add Text before position updates shift doc positions.
  const near = Number.isFinite(photoPos)
    ? listTextAndEmojiForPhotoPos(editor.state, photoPos)
    : listTextAndEmojiNearPhoto(editor.state, photoRect, 24, hostAttachmentId);
  const toDelete = near
    .filter((item) => {
      const id = String(item.attrs?.labelId || '').trim();
      return id && !keptIds.has(id);
    })
    .sort((a, b) => b.pos - a.pos);

  let tr = editor.state.tr;
  for (const item of toDelete) {
    const current = tr.doc.nodeAt(item.pos);
    if (!current || current.type.name !== PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME) continue;
    tr = tr.delete(item.pos, item.pos + current.nodeSize);
  }
  if (tr.docChanged) {
    editor.view.dispatch(tr);
  }

  const existing = labels
    .filter((l) => !l.isNew && Number.isFinite(l.docPos))
    .sort((a, b) => b.docPos - a.docPos);

  tr = editor.state.tr;
  for (const label of existing) {
    // Re-resolve by labelId after deletions may have shifted positions.
    let pos = label.docPos;
    const byId = listTextAndEmojiNearPhoto(editor.state, photoRect).find(
      (item) => String(item.attrs?.labelId || '') === String(label.labelId || '')
    );
    if (byId) pos = byId.pos;
    const current = editor.state.doc.nodeAt(pos);
    if (!current || current.type.name !== PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME) continue;
    tr = tr.setNodeMarkup(pos, undefined, {
      ...current.attrs,
      ...labelToPageAttrs(label, photoRect, hostAttachmentId)
    });
  }
  if (tr.docChanged) {
    editor.view.dispatch(tr);
  }

  const newLabels = labels.filter((l) => l.isNew);
  if (newLabels.length) {
    const nodes = newLabels.map((label) => ({
      type: PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME,
      attrs: labelToPageAttrs(label, photoRect, hostAttachmentId)
    }));
    const insertAt = editor.state.doc.content.size;
    editor.chain().focus(null, { scrollIntoView: false }).insertContentAt(insertAt, nodes).run();
  }

  const store = editor.storage?.[PHOTO_ALBUMS_ATTACHMENT_NODE_NAME];
  if (store) {
    store.layoutLockVersion = (Number(store.layoutLockVersion) || 0) + 1;
    store.contextTutorialTick = (Number(store.contextTutorialTick) || 0) + 1;
  }

  return true;
}

export function estimateLabelBoxFromAttrs(attrs, photoRect) {
  const pw = Math.max(1, photoRect?.width || 1);
  const ph = Math.max(1, photoRect?.height || 1);
  const left = parseOptionalPx(attrs?.posLeft) ?? 0;
  const top = parseOptionalPx(attrs?.posTop) ?? 0;
  const fontSize = Number(attrs?.fontSize) || 28;
  const width = parseOptionalPx(attrs?.boxWidth) || Math.max(24, Math.round(fontSize * 1.2));
  const height = parseOptionalPx(attrs?.boxHeight) || Math.max(24, Math.round(fontSize * 1.2));
  return {
    relX: (left - (photoRect?.left || 0)) / pw,
    relY: (top - (photoRect?.top || 0)) / ph,
    relW: width / pw,
    relH: height / ph
  };
}
