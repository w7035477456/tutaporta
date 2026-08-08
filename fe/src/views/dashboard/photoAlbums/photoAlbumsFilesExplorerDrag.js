/** MIME + in-memory files/handles for dragging from Files Explorer into the green staging tray. */

import { isMacOsMetadataFileName } from 'utils/photoAlbumsFileFormats';

export const DRAG_FILES_EXPLORER = 'application/x-pa-files-explorer';
export const DRAG_FILES_EXPLORER_FLAG = 'application/x-pa-files-explorer-flag';

const EXT_MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpe: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  apng: 'image/apng',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  svgz: 'image/svg+xml',
  bmp: 'image/bmp',
  dib: 'image/bmp',
  ico: 'image/x-icon',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4'
};

export function mimeFromPhotoFileName(name) {
  const ext = String(name || '')
    .trim()
    .toLowerCase()
    .split('.')
    .pop();
  return EXT_MIME[ext] || '';
}

/**
 * Clone File System Access file into an upload-safe File (correct name + image MIME).
 * Uses handle.getFile() when available; falls back to the listed File ref.
 */
export async function materializePhotoStagingFile(file, { handle = null, entryName = '' } = {}) {
  let source = file;
  if (handle && typeof handle.getFile === 'function') {
    try {
      source = await handle.getFile();
    } catch {
      if (!(file instanceof Blob) || file.size < 1) return null;
      source = file;
    }
  }
  if (!(source instanceof Blob) || source.size < 1) return null;

  const name =
    String(entryName || source.name || file?.name || 'photo.jpg').trim() || 'photo.jpg';
  if (isMacOsMetadataFileName(name)) return null;
  const type =
    String(source.type || '').trim() || mimeFromPhotoFileName(name) || 'image/jpeg';
  const lastModified = Number(source.lastModified) || Date.now();

  try {
    const buf = await source.arrayBuffer();
    if (!buf?.byteLength) return null;
    return new File([buf], name, { type, lastModified });
  } catch {
    try {
      return new File([source.slice(0, source.size, type)], name, { type, lastModified });
    } catch {
      return null;
    }
  }
}

/** Object URL for tray thumbnail — force image MIME when the File System Access type is empty. */
export function createPhotoStagingPreviewObjectUrl(file, fileName = '') {
  if (!(file instanceof Blob) || file.size < 1) return '';
  const name = String(fileName || file?.name || '').trim();
  const type = String(file.type || '').trim() || mimeFromPhotoFileName(name) || 'image/jpeg';
  try {
    if (String(file.type || '').trim() === type) {
      return URL.createObjectURL(file);
    }
    return URL.createObjectURL(new Blob([file], { type }));
  } catch {
    return '';
  }
}

/** @type {null | { entries: Array<{ file: File, handle: FileSystemFileHandle | null, name: string }> }} */
let activeFilesExplorerDrag = null;

/**
 * @param {Array<{ file?: File, handle?: FileSystemFileHandle | null, name?: string } | File>} entriesOrFiles
 */
export function setActiveFilesExplorerDrag(entriesOrFiles) {
  const list = (Array.isArray(entriesOrFiles) ? entriesOrFiles : [])
    .map((row) => {
      if (row instanceof File) {
        return { file: row, handle: null, name: row.name || '' };
      }
      if (row?.file instanceof File) {
        return {
          file: row.file,
          handle: row.handle || null,
          name: String(row.name || row.file.name || '')
        };
      }
      return null;
    })
    .filter(Boolean);
  activeFilesExplorerDrag = list.length ? { entries: list } : null;
}

export function getActiveFilesExplorerDrag() {
  return activeFilesExplorerDrag?.entries?.length
    ? { entries: [...activeFilesExplorerDrag.entries] }
    : null;
}

export function clearActiveFilesExplorerDrag() {
  activeFilesExplorerDrag = null;
}

export function isFilesExplorerDrag(dataTransfer) {
  if (activeFilesExplorerDrag?.entries?.length) return true;
  const types = dataTransfer?.types ? Array.from(dataTransfer.types) : [];
  return types.includes(DRAG_FILES_EXPLORER) || types.includes(DRAG_FILES_EXPLORER_FLAG);
}

/** Re-read from FileSystemFileHandle when possible, clone into upload-safe File objects. */
export async function takeFilesExplorerDragFilesAsync() {
  const entries = activeFilesExplorerDrag?.entries?.length
    ? [...activeFilesExplorerDrag.entries]
    : [];
  activeFilesExplorerDrag = null;
  const out = [];
  for (const entry of entries) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const file = await materializePhotoStagingFile(entry.file, {
        handle: entry.handle,
        entryName: entry.name
      });
      if (file) out.push(file);
    } catch {
      // skip unreadable entry
    }
  }
  return out;
}
