/**
 * ONENOTE_USB_DISABLE — when true, "Open TutaPhotoAlbums Cloud" and
 * "Open TutaPhotoAlbums USB" stay visible but are not clickable.
 * Source: fe/.env or ~/.ssh/be/.env (mirrored in vite.config.mjs).
 * Requires vite envPrefix ONENOTE_.
 */
function parseEnvBool(raw, defaultValue = false) {
  if (raw == null || String(raw).trim() === '') return defaultValue;
  const v = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return defaultValue;
}

/** @returns {boolean} */
export function isOnenoteUsbDisable() {
  return parseEnvBool(import.meta.env.ONENOTE_USB_DISABLE, false);
}
