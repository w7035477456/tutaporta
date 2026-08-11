/**
 * Top-right delete “X” controls on posting feed cards (My Picks, Vetted Friends, My Story).
 * Yellow X with black stroke tracing the letter — not a rectangular box border.
 */
import { hoverMagnifyCalcFontSize } from 'config/hoverMagnifyEnv';
import { getMyPicksRemoveButtonInset, getMyPicksRemoveIconSize } from 'config/myPicksCardEnv';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { ERROR_VAR, YELLOW_VAR } from 'utils/themeConfig';

const removeIconSize = getMyPicksRemoveIconSize();
const removeInset = getMyPicksRemoveButtonInset();

export const POSTING_FEED_DELETE_X_COLOR = `var(${YELLOW_VAR})`;
export const POSTING_FEED_DELETE_X_STROKE = '4px var(--theme-primary-color)';
export const POSTING_FEED_PHOTO_DELETE_X_COLOR = `var(${ERROR_VAR})`;
export const POSTING_FEED_PHOTO_DELETE_X_STROKE = '4px var(--theme-primary-color)';
export const POSTING_FEED_DELETE_X_SIZE_MULTIPLIER = 4;
function postingFeedDeleteButtonBaseSx(overrides = {}) {
  const sizeMul = POSTING_FEED_DELETE_X_SIZE_MULTIPLIER;
  const baseFontSize = `calc(${removeIconSize} * ${sizeMul})`;
  return {
    position: 'absolute',
    top: removeInset.top,
    right: removeInset.right,
    zIndex: 2,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 'auto',
    height: 'auto',
    minWidth: 0,
    p: 0,
    m: 0,
    border: 'none',
    borderRadius: 0,
    boxSizing: 'border-box',
    cursor: 'pointer',
    bgcolor: 'transparent',
    boxShadow: 'none',
    fontFamily: MAIN_FONT_FAMILY,
    fontSize: baseFontSize,
    fontWeight: 800,
    lineHeight: 1,
    color: POSTING_FEED_DELETE_X_COLOR,
    WebkitTextFillColor: POSTING_FEED_DELETE_X_COLOR,
    WebkitTextStroke: POSTING_FEED_DELETE_X_STROKE,
    paintOrder: 'stroke fill',
    transformOrigin: 'top right',
    transition: 'font-size 0.15s ease',
    '@media (hover: hover)': {
      '&:hover:not(:disabled)': {
        bgcolor: 'transparent',
        boxShadow: 'none',
        fontSize: hoverMagnifyCalcFontSize(baseFontSize)
      }
    },
    '&:active:not(:disabled)': {
      boxShadow: 'none'
    },
    '&:disabled': {
      bgcolor: 'transparent',
      cursor: 'not-allowed',
      opacity: 0.3,
      boxShadow: 'none'
    },
    ...overrides
  };
}

/** Top-right of each posting photo — red X. */
export function postingFeedPhotoDeleteButtonSx(overrides = {}) {
  return postingFeedDeleteButtonBaseSx({
    color: POSTING_FEED_PHOTO_DELETE_X_COLOR,
    WebkitTextFillColor: POSTING_FEED_PHOTO_DELETE_X_COLOR,
    WebkitTextStroke: POSTING_FEED_PHOTO_DELETE_X_STROKE,
    ...overrides
  });
}

/** Top-right of entire posting card. */
export function postingFeedPostDeleteButtonSx(overrides = {}) {
  return postingFeedDeleteButtonBaseSx(overrides);
}

/** Extra right padding on post header when the delete X is shown. */
export function postingFeedPostHeaderPaddingSx(showDeleteButton = false) {
  return showDeleteButton ? { pr: { xs: 7.5, sm: 8.5 } } : {};
}

/** Spinner size while delete is in progress — matches remove X icon. */
export function postingFeedDeleteSpinnerSx(overrides = {}) {
  return {
    color: 'inherit',
    width: `calc(${removeIconSize} * ${POSTING_FEED_DELETE_X_SIZE_MULTIPLIER})`,
    height: `calc(${removeIconSize} * ${POSTING_FEED_DELETE_X_SIZE_MULTIPLIER})`,
    ...overrides
  };
}
