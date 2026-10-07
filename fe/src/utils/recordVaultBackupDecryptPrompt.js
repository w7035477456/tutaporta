import { themedPrompt } from 'utils/themedDialog';
import { fetchRecordVaultE2eKeys, unlockRecordVaultTutaDrive } from 'api/recordVaultFe';
import { unlockVaultWithPassword } from 'utils/recordVaultClientVaultCrypto';
import {
  isRecordVaultE2eUnlocked,
  setRecordVaultBackupDecryptPassword,
  setRecordVaultE2eSession
} from 'utils/recordVaultClientSession';

/**
 * Check the Encrypt Password against the vault key material and load the DEK into this tab.
 * Password stays in the browser. Throws "Wrong Encrypt Password" on mismatch.
 */
export async function verifyEncryptPasswordInTab(password) {
  const value = String(password || '').trim();
  if (!value) throw new Error('Enter your Encrypt Password');
  const e2e = await fetchRecordVaultE2eKeys();
  if (!e2e?.configured || !e2e?.vault?.kdfSaltB64 || !e2e?.vault?.wrappedDekB64) {
    throw new Error('Encrypt Password is not set up yet. Open TutaNotes Cloud first to create one.');
  }
  let unlocked;
  try {
    unlocked = await unlockVaultWithPassword(e2e.vault, value);
  } catch {
    throw new Error('Wrong Encrypt Password');
  }
  setRecordVaultE2eSession({ dek: unlocked.dek, dekRaw: unlocked.dekRaw, vault: e2e.vault });
  return true;
}

/**
 * After verifyEncryptPasswordInTab: hand the password to the next sealed-backup decrypt
 * (backups sealed on another server carry their own wrapped DEK) and, for merge, open the live vault.
 * @param {'merge'|'restore'|'open'} purpose
 */
export async function prepareBackupDecryptWithPassword(password, purpose = 'restore') {
  setRecordVaultBackupDecryptPassword(String(password || '').trim());
  if (purpose === 'merge') {
    await unlockRecordVaultTutaDrive();
  }
}

/**
 * Backup / Upload seal with the in-tab DEK. If this tab has not unlocked it yet
 * (e.g. after a page reload), ask for the Encrypt Password instead of failing.
 * @param {'backup'|'upload'} purpose
 * @returns {Promise<boolean>} true if unlocked; false if user cancelled
 */
export async function ensureEncryptPasswordForBackupSeal(purpose = 'backup') {
  if (isRecordVaultE2eUnlocked()) return true;
  const password = await themedPrompt(
    purpose === 'upload'
      ? 'Enter your Encrypt Password to encrypt this backup before upload.'
      : 'Enter your Encrypt Password to encrypt this backup.',
    '',
    {
      title: 'Encrypt Password',
      okLabel: purpose === 'upload' ? 'Upload' : 'Backup',
      cancelLabel: 'Cancel',
      inputType: 'password'
    }
  );
  if (password === null) return false;
  const value = String(password || '').trim();
  if (!value) {
    throw new Error('Encrypt Password is required to encrypt the backup');
  }

  const e2e = await fetchRecordVaultE2eKeys();
  if (!e2e?.configured || !e2e?.vault?.kdfSaltB64 || !e2e?.vault?.wrappedDekB64) {
    throw new Error('Encrypt Password is not set up yet. Open TutaNotes Cloud first to create one.');
  }

  let unlocked;
  try {
    unlocked = await unlockVaultWithPassword(e2e.vault, value);
  } catch {
    throw new Error('Wrong Encrypt Password — backup was not created');
  }
  setRecordVaultE2eSession({ dek: unlocked.dek, dekRaw: unlocked.dekRaw, vault: e2e.vault });
  return true;
}

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
  // Backups sealed on another server carry their own wrapped DEK — unwrapped with this password.
  setRecordVaultBackupDecryptPassword(value);

  // Merge writes into the live vault — open server session after password verify.
  if (purpose === 'merge') {
    await unlockRecordVaultTutaDrive();
  }
  return true;
}
