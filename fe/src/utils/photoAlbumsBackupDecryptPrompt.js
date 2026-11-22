import { themedPrompt } from 'utils/themedDialog';
import { fetchPhotoAlbumsE2eKeys, unlockPhotoAlbumsTutaDrive } from 'api/photoAlbumsFe';
import { unlockVaultWithPassword } from 'utils/photoAlbumsClientVaultCrypto';
import {
  isPhotoAlbumsE2eUnlocked,
  setPhotoAlbumsBackupDecryptPassword,
  setPhotoAlbumsE2eSession
} from 'utils/photoAlbumsClientSession';

/**
 * Check the Encrypt Password against the vault key material and load the DEK into this tab.
 * Password stays in the browser. Throws "Wrong Encrypt Password" on mismatch.
 */
export async function verifyEncryptPasswordInTab(password) {
  const value = String(password || '').trim();
  if (!value) throw new Error('Enter your Encrypt Password');
  const e2e = await fetchPhotoAlbumsE2eKeys();
  if (!e2e?.configured || !e2e?.vault?.kdfSaltB64 || !e2e?.vault?.wrappedDekB64) {
    throw new Error('Encrypt Password is not set up yet. Open TutaPhotos Cloud first to create one.');
  }
  let unlocked;
  try {
    unlocked = await unlockVaultWithPassword(e2e.vault, value);
  } catch {
    throw new Error('Wrong Encrypt Password');
  }
  setPhotoAlbumsE2eSession({ dek: unlocked.dek, dekRaw: unlocked.dekRaw, vault: e2e.vault });
  return true;
}

/**
 * After verifyEncryptPasswordInTab: hand the password to the next sealed-backup decrypt.
 * @param {'merge'|'restore'|'open'} purpose
 */
export async function prepareBackupDecryptWithPassword(password, purpose = 'restore') {
  setPhotoAlbumsBackupDecryptPassword(String(password || '').trim());
  if (purpose === 'merge') {
    await unlockPhotoAlbumsTutaDrive();
  }
}

/**
 * Backup seal with the in-tab DEK. If this tab has not unlocked it yet
 * (e.g. after a page reload), ask for the Encrypt Password instead of failing.
 * @param {'backup'|'upload'} purpose
 * @returns {Promise<boolean>} true if unlocked; false if user cancelled
 */
export async function ensureEncryptPasswordForBackupSeal(purpose = 'backup') {
  if (isPhotoAlbumsE2eUnlocked()) return true;
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

  const e2e = await fetchPhotoAlbumsE2eKeys();
  if (!e2e?.configured || !e2e?.vault?.kdfSaltB64 || !e2e?.vault?.wrappedDekB64) {
    throw new Error('Encrypt Password is not set up yet. Open TutaPhotos Cloud first to create one.');
  }

  let unlocked;
  try {
    unlocked = await unlockVaultWithPassword(e2e.vault, value);
  } catch {
    throw new Error('Wrong Encrypt Password — backup was not created');
  }
  setPhotoAlbumsE2eSession({ dek: unlocked.dek, dekRaw: unlocked.dekRaw, vault: e2e.vault });
  return true;
}
