/**
 * Helpers to move one album page (template + photos/labels) into another album note.
 */
import {
  albumTemplateBlockHeight,
  createAlbumTemplateInstance,
  parseAlbumTemplateInstancesFromHtml,
  serializeAlbumTemplateInstances
} from './photoAlbumsPageTemplates';
import {
  fetchPhotoAlbumsNoteAttachmentBlob,
  uploadPhotoAlbumsNoteAttachment,
  deletePhotoAlbumsNoteAttachment,
  updatePhotoAlbumsNote,
  fetchPhotoAlbumsNote
} from 'api/photoAlbumsFe';

const TEMPLATE_MARKER_RE = /<div\b[^>]*data-rv-album-template\b[^>]*>\s*<\/div>/gi;
const STAGING_MARKER_RE = /<div\b[^>]*data-rv-album-staging\b[^>]*>\s*<\/div>/gi;

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function attrPair(name, value) {
  if (value == null || value === '') return '';
  return ` ${name}="${escapeAttr(value)}"`;
}

function stripAlbumMarkers(html) {
  return String(html || '')
    .replace(STAGING_MARKER_RE, '')
    .replace(TEMPLATE_MARKER_RE, '')
    .replace(/<div\b[^>]*data-rv-album-title-style\b[^>]*>\s*<\/div>/gi, '');
}

function parseAlbumTitleStyleMarker(html) {
  const match = String(html || '').match(/<div\b[^>]*data-rv-album-title-style\b[^>]*>\s*<\/div>/i);
  return match ? match[0] : '';
}

function parseAlbumOrientationFromHtml(html) {
  const match = String(html || '').match(/data-album-orientation=["'](portrait|landscape)["']/i);
  if (!match) return 'portrait';
  return String(match[1]).toLowerCase() === 'landscape' ? 'landscape' : 'portrait';
}

function parseAlbumPageWidthFromHtml(html) {
  const match = String(html || '').match(/data-album-page-width=["'](\d+)["']/i);
  if (!match) return 0;
  const n = Number(match[1]);
  return Number.isFinite(n) && n >= 200 ? Math.round(n) : 0;
}

function parseStagingMarker(html) {
  const match = String(html || '').match(/<div\b[^>]*data-rv-album-staging\b[^>]*>\s*<\/div>/i);
  return match ? match[0] : '';
}

function albumPageTopForIndex(pageIndex, pageHeight) {
  const idx = Math.max(0, Math.round(Number(pageIndex) || 0));
  const h = Math.max(1, Math.round(Number(pageHeight) || 1));
  return idx * (h + 24);
}

function templateBand(inst, pageWidthFallback = 480, orientation = 'portrait') {
  const w = inst?.w > 0 ? inst.w : pageWidthFallback;
  const h = inst?.h > 0 ? inst.h : albumTemplateBlockHeight(w, orientation);
  return {
    left: inst?.x || 0,
    top: inst?.y || 0,
    width: w,
    height: h
  };
}

function remapScalar(value, oldOrigin, oldSize, newOrigin, newSize) {
  if (value == null || !Number.isFinite(Number(value))) return value;
  const rel = (Number(value) - oldOrigin) / Math.max(1, oldSize);
  return Math.round(newOrigin + rel * newSize);
}

function remapSize(value, oldSize, newSize) {
  if (value == null || !Number.isFinite(Number(value))) return value;
  return Math.max(1, Math.round((Number(value) / Math.max(1, oldSize)) * newSize));
}

/** Remap framed/free photo attrs from oldBand → newBand. */
export function remapPhotoAttrsToBand(attrs, oldBand, newBand) {
  const next = { ...attrs };
  const hasFrame =
    next.frameLeft != null &&
    next.frameTop != null &&
    next.frameWidth != null &&
    next.frameHeight != null;
  if (hasFrame) {
    next.frameLeft = remapScalar(next.frameLeft, oldBand.left, oldBand.width, newBand.left, newBand.width);
    next.frameTop = remapScalar(next.frameTop, oldBand.top, oldBand.height, newBand.top, newBand.height);
    next.frameWidth = remapSize(next.frameWidth, oldBand.width, newBand.width);
    next.frameHeight = remapSize(next.frameHeight, oldBand.height, newBand.height);
  }
  if (next.posLeft != null) {
    next.posLeft = remapScalar(next.posLeft, oldBand.left, oldBand.width, newBand.left, newBand.width);
  }
  if (next.posTop != null) {
    next.posTop = remapScalar(next.posTop, oldBand.top, oldBand.height, newBand.top, newBand.height);
  }
  if (next.width != null) {
    next.width = remapSize(next.width, oldBand.width, newBand.width);
  }
  if (next.height != null) {
    next.height = remapSize(next.height, oldBand.height, newBand.height);
  }
  return next;
}

export function remapTextLabelAttrsToBand(attrs, oldBand, newBand) {
  const next = { ...attrs };
  if (next.posLeft != null) {
    next.posLeft = remapScalar(next.posLeft, oldBand.left, oldBand.width, newBand.left, newBand.width);
  }
  if (next.posTop != null) {
    next.posTop = remapScalar(next.posTop, oldBand.top, oldBand.height, newBand.top, newBand.height);
  }
  if (next.boxWidth != null) {
    next.boxWidth = remapSize(next.boxWidth, oldBand.width, newBand.width);
  }
  if (next.boxHeight != null) {
    next.boxHeight = remapSize(next.boxHeight, oldBand.height, newBand.height);
  }
  return next;
}

function attachmentAttrsToHtml(attrs) {
  return (
    `<div data-rv-attachment=""` +
    attrPair('data-attachment-id', attrs.attachmentId) +
    attrPair('data-file-name', attrs.fileName) +
    attrPair('data-file-extension', attrs.fileExtension) +
    attrPair('data-file-size', attrs.fileSizeBytes) +
    attrPair('data-checksum', attrs.checksum) +
    attrPair('data-width', attrs.width) +
    attrPair('data-height', attrs.height) +
    attrPair('data-pos-left', attrs.posLeft) +
    attrPair('data-pos-top', attrs.posTop) +
    attrPair('data-frame-left', attrs.frameLeft) +
    attrPair('data-frame-top', attrs.frameTop) +
    attrPair('data-frame-width', attrs.frameWidth) +
    attrPair('data-frame-height', attrs.frameHeight) +
    attrPair('data-pan-x', attrs.panX) +
    attrPair('data-pan-y', attrs.panY) +
    attrPair('data-slot-fit', attrs.slotFit) +
    `></div>`
  );
}

function textLabelAttrsToHtml(attrs) {
  const text = String(attrs.text || 'Text');
  return (
    `<div data-rv-text-label="" class="rv-text-label"` +
    attrPair('data-label-id', attrs.labelId) +
    attrPair('data-text', text) +
    attrPair('data-color', attrs.color) +
    attrPair('data-outline-color', attrs.outlineColor) +
    attrPair('data-outline-width', attrs.outlineWidth) +
    attrPair('data-font-size', attrs.fontSize) +
    attrPair('data-font-family', attrs.fontFamily) +
    attrPair('data-font-weight', attrs.fontWeight) +
    attrPair('data-rotation', attrs.rotationDeg) +
    attrPair('data-pos-left', attrs.posLeft) +
    attrPair('data-pos-top', attrs.posTop) +
    attrPair('data-box-width', attrs.boxWidth) +
    attrPair('data-box-height', attrs.boxHeight) +
    `>${escapeAttr(text)}</div>`
  );
}

function withUpdatedTemplates(html, instances, orientation, pageWidthPx) {
  const body = stripAlbumMarkers(html);
  const staging = parseStagingMarker(html);
  const titleStyle = parseAlbumTitleStyleMarker(html);
  const templateJson = serializeAlbumTemplateInstances(instances);
  const orient =
    String(orientation || '').toLowerCase() === 'landscape' ? 'landscape' : 'portrait';
  const pageW = Number(pageWidthPx);
  const pageWAttr =
    Number.isFinite(pageW) && pageW >= 200 ? ` data-album-page-width="${Math.round(pageW)}"` : '';
  const templateMarker = templateJson
    ? `<div data-rv-album-template="" data-album-templates="${templateJson}" data-album-orientation="${orient}"${pageWAttr} style="display:none"></div>`
    : `<div data-rv-album-template="" data-album-orientation="${orient}"${pageWAttr} style="display:none"></div>`;
  return `${templateMarker}${staging}${titleStyle}${body || '<p></p>'}`;
}

/**
 * Append a page snapshot into target note HTML. Returns updated HTML.
 * @param {string} targetHtml
 * @param {{ template: object, photos: object[], textLabels: object[], orientation?: string, pageWidth?: number }} snapshot
 */
export function appendAlbumPageSnapshotToHtml(targetHtml, snapshot) {
  const orient =
    String(snapshot?.orientation || parseAlbumOrientationFromHtml(targetHtml) || 'portrait').toLowerCase() ===
    'landscape'
      ? 'landscape'
      : 'portrait';
  const existing = parseAlbumTemplateInstancesFromHtml(targetHtml);
  const fromHtmlW = parseAlbumPageWidthFromHtml(targetHtml);
  const snapW = Math.round(Number(snapshot?.pageWidth) || 0);
  const templateW = Math.round(Number(snapshot?.template?.w) || 0);
  const pw = Math.max(200, fromHtmlW || snapW || templateW || 480);
  const blockH = albumTemplateBlockHeight(pw, orient);
  const oldBand = templateBand(snapshot.template, pw, orient);
  const insertAt = existing.length;
  const newInst = createAlbumTemplateInstance({
    id: snapshot.template?.id,
    x: 0,
    y: albumPageTopForIndex(insertAt, blockH),
    w: pw,
    h: blockH,
    slots: snapshot.template?.slots
  });
  const newBand = templateBand(newInst, pw, orient);
  const nextTemplates = [...existing, newInst];

  const photoHtml = (Array.isArray(snapshot.photos) ? snapshot.photos : [])
    .map((attrs) => attachmentAttrsToHtml(remapPhotoAttrsToBand(attrs, oldBand, newBand)))
    .join('');
  const labelHtml = (Array.isArray(snapshot.textLabels) ? snapshot.textLabels : [])
    .map((attrs) => {
      const remapped = remapTextLabelAttrsToBand(attrs, oldBand, newBand);
      remapped.labelId = `lbl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      return textLabelAttrsToHtml(remapped);
    })
    .join('');

  const body = stripAlbumMarkers(targetHtml);
  const mergedBody = `${body || '<p></p>'}${photoHtml}${labelHtml}`;
  const staging = parseStagingMarker(targetHtml);
  const titleStyle = parseAlbumTitleStyleMarker(targetHtml);
  const withBody = `${staging}${titleStyle}${mergedBody}`;
  return withUpdatedTemplates(withBody, nextTemplates, orient, pw);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    if (!blob) {
      reject(new Error('Empty blob'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Copy page photos onto the target note and remap attachment ids in the snapshot.
 */
export async function rematerializeAlbumPageAttachments({
  snapshot,
  sourceNoteId,
  targetNoteId,
  storageType
}) {
  const photos = Array.isArray(snapshot?.photos) ? snapshot.photos : [];
  const nextPhotos = [];
  for (const attrs of photos) {
    const oldId = Number(attrs?.attachmentId);
    if (!Number.isFinite(oldId) || oldId < 1) continue;
    const blob = await fetchPhotoAlbumsNoteAttachmentBlob(sourceNoteId, oldId, {
      inline: false,
      storageType
    });
    if (!blob) continue;
    const dataUrl = await blobToDataUrl(blob);
    const fileName =
      String(attrs.fileName || `page_photo_${oldId}`).trim() || `page_photo_${oldId}`;
    const uploaded = await uploadPhotoAlbumsNoteAttachment(
      targetNoteId,
      { file: dataUrl, file_name: fileName },
      { storageType }
    );
    const newId = Number(uploaded?.attachment_id ?? uploaded?.attachmentId);
    if (!Number.isFinite(newId) || newId < 1) continue;
    nextPhotos.push({
      ...attrs,
      attachmentId: newId,
      fileName: uploaded?.file_name || attrs.fileName || fileName,
      fileExtension: uploaded?.file_extension || attrs.fileExtension || '',
      fileSizeBytes: uploaded?.file_size_bytes ?? attrs.fileSizeBytes ?? null,
      checksum: uploaded?.checksum || attrs.checksum || null
    });
  }
  return {
    ...snapshot,
    photos: nextPhotos
  };
}

/**
 * Move one album page from the open source editor into another album note.
 *
 * @param {{
 *   snapshot: object,
 *   sourceNoteId: number,
 *   targetNoteId: number,
 *   storageType: string,
 *   removeFromSource: () => void,
 *   deleteSourceAttachmentIds?: number[],
 * }} opts
 */
export async function commitAlbumPageMoveToNote({
  snapshot,
  sourceNoteId,
  targetNoteId,
  storageType,
  removeFromSource,
  deleteSourceAttachmentIds = []
}) {
  const rematerialized = await rematerializeAlbumPageAttachments({
    snapshot,
    sourceNoteId,
    targetNoteId,
    storageType
  });

  const target = await fetchPhotoAlbumsNote(targetNoteId, { storageType });
  if (!target) throw new Error('Target album not found');
  const nextHtml = appendAlbumPageSnapshotToHtml(String(target.body_text || ''), rematerialized);
  await updatePhotoAlbumsNote(targetNoteId, { body_text: nextHtml }, { storageType });

  // Target saved first so a failure never loses the source page.
  removeFromSource?.();

  for (const attachmentId of deleteSourceAttachmentIds) {
    const id = Number(attachmentId);
    if (!Number.isFinite(id) || id < 1) continue;
    try {
      await deletePhotoAlbumsNoteAttachment(sourceNoteId, id, { storageType });
    } catch {
      // Source page nodes are already removed; orphan cleanup is best-effort.
    }
  }

  return { targetNoteId, photosMoved: rematerialized.photos.length };
}
