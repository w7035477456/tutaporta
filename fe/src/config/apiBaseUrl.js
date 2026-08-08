/**
 * Backend API origin for axios and absolute image URLs.
 * - Prefer VITE_API_BASE_URL when set (e.g. production .env.production).
 * - Otherwise use API_PORT from fe/.env (exposed via Vite envPrefix API_).
 */
export function getApiBaseUrl() {
  const explicit = import.meta.env.VITE_API_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  // Dev: same-origin /api via Vite proxy so auth cookies are always sent.
  if (import.meta.env.DEV && typeof window !== 'undefined') {
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
