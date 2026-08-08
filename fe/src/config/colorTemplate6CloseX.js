/**
 * colorTemplate6CloseX — top-right close “X” (ColorTemplate6CloseX / CT5 / CT7 popup close).
 * Font: MAIN_FONT (.env). Background: --theme-error-color. Text + border: #000.
 * Size: MOBILE/DESKTOP_FONT_SIZE_BUTTON via buttonFontSizeResponsive.
 */
import { buttonFontSizeResponsive } from 'config/buttonFontEnv';
import { templateButtonMagnifySx } from 'config/hoverMagnifyEnv';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';

export const COLOR_TEMPLATE6_CLOSE_X_TEXT = '#000000';
export const COLOR_TEMPLATE6_CLOSE_X_BG = 'var(--theme-error-color)';
export const COLOR_TEMPLATE6_CLOSE_X_BORDER = '2px solid #000000';

export function colorTemplate6CloseXSx(overrides = {}) {
  return {
    fontFamily: MAIN_FONT_FAMILY,
    fontSize: buttonFontSizeResponsive,
    fontWeight: 800,
    lineHeight: 1,
    color: COLOR_TEMPLATE6_CLOSE_X_TEXT,
    WebkitTextFillColor: COLOR_TEMPLATE6_CLOSE_X_TEXT,
    border: COLOR_TEMPLATE6_CLOSE_X_BORDER,
    borderRadius: 0,
    bgcolor: COLOR_TEMPLATE6_CLOSE_X_BG,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxSizing: 'border-box',
    width: { xs: '1.75em', sm: '1.75em' },
    height: { xs: '1.75em', sm: '1.75em' },
    minWidth: { xs: '1.75em', sm: '1.75em' },
    minHeight: { xs: '1.75em', sm: '1.75em' },
    p: 0,
    m: 0,
    ...templateButtonMagnifySx({ baseFontSize: buttonFontSizeResponsive }),
    '@media (hover: hover)': {
      '&:hover': {
        bgcolor: COLOR_TEMPLATE6_CLOSE_X_BG,
        color: COLOR_TEMPLATE6_CLOSE_X_TEXT,
        WebkitTextFillColor: COLOR_TEMPLATE6_CLOSE_X_TEXT,
        border: COLOR_TEMPLATE6_CLOSE_X_BORDER,
        opacity: 0.92
      }
    },
    ...overrides
  };
}

export function colorTemplate6CloseXPositionSx(overrides = {}) {
  return {
    position: 'absolute',
    top: { xs: 8, sm: 10 },
    right: { xs: 8, sm: 10 },
    zIndex: 3,
    ...overrides
  };
}
