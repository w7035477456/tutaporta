/**
 * TutaPhotoAlbums storage panels — TutaCloud (server folders) + Postgres only.
 */

import { getLeftSideMode } from './tutaDriveMemberPaths.js';

/** Left-panel TutaCloud workspace (TutaDrive when LEFT_SIDE=TutaDrive). */
export function isVaultTutaCloudOffered() {
  return getLeftSideMode() !== 'None';
}

export function isVaultLocalUsbOffered() {
  return false;
}

export function isVaultBackupUsbEnabled() {
  return false;
}

/** Microsoft Graph sync removed — vault cloud workspace is local TutaDrive only. */
export function isVaultCloudSyncEnabled() {
  return false;
}

export function buildVaultStorageChoice(visible, oauthConfigured = true) {
  const offered = Boolean(visible);
  const oauthReady = Boolean(oauthConfigured);
  return {
    visible: offered,
    oauthConfigured: oauthReady,
    enabled: offered && oauthReady
  };
}
