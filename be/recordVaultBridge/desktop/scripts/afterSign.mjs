/**
 * electron-builder afterSign hook — notarize Mac .app when Apple credentials are set.
 * Skips quietly when APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID are missing
 * (unsigned / local-only builds).
 */
export default async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appleId = String(process.env.APPLE_ID || '').trim();
  const appleIdPassword = String(process.env.APPLE_APP_SPECIFIC_PASSWORD || '').trim();
  const teamId = String(process.env.APPLE_TEAM_ID || '').trim();
  if (!appleId || !appleIdPassword || !teamId) {
    console.warn(
      '[afterSign] Skipping notarization (set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID).'
    );
    return;
  }

  const { notarize } = await import('@electron/notarize');
  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`;
  console.log('[afterSign] Notarizing', appPath);
  await notarize({
    appPath,
    appleId,
    appleIdPassword,
    teamId
  });
  console.log('[afterSign] Notarization complete');
}
