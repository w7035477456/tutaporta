/**
 * Persist last Files Explorer folder (breadcrumb + File System Access handle).
 * Handle lives in IndexedDB; breadcrumb/path segments in localStorage.
 */

const LS_META_KEY = 'photoAlbumsFilesExplorerMeta_v1';
const LS_TAB_KEY = 'photoAlbumsFilesExplorerTab_v1';
const IDB_NAME = 'photoAlbumsFilesExplorer_v1';
const IDB_STORE = 'handles';
const IDB_ROOT_KEY = 'rootDirectoryHandle';

export const FILES_EXPLORER_TAB_FOLDERS = 'folders';
export const FILES_EXPLORER_TAB_EXPLORER = 'explorer';
export const FILES_EXPLORER_TAB_MOBILE_UPLOAD = 'mobile_upload';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

export function readFilesExplorerTab() {
  try {
    const raw = String(localStorage.getItem(LS_TAB_KEY) || '').trim();
    if (raw === FILES_EXPLORER_TAB_FOLDERS) return FILES_EXPLORER_TAB_FOLDERS;
    if (raw === FILES_EXPLORER_TAB_EXPLORER) return FILES_EXPLORER_TAB_EXPLORER;
    if (raw === FILES_EXPLORER_TAB_MOBILE_UPLOAD) return FILES_EXPLORER_TAB_MOBILE_UPLOAD;
    return FILES_EXPLORER_TAB_EXPLORER;
  } catch {
    return FILES_EXPLORER_TAB_EXPLORER;
  }
}

export function writeFilesExplorerTab(tab) {
  let next = FILES_EXPLORER_TAB_FOLDERS;
  if (tab === FILES_EXPLORER_TAB_EXPLORER) next = FILES_EXPLORER_TAB_EXPLORER;
  else if (tab === FILES_EXPLORER_TAB_MOBILE_UPLOAD) next = FILES_EXPLORER_TAB_MOBILE_UPLOAD;
  else if (tab === FILES_EXPLORER_TAB_FOLDERS) next = FILES_EXPLORER_TAB_FOLDERS;
  try {
    localStorage.setItem(LS_TAB_KEY, next);
  } catch {
    // ignore
  }
}

/** @returns {{ rootName: string, relativePath: string[] } | null} */
export function readFilesExplorerMeta() {
  try {
    const raw = localStorage.getItem(LS_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const rootName = String(parsed?.rootName ?? '').trim();
    const relativePath = Array.isArray(parsed?.relativePath)
      ? parsed.relativePath.map((seg) => String(seg || '').trim()).filter(Boolean)
      : [];
    if (!rootName) return null;
    return { rootName, relativePath };
  } catch {
    return null;
  }
}

export function writeFilesExplorerMeta({ rootName, relativePath } = {}) {
  const name = String(rootName ?? '').trim();
  if (!name) return;
  const path = Array.isArray(relativePath)
    ? relativePath.map((seg) => String(seg || '').trim()).filter(Boolean)
    : [];
  try {
    localStorage.setItem(LS_META_KEY, JSON.stringify({ rootName: name, relativePath: path }));
  } catch {
    // ignore
  }
}

export async function readFilesExplorerRootHandle() {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const handle = await idbRequest(store.get(IDB_ROOT_KEY));
      db.close();
      return handle || null;
    } catch (err) {
      db.close();
      throw err;
    }
  } catch {
    return null;
  }
}

export async function writeFilesExplorerRootHandle(handle) {
  if (!handle) return;
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      await idbRequest(store.put(handle, IDB_ROOT_KEY));
      db.close();
    } catch (err) {
      db.close();
      throw err;
    }
  } catch {
    // ignore quota / private mode / unsupported handle storage
  }
}

export async function clearFilesExplorerRootHandle() {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      await idbRequest(store.delete(IDB_ROOT_KEY));
      db.close();
    } catch (err) {
      db.close();
      throw err;
    }
  } catch {
    // ignore
  }
}

/**
 * Ensure we can read the directory. May prompt the user (must be from a gesture
 * when permission is not already granted).
 */
export async function ensureDirectoryReadPermission(handle, { interactive = false } = {}) {
  if (!handle || typeof handle.queryPermission !== 'function') return Boolean(handle);
  try {
    let state = await handle.queryPermission({ mode: 'read' });
    if (state === 'granted') return true;
    if (!interactive || typeof handle.requestPermission !== 'function') return false;
    state = await handle.requestPermission({ mode: 'read' });
    return state === 'granted';
  } catch {
    return false;
  }
}

/** Walk relativePath from rootHandle; returns the leaf directory handle. */
export async function resolveDirectoryFromRoot(rootHandle, relativePath = []) {
  if (!rootHandle) return null;
  let current = rootHandle;
  const segments = Array.isArray(relativePath) ? relativePath : [];
  for (const seg of segments) {
    const name = String(seg || '').trim();
    if (!name) continue;
    // eslint-disable-next-line no-await-in-loop
    current = await current.getDirectoryHandle(name);
  }
  return current;
}

export function formatFilesExplorerBreadcrumb(rootName, relativePath = []) {
  const parts = [String(rootName || '').trim(), ...(Array.isArray(relativePath) ? relativePath : [])]
    .map((p) => String(p || '').trim())
    .filter(Boolean);
  return parts.join(' > ');
}
