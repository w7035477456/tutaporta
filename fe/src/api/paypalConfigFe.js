import { getApiBaseUrl } from 'config/apiBaseUrl';

let cachedConfig = null;
let inFlight = null;

export async function getPayPalCheckoutConfig() {
  if (cachedConfig) return cachedConfig;
  if (inFlight) return inFlight;

  inFlight = fetch(`${getApiBaseUrl()}/api/publicConfig`, { credentials: 'include' })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = await res.json();
      const paypalClientId = String(data?.paypalClientId || '').trim();
      const paypalEnv = String(data?.paypalEnv || '').trim().toLowerCase() === 'live' ? 'live' : 'sandbox';
      const paymentPricePerToken = Math.max(0, Number(data?.paymentPricePerToken) || 5);
      return {
        paypalClientId,
        paypalEnv,
        paymentPricePerToken
      };
    })
    .catch(() => null)
    .then((result) => {
      cachedConfig = result || { paypalClientId: '', paymentPricePerToken: 5 };
      inFlight = null;
      return cachedConfig;
    });

  return inFlight;
}
