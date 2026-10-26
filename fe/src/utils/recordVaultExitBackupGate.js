/**
 * Before leaving TutaNotes (Exit to Mall / Logout from the pane, sidebar or header menu):
 * the mounted TutaNotes pane offers Backup & Restore when notes changed since the last backup.
 * Workspace pane registers while mounted.
 */

let exitBackupPrompt = null;

/**
 * @param {() => Promise<boolean | void>} prompt resolves once the member is done with Backup & Restore;
 *   resolves `false` when they closed it without backing up (the exit is cancelled)
 * @returns {() => void} unregister
 */
export function registerRecordVaultExitBackupPrompt(prompt) {
  exitBackupPrompt = typeof prompt === 'function' ? prompt : null;
  return () => {
    if (exitBackupPrompt === prompt) exitBackupPrompt = null;
  };
}

/**
 * @returns {Promise<boolean>} false only when the member closed Backup & Restore without backing up;
 *   errors never block the exit.
 */
export async function offerRecordVaultBackupBeforeExit() {
  if (typeof exitBackupPrompt !== 'function') return true;
  try {
    return (await exitBackupPrompt()) !== false;
  } catch (err) {
    console.warn('[offerRecordVaultBackupBeforeExit]', err?.message || err);
    return true;
  }
}
