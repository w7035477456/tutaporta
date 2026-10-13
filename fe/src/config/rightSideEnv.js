/**
 * RIGHT_SIDE — legacy Record Vault right panel (USB bridge retired).
 * Storage is TutaCloud-only; always None.
 */

export function parseRightSideMode(_raw, { unsetDefault = 'None' } = {}) {
  void unsetDefault;
  return 'None';
}

/** @returns {'USB' | 'None'} */
export function getRightSideModeFromVite() {
  return parseRightSideMode(import.meta.env.RIGHT_SIDE);
}

/** @returns {boolean} */
export function isRightSideUsbFromVite() {
  return false;
}
