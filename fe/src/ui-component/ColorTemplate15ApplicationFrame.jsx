import PropTypes from 'prop-types';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import ColorTemplate4TitlesPhrase from 'ui-component/ColorTemplate4TitlesPhrase';
import Footer from 'layout/MainLayout/Footer';
import SupportMessageDialog from 'ui-component/SupportMessageDialog';
import UnSelectedButtonTemplate from 'ui-component/UnSelectedButtonTemplate';
import MusicTrack from 'ui-component/MusicTrack';
import SiteFooterCopyright from 'ui-component/SiteFooterCopyright';
import {
  ORANGE_INSTRUCTION_BUTTON_TEMPLATE_PROPS,
  orangeUnSelectedInstructionButtonSx
} from 'config/orangeInstructionButton';
import { siteFooterTextFontSize } from 'config/footerFontEnv';
import { resolveApplicationFramePreset } from 'config/applicationFramePresets';
import { adminImpersonationHeaderCenterWrapSx } from 'config/adminImpersonationHeader';
import { useLoginDemoMode } from 'contexts/LoginDemoModeContext';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';
import {
  COLOR_TEMPLATE15_APPLICATION_FRAME_HEADER_HEIGHT_PX,
  colorTemplate15ApplicationFrameBodyRowSx,
  colorTemplate15ApplicationFrameFooterLeftSx,
  colorTemplate15ApplicationFrameFooterRightSx,
  colorTemplate15ApplicationFrameFooterShellSx,
  colorTemplate15ApplicationFrameHeaderBarSx,
  colorTemplate15ApplicationFrameHeaderSpacerSx,
  colorTemplate15ApplicationFrameHeaderToolbarSx,
  colorTemplate15ApplicationFrameMainContentSx,
  colorTemplate15ApplicationFrameMainPanelSx,
  colorTemplate15ApplicationFrameMainScrollColumnSx,
  colorTemplate15ApplicationFrameRootSx,
  colorTemplate15ApplicationFrameSidebarMenuSx,
  colorTemplate15ApplicationFrameSidebarPhraseSx,
  colorTemplate15ApplicationFrameSidebarSx,
  colorTemplate15ApplicationFrameTopBannerSx
} from 'config/colorTemplate15ApplicationFrame';
import { drawerWidthFallback } from 'store/constant';

/**
 * ColorTemplate15ApplicationFrame — reusable 7-region app shell.
 *
 * Regions:
 *  1 TopBanner       — `topBannerImage` on fixed header
 *  2 HeaderBar       — `headerLeft` + `headerRight` (notification / theme / profile)
 *  3 SidebarMenu     — `sidebarMenu` (ColorTemplate10Menu rows)
 *  4 SidebarPhrase   — `sidebarPhrase` (cursive text in free sidebar area)
 *  5 FooterLeft      — legal links + copyright (default built-in)
 *  6 FooterRight     — mute / track / support (default built-in)
 *  7 Main            — `children` (theme day/night scroll body)
 *
 * New app quick start:
 *   1. Copy a preset in `config/applicationFramePresets.js` (new icon + phrase + banner).
 *   2. Render `<ColorTemplate15ApplicationFrame preset={MY_APP_FRAME} headerLeft={...} headerRight={...} sidebarMenu={...}>{routes}</ColorTemplate15ApplicationFrame>`.
 *
 * @typedef {{
 *   id: string,
 *   label?: string,
 *   topBannerImage?: string | null,
 *   sidebarPhrase?: string,
 *   footerInline?: boolean,
 *   showMusicControls?: boolean,
 *   showSupportButton?: boolean
 * }} ApplicationFramePreset
 */

function ColorTemplate15ApplicationFrameTopBanner({ topBannerImage, sx, children }) {
  return (
    <Box
      aria-hidden={!children}
      sx={{
        ...colorTemplate15ApplicationFrameTopBannerSx(topBannerImage),
        ...(sx || {})
      }}
    >
      {children}
    </Box>
  );
}

function ColorTemplate15ApplicationFrameHeaderBar({
  topBannerImage,
  headerBannerSx,
  headerCenter,
  headerLeft,
  headerRight,
  sx,
  toolbarSx
}) {
  return (
    <AppBar
      enableColorOnDark
      position="fixed"
      color="inherit"
      elevation={0}
      sx={{
        ...colorTemplate15ApplicationFrameHeaderBarSx(),
        ...colorTemplate15ApplicationFrameTopBannerSx(topBannerImage),
        ...(headerBannerSx || {}),
        ...(sx || {})
      }}
    >
      <Toolbar sx={{ ...colorTemplate15ApplicationFrameHeaderToolbarSx(), position: 'relative', ...(toolbarSx || {}) }}>
        {headerLeft}
        {headerCenter ? (
          <Box sx={adminImpersonationHeaderCenterWrapSx}>{headerCenter}</Box>
        ) : null}
        <Box sx={{ flexGrow: 1 }} />
        {headerRight}
      </Toolbar>
    </AppBar>
  );
}

function ColorTemplate15ApplicationFrameSidebar({
  open = true,
  widthPx = drawerWidthFallback,
  menu,
  phrase,
  sidebarOpen = open,
  topOffsetPx = 0,
  sx,
  menuSx,
  phraseSx,
  children
}) {
  const menuNode = menu ?? children;
  const showPhrase = sidebarOpen && phrase != null && phrase !== '';

  return (
    <Box
      sx={{
        ...colorTemplate15ApplicationFrameSidebarSx({ widthPx, open: sidebarOpen }),
        pt: topOffsetPx > 0 ? `${topOffsetPx}px` : undefined,
        ...(sx || {})
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          ...(sidebarOpen ? { mt: 1.5 } : null)
        }}
      >
        {menuNode ? (
          <Box sx={{ ...colorTemplate15ApplicationFrameSidebarMenuSx(), ...(menuSx || {}) }}>{menuNode}</Box>
        ) : null}
        {showPhrase ? (
          <Box sx={{ ...colorTemplate15ApplicationFrameSidebarPhraseSx(), ...(phraseSx || {}) }}>
            {typeof phrase === 'string' ? <ColorTemplate4TitlesPhrase>{phrase}</ColorTemplate4TitlesPhrase> : phrase}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

function ColorTemplate15ApplicationFrameMain({
  children,
  borderRadius = 8,
  stretch = true,
  scrollRef,
  panelSx,
  contentSx,
  scrollColumnSx
}) {
  return (
    <Box
      data-application-frame-main-scroll
      ref={scrollRef}
      tabIndex={-1}
      sx={{ ...colorTemplate15ApplicationFrameMainScrollColumnSx(), ...(scrollColumnSx || {}) }}
    >
      <Box
        component="main"
        sx={{ ...colorTemplate15ApplicationFrameMainPanelSx({ borderRadius, stretch }), ...(panelSx || {}) }}
      >
        <Box sx={{ ...colorTemplate15ApplicationFrameMainContentSx(), ...(contentSx || {}) }}>{children}</Box>
      </Box>
    </Box>
  );
}

function ColorTemplate15ApplicationFrameFooterLeft({ sx, aboutPath = '/pages/aboutUs', termsPath = '/pages/termsAndConditions', privacyPath = '/pages/privacyPolicy' }) {
  const linkSx = {
    fontSize: siteFooterTextFontSize,
    color: 'inherit',
    textDecoration: 'none',
    '&:hover': { textDecoration: 'underline' }
  };

  return (
    <Stack
      direction="row"
      spacing={0.5}
      alignItems="center"
      justifyContent="center"
      flexWrap="wrap"
      useFlexGap
      {...guestDemoAllowProps()}
      sx={{ ...colorTemplate15ApplicationFrameFooterLeftSx(), ...(sx || {}) }}
    >
      <Typography component={RouterLink} to={aboutPath} variant="subtitle2" sx={{ ...linkSx, textDecoration: 'underline' }}>
        About us
      </Typography>
      <Typography variant="subtitle2" sx={{ fontSize: siteFooterTextFontSize, color: 'inherit' }}>
        |
      </Typography>
      <Typography component={RouterLink} to={termsPath} variant="subtitle2" sx={{ ...linkSx, textDecoration: 'underline' }}>
        Terms &amp; Conditions
      </Typography>
      <Typography variant="subtitle2" sx={{ fontSize: siteFooterTextFontSize, color: 'inherit' }}>
        |
      </Typography>
      <Typography component={RouterLink} to={privacyPath} variant="subtitle2" sx={{ ...linkSx, textDecoration: 'underline' }}>
        Privacy Policy
      </Typography>
      <Typography variant="subtitle2" sx={{ fontSize: siteFooterTextFontSize, color: 'inherit' }}>
        |
      </Typography>
      <SiteFooterCopyright version="v2" />
    </Stack>
  );
}

function ColorTemplate15ApplicationFrameFooterRight({ showMusicControls = true, showSupportButton = true, sx }) {
  const [supportOpen, setSupportOpen] = useState(false);
  const { blockDemoAction } = useLoginDemoMode();

  return (
    <>
      <Box sx={{ ...colorTemplate15ApplicationFrameFooterRightSx(), ...(sx || {}) }}>
        {showSupportButton ? (
          <UnSelectedButtonTemplate
            fitLabelWidth
            aria-label="Contact support"
            onClick={(event) => {
              if (blockDemoAction(event)) return;
              setSupportOpen(true);
            }}
            {...ORANGE_INSTRUCTION_BUTTON_TEMPLATE_PROPS}
            sx={{
              ...orangeUnSelectedInstructionButtonSx({ transformOrigin: 'center center' }),
              minWidth: 0,
              flexShrink: 0
            }}
          >
            Support
          </UnSelectedButtonTemplate>
        ) : null}
        {showMusicControls ? (
          <Box {...guestDemoAllowProps()} sx={{ display: 'inline-flex' }}>
            <MusicTrack variant="footer" />
          </Box>
        ) : null}
      </Box>
      <SupportMessageDialog open={supportOpen} onClose={() => setSupportOpen(false)} />
    </>
  );
}

function ColorTemplate15ApplicationFrameFooterBar({
  inline = false,
  footerLeft,
  footerRight,
  showMusicControls = true,
  showSupportButton = true,
  sx
}) {
  return (
    <Box
      sx={{ ...colorTemplate15ApplicationFrameFooterShellSx({ inline }), ...(sx || {}) }}
    >
      {footerLeft ?? <ColorTemplate15ApplicationFrameFooterLeft />}
      {footerRight ?? (
        <ColorTemplate15ApplicationFrameFooterRight
          showMusicControls={showMusicControls}
          showSupportButton={showSupportButton}
        />
      )}
    </Box>
  );
}

function ColorTemplate15ApplicationFrame({
  children,
  preset,
  topBannerImage,
  headerBannerSx,
  headerCenter,
  headerLeft,
  headerRight,
  showHeader = true,
  sidebar,
  sidebarMenu,
  sidebarPhrase,
  sidebarOpen = true,
  sidebarWidthPx = drawerWidthFallback,
  sidebarTopOffsetPx = 0,
  footer,
  footerLeft,
  footerRight,
  footerInline,
  showFooter = true,
  showMusicControls,
  showSupportButton,
  borderRadius = 8,
  mainStretch = true,
  mainScrollRef,
  sx,
  mainPanelSx,
  mainContentSx,
  mainScrollColumnSx
}) {
  const resolvedPreset = resolveApplicationFramePreset(preset);
  const banner = topBannerImage ?? resolvedPreset?.topBannerImage ?? null;
  const phrase = sidebarPhrase ?? resolvedPreset?.sidebarPhrase ?? '';
  const inlineFooter = footerInline ?? resolvedPreset?.footerInline ?? false;
  const musicOn = showMusicControls ?? resolvedPreset?.showMusicControls ?? true;
  const supportOn = showSupportButton ?? resolvedPreset?.showSupportButton ?? true;

  return (
    <Box sx={{ ...colorTemplate15ApplicationFrameRootSx(), ...(sx || {}) }}>
      {showHeader ? (
        <ColorTemplate15ApplicationFrameHeaderBar
          topBannerImage={banner}
          headerBannerSx={headerBannerSx}
          headerCenter={headerCenter}
          headerLeft={headerLeft}
          headerRight={headerRight}
        />
      ) : null}

      {showHeader ? (
        <Box
          sx={{
            ...colorTemplate15ApplicationFrameHeaderSpacerSx(),
            ...colorTemplate15ApplicationFrameTopBannerSx(banner),
            ...(headerBannerSx || {})
          }}
          aria-hidden
        />
      ) : null}

      <Box sx={colorTemplate15ApplicationFrameBodyRowSx()}>
        {sidebar !== false ? (
          sidebar ?? (
            <ColorTemplate15ApplicationFrameSidebar
              open={sidebarOpen}
              sidebarOpen={sidebarOpen}
              widthPx={sidebarWidthPx}
              menu={sidebarMenu}
              phrase={phrase}
              topOffsetPx={sidebarTopOffsetPx}
            />
          )
        ) : null}

        <ColorTemplate15ApplicationFrameMain
          borderRadius={borderRadius}
          stretch={mainStretch}
          scrollRef={mainScrollRef}
          panelSx={mainPanelSx}
          contentSx={mainContentSx}
          scrollColumnSx={mainScrollColumnSx}
        >
          {children}
        </ColorTemplate15ApplicationFrameMain>
      </Box>

      {showFooter
        ? footer ?? (
            <ColorTemplate15ApplicationFrameFooterBar
              inline={inlineFooter}
              footerLeft={footerLeft}
              footerRight={footerRight}
              showMusicControls={musicOn}
              showSupportButton={supportOn}
            />
          )
        : null}
    </Box>
  );
}

ColorTemplate15ApplicationFrame.TopBanner = ColorTemplate15ApplicationFrameTopBanner;
ColorTemplate15ApplicationFrame.HeaderBar = ColorTemplate15ApplicationFrameHeaderBar;
ColorTemplate15ApplicationFrame.Sidebar = ColorTemplate15ApplicationFrameSidebar;
ColorTemplate15ApplicationFrame.Main = ColorTemplate15ApplicationFrameMain;
ColorTemplate15ApplicationFrame.Footer = ColorTemplate15ApplicationFrameFooterBar;
ColorTemplate15ApplicationFrame.FooterLeft = ColorTemplate15ApplicationFrameFooterLeft;
ColorTemplate15ApplicationFrame.FooterRight = ColorTemplate15ApplicationFrameFooterRight;
ColorTemplate15ApplicationFrame.DefaultFooter = Footer;
ColorTemplate15ApplicationFrame.HEADER_HEIGHT_PX = COLOR_TEMPLATE15_APPLICATION_FRAME_HEADER_HEIGHT_PX;

export default ColorTemplate15ApplicationFrame;

ColorTemplate15ApplicationFrame.propTypes = {
  children: PropTypes.node,
  preset: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  topBannerImage: PropTypes.string,
  headerBannerSx: PropTypes.object,
  headerCenter: PropTypes.node,
  headerLeft: PropTypes.node,
  headerRight: PropTypes.node,
  showHeader: PropTypes.bool,
  sidebar: PropTypes.node,
  sidebarMenu: PropTypes.node,
  sidebarPhrase: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  sidebarOpen: PropTypes.bool,
  sidebarWidthPx: PropTypes.number,
  sidebarTopOffsetPx: PropTypes.number,
  footer: PropTypes.node,
  footerLeft: PropTypes.node,
  footerRight: PropTypes.node,
  footerInline: PropTypes.bool,
  showFooter: PropTypes.bool,
  showMusicControls: PropTypes.bool,
  showSupportButton: PropTypes.bool,
  borderRadius: PropTypes.number,
  mainStretch: PropTypes.bool,
  mainScrollRef: PropTypes.oneOfType([PropTypes.func, PropTypes.shape({ current: PropTypes.any })]),
  sx: PropTypes.object,
  mainPanelSx: PropTypes.object,
  mainContentSx: PropTypes.object,
  mainScrollColumnSx: PropTypes.object
};

ColorTemplate15ApplicationFrameTopBanner.propTypes = {
  topBannerImage: PropTypes.string,
  sx: PropTypes.object,
  children: PropTypes.node
};

ColorTemplate15ApplicationFrameHeaderBar.propTypes = {
  topBannerImage: PropTypes.string,
  headerBannerSx: PropTypes.object,
  headerCenter: PropTypes.node,
  headerLeft: PropTypes.node,
  headerRight: PropTypes.node,
  sx: PropTypes.object,
  toolbarSx: PropTypes.object
};

ColorTemplate15ApplicationFrameSidebar.propTypes = {
  open: PropTypes.bool,
  widthPx: PropTypes.number,
  menu: PropTypes.node,
  phrase: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  sidebarOpen: PropTypes.bool,
  topOffsetPx: PropTypes.number,
  sx: PropTypes.object,
  menuSx: PropTypes.object,
  phraseSx: PropTypes.object,
  children: PropTypes.node
};

ColorTemplate15ApplicationFrameMain.propTypes = {
  children: PropTypes.node,
  borderRadius: PropTypes.number,
  stretch: PropTypes.bool,
  scrollRef: PropTypes.oneOfType([PropTypes.func, PropTypes.shape({ current: PropTypes.any })]),
  panelSx: PropTypes.object,
  contentSx: PropTypes.object,
  scrollColumnSx: PropTypes.object
};

ColorTemplate15ApplicationFrameFooterLeft.propTypes = {
  sx: PropTypes.object,
  aboutPath: PropTypes.string,
  termsPath: PropTypes.string,
  privacyPath: PropTypes.string
};

ColorTemplate15ApplicationFrameFooterRight.propTypes = {
  showMusicControls: PropTypes.bool,
  showSupportButton: PropTypes.bool,
  sx: PropTypes.object
};

ColorTemplate15ApplicationFrameFooterBar.propTypes = {
  inline: PropTypes.bool,
  footerLeft: PropTypes.node,
  footerRight: PropTypes.node,
  showMusicControls: PropTypes.bool,
  showSupportButton: PropTypes.bool,
  sx: PropTypes.object
};

export {
  colorTemplate15ApplicationFrameRootSx,
  colorTemplate15ApplicationFrameTopBannerSx,
  colorTemplate15ApplicationFrameHeaderBarSx,
  colorTemplate15ApplicationFrameHeaderToolbarSx,
  colorTemplate15ApplicationFrameHeaderSpacerSx,
  colorTemplate15ApplicationFrameBodyRowSx,
  colorTemplate15ApplicationFrameSidebarSx,
  colorTemplate15ApplicationFrameSidebarMenuSx,
  colorTemplate15ApplicationFrameSidebarPhraseSx,
  colorTemplate15ApplicationFrameMainScrollColumnSx,
  colorTemplate15ApplicationFrameMainPanelSx,
  colorTemplate15ApplicationFrameMainPanelEdgeToEdgeSx,
  colorTemplate15ApplicationFrameMainContentSx,
  colorTemplate15ApplicationFrameFooterShellSx,
  colorTemplate15ApplicationFrameFooterLeftSx,
  colorTemplate15ApplicationFrameFooterRightSx,
  COLOR_TEMPLATE15_APPLICATION_FRAME_HEADER_HEIGHT_PX
} from 'config/colorTemplate15ApplicationFrame';

export { resolveApplicationFramePreset, APPLICATION_FRAME_PRESETS } from 'config/applicationFramePresets';
