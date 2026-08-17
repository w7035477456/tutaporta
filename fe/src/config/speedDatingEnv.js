/**
 * SPEEDDATING — when true, show the Speed Dating sidebar item.
 * Source: ~/.ssh/be/.env (mirrored in fe/vite.config.mjs).
 * Requires vite envPrefix SPEEDDATING.
 */

function parseEnvBool(raw, defaultValue = false) {
  if (raw == null || String(raw).trim() === '') return defaultValue;
  const v = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return defaultValue;
}

/** @returns {boolean} */
export function isSpeedDatingEnabled() {
  return parseEnvBool(import.meta.env.SPEEDDATING, false);
}
