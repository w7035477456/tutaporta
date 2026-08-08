/**
 * fe/.env BSIZE — numeric N becomes Nvw (popup input height, admin banner font, etc.).
 * MOBILE_FONT_SIZE_BUTTON on xs where a separate mobile scale is needed.
 */

export function readBsizeVwNumber(value, fallback) {
  const parsed = Number(String(value ?? '').trim());
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, 25);
}

/** Desktop sm+ — fe/.env BSIZE (falls back to DESKTOP_FONT_SIZE_BUTTON). */
export function getBsizeFontSizeVw() {
  return `${readBsizeVwNumber(import.meta.env.BSIZE ?? import.meta.env.DESKTOP_FONT_SIZE_BUTTON, 2)}vw`;
}

/** Responsive font size — xs MOBILE_FONT_SIZE_BUTTON, sm+ BSIZE. */
export const bsizeFontSizeResponsive = {
  xs: `${readBsizeVwNumber(import.meta.env.MOBILE_FONT_SIZE_BUTTON, 6)}vw`,
  sm: getBsizeFontSizeVw()
};

/** ColorTemplate7 popup TextField root height — same vw scale as bsizeFontSizeResponsive. */
export const bsizeInputHeightResponsive = bsizeFontSizeResponsive;
