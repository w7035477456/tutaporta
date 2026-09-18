/**
 * ColorTemplate16PopupCenterWide — viewport-centered wide popup (75vw).
 * Secondary theme panel, inverse-daynight copy, white inputs, GreenButton actions, red/black top-right close X.
 */
import {
  COLOR_TEMPLATE7_POPUP_BACKDROP,
  COLOR_TEMPLATE7_POPUP_CLOSE_ACTIVE_SCALE,
  COLOR_TEMPLATE7_POPUP_CLOSE_HOVER_SCALE,
  COLOR_TEMPLATE7_POPUP_MAX_HEIGHT,
  COLOR_TEMPLATE7_POPUP_PANEL_BG,
  COLOR_TEMPLATE7_POPUP_Z_INDEX
} from 'config/colorTemplate7PopupLargeDark';

export const COLOR_TEMPLATE16_POPUP_PANEL_WIDTH = '75vw';
export const COLOR_TEMPLATE16_POPUP_DEFAULT_RESIZE_HEIGHT = '70vh';
export const COLOR_TEMPLATE16_POPUP_BACKDROP = COLOR_TEMPLATE7_POPUP_BACKDROP;
/** Above ColorTemplate7 (incl. global ErrorPopup) so Full Disk Encryption covers it. */
export const COLOR_TEMPLATE16_POPUP_Z_INDEX = COLOR_TEMPLATE7_POPUP_Z_INDEX + 100;
export const COLOR_TEMPLATE16_POPUP_PANEL_BG = COLOR_TEMPLATE7_POPUP_PANEL_BG;
export const COLOR_TEMPLATE16_POPUP_MAX_HEIGHT = COLOR_TEMPLATE7_POPUP_MAX_HEIGHT;

/**
 * Formerly constrained the backdrop to the top/bottom half of the viewport
 * (TutaNotes Cloud vs USB). That half-shade is retired — popups are full-viewport
 * centered. Kept as no-ops so any leftover `verticalHalf` props are harmless.
 */
export function colorTemplate16PopupVerticalHalfOverlaySx(_verticalHalf) {
  return {};
}

export function colorTemplate16PopupVerticalHalfPanelSx(_verticalHalf) {
  return {};
}

/** Top-right close X — red square, black X, black border. */
export function colorTemplate16PopupCloseSx(overrides = {}) {
  return {
    bgcolor: 'var(--theme-error-color) !important',
    border: '2px solid #000 !important',
    color: '#000 !important',
    WebkitTextFillColor: '#000 !important',
    '@media (hover: hover)': {
      '&:hover:not(.Mui-disabled)': {
        bgcolor: 'var(--theme-error-color) !important',
        color: '#000 !important',
        WebkitTextFillColor: '#000 !important',
        border: '2px solid #000 !important',
        filter: 'brightness(0.92)',
        transform: `scale(${COLOR_TEMPLATE7_POPUP_CLOSE_HOVER_SCALE})`
      }
    },
    '&:active:not(.Mui-disabled)': {
      bgcolor: 'var(--theme-error-color) !important',
      color: '#000 !important',
      WebkitTextFillColor: '#000 !important',
      border: '2px solid #000 !important',
      filter: 'brightness(0.85)',
      transform: `scale(${COLOR_TEMPLATE7_POPUP_CLOSE_ACTIVE_SCALE})`
    },
    ...overrides
  };
}

/** Bottom-right corner drag handle for resizable ColorTemplate16 popups. */
export function colorTemplate16PopupResizeHandleSx(overrides = {}) {
  return colorTemplate16PopupCornerResizeHandleSx('se', overrides);
}

/** Corner drag handle — corner: nw | ne | sw | se */
export function colorTemplate16PopupCornerResizeHandleSx(corner = 'se', overrides = {}) {
  const isTop = corner === 'nw' || corner === 'ne';
  const isLeft = corner === 'nw' || corner === 'sw';
  const cursor =
    corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize';

  const beforeSx = {
    content: '""',
    position: 'absolute',
    width: 12,
    height: 12,
    opacity: 0.9
  };

  if (corner === 'se') {
    Object.assign(beforeSx, {
      right: 4,
      bottom: 4,
      borderRight: '2px solid var(--theme-primary-color)',
      borderBottom: '2px solid var(--theme-primary-color)'
    });
  } else if (corner === 'sw') {
    Object.assign(beforeSx, {
      left: 4,
      bottom: 4,
      borderLeft: '2px solid var(--theme-primary-color)',
      borderBottom: '2px solid var(--theme-primary-color)'
    });
  } else if (corner === 'ne') {
    Object.assign(beforeSx, {
      right: 4,
      top: 4,
      borderRight: '2px solid var(--theme-primary-color)',
      borderTop: '2px solid var(--theme-primary-color)'
    });
  } else {
    Object.assign(beforeSx, {
      left: 4,
      top: 4,
      borderLeft: '2px solid var(--theme-primary-color)',
      borderTop: '2px solid var(--theme-primary-color)'
    });
  }

  return {
    position: 'absolute',
    ...(isTop ? { top: 0 } : { bottom: 0 }),
    ...(isLeft ? { left: 0 } : { right: 0 }),
    width: 20,
    height: 20,
    cursor,
    zIndex: 6,
    touchAction: 'none',
    '&::before': beforeSx,
    ...overrides
  };
}
