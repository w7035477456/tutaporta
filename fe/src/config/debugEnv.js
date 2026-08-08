/**
 * fe/.env — requires vite envPrefix DEBUG_ (see vite.config.mjs).
 */

function envIsTrue(key) {
  const v = import.meta.env[key];
  return String(v ?? '').trim().toLowerCase() === 'true';
}

/** Green / purple debug outlines on MainCard and AuthInnerStack when true. */
export function getDebugDottedBorders() {
  return envIsTrue('DEBUG_DOTTED_BORDERS');
}
