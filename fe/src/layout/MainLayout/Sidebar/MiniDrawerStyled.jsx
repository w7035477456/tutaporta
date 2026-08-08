// material-ui
import { styled } from '@mui/material/styles';
import Drawer from '@mui/material/Drawer';

// project imports
import { drawerWidthClosed, drawerWidthFallback } from 'store/constant';

const sidebarBg = 'var(--theme-daynight-color)';

function openedMixin(theme, openWidthPx) {
  const w = openWidthPx ?? drawerWidthFallback;
  return {
    width: w,
    borderRight: 'none',
    zIndex: theme.zIndex.drawer,
    background: sidebarBg,
    // Match parent flex row height (viewport minus header/footer) instead of full viewport.
    height: '100%',
    maxHeight: '100%',
    // MUI Drawer paper defaults to overflowY: auto, which clips scaled nav rows.
    overflow: 'visible !important',
    overflowX: 'visible',
    overflowY: 'visible',
    boxShadow: 'none',
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen + 200
    })
  };
}

function closedMixin(theme) {
  return {
    borderRight: 'none',
    zIndex: theme.zIndex.drawer,
    background: sidebarBg,
    height: '100%',
    maxHeight: '100%',
    overflow: 'visible !important',
    overflowX: 'visible',
    overflowY: 'visible',
    width: drawerWidthClosed,
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen + 200
    })
  };
}

// ==============================|| DRAWER - MINI STYLED ||============================== //

const MiniDrawerStyled = styled(Drawer, {
  shouldForwardProp: (prop) => prop !== 'open' && prop !== 'expandedDrawerWidthPx'
})(({ theme, open, expandedDrawerWidthPx }) => {
  const openW = expandedDrawerWidthPx ?? drawerWidthFallback;
  return {
    width: open ? openW : drawerWidthClosed,
    borderRight: '0px',
    flexShrink: 0,
    boxSizing: 'border-box',
    overflow: 'visible',
    ...(open && {
      ...openedMixin(theme, expandedDrawerWidthPx),
      '& .MuiDrawer-paper': openedMixin(theme, expandedDrawerWidthPx)
    }),
    ...(!open && {
      ...closedMixin(theme),
      '& .MuiDrawer-paper': closedMixin(theme)
    })
  };
});

export default MiniDrawerStyled;
