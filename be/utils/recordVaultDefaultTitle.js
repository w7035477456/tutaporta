/**
 * Default content title for a Record Vault note.
 * @param {number} notebookNumber 1-based notebook position for the member
 * @param {number} noteNumber 1-based note position within the notebook
 */
export function formatDefaultRecordVaultNoteTitle(notebookNumber, noteNumber) {
  const nb = Number(notebookNumber);
  const nt = Number(noteNumber);
  if (!Number.isFinite(nb) || nb < 1 || !Number.isFinite(nt) || nt < 1) {
    return 'New Note';
  }
  return `NB ${nb}, Note ${nt}`;
}
