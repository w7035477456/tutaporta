/**
 * Helpers to move one album page (template + text labels) into another album note.
 */
import {
  albumTemplateBlockHeight,
  createAlbumTemplateInstance,
  parseAlbumTemplateInstancesFromHtml,
  serializeAlbumTemplateInstances
} from './photoAlbumsPageTemplates';
import { updatePhotoAlbumsNote, fetchPhotoAlbumsNote } from 'api/photoAlbumsFe';
import { stripLegacyAlbumPhotoMarkup } from './photoAlbumsLegacyPhotoMarkup';

const TEMPLATE_MARKER_RE = /<div\b[^>]*data-rv-album-template\b[^>]*>\s*<\/div>/gi;

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
  return stripLegacyAlbumPhotoMarkup(String(html || ''))
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
  return `${templateMarker}${titleStyle}${body || '<p></p>'}`;
}

/**
 * Append a page snapshot into target note HTML. Returns updated HTML.
 * @param {string} targetHtml
 * @param {{ template: object, textLabels: object[], orientation?: string, pageWidth?: number }} snapshot
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

  const labelHtml = (Array.isArray(snapshot.textLabels) ? snapshot.textLabels : [])
    .map((attrs) => {
      const remapped = remapTextLabelAttrsToBand(attrs, oldBand, newBand);
      remapped.labelId = `lbl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      return textLabelAttrsToHtml(remapped);
    })
    .join('');

  const body = stripAlbumMarkers(targetHtml);
  const titleStyle = parseAlbumTitleStyleMarker(targetHtml);
  const withBody = `${titleStyle}${body || '<p></p>'}${labelHtml}`;
  return withUpdatedTemplates(withBody, nextTemplates, orient, pw);
}

/**
 * Move one album page from the open source editor into another album note.
 * Target is saved before the source page is removed, so a failure never loses the page.
 *
 * @param {{
 *   snapshot: object,
 *   targetNoteId: number,
 *   storageType: string,
 *   removeFromSource: () => void
 * }} opts
 */
export async function commitAlbumPageMoveToNote({
  snapshot,
  targetNoteId,
  storageType,
  removeFromSource
}) {
  const target = await fetchPhotoAlbumsNote(targetNoteId, { storageType });
  if (!target) throw new Error('Target album not found');
  const nextHtml = appendAlbumPageSnapshotToHtml(String(target.body_text || ''), snapshot);
  await updatePhotoAlbumsNote(targetNoteId, { body_text: nextHtml }, { storageType });
  removeFromSource?.();
  return { targetNoteId };
}
