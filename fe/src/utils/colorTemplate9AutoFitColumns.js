import { getDesktopButtonFontSizeVw, getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import { ENV_MAIN_FONT_FAMILY } from 'config/mainFontEnv';

/** Matches ColorTemplate9 cell px (1.25) + borders + small buffer. */
export const COLOR_TEMPLATE9_AUTO_FIT_CELL_PADDING_PX = 28;
export const COLOR_TEMPLATE9_AUTO_FIT_TEXT_BUFFER_PX = 12;

/** ColorTemplate9TableData.Button — px:2 horizontal + border/shadow slack. */
export const COLOR_TEMPLATE9_AUTO_FIT_BUTTON_CHROME_PX = 36;
/** SelectedButtonTemplate — fit-label border + horizontal padding slack. */
export const COLOR_TEMPLATE9_AUTO_FIT_SELECTED_BUTTON_CHROME_PX = 40;

/**
 * Canvas cannot resolve CSS `var(--main-font-family, …)`. Use the concrete env stack
 * so auto-fit widths match rendered ColorTemplate9 text.
 */
const AUTO_FIT_CANVAS_FONT_FAMILY = ENV_MAIN_FONT_FAMILY;

function vwToPx(vwString, viewportWidth) {
  const m = String(vwString)
    .trim()
    .match(/^([\d.]+)\s*vw$/i);
  if (!m) return (1.5 / 100) * viewportWidth;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return (1.5 / 100) * viewportWidth;
  return (n / 100) * viewportWidth;
}

/**
 * Cap a string for width measurement / cell display (e.g. first 30 characters).
 * @param {unknown} raw
 * @param {number} [maxChars]
 */
export function truncateColorTemplate9AutoFitText(raw, maxChars) {
  const text = String(raw ?? '');
  const limit = Math.trunc(Number(maxChars));
  if (!Number.isFinite(limit) || limit <= 0 || text.length <= limit) return text;
  return text.slice(0, limit);
}

/**
 * @param {string[]} texts
 * @param {number} fontSizePx
 * @param {number} [fontWeight]
 * @param {number} [maxChars] — measure only the first N characters of each string
 */
export function measureColorTemplate9TextsMaxWidthPx(texts, fontSizePx, fontWeight = 400, maxChars = 0) {
  if (typeof document === 'undefined') return 0;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  const size = Math.max(1, Number(fontSizePx) || 12);
  ctx.font = `${fontWeight} ${size}px ${AUTO_FIT_CANVAS_FONT_FAMILY}`;
  let max = 0;
  for (const raw of texts) {
    const full = String(raw ?? '').trim() || '—';
    const t = truncateColorTemplate9AutoFitText(full, maxChars) || '—';
    max = Math.max(max, ctx.measureText(t).width);
  }
  return max;
}

/**
 * Full in-cell button width (label + horizontal chrome). Uses DESKTOP_FONT_SIZE_BUTTON at sm+.
 *
 * @param {string} label
 * @param {number} buttonFontSizePx
 * @param {{ variant?: 'colorTemplate9' | 'selected', minWidthPx?: number, maxChars?: number }} [opts]
 */
export function measureColorTemplate9InCellButtonWidthPx(label, buttonFontSizePx, opts = {}) {
  const { variant = 'colorTemplate9', minWidthPx = 0, maxChars = 0 } = opts;
  const fontWeight = variant === 'selected' ? 600 : 700;
  const chromePx =
    variant === 'selected'
      ? COLOR_TEMPLATE9_AUTO_FIT_SELECTED_BUTTON_CHROME_PX
      : COLOR_TEMPLATE9_AUTO_FIT_BUTTON_CHROME_PX;
  const textWidth = measureColorTemplate9TextsMaxWidthPx([label], buttonFontSizePx, fontWeight, maxChars);
  const contentWidth = textWidth + chromePx + COLOR_TEMPLATE9_AUTO_FIT_TEXT_BUFFER_PX;
  return Math.max(Math.trunc(minWidthPx) || 0, Math.ceil(contentWidth));
}

/**
 * @typedef {object} ColorTemplate9AutoFitColumnButtons
 * @property {string[]} labels — button labels to measure (include busy/alternate states)
 * @property {'colorTemplate9' | 'selected'} [variant]
 * @property {number} [minWidthPx] — sx minWidth on the rendered button
 * @property {string[]} [companionTexts] — text rendered beside the button in the same cell
 * @property {number} [companionGapPx] — gap between companion text and button
 */

/**
 * @param {ColorTemplate9AutoFitColumnButtons | null | undefined} spec
 * @param {number} buttonFontSizePx
 * @param {number} [maxChars]
 */
export function measureColorTemplate9ColumnButtonsMaxWidthPx(spec, buttonFontSizePx, maxChars = 0) {
  if (!spec?.labels?.length) return 0;
  const { labels, variant = 'colorTemplate9', minWidthPx = 0, companionTexts = [], companionGapPx = 0 } = spec;
  const gap = Math.max(0, Math.trunc(companionGapPx) || 0);
  let max = 0;

  for (let i = 0; i < labels.length; i += 1) {
    const buttonWidth = measureColorTemplate9InCellButtonWidthPx(labels[i], buttonFontSizePx, {
      variant,
      minWidthPx,
      maxChars
    });
    const companion = companionTexts[i] ?? companionTexts[0] ?? '';
    const companionWidth = companion
      ? measureColorTemplate9TextsMaxWidthPx([companion], buttonFontSizePx, 400, maxChars)
      : 0;
    max = Math.max(max, buttonWidth + (companion ? companionWidth + gap : 0));
  }

  if (companionTexts.length > labels.length) {
    for (const companion of companionTexts) {
      const companionWidth = measureColorTemplate9TextsMaxWidthPx([companion], buttonFontSizePx, 400, maxChars);
      const buttonWidth = measureColorTemplate9InCellButtonWidthPx(labels[0] ?? '', buttonFontSizePx, {
        variant,
        minWidthPx,
        maxChars
      });
      max = Math.max(max, companionWidth + gap + buttonWidth);
    }
  }

  return max;
}

/**
 * Per-column max content width → pixel column widths for ColorTemplate9 grid tables.
 *
 * @param {object} opts
 * @param {string[][]} opts.columnTexts — one string[] per column (header + body values)
 * @param {(ColorTemplate9AutoFitColumnButtons | null | undefined)[]} [opts.columnButtons] — in-cell buttons per column
 * @param {number[]} [opts.minWidthsPx]
 * @param {number[]} [opts.extraWidthsPx] — additional slack beyond measured text/buttons
 * @param {number} [opts.viewportWidth]
 * @param {number} [opts.cellPaddingPx]
 * @param {number} [opts.maxMeasureChars] — size columns to the first N characters (0 = full string)
 */
export function computeColorTemplate9AutoFitColumnWidthsPx({
  columnTexts,
  columnButtons = [],
  minWidthsPx = [],
  extraWidthsPx = [],
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024,
  cellPaddingPx = COLOR_TEMPLATE9_AUTO_FIT_CELL_PADDING_PX,
  maxMeasureChars = 0
}) {
  const vw = Math.max(320, Math.min(viewportWidth || 1024, 4096));
  const textFontSizePx = vwToPx(getDesktopTextFontSizeVw(), vw);
  const buttonFontSizePx = vwToPx(getDesktopButtonFontSizeVw(), vw);
  const maxChars = Math.max(0, Math.trunc(Number(maxMeasureChars) || 0));

  return (columnTexts || []).map((texts, index) => {
    const min = Math.max(0, Math.trunc(Number(minWidthsPx[index]) || 0)) || 48;
    const extra = Math.max(0, Math.trunc(Number(extraWidthsPx[index]) || 0));
    const regular = measureColorTemplate9TextsMaxWidthPx(texts, textFontSizePx, 400, maxChars);
    const bold = measureColorTemplate9TextsMaxWidthPx(texts, textFontSizePx, 700, maxChars);
    const textWidth = Math.max(regular, bold);
    const buttonWidth = measureColorTemplate9ColumnButtonsMaxWidthPx(
      columnButtons[index],
      buttonFontSizePx,
      maxChars
    );
    const contentWidth = Math.max(textWidth, buttonWidth);
    return Math.max(
      min,
      Math.ceil(contentWidth + cellPaddingPx + COLOR_TEMPLATE9_AUTO_FIT_TEXT_BUFFER_PX + extra)
    );
  });
}

export function buildColorTemplate9AutoFitGridTemplateColumns(widthsPx) {
  const desktop = (widthsPx || []).map((width) => `${Math.max(0, Math.trunc(width))}px`).join(' ');
  return {
    xs: '36px 1fr',
    sm: desktop
  };
}

export function sumColorTemplate9AutoFitColumnWidths(widthsPx) {
  return (widthsPx || []).reduce((total, width) => total + Math.max(0, Number(width) || 0), 0);
}
