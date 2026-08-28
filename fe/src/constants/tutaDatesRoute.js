/** Canonical Tuta Dates splash / dating entry URL (mall tile). */
export const TUTADATES_PATH = '/tutadates';

export const TUTADATES_MY_STORE_PATH = `${TUTADATES_PATH}/myStore`;

/** Legacy URL — kept for redirects and route checks. */
export const TUTADATES_LEGACY_PATH = '/vsingles';

/** @param {string} pathname */
export function isTutaDatesPath(pathname) {
  const p = String(pathname ?? '');
  return (
    p === TUTADATES_PATH ||
    p.startsWith(`${TUTADATES_PATH}/`) ||
    p === TUTADATES_LEGACY_PATH ||
    p.startsWith(`${TUTADATES_LEGACY_PATH}/`)
  );
}

/** @param {string} pathname */
export function isTutaDatesLandingPath(pathname) {
  return pathname === TUTADATES_PATH || pathname === TUTADATES_LEGACY_PATH;
}
