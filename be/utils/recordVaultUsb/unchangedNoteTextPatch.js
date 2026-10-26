/** Body / name autosave that matches what is stored (would only touch updated_at + vault.db mtime). */
export function isUnchangedNoteTextPatch(row, patch) {
  const keys = Object.keys(patch || {}).filter((key) => patch[key] !== undefined);
  if (!keys.length || keys.some((key) => key !== 'body_text' && key !== 'note_name')) return false;
  if (patch.body_text != null && String(patch.body_text) !== String(row.body_text ?? '')) return false;
  if (patch.note_name != null && String(patch.note_name) !== String(row.note_name ?? '')) return false;
  return true;
}
