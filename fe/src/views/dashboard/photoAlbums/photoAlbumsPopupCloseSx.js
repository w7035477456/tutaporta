import {
  COLOR_TEMPLATE7_POPUP_CLOSE_ACTIVE_SCALE,
  COLOR_TEMPLATE7_POPUP_CLOSE_HOVER_SCALE
} from 'config/colorTemplate7PopupLargeDark';

/** Photo Albums popups — top-right close X: red bg, black X, black border. */
export const photoAlbumsPopupCloseSx = {
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
  }
};
