/**
 * ColorTemplate15LandingPage — blank landing panel for sidebar menu pages (region 7 body).
 *
 * Desktop (sm+ / beside sidebar): edge-to-edge in the main column (sidebar → window right); grows when sidebar collapses.
 * Mobile (SIDEBAR_MOBILE_CLOSE_MEDIA): full viewport width — unchanged from current behavior.
 */
import { isVettedFriendsPath, VETTED_FRIENDS_PATH } from 'routes/vettedFriendsPaths';
import { RECEIVED_BIO_REQUESTS_PATH } from 'constants/receivedBioRequestsRoute';
import { PROFILES_RECORDS_PATH } from 'constants/profilesRecordsRoute';
import { SELF_REPORT_BIOGRAPHY_PATH } from 'constants/selfReportBiographyRoute';

/** Region-7 main panel horizontal padding removed on desktop (see colorTemplate15ApplicationFrameMainPanelSx). */
export const COLOR_TEMPLATE15_LANDING_PAGE_MAIN_PANEL_PADDING_PX = 20;

/** Menu routes that render inside ColorTemplate15LandingPage. */
export const COLOR_TEMPLATE15_LANDING_PAGE_PATHS = [
  '/allSingles',
  '/myPicks',
  '/myStory',
  SELF_REPORT_BIOGRAPHY_PATH,
  RECEIVED_BIO_REQUESTS_PATH,
  PROFILES_RECORDS_PATH,
  VETTED_FRIENDS_PATH
];

export function isColorTemplate15LandingPageRoute(pathname) {
  const path = String(pathname ?? '')
    .replace(/\/+$/, '') || '/';
  if (COLOR_TEMPLATE15_LANDING_PAGE_PATHS.includes(path)) return true;
  return isVettedFriendsPath(path);
}

/** Shared shell — mobile + desktop base (matches current mobile flex column). */
export function colorTemplate15LandingPageShellSx(overrides = {}) {
  return {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    alignSelf: 'stretch',
    ...overrides
  };
}

/**
 * Region-7 scroll column (ApplicationFrame main) — flex to fill space beside sidebar;
 * responds when sidebar opens / collapses.
 */
export function colorTemplate15LandingPageRegion7ScrollSx(overrides = {}) {
  return {
    flex: '1 1 0%',
    minWidth: 0,
    width: 'auto',
    maxWidth: 'none',
    ...overrides
  };
}

/**
 * Region-7 main panel — edge-to-edge within the main column (no side gutters).
 * sm+ (601px): desktop/tablet beside sidebar. Below sm: unchanged (mobile edge-to-edge path).
 */
export function colorTemplate15LandingPageRegion7PanelSx(theme, overrides = {}) {
  return {
    [theme.breakpoints.up('sm')]: {
      flex: '1 1 0%',
      minWidth: 0,
      p: 0,
      px: 0,
      marginLeft: 0,
      marginRight: 0,
      borderLeft: 'none',
      borderRight: 'none',
      borderRadius: 0,
      width: '100%',
      maxWidth: 'none',
      alignSelf: 'stretch',
      boxSizing: 'border-box',
      ...overrides
    }
  };
}

/** Region-7 main content flex child — stretch landing panel + descendants. */
export function colorTemplate15LandingPageRegion7ContentSx(theme, overrides = {}) {
  return {
    width: '100%',
    maxWidth: 'none',
    alignItems: 'stretch',
    [theme.breakpoints.up('sm')]: {
      flex: '1 1 0%',
      minWidth: 0,
      '& > [data-color-template="ColorTemplate15LandingPage"]': {
        flex: '1 1 0%',
        minWidth: 0,
        width: '100%',
        maxWidth: 'none'
      },
      ...overrides
    }
  };
}

/**
 * Desktop-only stretch on the landing panel itself; descendants (MainCard, etc.) follow.
 * Mobile: no extra rules (preserve current full-bleed behavior).
 */
export function colorTemplate15LandingPageDesktopStretchSx(theme, overrides = {}) {
  return {
    [theme.breakpoints.up('sm')]: {
      flex: '1 1 0%',
      width: '100%',
      maxWidth: 'none',
      alignSelf: 'stretch',
      '& > *': {
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box'
      },
      '& .MuiCard-root': {
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box'
      },
      '& .MuiCardContent-root': {
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box'
      },
      ...overrides
    }
  };
}

export function colorTemplate15LandingPageSx(theme, overrides = {}) {
  return {
    ...colorTemplate15LandingPageShellSx(),
    ...colorTemplate15LandingPageDesktopStretchSx(theme),
    ...(typeof overrides === 'function' ? overrides(theme) : overrides)
  };
}

/** Block ApplicationShell from re-adding region-7 gutters on landing menu pages. */
export function colorTemplate15LandingPageRegion7GutterResetSx(theme, overrides = {}) {
  return {
    marginLeft: 0,
    marginRight: 0,
    padding: 0,
    [theme.breakpoints.down('md')]: {
      marginLeft: 0,
      marginRight: 0,
      padding: 0,
      ...overrides
    }
  };
}

/** Merge region-7 companion tokens when MainLayout/ApplicationShell hosts a menu landing route. */
export function colorTemplate15LandingPageRegion7CompanionSx(theme) {
  return {
    scrollColumnSx: colorTemplate15LandingPageRegion7ScrollSx(),
    panelSx: {
      ...colorTemplate15LandingPageRegion7PanelSx(theme),
      ...colorTemplate15LandingPageRegion7GutterResetSx(theme)
    },
    contentSx: colorTemplate15LandingPageRegion7ContentSx(theme)
  };
}
