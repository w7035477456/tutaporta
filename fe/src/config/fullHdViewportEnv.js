import { getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTextFontSizeVw } from 'config/singlesMemberCardFontEnv';

function readPx(value, fallback) {
  const n = Number(String(value ?? '').trim());
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

export const RECOMMENDED_VIEWPORT_WIDTH_PX = readPx(
  import.meta.env.VITE_RECOMMENDED_VIEWPORT_WIDTH ?? import.meta.env.RECOMMENDED_VIEWPORT_WIDTH,
  1920
);

export const RECOMMENDED_VIEWPORT_HEIGHT_PX = readPx(
  import.meta.env.VITE_RECOMMENDED_VIEWPORT_HEIGHT ?? import.meta.env.RECOMMENDED_VIEWPORT_HEIGHT,
  1080
);

export function isFullHdAdjustEnabled() {
  const raw = String(import.meta.env.VITE_SHOW_FULL_HD_ADJUST ?? 'true').trim().toLowerCase();
  return !['0', 'false', 'no', 'off', 'n'].includes(raw);
}

export function fullHdAdjustMessageFontSx(overrides = {}) {
  return {
    fontSize: { xs: getMobileSinglesTextFontSizeVw(), sm: getDesktopTextFontSizeVw() },
    lineHeight: 1.45,
    color: '#000000',
    ...overrides
  };
}
