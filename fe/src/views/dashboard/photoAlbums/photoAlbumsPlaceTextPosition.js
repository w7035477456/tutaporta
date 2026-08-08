import { PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME, newLabelId } from './photoAlbumsTextLabelNode';
import {
  listTextAndEmojiNearPhoto,
  photoPageRectFromAttrs
} from './photoAlbumsAttachmentNode';
import { PLACE_TEXT_DEFAULTS } from './PhotoAlbumsPlaceTextDialog';

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
  const isVideo = ext === 'mp4';

  const pw = Math.max(1, photoRect.width);
  const ph = Math.max(1, photoRect.height);

  const near = listTextAndEmojiNearPhoto(editor.state, photoRect).filter(
    (item) => !isEmojiStickerLabel(item.attrs?.text, item.attrs?.fontFamily)
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
    relH: item.relBoxH
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
      labels[idx] = { ...labels[idx], ...applyStyle(labels[idx]) };
    }
  } else {
    const fs = Math.max(10, Math.round(Number(style?.fontSize) || PLACE_TEXT_DEFAULTS.fontSize));
    const estW = Math.max(0.18, Math.min(0.75, (fs * 6) / pw));
    const estH = Math.max(0.08, Math.min(0.35, (fs * 1.4) / ph));
    labels.push({
      clientKey: `new_${Date.now()}`,
      isNew: true,
      docPos: null,
      labelId: newLabelId(),
      rotationDeg: -12,
      relX: 0.12,
      relY: 0.12,
      relW: estW,
      relH: estH,
      ...applyStyle({})
    });
  }

  return {
    photoPos,
    attachmentId: Number(photoNode.attrs?.attachmentId),
    fileName: String(photoNode.attrs?.fileName || ''),
    fileExtension: ext,
    isVideo,
    photoRect,
    labels
  };
}

function labelToPageAttrs(label, photoRect) {
  const pw = Math.max(1, photoRect.width);
  const ph = Math.max(1, photoRect.height);
  const fs = Math.max(10, Math.round(Number(label.fontSize) || PLACE_TEXT_DEFAULTS.fontSize));
  const boxW = Math.max(48, Math.round((Number(label.relW) || 0.35) * pw));
  const boxH = Math.max(28, Math.round((Number(label.relH) || 0.12) * ph));
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
      : -12,
    posLeft: Math.round(photoRect.left + (Number(label.relX) || 0) * pw),
    posTop: Math.round(photoRect.top + (Number(label.relY) || 0) * ph),
    boxWidth: boxW,
    boxHeight: boxH
  };
}

/** Apply overlay label positions/styles onto the album document. */
export function commitPlaceTextPositionSession(editor, session) {
  if (!editor || !session?.photoRect || !Array.isArray(session.labels)) return false;
  const { photoRect, labels } = session;

  const existing = labels
    .filter((l) => !l.isNew && Number.isFinite(l.docPos))
    .sort((a, b) => b.docPos - a.docPos);

  let tr = editor.state.tr;
  for (const label of existing) {
    const current = tr.doc.nodeAt(label.docPos);
    if (!current || current.type.name !== PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME) continue;
    tr = tr.setNodeMarkup(label.docPos, undefined, {
      ...current.attrs,
      ...labelToPageAttrs(label, photoRect)
    });
  }
  if (tr.docChanged) {
    editor.view.dispatch(tr);
  }

  const newLabels = labels.filter((l) => l.isNew);
  if (newLabels.length) {
    const nodes = newLabels.map((label) => ({
      type: PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME,
      attrs: labelToPageAttrs(label, photoRect)
    }));
    const insertAt = editor.state.doc.content.size;
    editor.chain().focus(null, { scrollIntoView: false }).insertContentAt(insertAt, nodes).run();
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
