import { ERROR_VAR, YELLOW_VAR, isCoffeyThemeName } from 'utils/themeConfig';

/** Black text outline for "(Required)" / "(Optional)" suffix labels site-wide. */
export const REQUIRED_LABEL_TEXT_STROKE = '1px #000000';

export function buildRequiredLabelSuffixSx(themeName) {
  const color = isCoffeyThemeName(themeName) ? `var(${YELLOW_VAR})` : `var(${ERROR_VAR})`;
  return {
    color: `${color} !important`,
    WebkitTextFillColor: `${color} !important`,
    fontWeight: 700,
    WebkitTextStroke: REQUIRED_LABEL_TEXT_STROKE,
    paintOrder: 'stroke fill'
  };
}

/** Yellow + black stroke — legible on red/mauve ColorTemplate7 popup panels (IDV wizard). */
export const requiredLabelSuffixYellowSx = buildRequiredLabelSuffixSx('Coffey Dark');

/** Default (non-Coffey) — error red. Prefer useRequiredLabelSuffixSx() in React. */
export const requiredLabelSuffixSx = buildRequiredLabelSuffixSx(null);
