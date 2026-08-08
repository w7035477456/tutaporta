/**
 * /myPicks load: avoid duplicate list/feed/bell HTTP when SWR already fetches on mount.
 * Set VITE_MY_PICKS_LEGACY_REFRESH=true in fe/.env to restore the old double-fetch behavior.
 */
export function isMyPicksDedupeRefreshEnabled() {
  return String(import.meta.env.VITE_MY_PICKS_LEGACY_REFRESH ?? 'false').trim().toLowerCase() !== 'true';
}
