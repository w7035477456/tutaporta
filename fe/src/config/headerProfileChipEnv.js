/** Header profile chip — avatar + settings gear share this size (fe/.env THEME_ICON_SIZE in rem). */
function readThemeIconSizeRem() {
  const parsed = Number(String(import.meta.env.THEME_ICON_SIZE ?? '').trim());
  const n = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 20) : 6;
  return `${n}rem`;
}

export const HEADER_PROFILE_AVATAR_SIZE = readThemeIconSizeRem();

export const HEADER_PROFILE_CHIP_PADDING_PX = 8;

export function headerProfileChipHeightCss() {
  return `calc(${HEADER_PROFILE_AVATAR_SIZE} + ${HEADER_PROFILE_CHIP_PADDING_PX}px)`;
}

/** Min fixed header toolbar height so the profile chip fits (toolbar vertical padding ≈ 32px). */
export function headerBarMinHeightCss() {
  return `max(88px, calc(${HEADER_PROFILE_AVATAR_SIZE} + 32px))`;
}
