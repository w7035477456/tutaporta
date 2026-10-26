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

/** @typedef {{ key: string, x: number, y: number, w: number, h: number }} AlbumPageInstance */

export function createAlbumPageInstance({ x = 0, y = 0, w = 0, h = 0, key = '' } = {}) {
  return {
    key: String(key || `pg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`),
    x: Math.max(0, Math.round(Number(x) || 0)),
    y: Math.max(0, Math.round(Number(y) || 0)),
    w: Math.max(0, Math.round(Number(w) || 0)),
    h: Math.max(0, Math.round(Number(h) || 0))
  };
}

function parseMarkerPxAttr(html, attr, min = 1) {
  const match = String(html || '').match(new RegExp(`${attr}=["'](\\d+)["']`, 'i'));
  if (!match) return 0;
  const n = Number(match[1]);
  return Number.isFinite(n) && n >= min ? Math.round(n) : 0;
}

/**
 * Read album pages from saved HTML (`data-album-templates` JSON, or the older
 * single-page `data-template-id` marker).
 * @returns {AlbumPageInstance[]}
 */
export function parseAlbumPageInstancesFromHtml(html) {
  const raw = String(html || '');
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
            createAlbumPageInstance({ key: item.key, x: item.x, y: item.y, w: item.w, h: item.h })
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
  const list = (Array.isArray(instances) ? instances : []).map((item) =>
    createAlbumPageInstance({ key: item?.key, x: item?.x, y: item?.y, w: item?.w, h: item?.h })
  );
  if (!list.length) return '';
  return JSON.stringify(list).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
