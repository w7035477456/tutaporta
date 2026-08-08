/**
 * fe/.env HOVER_MAGNIFY_FACTOR (e.g. 1.25 = 25% larger label text on hover / when selected).
 * Requires vite envPrefix HOVER_ (see vite.config.mjs).
 */

const DEFAULT_HOVER_MAGNIFY_FACTOR = 1.25;
const MAX_HOVER_MAGNIFY_FACTOR = 2.5;

export function getHoverMagnifyFactor() {
  const parsed = Number(String(import.meta.env.HOVER_MAGNIFY_FACTOR ?? '').trim());
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_HOVER_MAGNIFY_FACTOR;
  return Math.min(parsed, MAX_HOVER_MAGNIFY_FACTOR);
}

/** `magnifyScale={1}` disables magnify; null/undefined uses env factor. */
export function resolveHoverMagnifyFactor(magnifyScale) {
  if (magnifyScale === 1 || magnifyScale === 0 || magnifyScale === false) return 1;
  if (Number.isFinite(Number(magnifyScale)) && Number(magnifyScale) > 1) return Number(magnifyScale);
  return getHoverMagnifyFactor();
}

/** @deprecated alias */
export function resolveMagnifyFactor(magnifyScale) {
  return resolveHoverMagnifyFactor(magnifyScale);
}

export function isHoverMagnifyActive(magnifyScale) {
  return resolveHoverMagnifyFactor(magnifyScale) > 1;
}

function responsiveFontCalcSx(baseFontSize, factor) {
  return {
    fontSize: `calc(${baseFontSize.xs} * ${factor}) !important`,
    '@media (min-width: 600px)': {
      fontSize: `calc(${baseFontSize.sm} * ${factor}) !important`
    }
  };
}

function percentFontMagnifySx(factor) {
  const pct = `${factor * 100}%`;
  return { fontSize: `${pct} !important` };
}

function labelMagnifyFromMagnify(magnify, baseFontSize) {
  return baseFontSize?.xs
    ? { ...responsiveFontCalcSx(baseFontSize, resolveHoverMagnifyFactor()), display: 'inline-block', lineHeight: 1.35 }
    : { ...percentFontMagnifySx(resolveHoverMagnifyFactor()), display: 'inline-block', lineHeight: 1.35 };
}

/**
 * Magnified label font sx (button box unchanged).
 * @param {{ baseFontSize?: { xs: string, sm: string }, magnifyScale?: number|null|boolean, hoverScale?: number|null|boolean }} [options]
 */
export function buttonMagnifyFontSx({ baseFontSize, magnifyScale, hoverScale } = {}) {
  const factor = resolveHoverMagnifyFactor(magnifyScale ?? hoverScale);
  if (factor <= 1) return {};

  const magnify = baseFontSize?.xs ? responsiveFontCalcSx(baseFontSize, factor) : percentFontMagnifySx(factor);

  const labelMagnify = baseFontSize?.xs
    ? { ...responsiveFontCalcSx(baseFontSize, factor), display: 'inline-block', lineHeight: 1.35 }
    : { ...percentFontMagnifySx(factor), display: 'inline-block', lineHeight: 1.35 };

  return {
    ...magnify,
    '& .MuiButton-label': labelMagnify,
    '& .MuiTypography-root': magnify,
    '& .MuiListItemText-primary': magnify,
    '& .MuiListItemText-root .MuiTypography-root': magnify
  };
}

/** Selected / clicked tab — keep label magnified until deselected. */
export function buttonSelectedMagnifyFontSx(options = {}) {
  return buttonMagnifyFontSx(options);
}

/**
 * MUI sx fragment for `&:hover` — magnifies button label text, not the button box.
 * @param {{ baseFontSize?: { xs: string, sm: string }, hoverScale?: number|null|boolean, magnifyScale?: number|null|boolean }} [options]
 */
export function buttonHoverMagnifyFontSx(options = {}) {
  return buttonMagnifyFontSx(options);
}

/**
 * Hover magnify for MUI Button — label/inner text only (root font-size unchanged so padding box stays put).
 */
export function buttonHoverMagnifyLabelOnlyFontSx(options = {}) {
  const labelFont = hoverMagnifyFontSizeSx(options);
  if (!Object.keys(labelFont).length) return {};
  const labelMagnify = {
    ...labelFont,
    display: 'inline-block',
    lineHeight: 1.2
  };
  return {
    '& .MuiButton-label': labelMagnify,
    '& .hover-magnify-label': labelMagnify
  };
}

/**
 * Standard template pair: magnify label on hover; when `selected`, keep magnified at rest.
 */
export function templateButtonMagnifySx({ baseFontSize, selected = false, magnifyScale, hoverScale } = {}) {
  const opts = { baseFontSize, magnifyScale: magnifyScale ?? hoverScale, hoverScale: magnifyScale ?? hoverScale };
  return {
    ...buttonHoverMagnifyTransitionSx,
    ...(selected ? buttonSelectedMagnifyFontSx(opts) : {}),
    '@media (hover: hover)': {
      '&:hover': buttonHoverMagnifyFontSx(opts)
    }
  };
}

/** `calc()` multiplier for a single font-size expression (e.g. delete “X”). */
export function hoverMagnifyCalcFontSize(baseExpr, magnifyScale) {
  const factor = resolveHoverMagnifyFactor(magnifyScale);
  if (factor <= 1) return baseExpr;
  return `calc(${baseExpr} * ${factor})`;
}

export const buttonHoverMagnifyTransitionSx = {
  transition:
    'font-size 0.15s ease, background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease, filter 0.15s ease, box-shadow 0.15s ease'
};

/** Font-size only (no nested selectors) — for labels inside hover targets. */
export function hoverMagnifyFontSizeSx({ baseFontSize, magnifyScale, hoverScale } = {}) {
  const factor = resolveHoverMagnifyFactor(magnifyScale ?? hoverScale);
  if (factor <= 1) return {};
  return baseFontSize?.xs
    ? responsiveFontCalcSx(baseFontSize, factor)
    : percentFontMagnifySx(factor);
}

/**
 * Magnify a nested label when the parent row/control is hovered (e.g. radio Approve/Deny).
 */
export function hoverMagnifyNestedLabelSx({
  baseFontSize,
  magnifyScale,
  hoverScale,
  labelSelector = '.MuiFormControlLabel-label'
} = {}) {
  const hoverFont = hoverMagnifyFontSizeSx({ baseFontSize, magnifyScale, hoverScale });
  if (!Object.keys(hoverFont).length) return {};
  return {
    ...buttonHoverMagnifyTransitionSx,
    '@media (hover: hover)': {
      [`&:hover:not(.Mui-disabled) ${labelSelector}`]: hoverFont
    }
  };
}

/**
 * Inline clickable text (`span` / `Typography`) — magnify font on hover when enabled.
 * Skips hover effect when `clickable` is false or `busy` is true.
 */
export function clickableTextHoverMagnifySx({
  baseFontSize,
  clickable = false,
  busy = false,
  magnifyScale,
  hoverScale
} = {}) {
  if (!clickable || busy) return {};
  const factor = resolveHoverMagnifyFactor(magnifyScale ?? hoverScale);
  if (factor <= 1) return {};

  const hoverFont = baseFontSize?.xs
    ? responsiveFontCalcSx(baseFontSize, factor)
    : percentFontMagnifySx(factor);

  return {
    ...buttonHoverMagnifyTransitionSx,
    '@media (hover: hover)': {
      '&:hover': hoverFont
    }
  };
}

/** Icon-only controls — grow SVG/text glyph size on hover (not the button box). */
export function iconButtonHoverMagnifySx(iconSize, magnifyScale) {
  const factor = resolveHoverMagnifyFactor(magnifyScale);
  if (factor <= 1) return {};
  const hoverSize = `calc(${iconSize} * ${factor})`;
  return {
    ...buttonHoverMagnifyTransitionSx,
    '@media (hover: hover)': {
      '&:hover:not(.Mui-disabled)': {
        fontSize: hoverSize,
        '& .MuiSvgIcon-root': {
          fontSize: hoverSize,
          width: hoverSize,
          height: hoverSize
        }
      }
    }
  };
}

/** Scale transform for non-button elements (e.g. profile photos on card hover). */
export function getHoverEnlargeTransform() {
  return `scale(${getHoverMagnifyFactor()})`;
}
