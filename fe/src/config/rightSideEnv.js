/**
 * RIGHT_SIDE — Record Vault right panel: USB | None.
 * Source: ~/.ssh/be/.env (mirrored in fe/vite.config.mjs).
 * Runtime override: GET /api/publicConfig.rightSide / storage config localUsb.visible.
 * When unset at build time, default to USB so dual-pane matches typical Mac/prod layout;
 * runtime BE still authoritative via NOTES_LOCAL_USB / RIGHT_SIDE.
 */

export function parseRightSideMode(raw, { unsetDefault = 'USB' } = {}) {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'none' || v === 'off' || v === '0' || v === 'false' || v === 'hide') return 'None';
  if (v === 'usb') return 'USB';
  if (!v) return unsetDefault === 'None' ? 'None' : 'USB';
  return 'USB';
}

/** @returns {'USB' | 'None'} */
export function getRightSideModeFromVite() {
  return parseRightSideMode(import.meta.env.RIGHT_SIDE);
}

/** @returns {boolean} */
export function isRightSideUsbFromVite() {
  return getRightSideModeFromVite() === 'USB';
}
