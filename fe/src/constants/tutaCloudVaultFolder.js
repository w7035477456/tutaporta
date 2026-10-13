/** Default TutaCloud vault folder label before status/config loads. */
export const TUTACLOUD_VAULT_FOLDER_DEFAULT = 'TutaCloud';

/** Legacy Microsoft OneDrive / early TutaCloud folder names (recognition & migration only). */
export const LEGACY_CLOUD_VAULT_FOLDER_NAMES = [
  'onlinemallwebsitevault',
  'OMNotes',
  '.recordvault'
];

/** Suggested download name when the server does not return a file name. */
export const TUTACLOUD_VAULT_BACKUP_ZIP_DEFAULT = 'tutacloud-vault-backup.zip';

export function tutaCloudVaultBackupZipFileName(folderLabel = TUTACLOUD_VAULT_FOLDER_DEFAULT) {
  const base = String(folderLabel || TUTACLOUD_VAULT_FOLDER_DEFAULT)
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base ? `${base}-backup.zip` : TUTACLOUD_VAULT_BACKUP_ZIP_DEFAULT;
}
