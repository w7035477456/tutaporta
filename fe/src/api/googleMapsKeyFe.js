import { getApiBaseUrl } from 'config/apiBaseUrl';

let cachedKey = null;
let inFlight = null;

export async function getGoogleMapsApiKey() {
  if (cachedKey) return cachedKey;
  if (inFlight) return inFlight;

  const envKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  if (envKey) {
    cachedKey = envKey;
    return cachedKey;
  }

  inFlight = fetch(`${getApiBaseUrl()}/api/publicConfig`, { credentials: 'include' })
    .then(async (res) => {
      if (!res.ok) return '';
      const data = await res.json();
      return String(data?.googleMapsApiKey || '').trim();
    })
    .catch(() => '')
    .then((key) => {
      cachedKey = key;
      inFlight = null;
      return key;
    });

  return inFlight;
}
