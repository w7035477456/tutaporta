/**
 * TutaPhotos sealed-backup zip name preview — keep in sync with be/utils/photoAlbumsTutaDriveBackupNames.js.
 * EncryptedTutaPhotosZip_YYYY_MM_DD[_<note>].zip
 */

export const PHOTOALBUMS_BACKUP_FILE_PREFIX = 'EncryptedTutaPhotosZip';
export const PHOTOALBUMS_BACKUP_NOTE_MAX_LEN = 19;
export const PHOTOALBUMS_BACKUP_HINT_MAX_LEN = 100;

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

export function photoAlbumsBackupFileNamePreview(note, dateStamp = photoAlbumsBackupDateStamp()) {
  const slug = photoAlbumsBackupNoteSlug(note);
  return `${PHOTOALBUMS_BACKUP_FILE_PREFIX}_${dateStamp}${slug ? `_${slug}` : ''}.zip`;
}
