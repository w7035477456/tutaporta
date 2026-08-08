import { PLACE_TEXT_DEFAULTS } from './PhotoAlbumsPlaceTextDialog';

/** Hidden HTML marker for album-wide page-title style (shared across every page). */
export const ALBUM_TITLE_STYLE_MARKER_RE =
  /<div\b[^>]*data-rv-album-title-style\b[^>]*>\s*<\/div>/gi;

export const DEFAULT_ALBUM_TITLE_STYLE = {
  color: PLACE_TEXT_DEFAULTS.color,
  outlineColor: PLACE_TEXT_DEFAULTS.outlineColor,
  outlineWidth: PLACE_TEXT_DEFAULTS.outlineWidth,
  fontSize: Math.max(18, Math.round(Number(PLACE_TEXT_DEFAULTS.fontSize) || 28)),
  fontFamily: PLACE_TEXT_DEFAULTS.fontFamily,
  fontWeight: PLACE_TEXT_DEFAULTS.fontWeight
};

function normalizeAlbumTitleStyle(raw) {
  const base = { ...DEFAULT_ALBUM_TITLE_STYLE, ...(raw && typeof raw === 'object' ? raw : {}) };
  return {
    color: String(base.color || DEFAULT_ALBUM_TITLE_STYLE.color),
    outlineColor: String(base.outlineColor || DEFAULT_ALBUM_TITLE_STYLE.outlineColor),
    outlineWidth: Math.max(
      0,
      Math.round((Number(base.outlineWidth) || DEFAULT_ALBUM_TITLE_STYLE.outlineWidth) * 10) / 10
    ),
    fontSize: Math.max(
      10,
      Math.round(Number(base.fontSize) || DEFAULT_ALBUM_TITLE_STYLE.fontSize)
    ),
    fontFamily: String(base.fontFamily || DEFAULT_ALBUM_TITLE_STYLE.fontFamily),
    fontWeight: Number(base.fontWeight) || DEFAULT_ALBUM_TITLE_STYLE.fontWeight
  };
}

export function parseAlbumTitleStyleFromHtml(html) {
  const match = String(html || '').match(/data-title-style-json=["']([^"']*)["']/i);
  if (!match) return { ...DEFAULT_ALBUM_TITLE_STYLE };
  try {
    const decoded = match[1]
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
    return normalizeAlbumTitleStyle(JSON.parse(decoded));
  } catch {
    return { ...DEFAULT_ALBUM_TITLE_STYLE };
  }
}

export function serializeAlbumTitleStyle(style) {
  const normalized = normalizeAlbumTitleStyle(style);
  return JSON.stringify(normalized).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export function stripAlbumTitleStyleMarker(html) {
  return String(html || '').replace(ALBUM_TITLE_STYLE_MARKER_RE, '');
}

export function albumTitleStyleMarkerHtml(style) {
  const json = serializeAlbumTitleStyle(style);
  return `<div data-rv-album-title-style="" data-title-style-json="${json}" style="display:none"></div>`;
}

/** Two-line footer: album title row + page count row (see `formatAlbumPageTitleLines`). */
export const ALBUM_PAGE_TITLE_LINE_COUNT = 2;
export const ALBUM_PAGE_TITLE_BAND_MIN_PX = 72;

/** Fixed styling for the "Page N of M" footer row. */
export const ALBUM_PAGE_COUNT_LINE_STYLE = {
  fontFamily: 'Algerian, fantasy',
  color: '#ffffff',
  WebkitTextFillColor: '#ffffff',
  WebkitTextStroke: '1px #000000',
  paintOrder: 'stroke fill',
  fontWeight: 400
};

/** Reserved white band under the page template for the two-line album title footer. */
export function albumPageTitleBandHeightPx(style) {
  const normalized = normalizeAlbumTitleStyle(style || DEFAULT_ALBUM_TITLE_STYLE);
  const fs = normalized.fontSize;
  const lineHeight = 1.2;
  const pad = 10;
  return Math.max(
    ALBUM_PAGE_TITLE_BAND_MIN_PX,
    Math.ceil(fs * lineHeight * ALBUM_PAGE_TITLE_LINE_COUNT + pad)
  );
}

/** Date suffix patterns at end of album note names (longest / most specific first). */
const ALBUM_TITLE_DATE_SUFFIX_PATTERNS = [
  /\s+(\d{1,2}\/\d{1,2}-\d{1,2}\/\d{1,2}\s+\d{4})\s*$/,
  /\s+(\d{1,2}\/\d{1,2}\/\d{4}\s*-\s*\d{1,2}\/\d{1,2}\/\d{4})\s*$/,
  /\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\s*$/i,
  /\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}(?:\s*-\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})?)\s*$/i,
  /\s+(\d{1,2}\/\d{1,2}\/\d{4})\s*$/,
  /\s+(\d{4})\s*$/
];

/** Split note title into display name + trailing date phrase. */
export function parseAlbumTitleNameAndDates(rawTitle) {
  const plain = String(rawTitle || '').trim();
  if (!plain) return { name: '', dates: '' };

  for (const pattern of ALBUM_TITLE_DATE_SUFFIX_PATTERNS) {
    const match = plain.match(pattern);
    if (!match) continue;
    const dates = String(match[1] || '').trim();
    const name = plain.slice(0, match.index).trim();
    if (name) return { name, dates };
  }

  return { name: plain, dates: '' };
}

/**
 * Two-line page footer: line 1 = "Album: {name} {dates}", line 2 = "Page N of M".
 * @returns {{ titleLine: string, pageLine: string, ariaLabel: string }}
 */
export function formatAlbumPageTitleLines(rawTitle, pageIndex, pageCount) {
  const { name, dates } = parseAlbumTitleNameAndDates(rawTitle);
  const total = Math.max(1, Math.round(Number(pageCount) || 1));
  const pageNum = Math.min(Math.max(1, Math.round(Number(pageIndex) || 0) + 1), total);
  const pageLine = `Page ${pageNum} of ${total}`;
  const titleLine = name
    ? dates
      ? `Album: ${name} ${dates}`
      : `Album: ${name}`
    : dates
      ? `Album ${dates}`
      : 'Album';
  return {
    titleLine,
    pageLine,
    ariaLabel: `${titleLine}, ${pageLine}`
  };
}

/** Sidebar album button — line 1 = title, line 2 = dates (blank when none). */
export function formatPhotoAlbumsSidebarAlbumLines(rawTitle) {
  const plain = String(rawTitle || '').trim();
  if (!plain) {
    return { titleLine: '', datesLine: '\u00a0' };
  }
  const { name, dates } = parseAlbumTitleNameAndDates(plain);
  return {
    titleLine: name || plain,
    datesLine: dates || '\u00a0'
  };
}
