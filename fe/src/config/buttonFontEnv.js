/**
 * fe/.env MOBILE_FONT_SIZE_BUTTON / DESKTOP_FONT_SIZE_BUTTON — all button label text (MUI + custom).
 * Use `buttonFontSizeResponsive` in sx; MuiButton/MuiFab pick this up via themes/overrides/Button.jsx.
 */
import { getDesktopButtonFontSizeHalfVw, getDesktopButtonFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesButtonFontSizeVw } from 'config/singlesMemberCardFontEnv';

function readVwNumber(value, fallback) {
  const parsed = Number(String(value ?? '').trim());
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, 25);
}

/** @type {{ xs: string, sm: string }} */
export const buttonFontSizeResponsive = {
  xs: getMobileSinglesButtonFontSizeVw(),
  sm: getDesktopButtonFontSizeVw()
};

/** Half of MOBILE_FONT_SIZE_BUTTON / DESKTOP_FONT_SIZE_BUTTON (footer Support, etc.). */
export const buttonFontSizeHalfResponsive = {
  xs: `${readVwNumber(import.meta.env.MOBILE_FONT_SIZE_BUTTON, 6) / 2}vw`,
  sm: getDesktopButtonFontSizeHalfVw()
};

/** Beat MUI theme + parent cascades — MOBILE_/DESKTOP_FONT_SIZE_BUTTON (Selected/UnSelected templates). */
export function buttonTemplateFontSizeSx(overrides = {}) {
  const full = buttonFontSizeResponsive;
  const fullFontSx = {
    fontSize: `${full.xs} !important`,
    '@media (min-width: 600px)': {
      fontSize: `${full.sm} !important`
    }
  };
  return {
    ...fullFontSx,
    '&.MuiButton-root': { ...fullFontSx },
    '&.MuiButton-sizeSmall': { ...fullFontSx },
    '& .MuiButton-label': { ...fullFontSx },
    ...overrides
  };
}

/** Beat Selected/UnSelected template + MuiButton theme — half MOBILE_/DESKTOP_FONT_SIZE_BUTTON. */
export function buttonTemplateHalfFontSizeSx(overrides = {}) {
  const half = buttonFontSizeHalfResponsive;
  const halfFontSx = {
    fontSize: `${half.xs} !important`,
    '@media (min-width: 600px)': {
      fontSize: `${half.sm} !important`
    }
  };
  return {
    ...halfFontSx,
    '&.MuiButton-root': { ...halfFontSx },
    '&.MuiButton-sizeSmall': { ...halfFontSx },
    '& .MuiButton-label': { ...halfFontSx },
    ...overrides
  };
}
