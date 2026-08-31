import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

// material-ui
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';

// assets - top banner for dating pages
import { DATING_TOP_BANNER_IMAGE } from 'config/datingTopBanner';
import { headerBarMinHeightCss } from 'config/headerProfileChipEnv';

// project imports
import Footer from './Footer';
import Header from './Header';
import Sidebar from './Sidebar';
import ApplicationShell from './ApplicationShell';
import MainContentStyled from './MainContentStyled';
import Loader from 'ui-component/Loader';
import Breadcrumbs from 'ui-component/extended/Breadcrumbs';

import useConfig from 'hooks/useConfig';
import useFlowerShopLightThemeOverride from 'hooks/useFlowerShopLightThemeOverride';
import useRouteOrientationLock from 'hooks/useRouteOrientationLock';
import { isNavigationCollapseDisabled, navigationDrawerOpenState } from 'config/navigationCollapseEnv';
import { SIDEBAR_MOBILE_CLOSE_MEDIA } from 'config/sidebarMobileCloseEnv';
import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';
import useNavDrawerOpenWidthPx from 'hooks/useNavDrawerOpenWidthPx';
import ZoomBar from './ZoomBar';
import ViewportSizeReadout from 'ui-component/ViewportSizeReadout';
import UiTestFloatingStopButton from 'ui-component/UiTestFloatingStopButton';
import LandscapeRecommendFloating from './LandscapeRecommendFloating';
import MobileOrientationSimulatedViewport from './MobileOrientationSimulatedViewport';
import VsinglesGuidedTourOverlay from 'views/dashboard/vsingles/VsinglesGuidedTourOverlay';
import ProfilePhotoSetupRedirect from 'ui-component/ProfilePhotoSetupRedirect';
import IdentificationVerificationSetupRedirect from 'ui-component/IdentificationVerificationSetupRedirect';
import AdminImpersonationBanner from 'ui-component/AdminImpersonationBanner';
import AdminImpersonationHeaderCenter from 'ui-component/AdminImpersonationHeaderCenter';
import DemoOnlyModeBanner from 'ui-component/DemoOnlyModeBanner';
import { getAdminImpersonationHeaderState, adminImpersonationHeaderCenterWrapSx } from 'config/adminImpersonationHeader';
import LegacyPasswordUpgradeDialog from 'views/auth-forms/LegacyPasswordUpgradeDialog';
import GenderSelfReportPopup from 'ui-component/GenderSelfReportPopup';
import RecordVaultLeaveBusyOverlay from 'ui-component/RecordVaultLeaveBusyOverlay';
import PhotoAlbumsLeaveBusyOverlay from 'ui-component/PhotoAlbumsLeaveBusyOverlay';
import { useAuth } from 'contexts/AuthContext';
import { MobileOrientationSimProvider } from 'contexts/MobileOrientationSimContext';
import { SELF_REPORT_BIOGRAPHY_PATH } from 'constants/selfReportBiographyRoute';
import { RECEIVED_BIO_REQUESTS_PATH } from 'constants/receivedBioRequestsRoute';
import { isVettedFriendsPath } from 'routes/vettedFriendsPaths';
import { PROFILES_RECORDS_PATH } from 'constants/profilesRecordsRoute';
import { ADMIN_TOOLS_PATH } from 'constants/adminToolsRoute';
import ColorTemplate15LandingPage from 'ui-component/ColorTemplate15LandingPage';
import { isColorTemplate15LandingPageRoute } from 'config/colorTemplate15LandingPage';
import { isColorTemplate14LandingFrameRoute } from 'config/colorTemplate14LandingFrame';
import { isRecordVaultRoute, MY_NOTE_BANNER_IMAGE, myNoteHeaderBannerSx } from 'config/recordVaultLayout';
import {
  isPhotoAlbumsRoute,
  MY_PHOTO_ALBUMS_BANNER_IMAGE,
  myPhotoAlbumsHeaderBannerSx
} from 'config/photoAlbumsLayout';
import { isGuestDemoLogin } from 'utils/guestDemoLogin';
import { isTutaDatesLandingPath, isTutaDatesPath } from 'constants/tutaDatesRoute';
import { FIRST_LOGIN_AUTO_POPUPS_ENABLED } from 'config/firstLoginAutoPopupsEnv';
import { isIdentificationVerificationLockActive } from 'utils/signupIdentificationVerification';
import { hasProfilePhotoFk, isFirstLoginOnboardingCongratsPending } from 'utils/firstLoginOnboarding';
import { isOver18Verified, normalizeOver18Verified, OVER18_REQUIRED_SITE_MESSAGE } from 'utils/over18Verified';
import { themedAlert } from 'utils/themedDialog';
import { isImpersonationSession, isToolsOnlyAdminSession } from 'utils/adminSession';

// ==============================|| MAIN LAYOUT ||============================== //

function datingAppBarSx({ isLandingRoute, isDatingRoute, adminHeader, isVaultImmersiveRoute }) {
  if (isLandingRoute) {
    return {
      bgcolor: 'var(--theme-primary-color)',
      boxShadow: 'none',
      zIndex: 1200
    };
  }
  if (adminHeader) {
    return adminHeader.bannerSx;
  }
  if (isVaultImmersiveRoute) {
    return { bgcolor: 'background.default' };
  }
  if (isDatingRoute) {
    return {
      bgcolor: 'background.default',
      backgroundImage: `url(${DATING_TOP_BANNER_IMAGE})`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      backgroundSize: 'cover'
    };
  }
  return { bgcolor: 'background.default' };
}

function DatingAppBarToolbar({ iconsOnly, adminHeader, showDemoOnlyBanner }) {
  return (
    <Toolbar sx={{ p: 2, minHeight: headerBarMinHeightCss(), boxSizing: 'border-box', backgroundImage: 'none', position: 'relative' }}>
      {adminHeader ? (
        <Box sx={adminImpersonationHeaderCenterWrapSx}>
          <AdminImpersonationHeaderCenter label={adminHeader.label} />
        </Box>
      ) : showDemoOnlyBanner ? (
        <Box sx={adminImpersonationHeaderCenterWrapSx}>
          <DemoOnlyModeBanner />
        </Box>
      ) : null}
      <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', width: '100%' }}>
        <Header iconsOnly={iconsOnly} />
      </Box>
    </Toolbar>
  );
}

export default function MainLayout() {
  const showZoom = (import.meta.env.SHOW_ZOOM ?? '').toString().trim().toLowerCase() === 'true';
  const showViewportSize = (import.meta.env.VITE_SHOW_VIEWPORT_SIZE ?? '').toString().trim().toLowerCase() === 'true';
  const theme = useTheme();
  const downMD = useMediaQuery(theme.breakpoints.down('md'));
  const downSM = useMediaQuery(theme.breakpoints.down('sm'));
  const downLG = useMediaQuery(theme.breakpoints.down('lg'));
  const mobileEdgeToEdge = useMediaQuery(SIDEBAR_MOBILE_CLOSE_MEDIA);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, requiresPasswordUpgrade, upgradeLegacyPassword, updateSessionDemoBuddyFlags, logout } = useAuth();
  const adminHeader = getAdminImpersonationHeaderState(user);
  const showDemoOnlyBanner = !adminHeader && isGuestDemoLogin(user);
  const idvLockActive = isIdentificationVerificationLockActive(user);
  const needsGenderSelfReport =
    FIRST_LOGIN_AUTO_POPUPS_ENABLED &&
    Boolean(user) &&
    !user.tools_only &&
    !isGuestDemoLogin(user) &&
    isOver18Verified(user.over_18_verified) &&
    !idvLockActive &&
    hasProfilePhotoFk(user) &&
    !isFirstLoginOnboardingCongratsPending() &&
    !user.seeded_demo_buddies_boolean &&
    (user.gender_self_report !== 'M' && user.gender_self_report !== 'F');
  useFlowerShopLightThemeOverride();

  // over_18_verified === false → block with OK-only message, then logout (status already under18).
  useEffect(() => {
    if (!user || requiresPasswordUpgrade) return;
    if (isToolsOnlyAdminSession(user) || isImpersonationSession(user) || isGuestDemoLogin(user)) return;
    if (normalizeOver18Verified(user.over_18_verified) !== false) return;
    let cancelled = false;
    (async () => {
      await themedAlert(OVER18_REQUIRED_SITE_MESSAGE, { okLabel: 'OK' });
      if (cancelled) return;
      try {
        await logout();
      } catch (err) {
        console.warn('[MainLayout] logout after over_18_verified=false failed', err);
      }
      navigate('/pages/login', { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, requiresPasswordUpgrade, logout, navigate]);

  const {
    state: { borderRadius, miniDrawer, pageZoom },
    setField
  } = useConfig();
  const { menuMaster, menuMasterLoading } = useGetMenuMaster();
  const drawerOpen = navigationDrawerOpenState(menuMaster?.isDashboardDrawerOpened);
  const navDrawerOpenWidthPx = useNavDrawerOpenWidthPx();

  const isRecordVaultImmersiveRoute = isRecordVaultRoute(location.pathname);
  const isPhotoAlbumsImmersiveRoute = isPhotoAlbumsRoute(location.pathname);
  const isVaultImmersiveRoute = isRecordVaultImmersiveRoute || isPhotoAlbumsImmersiveRoute;
  const vaultHeaderBannerImage = isPhotoAlbumsImmersiveRoute
    ? MY_PHOTO_ALBUMS_BANNER_IMAGE
    : isRecordVaultImmersiveRoute
      ? MY_NOTE_BANNER_IMAGE
      : undefined;
  const vaultHeaderBannerSx = isPhotoAlbumsImmersiveRoute
    ? myPhotoAlbumsHeaderBannerSx
    : isRecordVaultImmersiveRoute
      ? myNoteHeaderBannerSx
      : undefined;
  const isLandingRoute = location.pathname === '/' || location.pathname === '/landing' || location.pathname === '/mall';
  const isVsinglesLandingRoute = isTutaDatesLandingPath(location.pathname);
  const isMenuDatingRoute =
    location.pathname === '/allSingles' ||
    location.pathname === '/myPicks' ||
    location.pathname === '/interestedSingles' ||
    location.pathname === RECEIVED_BIO_REQUESTS_PATH ||
    location.pathname === PROFILES_RECORDS_PATH ||
    location.pathname === ADMIN_TOOLS_PATH ||
    isVettedFriendsPath(location.pathname) ||
    location.pathname === '/request-ive-sent' ||
    location.pathname === '/send-flower' ||
    location.pathname.startsWith('/request-ive-sent/');
  const isDatingRoute =
    isTutaDatesPath(location.pathname) ||
    location.pathname.startsWith('/dashboard') ||
    location.pathname === '/verifyself' ||
    location.pathname === SELF_REPORT_BIOGRAPHY_PATH ||
    location.pathname.startsWith('/request-') ||
    isMenuDatingRoute;
  /** Mobile member-grid pages: shrink-wrap main so document scroll includes whole cards (photo + buttons), not a trapped inner strip */
  const isSinglesMemberListRoute =
    location.pathname.endsWith('/allSingles') || location.pathname.endsWith('/myPicks') || location.pathname.endsWith('/interestedSingles');
  const singlesListMobileShrinkWrap = isSinglesMemberListRoute && downSM;

  /** My Vetting / verifyself: drop top header (logo + banner) on sub-lg viewports only; desktop unchanged */
  const hideVerifySelfAppBar = location.pathname === '/verifyself' && downLG;

  /** Mall/landing sub-lg + phone menu pages: footer only after scrolling to page bottom. */
  const mobileFooterEndOfScroll = (downLG && isLandingRoute) || (mobileEdgeToEdge && !isLandingRoute);
  /** Phone pages with footer at scroll end: grow with content so footer is reachable. */
  const mobileScrollShrinkWrap = mobileFooterEndOfScroll && !isLandingRoute;

  useRouteOrientationLock();

  useEffect(() => {
    if (isNavigationCollapseDisabled()) {
      // Desktop UI tests: keep menu open. Mobile: closed so main content is full viewport width.
      handlerDrawerOpen(!mobileEdgeToEdge);
      return;
    }
    handlerDrawerOpen(!miniDrawer);
  }, [miniDrawer, mobileEdgeToEdge]);

  useEffect(() => {
    if (isNavigationCollapseDisabled()) return;
    downMD && handlerDrawerOpen(false);
  }, [downMD]);

  // horizontal menu-list bar : drawer

  if (menuMasterLoading) return <Loader />;

  const zoomFactor = (pageZoom ?? 100) / 100;
  const isZoomDefault = zoomFactor === 1;

  const hasTransform = downSM || !isZoomDefault;
  const useLandingPagePanel = isColorTemplate15LandingPageRoute(location.pathname);
  const useLandingFrame = isColorTemplate14LandingFrameRoute(location.pathname);
  const renderOutlet = () => {
    const outlet = <Outlet />;
    if (useLandingPagePanel) return <ColorTemplate15LandingPage>{outlet}</ColorTemplate15LandingPage>;
    return outlet;
  };
  const scaledContent = (
    <Box
      sx={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        ...(isLandingRoute && {
          width: '100%',
          height: '100%',
          minHeight: 0
        }),
        // Mobile: render the main column at 2× then scale(0.5) so in-app page zoom matches desktop.
        // Mall/landing skips this — it already scales its own tiles; the extra 0.5× made icons tiny on phones.
        ...(downSM &&
          !isLandingRoute && {
            width: '100%',
            minHeight: '100%'
          }),
        ...(!downSM &&
          !isZoomDefault && {
            width: `${100 / zoomFactor}%`,
            minHeight: `${100 / zoomFactor}vh`,
            transform: `scale(${zoomFactor})`,
            transformOrigin: '0 0'
          })
      }}
    >
      {/* menu / drawer — phone: overlay only (rendered outside this flex row) */}
      {!isLandingRoute && !isVaultImmersiveRoute && !mobileEdgeToEdge && <Sidebar />}

      {/* Scroll only the main column so overflow:auto does not clip sidebar rows scaled with transform */}
      <Box
        data-main-scroll-column
        tabIndex={-1}
        sx={{
          flexGrow: 1,
          minWidth: 0,
          minHeight: 0,
          overflow: 'auto',
          position: 'relative',
          zIndex: 0,
          outline: 'none',
          ...(!isLandingRoute && { display: 'flex', flexDirection: 'column' }),
          ...(isLandingRoute && { display: 'block' })
        }}
      >
        <MainContentStyled
          stretch={!isLandingRoute && !singlesListMobileShrinkWrap && !mobileScrollShrinkWrap}
          edgeToEdge={(!isLandingRoute && mobileEdgeToEdge) || isVsinglesLandingRoute}
          {...{ borderRadius, open: isLandingRoute ? false : drawerOpen, noTopMargin: true }}
        >
          <Box
            sx={{
              px: { xs: 0 },
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              ...(mobileEdgeToEdge &&
                !isLandingRoute && {
                  ml: 0,
                  mr: 0,
                  pl: 0,
                  pr: 0,
                  width: '100%',
                  maxWidth: '100%',
                  '& .MuiCard-root': { borderRadius: 0, mx: 0, width: '100%', maxWidth: '100%' },
                  '& .MuiCardContent-root': {
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    padding: { xs: 0, sm: '24px' },
                    '&:last-child': { pb: { xs: 2, sm: 3 } }
                  },
                  '& .MuiCardHeader-root': { px: { xs: 1, sm: 1.5 }, py: { xs: 1, sm: 1.5 } },
                  '& .MuiStack-root': { width: '100%', maxWidth: '100%' }
                }),
              ...(isLandingRoute
                ? {
                    position: 'relative',
                    height: '100%',
                    minHeight: 0,
                    maxHeight: '100%',
                    pb: 0,
                    overflow: 'hidden'
                  }
                : singlesListMobileShrinkWrap || mobileScrollShrinkWrap
                  ? { flex: '0 1 auto', minHeight: 'auto', width: '100%' }
                  : { flex: 1, minHeight: 0 })
            }}
          >
            {!isLandingRoute && !isVaultImmersiveRoute ? <AdminImpersonationBanner /> : null}
            {!isLandingRoute && !isVsinglesLandingRoute && !isVaultImmersiveRoute && <Breadcrumbs />}
            {isVsinglesLandingRoute ? (
              <Box sx={{ flex: '1 1 0%', minHeight: 0, display: 'flex', flexDirection: 'column', width: '100%' }}>
                {renderOutlet()}
              </Box>
            ) : (
              renderOutlet()
            )}
          </Box>
        </MainContentStyled>
        {mobileFooterEndOfScroll && !isLandingRoute ? (
          <Box sx={{ flexShrink: 0, width: '100%' }}>
            <Footer inline />
          </Box>
        ) : null}
      </Box>
    </Box>
  );

  const innerLayout = (
    <Box sx={{ position: 'relative' }}>
      <MobileOrientationSimulatedViewport downLG={downLG}>
        {hasTransform ? (
          <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* header – outside scaled box so it stays visible with footer */}
            {!hideVerifySelfAppBar && !isVaultImmersiveRoute && (
              <AppBar
                enableColorOnDark
                position="relative"
                color="inherit"
                elevation={isLandingRoute ? 0 : 0}
                sx={{
                  flexShrink: 0,
                  ...(!isLandingRoute &&
                    datingAppBarSx({ isLandingRoute, isDatingRoute, adminHeader, isVaultImmersiveRoute })),
                  ...(isLandingRoute &&
                    datingAppBarSx({ isLandingRoute, isDatingRoute, adminHeader, isVaultImmersiveRoute }))
                }}
              >
                <DatingAppBarToolbar
                  iconsOnly={isLandingRoute}
                  adminHeader={adminHeader}
                  showDemoOnlyBanner={showDemoOnlyBanner}
                />
              </AppBar>
            )}

            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                minWidth: 0,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {isLandingRoute ? (
                <Box
                  sx={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    minHeight: 0,
                    overflow: mobileFooterEndOfScroll ? 'auto' : 'hidden',
                    bgcolor: 'var(--theme-daynight-color)',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <Outlet />
                  {mobileFooterEndOfScroll && <Footer inline />}
                </Box>
              ) : (
                <>
                  {mobileEdgeToEdge && !isLandingRoute && !isVaultImmersiveRoute ? <Sidebar /> : null}
                  {scaledContent}
                </>
              )}
            </Box>

            {isLandingRoute && !mobileFooterEndOfScroll && (
              <Box sx={{ flexShrink: 0 }}>
                <Footer inline />
              </Box>
            )}
            {!isLandingRoute && !mobileFooterEndOfScroll && (
              <Box sx={{ flexShrink: 0 }}>
                <Footer inline />
              </Box>
            )}
          </Box>
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              height: '100vh',
              minHeight: '100vh',
              width: '100%',
              overflow: 'hidden'
            }}
          >
            {/* header – full on app pages; icons-only bar on mall/landing */}
            {!hideVerifySelfAppBar && !isVaultImmersiveRoute && (
              <AppBar
                enableColorOnDark
                position="fixed"
                color="inherit"
                elevation={isLandingRoute ? 0 : 0}
                sx={{
                  ...(!isLandingRoute &&
                    datingAppBarSx({ isLandingRoute, isDatingRoute, adminHeader, isVaultImmersiveRoute })),
                  ...(isLandingRoute &&
                    datingAppBarSx({ isLandingRoute, isDatingRoute, adminHeader, isVaultImmersiveRoute }))
                }}
              >
                <DatingAppBarToolbar
                  iconsOnly={isLandingRoute}
                  adminHeader={adminHeader}
                  showDemoOnlyBanner={showDemoOnlyBanner}
                />
              </AppBar>
            )}

            {isLandingRoute ? (
              <>
                <Box
                  sx={{
                    height: hideVerifySelfAppBar ? 0 : headerBarMinHeightCss(),
                    minHeight: hideVerifySelfAppBar ? 0 : headerBarMinHeightCss(),
                    flexShrink: 0
                  }}
                  aria-hidden
                />
                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    minWidth: 0,
                    overflow: mobileFooterEndOfScroll ? 'auto' : 'hidden',
                    position: 'relative',
                    bgcolor: 'var(--theme-daynight-color)',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <Outlet />
                  {mobileFooterEndOfScroll ? <Footer inline /> : null}
                </Box>
                {!mobileFooterEndOfScroll ? (
                  <Box sx={{ flexShrink: 0 }}>
                    <Footer inline />
                  </Box>
                ) : null}
              </>
            ) : (
              <ApplicationShell
                showHeader={!hideVerifySelfAppBar}
                showTopBanner={!isVaultImmersiveRoute && isDatingRoute}
                topBannerImage={vaultHeaderBannerImage}
                headerBannerSx={vaultHeaderBannerSx}
                sidebarOpen={drawerOpen}
                sidebarWidthPx={navDrawerOpenWidthPx}
                sidebarTopOffsetPx={isDatingRoute ? 76 : 0}
                borderRadius={borderRadius}
                mainStretch={!mobileScrollShrinkWrap}
                mainEdgeToEdge={mobileEdgeToEdge || isVsinglesLandingRoute || isVaultImmersiveRoute}
                immersiveMain={isVsinglesLandingRoute || isVaultImmersiveRoute}
                showSidebar={!isVaultImmersiveRoute}
                drawerOpen={drawerOpen}
                footerAtScrollEnd={mobileFooterEndOfScroll}
                showFixedFooter={!downLG && !mobileFooterEndOfScroll}
                landingPageWide={useLandingPagePanel}
                landingFrameWide={useLandingFrame}
              >
                <AdminImpersonationBanner />
                {!isVsinglesLandingRoute && !isVaultImmersiveRoute && <Breadcrumbs />}
                {renderOutlet()}
              </ApplicationShell>
            )}
          </Box>
        )}
      </MobileOrientationSimulatedViewport>
      {showZoom && <ZoomBar value={pageZoom ?? 100} onChange={(v) => setField('pageZoom', v)} />}
      {showViewportSize && <ViewportSizeReadout />}
      <UiTestFloatingStopButton />
      <LandscapeRecommendFloating />
      <VsinglesGuidedTourOverlay />
      <ProfilePhotoSetupRedirect />
      <IdentificationVerificationSetupRedirect />
      <LegacyPasswordUpgradeDialog
        open={Boolean(user) && requiresPasswordUpgrade}
        onSubmit={upgradeLegacyPassword}
      />
      <GenderSelfReportPopup
        open={needsGenderSelfReport && !requiresPasswordUpgrade}
        onCompleted={(flags) => {
          updateSessionDemoBuddyFlags({
            gender_self_report: flags?.gender_self_report,
            seeded_demo_buddies_boolean: flags?.seeded_demo_buddies_boolean
          });
        }}
      />
      <RecordVaultLeaveBusyOverlay />
      <PhotoAlbumsLeaveBusyOverlay />
    </Box>
  );

  return (
    <MobileOrientationSimProvider>
      {downSM ? <Box sx={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>{innerLayout}</Box> : innerLayout}
    </MobileOrientationSimProvider>
  );
}
