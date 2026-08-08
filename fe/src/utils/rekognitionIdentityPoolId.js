/** Cognito identity pool id: region + UUID (e.g. us-east-1:dbdcac5b-ff58-42f2-9436-09d0315725f8). */
const IDENTITY_POOL_ID_PATTERN = /^[\w-]+:[0-9a-f-]+$/i;

const PLACEHOLDER_MARKERS = ['your-pool-id', 'xxxxxxxx', 'xxxx-xxxx'];

export function isValidRekognitionIdentityPoolId(value) {
  const id = String(value ?? '').trim();
  if (!id || !IDENTITY_POOL_ID_PATTERN.test(id)) return false;
  const lower = id.toLowerCase();
  return !PLACEHOLDER_MARKERS.some((marker) => lower.includes(marker));
}

/**
 * Prefer the pool id from the API (~/.ssh/be/.env). Ignore fe/.env placeholders.
 * @param {string|null|undefined} fromApi
 * @param {string|null|undefined} fromVite
 */
export function resolveRekognitionIdentityPoolId(fromApi, fromVite) {
  const api = String(fromApi ?? '').trim();
  const vite = String(fromVite ?? '').trim();
  if (isValidRekognitionIdentityPoolId(api)) return api;
  if (isValidRekognitionIdentityPoolId(vite)) return vite;
  return api || vite || '';
}
