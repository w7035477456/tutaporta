/**
 * pillTemplate — pill-shaped action control (footer Support button proportions).
 * Default: theme secondary bg, primary text + border; HOVER_MAGNIFY_FACTOR label grow.
 */
import { buttonFontSizeHalfResponsive } from 'config/buttonFontEnv';
import { buttonHoverMagnifyFontSx, buttonHoverMagnifyTransitionSx } from 'config/hoverMagnifyEnv';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { PRIMARY_VAR, SECONDARY_VAR } from 'utils/themeConfig';

/** Use env HOVER_MAGNIFY_FACTOR; pass hoverScale={1} to disable. */
export const PILL_TEMPLATE_HOVER_SCALE = null;
export const PILL_TEMPLATE_BORDER_RADIUS = 9999;
export const PILL_TEMPLATE_TEXT = `var(${PRIMARY_VAR})`;
export const PILL_TEMPLATE_BG = `var(${SECONDARY_VAR})`;
export const PILL_TEMPLATE_BORDER = `1px solid var(${PRIMARY_VAR})`;
/** Matches footer Support `support.png` height (`2.75em` relative to pill font size). */
export const PILL_TEMPLATE_ICON_HEIGHT = '2.75em';

/** Vetted Friends send-flower pill background override. */
export const PILL_TEMPLATE_SEND_FLOWER_ORANGE_BG = '#F75B0B';

const menuButtonShadow =
  '0px 3px 1px -2px rgba(0,0,0,0.2), 0px 2px 2px 0px rgba(0,0,0,0.14), 0px 1px 5px 0px rgba(0,0,0,0.12)';

function pillHoverBlock(bg, text, border, hoverScale) {
  return {
    bgcolor: `${bg} !important`,
    color: `${text} !important`,
    WebkitTextFillColor: `${text} !important`,
    border: `${border} !important`,
    ...buttonHoverMagnifyFontSx({ baseFontSize: buttonFontSizeHalfResponsive, hoverScale }),
    '& .MuiButton-startIcon': { color: `${text} !important` },
    '& svg': { color: `${text} !important` }
  };
}

/** Icon inside a pill — same sizing as footer Support image. */
export function pillTemplateIconSx(overrides = {}) {
  return {
    display: 'block',
    height: PILL_TEMPLATE_ICON_HEIGHT,
    width: 'auto',
    maxWidth: { xs: 'min(21vw, 100px)', sm: 'none' },
    objectFit: 'contain',
    flexShrink: 0,
    ...overrides
  };
}

/** MUI ButtonBase / Button sx — pill template. */
export function pillTemplateSx({
  hoverScale = PILL_TEMPLATE_HOVER_SCALE,
  bg = PILL_TEMPLATE_BG,
  text = PILL_TEMPLATE_TEXT,
  border = PILL_TEMPLATE_BORDER,
  fullWidth = false,
  transformOrigin = 'center center'
} = {}) {
  return {
    fontFamily: MAIN_FONT_FAMILY,
    fontSize: buttonFontSizeHalfResponsive,
    fontWeight: 600,
    textTransform: 'none',
    lineHeight: 1.1,
    borderRadius: PILL_TEMPLATE_BORDER_RADIUS,
    boxShadow: menuButtonShadow,
    bgcolor: `${bg} !important`,
    color: `${text} !important`,
    WebkitTextFillColor: `${text} !important`,
    border: `${border} !important`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    gap: '0.35em',
    px: { xs: '0.65em', sm: '0.7em' },
    py: { xs: '0.3em', sm: '0.32em' },
    minWidth: 0,
    width: fullWidth ? '100%' : 'auto',
    transformOrigin,
    ...buttonHoverMagnifyTransitionSx,
    '& .MuiButton-startIcon': { color: `${text} !important`, margin: 0 },
    '& svg': { color: `${text} !important` },
    '@media (hover: hover)': {
      '&:hover:not(.Mui-disabled)': pillHoverBlock(bg, text, border, hoverScale)
    },
    '&.Mui-disabled': {
      opacity: 0.95,
      cursor: 'not-allowed'
    }
  };
}
