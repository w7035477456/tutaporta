/**
 * Before leaving TutaNotes (Exit to Mall / Logout from the pane, sidebar or header menu):
 * the mounted TutaNotes pane offers Backup & Restore when notes changed since the last backup.
 * Workspace pane registers while mounted.
 */

let exitBackupPrompt = null;

/**
 * @param {() => Promise<void>} prompt resolves once the member is done with Backup & Restore
 * @returns {() => void} unregister
 */
export function registerRecordVaultExitBackupPrompt(prompt) {
  exitBackupPrompt = typeof prompt === 'function' ? prompt : null;
  return () => {
    if (exitBackupPrompt === prompt) exitBackupPrompt = null;
  };
}

/** Never blocks the exit: errors just skip the prompt. */
export async function offerRecordVaultBackupBeforeExit() {
  if (typeof exitBackupPrompt !== 'function') return;
  try {
    await exitBackupPrompt();
  } catch (err) {
    console.warn('[offerRecordVaultBackupBeforeExit]', err?.message || err);
  }
}
