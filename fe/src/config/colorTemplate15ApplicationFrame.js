/**
 * ColorTemplate15ApplicationFrame — layout tokens for the 7-region app shell.
 *
 * 1 TopBanner      — header background strip (profile collage / app banner)
 * 2 HeaderBar      — logo + notification / theme / profile cluster
 * 3 SidebarMenu    — ColorTemplate10Menu rows
 * 4 SidebarPhrase  — cursive phrase in leftover sidebar space
 * 5 FooterLeft     — About | Terms | Privacy + copyright
 * 6 FooterRight    — Mute / Track / Support
 * 7 Main           — scrollable page body (--theme-daynight-color)
 */
import { DATING_TOP_BANNER_IMAGE } from 'config/datingTopBanner';
import { headerBarMinHeightCss } from 'config/headerProfileChipEnv';
import { colorTemplate4TitlesMatchSx } from 'config/colorTemplate4Titles';

/** Fixed app header height (matches MainLayout AppBar + toolbar). */
export const COLOR_TEMPLATE15_APPLICATION_FRAME_HEADER_HEIGHT_PX = 88;

/** Region 7 — always leave a small gap above the footer on every page. */
export const COLOR_TEMPLATE15_APPLICATION_FRAME_MAIN_BOTTOM_PADDING = '1vh';

/** Default top banner asset for vsingles / dating shell. */
export const COLOR_TEMPLATE15_APPLICATION_FRAME_DEFAULT_BANNER = DATING_TOP_BANNER_IMAGE;

export function colorTemplate15ApplicationFrameRootSx(overrides = {}) {
  return {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    minHeight: '100vh',
    width: '100%',
    overflow: 'hidden',
    bgcolor: 'var(--theme-daynight-color)',
    ...overrides
  };
}

/** Region 1 — banner background on the fixed header. */
export function colorTemplate15ApplicationFrameTopBannerSx(topBannerImage, overrides = {}) {
  if (!topBannerImage) return overrides;
  return {
    backgroundImage: `url(${topBannerImage})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center center',
    backgroundSize: 'cover',
    ...overrides
  };
}

/** Region 2 — header toolbar row. */
export function colorTemplate15ApplicationFrameHeaderBarSx(overrides = {}) {
  return {
    flexShrink: 0,
    zIndex: 1200,
    bgcolor: 'background.default',
    ...overrides
  };
}

export function colorTemplate15ApplicationFrameHeaderToolbarSx(overrides = {}) {
  return {
    p: 2,
    minHeight: headerBarMinHeightCss(),
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    backgroundImage: 'none',
    ...overrides
  };
}

/** Spacer below fixed header so body aligns with toolbar. */
export function colorTemplate15ApplicationFrameHeaderSpacerSx(overrides = {}) {
  return {
    minHeight: headerBarMinHeightCss(),
    height: headerBarMinHeightCss(),
    flexShrink: 0,
    ...overrides
  };
}

/** Row containing sidebar + main. */
export function colorTemplate15ApplicationFrameBodyRowSx(overrides = {}) {
  return {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    display: 'flex',
    alignItems: 'stretch',
    overflow: 'hidden',
    width: '100%',
    ...overrides
  };
}

/** Region 3 + 4 — sidebar column. */
export function colorTemplate15ApplicationFrameSidebarSx({ widthPx, open = true } = {}, overrides = {}) {
  return {
    flexShrink: 0,
    width: open ? widthPx : 72,
    minWidth: open ? widthPx : 72,
    maxWidth: open ? widthPx : 72,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
    bgcolor: 'var(--theme-daynight-color)',
    borderRight: '1px solid var(--theme-primary-color)',
    boxSizing: 'border-box',
    transition: 'width 200ms ease, min-width 200ms ease, max-width 200ms ease',
    ...overrides
  };
}

/** Region 3 — menu stack (ColorTemplate10Menu lives here). */
export function colorTemplate15ApplicationFrameSidebarMenuSx(overrides = {}) {
  return {
    flexShrink: 0,
    flexGrow: 0,
    overflow: 'visible',
    display: 'flex',
    flexDirection: 'column',
    gap: 2.5,
    ...overrides
  };
}

/** Region 4 — phrase fills leftover sidebar height. */
export function colorTemplate15ApplicationFrameSidebarPhraseSx(overrides = {}) {
  return {
    mx: '0.5rem',
    minWidth: 0,
    flex: 1,
    minHeight: 0,
    display: 'flex',
    overflow: 'hidden',
    ...overrides
  };
}

/** Region 7 — main scroll column wrapper. */
export function colorTemplate15ApplicationFrameMainScrollColumnSx(overrides = {}) {
  return {
    flex: '1 1 0%',
    flexGrow: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'auto',
    position: 'relative',
    zIndex: 0,
    display: 'flex',
    flexDirection: 'column',
    outline: 'none',
    ...overrides
  };
}

/** Region 7 — inner main panel (theme day/night body). */
export function colorTemplate15ApplicationFrameMainPanelSx({ borderRadius = 8, stretch = true } = {}, overrides = {}) {
  return {
    backgroundColor: 'var(--theme-daynight-color)',
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    borderLeft: '1px solid var(--theme-primary-color)',
    borderRight: '1px solid var(--theme-primary-color)',
    borderRadius: `${borderRadius}px`,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: 20,
    paddingBottom: COLOR_TEMPLATE15_APPLICATION_FRAME_MAIN_BOTTOM_PADDING,
    marginLeft: 0,
    marginRight: 0,
    display: 'flex',
    flexDirection: 'column',
    ...(stretch
      ? {
          flex: '1 1 auto',
          minHeight: '100%',
          alignSelf: 'stretch'
        }
      : {
          minHeight: 0,
          height: 'auto',
          flexGrow: 0,
          flexShrink: 0
        }),
    ...overrides
  };
}

/** Region 7 — page content flex child. */
export function colorTemplate15ApplicationFrameMainContentSx(overrides = {}) {
  return {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    ...overrides
  };
}

/** Region 7 — phone edge-to-edge overrides (formerly MainContentStyled edgeToEdge). */
export function colorTemplate15ApplicationFrameMainPanelEdgeToEdgeSx(overrides = {}) {
  return {
    marginLeft: 0,
    marginRight: 0,
    padding: 0,
    borderLeft: 'none',
    borderRight: 'none',
    borderRadius: 0,
    width: '100%',
    maxWidth: '100%',
    ...overrides
  };
}

/** Regions 5 + 6 — footer bar shell. */
export function colorTemplate15ApplicationFrameFooterShellSx({ inline = false } = {}, overrides = {}) {
  return {
    width: '100%',
    ...colorTemplate4TitlesMatchSx(),
    borderTop: '1px solid var(--theme-primary-color)',
    mt: 'auto',
    pl: { xs: 0.5, sm: 1 },
    pr: { xs: 1, sm: 2 },
    py: 0.75,
    display: 'flex',
    alignItems: 'center',
    gap: { xs: 0.5, sm: 1 },
    overflow: 'visible',
    flexShrink: 0,
    ...(inline ? {} : { position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1200 }),
    ...overrides
  };
}

/** Region 5 — centered legal links + copyright. */
export function colorTemplate15ApplicationFrameFooterLeftSx(overrides = {}) {
  return {
    flex: '1 1 auto',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0.5,
    minWidth: 0,
    textAlign: 'center',
    px: { xs: 0.5, sm: 1 },
    ...overrides
  };
}

/** Region 6 — mute / track / support cluster (single compact row). */
export function colorTemplate15ApplicationFrameFooterRightSx(overrides = {}) {
  return {
    flex: '0 0 auto',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: { xs: 0.5, sm: 0.75 },
    minWidth: 0,
    flexWrap: 'nowrap',
    ...overrides
  };
}
