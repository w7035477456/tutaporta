/**
 * GreenButton — UnSelectedButtonTemplate with BSIZE label, green/grey states, black border + text.
 * fe/.env BSIZE (sm+) / MOBILE_FONT_SIZE_BUTTON (xs) for default label size.
 */
import { bsizeFontSizeResponsive } from 'config/bsizeEnv';
import { buttonHoverMagnifyTransitionSx } from 'config/hoverMagnifyEnv';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import {
  buttonTemplateSingleLineLabelSx,
  SELECTED_UNSELECTED_BUTTON_BORDER_RADIUS
} from 'config/selectedUnselectedButtonTemplate';

/** Full Paletes green; Minimal Palete remaps via themeConfig `--theme-action-green-color`. */
export const GREEN_BUTTON_ENABLED_BG = 'var(--theme-action-green-color, #60C446)';
export const GREEN_BUTTON_DISABLED_BG = '#737373';
export const GREEN_BUTTON_TEXT = '#000000';
export const GREEN_BUTTON_BORDER = '1px solid #000000';
/** Whole-button hover scale — 25% larger. */
export const GREEN_BUTTON_HOVER_SCALE = 1.25;
/** Raised on hover so scaled button draws above adjacent buttons/UI. */
export const GREEN_BUTTON_HOVER_Z_INDEX = 9999;

const menuButtonShadow =
  '0px 3px 1px -2px rgba(0,0,0,0.2), 0px 2px 2px 0px rgba(0,0,0,0.14), 0px 1px 5px 0px rgba(0,0,0,0.12)';

/** Label font — fe/.env BSIZE (sm+) / MOBILE_FONT_SIZE_BUTTON (xs). */
export function greenButtonFontSizeSx(overrides = {}) {
  const full = bsizeFontSizeResponsive;
  const fullFontSx = {
    fontSize: `${full.xs} !important`,
    '@media (min-width: 600px)': {
      fontSize: `${full.sm} !important`
    }
  };
  return {
    ...fullFontSx,
    '&.MuiButton-root': { ...fullFontSx },
    '&.MuiButton-sizeSmall': { ...fullFontSx },
    '& .MuiButton-label': { ...fullFontSx },
    ...overrides
  };
}

/**
 * Hover scale + topmost z-index — use on GreenButton overrides that replace default hover styles.
 * @param {Record<string, unknown>} [hoverOverrides]
 * @param {{ hoverScale?: number, zIndex?: number, transformOrigin?: string }} [options]
 */
export function greenButtonHoverScaleRaiseSx(hoverOverrides = {}, options = {}) {
  const hoverScale = options.hoverScale ?? GREEN_BUTTON_HOVER_SCALE;
  const zIndex = options.zIndex ?? GREEN_BUTTON_HOVER_Z_INDEX;
  const transformOrigin = options.transformOrigin ?? 'center center';
  return {
    transformOrigin,
    '@media (hover: hover)': {
      '&:hover:not(.Mui-disabled)': {
        position: 'relative',
        zIndex,
        transform: `scale(${hoverScale})`,
        ...hoverOverrides
      }
    }
  };
}

/** @returns {import('@mui/material').SxProps} */
export function greenButtonSx({ hoverTopmost = true } = {}) {
  return {
    fontFamily: MAIN_FONT_FAMILY,
    ...greenButtonFontSizeSx(),
    fontWeight: 600,
    textTransform: 'none',
    lineHeight: 1.35,
    borderRadius: SELECTED_UNSELECTED_BUTTON_BORDER_RADIUS,
    boxShadow: menuButtonShadow,
    bgcolor: `${GREEN_BUTTON_ENABLED_BG} !important`,
    color: `${GREEN_BUTTON_TEXT} !important`,
    WebkitTextFillColor: `${GREEN_BUTTON_TEXT} !important`,
    border: `${GREEN_BUTTON_BORDER} !important`,
    transformOrigin: 'center center',
    transform: 'scale(1)',
    transition: `${buttonHoverMagnifyTransitionSx.transition}, transform 0.15s ease`,
    ...buttonTemplateSingleLineLabelSx(),
    px: { xs: 1.25, sm: 1.75 },
    py: { xs: 0.75, sm: 0.875 },
    '& .MuiButton-startIcon': { color: `${GREEN_BUTTON_TEXT} !important` },
    '& svg': { color: `${GREEN_BUTTON_TEXT} !important` },
    '& img': {
      opacity: '1 !important',
      filter: 'none !important',
      WebkitFilter: 'none !important',
      flexShrink: 0
    },
    '@media (hover: hover)': {
      '&:hover:not(.Mui-disabled)': {
        bgcolor: `${GREEN_BUTTON_ENABLED_BG} !important`,
        color: `${GREEN_BUTTON_TEXT} !important`,
        WebkitTextFillColor: `${GREEN_BUTTON_TEXT} !important`,
        border: `${GREEN_BUTTON_BORDER} !important`,
        transform: `scale(${GREEN_BUTTON_HOVER_SCALE})`,
        ...(hoverTopmost
          ? {
              position: 'relative',
              zIndex: GREEN_BUTTON_HOVER_Z_INDEX
            }
          : null),
        '& .MuiButton-startIcon': { color: `${GREEN_BUTTON_TEXT} !important` },
        '& svg': { color: `${GREEN_BUTTON_TEXT} !important` }
      }
    },
    '&.Mui-disabled': {
      bgcolor: `${GREEN_BUTTON_DISABLED_BG} !important`,
      color: `${GREEN_BUTTON_TEXT} !important`,
      WebkitTextFillColor: `${GREEN_BUTTON_TEXT} !important`,
      border: `${GREEN_BUTTON_BORDER} !important`,
      opacity: '1 !important',
      cursor: 'not-allowed',
      boxShadow: 'none',
      transform: 'none !important',
      pointerEvents: 'none',
      '& .MuiButton-startIcon': { color: `${GREEN_BUTTON_TEXT} !important` },
      '& svg': { color: `${GREEN_BUTTON_TEXT} !important` }
    }
  };
}
