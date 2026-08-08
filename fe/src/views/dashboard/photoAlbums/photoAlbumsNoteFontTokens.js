/** Shared font/color tokens for Record Vault notes. */

const PHOTO_ALBUMS_FONT_COLORS = [
  '#000000',
  '#FFFFFF',
  '#FF0000',
  '#FFFF00',
  '#00AA00',
  '#FF8800',
  '#0000FF'
];

export const PHOTO_ALBUMS_FONT_STYLE_COUNT = PHOTO_ALBUMS_FONT_COLORS.length;

export const PHOTO_ALBUMS_BG_COLOR_COUNT = 7;

const PHOTO_ALBUMS_CONTENT_BG_COLORS = [
  '#000000',
  '#FFFFFF',
  '#FF0000',
  '#FFFF00',
  '#00AA00',
  '#FF8800',
  '#0000FF'
];

export const PHOTO_ALBUMS_FONT_SIZE_PT_OPTIONS = [
  10, 12, 14, 16, 18, 20, 24, 28, 32, 48, 64, 96, 128
];

export const PHOTO_ALBUMS_FONT_SIZE_PT_STEP = 1;
export const PHOTO_ALBUMS_FONT_SIZE_PT_MIN = 4;
export const PHOTO_ALBUMS_FONT_SIZE_PT_MAX =
  PHOTO_ALBUMS_FONT_SIZE_PT_OPTIONS[PHOTO_ALBUMS_FONT_SIZE_PT_OPTIONS.length - 1];

/** Font color swatch: 0 = black (matches user_customization.myphotoalbums_font_color_index). */
export const PHOTO_ALBUMS_DEFAULT_FONT_STYLE_INDEX = 0;
/** Note panel background: 1 = white (myphotoalbums_content_bg_index). NULL in DB → this default. */
export const PHOTO_ALBUMS_DEFAULT_CONTENT_BG_INDEX = 1;
/**
 * Text highlight / text-bg (myphotoalbums_text_highlight_index).
 * null = no highlight. Do not default to white — that painted a visible “input box” around typed text.
 */
export const PHOTO_ALBUMS_DEFAULT_TEXT_HIGHLIGHT_INDEX = null;
/** @deprecated use PHOTO_ALBUMS_DEFAULT_CONTENT_BG_INDEX */
export const PHOTO_ALBUMS_DEFAULT_BG_COLOR_INDEX = PHOTO_ALBUMS_DEFAULT_CONTENT_BG_INDEX;
/** Editor toolbar font size pt (myphotoalbums_editor_font_size_pt). NULL in DB → 20. */
export const PHOTO_ALBUMS_DEFAULT_FONT_SIZE_PT = 20;
/** Menu button size in tenths of rem (myphotoalbums_font_size). NULL in DB → 20 (= 2.0 rem). */
export const PHOTO_ALBUMS_DEFAULT_MENU_BUTTON_FONT_SIZE_TENTHS = 20;

export const PHOTO_ALBUMS_HIGHLIGHT_FONT_DROPDOWN_PT_PRESETS = [
  8, 10, 12, 16, 20, 26, 30, 36, 42, 50, 60, 70, 80
];

const HIGHLIGHT_FONT_DROPDOWN_PRESET_SET = new Set(PHOTO_ALBUMS_HIGHLIGHT_FONT_DROPDOWN_PT_PRESETS);

export function normalizePhotoAlbumsFontSizePt(value, fallback = PHOTO_ALBUMS_DEFAULT_FONT_SIZE_PT) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(PHOTO_ALBUMS_FONT_SIZE_PT_MIN, Math.round(n));
}

export function photoAlbumsHighlightFontDropdownValue(noteFontSizePt) {
  const pt = normalizePhotoAlbumsFontSizePt(noteFontSizePt);
  if (pt === PHOTO_ALBUMS_DEFAULT_FONT_SIZE_PT) return 'default';
  if (HIGHLIGHT_FONT_DROPDOWN_PRESET_SET.has(pt)) return String(pt);
  return 'custom';
}

export function photoAlbumsHighlightFontPtFromDropdown(value) {
  if (value === 'default') return PHOTO_ALBUMS_DEFAULT_FONT_SIZE_PT;
  const n = Number(value);
  if (Number.isFinite(n) && HIGHLIGHT_FONT_DROPDOWN_PRESET_SET.has(n)) return n;
  return null;
}

export function photoAlbumsHighlightFontDropdownLabel(noteFontSizePt) {
  const key = photoAlbumsHighlightFontDropdownValue(noteFontSizePt);
  if (key === 'default') return 'Default';
  if (key === 'custom') return '*';
  return key;
}

export function photoAlbumsFontStyleAt(index) {
  const i = Number(index);
  const len = PHOTO_ALBUMS_FONT_COLORS.length;
  const color = PHOTO_ALBUMS_FONT_COLORS[((i % len) + len) % len];
  return { color, fontWeight: 400 };
}

export function photoAlbumsBgColorAt(index) {
  const i = Number(index);
  if (!Number.isFinite(i) || i < 0 || i >= PHOTO_ALBUMS_BG_COLOR_COUNT) return null;
  return PHOTO_ALBUMS_CONTENT_BG_COLORS[i];
}

/**
 * Text-highlight color for note typing. Pure white is treated as “none” so notes
 * do not show a white box around (or instead of) body text.
 */
export function photoAlbumsTextHighlightColorAt(index) {
  const color = photoAlbumsBgColorAt(index);
  if (!color) return null;
  if (String(color).trim().toUpperCase() === '#FFFFFF') return null;
  return color;
}

export function photoAlbumsContentPanelBgColor(bgColorIndex) {
  const color = photoAlbumsBgColorAt(bgColorIndex);
  return color || 'var(--theme-daynight-color)';
}

export function photoAlbumsThemeDaynightShellSx(bgColorIndex) {
  const color = photoAlbumsBgColorAt(bgColorIndex);
  if (!color) {
    return { bgcolor: 'var(--theme-daynight-color)' };
  }
  return {
    bgcolor: color,
    '--theme-daynight-color': color
  };
}

export const PHOTO_ALBUMS_FONT_FAMILY_OPTIONS = [
  'Comic Neue, Comic Sans MS, cursive',
  'Inter, sans-serif',
  'Georgia, serif',
  'Courier New, monospace'
];

/** Fixed typeface for “Paste (text wo format)” context-menu paste. */
export const PHOTO_ALBUMS_UNFORMATTED_PASTE_FONT_FAMILY = 'Courier New, monospace';

export const PHOTO_ALBUMS_LINE_HEIGHT_OPTIONS = ['1', '1.25', '1.5', '1.75', '2'];
