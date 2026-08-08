import { getDesktopTextFontSizeVw, getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';
import { buttonHoverMagnifyFontSx, buttonHoverMagnifyTransitionSx } from 'config/hoverMagnifyEnv';
import { getMobileSinglesTitleFontSizeVw } from 'config/singlesMemberCardFontEnv';

/**
 * colorTemplate2Popup
 * Gallery-centered popup shell: dark card on dim backdrop, theme text colors,
 * responsive to sidebar open (menu expand) vs collapsed (menu shrink).
 */

export const COLOR_TEMPLATE2_POPUP_BACKDROP = 'rgba(0,0,0,0.55)';
export const COLOR_TEMPLATE2_POPUP_Z_INDEX = 1400;
export const COLOR_TEMPLATE2_POPUP_PANEL_BG = 'var(--theme-daynight-color)';
export const COLOR_TEMPLATE2_POPUP_TEXT = 'var(--theme-primary-color)';
export const COLOR_TEMPLATE2_POPUP_BORDER = '2px solid var(--theme-primary-color)';
export const COLOR_TEMPLATE2_POPUP_DEFAULT_MAX_WIDTH = '90vw';
export const COLOR_TEMPLATE2_POPUP_DEFAULT_MAX_HEIGHT = '80vh';

export function colorTemplate2PopupTitleSx() {
  return {
    fontWeight: 700,
    textAlign: 'center',
    width: '100%',
    color: COLOR_TEMPLATE2_POPUP_TEXT,
    fontSize: {
      xs: `${Math.max(0.1, (Number.parseFloat(getMobileSinglesTitleFontSizeVw()) || 2) * 2)}vw`,
      sm: `${Math.max(0.1, (Number.parseFloat(getDesktopTitleFontSizeVw()) || 2) * 2)}vw`
    }
  };
}

export function colorTemplate2PopupBodySx() {
  return {
    color: COLOR_TEMPLATE2_POPUP_TEXT,
    fontSize: { xs: '0.9rem', sm: getDesktopTextFontSizeVw() },
    '& .MuiTypography-root': { color: COLOR_TEMPLATE2_POPUP_TEXT },
    '& .MuiFormControlLabel-label': { color: COLOR_TEMPLATE2_POPUP_TEXT }
  };
}

export function colorTemplate2PopupLinkSx() {
  return {
    color: 'inherit',
    fontWeight: 700,
    display: 'inline-block',
    textDecorationLine: 'underline',
    textDecorationColor: 'currentColor',
    textUnderlineOffset: '2px',
    textDecorationThickness: '2px',
    ...buttonHoverMagnifyTransitionSx,
    '&:hover': {
      ...buttonHoverMagnifyFontSx()
    }
  };
}

export function colorTemplate2PopupPanelWidth(menuOffsetPx, edgePaddingPx, maxWidth = COLOR_TEMPLATE2_POPUP_DEFAULT_MAX_WIDTH) {
  return menuOffsetPx > 0
    ? `min(${maxWidth}, calc(100vw - ${menuOffsetPx + edgePaddingPx * 2}px))`
    : maxWidth;
}
