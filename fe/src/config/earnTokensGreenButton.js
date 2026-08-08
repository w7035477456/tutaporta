import { getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import { buttonFontSizeHalfResponsive } from 'config/buttonFontEnv';
import { getMobileSinglesTextFontSizeVw } from 'config/singlesMemberCardFontEnv';
import {
  buttonHoverMagnifyTransitionSx,
  hoverMagnifyFontSizeSx
} from 'config/hoverMagnifyEnv';
import { SELECTED_UNSELECTED_BUTTON_FONT_SIZE } from 'config/selectedUnselectedButtonTemplate';

export const earnTokensGreenActionFontSize = {
  xs: getMobileSinglesTextFontSizeVw(),
  sm: getDesktopTextFontSizeVw()
};

/** Page header "Earn Tokens" — half MOBILE_/DESKTOP_FONT_SIZE_BUTTON (fe/.env). */
const earnTokensGreenPageHeaderLabelSx = {
  display: 'inline-block',
  lineHeight: 1.2,
  fontSize: buttonFontSizeHalfResponsive,
  fontWeight: 700,
  ...buttonHoverMagnifyTransitionSx
};

const earnTokensGreenActionLabelSx = {
  display: 'inline-block',
  lineHeight: 1.2,
  fontSize: SELECTED_UNSELECTED_BUTTON_FONT_SIZE,
  fontWeight: 700,
  ...buttonHoverMagnifyTransitionSx
};

const earnTokensGreenPopupActionLabelSx = {
  display: 'inline-block',
  lineHeight: 1.2,
  fontSize: earnTokensGreenActionFontSize,
  fontWeight: 700,
  ...buttonHoverMagnifyTransitionSx
};

/** SelectedButtonTemplate — green bg; HOVER_MAGNIFY_FACTOR applies to label text only. */
export function earnTokensGreenSelectedButtonSx({ popupAction = false, pageHeader = false } = {}) {
  const labelSx = popupAction
    ? earnTokensGreenPopupActionLabelSx
    : pageHeader
      ? earnTokensGreenPageHeaderLabelSx
      : earnTokensGreenActionLabelSx;
  const hoverBaseFontSize = popupAction
    ? earnTokensGreenActionFontSize
    : pageHeader
      ? buttonFontSizeHalfResponsive
      : SELECTED_UNSELECTED_BUTTON_FONT_SIZE;

  return {
    flexShrink: 0,
    minHeight: 'unset',
    lineHeight: 1.25,
    py: 0.5,
    px: 1.25,
    boxShadow: 'none',
    transform: 'none !important',
    bgcolor: '#43a047 !important',
    border: '1px solid #2e7d32 !important',
    color: '#ffffff !important',
    WebkitTextFillColor: '#ffffff !important',
    ...buttonHoverMagnifyTransitionSx,
    '& .hover-magnify-label': labelSx,
    '@media (hover: hover)': {
      '&:hover:not(.Mui-disabled)': {
        bgcolor: '#388e3c !important',
        border: '1px solid #2e7d32 !important',
        color: '#ffffff !important',
        WebkitTextFillColor: '#ffffff !important',
        transform: 'none !important',
        boxShadow: 'none',
        '& .hover-magnify-label': {
          ...labelSx,
          ...hoverMagnifyFontSizeSx({ baseFontSize: hoverBaseFontSize })
        }
      }
    },
    '&.Mui-disabled': {
      bgcolor: '#9e9e9e !important',
      border: '1px solid #757575 !important',
      color: 'rgba(255,255,255,0.85) !important',
      WebkitTextFillColor: 'rgba(255,255,255,0.85) !important',
      opacity: 0.72,
      cursor: 'not-allowed',
      pointerEvents: 'none',
      boxShadow: 'none',
      transform: 'none !important'
    }
  };
}
