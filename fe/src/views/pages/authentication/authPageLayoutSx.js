import {
  getDesktopButtonFontSizeVw,
  getDesktopTextFontSizeVw,
  getDesktopTitleFontSizeVw
} from 'config/desktopFontEnv';
import {
  getMobileSinglesButtonFontSizeVw,
  getMobileSinglesTextFontSizeVw,
  getMobileSinglesTitleFontSizeVw
} from 'config/singlesMemberCardFontEnv';
import { getLegalRightLeftMarginVw, getLegalTopMarginVh, getLegalBottomMarginVh } from 'config/legalDialogEnv';
import { getAuthFooterHeightVh } from 'config/authFooterEnv';
import {
  getAuthDialogMarginBottomVh,
  getAuthDialogMarginTopVh,
  getAuthDialogSideMarginVwDesktop,
  getAuthDialogSideMarginVwMobile,
  getAuthDialogWidthVwDesktop,
  getAuthDialogWidthVwMobile
} from 'config/standardAuthDialogEnv';
import { buttonHoverMagnifyTransitionSx } from 'config/hoverMagnifyEnv';

/** Whole-control hover scale on login / register (Google, Sign In, text links). */
export const AUTH_INTERACTIVE_HOVER_SCALE = 1.25;

const authHoverScaleTransitionSx = {
  transformOrigin: 'center center',
  transform: 'scale(1)',
  transition: `${buttonHoverMagnifyTransitionSx.transition}, transform 0.15s ease`
};

/** Typography / Router Link rows — magnify the whole link on hover. */
export const authLinkHoverScaleSx = {
  display: 'inline-block',
  ...authHoverScaleTransitionSx,
  '@media (hover: hover)': {
    '&:hover': {
      transform: `scale(${AUTH_INTERACTIVE_HOVER_SCALE})`
    }
  }
};

/** MUI Button on auth pages — magnify the whole button on hover (disabled rows unchanged). */
export const authButtonHoverScaleSx = {
  ...authHoverScaleTransitionSx,
  '@media (hover: hover)': {
    '&:hover:not(.Mui-disabled):not(:disabled)': {
      position: 'relative',
      zIndex: 2,
      transform: `scale(${AUTH_INTERACTIVE_HOVER_SCALE})`
    }
  }
};

/**
 * fe/.env MOBILE_FONT_SIZE_BUTTON / DESKTOP_FONT_SIZE_BUTTON — auth form fields, copy, and primary buttons.
 */
export const authEnvButtonFontSize = {
  xs: getMobileSinglesButtonFontSizeVw(),
  sm: getDesktopButtonFontSizeVw()
};

/** fe/.env MOBILE_FONT_SIZE_TEXT / DESKTOP_FONT_SIZE_TEXT */
export const authEnvTextFontSize = {
  xs: getMobileSinglesTextFontSizeVw(),
  sm: getDesktopTextFontSizeVw()
};

/** fe/.env MOBILE_FONT_SIZE_TITLE / DESKTOP_FONT_SIZE_TITLE */
export const authEnvTitleFontSize = {
  xs: getMobileSinglesTitleFontSizeVw(),
  sm: getDesktopTitleFontSizeVw()
};

/** Merge into MUI `Button` `sx` on auth pages so labels stay bold (matches global theme). */
export const authButtonBoldSx = {
  fontWeight: '700 !important',
  fontSize: authEnvButtonFontSize
};

/**
 * Login, sign up, create password, phone verification — form fields, labels, helper copy, links in the blue callout areas.
 */
export const authFormContentSx = {
  '& .MuiInputLabel-root': { fontSize: authEnvButtonFontSize },
  '& .MuiInputBase-input': { fontSize: authEnvTextFontSize },
  '& .MuiInputBase-input:-webkit-autofill': { fontSize: authEnvTextFontSize },
  '& .MuiFormControlLabel-label': { fontSize: authEnvButtonFontSize },
  '& .MuiTypography-body2': { fontSize: authEnvButtonFontSize },
  '& .MuiTypography-subtitle1': { fontSize: authEnvButtonFontSize },
  '& .MuiTypography-caption': { fontSize: authEnvButtonFontSize }
};

/** Sign up form: fields/buttons use BUTTON size; body copy uses TEXT size */
export const authRegisterFormContentSx = {
  ...authFormContentSx,
  '& .MuiTypography-body2': { fontSize: authEnvTextFontSize },
  '& .MuiTypography-caption': { fontSize: authEnvTextFontSize }
};

/** Fills fixed AuthWrapper1; main column grows so footer can sit at viewport bottom */
export const authShellStackSx = {
  flex: 1,
  minHeight: 0,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box'
};

/** Space above fixed AuthFooter (matches FOOTER_HEIGHT vh from fe/.env) */
export const authFixedFooterContentPaddingBottom = { pb: `${getAuthFooterHeightVh()}vh` };

/**
 * About / Terms / Privacy: margins from fe/.env (same scroll column, not FOOTER_HEIGHT).
 * - FOOTERPAGES_RIGHT_LEFT_MARGIN => left/right % of vw
 * - FOOTERPAGES_TOP_MARGIN => top % of vh
 * - FOOTERPAGES_BOT_MARGIN => bottom % of vh
 */
const legalRightLeftMarginVw = getLegalRightLeftMarginVw();
const legalTopMarginVh = getLegalTopMarginVh();
const legalBottomMarginVh = getLegalBottomMarginVh();
const legalWidthVw = Math.max(0, 100 - legalRightLeftMarginVw * 2);

export const legalInfoDialogScrollSx = {
  width: `${legalWidthVw}vw`,
  maxWidth: `${legalWidthVw}vw`,
  ml: `${legalRightLeftMarginVw}vw`,
  mr: `${legalRightLeftMarginVw}vw`,
  mt: `${legalTopMarginVh}vh`,
  mb: `${legalBottomMarginVh}vh`,
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  overflowX: 'hidden',
  boxSizing: 'border-box',
  WebkitOverflowScrolling: 'touch'
};

const standardDialogWidthVwMobile = getAuthDialogWidthVwMobile();
const standardDialogWidthVwDesktop = getAuthDialogWidthVwDesktop();
const standardDialogSideVwMobile = getAuthDialogSideMarginVwMobile();
const standardDialogSideVwDesktop = getAuthDialogSideMarginVwDesktop();
const standardDialogTopVh = getAuthDialogMarginTopVh();
const standardDialogBottomVh = getAuthDialogMarginBottomVh();

/**
 * Auth dialogs — not legal pages. Below `md`: DIALOG_WIDTH_MOBILE; `md`+: DIALOG_WIDTH_DESKTOP.
 * Side margins = (100 − width) / 2 per breakpoint. DIALOG_MARGIN_TOP / DIALOG_MARGIN_BOT = vh.
 */
export const standardAuthDialogScrollSx = {
  width: { xs: `${standardDialogWidthVwMobile}vw`, md: `${standardDialogWidthVwDesktop}vw` },
  maxWidth: { xs: `${standardDialogWidthVwMobile}vw`, md: `${standardDialogWidthVwDesktop}vw` },
  ml: { xs: `${standardDialogSideVwMobile}vw`, md: `${standardDialogSideVwDesktop}vw` },
  mr: { xs: `${standardDialogSideVwMobile}vw`, md: `${standardDialogSideVwDesktop}vw` },
  mt: `${standardDialogTopVh}vh`,
  mb: `${standardDialogBottomVh}vh`,
  maxHeight: `calc(100dvh - ${standardDialogTopVh}vh - ${standardDialogBottomVh}vh)`,
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  overflowX: 'hidden',
  boxSizing: 'border-box',
  WebkitOverflowScrolling: 'touch',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch'
};

/** Inner column inside standardAuthDialogScrollSx (fills scroll area on mobile). */
export const standardAuthDialogInnerColumnSx = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  flex: { xs: '1 1 0', md: 'none' },
  minHeight: { xs: 0, md: 'auto' }
};
