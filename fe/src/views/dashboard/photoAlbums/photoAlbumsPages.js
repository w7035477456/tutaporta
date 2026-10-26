/**
 * Album page instances — one entry per book page (position + size in layout px).
 *
 * Saved albums keep pages in the hidden `data-rv-album-template` marker
 * (`data-album-templates` JSON); those attribute names are the persisted format
 * and must stay readable.
 */

/** Page aspect units: Portrait 10×12, Landscape 12×10. */
export const ALBUM_PAGE_ASPECT_PORTRAIT_W = 10;
export const ALBUM_PAGE_ASPECT_PORTRAIT_H = 12;
export const ALBUM_PAGE_ASPECT_LANDSCAPE_W = 12;
export const ALBUM_PAGE_ASPECT_LANDSCAPE_H = 10;

/** Pixel height of one album page for a page width + orientation. */
export function albumPageBlockHeight(pageWidth, orientation = 'portrait') {
  const pw = Math.max(240, Number(pageWidth) || 480);
  const mode = String(orientation || 'portrait').toLowerCase() === 'landscape' ? 'landscape' : 'portrait';
  const ratio =
    mode === 'landscape'
      ? ALBUM_PAGE_ASPECT_LANDSCAPE_H / ALBUM_PAGE_ASPECT_LANDSCAPE_W
      : ALBUM_PAGE_ASPECT_PORTRAIT_H / ALBUM_PAGE_ASPECT_PORTRAIT_W;
  return Math.max(mode === 'landscape' ? 280 : 360, Math.round(pw * ratio));
}

/** Most photos one album page shows (4 = 2×2 grid). */
export const ALBUM_PAGE_MAX_PHOTOS = 4;

/**
 * `attachmentIds`: thumbnail-tray photos shown on this page, top to bottom (album vault
 * attachments), at most `ALBUM_PAGE_MAX_PHOTOS`.
 * @typedef {{ key: string, x: number, y: number, w: number, h: number, attachmentIds: number[] }} AlbumPageInstance
 */

export function normalizeAlbumPageAttachmentId(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : null;
}

/** Unique valid photo ids, capped at `ALBUM_PAGE_MAX_PHOTOS`. */
export function normalizeAlbumPageAttachmentIds(values) {
  const ids = [];
  for (const value of Array.isArray(values) ? values : []) {
    const id = normalizeAlbumPageAttachmentId(value);
    if (id != null && !ids.includes(id)) ids.push(id);
    if (ids.length >= ALBUM_PAGE_MAX_PHOTOS) break;
  }
  return ids;
}

/** Photo ids on a page; also reads the single `attachmentId` of albums saved before multi-photo pages. */
export function albumPagePhotoIds(page) {
  if (Array.isArray(page?.attachmentIds)) return normalizeAlbumPageAttachmentIds(page.attachmentIds);
  const legacy = normalizeAlbumPageAttachmentId(page?.attachmentId);
  return legacy == null ? [] : [legacy];
}

export function createAlbumPageInstance({ x = 0, y = 0, w = 0, h = 0, key = '', ...photos } = {}) {
  return {
    key: String(key || `pg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`),
    x: Math.max(0, Math.round(Number(x) || 0)),
    y: Math.max(0, Math.round(Number(y) || 0)),
    w: Math.max(0, Math.round(Number(w) || 0)),
    h: Math.max(0, Math.round(Number(h) || 0)),
    attachmentIds: albumPagePhotoIds(photos)
  };
}

/**
 * Cells for `count` photos inside a frame: 1 fills it, 2–3 stack top to bottom, 4 is a 2×2 grid.
 * @returns {{ left: number, top: number, width: number, height: number }[]}
 */
export function albumPagePhotoCells(frame, count, gap = 8) {
  const n = Math.max(0, Math.min(ALBUM_PAGE_MAX_PHOTOS, Math.trunc(Number(count) || 0)));
  if (!n) return [];
  const { left, top, width, height } = frame;
  const cols = n === 4 ? 2 : 1;
  const rows = n === 4 ? 2 : n;
  const cellW = (width - gap * (cols - 1)) / cols;
  const cellH = (height - gap * (rows - 1)) / rows;
  return Array.from({ length: n }, (_, i) => ({
    left: Math.round(left + (i % cols) * (cellW + gap)),
    top: Math.round(top + Math.floor(i / cols) * (cellH + gap)),
    width: Math.round(cellW),
    height: Math.round(cellH)
  }));
}

function parseMarkerPxAttr(html, attr, min = 1) {
  const match = String(html || '').match(new RegExp(`${attr}=["'](\\d+)["']`, 'i'));
  if (!match) return 0;
  const n = Number(match[1]);
  return Number.isFinite(n) && n >= min ? Math.round(n) : 0;
}

/**
 * Read album pages from saved HTML (`data-album-templates` JSON, or the older
 * single-page `data-template-id` marker). Photos placed with the older
 * `data-rv-attachment` markup become one photo per page.
 * @returns {AlbumPageInstance[]}
 */
export function parseAlbumPageInstancesFromHtml(html) {
  const raw = String(html || '');
  return withLegacyPlacedPhotoPages(readAlbumPageMarker(raw), raw);
}

const LEGACY_PLACED_PHOTO_TAG_RE = /<div\b[^>]*\bdata-rv-attachment\b[^>]*>/gi;
const ALBUM_PAGE_ROW_GAP = 24;

/** Attachment ids of photos placed with the older `data-rv-attachment` markup, in document order. */
export function readLegacyPlacedPhotoAttachmentIds(html) {
  const ids = [];
  for (const tag of String(html || '').match(LEGACY_PLACED_PHOTO_TAG_RE) || []) {
    const match = tag.match(/data-attachment-id=["'](\d+)["']/i);
    const id = normalizeAlbumPageAttachmentId(match?.[1]);
    if (id != null && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * Albums saved before one-photo-per-page (e.g. the seeded SAMPLE ALBUM) only carry placed
 * photo markup. Put those photos on pages in order, adding spread pages as needed.
 */
function withLegacyPlacedPhotoPages(pages, raw) {
  if (pages.some((page) => page.attachmentIds.length)) return pages;
  const ids = readLegacyPlacedPhotoAttachmentIds(raw);
  if (!ids.length) return pages;

  const ordered = [...pages].sort((a, b) => a.y - b.y || a.x - b.x);
  const markerWidth = parseMarkerPxAttr(raw, 'data-album-page-width');
  const w = ordered[0]?.w || markerWidth || 480;
  const orientation = /data-album-orientation=["']landscape["']/i.test(raw) ? 'landscape' : 'portrait';
  const h = ordered[0]?.h || albumPageBlockHeight(w, orientation);
  const rightPage = ordered.find((page) => page.x > 0);
  const rightX = rightPage ? rightPage.x : w;

  const result = ordered.map((page, index) => ({
    ...page,
    attachmentIds: ids[index] != null ? [ids[index]] : []
  }));
  for (let index = ordered.length; index < ids.length; index += 1) {
    result.push(
      createAlbumPageInstance({
        x: index % 2 === 0 ? 0 : rightX,
        y: Math.floor(index / 2) * (h + ALBUM_PAGE_ROW_GAP),
        w,
        h,
        attachmentIds: [ids[index]]
      })
    );
  }
  return result;
}

function readAlbumPageMarker(raw) {
  const jsonMatch = raw.match(/data-album-templates=["']([^"']*)["']/i);
  if (jsonMatch) {
    try {
      const decoded = jsonMatch[1]
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
      const parsed = JSON.parse(decoded);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item && typeof item === 'object')
          .map((item) =>
            createAlbumPageInstance({
              key: item.key,
              x: item.x,
              y: item.y,
              w: item.w,
              h: item.h,
              attachmentIds: albumPagePhotoIds(item)
            })
          );
      }
    } catch {
      // fall through to the single-page marker
    }
  }

  if (!/data-rv-album-template[^>]*data-template-id=|data-template-id=[^>]*data-rv-album-template/i.test(raw)) {
    return [];
  }
  return [
    createAlbumPageInstance({
      x: parseMarkerPxAttr(raw, 'data-template-x', 0),
      y: parseMarkerPxAttr(raw, 'data-template-y', 0),
      w: parseMarkerPxAttr(raw, 'data-template-w'),
      h: parseMarkerPxAttr(raw, 'data-template-h')
    })
  ];
}

/** Serialize album pages for the hidden marker attribute. */
export function serializeAlbumPageInstances(instances) {
  const list = (Array.isArray(instances) ? instances : []).map((item) => {
    const page = createAlbumPageInstance({
      key: item?.key,
      x: item?.x,
      y: item?.y,
      w: item?.w,
      h: item?.h,
      attachmentIds: albumPagePhotoIds(item)
    });
    if (!page.attachmentIds.length) delete page.attachmentIds;
    return page;
  });
  if (!list.length) return '';
  return JSON.stringify(list).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
