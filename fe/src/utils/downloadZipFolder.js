/**
 * Save downloaded backup zips into a `download_zip` subfolder of a folder the user picks
 * (File System Access API — Chrome / Edge desktop). Nothing is kept in the browser: the picker
 * opens on every Download (Chrome reopens it at the last folder), and the chosen folder is saved
 * to user_customization.zip_folder. Other browsers fall back to a normal browser download.
 *
 * Chrome refuses to hand a site the home folder (~) or ~/Downloads itself ("contains system
 * files") but allows any folder inside them, so picking ~/xyz creates ~/xyz/download_zip and
 * picking a folder already named download_zip uses it as-is.
 */

export const DOWNLOAD_ZIP_FOLDER_NAME = 'download_zip';

export function isDownloadZipFolderSupported() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

function describeTargetFolder(pickedHandle) {
  const picked = String(pickedHandle?.name || '').trim();
  if (picked === DOWNLOAD_ZIP_FOLDER_NAME) return `…/${DOWNLOAD_ZIP_FOLDER_NAME}`;
  if (picked === 'Downloads') return `~/Downloads/${DOWNLOAD_ZIP_FOLDER_NAME}`;
  return `${picked}/${DOWNLOAD_ZIP_FOLDER_NAME}`;
}

/**
 * Call at the very start of a click handler (before any slow await) — the folder picker needs the
 * click's user activation.
 * @returns {Promise<{ dir: FileSystemDirectoryHandle, label: string } | { cancelled: true } | null>}
 *   null = unsupported / unavailable → caller should fall back to a normal browser download.
 */
export async function acquireDownloadZipFolder() {
  if (!isDownloadZipFolderSupported()) return null;
  let picked;
  try {
    picked = await window.showDirectoryPicker({ id: 'tutaDownloadZip', mode: 'readwrite', startIn: 'downloads' });
  } catch (err) {
    if (err?.name === 'AbortError') return { cancelled: true };
    return null;
  }
  try {
    const dir =
      picked.name === DOWNLOAD_ZIP_FOLDER_NAME
        ? picked
        : await picked.getDirectoryHandle(DOWNLOAD_ZIP_FOLDER_NAME, { create: true });
    return { dir, label: describeTargetFolder(picked) };
  } catch {
    return null;
  }
}

/** Write `blob` as `fileName` into the folder from acquireDownloadZipFolder (overwrites same name). */
export async function saveBlobToDownloadZipFolder(dir, fileName, blob) {
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(blob);
    await writable.close();
  } catch (err) {
    await writable.abort?.().catch(() => {});
    throw err;
  }
}
