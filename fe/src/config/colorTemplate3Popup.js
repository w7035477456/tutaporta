import { getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import { buttonHoverMagnifyFontSx, buttonHoverMagnifyTransitionSx } from 'config/hoverMagnifyEnv';

/**
 * colorTemplate3Popup
 * Compact gallery-centered popup: secondary-color card, primary theme text,
 * height shrink-wraps to content, vertically centered in gallery (menu expand/shrink).
 */

export const COLOR_TEMPLATE3_POPUP_BACKDROP = 'rgba(0,0,0,0.55)';
export const COLOR_TEMPLATE3_POPUP_Z_INDEX = 1400;
export const COLOR_TEMPLATE3_POPUP_PANEL_BG = 'var(--theme-secondary-color)';
export const COLOR_TEMPLATE3_POPUP_TEXT = 'var(--theme-primary-color)';
export const COLOR_TEMPLATE3_POPUP_BORDER = '2px solid var(--theme-primary-color)';
export const COLOR_TEMPLATE3_POPUP_DEFAULT_MAX_WIDTH = '90vw';
export const COLOR_TEMPLATE3_POPUP_MAX_HEIGHT = 'min(85vh, fit-content)';

export { colorTemplate2PopupPanelWidth as colorTemplate3PopupPanelWidth } from 'config/colorTemplate2Popup';

export const COLOR_TEMPLATE3_POPUP_LEGEND_NUMBER_COLOR = '#d32f2f';
export const COLOR_TEMPLATE3_POPUP_LEGEND_NUMBER_HOVER_COLOR = 'var(--theme-yellow-color)';
export const COLOR_TEMPLATE3_POPUP_LEGEND_NUMBER_FONT_FAMILY = '"Times New Roman", Times, serif';

function colorTemplate3PopupLegendNumberBaseSx(fontSize) {
  return {
    color: COLOR_TEMPLATE3_POPUP_LEGEND_NUMBER_COLOR,
    fontFamily: COLOR_TEMPLATE3_POPUP_LEGEND_NUMBER_FONT_FAMILY,
    fontStyle: 'italic',
    fontWeight: 700,
    fontSize: fontSize || '2.1rem',
    lineHeight: 1,
    flexShrink: 0,
    minWidth: '1.25em',
    position: 'relative',
    top: '-5px'
  };
}

export function colorTemplate3PopupLegendNumberHoverSx(fontSize = '2.1rem') {
  const baseFontSize = { xs: fontSize, sm: fontSize };
  return {
    ...buttonHoverMagnifyTransitionSx,
    '@media (hover: hover)': {
      '&:hover': {
        color: COLOR_TEMPLATE3_POPUP_LEGEND_NUMBER_HOVER_COLOR,
        ...buttonHoverMagnifyFontSx({ baseFontSize })
      }
    }
  };
}

export function colorTemplate3PopupBodySx() {
  return {
    color: COLOR_TEMPLATE3_POPUP_TEXT,
    fontSize: { xs: '0.9rem', sm: getDesktopTextFontSizeVw() },
    '& .MuiTypography-root': { color: COLOR_TEMPLATE3_POPUP_TEXT },
    '& .color-template3-legend-number': {
      color: `${COLOR_TEMPLATE3_POPUP_LEGEND_NUMBER_COLOR} !important`,
      fontFamily: COLOR_TEMPLATE3_POPUP_LEGEND_NUMBER_FONT_FAMILY,
      fontStyle: 'italic',
      position: 'relative',
      top: '-5px',
      ...buttonHoverMagnifyTransitionSx,
      '@media (hover: hover)': {
        '&:hover': {
          color: `${COLOR_TEMPLATE3_POPUP_LEGEND_NUMBER_HOVER_COLOR} !important`,
          ...buttonHoverMagnifyFontSx({ baseFontSize: { xs: '2.1rem', sm: '2.1rem' } })
        }
      }
    },
    '& .MuiFormControlLabel-label': { color: COLOR_TEMPLATE3_POPUP_TEXT }
  };
}

export function colorTemplate3PopupLegendNumberSx(fontSize) {
  return colorTemplate3PopupLegendNumberBaseSx(fontSize);
}

export function colorTemplate3PopupLegendNumberInteractiveSx(fontSize) {
  return {
    ...colorTemplate3PopupLegendNumberBaseSx(fontSize),
    cursor: 'pointer',
    ...colorTemplate3PopupLegendNumberHoverSx(fontSize || '2.1rem')
  };
}

export { colorTemplate5CloseXSx as colorTemplate3PopupCloseButtonSx } from 'config/colorTemplate5CloseX';
