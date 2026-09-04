import api from './axios';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import {
  normalizeUsbBridgeInstallerUrl,
  USB_BRIDGE_INSTALLER_API
} from 'utils/usbBridgeInstallerDownloadUrl';
import { rvCloudAxiosError, rvCloudLog } from 'utils/recordVaultCloudDebugLog';
import {
  bridgeFetchBlob,
  bridgeFetchBlobDownload,
  bridgeRequest,
  bridgeUploadFormData,
  getRecordVaultBridgeBaseUrl,
  isRecordVaultBridgeActive,
  setRecordVaultBridgeStorageType,
  shouldRouteRecordVaultThroughBridge
} from './recordVaultBridgeFe';

/** Prefer backend `{ error }` over axios/bridge generic status text. */
export function readRecordVaultApiError(err, fallback = 'Request failed') {
  const data = err?.response?.data;
  if (data?.code === 'STORAGE_PERMISSION') {
    return String(data?.error || 'Folder permission error. Please contact your admin');
  }
  if (typeof data === 'string' && data.trim()) {
    const raw = data.trim();
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.code === 'STORAGE_PERMISSION') {
        return String(parsed?.error || 'Folder permission error. Please contact your admin');
      }
      if (parsed?.error) return String(parsed.error);
    } catch {
      // plain text body
    }
    return raw;
  }
  if (data?.error) return String(data.error);
  const message = String(err?.message || '').trim();
  if (/permission denied|EACCES|EPERM|EROFS|Folder permission error/i.test(message)) {
    return 'Folder permission error. Please contact your admin';
  }
  if (message && !/^Request failed with status code \d+$/i.test(message)) return message;
  return fallback;
}

/** Main API only — used before bridge routing knows USB vs OneDrive. */
export async function fetchRecordVaultSessionStorageType() {
  try {
    const { data } = await api.get('/api/recordVault/onedrive/status');
    if (data?.session?.unlocked && String(data.session.storageType || '').toLowerCase() === 'onedrive') {
      return 'onedrive';
    }
  } catch {
    // ignore
  }
  try {
    const { data } = await api.get('/api/recordVault/usb/status');
    if (data?.session?.unlocked) {
      const storageType = String(data.session.storageType || 'usb').toLowerCase();
      return storageType === 'onedrive' ? 'onedrive' : 'usb';
    }
  } catch {
    // ignore
  }
  return null;
}

async function normalizeRecordVaultBlobFetchError(err) {
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
export async function reportRecordVaultSessionFileCounts({
  usbDelta = 0,
  uiDelta = 0,
  reset = false
} = {}) {
  try {
    const { data } = await api.post('/api/recordVault/session-file-counts', {
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

/** Login-gate Usb/ui counts (frozen at last logoff; website Postgres). */
export async function fetchRecordVaultSessionFileCounts() {
  const { data } = await api.get('/api/recordVault/session-file-counts', {
    params: { last: 1 }
  });
  return {
    usbTxRx: Number(data?.usbTxRx) || 0,
    uiTxRx: Number(data?.uiTxRx) || 0
  };
}

/** Copy running session counts → last-session snapshot (after USB bridge logoff). */
export async function snapshotRecordVaultSessionFileCounts() {
  try {
    const { data } = await api.post('/api/recordVault/session-file-counts', { snapshot: true });
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

export function resetRecordVaultSessionTreeCountFlags() {
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

  if (method === 'POST' && /\/api\/recordVault\/usb\/(unlock|init)/.test(url)) {
    sessionTreeCounted.usb = false;
    void reportRecordVaultSessionFileCounts({ reset: true });
    const openCount =
      Number(responseData?.session?.sessionOpenItemCount ?? responseData?.sessionOpenItemCount) || 0;
    if (openCount > 0) {
      void reportRecordVaultSessionFileCounts({ usbDelta: openCount });
    }
    return;
  }

  if (method === 'GET' && url === '/api/recordVault') {
    if (sessionTreeCounted[storageType]) return;
    sessionTreeCounted[storageType] = true;
    const n = countTreeNotebooksAndNotes(responseData);
    if (n > 0) {
      // Unlock already added usbDelta for notebooks+notes; tree is the UI hop only.
      // If unlock did not return open count (older bridge), include usb here once.
      void reportRecordVaultSessionFileCounts({ uiDelta: n });
    }
    return;
  }

  if (method === 'GET' && /\/api\/recordVault\/notes\/\d+$/.test(url)) {
    void reportRecordVaultSessionFileCounts({ uiDelta: 1 });
    return;
  }
  if (
    method === 'GET' &&
    (/\/api\/recordVault\/notes\/\d+\/image/.test(url) ||
      /\/api\/recordVault\/notes\/\d+\/extra-images\/\d+/.test(url) ||
      /\/api\/recordVault\/notes\/\d+\/attachments\/\d+/.test(url))
  ) {
    void reportRecordVaultSessionFileCounts({ uiDelta: 1 });
    return;
  }

  if (
    (method === 'POST' || method === 'PATCH') &&
    (/\/api\/recordVault\/notebooks/.test(url) || /\/api\/recordVault\/notes/.test(url))
  ) {
    void reportRecordVaultSessionFileCounts({
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
  const viaBridge = shouldRouteRecordVaultThroughBridge(nextConfig.url, storageType);
  const result = viaBridge ? await bridgeRequest(nextConfig) : await api(nextConfig);
  maybeReportBridgeSessionFileCounts(nextConfig, result?.data, viaBridge);
  return result;
}

function recordVaultMediaBaseUrl() {
  return isRecordVaultBridgeActive() ? getRecordVaultBridgeBaseUrl() : getApiBaseUrl();
}

export function recordVaultNoteImageUrl(noteId, slot = 'center') {
  const id = Number(noteId);
  if (!Number.isFinite(id) || id < 1) return '';
  const base = recordVaultMediaBaseUrl();
  if (slot === 'top') return `${base}/api/recordVault/notes/${id}/image/top`;
  if (slot === 'bottom') return `${base}/api/recordVault/notes/${id}/image/bottom`;
  return `${base}/api/recordVault/notes/${id}/image`;
}

export function recordVaultNoteExtraImageUrl(noteId, imageId) {
  const note = Number(noteId);
  const image = Number(imageId);
  if (!Number.isFinite(note) || note < 1 || !Number.isFinite(image) || image < 1) return '';
  return `${recordVaultMediaBaseUrl()}/api/recordVault/notes/${note}/extra-images/${image}`;
}

export function recordVaultNoteAttachmentUrl(noteId, attachmentId, { inline = false } = {}) {
  const note = Number(noteId);
  const attachment = Number(attachmentId);
  if (!Number.isFinite(note) || note < 1 || !Number.isFinite(attachment) || attachment < 1) return '';
  const base = `${recordVaultMediaBaseUrl()}/api/recordVault/notes/${note}/attachments/${attachment}`;
  return inline ? `${base}?inline=1` : base;
}

export async function fetchRecordVaultNoteAttachmentBlob(noteId, attachmentId, { inline = true, storageType = null } = {}) {
  const note = Number(noteId);
  const attachment = Number(attachmentId);
  if (!Number.isFinite(note) || note < 1 || !Number.isFinite(attachment) || attachment < 1) {
    throw new Error('Invalid note or attachment id');
  }

  const path = `/api/recordVault/notes/${note}/attachments/${attachment}`;
  const query = inline ? '?inline=1' : '';
  if (shouldRouteRecordVaultThroughBridge(path, storageType)) {
    const blob = await bridgeFetchBlob(`${path}${query}`);
    void reportRecordVaultSessionFileCounts({ uiDelta: 1 });
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
    throw await normalizeRecordVaultBlobFetchError(err);
  }
}

function recordVaultNoteImageApiPath(noteId, slot = 'center') {
  const id = Number(noteId);
  if (!Number.isFinite(id) || id < 1) return '';
  if (slot === 'top') return `/api/recordVault/notes/${id}/image/top`;
  if (slot === 'bottom') return `/api/recordVault/notes/${id}/image/bottom`;
  return `/api/recordVault/notes/${id}/image`;
}

/** Authenticated fetch — required for USB bridge (img src cannot send X-Record-Vault-Singles-Id). */
export async function fetchRecordVaultNoteImageBlob(noteId, slot = 'center', { cacheBust, storageType = null } = {}) {
  const path = recordVaultNoteImageApiPath(noteId, slot);
  if (!path) throw new Error('Invalid note id');
  const query =
    cacheBust != null && String(cacheBust).trim() !== ''
      ? `?v=${encodeURIComponent(String(cacheBust))}`
      : '';
  if (shouldRouteRecordVaultThroughBridge(path, storageType)) {
    const blob = await bridgeFetchBlob(`${path}${query}`);
    void reportRecordVaultSessionFileCounts({ uiDelta: 1 });
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
    throw await normalizeRecordVaultBlobFetchError(err);
  }
}

export async function fetchRecordVaultNoteExtraImageBlob(noteId, imageId, { cacheBust, storageType = null } = {}) {
  const note = Number(noteId);
  const image = Number(imageId);
  if (!Number.isFinite(note) || note < 1 || !Number.isFinite(image) || image < 1) {
    throw new Error('Invalid note or image id');
  }
  const path = `/api/recordVault/notes/${note}/extra-images/${image}`;
  const query =
    cacheBust != null && String(cacheBust).trim() !== ''
      ? `?v=${encodeURIComponent(String(cacheBust))}`
      : '';
  if (shouldRouteRecordVaultThroughBridge(path, storageType)) {
    const blob = await bridgeFetchBlob(`${path}${query}`);
    void reportRecordVaultSessionFileCounts({ uiDelta: 1 });
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
    throw await normalizeRecordVaultBlobFetchError(err);
  }
}

/** Fetch via authenticated API/bridge and save as a local file (one-click download). */
export async function downloadRecordVaultNoteAttachment(noteId, attachmentId, fileName, { storageType = null } = {}) {
  const blob = await fetchRecordVaultNoteAttachmentBlob(noteId, attachmentId, { inline: false, storageType });
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

export async function fetchRecordVaultTree({ storageType } = {}) {
  const { data } = await rvRequest({ method: 'GET', url: '/api/recordVault', storageType });
  return {
    notebooks: Array.isArray(data?.notebooks) ? data.notebooks : [],
    shortcuts: Array.isArray(data?.shortcuts) ? data.shortcuts : []
  };
}

/** Lazy load — full text, keywords, attachments, and extra images for one note. */
export async function fetchRecordVaultNote(noteId, { storageType } = {}) {
  const id = Number(noteId);
  if (!Number.isFinite(id) || id < 1) return null;
  const { data } = await rvRequest({method: 'GET', url: `/api/recordVault/notes/${id}`, storageType });
  return data?.note ?? null;
}

export async function createRecordVaultNotebook(notebookName, { storageType } = {}) {
  const { data } = await rvRequest({method: 'POST',
    url: '/api/recordVault/notebooks',
    data: { notebook_name: notebookName }, storageType });
  return data?.notebook;
}

export async function updateRecordVaultNotebook(notebookId, notebookName, { storageType } = {}) {
  const { data } = await rvRequest({method: 'PATCH',
    url: `/api/recordVault/notebooks/${notebookId}`,
    data: { notebook_name: notebookName }, storageType });
  return data?.notebook;
}

export async function deleteRecordVaultNotebook(notebookId, { storageType } = {}) {
  const { data } = await rvRequest({method: 'DELETE', url: `/api/recordVault/notebooks/${notebookId}`, storageType });
  return data;
}

export async function reorderRecordVaultNotebooks(notebookIds, { storageType } = {}) {
  const { data } = await rvRequest({method: 'PUT',
    url: '/api/recordVault/notebooks/reorder',
    data: { notebook_ids: notebookIds }, storageType });
  return data;
}

export async function reorderRecordVaultNotes(notebookId, noteIds, { storageType } = {}) {
  const { data } = await rvRequest({method: 'PUT',
    url: `/api/recordVault/notebooks/${notebookId}/notes/reorder`,
    data: { note_ids: noteIds }, storageType });
  return data;
}

export async function createRecordVaultShortcut(payload, { storageType } = {}) {
  const { data } = await rvRequest({ method: 'POST', url: '/api/recordVault/shortcuts', data: payload , storageType });
  return data?.shortcut;
}

export async function deleteRecordVaultShortcut(shortcutId, { storageType } = {}) {
  const { data } = await rvRequest({method: 'DELETE', url: `/api/recordVault/shortcuts/${shortcutId}`, storageType });
  return data;
}

export async function reorderRecordVaultShortcuts(shortcutIds, { storageType } = {}) {
  const { data } = await rvRequest({method: 'PUT',
    url: '/api/recordVault/shortcuts/reorder',
    data: { shortcut_ids: shortcutIds }, storageType });
  return data;
}

export async function createRecordVaultNote(notebookId, payload = {}, { storageType } = {}) {
  const { data } = await rvRequest({method: 'POST',
    url: `/api/recordVault/notebooks/${notebookId}/notes`,
    data: payload, storageType });
  return data?.note;
}

export async function updateRecordVaultNote(noteId, payload = {}, { storageType } = {}) {
  const { data } = await rvRequest({method: 'PATCH',
    url: `/api/recordVault/notes/${noteId}`,
    data: payload, storageType });
  return data?.note;
}

export async function uploadRecordVaultNoteExtraImage(noteId, payload = {}, { storageType } = {}) {
  const { data } = await rvRequest({method: 'POST',
    url: `/api/recordVault/notes/${noteId}/extra-images`,
    data: payload, storageType });
  return data?.note;
}

export async function deleteRecordVaultNoteExtraImage(noteId, imageId, { storageType } = {}) {
  const { data } = await rvRequest({method: 'DELETE',
    url: `/api/recordVault/notes/${noteId}/extra-images/${imageId}`, storageType });
  return data?.note;
}

export async function moveRecordVaultNoteImage({ fromNoteId, fromSlot, toNoteId, toSlot }, { storageType } = {}) {
  const { data } = await rvRequest({method: 'POST',
    url: '/api/recordVault/notes/move-image',
    data: {
      from_note_id: fromNoteId,
      from_slot: fromSlot,
      to_note_id: toNoteId,
      to_slot: toSlot
    }, storageType });
  return data;
}

export async function moveRecordVaultNote(noteId, notebookId, { storageType } = {}) {
  return updateRecordVaultNote(noteId, { notebook_id: notebookId }, { storageType });
}

export async function deleteRecordVaultNote(noteId, { storageType } = {}) {
  const { data } = await rvRequest({method: 'DELETE', url: `/api/recordVault/notes/${noteId}`, storageType });
  return data;
}

export async function uploadRecordVaultNoteAttachment(noteId, payload = {}, { storageType } = {}) {
  const { data } = await rvRequest({method: 'POST',
    url: `/api/recordVault/notes/${noteId}/attachments`,
    data: payload, storageType });
  return data?.attachment;
}

export async function deleteRecordVaultNoteAttachment(noteId, attachmentId, { storageType } = {}) {
  const { data } = await rvRequest({method: 'DELETE',
    url: `/api/recordVault/notes/${noteId}/attachments/${attachmentId}`, storageType });
  return data;
}

/** Mac only — write attachment to temp and `open` in Word/Excel (or default app). */
export async function openRecordVaultNoteAttachmentNative(noteId, attachmentId) {
  const note = Number(noteId);
  const attachment = Number(attachmentId);
  if (!Number.isFinite(note) || note < 1 || !Number.isFinite(attachment) || attachment < 1) {
    throw new Error('Invalid note or attachment id');
  }
  const { data } = await rvRequest({method: 'POST',
    url: `/api/recordVault/notes/${note}/attachments/${attachment}/open-native`, storageType });
  return data;
}

export function isRecordVaultNativeOpenUnsupportedError(err) {
  return err?.response?.status === 501 && err?.response?.data?.code === 'NATIVE_OPEN_UNSUPPORTED';
}

export async function searchRecordVaultNotes(query, { storageType } = {}) {
  const q1 = String(query?.q1 ?? query?.q ?? '').trim();
  const q2 = String(query?.q2 ?? '').trim();
  const q3 = String(query?.q3 ?? '').trim();
  const op1 = query?.op1 === 'or' ? 'or' : 'and';
  const op2 = query?.op2 === 'or' ? 'or' : 'and';
  const { data } = await rvRequest({method: 'GET',
    url: '/api/recordVault/search',
    params: { q1, q2, q3, op1, op2 }, storageType });
  return Array.isArray(data?.results) ? data.results : [];
}

export async function fetchRecordVaultUsbStatus() {
  const { data } = await rvRequest({
    method: 'GET',
    url: '/api/recordVault/usb/status',
    storageType: 'usb'
  });
  return {
    usbMode: Boolean(data?.usbMode),
    cacheUsbIcon: data?.cacheUsbIcon ? String(data.cacheUsbIcon).trim() : '',
    session: data?.session || { unlocked: false }
  };
}

export async function scanRecordVaultUsb() {
  const { data } = await rvRequest({ method: 'GET', url: '/api/recordVault/usb/scan' });
  return {
    detected: Array.isArray(data?.detected) ? data.detected : [],
    session: data?.session || { unlocked: false }
  };
}

export async function fetchRecordVaultUsbLocations() {
  const { data } = await rvRequest({ method: 'GET', url: '/api/recordVault/usb/locations' });
  return Array.isArray(data?.locations) ? data.locations : [];
}

export async function browseRecordVaultUsbPath(folderPath) {
  const { data } = await rvRequest({
    method: 'GET',
    url: '/api/recordVault/usb/browse',
    params: { path: folderPath }
  });
  return data;
}

export async function fetchRecordVaultUsbUnlockGuard(mountPath) {
  const { data } = await rvRequest({
    method: 'GET',
    url: '/api/recordVault/usb/unlock-guard',
    params: { mountPath }
  });
  return data;
}

async function fetchRecordVaultUsbEnvDerivedKey(opts = {}) {
  const { data } = await api.post('/api/recordVault/usb/icon-derived-key', {
    forInit: Boolean(opts.forInit),
    kdfSalt: opts.kdfSalt || undefined
  });
  return data;
}

export async function unlockRecordVaultUsb({ mountPath, backupMountPath = null }) {
  if (isRecordVaultBridgeActive()) {
    let kdfSalt;
    try {
      const guard = await fetchRecordVaultUsbUnlockGuard(mountPath);
      kdfSalt = guard?.kdfSalt || undefined;
    } catch {
      kdfSalt = undefined;
    }
    const derived = await fetchRecordVaultUsbEnvDerivedKey({ kdfSalt });
    const { data } = await bridgeRequest({
      method: 'POST',
      url: '/api/recordVault/usb/unlock',
      storageType: 'usb',
      data: {
        mountPath,
        keyB64: derived?.keyB64,
        backupMountPath: backupMountPath || undefined
      }
    });
    sessionTreeCounted.usb = false;
    void reportRecordVaultSessionFileCounts({
      reset: true,
      usbDelta: Number(data?.session?.sessionOpenItemCount ?? data?.sessionOpenItemCount) || 0
    });
    return data;
  }
  const { data } = await api.post('/api/recordVault/usb/unlock', {
    mountPath,
    backupMountPath: backupMountPath || undefined
  });
  sessionTreeCounted.usb = false;
  return data;
}

export async function initRecordVaultUsb({ mountPath, backupMountPath = null }) {
  if (isRecordVaultBridgeActive()) {
    const derived = await fetchRecordVaultUsbEnvDerivedKey({ forInit: true });
    const { data } = await bridgeRequest({
      method: 'POST',
      url: '/api/recordVault/usb/init',
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
    void reportRecordVaultSessionFileCounts({ reset: true });
    return data;
  }
  const { data } = await api.post('/api/recordVault/usb/init', {
    mountPath,
    backupMountPath: backupMountPath || undefined
  });
  sessionTreeCounted.usb = false;
  return data;
}

export async function formatRecordVaultUsb(mountPath) {
  const { data } = await rvRequest({
    method: 'POST',
    url: '/api/recordVault/usb/format',
    storageType: 'usb',
    data: mountPath ? { mountPath } : {}
  });
  return data;
}

export async function logoffRecordVaultUsb() {
  const { data } = await rvRequest({ method: 'POST', url: '/api/recordVault/usb/logoff' });
  return data;
}

export async function fetchRecordVaultStorageConfig() {
  const { data } = await api.get('/api/recordVault/storage/config');
  const mapChoice = (choice) => ({
    visible: choice?.visible === true,
    oauthConfigured: Boolean(choice?.oauthConfigured),
    enabled: Boolean(choice?.enabled)
  });
  return {
    leftSide: data?.leftSide != null ? String(data.leftSide) : '',
    tutaDrive: Boolean(data?.tutaDrive),
    oneDrive: mapChoice(data?.oneDrive),
    localUsb: mapChoice(data?.localUsb),
    backupUsbEnabled: data?.backupUsbEnabled !== false,
    iconEncryptionRequired: data?.iconEncryptionRequired !== false,
    iconRetryDelaySeconds: Number(data?.iconRetryDelaySeconds) || 300,
    cacheOneDriveIcon: data?.cacheOneDriveIcon ? String(data.cacheOneDriveIcon).trim() : '',
    cacheUsbIcon: data?.cacheUsbIcon ? String(data.cacheUsbIcon).trim() : '',
    videoTutorialTutanotes: data?.videoTutorialTutanotes ? String(data.videoTutorialTutanotes).trim() : '',
    usbBridgeInstallers: {
      mac: normalizeUsbBridgeInstallerUrl(data?.usbBridgeInstallers?.mac, 'mac'),
      win: normalizeUsbBridgeInstallerUrl(data?.usbBridgeInstallers?.win, 'win')
    }
  };
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

export async function fetchRecordVaultOneDriveConfig() {
  const { data } = await api.get('/api/recordVault/onedrive/config');
  return {
    visible: data?.visible === true,
    enabled: Boolean(data?.enabled),
    oauthConfigured: Boolean(data?.oauthConfigured),
    folderName: data?.folderName ? String(data.folderName) : 'onlinemallwebsitevault'
  };
}

export async function fetchRecordVaultOneDriveVaultTree() {
  const { data } = await api.get('/api/recordVault/onedrive/vault-tree');
  return {
    folderName: data?.folderName ? String(data.folderName) : '',
    tree: data?.tree && typeof data.tree === 'object' ? data.tree : null
  };
}

export async function fetchRecordVaultUsbVaultTree() {
  const { data } = await rvRequest({
    method: 'GET',
    url: '/api/recordVault/usb/vault-tree',
    storageType: 'usb'
  });
  return {
    path: data?.path ? String(data.path) : '',
    label: data?.label ? String(data.label) : '',
    tree: data?.tree && typeof data.tree === 'object' ? data.tree : null,
    entries: Array.isArray(data?.entries) ? data.entries : []
  };
}

export async function fetchRecordVaultOneDriveStatus() {
  const { data } = await api.get('/api/recordVault/onedrive/status');
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

export async function fetchRecordVaultOneDriveEmails() {
  const { data } = await api.get('/api/recordVault/onedrive/emails');
  return Array.isArray(data?.emails) ? data.emails.map((email) => String(email).trim()).filter(Boolean) : [];
}

export async function rememberRecordVaultOneDriveEmail(email) {
  const { data } = await api.post('/api/recordVault/onedrive/emails', { email: String(email || '').trim() });
  return {
    success: Boolean(data?.success),
    emails: Array.isArray(data?.emails) ? data.emails : [],
    added: Boolean(data?.added)
  };
}

export async function disconnectRecordVaultOneDrive() {
  const { data } = await api.post('/api/recordVault/onedrive/disconnect');
  return data;
}

export async function fetchRecordVaultOneDriveUnlockGuard() {
  const { data } = await api.get('/api/recordVault/onedrive/unlock-guard');
  return data;
}

/** Poll Redis-backed open percent while Cloud unlock POST runs. */
export async function fetchRecordVaultOneDriveOpenProgress() {
  const { data } = await api.get('/api/recordVault/onedrive/open-progress');
  return {
    percent: Math.max(0, Math.min(100, Math.round(Number(data?.percent) || 0))),
    label: data?.label ? String(data.label) : ''
  };
}

/**
 * Unlock OneDrive vault. Pass onProgress for honest 0–100% via short polling
 * (same cluster-safe pattern as logoff).
 */
export async function unlockRecordVaultOneDrive({ onProgress } = {}) {
  if (typeof onProgress !== 'function') {
    const { data } = await api.post('/api/recordVault/onedrive/unlock');
    return data;
  }
  onProgress({ percent: 0, label: 'Opening TutaNotes Cloud' });
  let stopped = false;
  const poll = window.setInterval(() => {
    if (stopped) return;
    void fetchRecordVaultOneDriveOpenProgress()
      .then((progress) => {
        if (stopped) return;
        onProgress(progress);
      })
      .catch(() => {
        // Ignore poll blips; unlock POST is the source of truth.
      });
  }, 250);
  try {
    const { data } = await api.post('/api/recordVault/onedrive/unlock');
    onProgress({ percent: 100, label: 'Done' });
    return data;
  } finally {
    stopped = true;
    window.clearInterval(poll);
  }
}

export async function fetchRecordVaultTutaDriveStatus() {
  const { data } = await api.get('/api/recordVault/tutadrive/status');
  return data;
}

export async function unlockRecordVaultTutaDrive() {
  const { data } = await api.post('/api/recordVault/tutadrive/unlock');
  return data;
}

export async function formatRecordVaultTutaDrive() {
  const { data } = await api.post('/api/recordVault/tutadrive/format');
  return data;
}

export async function initRecordVaultTutaDrive() {
  const { data } = await api.post('/api/recordVault/tutadrive/init');
  return data;
}

export async function logoffRecordVaultTutaDrive() {
  const { data } = await api.post('/api/recordVault/tutadrive/logoff');
  return data;
}

export async function initRecordVaultOneDrive() {
  const { data } = await api.post('/api/recordVault/onedrive/init');
  return data;
}

export async function logoffRecordVaultOneDrive() {
  const { data } = await api.post('/api/recordVault/onedrive/logoff');
  return data;
}

/** Poll Redis-backed sync percent while Cloud sync POST runs (PIN lock / mid-session flush). */
export async function fetchRecordVaultOneDriveSyncProgress() {
  const { data } = await api.get('/api/recordVault/onedrive/sync-progress');
  return {
    percent: Math.max(0, Math.min(100, Math.round(Number(data?.percent) || 0))),
    label: data?.label ? String(data.label) : ''
  };
}

/** Await OneDrive vault.db upload without logging off (after PIN encrypt). */
export async function syncRecordVaultOneDrive({ onProgress } = {}) {
  if (typeof onProgress !== 'function') {
    const { data } = await api.post('/api/recordVault/onedrive/sync');
    return data;
  }
  onProgress({ percent: 0, label: 'Saving to Cloud…' });
  let stopped = false;
  const poll = window.setInterval(() => {
    if (stopped) return;
    void fetchRecordVaultOneDriveSyncProgress()
      .then((progress) => {
        if (stopped) return;
        onProgress(progress);
      })
      .catch(() => {
        // Ignore poll blips; sync POST is the source of truth.
      });
  }, 250);
  try {
    const { data } = await api.post('/api/recordVault/onedrive/sync');
    onProgress({ percent: 100, label: 'Done' });
    return data;
  } finally {
    stopped = true;
    window.clearInterval(poll);
  }
}

export async function formatRecordVaultOneDrive() {
  const { data } = await api.post('/api/recordVault/onedrive/format');
  return data;
}

export async function testWriteRecordVaultOneDrive() {
  rvCloudLog('OneDrive', 'FE test-write request start', { url: '/api/recordVault/onedrive/test-write' });
  try {
    const { data } = await api.post('/api/recordVault/onedrive/test-write');
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

/** Match BE `buildMyNoteBackupZipFileName` — MyNote_USB_2026-07-11_05-30-00_PM_EDT.zip */
function buildMyNoteBackupZipFileNameClient(kind = 'usb', date = new Date()) {
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
  const prefix = kind === 'usb' ? 'MyNote_USB' : 'MyNote_OneDrive';
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
export async function downloadRecordVaultOneDriveBackupZip() {
  try {
    const response = await api.get('/api/recordVault/onedrive/backup-zip', { responseType: 'blob' });
    const fileName =
      parseContentDispositionFilename(response.headers?.['content-disposition']) ||
      buildMyNoteBackupZipFileNameClient('onedrive');
    triggerBrowserBlobDownload(response.data, fileName);
    const sizeBytes = response.data?.size ?? 0;
    return { fileName, sizeBytes };
  } catch (err) {
    throw await normalizeRecordVaultBlobFetchError(err);
  }
}

/**
 * TutaDrive backup: zip vault → seal with Encrypt Password DEK in-browser →
 * store as users/M{id}/backup_YYYY-MM-DD_HH-MM-SS.zip (keeps up to 3 backup_*).
 */
export async function createRecordVaultTutaDriveEncryptedBackup() {
  const { getRecordVaultE2eDek, isRecordVaultE2eUnlocked } = await import('utils/recordVaultClientSession');
  const { sealTutaDriveBackupZipWithDek } = await import('utils/recordVaultClientVaultCrypto');
  if (!isRecordVaultE2eUnlocked()) {
    throw new Error('Unlock with your Encrypt Password first, then run Backup again');
  }
  const dek = getRecordVaultE2eDek();
  const zipResponse = await api.get('/api/recordVault/tutadrive/backup-zip', { responseType: 'blob' });
  const zipBuf = new Uint8Array(await zipResponse.data.arrayBuffer());
  const sealed = await sealTutaDriveBackupZipWithDek(zipBuf, dek);
  const formData = new FormData();
  formData.append(
    'backup',
    new Blob([sealed], { type: 'application/octet-stream' }),
    'backup.zip'
  );
  const { data } = await api.post('/api/recordVault/tutadrive/backup', formData, {
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 0
  });
  return data;
}

export async function fetchRecordVaultTutaDriveBackupStatus() {
  const { data } = await api.get('/api/recordVault/tutadrive/backup/status');
  return data;
}

export async function deleteRecordVaultTutaDriveBackup(fileName) {
  const enc = encodeURIComponent(String(fileName || ''));
  const { data } = await api.delete(`/api/recordVault/tutadrive/backup/${enc}`);
  return data;
}

/** Download sealed backup, unseal with Encrypt Password DEK, restore vault on server. */
export async function restoreRecordVaultTutaDriveEncryptedBackup(file, fileName) {
  const { getRecordVaultE2eDek, isRecordVaultE2eUnlocked } = await import('utils/recordVaultClientSession');
  const { unsealTutaDriveBackupZipWithDek } = await import('utils/recordVaultClientVaultCrypto');
  if (!isRecordVaultE2eUnlocked()) {
    throw new Error('Unlock with your Encrypt Password first, then run Restore again');
  }
  const dek = getRecordVaultE2eDek();
  let sealedBytes;
  if (file) {
    sealedBytes = new Uint8Array(await file.arrayBuffer());
  } else {
    const q = fileName ? `?fileName=${encodeURIComponent(String(fileName))}` : '';
    const response = await api.get(`/api/recordVault/tutadrive/backup${q}`, { responseType: 'blob' });
    sealedBytes = new Uint8Array(await response.data.arrayBuffer());
  }
  const plainZip = await unsealTutaDriveBackupZipWithDek(sealedBytes, dek);
  const formData = new FormData();
  formData.append(
    'backup',
    new Blob([plainZip], { type: 'application/zip' }),
    'TutaNotes-restore.zip'
  );
  const { data } = await api.post('/api/recordVault/tutadrive/restore-zip', formData, {
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 0
  });
  return data;
}

/** Zip the unlocked USB `.recordvault` folder and save to the browser download folder. */
export async function downloadRecordVaultUsbBackupZip() {
  try {
    if (isRecordVaultBridgeActive()) {
      const { blob, fileName: headerName } = await bridgeFetchBlobDownload('/api/recordVault/usb/backup-zip');
      const fileName = headerName || buildMyNoteBackupZipFileNameClient('usb');
      triggerBrowserBlobDownload(blob, fileName);
      return { fileName, sizeBytes: blob?.size ?? 0 };
    }
    const response = await api.get('/api/recordVault/usb/backup-zip', {
      responseType: 'blob',
      headers: { 'X-Record-Vault-Storage': 'usb' }
    });
    const fileName =
      parseContentDispositionFilename(response.headers?.['content-disposition']) ||
      buildMyNoteBackupZipFileNameClient('usb');
    triggerBrowserBlobDownload(response.data, fileName);
    return { fileName, sizeBytes: response.data?.size ?? 0 };
  } catch (err) {
    throw await normalizeRecordVaultBlobFetchError(err);
  }
}

/** Upload a MyNote backup zip and restore files to OneDrive. */
export async function restoreRecordVaultOneDriveBackupZip(file) {
  if (!file) throw new Error('Choose a backup zip file first');
  const formData = new FormData();
  formData.append('backup', file);
  const { data } = await api.post('/api/recordVault/onedrive/restore-zip', formData);
  return data;
}

/** Upload a MyNote backup zip and restore files onto the unlocked USB vault. */
export async function restoreRecordVaultUsbBackupZip(file) {
  if (!file) throw new Error('Choose a backup zip file first');
  const formData = new FormData();
  formData.append('backup', file);
  if (shouldRouteRecordVaultThroughBridge('/api/recordVault/usb/restore-zip', 'usb')) {
    const { data } = await bridgeUploadFormData('/api/recordVault/usb/restore-zip', formData);
    return data;
  }
  const { data } = await api.post('/api/recordVault/usb/restore-zip', formData, {
    headers: {
      'X-Record-Vault-Storage': 'usb'
    }
  });
  return data;
}

/** Poll Redis-backed logoff percent while Cloud/USB logoff POST runs. */
export async function fetchRecordVaultOneDriveLogoffProgress() {
  const { data } = await api.get('/api/recordVault/onedrive/logoff-progress');
  return {
    percent: Math.max(0, Math.min(100, Math.round(Number(data?.percent) || 0))),
    label: data?.label ? String(data.label) : ''
  };
}

/**
 * Cloud or USB logoff with honest 0–100% via short polling (cluster-safe; no streaming).
 */
async function logoffRecordVaultStorageWithProgress(storageType, onProgress) {
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
    void fetchRecordVaultOneDriveLogoffProgress()
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
      ? await api.post('/api/recordVault/onedrive/logoff')
      : await rvRequest({ method: 'POST', url: '/api/recordVault/usb/logoff', storageType: 'usb' });
    if (typeof onProgress === 'function') {
      onProgress({ percent: 100, label: 'Done' });
    }
    return data;
  } finally {
    stopped = true;
    window.clearInterval(poll);
  }
}

export async function logoffRecordVaultStorage({ storageType, onProgress } = {}) {
  let data;
  if (storageType === 'onedrive') {
    if (typeof onProgress === 'function') {
      data = await logoffRecordVaultStorageWithProgress('onedrive', onProgress);
    } else {
      ({ data } = await api.post('/api/recordVault/onedrive/logoff'));
    }
  } else if (storageType === 'usb') {
    if (typeof onProgress === 'function') {
      data = await logoffRecordVaultStorageWithProgress('usb', onProgress);
    } else {
      ({ data } = await rvRequest({ method: 'POST', url: '/api/recordVault/usb/logoff', storageType: 'usb' }));
    }
  } else {
    ({ data } = await api.post('/api/recordVault/storage/logoff'));
  }
  // USB bridge has no Postgres — always freeze counts on the website after logoff.
  await snapshotRecordVaultSessionFileCounts();
  return data;
}

/**
 * Exit to Mall / site logout: Log off USB + Cloud so dirty vault DB/media flush
 * before leaving the app (no-op when neither session is open).
 * Drives the site-wide hourglass with per-file / activity labels when present.
 */
export async function flushRecordVaultSessionsOnLeave({ onProgress } = {}) {
  const {
    beginRecordVaultLeaveBusy,
    updateRecordVaultLeaveBusy,
    endRecordVaultLeaveBusy
  } = await import('../utils/recordVaultLeaveBusyUi.js');

  const report = ({ percent, label, title } = {}) => {
    updateRecordVaultLeaveBusy({ percent, label, title });
    if (typeof onProgress === 'function') {
      try {
        onProgress({ percent, label, title });
      } catch {
        // ignore caller progress errors
      }
    }
  };

  beginRecordVaultLeaveBusy({
    title: 'Saving vault',
    percent: 1,
    label: 'Logging off USB and Cloud…'
  });

  try {
    try {
      await logoffRecordVaultStorage({
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
      console.error('[flushRecordVaultSessionsOnLeave] usb', err?.message || err);
      report({
        title: 'Logging off USB',
        percent: 35,
        label: 'USB logoff finished with errors — continuing…'
      });
    }

    try {
      await logoffRecordVaultStorage({
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
      console.error('[flushRecordVaultSessionsOnLeave] onedrive', err?.message || err);
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
    endRecordVaultLeaveBusy();
    try {
      setRecordVaultBridgeStorageType(null);
    } catch {
      // ignore
    }
  }
}

/** Flush vault to OneDrive without logoff; USB is already on-disk (no-op). */
export async function syncRecordVaultStorage({ storageType, onProgress } = {}) {
  if (storageType === 'onedrive') {
    return syncRecordVaultOneDrive({ onProgress });
  }
  return { success: true, synced: false };
}

export async function fetchRecordVaultActiveStorageDisplay() {
  const { data } = await api.get('/api/recordVault/usb/status');
  const session = data?.session || {};
  if (!session.unlocked) return '';

  const storageType = String(session.storageType || '').trim();
  const label = String(session.label || '').trim();

  if (storageType === 'onedrive') {
    const status = await fetchRecordVaultOneDriveStatus();
    const email = String(status.onedrive?.email || '').trim();
    return email ? `Storage: OneDrive for ${email}` : 'Storage: OneDrive';
  }

  return label ? `Storage: ${label}` : 'Storage: USB';
}

export async function fetchRecordVaultUsage({ storageType } = {}) {
  const { data } = await api.get('/api/recordVault/usage', {
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
          limitMb: Number(data.transfer.limitMb) || 100,
          leftMb: Number(data.transfer.leftMb) || 0,
          leftPct: Number(data.transfer.leftPct) || 0,
          refillRemainMb: Number(data.transfer.refillRemainMb) || 0,
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

export async function purchaseRecordVaultRefill(tokens) {
  const { data } = await api.post('/api/recordVault/refill', {
    tokens: Math.trunc(Number(tokens))
  });
  return data;
}

export function isRecordVaultUsbRequiredError(err) {
  return err?.response?.status === 428 && err?.response?.data?.code === 'RECORD_VAULT_USB_REQUIRED';
}

export function isRecordVaultAccessRequiredError(err) {
  return err?.response?.status === 428 && err?.response?.data?.code === 'RECORD_VAULT_ACCESS_REQUIRED';
}

export async function fetchRecordVaultAccessStatus() {
  const { data } = await api.get('/api/recordVault/access/status');
  return {
    enabled: Boolean(data?.enabled),
    configured: Boolean(data?.configured),
    unlocked: Boolean(data?.unlocked),
    hint: data?.hint ? String(data.hint) : null,
    // Env skip is ignored — always treat as false.
    skipPasswordCheck: false
  };
}

export async function verifyRecordVaultAccess(password) {
  const { data } = await api.post('/api/recordVault/access/verify', { password });
  return data;
}

export async function setRecordVaultAccessPassword({ password, confirmPassword, hint }) {
  const { data } = await api.post('/api/recordVault/access/set', { password, confirmPassword, hint });
  return data;
}

export async function logoffRecordVaultAccess() {
  const { data } = await api.post('/api/recordVault/access/logoff');
  return data;
}

export async function setRecordVaultAccessPasswordEnabled(enabled, { password, keepSessionUnlocked } = {}) {
  const body = { enabled: Boolean(enabled) };
  if (password) body.password = String(password);
  if (keepSessionUnlocked) body.keepSessionUnlocked = true;
  const { data } = await api.post('/api/recordVault/access/enabled', body);
  return {
    enabled: Boolean(data?.enabled),
    configured: Boolean(data?.configured),
    unlocked: Boolean(data?.unlocked),
    hint: data?.hint ? String(data.hint) : null
  };
}

export async function changeRecordVaultAccessPassword({ currentPassword, newPassword, confirmPassword, hint }) {
  const { data } = await api.post('/api/recordVault/access/change', {
    currentPassword,
    newPassword,
    confirmPassword,
    hint
  });
  return data;
}

export async function setRecordVaultAccessPasswordHint(hint) {
  const { data } = await api.post('/api/recordVault/access/hint', { hint });
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
export async function fetchRecordVaultAccessFailStatus(storageType = 'onedrive') {
  const { data } = await api.get('/api/recordVault/access/fail-status', {
    params: { storageType: storageType === 'usb' ? 'usb' : 'onedrive' }
  });
  return mapVaultAccessFailStatus(data);
}

/**
 * Record a client-side vault-password verify failure (password never sent).
 * On 5th fail: OneDrive is formatted server-side; USB returns needsClientFormat.
 */
export async function recordRecordVaultAccessFail({ storageType = 'onedrive', mountPath } = {}) {
  try {
    const { data } = await api.post('/api/recordVault/access/fail', {
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

export async function clearRecordVaultAccessFail(storageType = 'onedrive') {
  const { data } = await api.post('/api/recordVault/access/fail/clear', {
    storageType: storageType === 'usb' ? 'usb' : 'onedrive'
  });
  return data;
}

/** Yellow E2E: fetch KDF + wrapped DEK only (no password on server). */
export async function fetchRecordVaultE2eKeys() {
  const { data } = await api.get('/api/recordVault/e2e/keys');
  return {
    e2eYellow: data?.e2eYellow !== false,
    configured: Boolean(data?.configured),
    vault: data?.vault || null
  };
}

/** Yellow E2E: store client-generated salt + wrapped DEK (never the password). */
export async function saveRecordVaultE2eKeys(payload) {
  const { data } = await api.post('/api/recordVault/e2e/keys', payload);
  return data;
}

/** Yellow E2E: password change — new salt + re-wrapped DEK only. */
export async function updateRecordVaultE2eKeys(payload) {
  const { data } = await api.put('/api/recordVault/e2e/keys', payload);
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

export function createRecordVaultPaneApi(storageType) {
  const type = storageType === 'onedrive' ? 'onedrive' : 'usb';
  const opts = { storageType: type };
  const rv = (config) => rvRequest({ ...config, storageType: type });
  return {
    fetchRecordVaultTree: () => fetchRecordVaultTree(opts),
    fetchRecordVaultNote: async (noteId) => {
      const id = Number(noteId);
      if (!Number.isFinite(id) || id < 1) return null;
      const { data } = await rv({ method: 'GET', url: `/api/recordVault/notes/${id}` });
      return data?.note ?? null;
    },
    createRecordVaultNotebook: (name) => createRecordVaultNotebook(name, opts),
    updateRecordVaultNotebook: (id, name) => updateRecordVaultNotebook(id, name, opts),
    deleteRecordVaultNotebook: (id) => deleteRecordVaultNotebook(id, opts),
    reorderRecordVaultNotebooks: (ids) => reorderRecordVaultNotebooks(ids, opts),
    reorderRecordVaultNotes: (notebookId, ids) => reorderRecordVaultNotes(notebookId, ids, opts),
    createRecordVaultShortcut: (payload) => createRecordVaultShortcut(payload, opts),
    deleteRecordVaultShortcut: (id) => deleteRecordVaultShortcut(id, opts),
    reorderRecordVaultShortcuts: (ids) => reorderRecordVaultShortcuts(ids, opts),
    createRecordVaultNote: (notebookId, payload) => createRecordVaultNote(notebookId, payload, opts),
    updateRecordVaultNote: (noteId, payload) => updateRecordVaultNote(noteId, payload, opts),
    deleteRecordVaultNote: (id) => deleteRecordVaultNote(id, opts),
    uploadRecordVaultNoteExtraImage: (noteId, payload) => uploadRecordVaultNoteExtraImage(noteId, payload, opts),
    deleteRecordVaultNoteExtraImage: (noteId, imageId) => deleteRecordVaultNoteExtraImage(noteId, imageId, opts),
    moveRecordVaultNoteImage: (payload) => moveRecordVaultNoteImage(payload, opts),
    moveRecordVaultNote: (noteId, notebookId) => moveRecordVaultNote(noteId, notebookId, opts),
    uploadRecordVaultNoteAttachment: (noteId, payload) => uploadRecordVaultNoteAttachment(noteId, payload, opts),
    deleteRecordVaultNoteAttachment: (noteId, attachmentId) =>
      deleteRecordVaultNoteAttachment(noteId, attachmentId, opts),
    searchRecordVaultNotes: (query) => searchRecordVaultNotes(query, opts),
    fetchRecordVaultUsage: () => fetchRecordVaultUsage(opts),
    logoffRecordVaultStorage: (extra = {}) => logoffRecordVaultStorage({ ...opts, ...extra }),
    syncRecordVaultStorage: (extra = {}) => syncRecordVaultStorage({ ...opts, ...extra })
  };
}

export {
  probeRecordVaultBridge,
  isRecordVaultBridgeActive,
  isRecordVaultBridgeAvailable,
  setRecordVaultBridgeSinglesId,
  setRecordVaultBridgeStorageType,
  setRecordVaultBridgeEnabled,
  getRecordVaultBridgeBaseUrl
} from './recordVaultBridgeFe';
