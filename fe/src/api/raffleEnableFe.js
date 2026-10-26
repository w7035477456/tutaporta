import { useEffect, useState } from 'react';
import { getApiBaseUrl } from 'config/apiBaseUrl';

let cached = null;
let inFlight = null;

/**
 * Raffle UI gate (Get My Raffle Ticket button, /mall raffle bar + panel).
 * Runtime: GET /api/publicConfig.raffleEnable (~/.ssh/be/.env RAFFLE_ENABLE). Shown only when true.
 */
export async function fetchRaffleEnabled() {
  if (cached != null) return cached;
  if (inFlight) return inFlight;

  inFlight = fetch(`${getApiBaseUrl()}/api/publicConfig`, { credentials: 'include' })
    .then(async (res) => {
      if (!res.ok) return false;
      const data = await res.json();
      return data?.raffleEnable === true;
    })
    .catch(() => false)
    .then((enabled) => {
      cached = enabled;
      inFlight = null;
      return enabled;
    });

  return inFlight;
}

/** false until /api/publicConfig answers, so raffle UI never flashes when disabled. */
export function useRaffleEnabled() {
  const [enabled, setEnabled] = useState(() => cached === true);
  useEffect(() => {
    let alive = true;
    void fetchRaffleEnabled().then((value) => {
      if (alive) setEnabled(value);
    });
    return () => {
      alive = false;
    };
  }, []);
  return enabled;
}
