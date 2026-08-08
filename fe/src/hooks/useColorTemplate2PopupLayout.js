import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import useNavDrawerOpenWidthPx from 'hooks/useNavDrawerOpenWidthPx';
import { useGetMenuMaster } from 'api/menu';
import {
  COLOR_TEMPLATE2_POPUP_BACKDROP,
  COLOR_TEMPLATE2_POPUP_BORDER,
  COLOR_TEMPLATE2_POPUP_DEFAULT_MAX_HEIGHT,
  COLOR_TEMPLATE2_POPUP_DEFAULT_MAX_WIDTH,
  COLOR_TEMPLATE2_POPUP_Z_INDEX,
  colorTemplate2PopupPanelWidth
} from 'config/colorTemplate2Popup';

/**
 * Layout hook for ColorTemplate2Popup gallery centering (menu expand + menu shrink).
 */
export default function useColorTemplate2PopupLayout({
  maxWidth = COLOR_TEMPLATE2_POPUP_DEFAULT_MAX_WIDTH,
  maxHeight = COLOR_TEMPLATE2_POPUP_DEFAULT_MAX_HEIGHT,
  fitContent = false,
  minHeight = null,
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
  const panelWidth = colorTemplate2PopupPanelWidth(menuOffsetPx, edgePaddingPx, maxWidth);

  const overlaySx = {
    position: 'fixed',
    inset: 0,
    zIndex: COLOR_TEMPLATE2_POPUP_Z_INDEX,
    bgcolor: COLOR_TEMPLATE2_POPUP_BACKDROP,
    display: 'flex',
    alignItems: 'center',
    justifyContent: menuOffsetPx > 0 ? 'flex-start' : 'center',
    pl: menuOffsetPx > 0 ? `${menuOffsetPx + edgePaddingPx}px` : { xs: 1, sm: 2 },
    pr: { xs: 1, sm: 2 },
    py: { xs: 1, sm: 2 }
  };

  const panelShellSx = fitContent
    ? {
        width: panelWidth,
        maxWidth: panelWidth,
        height: 'auto',
        ...(minHeight ? { minHeight } : null),
        maxHeight,
        border: COLOR_TEMPLATE2_POPUP_BORDER,
        borderRadius: 1,
        overflow: 'hidden',
        overflowX: 'hidden',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch'
      }
    : {
        width: panelWidth,
        maxWidth: panelWidth,
        height: maxHeight,
        maxHeight,
        border: COLOR_TEMPLATE2_POPUP_BORDER,
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
