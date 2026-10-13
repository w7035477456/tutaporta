/**
 * LEFT_SIDE — Record Vault left panel: TutaDrive (default) | None.
 * Source: ~/.ssh/be/.env (mirrored in fe/vite.config.mjs).
 * Runtime override: GET /api/publicConfig.leftSide / .tutaDrive.
 */

export function parseLeftSideMode(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'none' || v === 'off' || v === '0' || v === 'false' || v === 'hide') return 'None';
  return 'TutaDrive';
}

/** @returns {'TutaDrive' | 'None'} */
export function getLeftSideModeFromVite() {
  return parseLeftSideMode(import.meta.env.LEFT_SIDE);
}

/** @returns {boolean} */
export function isLeftSideTutaDriveFromVite() {
  return getLeftSideModeFromVite() === 'TutaDrive';
}

/** @returns {boolean} */
export function isLeftSideOfferedFromVite() {
  return getLeftSideModeFromVite() !== 'None';
}
