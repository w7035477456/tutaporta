import { PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME } from './photoAlbumsTextLabelNode';

function normalizeTerms(terms) {
  if (!Array.isArray(terms)) return [];
  return Array.from(
    new Set(
      terms
        .map((t) => String(t ?? '').trim().toLowerCase())
        .filter((t) => t.length > 0)
    )
  );
}

function textMatchesAnyTerm(text, terms) {
  const lc = String(text || '').toLowerCase();
  if (!lc || !terms.length) return false;
  return terms.some((term) => lc.includes(term));
}

function parseOptionalPx(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function albumPageBand(inst, pageWidthFallback = 480) {
  const w = inst?.w > 0 ? inst.w : pageWidthFallback;
  const h = inst?.h > 0 ? inst.h : Math.round(w * 1.2);
  return {
    left: inst?.x || 0,
    top: inst?.y || 0,
    width: w,
    height: h
  };
}

function pointInBand(cx, cy, band) {
  return (
    cx >= band.left &&
    cx <= band.left + band.width &&
    cy >= band.top &&
    cy <= band.top + band.height
  );
}

/**
 * Find album page indexes (0-based, book order) that contain any search term
 * in on-page text labels.
 *
 * @returns {number[]} sorted unique page indexes
 */
export function findAlbumPagesMatchingSearchTerms(editor, pages, pageWidth, terms) {
  const lowered = normalizeTerms(terms);
  const list = Array.isArray(pages) ? pages : [];
  if (!lowered.length || !list.length || !editor?.state?.doc) return [];

  const pw = Math.max(200, Math.round(Number(pageWidth) || 480));
  const bands = list.map((inst) => albumPageBand(inst, pw));
  const hits = new Set();

  editor.state.doc.descendants((node) => {
    if (node.type.name === PHOTO_ALBUMS_TEXT_LABEL_NODE_NAME) {
      const labelText = String(node.attrs?.text || '');
      if (!textMatchesAnyTerm(labelText, lowered)) return;
      const left = parseOptionalPx(node.attrs?.posLeft) ?? 0;
      const top = parseOptionalPx(node.attrs?.posTop) ?? 0;
      const w = parseOptionalPx(node.attrs?.boxWidth) ?? 40;
      const h = parseOptionalPx(node.attrs?.boxHeight) ?? 40;
      const cx = left + w / 2;
      const cy = top + h / 2;
      bands.forEach((band, pageIndex) => {
        if (pointInBand(cx, cy, band)) hits.add(pageIndex);
      });
    }
  });

  return Array.from(hits).sort((a, b) => a - b);
}
