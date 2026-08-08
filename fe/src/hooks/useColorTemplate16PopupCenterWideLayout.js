import {
  COLOR_TEMPLATE16_POPUP_BACKDROP,
  COLOR_TEMPLATE16_POPUP_PANEL_WIDTH,
  COLOR_TEMPLATE16_POPUP_Z_INDEX
} from 'config/colorTemplate16PopupCenterWide';

/**
 * Viewport-centered overlay for ColorTemplate16PopupCenterWide (75vw, H+V center).
 */
export default function useColorTemplate16PopupCenterWideLayout() {
  const overlaySx = {
    position: 'fixed',
    inset: 0,
    zIndex: COLOR_TEMPLATE16_POPUP_Z_INDEX,
    bgcolor: COLOR_TEMPLATE16_POPUP_BACKDROP,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pl: { xs: 0.75, sm: 1 },
    pr: { xs: 0.75, sm: 1 },
    py: { xs: 0.75, sm: 1 }
  };

  const panelShellSx = {
    width: COLOR_TEMPLATE16_POPUP_PANEL_WIDTH,
    maxWidth: COLOR_TEMPLATE16_POPUP_PANEL_WIDTH,
    height: 'auto',
    flex: '0 0 auto',
    alignSelf: 'center',
    mx: 'auto',
    minWidth: 0
  };

  return { overlaySx, panelShellSx };
}
