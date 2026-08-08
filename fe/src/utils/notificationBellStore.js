/** One-shot bell refresh (no polling). Fired from Refresh Posts / Refresh Chat on member pages. */

export const BELL_NOTIFICATION_REFRESH_EVENT = 'bell-notification-refresh';

/** @param {'posts' | 'chat' | 'balance' | 'bio' | 'all'} scope */
export function dispatchBellNotificationRefresh(scope = 'all') {
  if (typeof window === 'undefined') return;
  const s =
    scope === 'posts' || scope === 'chat' || scope === 'balance' || scope === 'bio' || scope === 'all' ? scope : 'all';
  window.dispatchEvent(new CustomEvent(BELL_NOTIFICATION_REFRESH_EVENT, { detail: { scope: s } }));
}
