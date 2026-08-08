/**
 * fe/.env — requires vite envPrefix FOOTERPAGES_ (see vite.config.mjs).
 * About Us / Terms & Conditions / Privacy Policy scroll column (not FOOTER_HEIGHT; that is the black site footer bar).
 */

function readPct(key, fallback) {
  const raw = String(import.meta.env[key] ?? '').trim();
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

/** About/Terms/Privacy top margin (% of viewport height). */
export function getLegalTopMarginVh() {
  return readPct('FOOTERPAGES_TOP_MARGIN', 1);
}

/** About/Terms/Privacy bottom margin (% of viewport height). */
export function getLegalBottomMarginVh() {
  return readPct('FOOTERPAGES_BOT_MARGIN', 1);
}

/** About/Terms/Privacy left+right margin (% of viewport width each side). */
export function getLegalRightLeftMarginVw() {
  return readPct('FOOTERPAGES_RIGHT_LEFT_MARGIN', 2);
}
