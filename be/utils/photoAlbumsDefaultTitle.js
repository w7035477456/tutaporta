/**
 * Default album-set title for TutaPhotoAlbums.
 * @param {number} notebookNumber 1-based set position for the member
 */
export function formatDefaultPhotoAlbumsNotebookTitle(notebookNumber) {
  const n = Number(notebookNumber);
  if (!Number.isFinite(n) || n < 1) {
    return 'Set 1';
  }
  return `Set ${n}`;
}

/**
 * Default album title within a set.
 * @param {number} notebookNumber 1-based set position for the member
 * @param {number} noteNumber 1-based album position within the set
 */
export function formatDefaultPhotoAlbumsNoteTitle(notebookNumber, noteNumber) {
  const nb = Number(notebookNumber);
  const nt = Number(noteNumber);
  if (!Number.isFinite(nb) || nb < 1 || !Number.isFinite(nt) || nt < 1) {
    return 'New Album';
  }
  return `Set ${nb}/Album ${nt}`;
}
