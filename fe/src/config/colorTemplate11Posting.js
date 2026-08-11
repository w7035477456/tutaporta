/**
 * ColorTemplate11Posting — unified posting feed (My Story + Vetted Friends / My Picks).
 * Resizable proportional photos, visibility dropdown, delete X, actions bar, load-more pills.
 */
import { buttonHoverMagnifyFontSx, buttonHoverMagnifyTransitionSx, templateButtonMagnifySx } from 'config/hoverMagnifyEnv';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { getDesktopIconFontSizeVw, getDesktopTextFontSizeVw, getDesktopButtonFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesButtonFontSizeVw, getMobileSinglesTextFontSizeVw } from 'config/singlesMemberCardFontEnv';
import { getMyPicksRemoveButtonInset } from 'config/myPicksCardEnv';
import {
  yellowButtonVisibilitySelectMenuProps,
  yellowButtonVisibilitySelectSx,
  YELLOW_BUTTON_TEMPLATE_BG
} from 'config/yellowButtonTemplate';
import { ERROR_VAR, YELLOW_VAR } from 'utils/themeConfig';
import { formatAliasWithMemberCode } from 'utils/memberLabel';

function readIconVwNumber(value, fallback = 2) {
  const parsed = Number(String(value ?? '').trim());
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, 25);
}

/** Delete “X” font size — fe/.env DESKTOP_FONT_SIZE_ICON (MOBILE_FONT_SIZE_ICON on xs when set). */
export const colorTemplate11PostingDeleteXFontSize = {
  xs: `${readIconVwNumber(import.meta.env.MOBILE_FONT_SIZE_ICON ?? import.meta.env.DESKTOP_FONT_SIZE_ICON, 2)}vw`,
  sm: getDesktopIconFontSizeVw()
};

export const COLOR_TEMPLATE11_POSTING_DELETE_X_COLOR = `var(${YELLOW_VAR})`;
export const COLOR_TEMPLATE11_POSTING_DELETE_X_STROKE = '2px var(--theme-primary-color)';

const colorTemplate11PostingRemoveInset = getMyPicksRemoveButtonInset();

export const COLOR_TEMPLATE11_POSTING_INITIAL_LIMIT = 5;

/** Photo cell + post card background — theme day/night (follows active theme). */
export const COLOR_TEMPLATE11_POSTING_PHOTO_CELL_BG = 'var(--theme-daynight-color)';

export const COLOR_TEMPLATE11_POSTING_PHOTO_HEIGHTS_STORAGE_KEY = 'colorTemplate11PostingPhotoHeights_v1';
/** Feed-level slider — applied to all posts in a ColorTemplate11Posting feed. */
export const COLOR_TEMPLATE11_POSTING_FEED_PHOTO_HEIGHT_KEY = 'colorTemplate11PostingFeedPhotoHeight_v1';
export const COLOR_TEMPLATE11_POSTING_PHOTO_DEFAULT_VH = 25;
export const COLOR_TEMPLATE11_POSTING_PHOTO_MIN_VH = 15;
export const COLOR_TEMPLATE11_POSTING_PHOTO_MAX_VH = 80;

export const COLOR_TEMPLATE11_POSTING_VISIBILITY_SELECT_HEIGHT = Math.round(30 * 1.3);

export const colorTemplate11PostingTextFontSize = {
  xs: getMobileSinglesTextFontSizeVw(),
  sm: getDesktopTextFontSizeVw()
};

export const colorTemplate11PostingButtonFontSize = {
  xs: getMobileSinglesTextFontSizeVw(),
  sm: getDesktopButtonFontSizeVw()
};

/** Next 2/5/10 pills — fe/.env MOBILE_FONT_SIZE_BUTTON / DESKTOP_FONT_SIZE_BUTTON */
export const colorTemplate11PostingLoadMoreButtonFontSize = {
  xs: getMobileSinglesButtonFontSizeVw(),
  sm: getDesktopButtonFontSizeVw()
};

export function normalizeColorTemplate11PostingVisibility(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'friends') return 'friends';
  if (raw === 'myself' || raw === 'me_only' || raw === 'me-only' || raw === 'private') return 'mySelf';
  return 'public';
}

import { formatUserDateTime } from 'utils/userTimeZone';

export function formatColorTemplate11PostingDate(value, userTimeZoneProfile = null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  if (userTimeZoneProfile && (userTimeZoneProfile.zip || userTimeZoneProfile.phone)) {
    return formatUserDateTime(date, userTimeZoneProfile);
  }
  return date.toLocaleString();
}

export function getColorTemplate11PostingPhotoDefaultHeightPx(viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800) {
  return Math.round((viewportHeight * COLOR_TEMPLATE11_POSTING_PHOTO_DEFAULT_VH) / 100);
}

export function clampColorTemplate11PostingPhotoHeightPx(px, viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800) {
  const min = Math.round((viewportHeight * COLOR_TEMPLATE11_POSTING_PHOTO_MIN_VH) / 100);
  const max = Math.round((viewportHeight * COLOR_TEMPLATE11_POSTING_PHOTO_MAX_VH) / 100);
  const n = Number(px);
  if (!Number.isFinite(n)) return getColorTemplate11PostingPhotoDefaultHeightPx(viewportHeight);
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function readColorTemplate11PostingPhotoHeightsMap() {
  try {
    const raw = localStorage.getItem(COLOR_TEMPLATE11_POSTING_PHOTO_HEIGHTS_STORAGE_KEY);
    let parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object') parsed = {};
    const legacyRaw = localStorage.getItem('myStoryPostingPhotoHeights_v1');
    if (legacyRaw && Object.keys(parsed).length === 0) {
      const legacyParsed = JSON.parse(legacyRaw);
      if (legacyParsed && typeof legacyParsed === 'object') {
        parsed = legacyParsed;
        localStorage.setItem(COLOR_TEMPLATE11_POSTING_PHOTO_HEIGHTS_STORAGE_KEY, JSON.stringify(parsed));
      }
    }
    return parsed;
  } catch {
    return {};
  }
}

export function writeColorTemplate11PostingPhotoHeight(postId, heightPx) {
  const map = readColorTemplate11PostingPhotoHeightsMap();
  map[String(postId)] = heightPx;
  localStorage.setItem(COLOR_TEMPLATE11_POSTING_PHOTO_HEIGHTS_STORAGE_KEY, JSON.stringify(map));
}

export function writeColorTemplate11PostingPhotoHeightsForPostIds(postIds, heightPx) {
  const clamped = clampColorTemplate11PostingPhotoHeightPx(heightPx);
  const map = readColorTemplate11PostingPhotoHeightsMap();
  for (const postId of postIds || []) {
    if (postId == null || postId === '') continue;
    map[String(postId)] = clamped;
  }
  localStorage.setItem(COLOR_TEMPLATE11_POSTING_PHOTO_HEIGHTS_STORAGE_KEY, JSON.stringify(map));
  return clamped;
}

export function readColorTemplate11PostingFeedPhotoHeightPx(viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800) {
  try {
    const raw = localStorage.getItem(COLOR_TEMPLATE11_POSTING_FEED_PHOTO_HEIGHT_KEY);
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) {
      return clampColorTemplate11PostingPhotoHeightPx(n, viewportHeight);
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function writeColorTemplate11PostingFeedPhotoHeightPx(heightPx, viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800) {
  const clamped = clampColorTemplate11PostingPhotoHeightPx(heightPx, viewportHeight);
  try {
    localStorage.setItem(COLOR_TEMPLATE11_POSTING_FEED_PHOTO_HEIGHT_KEY, String(clamped));
  } catch {
    /* ignore */
  }
  return clamped;
}

export function readColorTemplate11PostingFeedInitialPhotoHeightPx(
  postIds,
  viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
) {
  const feedHeight = readColorTemplate11PostingFeedPhotoHeightPx(viewportHeight);
  if (feedHeight != null) return feedHeight;

  const ids = (postIds || []).map((id) => String(id)).filter(Boolean);
  if (ids.length) {
    const map = readColorTemplate11PostingPhotoHeightsMap();
    const heights = ids.map((id) => map[id]).filter((n) => Number.isFinite(n) && n > 0);
    if (heights.length === ids.length && heights.every((h) => h === heights[0])) {
      return clampColorTemplate11PostingPhotoHeightPx(heights[0], viewportHeight);
    }
  }
  return getColorTemplate11PostingPhotoDefaultHeightPx(viewportHeight);
}

export function getColorTemplate11PostingPhotoHeightBoundsPx(viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800) {
  return {
    minPx: Math.round((viewportHeight * COLOR_TEMPLATE11_POSTING_PHOTO_MIN_VH) / 100),
    maxPx: Math.round((viewportHeight * COLOR_TEMPLATE11_POSTING_PHOTO_MAX_VH) / 100),
    stepPx: Math.max(1, Math.round(viewportHeight / 100))
  };
}

export function colorTemplate11PostingPhotoHeightPxToVh(heightPx, viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800) {
  const vh = viewportHeight > 0 ? (Number(heightPx) / viewportHeight) * 100 : COLOR_TEMPLATE11_POSTING_PHOTO_DEFAULT_VH;
  return Math.round(vh);
}

export const COLOR_TEMPLATE11_POSTING_PHOTO_FULLSCREEN_HINT =
  '(Double click on photos/videos to view full screen · double-click post text to edit)';

export function colorTemplate11PostingPhotoZoomBarSx(overrides = {}) {
  return {
    position: 'sticky',
    top: 0,
    zIndex: 4,
    display: 'flex',
    alignItems: 'center',
    gap: { xs: 0.75, sm: 1 },
    px: { xs: 1, sm: 1.5 },
    py: { xs: 0.75, sm: 1 },
    bgcolor: YELLOW_BUTTON_TEMPLATE_BG,
    borderBottom: '2px solid var(--theme-primary-color)',
    flexShrink: 0,
    flexWrap: 'wrap',
    ...overrides
  };
}

/** Zoom −/+ icons, slider, and Nvh readout on the yellow photo-size bar. */
export const COLOR_TEMPLATE11_POSTING_PHOTO_ZOOM_ACCENT = `var(${ERROR_VAR})`;

export function colorTemplate11PostingPhotoZoomIconButtonSx(overrides = {}) {
  return {
    color: `${COLOR_TEMPLATE11_POSTING_PHOTO_ZOOM_ACCENT} !important`,
    ...overrides
  };
}

export function colorTemplate11PostingPhotoZoomVhLabelSx(overrides = {}) {
  return {
    minWidth: { xs: 34, sm: 40 },
    textAlign: 'right',
    fontWeight: 700,
    color: COLOR_TEMPLATE11_POSTING_PHOTO_ZOOM_ACCENT,
    WebkitTextFillColor: COLOR_TEMPLATE11_POSTING_PHOTO_ZOOM_ACCENT,
    fontSize: { xs: '0.8rem', sm: '0.9rem' },
    flexShrink: 0,
    ...overrides
  };
}

export function colorTemplate11PostingPhotoZoomSliderSx(overrides = {}) {
  const accent = COLOR_TEMPLATE11_POSTING_PHOTO_ZOOM_ACCENT;
  return {
    color: accent,
    flex: 1,
    mx: 0.5,
    '& .MuiSlider-thumb': {
      width: 18,
      height: 18,
      bgcolor: `${accent} !important`,
      border: '2px solid #000'
    },
    '& .MuiSlider-track': {
      bgcolor: `${accent} !important`,
      border: 'none'
    },
    '& .MuiSlider-rail': {
      opacity: 0.45,
      bgcolor: `${accent} !important`
    },
    ...overrides
  };
}

export function colorTemplate11PostingPhotoFullscreenHintSx(overrides = {}) {
  return {
    ml: { xs: 0, sm: 'auto' },
    flex: { xs: '1 1 100%', sm: '0 1 auto' },
    textAlign: { xs: 'center', sm: 'right' },
    fontWeight: 700,
    color: COLOR_TEMPLATE11_POSTING_PHOTO_ZOOM_ACCENT,
    WebkitTextFillColor: COLOR_TEMPLATE11_POSTING_PHOTO_ZOOM_ACCENT,
    fontSize: colorTemplate11PostingTextFontSize,
    lineHeight: 1.2,
    ...overrides
  };
}

export function colorTemplate11PostingVisibilitySelectSx(overrides = {}) {
  return {
    ...yellowButtonVisibilitySelectSx({
      fontSize: colorTemplate11PostingButtonFontSize,
      height: COLOR_TEMPLATE11_POSTING_VISIBILITY_SELECT_HEIGHT
    }),
    ...(overrides || {})
  };
}

export function colorTemplate11PostingVisibilityMenuProps(overrides = {}) {
  return yellowButtonVisibilitySelectMenuProps({
    fontSize: colorTemplate11PostingButtonFontSize,
    height: COLOR_TEMPLATE11_POSTING_VISIBILITY_SELECT_HEIGHT,
    ...(overrides || {})
  });
}

export function colorTemplate11PostingPanelTextSx(overrides = {}) {
  return {
    fontSize: colorTemplate11PostingTextFontSize,
    ...overrides
  };
}

function colorTemplate11PostingFeedScrollbarSx() {
  return {
    overscrollBehaviorY: 'contain',
    scrollbarGutter: 'stable',
    scrollbarColor: (theme) =>
      `${theme.palette.mode === 'dark' ? 'var(--theme-secondary-color)' : 'var(--theme-primary-color)'} rgba(0,0,0,0.12)`,
    '&::-webkit-scrollbar': { width: 12 },
    '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0,0,0,0.08)' },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: (theme) =>
        theme.palette.mode === 'dark' ? 'var(--theme-secondary-color)' : 'var(--theme-primary-color)',
      borderRadius: 8
    }
  };
}

const colorTemplate11PostingFeedMaxHeight = { xs: '62vh', sm: '68vh' };

/** Posts-only scroll cap when load-more is pinned below (fixed-height panels). */
export const colorTemplate11PostingFeedPinnedScrollMaxHeight = { xs: '40vh', sm: '48vh' };

export function colorTemplate11PostingFeedShellSx(
  { scrollable = false, maxHeight, pinFooter = false, fillHeight = false } = {},
  overrides = {}
) {
  const base = {
    border: '2px solid var(--theme-primary-color)',
    borderRadius: 1,
    p: 1.25,
    bgcolor: 'var(--theme-daynight-color)',
    boxSizing: 'border-box'
  };
  const maxH = maxHeight ?? colorTemplate11PostingFeedMaxHeight;

  if (pinFooter) {
    return {
      ...base,
      display: 'grid',
      gridTemplateRows: 'auto minmax(0, 1fr) auto',
      ...(fillHeight
        ? {
            flex: 1,
            minHeight: 0,
            height: '100%',
            maxHeight: '100%',
            overflow: 'hidden'
          }
        : null),
      ...overrides
    };
  }

  if (scrollable) {
    return {
      ...base,
      maxHeight: maxH,
      overflowY: 'auto',
      overflowX: 'hidden',
      ...colorTemplate11PostingFeedScrollbarSx(),
      ...overrides
    };
  }

  return { ...base, ...overrides };
}

/** Inner scroll region when load-more bar is pinned below posts. */
export function colorTemplate11PostingFeedScrollAreaSx(
  { maxHeight, pinned = false, fillHeight = false } = {},
  overrides = {}
) {
  const maxH = maxHeight ?? (pinned && !fillHeight ? colorTemplate11PostingFeedPinnedScrollMaxHeight : undefined);

  if (pinned && fillHeight) {
    return {
      minHeight: 0,
      overflowY: 'auto',
      overflowX: 'hidden',
      ...colorTemplate11PostingFeedScrollbarSx(),
      ...overrides
    };
  }

  if (pinned) {
    return {
      maxHeight: maxH,
      minHeight: 0,
      overflowY: 'auto',
      overflowX: 'hidden',
      flexShrink: 0,
      ...colorTemplate11PostingFeedScrollbarSx(),
      ...overrides
    };
  }

  return {
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    ...(maxH ? { maxHeight: maxH } : null),
    ...colorTemplate11PostingFeedScrollbarSx(),
    ...overrides
  };
}

export function colorTemplate11PostingTitleSx(overrides = {}) {
  return {
    mb: 1,
    color: 'var(--theme-primary-color)',
    fontWeight: 700,
    fontSize: colorTemplate11PostingTextFontSize,
    ...overrides
  };
}

export function colorTemplate11PostingCardSx(overrides = {}) {
  return {
    mb: 1.5,
    border: '1px solid var(--theme-primary-color)',
    boxShadow: 'none',
    bgcolor: COLOR_TEMPLATE11_POSTING_PHOTO_CELL_BG,
    position: 'relative',
    ...overrides
  };
}

export function colorTemplate11PostingHeaderDateSx(overrides = {}) {
  return {
    position: 'absolute',
    left: 0,
    top: 0,
    color: 'var(--theme-primary-color)',
    fontWeight: 700,
    fontSize: colorTemplate11PostingTextFontSize,
    ...overrides
  };
}

/** e.g. "Repost from MaryBeth (M370841)" — blank when not a repost. */
export function formatPostingRepostCreditLabel(post) {
  const singlesId = Number(post?.reposted_from_singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) return '';
  const memberLabel = formatAliasWithMemberCode({
    alias: post?.reposted_from_alias,
    prefix: post?.reposted_from_prefix,
    memberId: post?.reposted_from_member_id,
    singlesId
  });
  if (!memberLabel) return '';
  return `Repost from ${memberLabel}`;
}

export function colorTemplate11PostingRepostCreditSx(overrides = {}) {
  return {
    color: 'var(--theme-primary-color)',
    fontWeight: 700,
    fontSize: colorTemplate11PostingTextFontSize,
    textAlign: 'center',
    width: '100%',
    lineHeight: 1.25,
    mb: 0.75,
    ...overrides
  };
}

export function colorTemplate11PostingBodyTextSx(overrides = {}) {
  return {
    color: 'var(--theme-primary-color)',
    whiteSpace: 'pre-wrap',
    fontSize: colorTemplate11PostingTextFontSize,
    ...overrides
  };
}

export function colorTemplate11PostingHeaderPaddingSx(showDeleteButton = false) {
  return showDeleteButton ? { pr: { xs: 4.5, sm: 5 } } : {};
}

/** Yellow outlined delete “X” — top-right of post card or photo. */
export function colorTemplate11PostingDeleteButtonSx(overrides = {}) {
  return {
    position: 'absolute',
    top: colorTemplate11PostingRemoveInset.top,
    right: colorTemplate11PostingRemoveInset.right,
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
    fontSize: colorTemplate11PostingDeleteXFontSize,
    fontWeight: 800,
    lineHeight: 1,
    color: COLOR_TEMPLATE11_POSTING_DELETE_X_COLOR,
    WebkitTextFillColor: COLOR_TEMPLATE11_POSTING_DELETE_X_COLOR,
    WebkitTextStroke: COLOR_TEMPLATE11_POSTING_DELETE_X_STROKE,
    paintOrder: 'stroke fill',
    transformOrigin: 'top right',
    transition: 'font-size 0.15s ease',
    '@media (hover: hover)': {
      '&:hover:not(:disabled)': {
        bgcolor: 'transparent',
        boxShadow: 'none',
        ...buttonHoverMagnifyFontSx({ baseFontSize: colorTemplate11PostingDeleteXFontSize })
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

export const colorTemplate11PostingResizeLabelFontSize = {
  xs: '0.85rem',
  sm: getDesktopTextFontSizeVw()
};

export function colorTemplate11PostingPhotoResizeHandleSx(overrides = {}) {
  return {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 0.35,
    pl: 1,
    p: 0,
    m: 0,
    border: 'none',
    borderTop: '2px solid var(--theme-primary-color)',
    bgcolor: COLOR_TEMPLATE11_POSTING_PHOTO_CELL_BG,
    cursor: 'ns-resize',
    zIndex: 3,
    fontFamily: MAIN_FONT_FAMILY,
    fontSize: colorTemplate11PostingResizeLabelFontSize,
    fontWeight: 700,
    color: 'var(--theme-primary-color)',
    WebkitTextFillColor: 'var(--theme-primary-color)',
    lineHeight: 1,
    '@media (hover: hover)': {
      '&:hover': {
        filter: 'brightness(0.97)'
      }
    },
    ...overrides
  };
}

export function colorTemplate11PostingPhotoFrameSx(heightPx, overrides = {}) {
  return {
    position: 'relative',
    borderRadius: 1,
    overflow: 'hidden',
    height: `${heightPx}px`,
    bgcolor: COLOR_TEMPLATE11_POSTING_PHOTO_CELL_BG,
    border: '1px solid rgba(0,0,0,0.18)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...overrides
  };
}

export function colorTemplate11PostingPhotoImgSx(overrides = {}) {
  return {
    height: '100%',
    width: 'auto',
    maxWidth: '100%',
    objectFit: 'contain',
    display: 'block',
    ...overrides
  };
}

export function colorTemplate11PostingActionButtonSx(overrides = {}) {
  return {
    color: 'var(--theme-primary-color)',
    textTransform: 'none',
    fontWeight: 600,
    fontSize: colorTemplate11PostingTextFontSize,
    minWidth: 0,
    px: 0.35,
    ...templateButtonMagnifySx({ baseFontSize: colorTemplate11PostingTextFontSize }),
    ...overrides
  };
}

export function colorTemplate11PostingLikesPadButtonSx(overrides = {}) {
  return {
    borderRadius: 1,
    p: 0.15,
    lineHeight: 0,
    ...overrides
  };
}

export function colorTemplate11PostingActionsBarSx(overrides = {}) {
  return {
    p: 1,
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 0.5,
    ...overrides
  };
}

/** Yellow when more posts available; grey when exhausted or busy. */
export function colorTemplate11PostingLoadMoreButtonSx(hasMore = true, overrides = {}) {
  return {
    borderRadius: 999,
    textTransform: 'none',
    fontWeight: 800,
    fontSize: colorTemplate11PostingLoadMoreButtonFontSize,
    fontFamily: MAIN_FONT_FAMILY,
    px: 2.25,
    py: 0.5,
    bgcolor: hasMore ? YELLOW_BUTTON_TEMPLATE_BG : '#bdbdbd',
    color: hasMore ? '#111' : '#4a4a4a',
    border: hasMore ? '2px solid #111' : '2px solid #7f7f7f',
    position: 'relative',
    zIndex: 1,
    transformOrigin: 'center',
    ...buttonHoverMagnifyTransitionSx,
    '&:hover:not(.Mui-disabled)': hasMore
      ? {
          bgcolor: '#ffea55',
          zIndex: 3,
          ...buttonHoverMagnifyFontSx({ baseFontSize: colorTemplate11PostingLoadMoreButtonFontSize })
        }
      : undefined,
    '&.Mui-disabled': {
      bgcolor: '#bdbdbd',
      color: '#4a4a4a',
      borderColor: '#7f7f7f',
      opacity: 1
    },
    ...overrides
  };
}

export function colorTemplate11PostingLoadMoreBarSx({ pinned = false } = {}, overrides = {}) {
  return {
    borderTop: '1px solid var(--theme-primary-color)',
    mt: pinned ? 1 : 0.5,
    pt: 1,
    pb: pinned ? 0.75 : 1,
    flexShrink: 0,
    width: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 1,
    ...(pinned ? { minHeight: 48, alignSelf: 'stretch' } : null),
    ...overrides
  };
}
