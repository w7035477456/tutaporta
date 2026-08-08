/**
 * colorTemplate7PopupLargeDark — large gallery-centered popup (nickname picker spec).
 * Secondary panel background, inverse-daynight copy, white inputs, GreenButton actions.
 * Menu-aware width, shrink-wrap height, vertical scroll when needed.
 */
import { buttonFontSizeResponsive } from 'config/buttonFontEnv';
import { getDesktopIconFontSizeVw, getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { colorTemplate2PopupPanelWidth } from 'config/colorTemplate2Popup';
import { bsizeInputHeightResponsive } from 'config/bsizeEnv';
import { greenButtonSx } from 'config/greenButton';
import { ERROR_VAR, INVERSE_DAYNIGHT_VAR } from 'utils/themeConfig';

export const COLOR_TEMPLATE7_POPUP_BACKDROP = 'rgba(0,0,0,0.55)';
export const COLOR_TEMPLATE7_POPUP_Z_INDEX = 1400;
export const COLOR_TEMPLATE7_POPUP_PANEL_BG = 'var(--theme-secondary-color)';
export const COLOR_TEMPLATE7_POPUP_TEXT = `var(${INVERSE_DAYNIGHT_VAR})`;
export const COLOR_TEMPLATE7_POPUP_BORDER = '2px solid var(--theme-primary-color)';
export const COLOR_TEMPLATE7_POPUP_DEFAULT_MAX_WIDTH = 'calc(100vw - 24px)';
export const COLOR_TEMPLATE7_POPUP_MAX_HEIGHT = 'min(92vh, calc(100vh - 24px))';

export const COLOR_TEMPLATE7_POPUP_INPUT_HEIGHT = 40;
export const COLOR_TEMPLATE7_POPUP_INPUT_MAX_CHARS = 40;

/** fe/.env BSIZE (desktop sm+) + MOBILE_FONT_SIZE_BUTTON (xs) — popup TextField root height. */
export const colorTemplate7PopupInputHeightResponsive = bsizeInputHeightResponsive;

/** MuiInputBase-root height for ColorTemplate7PopupLargeDark inputs. inputHeight: 'bsize' | 'fixed'. */
export function colorTemplate7PopupInputRootHeightSx(inputHeight = 'bsize') {
  if (inputHeight === 'fixed') {
    return {
      height: COLOR_TEMPLATE7_POPUP_INPUT_HEIGHT,
      minHeight: COLOR_TEMPLATE7_POPUP_INPUT_HEIGHT
    };
  }
  const h = colorTemplate7PopupInputHeightResponsive;
  return {
    height: h,
    minHeight: h
  };
}

export const COLOR_TEMPLATE7_POPUP_INPUT_WIDTH = '40ch';
export const COLOR_TEMPLATE7_POPUP_INPUT_BG = '#fff';
export const COLOR_TEMPLATE7_POPUP_INPUT_TEXT = `var(${ERROR_VAR})`;
/** Top-right close "X" — red square, black X, black border. */
export const COLOR_TEMPLATE7_POPUP_CLOSE_HOVER_SCALE = 1.25;
export const COLOR_TEMPLATE7_POPUP_CLOSE_ACTIVE_SCALE = 1.5;
export const COLOR_TEMPLATE7_POPUP_CLOSE_BG = 'var(--theme-error-color)';
export const COLOR_TEMPLATE7_POPUP_CLOSE_TEXT = '#000000';
export const COLOR_TEMPLATE7_POPUP_CLOSE_BORDER = '2px solid #000000';

export const COLOR_TEMPLATE7_POPUP_CONTENT_PADDING = {
  px: { xs: 1, sm: 2 },
  pt: { xs: 1.5, sm: 2 },
  pb: { xs: 1.5, sm: 1.5 }
};

export { colorTemplate2PopupPanelWidth as colorTemplate7PopupPanelWidth };

/** Menu-aware full gallery column width (sidebar expand / shrink). */
export function colorTemplate7PopupGalleryWidth(menuOffsetPx, edgePaddingPx) {
  return menuOffsetPx > 0
    ? `calc(100vw - ${menuOffsetPx + edgePaddingPx * 2}px)`
    : `calc(100vw - ${edgePaddingPx * 2}px)`;
}

/** MOBILE fallback + fe/.env DESKTOP_FONT_SIZE_TEXT for all popup copy. */
export const colorTemplate7PopupTextFontSizeResponsive = {
  xs: '0.9rem',
  sm: getDesktopTextFontSizeVw()
};

/** fe/.env DESKTOP_FONT_SIZE_BUTTON for popup action + close controls. */
export const colorTemplate7PopupButtonFontSizeResponsive = buttonFontSizeResponsive;

function readChoiceControlVwNumber(value, fallback) {
  const parsed = Number(String(value ?? '').trim());
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, 25);
}

/** fe/.env DESKTOP_FONT_SIZE_ICON — checkbox / radio control size (MOBILE_FONT_SIZE_ICON on xs when set). */
export const colorTemplate7PopupChoiceControlIconSizeResponsive = {
  xs: `${readChoiceControlVwNumber(import.meta.env.MOBILE_FONT_SIZE_ICON ?? import.meta.env.DESKTOP_FONT_SIZE_ICON, 2)}vw`,
  sm: getDesktopIconFontSizeVw()
};

export const COLOR_TEMPLATE7_POPUP_CHOICE_BORDER_WIDTH = 3;

export function colorTemplate7PopupCheckboxCheckedMarkSx(overrides = {}) {
  const xsN = readChoiceControlVwNumber(import.meta.env.MOBILE_FONT_SIZE_ICON ?? import.meta.env.DESKTOP_FONT_SIZE_ICON, 2);
  const smN = readChoiceControlVwNumber(import.meta.env.DESKTOP_FONT_SIZE_ICON, 2);
  const markColor = COLOR_TEMPLATE7_POPUP_INPUT_TEXT;
  return {
    color: `${markColor} !important`,
    WebkitTextFillColor: `${markColor} !important`,
    fontWeight: 800,
    lineHeight: 1,
    fontFamily: MAIN_FONT_FAMILY,
    fontSize: { xs: `${xsN * 0.72}vw`, sm: `${smN * 0.72}vw` },
    ...overrides
  };
}

/** @deprecated Use colorTemplate7PopupCheckboxCheckedMarkSx for CT7 checkbox checked mark. */
export function colorTemplate7PopupCheckboxCheckmarkSx(overrides = {}) {
  return colorTemplate7PopupCheckboxCheckedMarkSx(overrides);
}

/** Shared white box + thick red border for checkbox / radio shells. */
export function colorTemplate7PopupChoiceControlShellSx(overrides = {}) {
  return {
    width: colorTemplate7PopupChoiceControlIconSizeResponsive,
    height: colorTemplate7PopupChoiceControlIconSizeResponsive,
    boxSizing: 'border-box',
    bgcolor: COLOR_TEMPLATE7_POPUP_INPUT_BG,
    border: `${COLOR_TEMPLATE7_POPUP_CHOICE_BORDER_WIDTH}px solid ${COLOR_TEMPLATE7_POPUP_INPUT_TEXT}`,
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...overrides
  };
}

export function colorTemplate7PopupCheckboxShellSx(overrides = {}) {
  return colorTemplate7PopupChoiceControlShellSx({ borderRadius: 0.5, ...overrides });
}

export function colorTemplate7PopupRadioShellSx(overrides = {}) {
  return colorTemplate7PopupChoiceControlShellSx({ borderRadius: '50%', ...overrides });
}

export function colorTemplate7PopupRadioDotSx(overrides = {}) {
  return {
    width: '46%',
    height: '46%',
    borderRadius: '50%',
    bgcolor: `${COLOR_TEMPLATE7_POPUP_INPUT_TEXT} !important`,
    flexShrink: 0,
    ...overrides
  };
}

export function colorTemplate7PopupCheckboxRootSx(overrides = {}) {
  return {
    p: 0.25,
    flexShrink: 0,
    color: 'transparent',
    '&.Mui-checked': {
      color: 'transparent'
    },
    ...overrides
  };
}

export function colorTemplate7PopupRadioRootSx(overrides = {}) {
  return colorTemplate7PopupCheckboxRootSx(overrides);
}

export function colorTemplate7PopupFontBase(overrides = {}) {
  return {
    fontFamily: MAIN_FONT_FAMILY,
    color: COLOR_TEMPLATE7_POPUP_TEXT,
    WebkitTextFillColor: COLOR_TEMPLATE7_POPUP_TEXT,
    ...overrides
  };
}

/** Force popup text on common children (alerts, labels, preformatted debug, etc.). */
export function colorTemplate7PopupTextCascadeSx(overrides = {}) {
  const { textColor: textColorOverride, ...restOverrides } = overrides;
  const textColor = textColorOverride ?? COLOR_TEMPLATE7_POPUP_TEXT;
  const textFontSize = colorTemplate7PopupTextFontSizeResponsive;
  return {
    color: textColor,
    WebkitTextFillColor: textColor,
    fontSize: textFontSize,
    '& .MuiTypography-root, & .MuiAlert-root, & .MuiAlert-message, & .MuiFormControlLabel-label, & .MuiFormHelperText-root, & pre, & code':
      {
        color: `${textColor} !important`,
        WebkitTextFillColor: `${textColor} !important`,
        fontSize: `${textFontSize.xs} !important`,
        '@media (min-width: 600px)': {
          fontSize: `${textFontSize.sm} !important`
        }
      },
    /** Green/light drop zones inside popup — black caption beats inverse-daynight cascade above. */
    '& .theme-light-surface .my-story-upload-caption': {
      color: '#000000 !important',
      WebkitTextFillColor: '#000000 !important'
    },
    '& .MuiButton-root.color-template7-popup-clear-x': {
      ...greenButtonSx(),
      fontSize: `${colorTemplate7PopupButtonFontSizeResponsive.xs} !important`,
      '@media (min-width: 600px)': {
        fontSize: `${colorTemplate7PopupButtonFontSizeResponsive.sm} !important`
      }
    },
    '& .MuiButton-root.color-template7-popup-action': {
      ...greenButtonSx(),
      ...colorTemplate7PopupActionButtonSx(),
      fontSize: `${colorTemplate7PopupButtonFontSizeResponsive.xs} !important`,
      '@media (min-width: 600px)': {
        fontSize: `${colorTemplate7PopupButtonFontSizeResponsive.sm} !important`
      }
    },
    '& .MuiButton-root.color-template7-popup-close': {
      ...colorTemplate7PopupCloseSx(),
      fontSize: `${colorTemplate7PopupButtonFontSizeResponsive.xs} !important`,
      '@media (min-width: 600px)': {
        fontSize: `${colorTemplate7PopupButtonFontSizeResponsive.sm} !important`
      }
    },
    ...restOverrides
  };
}

/** Popup title — centered, inverse-daynight color. */
export function colorTemplate7PopupTitleSx(overrides = {}) {
  return {
    ...colorTemplate7PopupFontBase(),
    textAlign: 'center',
    fontWeight: 700,
    fontSize: colorTemplate7PopupTextFontSizeResponsive,
    lineHeight: 1.25,
    width: '100%',
    ...overrides
  };
}

/** Instruction / body copy. */
export function colorTemplate7PopupBodyTextSx(overrides = {}) {
  return {
    ...colorTemplate7PopupFontBase(),
    textAlign: 'center',
    fontSize: colorTemplate7PopupTextFontSizeResponsive,
    lineHeight: 1.4,
    width: '100%',
    ...overrides
  };
}

export function colorTemplate7PopupBodySx(overrides = {}) {
  const { textColor, ...restOverrides } = overrides;
  const fontOverride = textColor
    ? { color: textColor, WebkitTextFillColor: textColor }
    : {};
  const cascadeOpts = textColor ? { textColor } : {};
  return {
    ...colorTemplate7PopupFontBase(fontOverride),
    ...colorTemplate7PopupTextCascadeSx(cascadeOpts),
    fontSize: colorTemplate7PopupTextFontSizeResponsive,
    lineHeight: 1.55,
    width: '100%',
    alignItems: 'stretch',
    ...restOverrides
  };
}

/** Beat nested Stack cascades when a custom popup text color is set (e.g. instruction popups). */
export function colorTemplate7PopupNestedTextColorSx(textColor) {
  if (!textColor) return {};
  const forced = {
    color: `${textColor} !important`,
    WebkitTextFillColor: `${textColor} !important`
  };
  const typographySelectors =
    '& .MuiStack-root .MuiTypography-root, & .ct7-popup-title, & .ct7-popup-body-text, & .ct7-popup-section-label, & .ct7-popup-section-title, & .ct7-popup-section-description, & .MuiStack-root li';
  return {
    '& .MuiStack-root': colorTemplate7PopupTextCascadeSx({ textColor }),
    [typographySelectors]: forced
  };
}

/**
 * Popup Cancel / OK (and other CT7/CT16 ActionButtons).
 * Always use fixed green — Minimal Palete remaps `--theme-action-green-color` to
 * secondary, which matches the popup panel and makes buttons invisible.
 */
export const COLOR_TEMPLATE7_POPUP_ACTION_GREEN = '#60C446';

export function colorTemplate7PopupActionButtonSx(overrides = {}) {
  return {
    height: COLOR_TEMPLATE7_POPUP_INPUT_HEIGHT,
    minHeight: COLOR_TEMPLATE7_POPUP_INPUT_HEIGHT,
    py: 0,
    lineHeight: 1,
    minWidth: 88,
    boxShadow: 'none',
    bgcolor: `${COLOR_TEMPLATE7_POPUP_ACTION_GREEN} !important`,
    color: '#000000 !important',
    WebkitTextFillColor: '#000000 !important',
    border: '1px solid #000000 !important',
    '@media (hover: hover)': {
      '&:hover:not(.Mui-disabled)': {
        bgcolor: `${COLOR_TEMPLATE7_POPUP_ACTION_GREEN} !important`,
        color: '#000000 !important',
        WebkitTextFillColor: '#000000 !important',
        border: '1px solid #000000 !important'
      }
    },
    ...overrides
  };
}

/** Age / distance sliders — red knobs + active bar (matches popup input text). */
export function colorTemplate7PopupSliderSx(overrides = {}) {
  const accent = COLOR_TEMPLATE7_POPUP_INPUT_TEXT;
  return {
    color: accent,
    '& .MuiSlider-track': {
      border: 'none',
      backgroundColor: accent
    },
    '& .MuiSlider-rail': {
      opacity: 1,
      backgroundColor: 'var(--theme-primary-color)'
    },
    '& .MuiSlider-thumb': {
      backgroundColor: accent,
      border: `2px solid ${accent}`,
      boxSizing: 'border-box',
      '&:hover, &.Mui-focusVisible, &.Mui-active': {
        boxShadow: '0 0 0 8px color-mix(in srgb, var(--theme-error-color) 20%, transparent)'
      }
    },
    '& .MuiSlider-valueLabel': {
      backgroundColor: accent,
      color: '#fff',
      fontWeight: 700
    },
    ...overrides
  };
}

/** White field, red bold typed text, BSIZE-driven height (or fixed px), 40ch wide, horizontally centered. */
export function colorTemplate7PopupInputSx(overrides = {}, inputHeight = 'bsize') {
  const rootHeight = colorTemplate7PopupInputRootHeightSx(inputHeight);
  return {
    width: COLOR_TEMPLATE7_POPUP_INPUT_WIDTH,
    maxWidth: COLOR_TEMPLATE7_POPUP_INPUT_WIDTH,
    mx: 'auto',
    display: 'block',
    alignSelf: 'center',
    flex: 'none',
    '& .MuiInputBase-root': {
      bgcolor: COLOR_TEMPLATE7_POPUP_INPUT_BG,
      boxSizing: 'border-box',
      width: '100%',
      ...rootHeight
    },
    '& .MuiInputBase-root.MuiInputBase-multiline': {
      height: 'auto',
      minHeight: rootHeight.minHeight ?? rootHeight.height,
      alignItems: 'flex-start',
      py: 0
    },
    '& .MuiInputBase-input': {
      color: `${COLOR_TEMPLATE7_POPUP_INPUT_TEXT} !important`,
      WebkitTextFillColor: `${COLOR_TEMPLATE7_POPUP_INPUT_TEXT} !important`,
      fontWeight: 700,
      fontSize: colorTemplate7PopupTextFontSizeResponsive
    },
    '& .MuiInputBase-inputMultiline': {
      padding: '10px 12px',
      lineHeight: 1.4,
      boxSizing: 'border-box'
    },
    '& .MuiInputBase-input::placeholder': {
      color: `${COLOR_TEMPLATE7_POPUP_INPUT_TEXT} !important`,
      WebkitTextFillColor: `${COLOR_TEMPLATE7_POPUP_INPUT_TEXT} !important`,
      opacity: 0.55,
      fontWeight: 400
    },
    ...overrides
  };
}

/** Label left / input+button right — labels right-align, inputs left-align on shared gutter. */
export function colorTemplate7PopupFormRowsSx(overrides = {}) {
  return {
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', sm: 'max-content minmax(0, 1fr)' },
    columnGap: { xs: 0, sm: 1.25 },
    rowGap: 1.5,
    alignItems: 'center',
    width: '100%',
    ...overrides
  };
}

export function colorTemplate7PopupFormRowLabelSx(overrides = {}) {
  return {
    ...colorTemplate7PopupSectionLabelSx({ mt: 0, mb: 0 }),
    textAlign: { xs: 'left', sm: 'right' },
    justifySelf: { sm: 'end' },
    whiteSpace: { sm: 'nowrap' },
    ...overrides
  };
}

export function colorTemplate7PopupFormRowControlsSx(overrides = {}) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 1.25,
    minWidth: 0,
    width: '100%',
    flexWrap: { xs: 'wrap', sm: 'nowrap' },
    ...overrides
  };
}

/** Form-row input: left-aligned to gutter (not centered 40ch block). */
export function colorTemplate7PopupFormRowInputSx(overrides = {}, inputHeight = 'bsize') {
  return colorTemplate7PopupInputSx(
    {
      mx: 0,
      alignSelf: 'flex-start',
      display: 'inline-flex',
      flexShrink: 0,
      ...overrides
    },
    inputHeight
  );
}

/** Form-row input that grows to fill remaining row width (input + action buttons). */
export function colorTemplate7PopupFormRowInputStretchSx(overrides = {}, inputHeight = 'bsize') {
  return colorTemplate7PopupFormRowInputSx(
    {
      flex: '1 1 0%',
      flexShrink: 1,
      minWidth: 0,
      width: 'auto',
      maxWidth: 'none',
      alignSelf: 'stretch',
      display: 'flex'
    },
    inputHeight
  );
}

/** Compact square — top-right close X (red bg, black X, black border). */
export function colorTemplate7PopupCloseSx(overrides = {}) {
  return {
    ...greenButtonSx(),
    fontWeight: 800,
    lineHeight: 1,
    boxSizing: 'border-box',
    width: { xs: '1.75em', sm: '1.75em' },
    height: { xs: '1.75em', sm: '1.75em' },
    minWidth: { xs: '1.75em', sm: '1.75em' },
    minHeight: { xs: '1.75em', sm: '1.75em' },
    px: 0,
    py: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    m: 0,
    bgcolor: `${COLOR_TEMPLATE7_POPUP_CLOSE_BG} !important`,
    color: `${COLOR_TEMPLATE7_POPUP_CLOSE_TEXT} !important`,
    WebkitTextFillColor: `${COLOR_TEMPLATE7_POPUP_CLOSE_TEXT} !important`,
    border: `${COLOR_TEMPLATE7_POPUP_CLOSE_BORDER} !important`,
    '@media (hover: hover)': {
      '&:hover:not(.Mui-disabled)': {
        bgcolor: `${COLOR_TEMPLATE7_POPUP_CLOSE_BG} !important`,
        color: `${COLOR_TEMPLATE7_POPUP_CLOSE_TEXT} !important`,
        WebkitTextFillColor: `${COLOR_TEMPLATE7_POPUP_CLOSE_TEXT} !important`,
        border: `${COLOR_TEMPLATE7_POPUP_CLOSE_BORDER} !important`,
        filter: 'brightness(0.92)',
        transform: `scale(${COLOR_TEMPLATE7_POPUP_CLOSE_HOVER_SCALE})`
      }
    },
    '&:active:not(.Mui-disabled)': {
      bgcolor: `${COLOR_TEMPLATE7_POPUP_CLOSE_BG} !important`,
      color: `${COLOR_TEMPLATE7_POPUP_CLOSE_TEXT} !important`,
      WebkitTextFillColor: `${COLOR_TEMPLATE7_POPUP_CLOSE_TEXT} !important`,
      border: `${COLOR_TEMPLATE7_POPUP_CLOSE_BORDER} !important`,
      filter: 'brightness(0.85)',
      transform: `scale(${COLOR_TEMPLATE7_POPUP_CLOSE_ACTIVE_SCALE})`
    },
    ...overrides
  };
}

/** Inline clear "X" — compact GreenButton square. */
export function colorTemplate7PopupClearXSx(overrides = {}) {
  return {
    ...colorTemplate7PopupCloseSx(),
    position: 'static',
    width: { xs: '1.75em', sm: '1.75em' },
    height: { xs: '1.75em', sm: '1.75em' },
    minWidth: { xs: '1.75em', sm: '1.75em' },
    minHeight: { xs: '1.75em', sm: '1.75em' },
    ...overrides
  };
}

export function colorTemplate7PopupClosePositionSx(overrides = {}) {
  return {
    position: 'absolute',
    top: { xs: 8, sm: 10 },
    right: { xs: 8, sm: 10 },
    zIndex: 4,
    ...overrides
  };
}

export function colorTemplate7PopupPanelShellSx(overrides = {}) {
  return {
    position: 'relative',
    border: COLOR_TEMPLATE7_POPUP_BORDER,
    borderRadius: 1,
    maxHeight: COLOR_TEMPLATE7_POPUP_MAX_HEIGHT,
    overflow: 'visible',
    ...overrides
  };
}

/** Bottom-right corner drag handle for resizable popups. */
export function colorTemplate7PopupResizeHandleSx(overrides = {}) {
  return {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 20,
    height: 20,
    cursor: 'nwse-resize',
    zIndex: 6,
    touchAction: 'none',
    '&::before': {
      content: '""',
      position: 'absolute',
      right: 4,
      bottom: 4,
      width: 12,
      height: 12,
      borderRight: '2px solid var(--theme-primary-color)',
      borderBottom: '2px solid var(--theme-primary-color)',
      opacity: 0.9
    },
    ...overrides
  };
}

/** Large section headings (e.g. Adjectives, 50 Female Nicknames). */
export function colorTemplate7PopupSectionTitleSx(overrides = {}) {
  return {
    ...colorTemplate7PopupFontBase(),
    fontWeight: 700,
    fontSize: colorTemplate7PopupTextFontSizeResponsive,
    mb: 1.5,
    mt: 0.5,
    textAlign: 'center',
    ...overrides
  };
}

export function colorTemplate7PopupSectionLabelSx(overrides = {}) {
  return {
    ...colorTemplate7PopupFontBase(),
    fontWeight: 700,
    fontSize: colorTemplate7PopupTextFontSizeResponsive,
    mb: 0.5,
    mt: 1.5,
    ...overrides
  };
}

export function colorTemplate7PopupSectionDescriptionSx(overrides = {}) {
  return {
    ...colorTemplate7PopupFontBase(),
    fontSize: colorTemplate7PopupTextFontSizeResponsive,
    fontStyle: 'italic',
    lineHeight: 1.4,
    mb: 0.75,
    opacity: 0.92,
    ...overrides
  };
}

/** Clickable suggestion words. */
export function colorTemplate7PopupLinkSx(overrides = {}) {
  return {
    ...colorTemplate7PopupFontBase(),
    display: 'inline-block',
    fontSize: colorTemplate7PopupTextFontSizeResponsive,
    lineHeight: 1.4,
    mr: 1,
    mb: 0.5,
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
    '&:hover': { color: 'var(--theme-error-color)' }
  };
}

export function colorTemplate7PopupLinkExampleSx(overrides = {}) {
  return {
    ...colorTemplate7PopupFontBase(),
    fontSize: colorTemplate7PopupTextFontSizeResponsive,
    lineHeight: 1.4,
    fontStyle: 'italic',
    opacity: 0.9,
    ...overrides
  };
}

/**
 * Left-align body copy; keep title (and optional lead lines) centered.
 * Use with ColorTemplate7PopupLargeDark bodyTextAlignLeft + centeredLeadLines.
 * Mark subtitle with SectionTitle leadLine or class ct7-popup-lead-line.
 */
export function colorTemplate7PopupBodyLeftExceptTitleLeadSx({ centeredLeadLines = 2 } = {}) {
  const centeredSelectors = ['& .ct7-popup-title'];
  if (centeredLeadLines >= 2) {
    centeredSelectors.push('& .ct7-popup-lead-line');
  }
  return {
    [centeredSelectors.join(', ')]: {
      textAlign: 'center',
      width: '100%'
    },
    '& .ct7-popup-body-text': { textAlign: 'left' },
    '& .ct7-popup-section-label': { textAlign: 'left' },
    '& .ct7-popup-section-title:not(.ct7-popup-lead-line)': { textAlign: 'left' },
    '& .ct7-popup-section-description': { textAlign: 'left' }
  };
}

export function colorTemplate7PopupErrorBarSx(overrides = {}) {
  return {
    width: '100%',
    bgcolor: '#c62828',
    color: '#fff',
    py: 1,
    px: 2,
    textAlign: 'center',
    fontFamily: MAIN_FONT_FAMILY,
    fontWeight: 600,
    fontSize: colorTemplate7PopupTextFontSizeResponsive,
    lineHeight: 1.35,
    ...overrides
  };
}
