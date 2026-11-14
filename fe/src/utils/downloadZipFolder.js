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
const ZIP_PICKER_ID = 'tutaNotesBackupZip';
const ZIP_PICKER_TYPES = [{ description: 'Zip file', accept: { 'application/zip': ['.zip'] } }];

export async function acquireSaveZipFile(suggestedName) {
  if (!isSaveZipDialogSupported()) return null;
  try {
    const file = await window.showSaveFilePicker({
      id: ZIP_PICKER_ID,
      startIn: 'downloads',
      suggestedName: String(suggestedName || 'download.zip'),
      types: ZIP_PICKER_TYPES
    });
    return { file, name: file.name };
  } catch (err) {
    if (err?.name === 'AbortError') return { cancelled: true };
    return null;
  }
}

/** Pick an existing backup zip — Chrome reuses the last folder from the paired Save picker (`ZIP_PICKER_ID`). */
export async function acquireOpenZipFile() {
  if (typeof window === 'undefined' || typeof window.showOpenFilePicker !== 'function') {
    return null;
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      id: ZIP_PICKER_ID,
      startIn: 'documents',
      multiple: false,
      types: ZIP_PICKER_TYPES
    });
    const file = await handle.getFile();
    return { file, name: file.name };
  } catch (err) {
    if (err?.name === 'AbortError') return { cancelled: true };
    return null;
  }
}

export function isKeepLatestZipsSupported() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

/** Keep 3 is clickable only when that folder has more backup zips than `keep`. Unknown stays clickable. */
export function keepLatestButtonEnabled(zipCount, keep = 3) {
  if (zipCount == null || zipCount === '') return true;
  const n = Number(zipCount);
  if (!Number.isFinite(n)) return true;
  return n > keep;
}

/** Suggested zip name, or `name_2.zip`, `name_3.zip`, … when that name is already in the folder. */
export function uniqueZipFileName(existingNames, suggestedName) {
  const taken = new Set([...existingNames].map((n) => String(n || '').toLowerCase()));
  const name = String(suggestedName || 'download.zip');
  if (!taken.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${stem}_${n}${ext}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${stem}_${Date.now()}${ext}`;
}

function prefixedZipName(name, prefix) {
  const lower = String(name || '').toLowerCase();
  const namePrefix = `${String(prefix || '')}_`.toLowerCase();
  return Boolean(prefix) && lower.startsWith(namePrefix) && lower.endsWith('.zip');
}

async function listFileNames(dir) {
  const names = [];
  for await (const entry of dir.values()) {
    if (entry.kind === 'file') names.push(entry.name);
  }
  return names;
}

/** How many `<prefix>_*.zip` files are in `dir` (the zip just saved counts). */
export async function countPrefixedZips(dir, prefix) {
  if (!dir || !prefix) return 0;
  let count = 0;
  for await (const entry of dir.values()) {
    if (entry.kind === 'file' && prefixedZipName(entry.name, prefix)) count += 1;
  }
  return count;
}

async function listPrefixedZips(dir, prefix) {
  const zips = [];
  for await (const entry of dir.values()) {
    if (entry.kind !== 'file' || !prefixedZipName(entry.name, prefix)) continue;
    const file = await entry.getFile();
    zips.push({ name: entry.name, lastModified: file.lastModified });
  }
  zips.sort((a, b) => b.lastModified - a.lastModified || b.name.localeCompare(a.name));
  return zips;
}

/**
 * Pick the backup folder (same remembered folder as Save As) and create `suggestedName` in it.
 * A file handle from Save As cannot see sibling zips, so Keep 3's green/grey state needs this folder.
 * Falls back to Save As when the folder picker is unavailable.
 * @returns {Promise<{ file: FileSystemFileHandle, name: string, directory: FileSystemDirectoryHandle | null } | { cancelled: true } | null>}
 */
export async function acquireBackupFolderZip(suggestedName) {
  if (!isKeepLatestZipsSupported()) return acquireSaveZipFile(suggestedName);
  let dir;
  try {
    dir = await window.showDirectoryPicker({ id: ZIP_PICKER_ID, mode: 'readwrite' });
  } catch (err) {
    if (err?.name === 'AbortError') return { cancelled: true };
    return acquireSaveZipFile(suggestedName);
  }
  try {
    const name = uniqueZipFileName(await listFileNames(dir), suggestedName);
    const file = await dir.getFileHandle(name, { create: true });
    return { file, name: file.name || name, directory: dir };
  } catch (err) {
    if (err?.name === 'AbortError') return { cancelled: true };
    return acquireSaveZipFile(suggestedName);
  }
}

/**
 * Delete every `<prefix>_*.zip` in a folder except the newest `keep` (by last modified).
 * Pass `directory` when backup already opened that folder; otherwise the member confirms it.
 * @returns {Promise<{ kept: string[], removed: string[], directory: FileSystemDirectoryHandle } | { cancelled: true } | null>}
 *   null = unsupported browser.
 */
export async function keepLatestZipsInFolder({ prefix, keep = 3, startIn, directory } = {}) {
  if (!directory && !isKeepLatestZipsSupported()) return null;
  let dir = directory || null;
  if (!dir) {
    try {
      dir = await window.showDirectoryPicker({
        id: ZIP_PICKER_ID,
        mode: 'readwrite',
        ...(startIn ? { startIn } : {})
      });
    } catch (err) {
      if (err?.name === 'AbortError') return { cancelled: true };
      throw err;
    }
  }
  const zips = await listPrefixedZips(dir, prefix);
  const kept = zips.slice(0, keep).map((z) => z.name);
  const removed = [];
  for (const { name } of zips.slice(keep)) {
    await dir.removeEntry(name);
    removed.push(name);
  }
  return { kept, removed, directory: dir };
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
