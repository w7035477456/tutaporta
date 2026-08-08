/**
 * Scroll regions on app pages inside MainLayout pageZoom scale().
 * Heights and bottom padding use vh ratios divided by zoomFactor — not fixed px —
 * so page zoom and resize still reach the last row with breathing room at the bottom.
 */
import { getAuthFooterHeightVh } from 'config/authFooterEnv';

/** Fixed app header band as vh (~88px on a ~800px-tall viewport). */
export const APP_PAGE_SCROLL_HEADER_BAND_VH = 11;

/** Breadcrumbs + MainCard title row above the scroll body. */
export const APP_PAGE_SCROLL_TITLE_CHROME_VH = 9;

/** Right-panel section header (e.g. Chat with …) below page title. */
export const APP_PAGE_SCROLL_RIGHT_PANEL_HEADER_VH = 4;

/** Public/Buddies area tab row + sub-tab row under the right-panel header. */
export const APP_PAGE_SCROLL_RIGHT_PANEL_TAB_BARS_VH = 12;

/** Page toolbar above the two-column layout (e.g. Refresh Posts & Chats). */
export const APP_PAGE_SCROLL_PAGE_TOOLBAR_VH = 6;

/** Default empty space after the last row so users know they reached the end. */
export const APP_PAGE_SCROLL_BOTTOM_PADDING_VH = 6;

export function getAppPageZoomFactor(pageZoom) {
  const parsed = Number(pageZoom);
  return Number.isFinite(parsed) && parsed > 0 ? parsed / 100 : 1;
}

function scrollChromeVhTotal({
  rightPanelHeader = false,
  rightPanelTabBars = false,
  pageToolbar = false
} = {}) {
  return (
    APP_PAGE_SCROLL_HEADER_BAND_VH +
    getAuthFooterHeightVh() +
    APP_PAGE_SCROLL_TITLE_CHROME_VH +
    (rightPanelHeader ? APP_PAGE_SCROLL_RIGHT_PANEL_HEADER_VH : 0) +
    (rightPanelTabBars ? APP_PAGE_SCROLL_RIGHT_PANEL_TAB_BARS_VH : 0) +
    (pageToolbar ? APP_PAGE_SCROLL_PAGE_TOOLBAR_VH : 0)
  );
}

/** CSS max-height for a scroll region inside the pageZoom scale() wrapper. */
export function getAppPageScrollRegionMaxHeightCss(zoomFactor = 1, options = {}) {
  const z = zoomFactor > 0 ? zoomFactor : 1;
  const chromeVh = scrollChromeVhTotal(options);
  return `calc((100vh - ${chromeVh}vh) / ${z})`;
}

/** CSS bottom padding inside the scroll region (scales with page zoom). */
export function getAppPageScrollRegionBottomPaddingCss(zoomFactor = 1, bottomPaddingVh = APP_PAGE_SCROLL_BOTTOM_PADDING_VH) {
  const z = zoomFactor > 0 ? zoomFactor : 1;
  return `calc(${bottomPaddingVh}vh / ${z})`;
}

const appPageScrollRegionScrollbarSx = {
  scrollbarGutter: 'stable',
  scrollbarColor: (theme) =>
    `${theme.palette.mode === 'dark' ? 'var(--theme-secondary-color)' : 'var(--theme-primary-color)'} rgba(0,0,0,0.12)`,
  '&::-webkit-scrollbar': { width: 12 },
  '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0,0,0,0.08)' },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: (theme) => (theme.palette.mode === 'dark' ? 'var(--theme-secondary-color)' : 'var(--theme-primary-color)'),
    borderRadius: 8
  }
};

/**
 * @param {number} zoomFactor — from getAppPageZoomFactor(pageZoom); pass 1 on mobile scale paths.
 * @param {{ rightPanelHeader?: boolean, rightPanelTabBars?: boolean, pageToolbar?: boolean, bottomPaddingVh?: number }} [options]
 */
export function buildAppPageScrollRegionSx(zoomFactor = 1, options = {}) {
  const bottomPaddingVh = options.bottomPaddingVh ?? APP_PAGE_SCROLL_BOTTOM_PADDING_VH;
  return {
    flex: 1,
    minHeight: 0,
    maxHeight: getAppPageScrollRegionMaxHeightCss(zoomFactor, options),
    overflowY: 'scroll',
    overflowX: 'hidden',
    overscrollBehaviorY: 'contain',
    pb: getAppPageScrollRegionBottomPaddingCss(zoomFactor, bottomPaddingVh),
    display: 'block',
    ...appPageScrollRegionScrollbarSx
  };
}

/** Flex shell for page cards that host an inner scroll region (no fixed px height). */
export const appPageScrollHostCardSx = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden'
};
