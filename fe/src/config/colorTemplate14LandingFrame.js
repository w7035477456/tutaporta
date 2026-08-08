/**
 * ColorTemplate14LandingFrame — full-width region-7 frame for admin / tools menu pages.
 *
 * Desktop (sm+ beside sidebar): edge-to-edge in the main column (sidebar → window right);
 * grows when sidebar collapses. Mobile: full viewport width (unchanged).
 */
import { ADMIN_TOOLS_PATH } from 'constants/adminToolsRoute';

/** Menu routes that render inside ColorTemplate14LandingFrame. */
export const COLOR_TEMPLATE14_LANDING_FRAME_PATHS = [ADMIN_TOOLS_PATH, '/dashboard/adminTools'];

export function isColorTemplate14LandingFrameRoute(pathname) {
  const path = String(pathname ?? '')
    .replace(/\/+$/, '') || '/';
  return COLOR_TEMPLATE14_LANDING_FRAME_PATHS.includes(path);
}

/** Shared shell — flex column filling region 7. */
export function colorTemplate14LandingFrameShellSx(overrides = {}) {
  return {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'visible',
    alignSelf: 'stretch',
    ...overrides
  };
}

/** Region-7 scroll column — flex beside sidebar; responds when menu opens / collapses. */
export function colorTemplate14LandingFrameRegion7ScrollSx(overrides = {}) {
  return {
    flex: '1 1 0%',
    minWidth: 0,
    width: 'auto',
    maxWidth: 'none',
    ...overrides
  };
}

/** Region-7 main panel — edge-to-edge within the main column (no side gutters). */
export function colorTemplate14LandingFrameRegion7PanelSx(theme, overrides = {}) {
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

/** Region-7 main content flex child — stretch frame + descendants. */
export function colorTemplate14LandingFrameRegion7ContentSx(theme, overrides = {}) {
  return {
    width: '100%',
    maxWidth: 'none',
    alignItems: 'stretch',
    [theme.breakpoints.up('sm')]: {
      flex: '1 1 0%',
      minWidth: 0,
      '& [data-color-template="ColorTemplate14LandingFrame"]': {
        flex: '1 1 0%',
        minWidth: 0,
        width: '100%',
        maxWidth: 'none'
      },
      ...overrides
    }
  };
}

/** Desktop stretch on the frame; descendants (MainCard, ColorTemplate9, etc.) follow. */
export function colorTemplate14LandingFrameDesktopStretchSx(theme, overrides = {}) {
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

export function colorTemplate14LandingFrameSx(theme, overrides = {}) {
  return {
    ...colorTemplate14LandingFrameShellSx(),
    ...colorTemplate14LandingFrameDesktopStretchSx(theme),
    ...(typeof overrides === 'function' ? overrides(theme) : overrides)
  };
}

/** Block ApplicationShell from re-adding region-7 gutters on framed menu pages. */
export function colorTemplate14LandingFrameRegion7GutterResetSx(theme, overrides = {}) {
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

/** Merge region-7 companion tokens when MainLayout/ApplicationShell hosts a framed route. */
export function colorTemplate14LandingFrameRegion7CompanionSx(theme) {
  return {
    scrollColumnSx: colorTemplate14LandingFrameRegion7ScrollSx(),
    panelSx: {
      ...colorTemplate14LandingFrameRegion7PanelSx(theme),
      ...colorTemplate14LandingFrameRegion7GutterResetSx(theme)
    },
    contentSx: colorTemplate14LandingFrameRegion7ContentSx(theme)
  };
}
