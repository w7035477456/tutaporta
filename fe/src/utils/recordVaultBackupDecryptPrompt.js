import { themedPrompt } from 'utils/themedDialog';
import { fetchRecordVaultE2eKeys, unlockRecordVaultTutaDrive } from 'api/recordVaultFe';
import { unlockVaultWithPassword } from 'utils/recordVaultClientVaultCrypto';
import { setRecordVaultE2eSession } from 'utils/recordVaultClientSession';

/**
 * Prompt for Encrypt Password, unlock DEK in-tab (zero-knowledge), then allow
 * Backup sealed-zip Merge / Restore to decrypt.
 * For merge: also unlocks the live TutaDrive vault session on the server
 * (merge needs an open vault; client DEK alone is not enough).
 * @param {'merge'|'restore'|'open'} purpose
 * @returns {Promise<boolean>} true if unlocked; false if user cancelled
 */
export async function promptEncryptPasswordForBackupDecrypt(purpose = 'restore') {
  const action =
    purpose === 'merge' ? 'merge' : purpose === 'open' ? 'open' : 'restore';
  const password = await themedPrompt(
    purpose === 'open'
      ? 'Enter your Encrypt Password to decrypt this backup and list notebooks & notes.'
      : `Enter your Encrypt Password to decrypt this backup before ${action}.`,
    '',
    {
      title: 'Encrypt Password',
      okLabel: purpose === 'open' ? 'Open' : 'Decrypt',
      cancelLabel: 'Cancel',
      inputType: 'password'
    }
  );
  if (password === null) return false;
  const value = String(password || '').trim();
  if (!value) {
    throw new Error('Encrypt Password is required to decrypt the backup');
  }

  const e2e = await fetchRecordVaultE2eKeys();
  if (!e2e?.configured || !e2e?.vault?.kdfSaltB64 || !e2e?.vault?.wrappedDekB64) {
    throw new Error('Encrypt Password is not set up yet. Open TutaNotes Cloud first to create one.');
  }

  const { dek, dekRaw } = await unlockVaultWithPassword(e2e.vault, value);
  setRecordVaultE2eSession({ dek, dekRaw, vault: e2e.vault });

  // Merge writes into the live vault — open server session after password verify.
  if (purpose === 'merge') {
    await unlockRecordVaultTutaDrive();
  }
  return true;
}
