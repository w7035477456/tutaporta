import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import ColorTemplate15ApplicationFrame from 'ui-component/ColorTemplate15ApplicationFrame';
import { VSINGLES_APPLICATION_FRAME } from 'config/applicationFramePresets';
import {
  COLOR_TEMPLATE15_APPLICATION_FRAME_MAIN_BOTTOM_PADDING,
  colorTemplate15ApplicationFrameMainContentSx,
  colorTemplate15ApplicationFrameMainPanelEdgeToEdgeSx,
  colorTemplate15ApplicationFrameMainPanelSx
} from 'config/colorTemplate15ApplicationFrame';
import { colorTemplate15LandingPageRegion7CompanionSx } from 'config/colorTemplate15LandingPage';
import { colorTemplate14LandingFrameRegion7CompanionSx } from 'config/colorTemplate14LandingFrame';
import { DATING_TOP_BANNER_IMAGE } from 'config/datingTopBanner';
import { getAdminImpersonationHeaderState } from 'config/adminImpersonationHeader';
import AdminImpersonationHeaderCenter from 'ui-component/AdminImpersonationHeaderCenter';
import DemoOnlyModeBanner from 'ui-component/DemoOnlyModeBanner';
import { useAuth } from 'contexts/AuthContext';
import { isDemoUserCategory } from 'utils/memberCategory';
import HeaderLeft from './Header/HeaderLeft';
import HeaderRight from './Header/HeaderRight';
import Sidebar from './Sidebar';
import Footer from './Footer';

/**
 * Dating / app shell via ColorTemplate15ApplicationFrame (regions 1–7).
 * Region 7 is `children`; sidebar embeds regions 3–4 (MenuList + phrase).
 */
export default function ApplicationShell({
  children,
  showHeader = true,
  showTopBanner = true,
  topBannerImage: topBannerImageOverride,
  headerBannerSx,
  sidebarOpen = true,
  sidebarWidthPx,
  sidebarTopOffsetPx = 0,
  borderRadius = 8,
  mainStretch = true,
  mainEdgeToEdge = false,
  immersiveMain = false,
  drawerOpen = true,
  footerAtScrollEnd = false,
  showFixedFooter = true,
  landingPageWide = false,
  landingFrameWide = false,
  showSidebar = true
}) {
  const theme = useTheme();
  const { user } = useAuth();
  const adminHeader = getAdminImpersonationHeaderState(user);
  const showDemoOnlyBanner = !adminHeader && isDemoUserCategory(user?.member_category);
  const region7Wide = landingPageWide || landingFrameWide;
  const mainEdgeToEdgeEffective = mainEdgeToEdge || immersiveMain;

  const region7Landing = useMemo(() => {
    if (landingFrameWide) return colorTemplate14LandingFrameRegion7CompanionSx(theme);
    if (landingPageWide) return colorTemplate15LandingPageRegion7CompanionSx(theme);
    return null;
  }, [landingFrameWide, landingPageWide, theme]);

  const mainPanelSx = useMemo(() => {
    const base = colorTemplate15ApplicationFrameMainPanelSx(
      { borderRadius, stretch: mainStretch },
      { marginTop: 0 }
    );
    const edge = mainEdgeToEdgeEffective ? colorTemplate15ApplicationFrameMainPanelEdgeToEdgeSx() : null;
    return {
      ...base,
      ...(edge || {}),
      ...(region7Landing?.panelSx || {}),
      ...(immersiveMain
        ? {
            flex: '1 1 0%',
            minHeight: 0,
            height: '100%',
            borderRadius: 0,
            p: 0,
            px: 0
          }
        : {}),
      transition: theme.transitions.create(['margin', 'width'], {
        easing: drawerOpen ? theme.transitions.easing.easeOut : theme.transitions.easing.sharp,
        duration: theme.transitions.duration.shorter + 200
      }),
      ...(!mainEdgeToEdgeEffective && !region7Wide
        ? {
            [theme.breakpoints.down('md')]: {
              marginLeft: 20,
              padding: 16,
              paddingBottom: COLOR_TEMPLATE15_APPLICATION_FRAME_MAIN_BOTTOM_PADDING,
              marginRight: 0
            },
            [theme.breakpoints.down('sm')]: { marginLeft: 10, marginRight: 0 }
          }
        : !mainEdgeToEdgeEffective && region7Wide
          ? {}
          : {
              [theme.breakpoints.down('md')]: { marginLeft: 0, marginRight: 0, padding: 0 },
              [theme.breakpoints.down('sm')]: { marginLeft: 0, marginRight: 0, padding: 0 }
            })
    };
  }, [borderRadius, drawerOpen, immersiveMain, mainEdgeToEdgeEffective, mainStretch, region7Landing, region7Wide, theme]);

  const mainScrollColumnSx = useMemo(
    () => ({
      ...(region7Landing?.scrollColumnSx ?? {}),
      ...(immersiveMain ? { overflow: 'hidden', flex: '1 1 0%', minHeight: 0 } : {})
    }),
    [immersiveMain, region7Landing]
  );

  const mainInnerSx = useMemo(
    () =>
      mainEdgeToEdgeEffective
        ? {
            px: { xs: 0 },
            ml: 0,
            mr: 0,
            pl: 0,
            pr: 0,
            width: '100%',
            maxWidth: '100%',
            ...(immersiveMain
              ? {
                  flex: '1 1 0%',
                  minHeight: 0,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column'
                }
              : {}),
            '& .MuiCard-root': { borderRadius: 0, mx: 0, width: '100%', maxWidth: '100%' },
            '& .MuiCardContent-root': {
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              padding: { xs: 0, sm: immersiveMain ? 0 : '24px' },
              '&:last-child': { pb: { xs: immersiveMain ? 0 : 2, sm: immersiveMain ? 0 : 3 } }
            },
            '& .MuiCardHeader-root': { px: { xs: 1, sm: 1.5 }, py: { xs: 1, sm: 1.5 } },
            '& .MuiStack-root': { width: '100%', maxWidth: '100%' }
          }
        : immersiveMain
          ? {
              flex: '1 1 0%',
              minHeight: 0,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              maxWidth: '100%'
            }
          : {},
    [immersiveMain, mainEdgeToEdgeEffective]
  );

  const showFrameFooter = showFixedFooter && !footerAtScrollEnd;
  const frameTopBanner =
    topBannerImageOverride ??
    (showTopBanner && !adminHeader ? DATING_TOP_BANNER_IMAGE : undefined);

  return (
    <ColorTemplate15ApplicationFrame
      preset={VSINGLES_APPLICATION_FRAME}
      topBannerImage={frameTopBanner}
      headerBannerSx={adminHeader?.bannerSx ?? headerBannerSx}
      headerCenter={
        adminHeader ? (
          <AdminImpersonationHeaderCenter label={adminHeader.label} />
        ) : showDemoOnlyBanner ? (
          <DemoOnlyModeBanner />
        ) : null
      }
      showHeader={showHeader}
      headerLeft={<HeaderLeft />}
      headerRight={<HeaderRight />}
      sidebar={showSidebar ? <Sidebar /> : false}
      sidebarOpen={showSidebar ? sidebarOpen : false}
      sidebarWidthPx={sidebarWidthPx}
      sidebarTopOffsetPx={sidebarTopOffsetPx}
      showFooter={showFrameFooter}
      footerInline
      borderRadius={borderRadius}
      mainStretch={mainStretch}
      mainPanelSx={mainPanelSx}
      mainScrollColumnSx={mainScrollColumnSx}
      mainContentSx={{
        ...colorTemplate15ApplicationFrameMainContentSx(),
        ...(region7Landing?.contentSx || {}),
        ...mainInnerSx
      }}
    >
      {immersiveMain ? (
        <Box sx={{ flex: '1 1 0%', minHeight: 0, display: 'flex', flexDirection: 'column', width: '100%' }}>
          {children}
        </Box>
      ) : (
        children
      )}
      {footerAtScrollEnd ? (
        <Box sx={{ flexShrink: 0, width: '100%' }}>
          <Footer inline />
        </Box>
      ) : null}
    </ColorTemplate15ApplicationFrame>
  );
}

ApplicationShell.propTypes = {
  children: PropTypes.node,
  showHeader: PropTypes.bool,
  showTopBanner: PropTypes.bool,
  topBannerImage: PropTypes.string,
  headerBannerSx: PropTypes.object,
  sidebarOpen: PropTypes.bool,
  sidebarWidthPx: PropTypes.number,
  sidebarTopOffsetPx: PropTypes.number,
  borderRadius: PropTypes.number,
  mainStretch: PropTypes.bool,
  mainEdgeToEdge: PropTypes.bool,
  immersiveMain: PropTypes.bool,
  drawerOpen: PropTypes.bool,
  footerAtScrollEnd: PropTypes.bool,
  showFixedFooter: PropTypes.bool,
  landingPageWide: PropTypes.bool,
  landingFrameWide: PropTypes.bool,
  showSidebar: PropTypes.bool
};
