/**
 * TutaDrive sealed-backup file names (users/M{id}/…).
 *
 * Current:  EncryptedTutaNotesZip_YYYY_MM_DD[_<note>][_N].zip
 * Legacy:   EncryptedBackup_YYYY-MM-DD[_HH-MM-SS].zip, backup_YYYY-MM-DD[_HH-MM-SS].zip
 *
 * Name characters are limited to [A-Za-z0-9_-] so a name can never contain a path separator or "..".
 * Keep in sync with fe/src/utils/recordVaultBackupFileName.js.
 */

export const TUTADRIVE_BACKUP_FILE_PREFIX = 'EncryptedTutaNotesZip';

/** Note typed in the Backup popup — fewer than 20 characters (it is appended to the zip name). */
export const TUTADRIVE_BACKUP_NOTE_MAX_LEN = 19;
export const TUTADRIVE_BACKUP_HINT_MAX_LEN = 100;

export const TUTADRIVE_BACKUP_NAME_RE =
  /^(?:EncryptedTutaNotesZip_\d{4}_\d{2}_\d{2}(?:_[A-Za-z0-9_-]{1,40})?|(?:EncryptedBackup|backup)_\d{4}-\d{2}-\d{2}(?:_\d{2}-\d{2}-\d{2})?)\.zip$/i;

const DATE_STAMP_RE = /^(\d{4})_(\d{2})_(\d{2})$/;

export function isTutaDriveBackupFileName(name) {
  return TUTADRIVE_BACKUP_NAME_RE.test(String(name || ''));
}

/** Note text → file-name-safe slug (spaces → _, other symbols dropped). */
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

/**
 * Accept the browser's local date (so the zip name matches the popup preview) when it is
 * a real date within two days of the server clock; otherwise use the server date.
 */
export function resolveTutaDriveBackupDateStamp(requested, now = new Date()) {
  const match = DATE_STAMP_RE.exec(String(requested || '').trim());
  if (!match) return tutaDriveBackupDateStamp(now);
  const [, y, m, d] = match;
  const asDate = new Date(Number(y), Number(m) - 1, Number(d));
  const valid =
    asDate.getFullYear() === Number(y) &&
    asDate.getMonth() === Number(m) - 1 &&
    asDate.getDate() === Number(d);
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  if (!valid || Math.abs(asDate.getTime() - now.getTime()) > twoDaysMs) {
    return tutaDriveBackupDateStamp(now);
  }
  return `${y}_${m}_${d}`;
}

export function tutaDriveBackupFileName({ dateStamp = tutaDriveBackupDateStamp(), note = '', suffix = 0 } = {}) {
  const slug = tutaDriveBackupNoteSlug(note);
  const noteSegment = slug ? `_${slug}` : '';
  const suffixSegment = suffix > 1 ? `_${suffix}` : '';
  return `${TUTADRIVE_BACKUP_FILE_PREFIX}_${dateStamp}${noteSegment}${suffixSegment}.zip`;
}
