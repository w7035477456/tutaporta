/**
 * Backend API origin for axios and absolute image URLs.
 * - Prefer VITE_API_BASE_URL when set (e.g. production .env.production).
 * - Otherwise use API_PORT from fe/.env (exposed via Vite envPrefix API_).
 */
export function getApiBaseUrl() {
  const explicit = import.meta.env.VITE_API_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  // Mac Vite: always same-origin /api (proxy → API_PORT) so auth cookies are sent.
  // Do not rely on import.meta.env.DEV alone — sourcing ~/.ssh/be/.env sets
  // NODE_ENV=production in the shell, which flips DEV off / PROD on even for `vite`
  // (MODE stays "development"). Cross-origin calls to :40000 then look like "servers down".
  if (typeof window !== 'undefined' && (import.meta.env.DEV || import.meta.env.MODE === 'development')) {
    return window.location.origin;
  }
  const port = import.meta.env.API_PORT ?? '40000';
  return `http://localhost:${port}`;
}

/**
 * API origin for phone QR upload — always the host that served the page (not localhost / stale build URL).
 */
export function getSameOriginApiBaseUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return getApiBaseUrl().replace(/\/$/, '');
}
