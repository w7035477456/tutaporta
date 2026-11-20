/**
 * TutaDrive backup zip name preview — keep in sync with be/utils/tutaDriveBackupNames.js.
 * Encrypted: EncryptedTutaNotesZip_YYYY_MM_DD[_<note>].zip
 * Plaintext (TUTANOTES_ENCRYPT_ALLOWED=false): TutaNotesZip_YYYY_MM_DD[_<note>].zip
 * (server adds _2, _3 … if that name already exists).
 */

export const TUTADRIVE_BACKUP_FILE_PREFIX = 'EncryptedTutaNotesZip';
export const TUTADRIVE_BACKUP_FILE_PREFIX_PLAIN = 'TutaNotesZip';
export const TUTADRIVE_BACKUP_NOTE_MAX_LEN = 19;
export const TUTADRIVE_BACKUP_HINT_MAX_LEN = 100;

export function tutaDriveBackupNoteSlug(note) {
  return String(note || '')
    .trim()
    .slice(0, TUTADRIVE_BACKUP_NOTE_MAX_LEN)
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_-]/g, '');
}

export function tutaDriveBackupDateStamp(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}_${m}_${d}`;
}

/** @param {boolean} [encrypted=true] — false when TUTANOTES_ENCRYPT_ALLOWED=false (plaintext zip). */
export function tutaDriveBackupFileNamePreview(
  note,
  dateStamp = tutaDriveBackupDateStamp(),
  encrypted = true
) {
  const slug = tutaDriveBackupNoteSlug(note);
  const prefix = encrypted ? TUTADRIVE_BACKUP_FILE_PREFIX : TUTADRIVE_BACKUP_FILE_PREFIX_PLAIN;
  return `${prefix}_${dateStamp}${slug ? `_${slug}` : ''}.zip`;
}
