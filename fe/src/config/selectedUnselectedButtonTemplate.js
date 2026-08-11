/**
 * Sidebar / menu button templates (screenshot spec).
 * SelectedButtonTemplate + UnSelectedButtonTemplate.
 * Label font: fe/.env MOBILE_FONT_SIZE_BUTTON (xs) / DESKTOP_FONT_SIZE_BUTTON (sm+).
 */
import { buttonFontSizeResponsive, buttonTemplateFontSizeSx } from 'config/buttonFontEnv';
import {
  buttonHoverMagnifyTransitionSx,
  buttonSelectedMagnifyFontSx,
  resolveHoverMagnifyFactor
} from 'config/hoverMagnifyEnv';
import { getDesktopIconFontSizeVw } from 'config/desktopFontEnv';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import {
  DAYNIGHT_VAR,
  INVERSE_DAYNIGHT_VAR,
  isBlackColor,
  isWhiteColor,
  PRIMARY_VAR,
  SECONDARY_VAR
} from 'utils/themeConfig';

export const BUTTON_TEMPLATE_CONTRAST_FLIP_WHITE = '#ffffff';
export const BUTTON_TEMPLATE_CONTRAST_FLIP_BLACK = '#000000';

/** Selected — theme secondary bg, inverse-daynight text + border. */
export const SELECTED_BUTTON_TEMPLATE_BG = `var(${SECONDARY_VAR})`;
export const SELECTED_BUTTON_TEMPLATE_TEXT = `var(${INVERSE_DAYNIGHT_VAR})`;
export const SELECTED_BUTTON_TEMPLATE_BORDER = `1px solid var(${INVERSE_DAYNIGHT_VAR})`;

/** Unselected — theme primary bg, daynight text + border. */
export const UNSELECTED_BUTTON_TEMPLATE_BG = `var(${PRIMARY_VAR})`;
export const UNSELECTED_BUTTON_TEMPLATE_TEXT = `var(${DAYNIGHT_VAR})`;
export const UNSELECTED_BUTTON_TEMPLATE_BORDER = `1px solid var(${DAYNIGHT_VAR})`;

export const SELECTED_UNSELECTED_BUTTON_BORDER_RADIUS = '12px';
/** Thick black border — Identification Verification and similar CT7 flows. */
export const BUTTON_TEMPLATE_THICK_BLACK_BORDER = '4px solid #000000';

export function resolveButtonTemplateBorder(border, thickBlackBorder = false) {
  return thickBlackBorder ? BUTTON_TEMPLATE_THICK_BLACK_BORDER : border;
}
/** Use env HOVER_MAGNIFY_FACTOR; pass hoverScale={1} to disable. Whole-button scale on hover (not label-only). */
export const SELECTED_UNSELECTED_BUTTON_HOVER_SCALE = null;
/** Use env HOVER_MAGNIFY_FACTOR; pass selectedLabelScale={1} to disable. */
export const SELECTED_UNSELECTED_BUTTON_SELECTED_LABEL_SCALE = null;

/** Button label — MOBILE_FONT_SIZE_BUTTON / DESKTOP_FONT_SIZE_BUTTON (fe/.env). */
export const SELECTED_UNSELECTED_BUTTON_FONT_SIZE = buttonFontSizeResponsive;

/** Selected — thin black box tightly around the label text (in addition to button bg). */
export const SELECTED_BUTTON_LABEL_TEXT_BOX_BORDER = '1px solid #000000';

export function buttonTemplateSelectedLabelTextBoxSx(overrides = {}) {
  return {
    border: SELECTED_BUTTON_LABEL_TEXT_BOX_BORDER,
    borderRadius: 0,
    boxSizing: 'border-box',
    px: '0.25em',
    py: '0.05em',
    lineHeight: 1.25,
    display: 'inline-block',
    maxWidth: '100%',
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
    ...overrides
  };
}

/** Selected tab/menu — label stays magnified until deselected (button box unchanged). */
export function buttonTemplateSelectedLabelScaleSx(selectedLabelScale = SELECTED_UNSELECTED_BUTTON_SELECTED_LABEL_SCALE) {
  const magnify = buttonSelectedMagnifyFontSx({
    baseFontSize: buttonFontSizeResponsive,
    magnifyScale: selectedLabelScale
  });
  if (!magnify || Object.keys(magnify).length === 0) return null;
  return {
    overflow: 'visible',
    ...magnify
  };
}
/** Shrink button width to label + padding/icons — not wider, not narrower. */
export function buttonTemplateFitLabelWidthSx() {
  return {
    width: 'max-content',
    minWidth: 'unset',
    maxWidth: '100%',
    flexShrink: 0
  };
}

/** One-line label — nowrap text; button width grows to fit label (not full-width stretch). */
export function buttonTemplateSingleLineLabelSx() {
  return {
    width: 'max-content',
    minWidth: 'max-content',
    maxWidth: '100%',
    flexShrink: 0,
    flexGrow: 0,
    whiteSpace: 'nowrap',
    overflow: 'visible',
    textOverflow: 'clip'
  };
}

/**
 * Button box fits label at template font size — wide enough for text, not full-width stretch.
 * Use in profile theme picker and similar compact label-driven controls.
 */
export function buttonTemplateSizeButtonToLabelSx() {
  return {
    width: 'fit-content',
    minWidth: 'max-content',
    maxWidth: '100%',
    flexShrink: 0,
    flexGrow: 0,
    justifyContent: 'center',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'visible',
    px: { xs: 1.25, sm: 1.75 },
    py: { xs: 0.75, sm: 0.875 }
  };
}

/**
 * Label font scales with button width (cqw), capped at MOBILE_/DESKTOP_FONT_SIZE_BUTTON.
 * Use with fullWidth equal columns when vw-only sizing would overflow narrow cells.
 */
export function buttonTemplateShrinkLabelToFitSx({
  maxFontSize = buttonFontSizeResponsive
} = {}) {
  const maxXs = maxFontSize.xs;
  const maxSm = maxFontSize.sm;
  const labelFontSx = {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'clip',
    lineHeight: 1.2,
    // Scale with button inline size so equal-column grids (theme picker) never spill.
    fontSize: `min(${maxXs}, max(0.45rem, 3.6cqw)) !important`,
    '@media (min-width: 600px)': {
      fontSize: `min(${maxSm}, max(0.5rem, 3.4cqw)) !important`
    }
  };
  return {
    containerType: 'inline-size',
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    ...labelFontSx,
    '&.MuiButton-root': labelFontSx,
    '&.MuiButton-sizeSmall': labelFontSx,
    '& .MuiButton-label': {
      display: 'block',
      width: '100%',
      minWidth: 0,
      maxWidth: '100%',
      ...labelFontSx
    }
  };
}

/** Label measurement helpers for fitLabelOnResize (see useFitButtonLabelOnResize). */
export function buttonTemplateFitLabelOnResizeSx() {
  return {
    overflow: 'visible !important',
    whiteSpace: 'nowrap',
    minWidth: 0,
    maxWidth: '100%',
    textOverflow: 'clip'
  };
}

/** Full-color PNGs in the sidebar — do not apply text-color CSS filters. */
export const SIDEBAR_MENU_ICON_CLASS = 'sidebar-menu-icon';

function readVwNumber(value, fallback) {
  const parsed = Number(String(value ?? '').trim());
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, 25);
}

/** fe/.env DESKTOP_FONT_SIZE_ICON (xs falls back to same env when MOBILE_FONT_SIZE_ICON unset). */
export const buttonTemplateIconSizeResponsive = {
  xs: `${readVwNumber(import.meta.env.MOBILE_FONT_SIZE_ICON ?? import.meta.env.DESKTOP_FONT_SIZE_ICON, 2)}vw`,
  sm: getDesktopIconFontSizeVw()
};

/** PNG icon inside Selected/UnSelected button templates — default size from env. */
export function buttonTemplateIconSx(overrides = {}) {
  return {
    width: buttonTemplateIconSizeResponsive,
    height: buttonTemplateIconSizeResponsive,
    objectFit: 'contain',
    display: 'block',
    flexShrink: 0,
    ...overrides
  };
}

const menuButtonShadow =
  '0px 3px 1px -2px rgba(0,0,0,0.2), 0px 2px 2px 0px rgba(0,0,0,0.14), 0px 1px 5px 0px rgba(0,0,0,0.12)';

function iconFilterForText(text) {
  return text === '#ffffff' ||
    text === '#fff' ||
    text === BUTTON_TEMPLATE_CONTRAST_FLIP_WHITE ||
    text === UNSELECTED_BUTTON_TEMPLATE_TEXT
    ? 'brightness(0) invert(1)'
    : 'none';
}

/** 25% larger button box on hover — fe/.env HOVER_MAGNIFY_FACTOR (default 1.25). hoverScale={1} disables. */
export function buttonTemplateHoverBoxScaleOnHoverSx(
  hoverScale = SELECTED_UNSELECTED_BUTTON_HOVER_SCALE,
  transformOrigin = 'left center'
) {
  const factor = resolveHoverMagnifyFactor(hoverScale);
  if (factor <= 1) return null;
  return {
    transform: `scale(${factor})`,
    transformOrigin,
    position: 'relative',
    zIndex: 1
  };
}

/** Resolve theme CSS vars / literals to a computed rgb/hex string (browser only). */
function resolveButtonTemplateCssColor(value, property = 'color') {
  const raw = String(value ?? '').trim();
  if (!raw) return raw;
  const stripped = raw.replace(/^1px solid /i, '').trim();
  if (typeof document === 'undefined') return stripped;
  if (!stripped.startsWith('var(')) return stripped;

  const probe = document.createElement('span');
  probe.style.position = 'absolute';
  probe.style.left = '-9999px';
  probe.style.visibility = 'hidden';
  if (property === 'backgroundColor') {
    probe.style.backgroundColor = stripped;
  } else {
    probe.style.color = stripped;
  }
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe);
  const resolved = property === 'backgroundColor' ? computed.backgroundColor : computed.color;
  document.body.removeChild(probe);
  return resolved;
}

/**
 * Last-pass contrast filter: black bg + black text → white text; white bg + white text → black text.
 * @returns {string} text color to use (original or flipped)
 */
export function buttonTemplateContrastFlipTextColor(bg, text) {
  const resolvedBg = resolveButtonTemplateCssColor(bg, 'backgroundColor');
  const resolvedText = resolveButtonTemplateCssColor(text, 'color');
  if (isBlackColor(resolvedBg) && isBlackColor(resolvedText)) {
    return BUTTON_TEMPLATE_CONTRAST_FLIP_WHITE;
  }
  if (isWhiteColor(resolvedBg) && isWhiteColor(resolvedText)) {
    return BUTTON_TEMPLATE_CONTRAST_FLIP_BLACK;
  }
  return text;
}

function hoverBlock(bg, text, border, hoverScale, transformOrigin = 'left center') {
  return {
    bgcolor: `${bg} !important`,
    color: `${text} !important`,
    border: `${border} !important`,
    ...buttonTemplateHoverBoxScaleOnHoverSx(hoverScale, transformOrigin),
    '& .MuiListItemIcon-root': { color: `${text} !important` },
    '& .MuiTypography-root': { color: `${text} !important`, WebkitTextFillColor: `${text} !important` },
    '& .MuiButton-startIcon': { color: `${text} !important` },
    '& svg': { color: `${text} !important` },
    [`& img:not(.${SIDEBAR_MENU_ICON_CLASS})`]: { filter: iconFilterForText(text) }
  };
}

export function baseButtonSx(bg, text, border, hoverScale, {
  fitLabelWidth = false,
  sizeButtonToLabel = false,
  shrinkLabelToFit = false,
  shrinkLabelMaxFontSize,
  transformOrigin = 'left center',
  thickBlackBorder = false
} = {}) {
  const resolvedBorder = resolveButtonTemplateBorder(border, thickBlackBorder);
  return {
    fontFamily: MAIN_FONT_FAMILY,
    ...(shrinkLabelToFit
      ? buttonTemplateShrinkLabelToFitSx(
          shrinkLabelMaxFontSize ? { maxFontSize: shrinkLabelMaxFontSize } : undefined
        )
      : buttonTemplateFontSizeSx()),
    fontWeight: 600,
    textTransform: 'none',
    lineHeight: 1.35,
    borderRadius: SELECTED_UNSELECTED_BUTTON_BORDER_RADIUS,
    boxShadow: menuButtonShadow,
    bgcolor: `${bg} !important`,
    color: `${text} !important`,
    WebkitTextFillColor: `${text} !important`,
    border: `${resolvedBorder} !important`,
    transform: 'scale(1)',
    ...buttonHoverMagnifyTransitionSx,
    transition: `${buttonHoverMagnifyTransitionSx.transition}, transform 0.15s ease`,
    transformOrigin,
    ...(sizeButtonToLabel
      ? buttonTemplateSizeButtonToLabelSx()
      : fitLabelWidth
        ? buttonTemplateFitLabelWidthSx()
        : null),
    '& .MuiListItemIcon-root': { color: `${text} !important` },
    '& .MuiTypography-root': {
      color: `${text} !important`,
      WebkitTextFillColor: `${text} !important`
    },
    '& .MuiButton-startIcon': { color: `${text} !important` },
    '& svg': { color: `${text} !important` },
    [`& img.${SIDEBAR_MENU_ICON_CLASS}`]: buttonTemplateIconSx(),
    [`& img:not(.${SIDEBAR_MENU_ICON_CLASS})`]: { filter: iconFilterForText(text) },
    '@media (hover: hover)': {
      '&:hover': hoverBlock(bg, text, resolvedBorder, hoverScale, transformOrigin)
    }
  };
}

/** Exit to Mall — unselected base with red hover (sidebar). Merge into `UnSelectedButtonTemplate` `sx`. */
export function exitToMallUnselectedButtonHoverSx({
  hoverScale = SELECTED_UNSELECTED_BUTTON_HOVER_SCALE,
  transformOrigin = 'left center'
} = {}) {
  return {
    transformOrigin,
    '@media (hover: hover)': {
      '&:hover': {
        bgcolor: 'var(--theme-error-color) !important',
        color: 'var(--theme-white-color) !important',
        WebkitTextFillColor: 'var(--theme-white-color) !important',
        border: '1px solid var(--theme-error-color) !important',
        ...buttonTemplateHoverBoxScaleOnHoverSx(hoverScale, transformOrigin),
        '& .MuiButton-startIcon': { color: 'var(--theme-white-color) !important' },
        '& svg': { color: 'var(--theme-white-color) !important' }
      }
    }
  };
}
