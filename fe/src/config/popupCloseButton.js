/**
 * Popup content inset when a top-right close control is shown.
 * Close styling: ui-component/ColorTemplate5CloseX (config/colorTemplate5CloseX.js).
 */
export { colorTemplate5CloseXPositionSx as popupCloseIconButtonPositionSx } from 'config/colorTemplate5CloseX';

/** @deprecated Legacy MUI CloseIcon size; prefer ColorTemplate5CloseX. */
export const POPUP_CLOSE_ICON_FONT_SIZE = '4.5rem';
/** @deprecated Legacy Tabler close size; prefer ColorTemplate5CloseX. */
export const POPUP_CLOSE_TABLER_ICON_SIZE = 72;
/** @deprecated Legacy text close size; prefer ColorTemplate5CloseX. */
export const POPUP_CLOSE_TEXT_FONT_SIZE = { xs: '5.25rem', sm: '6rem' };

/** @deprecated Prefer ColorTemplate5CloseX. */
export function popupCloseIconSx(overrides = {}) {
  return {
    fontSize: POPUP_CLOSE_ICON_FONT_SIZE,
    ...overrides
  };
}

/** @deprecated Prefer ColorTemplate5CloseX. */
export function popupCloseIconButtonSx(overrides = {}) {
  return {
    ...overrides
  };
}

export function popupCloseContentPaddingSx(showCloseButton = true) {
  if (!showCloseButton) {
    return {
      pt: 2.2,
      pr: { xs: 2, sm: 3 }
    };
  }
  return {
    pt: { xs: 3, sm: 3.5 },
    pr: { xs: 5, sm: 5.5 }
  };
}
