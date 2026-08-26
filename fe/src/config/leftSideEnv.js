/**
 * LEFT_SIDE — Record Vault left panel: OneDrive (default) | TutaDrive | None.
 * Source: ~/.ssh/be/.env (mirrored in fe/vite.config.mjs).
 * Runtime override: GET /api/publicConfig.leftSide / .tutaDrive.
 */

export function parseLeftSideMode(raw) {
  const v = String(raw ?? 'OneDrive').trim().toLowerCase();
  if (v === 'none' || v === 'off' || v === '0' || v === 'false' || v === 'hide') return 'None';
  if (v === 'tutadrive' || v === 'tuta_drive' || v === 'tuta-drive') return 'TutaDrive';
  return 'OneDrive';
}

/** @returns {'OneDrive' | 'TutaDrive' | 'None'} */
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
