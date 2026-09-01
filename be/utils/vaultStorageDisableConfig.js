/**
 * ~/.ssh/be/.env DISABLE_ONEDRIVE / DISABLE_USBDRIVE — retire Microsoft OneDrive / USB bridge.
 * LEFT_SIDE=TutaDrive uses local LARGE_CHEAP_STORAGE_FOLDER (not Microsoft OneDrive).
 */

function envFlagTrue(raw) {
  return ['true', '1', 'yes', 'on'].includes(String(raw ?? '').trim().toLowerCase());
}

/** When true, block Microsoft OneDrive OAuth/Graph vault paths (TutaDrive local vault still allowed). */
export function isDisableOnedriveEnabled() {
  return envFlagTrue(process.env.DISABLE_ONEDRIVE);
}

/** When true, hide USB bridge panel and block USB vault routes. */
export function isDisableUsbDriveEnabled() {
  return envFlagTrue(process.env.DISABLE_USBDRIVE ?? process.env.DISBLE_USEDRIVE);
}
