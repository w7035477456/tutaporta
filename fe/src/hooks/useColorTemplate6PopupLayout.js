import {
  COLOR_TEMPLATE6_POPUP_BACKDROP,
  COLOR_TEMPLATE6_POPUP_Z_INDEX
} from 'config/colorTemplate6Popup';

/**
 * Viewport-centered overlay for ColorTemplate6Popup (responsive to window resize).
 */
export default function useColorTemplate6PopupLayout() {
  const overlaySx = {
    position: 'fixed',
    inset: 0,
    zIndex: COLOR_TEMPLATE6_POPUP_Z_INDEX,
    bgcolor: COLOR_TEMPLATE6_POPUP_BACKDROP,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    px: { xs: 1, sm: 1.5 },
    py: { xs: 1, sm: 1.5 }
  };

  return { overlaySx };
}
