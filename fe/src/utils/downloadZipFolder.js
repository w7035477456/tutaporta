/**
 * Save downloaded backup zips through the Mac / Windows "Save As" dialog with the full zip name
 * filled in (File System Access API — Chrome / Edge desktop). Chrome reopens the dialog at the
 * last folder used for this site. Other browsers fall back to a normal browser download.
 */

export function isSaveZipDialogSupported() {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
}

/**
 * Call at the very start of a click handler (before any slow await) — the Save dialog needs the
 * click's user activation.
 * @returns {Promise<{ file: FileSystemFileHandle, name: string } | { cancelled: true } | null>}
 *   null = unsupported / unavailable → caller should fall back to a normal browser download.
 */
export async function acquireSaveZipFile(suggestedName) {
  if (!isSaveZipDialogSupported()) return null;
  try {
    const file = await window.showSaveFilePicker({
      id: 'tutaDownloadZip',
      startIn: 'downloads',
      suggestedName: String(suggestedName || 'download.zip'),
      types: [{ description: 'Zip file', accept: { 'application/zip': ['.zip'] } }]
    });
    return { file, name: file.name };
  } catch (err) {
    if (err?.name === 'AbortError') return { cancelled: true };
    return null;
  }
}

/** Write `blob` into the file chosen in acquireSaveZipFile (overwrites it). */
export async function saveBlobToZipFile(file, blob) {
  const writable = await file.createWritable();
  try {
    await writable.write(blob);
    await writable.close();
  } catch (err) {
    await writable.abort?.().catch(() => {});
    throw err;
  }
}
