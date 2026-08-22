import { getApiBaseUrl } from 'config/apiBaseUrl';
import { isOnenoteUsbUpgrade } from 'config/onenoteUsbUpgradeEnv';

let cached = null;
let inFlight = null;

/**
 * Mall gate for Tuta Albums / Tuta Notes.
 * Runtime: GET /api/publicConfig.onenoteUsbUpgrade (~/.ssh/be/.env ONENOTE_USB_UPGRADE).
 * Fallback: Vite bundle (fe/.env / build-time mirror).
 */
export async function fetchOnenoteUsbUpgradeBlocked() {
  if (cached != null) return cached;
  if (inFlight) return inFlight;

  inFlight = fetch(`${getApiBaseUrl()}/api/publicConfig`, { credentials: 'include' })
    .then(async (res) => {
      if (!res.ok) return isOnenoteUsbUpgrade();
      const data = await res.json();
      if (typeof data?.onenoteUsbUpgrade === 'boolean') return data.onenoteUsbUpgrade;
      return isOnenoteUsbUpgrade();
    })
    .catch(() => isOnenoteUsbUpgrade())
    .then((blocked) => {
      cached = blocked;
      inFlight = null;
      return blocked;
    });

  return inFlight;
}
