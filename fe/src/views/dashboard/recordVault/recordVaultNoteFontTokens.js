/** Shared font/color tokens for Record Vault notes. */

const RECORD_VAULT_FONT_COLORS = [
  '#000000',
  '#FFFFFF',
  '#FF0000',
  '#FFFF00',
  '#00AA00',
  '#FF8800',
  '#0000FF'
];

export const RECORD_VAULT_FONT_STYLE_COUNT = RECORD_VAULT_FONT_COLORS.length;

export const RECORD_VAULT_BG_COLOR_COUNT = 7;

const RECORD_VAULT_CONTENT_BG_COLORS = [
  '#000000',
  '#FFFFFF',
  '#FF0000',
  '#FFFF00',
  '#00AA00',
  '#FF8800',
  '#0000FF'
];

export const RECORD_VAULT_FONT_SIZE_PT_OPTIONS = [
  10, 12, 14, 16, 18, 20, 24, 28, 32, 48, 64, 96, 128
];

export const RECORD_VAULT_FONT_SIZE_PT_STEP = 1;
export const RECORD_VAULT_FONT_SIZE_PT_MIN = 4;
export const RECORD_VAULT_FONT_SIZE_PT_MAX =
  RECORD_VAULT_FONT_SIZE_PT_OPTIONS[RECORD_VAULT_FONT_SIZE_PT_OPTIONS.length - 1];

/** Font color swatch: 0 = black (matches user_customization.mynote_font_color_index). */
export const RECORD_VAULT_DEFAULT_FONT_STYLE_INDEX = 0;
/** Note panel background: 1 = theme daynight (mynote_content_bg_index). NULL in DB → this default. */
export const RECORD_VAULT_DEFAULT_CONTENT_BG_INDEX = 1;
/**
 * Text highlight / text-bg (mynote_text_highlight_index).
 * null = no highlight. Do not default to white — that painted a visible “input box” around typed text.
 */
export const RECORD_VAULT_DEFAULT_TEXT_HIGHLIGHT_INDEX = null;
/** @deprecated use RECORD_VAULT_DEFAULT_CONTENT_BG_INDEX */
export const RECORD_VAULT_DEFAULT_BG_COLOR_INDEX = RECORD_VAULT_DEFAULT_CONTENT_BG_INDEX;
/** Editor toolbar font size pt (mynote_editor_font_size_pt). NULL in DB → 20. */
export const RECORD_VAULT_DEFAULT_FONT_SIZE_PT = 20;
/** Menu button size in tenths of rem (mynote_font_size). NULL in DB → 20 (= 2.0 rem). */
export const RECORD_VAULT_DEFAULT_MENU_BUTTON_FONT_SIZE_TENTHS = 20;

export const RECORD_VAULT_HIGHLIGHT_FONT_DROPDOWN_PT_PRESETS = [
  8, 10, 12, 16, 20, 26, 30, 36, 42, 50, 60, 70, 80
];

const HIGHLIGHT_FONT_DROPDOWN_PRESET_SET = new Set(RECORD_VAULT_HIGHLIGHT_FONT_DROPDOWN_PT_PRESETS);

export function normalizeRecordVaultFontSizePt(value, fallback = RECORD_VAULT_DEFAULT_FONT_SIZE_PT) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(RECORD_VAULT_FONT_SIZE_PT_MIN, Math.round(n));
}

export function recordVaultHighlightFontDropdownValue(noteFontSizePt) {
  const pt = normalizeRecordVaultFontSizePt(noteFontSizePt);
  if (pt === RECORD_VAULT_DEFAULT_FONT_SIZE_PT) return 'default';
  if (HIGHLIGHT_FONT_DROPDOWN_PRESET_SET.has(pt)) return String(pt);
  return 'custom';
}

export function recordVaultHighlightFontPtFromDropdown(value) {
  if (value === 'default') return RECORD_VAULT_DEFAULT_FONT_SIZE_PT;
  const n = Number(value);
  if (Number.isFinite(n) && HIGHLIGHT_FONT_DROPDOWN_PRESET_SET.has(n)) return n;
  return null;
}

export function recordVaultHighlightFontDropdownLabel(noteFontSizePt) {
  const key = recordVaultHighlightFontDropdownValue(noteFontSizePt);
  if (key === 'default') return 'Default';
  if (key === 'custom') return '*';
  return key;
}

export function recordVaultFontStyleAt(index) {
  const i = Number(index);
  const len = RECORD_VAULT_FONT_COLORS.length;
  const color = RECORD_VAULT_FONT_COLORS[((i % len) + len) % len];
  return { color, fontWeight: 400 };
}

export function recordVaultBgColorAt(index) {
  const i = Number(index);
  if (!Number.isFinite(i) || i < 0 || i >= RECORD_VAULT_BG_COLOR_COUNT) return null;
  return RECORD_VAULT_CONTENT_BG_COLORS[i];
}

/**
 * Text-highlight color for note typing. Pure white is treated as “none” so notes
 * do not show a white box around (or instead of) body text.
 */
export function recordVaultTextHighlightColorAt(index) {
  const color = recordVaultBgColorAt(index);
  if (!color) return null;
  if (String(color).trim().toUpperCase() === '#FFFFFF') return null;
  return color;
}

export function recordVaultContentPanelBgColor(bgColorIndex) {
  const i = Number(bgColorIndex);
  if (
    !Number.isFinite(i) ||
    i < 0 ||
    i >= RECORD_VAULT_BG_COLOR_COUNT ||
    i === RECORD_VAULT_DEFAULT_CONTENT_BG_INDEX
  ) {
    return 'var(--theme-daynight-color)';
  }
  return RECORD_VAULT_CONTENT_BG_COLORS[i];
}

export function recordVaultThemeDaynightShellSx(bgColorIndex) {
  const bg = recordVaultContentPanelBgColor(bgColorIndex);
  if (bg === 'var(--theme-daynight-color)') {
    return {
      bgcolor: 'var(--theme-daynight-color)',
      color: 'var(--theme-inverse-daynight-color)'
    };
  }
  return {
    bgcolor: bg,
    '--theme-daynight-color': bg
  };
}

export const RECORD_VAULT_FONT_FAMILY_OPTIONS = [
  'Algerian, fantasy',
  'Inter, sans-serif',
  'Georgia, serif',
  'Courier New, monospace'
];

/** Fixed typeface for “Paste (text wo format)” context-menu paste. */
export const RECORD_VAULT_UNFORMATTED_PASTE_FONT_FAMILY = 'Courier New, monospace';

export const RECORD_VAULT_LINE_HEIGHT_OPTIONS = ['1', '1.25', '1.5', '1.75', '2'];
