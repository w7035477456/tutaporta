/** MIME + in-memory payload for dragging an album page onto another album. */

export const DRAG_ALBUM_PAGE = 'application/x-record-vault-album-page';

/** @type {null | { noteId: number, pageIndex: number, pageNumber: number, instanceKey: string, storageType: string }} */
let activeAlbumPageDrag = null;

export function setActiveAlbumPageDrag(payload) {
  activeAlbumPageDrag = payload && typeof payload === 'object' ? { ...payload } : null;
}

export function getActiveAlbumPageDrag() {
  return activeAlbumPageDrag ? { ...activeAlbumPageDrag } : null;
}

export function clearActiveAlbumPageDrag() {
  activeAlbumPageDrag = null;
}

export function isAlbumPageDrag(dataTransfer) {
  if (activeAlbumPageDrag) return true;
  const types = dataTransfer?.types ? Array.from(dataTransfer.types) : [];
  return types.includes(DRAG_ALBUM_PAGE);
}

export function readAlbumPageDrag(dataTransfer) {
  const live = getActiveAlbumPageDrag();
  if (live) return live;
  try {
    const raw = dataTransfer?.getData?.(DRAG_ALBUM_PAGE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const noteId = Number(parsed.noteId);
    const pageIndex = Number(parsed.pageIndex);
    if (!Number.isFinite(noteId) || noteId < 1 || !Number.isFinite(pageIndex) || pageIndex < 0) {
      return null;
    }
    return {
      noteId,
      pageIndex,
      pageNumber: Number(parsed.pageNumber) || pageIndex + 1,
      instanceKey: String(parsed.instanceKey || ''),
      storageType: parsed.storageType === 'onedrive' ? 'onedrive' : 'usb'
    };
  } catch {
    return null;
  }
}

export function serializeAlbumPageDrag(payload) {
  return JSON.stringify({
    noteId: Number(payload.noteId),
    pageIndex: Number(payload.pageIndex),
    pageNumber: Number(payload.pageNumber) || Number(payload.pageIndex) + 1,
    instanceKey: String(payload.instanceKey || ''),
    storageType: payload.storageType === 'onedrive' ? 'onedrive' : 'usb'
  });
}
