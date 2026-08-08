import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import useNavDrawerOpenWidthPx from 'hooks/useNavDrawerOpenWidthPx';
import { useGetMenuMaster } from 'api/menu';
import {
  COLOR_TEMPLATE3_POPUP_BACKDROP,
  COLOR_TEMPLATE3_POPUP_BORDER,
  COLOR_TEMPLATE3_POPUP_DEFAULT_MAX_WIDTH,
  COLOR_TEMPLATE3_POPUP_MAX_HEIGHT,
  COLOR_TEMPLATE3_POPUP_Z_INDEX,
  colorTemplate3PopupPanelWidth
} from 'config/colorTemplate3Popup';

/**
 * Layout hook for ColorTemplate3Popup gallery centering (menu expand + menu shrink).
 * Panel height shrink-wraps to content and stays vertically centered in the gallery.
 */
export default function useColorTemplate3PopupLayout({
  maxWidth = COLOR_TEMPLATE3_POPUP_DEFAULT_MAX_WIDTH,
  edgePaddingPx: edgePaddingPxOverride
} = {}) {
  const theme = useTheme();
  const downMD = useMediaQuery(theme.breakpoints.down('md'));
  const downSM = useMediaQuery(theme.breakpoints.down('sm'));
  const navDrawerOpenWidthPx = useNavDrawerOpenWidthPx();
  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = Boolean(menuMaster?.isDashboardDrawerOpened);
  const menuOffsetPx = !downMD && drawerOpen ? navDrawerOpenWidthPx : 0;
  const edgePaddingPx = edgePaddingPxOverride ?? (downSM ? 8 : 16);
  const panelWidth = colorTemplate3PopupPanelWidth(menuOffsetPx, edgePaddingPx, maxWidth);

  const overlaySx = {
    position: 'fixed',
    inset: 0,
    zIndex: COLOR_TEMPLATE3_POPUP_Z_INDEX,
    bgcolor: COLOR_TEMPLATE3_POPUP_BACKDROP,
    display: 'flex',
    alignItems: 'center',
    justifyContent: menuOffsetPx > 0 ? 'flex-start' : 'center',
    pl: menuOffsetPx > 0 ? `${menuOffsetPx + edgePaddingPx}px` : { xs: 1, sm: 2 },
    pr: { xs: 1, sm: 2 },
    py: { xs: 1, sm: 2 }
  };

  const panelShellSx = {
    width: panelWidth,
    maxWidth: panelWidth,
    height: 'auto',
    maxHeight: COLOR_TEMPLATE3_POPUP_MAX_HEIGHT,
    border: COLOR_TEMPLATE3_POPUP_BORDER,
    borderRadius: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch'
  };

  return {
    menuOffsetPx,
    edgePaddingPx,
    panelWidth,
    overlaySx,
    panelShellSx
  };
}
