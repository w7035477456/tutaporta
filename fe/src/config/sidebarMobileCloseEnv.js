/**
 * Mobile sidebar viewport (width + height):
 * - Drawer expands to full viewport width (100vw); main column edge-to-edge (no side gutters)
 * - After a menu selection, auto-close (same as « Close Menu)
 * Desktop: partial label-based width; menu stays open after selection.
 *
 * Portrait phones + landscape phones (short viewport):
 *   (max-width: 600px), ((max-width: 926px) and (max-height: 540px))
 */

export const SIDEBAR_MOBILE_CLOSE_MEDIA =
  '(max-width: 600px), ((max-width: 926px) and (max-height: 540px))';

export function sidebarMobileCloseMatches() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return Boolean(window.matchMedia(SIDEBAR_MOBILE_CLOSE_MEDIA).matches);
}
