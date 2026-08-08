/**
 * colorTemplate6Popup — viewport-centered popup using ColorTemplate1Button selected colors.
 * Navy panel, white copy, thick border, readable env-based fonts.
 */
import { buttonFontSizeResponsive } from 'config/buttonFontEnv';
import { templateButtonMagnifySx } from 'config/hoverMagnifyEnv';
import {
  COLOR_TEMPLATE1_BG_SELECTED,
  COLOR_TEMPLATE1_TEXT_SELECTED,
  COLOR_TEMPLATE1_WALL_COLOR_LIGHT,
  colorTemplate1SelectedPanelSx
} from 'config/colorTemplate1';
import { getDesktopTextFontSizeVw, getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTextFontSizeVw, getMobileSinglesTitleFontSizeVw } from 'config/singlesMemberCardFontEnv';
import {
  getAuthDialogMarginBottomVh,
  getAuthDialogMarginTopVh,
  getAuthDialogWidthVwDesktop,
  getAuthDialogWidthVwMobile
} from 'config/standardAuthDialogEnv';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';

export const COLOR_TEMPLATE6_POPUP_BACKDROP = 'rgba(0,0,0,0.55)';
export const COLOR_TEMPLATE6_POPUP_Z_INDEX = 1400;
export const COLOR_TEMPLATE6_POPUP_PANEL_BG = COLOR_TEMPLATE1_BG_SELECTED;
export const COLOR_TEMPLATE6_POPUP_TEXT = COLOR_TEMPLATE1_TEXT_SELECTED;
/** Thick rim on selected (navy) panel — daynight reads as white/black per theme series. */
export const COLOR_TEMPLATE6_POPUP_BORDER = `6px double ${COLOR_TEMPLATE1_TEXT_SELECTED}`;

/** Popup action buttons: theme-secondary fill, theme-primary text + border. */
export const COLOR_TEMPLATE6_POPUP_BUTTON_BG = 'var(--theme-secondary-color)';
export const COLOR_TEMPLATE6_POPUP_BUTTON_TEXT = 'var(--theme-primary-color)';
export const COLOR_TEMPLATE6_POPUP_BUTTON_BORDER = '1px solid var(--theme-primary-color)';

/** Popup inputs: white field background, red typed text. */
export const COLOR_TEMPLATE6_POPUP_INPUT_BG = COLOR_TEMPLATE1_WALL_COLOR_LIGHT;
export const COLOR_TEMPLATE6_POPUP_INPUT_TEXT = '#c62828';

export const COLOR_TEMPLATE6_POPUP_WIDTH_MOBILE_VW = getAuthDialogWidthVwMobile();
export const COLOR_TEMPLATE6_POPUP_WIDTH_DESKTOP_VW = getAuthDialogWidthVwDesktop();
export const COLOR_TEMPLATE6_POPUP_MARGIN_TOP_VH = getAuthDialogMarginTopVh();
export const COLOR_TEMPLATE6_POPUP_MARGIN_BOTTOM_VH = getAuthDialogMarginBottomVh();
export const COLOR_TEMPLATE6_POPUP_MAX_HEIGHT = `calc(100dvh - ${COLOR_TEMPLATE6_POPUP_MARGIN_TOP_VH}vh - ${COLOR_TEMPLATE6_POPUP_MARGIN_BOTTOM_VH}vh)`;

export const COLOR_TEMPLATE6_POPUP_CONTENT_PADDING = {
  px: { xs: 2.5, sm: 3 },
  pt: { xs: 2, sm: 2.5 },
  pb: { xs: 2, sm: 2.5 }
};

export function colorTemplate6PopupTitleSx(overrides = {}) {
  return {
    fontFamily: MAIN_FONT_FAMILY,
    color: `${COLOR_TEMPLATE6_POPUP_TEXT} !important`,
    WebkitTextFillColor: `${COLOR_TEMPLATE6_POPUP_TEXT} !important`,
    fontWeight: 700,
    lineHeight: 1.35,
    fontSize: {
      xs: `max(1.15rem, ${getMobileSinglesTitleFontSizeVw()})`,
      sm: `max(1.35rem, ${getDesktopTitleFontSizeVw()})`
    },
    ...overrides
  };
}

export function colorTemplate6PopupBodySx(overrides = {}) {
  const bodyFontSize = {
    xs: `max(0.9rem, ${getMobileSinglesTextFontSizeVw()})`,
    sm: getDesktopTextFontSizeVw()
  };
  return {
    fontFamily: MAIN_FONT_FAMILY,
    color: `${COLOR_TEMPLATE6_POPUP_TEXT} !important`,
    WebkitTextFillColor: `${COLOR_TEMPLATE6_POPUP_TEXT} !important`,
    fontSize: bodyFontSize,
    lineHeight: 1.55,
    '& .MuiTypography-root': {
      color: `${COLOR_TEMPLATE6_POPUP_TEXT} !important`,
      WebkitTextFillColor: `${COLOR_TEMPLATE6_POPUP_TEXT} !important`,
      fontSize: bodyFontSize,
      lineHeight: 1.55
    },
    ...overrides
  };
}

/** Popup actions — theme-secondary background, theme-primary text + border. */
export function colorTemplate6PopupActionButtonSx(overrides = {}) {
  return {
    fontFamily: MAIN_FONT_FAMILY,
    fontSize: buttonFontSizeResponsive,
    textTransform: 'none',
    fontWeight: 700,
    borderRadius: '12px',
    bgcolor: `${COLOR_TEMPLATE6_POPUP_BUTTON_BG} !important`,
    color: `${COLOR_TEMPLATE6_POPUP_BUTTON_TEXT} !important`,
    WebkitTextFillColor: `${COLOR_TEMPLATE6_POPUP_BUTTON_TEXT} !important`,
    border: `${COLOR_TEMPLATE6_POPUP_BUTTON_BORDER} !important`,
    px: 2.5,
    py: 0.75,
    minWidth: 88,
    boxShadow: 'none',
    '& .MuiTypography-root': {
      color: `${COLOR_TEMPLATE6_POPUP_BUTTON_TEXT} !important`,
      WebkitTextFillColor: `${COLOR_TEMPLATE6_POPUP_BUTTON_TEXT} !important`
    },
    ...templateButtonMagnifySx({ baseFontSize: buttonFontSizeResponsive }),
    '@media (hover: hover)': {
      '&:hover': {
        bgcolor: `${COLOR_TEMPLATE6_POPUP_BUTTON_BG} !important`,
        color: `${COLOR_TEMPLATE6_POPUP_BUTTON_TEXT} !important`,
        WebkitTextFillColor: `${COLOR_TEMPLATE6_POPUP_BUTTON_TEXT} !important`,
        border: `${COLOR_TEMPLATE6_POPUP_BUTTON_BORDER} !important`,
        filter: 'brightness(0.96)'
      }
    },
    '&.Mui-disabled': {
      bgcolor: `${COLOR_TEMPLATE6_POPUP_BUTTON_BG} !important`,
      color: `${COLOR_TEMPLATE6_POPUP_BUTTON_TEXT} !important`,
      WebkitTextFillColor: `${COLOR_TEMPLATE6_POPUP_BUTTON_TEXT} !important`,
      border: `${COLOR_TEMPLATE6_POPUP_BUTTON_BORDER} !important`,
      opacity: 0.55
    },
    ...overrides
  };
}

/** @deprecated Use colorTemplate6PopupActionButtonSx */
export function colorTemplate6PopupFooterButtonSx(overrides = {}) {
  return colorTemplate6PopupActionButtonSx({ borderRadius: 999, py: 0.65, minWidth: 96, ...overrides });
}

const colorTemplate6PopupInputTextSx = {
  color: `${COLOR_TEMPLATE6_POPUP_INPUT_TEXT} !important`,
  WebkitTextFillColor: `${COLOR_TEMPLATE6_POPUP_INPUT_TEXT} !important`,
  fontFamily: MAIN_FONT_FAMILY,
  fontSize: {
    xs: `max(0.9rem, ${getMobileSinglesTextFontSizeVw()})`,
    sm: getDesktopTextFontSizeVw()
  }
};

/** Outlined input: white background, red input font. */
export function colorTemplate6PopupInputSx(overrides = {}) {
  return {
    '& .MuiInputLabel-root': {
      fontFamily: MAIN_FONT_FAMILY,
      color: `${COLOR_TEMPLATE6_POPUP_INPUT_TEXT} !important`,
      WebkitTextFillColor: `${COLOR_TEMPLATE6_POPUP_INPUT_TEXT} !important`,
      fontSize: {
        xs: `max(0.9rem, ${getMobileSinglesTextFontSizeVw()})`,
        sm: getDesktopTextFontSizeVw()
      }
    },
    '& .MuiOutlinedInput-root': {
      borderRadius: '12px',
      bgcolor: `${COLOR_TEMPLATE6_POPUP_INPUT_BG} !important`,
      '& fieldset': { border: COLOR_TEMPLATE6_POPUP_BUTTON_BORDER },
      '&:hover fieldset': { border: COLOR_TEMPLATE6_POPUP_BUTTON_BORDER },
      '&.Mui-focused fieldset': { border: COLOR_TEMPLATE6_POPUP_BUTTON_BORDER },
      '& .MuiInputBase-input': colorTemplate6PopupInputTextSx
    },
    ...overrides
  };
}

export function colorTemplate6PopupPanelShellSx(overrides = {}) {
  return {
    ...colorTemplate1SelectedPanelSx(),
    position: 'relative',
    width: { xs: `${COLOR_TEMPLATE6_POPUP_WIDTH_MOBILE_VW}vw`, sm: `${COLOR_TEMPLATE6_POPUP_WIDTH_DESKTOP_VW}vw` },
    maxWidth: { xs: `${COLOR_TEMPLATE6_POPUP_WIDTH_MOBILE_VW}vw`, sm: `${COLOR_TEMPLATE6_POPUP_WIDTH_DESKTOP_VW}vw` },
    minWidth: { xs: 280, sm: 460 },
    height: 'auto',
    maxHeight: COLOR_TEMPLATE6_POPUP_MAX_HEIGHT,
    border: COLOR_TEMPLATE6_POPUP_BORDER,
    borderRadius: 3,
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
    ...overrides
  };
}
