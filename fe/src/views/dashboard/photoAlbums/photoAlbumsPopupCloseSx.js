import {
  COLOR_TEMPLATE7_POPUP_CLOSE_ACTIVE_SCALE,
  COLOR_TEMPLATE7_POPUP_CLOSE_HOVER_SCALE
} from 'config/colorTemplate7PopupLargeDark';

/** Photo Albums popups — top-right close X: red bg, black X, black border. */
const photoAlbumsCloseRedBg = {
  bgcolor: 'var(--theme-error-color) !important',
  backgroundColor: 'var(--theme-error-color) !important',
  backgroundImage: 'none !important',
  border: '2px solid #000 !important',
  color: '#000 !important',
  WebkitTextFillColor: '#000 !important'
};

export const photoAlbumsPopupCloseSx = {
  ...photoAlbumsCloseRedBg,
  '&&&': photoAlbumsCloseRedBg,
  'html[data-color-palete="minimal"] &&&:not(.Mui-disabled)': photoAlbumsCloseRedBg,
  '@media (hover: hover)': {
    '&:hover:not(.Mui-disabled)': {
      ...photoAlbumsCloseRedBg,
      filter: 'brightness(0.92)',
      transform: `scale(${COLOR_TEMPLATE7_POPUP_CLOSE_HOVER_SCALE})`
    }
  },
  '&:active:not(.Mui-disabled)': {
    ...photoAlbumsCloseRedBg,
    filter: 'brightness(0.85)',
    transform: `scale(${COLOR_TEMPLATE7_POPUP_CLOSE_ACTIVE_SCALE})`
  }
};
