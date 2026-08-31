import { ERROR_VAR, isCoffeyThemeName } from 'utils/themeConfig';

/** Legible yellow on red/mauve popup panels — not `var(--theme-yellow-color)` (minimal palette maps that to secondary). */
export const REQUIRED_LABEL_HIGHLIGHT_YELLOW = '#FFEB3B';

/** Black text outline for "(Required)" / "(Optional)" suffix labels site-wide. */
export const REQUIRED_LABEL_TEXT_STROKE = '1px #000000';

export const REQUIRED_LABEL_TEXT_SHADOW =
  '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';

export function buildRequiredLabelSuffixSx(themeName) {
  const color = isCoffeyThemeName(themeName) ? REQUIRED_LABEL_HIGHLIGHT_YELLOW : `var(${ERROR_VAR})`;
  return {
    color: `${color} !important`,
    WebkitTextFillColor: `${color} !important`,
    fontWeight: 700,
    WebkitTextStroke: REQUIRED_LABEL_TEXT_STROKE,
    textShadow: REQUIRED_LABEL_TEXT_SHADOW,
    paintOrder: 'stroke fill'
  };
}

/** Yellow + black stroke — legible on red/mauve ColorTemplate7 popup panels (IDV wizard). */
export const requiredLabelSuffixYellowSx = buildRequiredLabelSuffixSx('Coffey Dark');

/** Default (non-Coffey) — error red. Prefer useRequiredLabelSuffixSx() in React. */
export const requiredLabelSuffixSx = buildRequiredLabelSuffixSx(null);
