/**
 * ColorTemplate12Underline — underlined inverse-daynight text link.
 * Color + underline: --theme-inverse-daynight-color.
 * Hover: label magnifies per fe/.env HOVER_MAGNIFY_FACTOR.
 */
import { getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTextFontSizeVw } from 'config/singlesMemberCardFontEnv';
import { clickableTextHoverMagnifySx } from 'config/hoverMagnifyEnv';
import { INVERSE_DAYNIGHT_VAR } from 'utils/themeConfig';

export const COLOR_TEMPLATE12_UNDERLINE_TEXT = `var(${INVERSE_DAYNIGHT_VAR})`;

const colorTemplate12UnderlineFontSize = {
  xs: getMobileSinglesTextFontSizeVw(),
  sm: getDesktopTextFontSizeVw()
};

/** MUI Link / button-as-link sx for ColorTemplate12Underline. */
export function colorTemplate12UnderlineSx(overrides = {}) {
  return {
    color: COLOR_TEMPLATE12_UNDERLINE_TEXT,
    WebkitTextFillColor: COLOR_TEMPLATE12_UNDERLINE_TEXT,
    textDecorationColor: COLOR_TEMPLATE12_UNDERLINE_TEXT,
    fontSize: colorTemplate12UnderlineFontSize,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    bgcolor: 'transparent',
    p: 0,
    textAlign: 'right',
    whiteSpace: 'nowrap',
    ...clickableTextHoverMagnifySx({
      baseFontSize: colorTemplate12UnderlineFontSize,
      clickable: true
    }),
    ...overrides
  };
}
