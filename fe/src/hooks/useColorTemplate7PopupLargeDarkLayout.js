import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import useNavDrawerOpenWidthPx from 'hooks/useNavDrawerOpenWidthPx';
import { useGetMenuMaster } from 'api/menu';
import {
  COLOR_TEMPLATE7_POPUP_BACKDROP,
  COLOR_TEMPLATE7_POPUP_DEFAULT_MAX_WIDTH,
  COLOR_TEMPLATE7_POPUP_Z_INDEX,
  colorTemplate7PopupGalleryWidth
} from 'config/colorTemplate7PopupLargeDark';

/**
 * Gallery-centered overlay for ColorTemplate7PopupLargeDark (menu expand / shrink).
 * Panel always fills the available gallery column; optional maxWidth only caps narrower.
 */
export default function useColorTemplate7PopupLargeDarkLayout({
  maxWidth = COLOR_TEMPLATE7_POPUP_DEFAULT_MAX_WIDTH,
  edgePaddingPx: edgePaddingPxOverride,
  /** Narrower nested popups: center horizontally in the menu-aware gallery column. */
  centerInGallery = false,
  /** Center in the full browser viewport (ignore sidebar / gallery column offset). */
  centerInWindow = false
} = {}) {
  const theme = useTheme();
  const downMD = useMediaQuery(theme.breakpoints.down('md'));
  const downSM = useMediaQuery(theme.breakpoints.down('sm'));
  const navDrawerOpenWidthPx = useNavDrawerOpenWidthPx();
  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = Boolean(menuMaster?.isDashboardDrawerOpened);
  const menuOffsetPx = !downMD && drawerOpen ? navDrawerOpenWidthPx : 0;
  const edgePaddingPx = edgePaddingPxOverride ?? (downSM ? 8 : 12);
  const galleryWidth = colorTemplate7PopupGalleryWidth(menuOffsetPx, edgePaddingPx);
  const viewportWidth = `calc(100vw - ${edgePaddingPx * 2}px)`;
  const useFullGallery =
    !maxWidth || maxWidth === COLOR_TEMPLATE7_POPUP_DEFAULT_MAX_WIDTH;
  const panelWidth = centerInWindow
    ? useFullGallery
      ? viewportWidth
      : `min(${maxWidth}, ${viewportWidth})`
    : useFullGallery
      ? galleryWidth
      : `min(${maxWidth}, ${galleryWidth})`;

  const overlaySx = {
    position: 'fixed',
    inset: 0,
    zIndex: COLOR_TEMPLATE7_POPUP_Z_INDEX,
    bgcolor: COLOR_TEMPLATE7_POPUP_BACKDROP,
    display: 'flex',
    alignItems: 'center',
    justifyContent: centerInWindow || centerInGallery || menuOffsetPx === 0 ? 'center' : 'flex-start',
    pl: centerInWindow ? { xs: 0.75, sm: 1 } : menuOffsetPx > 0 ? `${menuOffsetPx + edgePaddingPx}px` : { xs: 0.75, sm: 1 },
    pr: { xs: 0.75, sm: 1 },
    py: { xs: 0.75, sm: 1 }
  };

  const panelShellSx = centerInWindow || centerInGallery
    ? {
        width: panelWidth,
        maxWidth: panelWidth,
        height: 'auto',
        flex: '0 0 auto',
        alignSelf: 'center',
        mx: 'auto',
        minWidth: 0
      }
    : {
        width: '100%',
        maxWidth: panelWidth,
        height: 'auto',
        flex: menuOffsetPx > 0 ? '1 1 auto' : undefined,
        minWidth: 0
      };

  return {
    menuOffsetPx,
    edgePaddingPx,
    panelWidth,
    overlaySx,
    panelShellSx
  };
}
