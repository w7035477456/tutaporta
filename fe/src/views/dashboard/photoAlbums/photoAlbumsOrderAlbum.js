/**
 * Session-local Order Album queue (print-server tie-in later).
 * Items: pages, albums, album-sets, shortcuts.
 */

const STORAGE_PREFIX = 'photoAlbums.orderAlbum.v1';
const NAME_STORAGE_PREFIX = 'photoAlbums.orderAlbumName.v1';

/** Default display name for the For Order / print queue album. */
export const DEFAULT_ORDER_ALBUM_NAME = 'ForOrder';

export function orderAlbumStorageKey(storageType, singlesId) {
  const st = String(storageType || 'usb').trim() || 'usb';
  const sid = String(singlesId || 'anon').trim() || 'anon';
  return `${STORAGE_PREFIX}.${st}.${sid}`;
}

function orderAlbumNameStorageKey(storageType, singlesId) {
  const st = String(storageType || 'usb').trim() || 'usb';
  const sid = String(singlesId || 'anon').trim() || 'anon';
  return `${NAME_STORAGE_PREFIX}.${st}.${sid}`;
}

export function loadOrderAlbumItems(storageType, singlesId) {
  try {
    const raw = window.sessionStorage.getItem(orderAlbumStorageKey(storageType, singlesId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => x && typeof x === 'object') : [];
  } catch {
    return [];
  }
}

export function saveOrderAlbumItems(storageType, singlesId, items) {
  try {
    window.sessionStorage.setItem(
      orderAlbumStorageKey(storageType, singlesId),
      JSON.stringify(Array.isArray(items) ? items : [])
    );
  } catch {
    // ignore quota / private mode
  }
}

export function loadOrderAlbumName(storageType, singlesId) {
  try {
    const raw = window.sessionStorage.getItem(orderAlbumNameStorageKey(storageType, singlesId));
    const name = String(raw || '').trim();
    return name || DEFAULT_ORDER_ALBUM_NAME;
  } catch {
    return DEFAULT_ORDER_ALBUM_NAME;
  }
}

export function saveOrderAlbumName(storageType, singlesId, name) {
  try {
    const next = String(name || '').trim() || DEFAULT_ORDER_ALBUM_NAME;
    window.sessionStorage.setItem(orderAlbumNameStorageKey(storageType, singlesId), next);
    return next;
  } catch {
    return String(name || '').trim() || DEFAULT_ORDER_ALBUM_NAME;
  }
}

export function newOrderAlbumItemId() {
  return `oa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function orderAlbumItemLabel(item) {
  if (!item) return 'Item';
  if (item.kind === 'page') {
    const album = String(item.noteName || 'Album').trim() || 'Album';
    const page = Number(item.pageIndex) + 1;
    return `${album} — page ${Number.isFinite(page) && page > 0 ? page : '?'}`;
  }
  if (item.kind === 'album') return String(item.noteName || 'Album').trim() || 'Album';
  if (item.kind === 'albumSet') return String(item.notebookName || 'Album-Set').trim() || 'Album-Set';
  if (item.kind === 'shortcut') return String(item.label || 'Shortcut').trim() || 'Shortcut';
  return String(item.label || item.kind || 'Item');
}
