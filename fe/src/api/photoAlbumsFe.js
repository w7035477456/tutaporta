import api from './axios';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import {
  normalizeUsbBridgeInstallerUrl,
  USB_BRIDGE_INSTALLER_API
} from 'utils/usbBridgeInstallerDownloadUrl';
import { rvCloudAxiosError, rvCloudLog } from 'utils/photoAlbumsCloudDebugLog';
import {
  bridgeFetchBlob,
  bridgeFetchBlobDownload,
  bridgeRequest,
  bridgeUploadFormData,
  getPhotoAlbumsBridgeBaseUrl,
  isPhotoAlbumsBridgeActive,
  isPhotoAlbumsBridgeAvailable,
  isPhotoAlbumsBridgeHostContext,
  probePhotoAlbumsBridge,
  setPhotoAlbumsBridgeStorageType,
  shouldRoutePhotoAlbumsThroughBridge
} from './photoAlbumsBridgeFe';

/** Prefer backend `{ error }` over axios/bridge generic status text. */
export function readPhotoAlbumsApiError(err, fallback = 'Request failed') {
  const data = err?.response?.data;
  if (typeof data === 'string' && data.trim()) {
    const raw = data.trim();
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.error) return String(parsed.error);
    } catch {
      // plain text body
    }
    return raw;
  }
  if (data?.error) return String(data.error);
  const message = String(err?.message || '').trim();
  if (message && !/^Request failed with status code \d+$/i.test(message)) return message;
  return fallback;
}

/** Main API only — used before bridge routing knows USB vs OneDrive. */
export async function fetchPhotoAlbumsSessionStorageType() {
  try {
    const { data } = await api.get('/api/photoAlbums/onedrive/status');
    if (data?.session?.unlocked && String(data.session.storageType || '').toLowerCase() === 'onedrive') {
      return 'onedrive';
    }
  } catch {
    // ignore
  }
  try {
    const { data } = await api.get('/api/photoAlbums/usb/status');
    if (data?.session?.unlocked) {
      const storageType = String(data.session.storageType || 'usb').toLowerCase();
      return storageType === 'onedrive' ? 'onedrive' : 'usb';
    }
  } catch {
    // ignore
  }
  return null;
}

async function normalizePhotoAlbumsBlobFetchError(err) {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text);
      const next = new Error(parsed?.error || text || 'Request failed');
      next.response = { status: err.response?.status, data: parsed };
      return next;
    } catch {
      // fall through
    }
  }
  return err;
}

/** Always hits website API (Postgres) — never the local USB bridge. */
export async function reportPhotoAlbumsSessionFileCounts({
  usbDelta = 0,
  uiDelta = 0,
  reset = false
} = {}) {
  try {
    const { data } = await api.post('/api/photoAlbums/session-file-counts', {
      usbDelta: Math.trunc(Number(usbDelta) || 0),
      uiDelta: Math.trunc(Number(uiDelta) || 0),
      reset: Boolean(reset)
    });
    return {
      usbTxRx: Number(data?.usbTxRx) || 0,
      uiTxRx: Number(data?.uiTxRx) || 0
    };
  } catch {
    return null;
  }
}

/** Report USB-bridge Tx/Rx bytes to the website API (not metered on bridge hop). */
export async function reportPhotoAlbumsTransferBytes(bytes) {
  const n = Math.floor(Number(bytes) || 0);
  if (n <= 0) return null;
  try {
    const { data } = await api.post('/api/photoAlbums/transfer-bytes', { bytes: n });
    return data?.transfer || null;
  } catch {
    return null;
  }
}

/** Login-gate Usb/ui counts (frozen at last logoff; website Postgres). */
export async function fetchPhotoAlbumsSessionFileCounts() {
  const { data } = await api.get('/api/photoAlbums/session-file-counts', {
    params: { last: 1 }
  });
  return {
    usbTxRx: Number(data?.usbTxRx) || 0,
    uiTxRx: Number(data?.uiTxRx) || 0
  };
}

/** Copy running session counts → last-session snapshot (after USB bridge logoff). */
export async function snapshotPhotoAlbumsSessionFileCounts() {
  try {
    const { data } = await api.post('/api/photoAlbums/session-file-counts', { snapshot: true });
    return {
      usbTxRx: Number(data?.usbTxRx) || 0,
      uiTxRx: Number(data?.uiTxRx) || 0
    };
  } catch {
    return null;
  }
}

/** Per-tab: tree open already counted for this storage type after unlock. */
const sessionTreeCounted = { usb: false, onedrive: false };

export function resetPhotoAlbumsSessionTreeCountFlags() {
  sessionTreeCounted.usb = false;
  sessionTreeCounted.onedrive = false;
}

function countTreeNotebooksAndNotes(tree) {
  const notebooks = Array.isArray(tree?.notebooks) ? tree.notebooks : [];
  let noteCount = 0;
  for (const nb of notebooks) {
    noteCount += Array.isArray(nb?.notes) ? nb.notes.length : 0;
  }
  return notebooks.length + noteCount;
}

function sessionCountPathOnly(url) {
  return String(url || '').split('?')[0];
}

/**
 * Bridge has no Postgres — FE reports USB open + browser hops to the website API.
 * Website BE already counts OneDrive/in-process USB; skip when not via bridge.
 */
function maybeReportBridgeSessionFileCounts(config, responseData, viaBridge) {
  if (!viaBridge) return;
  const url = sessionCountPathOnly(config?.url);
  const method = String(config?.method || 'GET').toUpperCase();
  const storageType = config?.storageType === 'onedrive' ? 'onedrive' : 'usb';

  if (method === 'POST' && /\/api\/photoAlbums\/usb\/(unlock|init)/.test(url)) {
    sessionTreeCounted.usb = false;
    void reportPhotoAlbumsSessionFileCounts({ reset: true });
    const openCount =
      Number(responseData?.session?.sessionOpenItemCount ?? responseData?.sessionOpenItemCount) || 0;
    if (openCount > 0) {
      void reportPhotoAlbumsSessionFileCounts({ usbDelta: openCount });
    }
    return;
  }

  if (method === 'GET' && url === '/api/photoAlbums') {
    if (sessionTreeCounted[storageType]) return;
    sessionTreeCounted[storageType] = true;
    const n = countTreeNotebooksAndNotes(responseData);
    if (n > 0) {
      // Unlock already added usbDelta for notebooks+notes; tree is the UI hop only.
      // If unlock did not return open count (older bridge), include usb here once.
      void reportPhotoAlbumsSessionFileCounts({ uiDelta: n });
    }
    return;
  }

  if (method === 'GET' && /\/api\/photoAlbums\/notes\/\d+$/.test(url)) {
    void reportPhotoAlbumsSessionFileCounts({ uiDelta: 1 });
    return;
  }
  if (
    method === 'GET' &&
    (/\/api\/photoAlbums\/notes\/\d+\/image/.test(url) ||
      /\/api\/photoAlbums\/notes\/\d+\/extra-images\/\d+/.test(url) ||
      /\/api\/photoAlbums\/notes\/\d+\/attachments\/\d+/.test(url))
  ) {
    void reportPhotoAlbumsSessionFileCounts({ uiDelta: 1 });
    return;
  }

  if (
    (method === 'POST' || method === 'PATCH') &&
    (/\/api\/photoAlbums\/notebooks/.test(url) || /\/api\/photoAlbums\/notes/.test(url))
  ) {
    void reportPhotoAlbumsSessionFileCounts({
      uiDelta: 1,
      usbDelta: storageType === 'usb' ? 1 : 0
    });
  }
}

async function rvRequest(config) {
  const storageType = config?.storageType ?? null;
  const headers = { ...(config?.headers || {}) };
  if (storageType) {
    headers['X-Record-Vault-Storage'] = storageType;
  }
  const nextConfig = { ...config, headers };
  const viaBridge = shouldRoutePhotoAlbumsThroughBridge(nextConfig.url, storageType);
  const result = viaBridge ? await bridgeRequest(nextConfig) : await api(nextConfig);
  maybeReportBridgeSessionFileCounts(nextConfig, result?.data, viaBridge);
  return result;
}

/** Express default 404 when an older local bridge only registered the Record Vault USB paths. */
function isBridgeUsbPathNotFound(err, path) {
  const status = err?.response?.status;
  if (status === 404) return true;
  const message = readPhotoAlbumsApiError(err, '');
  const normalizedPath = String(path || '').split('?')[0].trim();
  if (!normalizedPath) return false;
  const escaped = normalizedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`cannot get ${escaped}`, 'i').test(message);
}

/**
 * Packaged usbBridgeV3 older than TutaPhotoAlbums — health OK but `/api/photoAlbums/*` 404s.
 * Locations may still work via legacy `/api/recordVault/usb/locations` fallback.
 */
export function isPhotoAlbumsBridgeRouteMissingError(err) {
  const message = readPhotoAlbumsApiError(err, '');
  if (/cannot\s+get\s+\/api\/photoAlbums/i.test(message)) return true;
  if (/cannot\s+post\s+\/api\/photoAlbums/i.test(message)) return true;
  if (err?.response?.data?.code === 'PHOTO_ALBUMS_BRIDGE_OUTDATED') return true;
  const status = err?.response?.status;
  if (status === 404 && /\/api\/photoAlbums/i.test(message)) return true;
  return false;
}

export const PHOTO_ALBUMS_OUTDATED_BRIDGE_MESSAGE =
  'USB Bridge is outdated — missing TutaPhotoAlbums routes. Quit usbBridgeV3, update/reinstall the bridge, then open TutaPhotoAlbums USB again.';

function throwPhotoAlbumsOutdatedBridgeError(cause) {
  const error = new Error(PHOTO_ALBUMS_OUTDATED_BRIDGE_MESSAGE);
  error.response = {
    status: 404,
    data: {
      error: PHOTO_ALBUMS_OUTDATED_BRIDGE_MESSAGE,
      code: 'PHOTO_ALBUMS_BRIDGE_OUTDATED'
    }
  };
  if (cause) error.cause = cause;
  throw error;
}

/** True when local bridge is up but does not serve TutaPhotoAlbums USB APIs. */
export async function probePhotoAlbumsBridgeSupportsPhotoAlbums() {
  const probe = await probePhotoAlbumsBridge();
  if (!probe.ok) {
    return { ok: false, outdated: false, error: probe.error || 'USB Bridge unreachable' };
  }
  try {
    await bridgeRequest({
      method: 'GET',
      url: '/api/photoAlbums/usb/status',
      storageType: 'usb'
    });
    return { ok: true, outdated: false, error: '' };
  } catch (err) {
    if (isPhotoAlbumsBridgeRouteMissingError(err)) {
      return { ok: false, outdated: true, error: PHOTO_ALBUMS_OUTDATED_BRIDGE_MESSAGE };
    }
    // 401 / 428 prove the route exists (auth or vault session missing).
    if (err?.response?.status === 401 || err?.response?.status === 428) {
      return { ok: true, outdated: false, error: '' };
    }
    if (/not unlocked/i.test(readPhotoAlbumsApiError(err, ''))) {
      return { ok: true, outdated: false, error: '' };
    }
    return { ok: true, outdated: false, error: '' };
  }
}

/**
 * Shared USB bridge installers predated TutaPhotoAlbums routes — fall back to the
 * equivalent Record Vault path on the same local bridge / API process.
 */
async function rvRequestWithLegacyUsbBridgeFallback(primaryUrl, fallbackUrl, config = {}) {
  try {
    return await rvRequest({ ...config, url: primaryUrl });
  } catch (err) {
    if (!isBridgeUsbPathNotFound(err, primaryUrl)) throw err;
    const storageType = config?.storageType ?? null;
    const viaBridge = shouldRoutePhotoAlbumsThroughBridge(primaryUrl, storageType);
    if (viaBridge) {
      return await bridgeRequest({ ...config, url: fallbackUrl, storageType });
    }
    return await rvRequest({ ...config, url: fallbackUrl });
  }
}

function photoAlbumsMediaBaseUrl() {
  return isPhotoAlbumsBridgeActive() ? getPhotoAlbumsBridgeBaseUrl() : getApiBaseUrl();
}

export function photoAlbumsNoteImageUrl(noteId, slot = 'center') {
  const id = Number(noteId);
  if (!Number.isFinite(id) || id < 1) return '';
  const base = photoAlbumsMediaBaseUrl();
  if (slot === 'top') return `${base}/api/photoAlbums/notes/${id}/image/top`;
  if (slot === 'bottom') return `${base}/api/photoAlbums/notes/${id}/image/bottom`;
  return `${base}/api/photoAlbums/notes/${id}/image`;
}

export function photoAlbumsNoteExtraImageUrl(noteId, imageId) {
  const note = Number(noteId);
  const image = Number(imageId);
  if (!Number.isFinite(note) || note < 1 || !Number.isFinite(image) || image < 1) return '';
  return `${photoAlbumsMediaBaseUrl()}/api/photoAlbums/notes/${note}/extra-images/${image}`;
}

export function photoAlbumsNoteAttachmentUrl(noteId, attachmentId, { inline = false } = {}) {
  const note = Number(noteId);
  const attachment = Number(attachmentId);
  if (!Number.isFinite(note) || note < 1 || !Number.isFinite(attachment) || attachment < 1) return '';
  const base = `${photoAlbumsMediaBaseUrl()}/api/photoAlbums/notes/${note}/attachments/${attachment}`;
  return inline ? `${base}?inline=1` : base;
}

export async function fetchPhotoAlbumsNoteAttachmentBlob(noteId, attachmentId, { inline = true, storageType = null } = {}) {
  const note = Number(noteId);
  const attachment = Number(attachmentId);
  if (!Number.isFinite(note) || note < 1 || !Number.isFinite(attachment) || attachment < 1) {
    throw new Error('Invalid note or attachment id');
  }

  const path = `/api/photoAlbums/notes/${note}/attachments/${attachment}`;
  const query = inline ? '?inline=1' : '';
  if (shouldRoutePhotoAlbumsThroughBridge(path, storageType)) {
    const blob = await bridgeFetchBlob(`${path}${query}`);
    void reportPhotoAlbumsSessionFileCounts({ uiDelta: 1 });
    return blob;
  }

  try {
    const { data } = await api.get(path, {
      params: inline ? { inline: 1 } : undefined,
      responseType: 'blob',
      headers: storageType ? { 'X-Record-Vault-Storage': storageType } : undefined
    });
    return data;
  } catch (err) {
    throw await normalizePhotoAlbumsBlobFetchError(err);
  }
}

function photoAlbumsNoteImageApiPath(noteId, slot = 'center') {
  const id = Number(noteId);
  if (!Number.isFinite(id) || id < 1) return '';
  if (slot === 'top') return `/api/photoAlbums/notes/${id}/image/top`;
  if (slot === 'bottom') return `/api/photoAlbums/notes/${id}/image/bottom`;
  return `/api/photoAlbums/notes/${id}/image`;
}

/** Authenticated fetch — required for USB bridge (img src cannot send X-Record-Vault-Singles-Id). */
export async function fetchPhotoAlbumsNoteImageBlob(noteId, slot = 'center', { cacheBust, storageType = null } = {}) {
  const path = photoAlbumsNoteImageApiPath(noteId, slot);
  if (!path) throw new Error('Invalid note id');
  const query =
    cacheBust != null && String(cacheBust).trim() !== ''
      ? `?v=${encodeURIComponent(String(cacheBust))}`
      : '';
  if (shouldRoutePhotoAlbumsThroughBridge(path, storageType)) {
    const blob = await bridgeFetchBlob(`${path}${query}`);
    void reportPhotoAlbumsSessionFileCounts({ uiDelta: 1 });
    return blob;
  }
  try {
    const { data } = await api.get(path, {
      responseType: 'blob',
      params: cacheBust != null && String(cacheBust).trim() !== '' ? { v: cacheBust } : undefined,
      headers: storageType ? { 'X-Record-Vault-Storage': storageType } : undefined
    });
    return data;
  } catch (err) {
    throw await normalizePhotoAlbumsBlobFetchError(err);
  }
}

export async function fetchPhotoAlbumsNoteExtraImageBlob(noteId, imageId, { cacheBust, storageType = null } = {}) {
  const note = Number(noteId);
  const image = Number(imageId);
  if (!Number.isFinite(note) || note < 1 || !Number.isFinite(image) || image < 1) {
    throw new Error('Invalid note or image id');
  }
  const path = `/api/photoAlbums/notes/${note}/extra-images/${image}`;
  const query =
    cacheBust != null && String(cacheBust).trim() !== ''
      ? `?v=${encodeURIComponent(String(cacheBust))}`
      : '';
  if (shouldRoutePhotoAlbumsThroughBridge(path, storageType)) {
    const blob = await bridgeFetchBlob(`${path}${query}`);
    void reportPhotoAlbumsSessionFileCounts({ uiDelta: 1 });
    return blob;
  }
  try {
    const { data } = await api.get(path, {
      responseType: 'blob',
      params: cacheBust != null && String(cacheBust).trim() !== '' ? { v: cacheBust } : undefined,
      headers: storageType ? { 'X-Record-Vault-Storage': storageType } : undefined
    });
    return data;
  } catch (err) {
    throw await normalizePhotoAlbumsBlobFetchError(err);
  }
}

/** Fetch via authenticated API/bridge and save as a local file (one-click download). */
export async function downloadPhotoAlbumsNoteAttachment(noteId, attachmentId, fileName, { storageType = null } = {}) {
  const blob = await fetchPhotoAlbumsNoteAttachmentBlob(noteId, attachmentId, { inline: false, storageType });
  const name = String(fileName || 'download').trim() || 'download';
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function fetchPhotoAlbumsTree({ storageType } = {}) {
  const { data } = await rvRequest({ method: 'GET', url: '/api/photoAlbums', storageType });
  return {
    notebooks: Array.isArray(data?.notebooks) ? data.notebooks : [],
    shortcuts: Array.isArray(data?.shortcuts) ? data.shortcuts : []
  };
}

/** Lazy load — full text, keywords, attachments, and extra images for one note. */
export async function fetchPhotoAlbumsNote(noteId, { storageType } = {}) {
  const id = Number(noteId);
  if (!Number.isFinite(id) || id < 1) return null;
  const { data } = await rvRequest({method: 'GET', url: `/api/photoAlbums/notes/${id}`, storageType });
  return data?.note ?? null;
}

export async function createPhotoAlbumsNotebook(notebookName, { storageType } = {}) {
  const { data } = await rvRequest({method: 'POST',
    url: '/api/photoAlbums/notebooks',
    data: { notebook_name: notebookName }, storageType });
  return data?.notebook;
}

export async function updatePhotoAlbumsNotebook(notebookId, notebookName, { storageType } = {}) {
  const { data } = await rvRequest({method: 'PATCH',
    url: `/api/photoAlbums/notebooks/${notebookId}`,
    data: { notebook_name: notebookName }, storageType });
  return data?.notebook;
}

export async function deletePhotoAlbumsNotebook(notebookId, { storageType } = {}) {
  const { data } = await rvRequest({method: 'DELETE', url: `/api/photoAlbums/notebooks/${notebookId}`, storageType });
  return data;
}

export async function reorderPhotoAlbumsNotebooks(notebookIds, { storageType } = {}) {
  const { data } = await rvRequest({method: 'PUT',
    url: '/api/photoAlbums/notebooks/reorder',
    data: { notebook_ids: notebookIds }, storageType });
  return data;
}

export async function reorderPhotoAlbumsNotes(notebookId, noteIds, { storageType } = {}) {
  const { data } = await rvRequest({method: 'PUT',
    url: `/api/photoAlbums/notebooks/${notebookId}/notes/reorder`,
    data: { note_ids: noteIds }, storageType });
  return data;
}

export async function createPhotoAlbumsShortcut(payload, { storageType } = {}) {
  const { data } = await rvRequest({ method: 'POST', url: '/api/photoAlbums/shortcuts', data: payload , storageType });
  return data?.shortcut;
}

export async function deletePhotoAlbumsShortcut(shortcutId, { storageType } = {}) {
  const { data } = await rvRequest({method: 'DELETE', url: `/api/photoAlbums/shortcuts/${shortcutId}`, storageType });
  return data;
}

export async function reorderPhotoAlbumsShortcuts(shortcutIds, { storageType } = {}) {
  const { data } = await rvRequest({method: 'PUT',
    url: '/api/photoAlbums/shortcuts/reorder',
    data: { shortcut_ids: shortcutIds }, storageType });
  return data;
}

export async function createPhotoAlbumsNote(notebookId, payload = {}, { storageType } = {}) {
  const { data } = await rvRequest({method: 'POST',
    url: `/api/photoAlbums/notebooks/${notebookId}/notes`,
    data: payload, storageType });
  return data?.note;
}

export async function updatePhotoAlbumsNote(noteId, payload = {}, { storageType } = {}) {
  const { data } = await rvRequest({method: 'PATCH',
    url: `/api/photoAlbums/notes/${noteId}`,
    data: payload, storageType });
  return data?.note;
}

export async function uploadPhotoAlbumsNoteExtraImage(noteId, payload = {}, { storageType } = {}) {
  const { data } = await rvRequest({method: 'POST',
    url: `/api/photoAlbums/notes/${noteId}/extra-images`,
    data: payload, storageType });
  return data?.note;
}

export async function deletePhotoAlbumsNoteExtraImage(noteId, imageId, { storageType } = {}) {
  const { data } = await rvRequest({method: 'DELETE',
    url: `/api/photoAlbums/notes/${noteId}/extra-images/${imageId}`, storageType });
  return data?.note;
}

export async function movePhotoAlbumsNoteImage({ fromNoteId, fromSlot, toNoteId, toSlot }, { storageType } = {}) {
  const { data } = await rvRequest({method: 'POST',
    url: '/api/photoAlbums/notes/move-image',
    data: {
      from_note_id: fromNoteId,
      from_slot: fromSlot,
      to_note_id: toNoteId,
      to_slot: toSlot
    }, storageType });
  return data;
}

export async function movePhotoAlbumsNote(noteId, notebookId, { storageType } = {}) {
  return updatePhotoAlbumsNote(noteId, { notebook_id: notebookId }, { storageType });
}

export async function deletePhotoAlbumsNote(noteId, { storageType } = {}) {
  const { data } = await rvRequest({method: 'DELETE', url: `/api/photoAlbums/notes/${noteId}`, storageType });
  return data;
}

export async function uploadPhotoAlbumsNoteAttachment(noteId, payload = {}, { storageType } = {}) {
  const { data } = await rvRequest({method: 'POST',
    url: `/api/photoAlbums/notes/${noteId}/attachments`,
    data: payload, storageType });
  return data?.attachment;
}

export async function deletePhotoAlbumsNoteAttachment(noteId, attachmentId, { storageType } = {}) {
  const { data } = await rvRequest({method: 'DELETE',
    url: `/api/photoAlbums/notes/${noteId}/attachments/${attachmentId}`, storageType });
  return data;
}

/** Mac only — write attachment to temp and `open` in Word/Excel (or default app). */
export async function openPhotoAlbumsNoteAttachmentNative(noteId, attachmentId) {
  const note = Number(noteId);
  const attachment = Number(attachmentId);
  if (!Number.isFinite(note) || note < 1 || !Number.isFinite(attachment) || attachment < 1) {
    throw new Error('Invalid note or attachment id');
  }
  const { data } = await rvRequest({method: 'POST',
    url: `/api/photoAlbums/notes/${note}/attachments/${attachment}/open-native`, storageType });
  return data;
}

export function isPhotoAlbumsNativeOpenUnsupportedError(err) {
  return err?.response?.status === 501 && err?.response?.data?.code === 'NATIVE_OPEN_UNSUPPORTED';
}

export async function searchPhotoAlbumsNotes(query, { storageType } = {}) {
  const q1 = String(query?.q1 ?? query?.q ?? '').trim();
  const q2 = String(query?.q2 ?? '').trim();
  const q3 = String(query?.q3 ?? '').trim();
  const op1 = query?.op1 === 'or' ? 'or' : 'and';
  const op2 = query?.op2 === 'or' ? 'or' : 'and';
  const { data } = await rvRequest({method: 'GET',
    url: '/api/photoAlbums/search',
    params: { q1, q2, q3, op1, op2 }, storageType });
  return Array.isArray(data?.results) ? data.results : [];
}

export async function fetchPhotoAlbumsUsbStatus() {
  const { data } = await rvRequest({
    method: 'GET',
    url: '/api/photoAlbums/usb/status',
    storageType: 'usb'
  });
  return {
    usbMode: Boolean(data?.usbMode),
    cacheUsbIcon: data?.cacheUsbIcon ? String(data.cacheUsbIcon).trim() : '',
    session: data?.session || { unlocked: false }
  };
}

export async function scanPhotoAlbumsUsb() {
  const { data } = await rvRequest({ method: 'GET', url: '/api/photoAlbums/usb/scan' });
  return {
    detected: Array.isArray(data?.detected) ? data.detected : [],
    session: data?.session || { unlocked: false }
  };
}

export async function fetchPhotoAlbumsUsbLocations() {
  const { data } = await rvRequestWithLegacyUsbBridgeFallback(
    '/api/photoAlbums/usb/locations',
    '/api/recordVault/usb/locations'
  );
  return Array.isArray(data?.locations) ? data.locations : [];
}

export async function browsePhotoAlbumsUsbPath(folderPath) {
  const { data } = await rvRequest({
    method: 'GET',
    url: '/api/photoAlbums/usb/browse',
    params: { path: folderPath }
  });
  return data;
}

export async function fetchPhotoAlbumsUsbUnlockGuard(mountPath) {
  const { data } = await rvRequestWithLegacyUsbBridgeFallback(
    '/api/photoAlbums/usb/unlock-guard',
    '/api/recordVault/usb/unlock-guard',
    { params: { mountPath } }
  );
  return data;
}

async function fetchPhotoAlbumsUsbEnvDerivedKey(opts = {}) {
  const { data } = await api.post('/api/photoAlbums/usb/icon-derived-key', {
    forInit: Boolean(opts.forInit),
    kdfSalt: opts.kdfSalt || undefined
  });
  return data;
}

export async function unlockPhotoAlbumsUsb({ mountPath, backupMountPath = null }) {
  // If a local bridge is reachable, USB session MUST live there (CRUD routes through bridge).
  // Unlocking on the main API while an old bridge answers /api/photoAlbums* with 404 causes
  // "Cannot GET /api/photoAlbums" in the workspace.
  await probePhotoAlbumsBridge();
  const bridgeReachable = isPhotoAlbumsBridgeAvailable() || isPhotoAlbumsBridgeHostContext();
  if (bridgeReachable) {
    if (!isPhotoAlbumsBridgeActive()) {
      throw new Error(
        'USB Bridge is connected but the page session is not ready. Refresh and try Open TutaPhotoAlbums USB again.'
      );
    }
    let kdfSalt;
    try {
      const guard = await fetchPhotoAlbumsUsbUnlockGuard(mountPath);
      kdfSalt = guard?.kdfSalt || undefined;
    } catch (err) {
      if (isPhotoAlbumsBridgeRouteMissingError(err)) throwPhotoAlbumsOutdatedBridgeError(err);
      kdfSalt = undefined;
    }
    const derived = await fetchPhotoAlbumsUsbEnvDerivedKey({ kdfSalt });
    try {
      const { data } = await bridgeRequest({
        method: 'POST',
        url: '/api/photoAlbums/usb/unlock',
        storageType: 'usb',
        data: {
          mountPath,
          keyB64: derived?.keyB64,
          backupMountPath: backupMountPath || undefined
        }
      });
      sessionTreeCounted.usb = false;
      void reportPhotoAlbumsSessionFileCounts({
        reset: true,
        usbDelta: Number(data?.session?.sessionOpenItemCount ?? data?.sessionOpenItemCount) || 0
      });
      return data;
    } catch (err) {
      if (isPhotoAlbumsBridgeRouteMissingError(err)) throwPhotoAlbumsOutdatedBridgeError(err);
      throw err;
    }
  }
  const { data } = await api.post('/api/photoAlbums/usb/unlock', {
    mountPath,
    backupMountPath: backupMountPath || undefined
  });
  sessionTreeCounted.usb = false;
  return data;
}

export async function initPhotoAlbumsUsb({ mountPath, backupMountPath = null }) {
  await probePhotoAlbumsBridge();
  const bridgeReachable = isPhotoAlbumsBridgeAvailable() || isPhotoAlbumsBridgeHostContext();
  if (bridgeReachable) {
    if (!isPhotoAlbumsBridgeActive()) {
      throw new Error(
        'USB Bridge is connected but the page session is not ready. Refresh and try Open TutaPhotoAlbums USB again.'
      );
    }
    const derived = await fetchPhotoAlbumsUsbEnvDerivedKey({ forInit: true });
    try {
      const { data } = await bridgeRequest({
        method: 'POST',
        url: '/api/photoAlbums/usb/init',
        storageType: 'usb',
        data: {
          mountPath,
          keyB64: derived?.keyB64,
          kdf: derived?.kdf,
          kdfSalt: derived?.kdfSalt,
          kdfMemory: derived?.kdfMemory,
          kdfIterations: derived?.kdfIterations,
          kdfParallelism: derived?.kdfParallelism,
          backupMountPath: backupMountPath || undefined
        }
      });
      sessionTreeCounted.usb = false;
      void reportPhotoAlbumsSessionFileCounts({ reset: true });
      return data;
    } catch (err) {
      if (isPhotoAlbumsBridgeRouteMissingError(err)) throwPhotoAlbumsOutdatedBridgeError(err);
      throw err;
    }
  }
  const { data } = await api.post('/api/photoAlbums/usb/init', {
    mountPath,
    backupMountPath: backupMountPath || undefined
  });
  sessionTreeCounted.usb = false;
  return data;
}

export async function formatPhotoAlbumsUsb(mountPath) {
  const { data } = await rvRequest({
    method: 'POST',
    url: '/api/photoAlbums/usb/format',
    storageType: 'usb',
    data: mountPath ? { mountPath } : {}
  });
  return data;
}

export async function logoffPhotoAlbumsUsb() {
  const { data } = await rvRequest({ method: 'POST', url: '/api/photoAlbums/usb/logoff' });
  return data;
}

export async function fetchPhotoAlbumsStorageConfig() {
  const { data } = await api.get('/api/photoAlbums/storage/config');
  const mapChoice = (choice) => ({
    visible: choice?.visible === true,
    oauthConfigured: Boolean(choice?.oauthConfigured),
    enabled: Boolean(choice?.enabled),
    tutaDrive: Boolean(choice?.tutaDrive)
  });
  return {
    leftSide: data?.leftSide != null ? String(data.leftSide) : undefined,
    tutaDrive: Boolean(data?.tutaDrive),
    rightSide: data?.rightSide != null ? String(data.rightSide) : undefined,
    oneDrive: mapChoice(data?.oneDrive),
    localUsb: mapChoice(data?.localUsb),
    backupUsbEnabled: data?.backupUsbEnabled !== false,
    iconEncryptionRequired: data?.iconEncryptionRequired !== false,
    iconRetryDelaySeconds: Number(data?.iconRetryDelaySeconds) || 300,
    cacheOneDriveIcon: data?.cacheOneDriveIcon ? String(data.cacheOneDriveIcon).trim() : '',
    cacheUsbIcon: data?.cacheUsbIcon ? String(data.cacheUsbIcon).trim() : '',
    videoTutorialTutaphotoalbums: data?.videoTutorialTutaphotoalbums ? String(data.videoTutorialTutaphotoalbums).trim() : '',
    usbBridgeInstallers: {
      mac: normalizeUsbBridgeInstallerUrl(data?.usbBridgeInstallers?.mac, 'mac'),
      win: normalizeUsbBridgeInstallerUrl(data?.usbBridgeInstallers?.win, 'win')
    }
  };
}

export async function fetchPhotoAlbumsTutaDriveStatus() {
  const { data } = await api.get('/api/photoAlbums/tutadrive/status');
  return data;
}

export async function unlockPhotoAlbumsTutaDrive() {
  const { data } = await api.post('/api/photoAlbums/tutadrive/unlock');
  return data;
}

export async function formatPhotoAlbumsTutaDrive() {
  const { data } = await api.post('/api/photoAlbums/tutadrive/format');
  return data;
}

export async function initPhotoAlbumsTutaDrive() {
  const { data } = await api.post('/api/photoAlbums/tutadrive/init');
  return data;
}

export async function logoffPhotoAlbumsTutaDrive() {
  const { data } = await api.post('/api/photoAlbums/tutadrive/logoff');
  return data;
}

/** Download USB Bridge installer via API (reads USB_DMG_EXE on server). */
export async function downloadUsbBridgeInstaller(platform = 'mac') {
  const apiPath =
    platform === 'win' ? USB_BRIDGE_INSTALLER_API.win : USB_BRIDGE_INSTALLER_API.mac;
  try {
    const response = await api.get(apiPath, { responseType: 'blob' });
    const blob = response.data;
    const defaultName = platform === 'win' ? 'usbBridgeV3-win.zip' : 'usbBridgeV3-mac.zip';
    let filename = defaultName;
    const disposition = String(response.headers?.['content-disposition'] || '');
    const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
    if (match?.[1]) {
      try {
        filename = decodeURIComponent(match[1].replace(/"/g, ''));
      } catch {
        filename = match[1].replace(/"/g, '');
      }
    }
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(objectUrl);
  } catch (err) {
    const data = err?.response?.data;
    if (data instanceof Blob) {
      const text = await data.text();
      try {
        const parsed = JSON.parse(text);
        if (parsed?.error) throw new Error(String(parsed.error));
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message && parseErr.message !== text) {
          throw parseErr;
        }
      }
      if (text.trim()) throw new Error(text.trim());
    }
    throw err;
  }
}

export async function fetchPhotoAlbumsOneDriveConfig() {
  const { data } = await api.get('/api/photoAlbums/onedrive/config');
  return {
    visible: data?.visible === true,
    enabled: Boolean(data?.enabled),
    oauthConfigured: Boolean(data?.oauthConfigured),
    folderName: data?.folderName ? String(data.folderName) : 'onlinemallwebsitevault'
  };
}

export async function fetchPhotoAlbumsOneDriveVaultTree() {
  const { data } = await api.get('/api/photoAlbums/onedrive/vault-tree');
  return {
    folderName: data?.folderName ? String(data.folderName) : '',
    tree: data?.tree && typeof data.tree === 'object' ? data.tree : null
  };
}

export async function fetchPhotoAlbumsUsbVaultTree() {
  const { data } = await rvRequest({
    method: 'GET',
    url: '/api/photoAlbums/usb/vault-tree',
    storageType: 'usb'
  });
  return {
    path: data?.path ? String(data.path) : '',
    label: data?.label ? String(data.label) : '',
    tree: data?.tree && typeof data.tree === 'object' ? data.tree : null,
    entries: Array.isArray(data?.entries) ? data.entries : []
  };
}

export async function fetchPhotoAlbumsOneDriveStatus() {
  const { data } = await api.get('/api/photoAlbums/onedrive/status');
  return {
    enabled: Boolean(data?.enabled),
    cacheIcon: data?.cacheOneDriveIcon
      ? String(data.cacheOneDriveIcon).trim()
      : data?.cacheIcon
        ? String(data.cacheIcon).trim()
        : '',
    cacheOneDriveIcon: data?.cacheOneDriveIcon
      ? String(data.cacheOneDriveIcon).trim()
      : data?.cacheIcon
        ? String(data.cacheIcon).trim()
        : '',
    onedrive: {
      connected: Boolean(data?.onedrive?.connected),
      email: data?.onedrive?.email ? String(data.onedrive.email) : null,
      hasVault: Boolean(data?.onedrive?.hasVault),
      legacyPinVault: Boolean(data?.onedrive?.legacyPinVault),
      needsReformat: Boolean(data?.onedrive?.needsReformat),
      vaultFilesystemInvalid: Boolean(data?.onedrive?.vaultFilesystemInvalid),
      folderId: data?.onedrive?.folderId ? String(data.onedrive.folderId) : null
    },
    session: data?.session || { unlocked: false }
  };
}

export async function fetchPhotoAlbumsOneDriveEmails() {
  const { data } = await api.get('/api/photoAlbums/onedrive/emails');
  return Array.isArray(data?.emails) ? data.emails.map((email) => String(email).trim()).filter(Boolean) : [];
}

export async function rememberPhotoAlbumsOneDriveEmail(email) {
  const { data } = await api.post('/api/photoAlbums/onedrive/emails', { email: String(email || '').trim() });
  return {
    success: Boolean(data?.success),
    emails: Array.isArray(data?.emails) ? data.emails : [],
    added: Boolean(data?.added)
  };
}

export async function disconnectPhotoAlbumsOneDrive() {
  const { data } = await api.post('/api/photoAlbums/onedrive/disconnect');
  return data;
}

export async function fetchPhotoAlbumsOneDriveUnlockGuard() {
  const { data } = await api.get('/api/photoAlbums/onedrive/unlock-guard');
  return data;
}

/** Poll Redis-backed open percent while Cloud unlock POST runs. */
export async function fetchPhotoAlbumsOneDriveOpenProgress() {
  const { data } = await api.get('/api/photoAlbums/onedrive/open-progress');
  return {
    percent: Math.max(0, Math.min(100, Math.round(Number(data?.percent) || 0))),
    label: data?.label ? String(data.label) : ''
  };
}

/**
 * Unlock OneDrive vault. Pass onProgress for honest 0–100% via short polling
 * (same cluster-safe pattern as logoff).
 */
export async function unlockPhotoAlbumsOneDrive({ onProgress } = {}) {
  if (typeof onProgress !== 'function') {
    const { data } = await api.post('/api/photoAlbums/onedrive/unlock');
    return data;
  }
  onProgress({ percent: 0, label: 'Opening TutaPhotoAlbums Cloud' });
  let stopped = false;
  const poll = window.setInterval(() => {
    if (stopped) return;
    void fetchPhotoAlbumsOneDriveOpenProgress()
      .then((progress) => {
        if (stopped) return;
        onProgress(progress);
      })
      .catch(() => {
        // Ignore poll blips; unlock POST is the source of truth.
      });
  }, 250);
  try {
    const { data } = await api.post('/api/photoAlbums/onedrive/unlock');
    onProgress({ percent: 100, label: 'Done' });
    return data;
  } finally {
    stopped = true;
    window.clearInterval(poll);
  }
}

export async function initPhotoAlbumsOneDrive() {
  const { data } = await api.post('/api/photoAlbums/onedrive/init');
  return data;
}

export async function logoffPhotoAlbumsOneDrive() {
  const { data } = await api.post('/api/photoAlbums/onedrive/logoff');
  return data;
}

/** Poll Redis-backed sync percent while Cloud sync POST runs (PIN lock / mid-session flush). */
export async function fetchPhotoAlbumsOneDriveSyncProgress() {
  const { data } = await api.get('/api/photoAlbums/onedrive/sync-progress');
  return {
    percent: Math.max(0, Math.min(100, Math.round(Number(data?.percent) || 0))),
    label: data?.label ? String(data.label) : ''
  };
}

/** Await OneDrive vault.db upload without logging off (after PIN encrypt). */
export async function syncPhotoAlbumsOneDrive({ onProgress } = {}) {
  if (typeof onProgress !== 'function') {
    const { data } = await api.post('/api/photoAlbums/onedrive/sync');
    return data;
  }
  onProgress({ percent: 0, label: 'Saving to Cloud…' });
  let stopped = false;
  const poll = window.setInterval(() => {
    if (stopped) return;
    void fetchPhotoAlbumsOneDriveSyncProgress()
      .then((progress) => {
        if (stopped) return;
        onProgress(progress);
      })
      .catch(() => {
        // Ignore poll blips; sync POST is the source of truth.
      });
  }, 250);
  try {
    const { data } = await api.post('/api/photoAlbums/onedrive/sync');
    onProgress({ percent: 100, label: 'Done' });
    return data;
  } finally {
    stopped = true;
    window.clearInterval(poll);
  }
}

export async function formatPhotoAlbumsOneDrive() {
  const { data } = await api.post('/api/photoAlbums/onedrive/format');
  return data;
}

export async function testWritePhotoAlbumsOneDrive() {
  rvCloudLog('OneDrive', 'FE test-write request start', { url: '/api/photoAlbums/onedrive/test-write' });
  try {
    const { data } = await api.post('/api/photoAlbums/onedrive/test-write');
    rvCloudLog('OneDrive', 'FE test-write response ok', data);
    return data;
  } catch (err) {
    rvCloudAxiosError('OneDrive', 'FE test-write request failed', err);
    throw err;
  }
}

function parseContentDispositionFilename(headerValue) {
  const raw = String(headerValue || '').trim();
  if (!raw) return '';
  const utf8Match = raw.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].replace(/["']/g, ''));
    } catch {
      return utf8Match[1].replace(/["']/g, '');
    }
  }
  const plainMatch = raw.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1]?.trim() || '';
}

/** Match BE `buildMyPhotoAlbumsBackupZipFileName` — MyPhotoAlbums_USB_2026-07-11_05-30-00_PM_EDT.zip */
function buildMyPhotoAlbumsBackupZipFileNameClient(kind = 'usb', date = new Date()) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  let hours = date.getHours();
  const tt = hours >= 12 ? 'PM' : 'AM';
  hours %= 12;
  if (hours === 0) hours = 12;
  const hh = String(hours).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  let tz = 'Local';
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(date);
    const rawTz = parts.find((part) => part.type === 'timeZoneName')?.value || '';
    tz = String(rawTz).replace(/[^A-Za-z0-9_+-]/g, '') || 'Local';
  } catch {
    // keep Local
  }
  const prefix = kind === 'usb' ? 'MyPhotoAlbums_USB' : 'MyPhotoAlbums_OneDrive';
  return `${prefix}_${y}-${mo}-${d}_${hh}-${mi}-${ss}_${tt}_${tz}.zip`;
}

function triggerBrowserBlobDownload(blob, fileName) {
  const name = String(fileName || 'download').trim() || 'download';
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Zip the entire OneDrive vault folder and save to the browser download folder. */
export async function downloadPhotoAlbumsOneDriveBackupZip() {
  try {
    const response = await api.get('/api/photoAlbums/onedrive/backup-zip', { responseType: 'blob' });
    const fileName =
      parseContentDispositionFilename(response.headers?.['content-disposition']) ||
      buildMyPhotoAlbumsBackupZipFileNameClient('onedrive');
    triggerBrowserBlobDownload(response.data, fileName);
    const sizeBytes = response.data?.size ?? 0;
    return { fileName, sizeBytes };
  } catch (err) {
    throw await normalizePhotoAlbumsBlobFetchError(err);
  }
}

/** Zip the unlocked USB `.recordvault` folder and save to the browser download folder. */
export async function downloadPhotoAlbumsUsbBackupZip() {
  try {
    if (isPhotoAlbumsBridgeActive()) {
      const { blob, fileName: headerName } = await bridgeFetchBlobDownload('/api/photoAlbums/usb/backup-zip');
      const fileName = headerName || buildMyPhotoAlbumsBackupZipFileNameClient('usb');
      triggerBrowserBlobDownload(blob, fileName);
      return { fileName, sizeBytes: blob?.size ?? 0 };
    }
    const response = await api.get('/api/photoAlbums/usb/backup-zip', {
      responseType: 'blob',
      headers: { 'X-Record-Vault-Storage': 'usb' }
    });
    const fileName =
      parseContentDispositionFilename(response.headers?.['content-disposition']) ||
      buildMyPhotoAlbumsBackupZipFileNameClient('usb');
    triggerBrowserBlobDownload(response.data, fileName);
    return { fileName, sizeBytes: response.data?.size ?? 0 };
  } catch (err) {
    throw await normalizePhotoAlbumsBlobFetchError(err);
  }
}

/** Upload a MyPhotoAlbums backup zip and restore files to OneDrive. */
export async function restorePhotoAlbumsOneDriveBackupZip(file) {
  if (!file) throw new Error('Choose a backup zip file first');
  const formData = new FormData();
  formData.append('backup', file);
  const { data } = await api.post('/api/photoAlbums/onedrive/restore-zip', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data;
}

/** Upload a MyPhotoAlbums backup zip and restore files onto the unlocked USB vault. */
export async function restorePhotoAlbumsUsbBackupZip(file) {
  if (!file) throw new Error('Choose a backup zip file first');
  const formData = new FormData();
  formData.append('backup', file);
  if (shouldRoutePhotoAlbumsThroughBridge('/api/photoAlbums/usb/restore-zip', 'usb')) {
    const { data } = await bridgeUploadFormData('/api/photoAlbums/usb/restore-zip', formData);
    return data;
  }
  const { data } = await api.post('/api/photoAlbums/usb/restore-zip', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'X-Record-Vault-Storage': 'usb'
    }
  });
  return data;
}

/** Poll Redis-backed logoff percent while Cloud/USB logoff POST runs. */
export async function fetchPhotoAlbumsOneDriveLogoffProgress() {
  const { data } = await api.get('/api/photoAlbums/onedrive/logoff-progress');
  return {
    percent: Math.max(0, Math.min(100, Math.round(Number(data?.percent) || 0))),
    label: data?.label ? String(data.label) : ''
  };
}

/**
 * Cloud or USB logoff with honest 0–100% via short polling (cluster-safe; no streaming).
 */
async function logoffPhotoAlbumsStorageWithProgress(storageType, onProgress) {
  const isOneDrive = storageType === 'onedrive';
  if (typeof onProgress === 'function') {
    onProgress({
      percent: 1,
      label: isOneDrive ? 'Saving notes to OneDrive…' : 'Logging off USB…'
    });
  }
  let stopped = false;
  const poll = window.setInterval(() => {
    if (stopped) return;
    void fetchPhotoAlbumsOneDriveLogoffProgress()
      .then((progress) => {
        if (stopped || typeof onProgress !== 'function') return;
        onProgress(progress);
      })
      .catch(() => {
        // Ignore poll blips; logoff POST is the source of truth for success/failure.
      });
  }, 250);
  try {
    const { data } = isOneDrive
      ? await api.post('/api/photoAlbums/onedrive/logoff')
      : await rvRequest({ method: 'POST', url: '/api/photoAlbums/usb/logoff', storageType: 'usb' });
    if (typeof onProgress === 'function') {
      onProgress({ percent: 100, label: 'Done' });
    }
    return data;
  } finally {
    stopped = true;
    window.clearInterval(poll);
  }
}

export async function logoffPhotoAlbumsStorage({ storageType, onProgress } = {}) {
  let data;
  if (storageType === 'onedrive') {
    if (typeof onProgress === 'function') {
      data = await logoffPhotoAlbumsStorageWithProgress('onedrive', onProgress);
    } else {
      ({ data } = await api.post('/api/photoAlbums/onedrive/logoff'));
    }
  } else if (storageType === 'usb') {
    if (typeof onProgress === 'function') {
      data = await logoffPhotoAlbumsStorageWithProgress('usb', onProgress);
    } else {
      ({ data } = await rvRequest({ method: 'POST', url: '/api/photoAlbums/usb/logoff', storageType: 'usb' }));
    }
  } else {
    ({ data } = await api.post('/api/photoAlbums/storage/logoff'));
  }
  // USB bridge has no Postgres — always freeze counts on the website after logoff.
  await snapshotPhotoAlbumsSessionFileCounts();
  return data;
}

/**
 * Exit to Mall / site logout: Log off USB + Cloud so dirty vault DB/media flush
 * before leaving the app (no-op when neither session is open).
 * Drives the site-wide hourglass with per-file / activity labels when present.
 */
export async function flushPhotoAlbumsSessionsOnLeave({ onProgress } = {}) {
  const {
    beginPhotoAlbumsLeaveBusy,
    updatePhotoAlbumsLeaveBusy,
    endPhotoAlbumsLeaveBusy
  } = await import('../utils/photoAlbumsLeaveBusyUi.js');
  const { runPhotoAlbumsLeavePrepare } = await import('../utils/photoAlbumsLeavePrepare.js');

  const report = ({ percent, label, title } = {}) => {
    updatePhotoAlbumsLeaveBusy({ percent, label, title });
    if (typeof onProgress === 'function') {
      try {
        onProgress({ percent, label, title });
      } catch {
        // ignore caller progress errors
      }
    }
  };

  beginPhotoAlbumsLeaveBusy({
    title: 'Saving vault',
    percent: 1,
    label: 'Locking templates…'
  });

  try {
    await runPhotoAlbumsLeavePrepare();
  } catch (err) {
    console.error('[flushPhotoAlbumsSessionsOnLeave] prepare', err?.message || err);
  }

  report({
    title: 'Saving vault',
    percent: 2,
    label: 'Logging off USB and Cloud…'
  });

  try {
    try {
      await logoffPhotoAlbumsStorage({
        storageType: 'usb',
        onProgress: ({ percent, label } = {}) => {
          const p = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
          report({
            title: 'Logging off USB',
            percent: Math.round(p * 0.35),
            label: label || 'Saving USB vault…'
          });
        }
      });
    } catch (err) {
      console.error('[flushPhotoAlbumsSessionsOnLeave] usb', err?.message || err);
      report({
        title: 'Logging off USB',
        percent: 35,
        label: 'USB logoff finished with errors — continuing…'
      });
    }

    try {
      await logoffPhotoAlbumsStorage({
        storageType: 'onedrive',
        onProgress: ({ percent, label } = {}) => {
          const p = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
          report({
            title: 'Saving to Cloud',
            percent: 35 + Math.round(p * 0.65),
            label: label || 'Saving notes to OneDrive…'
          });
        }
      });
    } catch (err) {
      console.error('[flushPhotoAlbumsSessionsOnLeave] onedrive', err?.message || err);
      report({
        title: 'Saving to Cloud',
        percent: 99,
        label: 'Cloud logoff finished with errors'
      });
    }

    report({ title: 'Saving vault', percent: 100, label: 'Done' });
    // Brief beat so "Done" is visible before navigation/logout tears down the page.
    await new Promise((resolve) => {
      window.setTimeout(resolve, 200);
    });
  } finally {
    endPhotoAlbumsLeaveBusy();
    try {
      setPhotoAlbumsBridgeStorageType(null);
    } catch {
      // ignore
    }
  }
}

/** Flush vault to OneDrive without logoff; USB is already on-disk (no-op). */
export async function syncPhotoAlbumsStorage({ storageType, onProgress } = {}) {
  if (storageType === 'onedrive') {
    return syncPhotoAlbumsOneDrive({ onProgress });
  }
  return { success: true, synced: false };
}

export async function fetchPhotoAlbumsActiveStorageDisplay() {
  const { data } = await api.get('/api/photoAlbums/usb/status');
  const session = data?.session || {};
  if (!session.unlocked) return '';

  const storageType = String(session.storageType || '').trim();
  const label = String(session.label || '').trim();

  if (storageType === 'onedrive') {
    const status = await fetchPhotoAlbumsOneDriveStatus();
    const email = String(status.onedrive?.email || '').trim();
    return email ? `Storage: OneDrive for ${email}` : 'Storage: OneDrive';
  }

  return label ? `Storage: ${label}` : 'Storage: USB';
}

export async function fetchPhotoAlbumsUsage({ storageType } = {}) {
  const { data } = await api.get('/api/photoAlbums/usage', {
    headers: storageType ? { 'X-Record-Vault-Storage': storageType } : undefined
  });
  return {
    storageType: data?.storageType ? String(data.storageType) : null,
    onedriveEmail: data?.onedriveEmail ? String(data.onedriveEmail) : null,
    vaultFolderMb: Number(data?.vaultFolderMb) || 0,
    tutaDrive: Boolean(data?.tutaDrive),
    tutaDriveStorage: data?.tutaDriveStorage
      ? {
          memberFolder: data.tutaDriveStorage.memberFolder
            ? String(data.tutaDriveStorage.memberFolder)
            : null,
          notesBytes: Number(data.tutaDriveStorage.notesBytes) || 0,
          photosBytes: Number(data.tutaDriveStorage.photosBytes) || 0,
          totalBytes: Number(data.tutaDriveStorage.totalBytes) || 0,
          usedGb: Number(data.tutaDriveStorage.usedGb) || 0
        }
      : null,
    subscriptionTier: data?.subscriptionTier ? String(data.subscriptionTier) : 'FREE',
    transfer: data?.transfer
      ? {
          usedMb: Number(data.transfer.usedMb) || 0,
          usedBytes: Number(data.transfer.usedBytes) || 0,
          limitMb: Number(data.transfer.limitMb) || 100,
          leftMb: Number(data.transfer.leftMb) || 0,
          leftPct: Number(data.transfer.leftPct) || 0,
          refillRemainMb: Number(data.transfer.refillRemainMb) || 0,
          refillRemainMbExact:
            data.transfer.refillRemainMbExact != null
              ? Number(data.transfer.refillRemainMbExact)
              : Number(data.transfer.refillRemainMb) || 0,
          refillRemainBytes: Number(data.transfer.refillRemainBytes) || 0,
          pendingTransferBytes: Number(data.transfer.pendingTransferBytes) || 0,
          refillBoughtMb: Number(data.transfer.refillBoughtMb) || 0,
          refillBlockMb: Number(data.transfer.refillBlockMb) || 10 * 1024,
          overageThrottled: Boolean(data.transfer.overageThrottled)
        }
      : null,
    sessionFileCounts: {
      usbTxRx: Number(data?.sessionFileCounts?.usbTxRx) || 0,
      uiTxRx: Number(data?.sessionFileCounts?.uiTxRx) || 0
    },
    onedriveStorage: data?.onedriveStorage
      ? {
          usedGb: Number(data.onedriveStorage.usedGb) || 0,
          totalGb: Number(data.onedriveStorage.totalGb) || 0,
          leftPct: Number(data.onedriveStorage.leftPct) || 0
        }
      : null
  };
}

export async function purchasePhotoAlbumsRefill(tokens) {
  const { data } = await api.post('/api/photoAlbums/refill', {
    tokens: Math.trunc(Number(tokens))
  });
  return data;
}

export const PHOTO_ALBUMS_STORAGE_NOT_UNLOCKED_MESSAGE = 'Record Vault storage not unlocked';

export function isPhotoAlbumsUsbRequiredError(err) {
  return err?.response?.status === 428 && err?.response?.data?.code === 'PHOTO_ALBUMS_USB_REQUIRED';
}

/** Vault session missing — show on Cloud/USB login, not in the workspace editor. */
export function isPhotoAlbumsStorageNotUnlockedError(err) {
  if (isPhotoAlbumsBridgeRouteMissingError(err)) return true;
  if (isPhotoAlbumsUsbRequiredError(err)) return true;
  if (err?.response?.status === 428) {
    const code = String(err?.response?.data?.code || '');
    if (/^PHOTO_ALBUMS_(USB|ACCESS)_REQUIRED$/i.test(code)) return true;
  }
  return /not unlocked/i.test(readPhotoAlbumsApiError(err, ''));
}

export function readPhotoAlbumsStorageNotUnlockedMessage(err) {
  if (isPhotoAlbumsBridgeRouteMissingError(err)) {
    return PHOTO_ALBUMS_OUTDATED_BRIDGE_MESSAGE;
  }
  const msg = readPhotoAlbumsApiError(err, '').trim();
  if (/not unlocked/i.test(msg)) return msg;
  return PHOTO_ALBUMS_STORAGE_NOT_UNLOCKED_MESSAGE;
}

/** Message for bounce-to-login after open/load failure (keep real FS errors like EACCES). */
export function readPhotoAlbumsOpenFailureMessage(err) {
  if (isPhotoAlbumsBridgeRouteMissingError(err)) {
    return PHOTO_ALBUMS_OUTDATED_BRIDGE_MESSAGE;
  }
  const msg = readPhotoAlbumsApiError(err, '').trim();
  if (msg) return msg;
  return PHOTO_ALBUMS_STORAGE_NOT_UNLOCKED_MESSAGE;
}

/** Fatal open/load errors — leave workspace and show on Cloud/USB login (not editor banner). */
export function isPhotoAlbumsVaultOpenFatalError(err) {
  if (isPhotoAlbumsStorageNotUnlockedError(err)) return true;
  if (isPhotoAlbumsBridgeRouteMissingError(err)) return true;
  const msg = readPhotoAlbumsApiError(err, '');
  return /EACCES|EPERM|EROFS|ENOENT|permission denied|Cannot create TutaPhotoAlbums|read-only|not a real USB|mkdir/i.test(
    msg
  );
}

export function isPhotoAlbumsAccessRequiredError(err) {
  return err?.response?.status === 428 && err?.response?.data?.code === 'PHOTO_ALBUMS_ACCESS_REQUIRED';
}

export async function fetchPhotoAlbumsAccessStatus() {
  const { data } = await api.get('/api/photoAlbums/access/status');
  return {
    enabled: Boolean(data?.enabled),
    configured: Boolean(data?.configured),
    unlocked: Boolean(data?.unlocked),
    hint: data?.hint ? String(data.hint) : null,
    // Env skip is ignored — always treat as false.
    skipPasswordCheck: false
  };
}

export async function verifyPhotoAlbumsAccess(password) {
  const { data } = await api.post('/api/photoAlbums/access/verify', { password });
  return data;
}

export async function setPhotoAlbumsAccessPassword({ password, confirmPassword, hint }) {
  const { data } = await api.post('/api/photoAlbums/access/set', { password, confirmPassword, hint });
  return data;
}

export async function logoffPhotoAlbumsAccess() {
  const { data } = await api.post('/api/photoAlbums/access/logoff');
  return data;
}

export async function setPhotoAlbumsAccessPasswordEnabled(enabled, { password, keepSessionUnlocked } = {}) {
  const body = { enabled: Boolean(enabled) };
  if (password) body.password = String(password);
  if (keepSessionUnlocked) body.keepSessionUnlocked = true;
  const { data } = await api.post('/api/photoAlbums/access/enabled', body);
  return {
    enabled: Boolean(data?.enabled),
    configured: Boolean(data?.configured),
    unlocked: Boolean(data?.unlocked),
    hint: data?.hint ? String(data.hint) : null
  };
}

export async function changePhotoAlbumsAccessPassword({ currentPassword, newPassword, confirmPassword, hint }) {
  const { data } = await api.post('/api/photoAlbums/access/change', {
    currentPassword,
    newPassword,
    confirmPassword,
    hint
  });
  return data;
}

export async function setPhotoAlbumsAccessPasswordHint(hint) {
  const { data } = await api.post('/api/photoAlbums/access/hint', { hint });
  return {
    enabled: Boolean(data?.enabled),
    configured: Boolean(data?.configured),
    unlocked: Boolean(data?.unlocked),
    hint: data?.hint ? String(data.hint) : null
  };
}

function mapVaultAccessFailStatus(data) {
  return {
    locked: Boolean(data?.locked),
    lockedUntil: data?.lockedUntil ? String(data.lockedUntil) : null,
    remainingSeconds: Math.max(0, Math.floor(Number(data?.remainingSeconds) || 0)),
    failedAttempts: Math.max(0, Math.floor(Number(data?.failedAttempts) || 0)),
    maxFailedAttempts: Math.max(1, Math.floor(Number(data?.maxFailedAttempts) || 5)),
    lockoutSeconds: Math.max(0, Math.floor(Number(data?.lockoutSeconds) || 120)),
    vaultFormatted: Boolean(data?.vaultFormatted),
    needsClientFormat: Boolean(data?.needsClientFormat),
    storageType: data?.storageType === 'usb' ? 'usb' : 'onedrive',
    mountPath: data?.mountPath ? String(data.mountPath) : null,
    error: data?.error ? String(data.error) : '',
    cooldownLabel: data?.cooldownLabel ? String(data.cooldownLabel) : ''
  };
}

/** Vault-password fail cooldown / 5-fail format status for the pending open side. */
export async function fetchPhotoAlbumsAccessFailStatus(storageType = 'onedrive') {
  const { data } = await api.get('/api/photoAlbums/access/fail-status', {
    params: { storageType: storageType === 'usb' ? 'usb' : 'onedrive' }
  });
  return mapVaultAccessFailStatus(data);
}

/**
 * Record a client-side vault-password verify failure (password never sent).
 * On 5th fail: OneDrive is formatted server-side; USB returns needsClientFormat.
 */
export async function recordPhotoAlbumsAccessFail({ storageType = 'onedrive', mountPath } = {}) {
  try {
    const { data } = await api.post('/api/photoAlbums/access/fail', {
      storageType: storageType === 'usb' ? 'usb' : 'onedrive',
      mountPath: mountPath || undefined
    });
    return mapVaultAccessFailStatus(data);
  } catch (err) {
    const data = err?.response?.data;
    if (data && (data.remainingSeconds != null || data.failedAttempts != null || data.error)) {
      return mapVaultAccessFailStatus(data);
    }
    throw err;
  }
}

export async function clearPhotoAlbumsAccessFail(storageType = 'onedrive') {
  const { data } = await api.post('/api/photoAlbums/access/fail/clear', {
    storageType: storageType === 'usb' ? 'usb' : 'onedrive'
  });
  return data;
}

/** Yellow E2E: fetch KDF + wrapped DEK only (no password on server). */
export async function fetchPhotoAlbumsE2eKeys() {
  const { data } = await api.get('/api/photoAlbums/e2e/keys');
  return {
    e2eYellow: data?.e2eYellow !== false,
    configured: Boolean(data?.configured),
    vault: data?.vault || null
  };
}

/** Yellow E2E: store client-generated salt + wrapped DEK (never the password). */
export async function savePhotoAlbumsE2eKeys(payload) {
  const { data } = await api.post('/api/photoAlbums/e2e/keys', payload);
  return data;
}

/** Yellow E2E: password change — new salt + re-wrapped DEK only. */
export async function updatePhotoAlbumsE2eKeys(payload) {
  const { data } = await api.put('/api/photoAlbums/e2e/keys', payload);
  return data;
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function createPhotoAlbumsPaneApi(storageType) {
  const type = storageType === 'onedrive' ? 'onedrive' : 'usb';
  const opts = { storageType: type };
  const rv = (config) => rvRequest({ ...config, storageType: type });
  return {
    fetchPhotoAlbumsTree: () => fetchPhotoAlbumsTree(opts),
    fetchPhotoAlbumsNote: async (noteId) => {
      const id = Number(noteId);
      if (!Number.isFinite(id) || id < 1) return null;
      const { data } = await rv({ method: 'GET', url: `/api/photoAlbums/notes/${id}` });
      return data?.note ?? null;
    },
    createPhotoAlbumsNotebook: (name) => createPhotoAlbumsNotebook(name, opts),
    updatePhotoAlbumsNotebook: (id, name) => updatePhotoAlbumsNotebook(id, name, opts),
    deletePhotoAlbumsNotebook: (id) => deletePhotoAlbumsNotebook(id, opts),
    reorderPhotoAlbumsNotebooks: (ids) => reorderPhotoAlbumsNotebooks(ids, opts),
    reorderPhotoAlbumsNotes: (notebookId, ids) => reorderPhotoAlbumsNotes(notebookId, ids, opts),
    createPhotoAlbumsShortcut: (payload) => createPhotoAlbumsShortcut(payload, opts),
    deletePhotoAlbumsShortcut: (id) => deletePhotoAlbumsShortcut(id, opts),
    reorderPhotoAlbumsShortcuts: (ids) => reorderPhotoAlbumsShortcuts(ids, opts),
    createPhotoAlbumsNote: (notebookId, payload) => createPhotoAlbumsNote(notebookId, payload, opts),
    updatePhotoAlbumsNote: (noteId, payload) => updatePhotoAlbumsNote(noteId, payload, opts),
    deletePhotoAlbumsNote: (id) => deletePhotoAlbumsNote(id, opts),
    uploadPhotoAlbumsNoteExtraImage: (noteId, payload) => uploadPhotoAlbumsNoteExtraImage(noteId, payload, opts),
    deletePhotoAlbumsNoteExtraImage: (noteId, imageId) => deletePhotoAlbumsNoteExtraImage(noteId, imageId, opts),
    movePhotoAlbumsNoteImage: (payload) => movePhotoAlbumsNoteImage(payload, opts),
    movePhotoAlbumsNote: (noteId, notebookId) => movePhotoAlbumsNote(noteId, notebookId, opts),
    uploadPhotoAlbumsNoteAttachment: (noteId, payload) => uploadPhotoAlbumsNoteAttachment(noteId, payload, opts),
    deletePhotoAlbumsNoteAttachment: (noteId, attachmentId) =>
      deletePhotoAlbumsNoteAttachment(noteId, attachmentId, opts),
    searchPhotoAlbumsNotes: (query) => searchPhotoAlbumsNotes(query, opts),
    fetchPhotoAlbumsUsage: () => fetchPhotoAlbumsUsage(opts),
    logoffPhotoAlbumsStorage: (extra = {}) => logoffPhotoAlbumsStorage({ ...opts, ...extra }),
    syncPhotoAlbumsStorage: (extra = {}) => syncPhotoAlbumsStorage({ ...opts, ...extra })
  };
}

export {
  probePhotoAlbumsBridge,
  isPhotoAlbumsBridgeActive,
  isPhotoAlbumsBridgeAvailable,
  setPhotoAlbumsBridgeSinglesId,
  setPhotoAlbumsBridgeStorageType,
  setPhotoAlbumsBridgeEnabled,
  getPhotoAlbumsBridgeBaseUrl
} from './photoAlbumsBridgeFe';
