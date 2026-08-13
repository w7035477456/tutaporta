import { memo, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import UnSelectedButtonTemplate from 'ui-component/UnSelectedButtonTemplate';

// project imports
import MenuList from '../MenuList';
import LogoSection from '../LogoSection';
import MiniDrawerStyled from './MiniDrawerStyled';

import useConfig from 'hooks/useConfig';
import useNavDrawerOpenWidthPx from 'hooks/useNavDrawerOpenWidthPx';
import { getSidebarCollapsedControlSizePx, getSidebarMenuFontSizeResponsive } from 'config/menuNavFontEnv';
import { drawerWidthClosed } from 'store/constant';
import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';
import { isNavigationCollapseDisabled, navigationDrawerOpenState } from 'config/navigationCollapseEnv';
import { SIDEBAR_MOBILE_CLOSE_MEDIA } from 'config/sidebarMobileCloseEnv';

import { IconChevronsLeft, IconMenu2 } from '@tabler/icons-react';
import { SELF_REPORT_BIOGRAPHY_PATH } from 'constants/selfReportBiographyRoute';
import { RECEIVED_BIO_REQUESTS_PATH } from 'constants/receivedBioRequestsRoute';

const sidebarMenuFontSize = getSidebarMenuFontSizeResponsive();

// ==============================|| SIDEBAR DRAWER ||============================== //

function Sidebar() {
  const theme = useTheme();
  const downMD = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const downSM = useMediaQuery((theme) => theme.breakpoints.down('sm'));
  const sidebarMobileFullWidth = useMediaQuery(SIDEBAR_MOBILE_CLOSE_MEDIA);

  const { pathname } = useLocation();

  const isEMarketPlaceSection = pathname.startsWith('/eMarketPlace/');

  const isUnderConstructionMallSection =
    pathname === '/eMarketPlace' ||
    pathname === '/onlineProfessionals' ||
    pathname === '/eClassifieds' ||
    pathname === '/eServices';

  const mallCompactCloseMenuLayout = isUnderConstructionMallSection || isEMarketPlaceSection;

  const isVsinglesSection =
    pathname.startsWith('/vsingles') ||
    pathname.startsWith('/dashboard') ||
    pathname === '/verifyself' ||
    pathname === SELF_REPORT_BIOGRAPHY_PATH ||
    pathname === '/allSingles' ||
    pathname === '/myPicks' ||
    pathname === '/interestedSingles' ||
    pathname === RECEIVED_BIO_REQUESTS_PATH ||
    pathname === '/vettedFriends' ||
    pathname === '/request-ive-sent' ||
    pathname === '/send-flower' ||
    pathname.startsWith('/vettedFriends/') ||
    pathname.startsWith('/request-ive-sent/') ||
    pathname.startsWith('/request-');
  const vsinglesSidebarTopOffsetPx = isVsinglesSection ? 76 : 0;

  const { menuMaster } = useGetMenuMaster();
  const navCollapseDisabled = isNavigationCollapseDisabled();
  const drawerOpen = navigationDrawerOpenState(menuMaster?.isDashboardDrawerOpened);

  const handleNavAreaClick = (event) => {
    if (navCollapseDisabled) return;
    // Keep explicit controls independent from container click behavior.
    if (event.target.closest('[data-menu-toggle="true"]')) return;

    const clickedInteractiveElement = event.target.closest(
      'button, a, [role="button"], input, textarea, select'
    );

    // Collapsed: tap empty strip to expand.
    if (!drawerOpen) {
      if (!clickedInteractiveElement) handlerDrawerOpen(true);
      return;
    }

    // Expanded: only auto-close when tapping empty padding (not a nav row, link, or control).
    if (!clickedInteractiveElement) {
      handlerDrawerOpen(false);
    }
  };

  const {
    state: { miniDrawer }
  } = useConfig();

  const navDrawerOpenWidthPx = useNavDrawerOpenWidthPx();
  const sidebarTopPadding = isVsinglesSection ? 2.5 : 1.5;
  /** Phone viewports: overlay drawer only — main column uses full viewport width. */
  const useTemporaryDrawer =
    sidebarMobileFullWidth || (!navCollapseDisabled && (downMD || (miniDrawer && drawerOpen)));

  const menuToggle = useMemo(
    () =>
      navCollapseDisabled ? null : drawerOpen ? (
        <Box sx={{ px: 0, pt: isVsinglesSection ? '10px' : '6px', mt: mallCompactCloseMenuLayout || isVsinglesSection ? 1.5 : 0 }}>
          <UnSelectedButtonTemplate
            data-menu-toggle="true"
            disableElevation
            disableRipple
            aria-label="Close menu"
            onClick={() => handlerDrawerOpen(false)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            startIcon={<IconChevronsLeft size={20} />}
            sx={{
              width: sidebarMobileFullWidth
                ? 'calc(100% - 6px)'
                : { xs: 'calc(100% - 8vw)', sm: 'calc(100% - 6vw)' },
              mx: sidebarMobileFullWidth ? '3px' : 'auto',
              display: 'flex',
              WebkitTouchCallout: 'none',
              WebkitTapHighlightColor: 'transparent',
              userSelect: 'none',
              fontSize: sidebarMenuFontSize,
              py: 1.2,
              lineHeight: 1.2,
              '& .MuiButton-startIcon': { color: 'inherit' }
            }}
          >
            Close Menu
          </UnSelectedButtonTemplate>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 0.5 }}>
          <IconButton
            data-menu-toggle="true"
            aria-label="Open menu"
            disableRipple
            onClick={() => handlerDrawerOpen(true)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            sx={{
              bgcolor: 'var(--theme-primary-color)',
              color: 'var(--theme-secondary-color)',
              borderRadius: '12px',
              width: getSidebarCollapsedControlSizePx(),
              height: getSidebarCollapsedControlSizePx(),
              WebkitTouchCallout: 'none',
              WebkitTapHighlightColor: 'transparent',
              userSelect: 'none',
              boxShadow: '0px 3px 1px -2px rgba(0,0,0,0.2), 0px 2px 2px 0px rgba(0,0,0,0.14), 0px 1px 5px 0px rgba(0,0,0,0.12)',
              transition: 'all 0.15s ease',
              transform: 'translate(0, 0)',
              '&:hover': {
                bgcolor: 'var(--theme-primary-color)',
                color: 'var(--theme-secondary-color)',
                filter: 'brightness(0.92)',
                boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.2), 0px 4px 5px 0px rgba(0,0,0,0.14), 0px 1px 10px 0px rgba(0,0,0,0.12)',
                transform: 'translate(2px, 2px) !important'
              },
              '&:active': { transform: 'translate(4px, 4px) !important', boxShadow: '0px 1px 1px 0px rgba(0,0,0,0.2), 0px 1px 1px 0px rgba(0,0,0,0.14), 0px 1px 2px 0px rgba(0,0,0,0.12)' }
            }}
          >
            <IconMenu2 size={22} />
          </IconButton>
        </Box>
      ),
    [drawerOpen, downSM, isVsinglesSection, mallCompactCloseMenuLayout, navCollapseDisabled, sidebarMobileFullWidth]
  );

  const logo = useMemo(
    () => (
      <Box sx={{ display: 'flex', p: downSM ? 1 : 2 }}>
        <LogoSection />
      </Box>
    ),
    [downSM]
  );

  const drawer = useMemo(() => {
    let drawerSX = { paddingLeft: 0, paddingRight: 0, marginTop: '8px' };
    if (drawerOpen) {
      drawerSX = { paddingLeft: 0, paddingRight: 0, marginTop: 0 };
    }

    const navPanelBg = { bgcolor: 'var(--theme-daynight-color)' };

    return (
      <>
        {downMD ? (
          <Box
            sx={{
              ...drawerSX,
              ...navPanelBg,
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <MenuList />
          </Box>
        ) : (
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              ...drawerSX,
              ...navPanelBg
            }}
          >
            <MenuList />
          </Box>
        )}
      </>
    );
  }, [downMD, drawerOpen, downSM]);

  return (
    <Box
      component="nav"
      data-guest-demo-allow="true"
      sx={{
        flexShrink: { md: 0 },
        alignSelf: 'stretch',
        height: { md: '100%' },
        minHeight: { md: 0 },
        width: navCollapseDisabled
          ? navDrawerOpenWidthPx
          : { xs: 'auto', md: drawerOpen ? navDrawerOpenWidthPx : drawerWidthClosed },
        transition: 'width 0.3s ease',
        position: 'relative',
        pt: { md: isVsinglesSection ? `${vsinglesSidebarTopOffsetPx}px` : 0 },
        boxSizing: 'border-box',
        zIndex: theme.zIndex.modal,
        overflow: 'visible',
        WebkitTouchCallout: 'none',
        WebkitTapHighlightColor: 'transparent',
        ...(sidebarMobileFullWidth && {
          position: 'fixed',
          width: 0,
          minWidth: 0,
          height: 0,
          overflow: 'visible',
          pointerEvents: 'none'
        })
      }}
      aria-label="mailbox folders"
    >
      {useTemporaryDrawer ? (
        <Drawer
          variant={sidebarMobileFullWidth || downMD ? 'temporary' : 'persistent'}
          anchor="left"
          open={drawerOpen}
          onClose={() => handlerDrawerOpen(!drawerOpen)}
          slotProps={{
            paper: {
              sx: {
                mt: downMD ? 0 : 11,
                zIndex: theme.zIndex.drawer,
                width: sidebarMobileFullWidth
                  ? '100vw'
                  : downSM
                    ? `min(${navDrawerOpenWidthPx}px, calc(100vw - 16px))`
                    : navDrawerOpenWidthPx,
                maxWidth: sidebarMobileFullWidth ? '100vw' : undefined,
                boxSizing: 'border-box',
                bgcolor: 'var(--theme-daynight-color)',
                color: 'text.primary',
                borderRight: 'none',
                overflow: 'visible !important',
                overflowX: 'visible',
                overflowY: 'visible',
                ...(sidebarMobileFullWidth && { pointerEvents: 'auto' })
              }
            }
          }}
          ModalProps={{ keepMounted: true }}
          color="inherit"
          sx={sidebarMobileFullWidth ? { pointerEvents: 'none', '& .MuiDrawer-paper': { pointerEvents: 'auto' } } : undefined}
        >
          <Box
            data-guest-demo-allow="true"
            sx={{
              pt: sidebarTopPadding,
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
              height: '100%',
              overflow: 'visible'
            }}
            onClick={handleNavAreaClick}
          >
            {downMD && logo}
            {menuToggle}
            {drawer}
          </Box>
        </Drawer>
      ) : (
        <MiniDrawerStyled
          variant="permanent"
          open={navCollapseDisabled ? true : drawerOpen}
          expandedDrawerWidthPx={navDrawerOpenWidthPx}
        >
          <Box
            data-guest-demo-allow="true"
            sx={{
              pt: sidebarTopPadding,
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
              height: '100%',
              overflow: 'visible'
            }}
            onClick={handleNavAreaClick}
          >
            {menuToggle}
            {drawer}
          </Box>
        </MiniDrawerStyled>
      )}
    </Box>
  );
}

export default memo(Sidebar);
