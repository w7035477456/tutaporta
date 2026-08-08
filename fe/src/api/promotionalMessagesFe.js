import api from 'api/axios';

const CACHE_MS = 60_000;

/** @type {string[] | null} */
let cached = null;
/** @type {number} */
let cachedAt = 0;
/** @type {Promise<string[]> | null} */
let inFlight = null;

/** GET /api/promotionalMessages — global.promotional_array from Postgres */
export async function fetchPromotionalMessages({ force = false } = {}) {
  const now = Date.now();
  if (!force && cached && now - cachedAt < CACHE_MS) {
    return cached;
  }
  if (inFlight) return inFlight;

  inFlight = api
    .get('/api/promotionalMessages')
    .then((res) => {
      const list = Array.isArray(res.data?.promotionalArray) ? res.data.promotionalArray : [];
      cached = list.map((item) => String(item ?? '').trim()).filter(Boolean);
      cachedAt = Date.now();
      inFlight = null;
      return cached;
    })
    .catch((err) => {
      inFlight = null;
      throw err;
    });

  return inFlight;
}
