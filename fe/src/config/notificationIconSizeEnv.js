/** Notification bell + count badge (fe/.env NOTIFICATION_ICON_SIZE in rem). */

function readNotificationIconSizeRemNumber() {
  const parsed = Number(String(import.meta.env.NOTIFICATION_ICON_SIZE ?? '').trim());
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 20) : 6;
}

const NOTIFICATION_ICON_REM = readNotificationIconSizeRemNumber();

/** Red/yellow bell square */
export const NOTIFICATION_BELL_SIZE = `${NOTIFICATION_ICON_REM}rem`;

/** Bell glyph inside the square (~59% of box; matches prior 20px / 34px header ratio). */
export const NOTIFICATION_BELL_ICON_SIZE = `${NOTIFICATION_ICON_REM * 0.59}rem`;

/** Count badge circle diameter (~53% of box). */
export const NOTIFICATION_BADGE_SIZE = `${NOTIFICATION_ICON_REM * 0.53}rem`;

/** Count numeral inside badge. */
export const NOTIFICATION_BADGE_FONT_SIZE = `${NOTIFICATION_ICON_REM * 0.24}rem`;

export function notificationBellHoverSizeCss(hoverFactor) {
  const factor = Number(hoverFactor);
  const safe = Number.isFinite(factor) && factor > 0 ? factor : 1;
  return `calc(${NOTIFICATION_BELL_SIZE} * ${safe})`;
}
