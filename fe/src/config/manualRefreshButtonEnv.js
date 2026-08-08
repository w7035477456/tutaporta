/** Vetted Friends poem + refresh hint (matches My Story / filter dialogs). */
import { buttonHoverMagnifyFontSx, buttonHoverMagnifyTransitionSx } from 'config/hoverMagnifyEnv';
import { buttonFontSizeResponsive } from 'config/buttonFontEnv';
import { MAIN_FONT_FAMILY } from './mainFontEnv';
import { COLOR_TEMPLATE1_TEXT_UNSELECTED } from './colorTemplate1';

/** Four-line poem blocks on Vetted Friends / Send Flower (script display face). */
export const ZAPFINO_FONT_FAMILY = 'Zapfino, "Apple Chancery", "Snell Roundhand", "URW Chancery L", cursive';

const MANUAL_REFRESH_HINT_ROW2 =
  "We don't auto-refresh to ensure the app stays lightning-fast for everyone.";

/** Picks & Posts — two single-line rows below Refresh Posts. */
export const MANUAL_REFRESH_POSTS_HINT_LINES = [
  "Want to see what's new? Tap 'Refresh Posts' to update your feed and messages.",
  MANUAL_REFRESH_HINT_ROW2
];

/** @deprecated Prefer MANUAL_REFRESH_POSTS_HINT_LINES */
export const MANUAL_REFRESH_POSTS_HINT = MANUAL_REFRESH_POSTS_HINT_LINES.join('\n');

/** Vetted Friends — two single-line rows below Refresh Posts & Chats. */
export const MANUAL_REFRESH_POSTS_AND_CHATS_HINT_LINES = [
  "Want to see what's new? Tap 'Refresh Posts & Chats' to update your feed and messages.",
  MANUAL_REFRESH_HINT_ROW2
];

/** @deprecated Prefer MANUAL_REFRESH_POSTS_AND_CHATS_HINT_LINES */
export const MANUAL_REFRESH_POSTS_AND_CHATS_HINT = MANUAL_REFRESH_POSTS_AND_CHATS_HINT_LINES.join('\n');

/** @deprecated Use MANUAL_REFRESH_POSTS_AND_CHATS_HINT */
export const MANUAL_REFRESH_CHAT_HINT = MANUAL_REFRESH_POSTS_AND_CHATS_HINT;

/** Shared bright-yellow manual-refresh buttons (My Picks posts, vetted friends chat). */
export const MANUAL_REFRESH_BUTTON_SX = {
  textTransform: 'none',
  fontWeight: 700,
  fontSize: buttonFontSizeResponsive,
  bgcolor: '#ffeb3b',
  color: '#000',
  borderRadius: 2,
  border: '2px solid #000',
  minWidth: { xs: 220, sm: 300 },
  px: { xs: 4, sm: 6 },
  py: { xs: 1.1, sm: 1.35 },
  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
  transformOrigin: 'center',
  ...buttonHoverMagnifyTransitionSx,
  '&:hover': {
    bgcolor: '#fff176',
    color: '#000',
    borderColor: '#000',
    boxShadow: '0 3px 8px rgba(0,0,0,0.25)',
    ...buttonHoverMagnifyFontSx({ baseFontSize: buttonFontSizeResponsive })
  },
  '&:disabled': {
    bgcolor: 'rgba(255, 235, 59, 0.45)',
    color: 'rgba(0,0,0,0.45)',
    borderColor: 'rgba(0,0,0,0.35)'
  }
};

const MANUAL_REFRESH_HINT_LINE_BASE_SX = {
  textAlign: 'center',
  color: COLOR_TEMPLATE1_TEXT_UNSELECTED,
  WebkitTextFillColor: COLOR_TEMPLATE1_TEXT_UNSELECTED,
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 600,
  fontSize: { xs: '3vw', sm: '0.95vw' },
  lineHeight: 1.45,
  whiteSpace: 'nowrap'
};

/** Wrapper for exactly two no-wrap hint lines under manual refresh. */
export function getManualRefreshHintContainerSx() {
  return {
    mt: 1,
    px: { xs: 1, sm: 2 },
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    maxWidth: '100%',
    mx: 'auto',
    overflowX: 'auto'
  };
}

/** One hint line — no wrap (two lines total when rendered twice). */
export function getManualRefreshHintLineSx() {
  return MANUAL_REFRESH_HINT_LINE_BASE_SX;
}

/** @deprecated Prefer getManualRefreshHintContainerSx + getManualRefreshHintLineSx */
export function getManualRefreshHintSx() {
  return MANUAL_REFRESH_HINT_LINE_BASE_SX;
}
