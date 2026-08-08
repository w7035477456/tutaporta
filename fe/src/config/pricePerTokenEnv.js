/**
 * fe/.env PRICE_PER_TOKEN — dollars per token for Buy Tokens UI total calculation.
 * Mac dev: also merged from ~/.ssh/be/.env at Vite startup (see vite.config.mjs).
 * Runtime: prefer /api/publicConfig paymentPricePerToken (BE PRICE_PER_TOKEN).
 */
const DEFAULT_PRICE_PER_TOKEN = 1;

export function getPricePerTokenFromEnv() {
  const raw = String(import.meta.env.PRICE_PER_TOKEN ?? '').trim();
  if (!raw) return DEFAULT_PRICE_PER_TOKEN;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PRICE_PER_TOKEN;
  return parsed;
}
