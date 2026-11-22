/**
 * TutaPhotos sealed-backup file names.
 *
 * Current:  EncryptedTutaPhotosZip_YYYY_MM_DD[_<note>][_N].zip
 *
 * Keep in sync with fe/src/utils/photoAlbumsBackupFileName.js.
 */

export const PHOTOALBUMS_BACKUP_FILE_PREFIX = 'EncryptedTutaPhotosZip';

/** Note typed in the Backup popup — fewer than 20 characters (appended to the zip name). */
export const PHOTOALBUMS_BACKUP_NOTE_MAX_LEN = 19;
export const PHOTOALBUMS_BACKUP_HINT_MAX_LEN = 100;

export const PHOTOALBUMS_BACKUP_NAME_RE =
  /^EncryptedTutaPhotosZip_\d{4}_\d{2}_\d{2}(?:_[A-Za-z0-9_-]{1,40})?\.zip$/i;

const DATE_STAMP_RE = /^(\d{4})_(\d{2})_(\d{2})$/;

export function isPhotoAlbumsBackupFileName(name) {
  return PHOTOALBUMS_BACKUP_NAME_RE.test(String(name || ''));
}

export function photoAlbumsBackupNoteSlug(note) {
  return String(note || '')
    .trim()
    .slice(0, PHOTOALBUMS_BACKUP_NOTE_MAX_LEN)
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_-]/g, '');
}

export function photoAlbumsBackupDateStamp(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}_${m}_${d}`;
}

/**
 * Accept the browser's local date when it is a real date within two days of the server clock;
 * otherwise use the server date.
 */
export function resolvePhotoAlbumsBackupDateStamp(requested, now = new Date()) {
  const match = DATE_STAMP_RE.exec(String(requested || '').trim());
  if (!match) return photoAlbumsBackupDateStamp(now);
  const [, y, m, d] = match;
  const asDate = new Date(Number(y), Number(m) - 1, Number(d));
  const valid =
    asDate.getFullYear() === Number(y) &&
    asDate.getMonth() === Number(m) - 1 &&
    asDate.getDate() === Number(d);
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  if (!valid || Math.abs(asDate.getTime() - now.getTime()) > twoDaysMs) {
    return photoAlbumsBackupDateStamp(now);
  }
  return `${y}_${m}_${d}`;
}

export function photoAlbumsBackupFileName({ dateStamp = photoAlbumsBackupDateStamp(), note = '', suffix = 0 } = {}) {
  const slug = photoAlbumsBackupNoteSlug(note);
  const noteSegment = slug ? `_${slug}` : '';
  const suffixSegment = suffix > 1 ? `_${suffix}` : '';
  return `${PHOTOALBUMS_BACKUP_FILE_PREFIX}_${dateStamp}${noteSegment}${suffixSegment}.zip`;
}
