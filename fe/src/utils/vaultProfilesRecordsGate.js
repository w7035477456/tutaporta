/**
 * Open embedded Profile & Records (no dating sidebar) from the header menu
 * or Earn Tokens flow while on TutaPhotoAlbums / TutaNotes.
 * Workspace pages register while mounted.
 */

let openProfilesRecords = null;

/**
 * @param {(options?: { openTab?: string, earnTokensApp?: string }) => void} opener
 * @returns {() => void} unregister
 */
export function registerVaultProfilesRecordsOpener(opener) {
  openProfilesRecords = typeof opener === 'function' ? opener : null;
  return () => {
    if (openProfilesRecords === opener) openProfilesRecords = null;
  };
}

/**
 * @param {{ openTab?: string, earnTokensApp?: string }} [options]
 * @returns {boolean} true if an opener handled the request
 */
export function requestOpenVaultProfilesRecords(options = {}) {
  if (typeof openProfilesRecords !== 'function') return false;
  try {
    openProfilesRecords(options);
    return true;
  } catch {
    return false;
  }
}
