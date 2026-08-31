/** Cycle order matches helloworldjunktest.singles_status enum sort order. */
export const SINGLES_STATUS_VALUES = Object.freeze([
  'active',
  'cancel',
  'suspend',
  'pause',
  'abandon',
  'unknown',
  'other',
  'blank',
  'inactive',
  'under18'
]);

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeSinglesStatus(raw) {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (value === 'cencel') return 'cancel';
  if (value === 'under_18' || value === 'under-18') return 'under18';
  return SINGLES_STATUS_VALUES.includes(value) ? value : null;
}

/**
 * @param {unknown} current
 * @returns {string}
 */
export function nextSinglesStatus(current) {
  const normalized = normalizeSinglesStatus(current) ?? 'blank';
  const index = SINGLES_STATUS_VALUES.indexOf(normalized);
  const nextIndex = index < 0 ? 0 : (index + 1) % SINGLES_STATUS_VALUES.length;
  return SINGLES_STATUS_VALUES[nextIndex];
}

export function formatSinglesStatusLabel(raw) {
  const normalized = normalizeSinglesStatus(raw) ?? 'blank';
  if (normalized === 'blank') return 'Blank';
  if (normalized === 'under18') return 'Under 18';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
