/**
 * ~/.ssh/be/.env INCLUDE_USB_DMG_EXE — master switch for USB Bridge installer build/publish.
 * false | 0 | no | off → skip dmg/zip build, deploy publishusbzip, and hide installer downloads.
 * true (default when unset) → current behavior.
 */
export function isIncludeUsbDmgExeEnabled() {
  const raw = String(process.env.INCLUDE_USB_DMG_EXE ?? 'true').trim().toLowerCase();
  if (['false', '0', 'no', 'off'].includes(raw)) return false;
  return true;
}
