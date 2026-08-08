import api from './axios';
import { requestPhotoAlbumsUsageRefresh } from 'utils/photoAlbumsUsageRefreshGate';

const DEFAULT_PORT = 49201;

export const PHOTO_ALBUMS_BRIDGE_PORT = Number(import.meta.env.PHOTO_ALBUMS_BRIDGE_PORT || DEFAULT_PORT);

function isBridgeUsbEndpoint(pathOnly) {
  const normalized = String(pathOnly || '');
  if (!normalized.startsWith('/api/photoAlbums/usb/')) return false;
  if (normalized === '/api/photoAlbums/usb/icon-derived-key') return false;
  return true;
}

let bridgeAvailable = false;
let bridgeEnabled = true;
let bridgeSinglesId = null;
let bridgeUserGestureGranted = false;
/** @type {'usb' | 'onedrive' | null} */
let bridgeVaultStorageType = null;

/** Production site cannot list USB on the server — always use the local bridge for drive paths. */
export function isPhotoAlbumsBridgeHostContext() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return host !== 'localhost' && host !== '127.0.0.1';
}

let bridgeBaseUrl = `http://127.0.0.1:${PHOTO_ALBUMS_BRIDGE_PORT}`;

function bridgeBaseUrlCandidates() {
  const port = PHOTO_ALBUMS_BRIDGE_PORT;
  const urls = [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
  if (bridgeBaseUrl && !urls.includes(bridgeBaseUrl)) {
    urls.unshift(bridgeBaseUrl);
  }
  return [...new Set(urls)];
}

export function getPhotoAlbumsBridgeBaseUrl() {
  return bridgeBaseUrl;
}

function bridgeFetchOptionSets(extra = {}) {
  return [
    {
      mode: 'cors',
      credentials: 'omit',
      targetAddressSpace: 'local',
      ...extra
    },
    {
      mode: 'cors',
      credentials: 'omit',
      ...extra
    }
  ];
}

const BROWSER_BLOCK_HINT =
  'Chrome blocked access to the bridge on this computer. Click Connect local USB below, then Allow when Chrome asks to connect to devices on your local network. You can also open Chrome site settings for onlinemall.website and enable Local network access.';

export function formatPhotoAlbumsBridgeClientError(err) {
  const message = String(err?.response?.data?.error || err?.message || '').trim();
  if (
    !message ||
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('Load failed')
  ) {
    return BROWSER_BLOCK_HINT;
  }
  return message;
}

function utf8ByteLength(value) {
  if (value == null) return 0;
  if (typeof value === 'string') return new TextEncoder().encode(value).length;
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return 0;
  }
}

async function reportBridgeTransferBytes(reqBytes, resBytes) {
  const total = Math.max(0, Math.floor(Number(reqBytes) || 0)) + Math.max(0, Math.floor(Number(resBytes) || 0));
  if (total <= 0) return;
  try {
    await api.post('/api/photoAlbums/transfer-bytes', { bytes: total });
    requestPhotoAlbumsUsageRefresh({ delayMs: 300 });
  } catch {
    // Bridge traffic reporting must not break vault ops.
  }
}

async function bridgeFetch(path, extra = {}) {
  let lastError = null;
  const body = extra?.body;
  const reqBytes =
    body instanceof FormData
      ? 0
      : utf8ByteLength(body);
  for (const base of bridgeBaseUrlCandidates()) {
    for (const options of bridgeFetchOptionSets(extra)) {
      try {
        const response = await fetch(`${base}${path}`, options);
        bridgeBaseUrl = base;
        const resHeader = Number(response.headers.get('content-length'));
        const resBytes = Number.isFinite(resHeader) && resHeader > 0 ? resHeader : 0;
        void reportBridgeTransferBytes(reqBytes, resBytes);
        return response;
      } catch (err) {
        lastError = err;
      }
    }
  }
  throw lastError || new Error('Failed to fetch');
}

export function setPhotoAlbumsBridgeSinglesId(singlesId) {
  const id = Number(singlesId);
  bridgeSinglesId = Number.isFinite(id) && id > 0 ? id : null;
}

/** OneDrive vault sessions live on the main API; USB sessions may live in the local bridge. */
export function setPhotoAlbumsBridgeStorageType(storageType) {
  const normalized = String(storageType ?? '').trim().toLowerCase();
  bridgeVaultStorageType =
    normalized === 'onedrive' || normalized === 'usb' ? normalized : null;
}

export function getPhotoAlbumsBridgeStorageType() {
  return bridgeVaultStorageType;
}

export function setPhotoAlbumsBridgeEnabled(enabled) {
  bridgeEnabled = Boolean(enabled);
}

export function isPhotoAlbumsBridgeAvailable() {
  return bridgeAvailable;
}

export function isPhotoAlbumsBridgeActive() {
  return bridgeEnabled && bridgeAvailable && bridgeSinglesId != null;
}

export function markPhotoAlbumsBridgeUserGesture() {
  bridgeUserGestureGranted = true;
}

export async function probePhotoAlbumsBridge() {
  try {
    const response = await bridgeFetch('/health', { signal: AbortSignal.timeout(5000) });
    bridgeAvailable = response.ok;
    return { ok: response.ok, error: response.ok ? '' : `Bridge health check failed (${response.status})` };
  } catch (err) {
    bridgeAvailable = false;
    const message = formatPhotoAlbumsBridgeClientError(err);
    return {
      ok: false,
      error: message,
      likelyBrowserBlock: message === BROWSER_BLOCK_HINT
    };
  }
}

function pathWithoutQuery(url) {
  return String(url || '').split('?')[0];
}

function bridgeErrorMessage(status, data) {
  if (typeof data === 'string' && data.trim()) return data.trim();
  if (data?.error) return String(data.error);
  return `Request failed with status code ${status}`;
}

function buildBridgeError(status, data) {
  const message = bridgeErrorMessage(status, data);
  const error = new Error(message);
  const normalized =
    typeof data === 'object' && data !== null
      ? data
      : message
        ? { error: message }
        : { error: `Request failed with status code ${status}` };
  error.response = { status, data: normalized };
  return error;
}

export async function bridgeFetchBlob(path) {
  const pathOnly = pathWithoutQuery(path);
  const isLocalUsbPath = isBridgeUsbEndpoint(pathOnly);
  if (!isLocalUsbPath && !bridgeSinglesId) {
    throw new Error('Record Vault bridge is not configured for this user');
  }

  const headers = {};
  if (bridgeSinglesId) {
    headers['X-Record-Vault-Singles-Id'] = String(bridgeSinglesId);
  }

  const response = await bridgeFetch(String(path || ''), {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(120000)
  });

  if (!response.ok) {
    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { error: text };
      }
    }
    throw buildBridgeError(response.status, payload);
  }

  const blob = await response.blob();
  if (!Number(response.headers.get('content-length'))) {
    void reportBridgeTransferBytes(0, blob.size);
  }
  return blob;
}

/** Like bridgeFetchBlob, but also returns Content-Disposition filename when present. */
export async function bridgeFetchBlobDownload(path) {
  const pathOnly = pathWithoutQuery(path);
  const isLocalUsbPath = isBridgeUsbEndpoint(pathOnly);
  if (!isLocalUsbPath && !bridgeSinglesId) {
    throw new Error('Record Vault bridge is not configured for this user');
  }

  const headers = {};
  if (bridgeSinglesId) {
    headers['X-Record-Vault-Singles-Id'] = String(bridgeSinglesId);
  }

  const response = await bridgeFetch(String(path || ''), {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(300000)
  });

  if (!response.ok) {
    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { error: text };
      }
    }
    throw buildBridgeError(response.status, payload);
  }

  const disposition = response.headers.get('content-disposition') || '';
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  let fileName = '';
  if (utfMatch?.[1]) {
    try {
      fileName = decodeURIComponent(utfMatch[1].trim());
    } catch {
      fileName = utfMatch[1].trim();
    }
  } else if (plainMatch?.[1]) {
    fileName = plainMatch[1].trim();
  }

  const blob = await response.blob();
  return { blob, fileName };
}

/** POST multipart FormData to the local bridge (do not set Content-Type — browser sets boundary). */
export async function bridgeUploadFormData(path, formData, { timeoutMs = 300000 } = {}) {
  const pathOnly = pathWithoutQuery(path);
  const isLocalUsbPath = isBridgeUsbEndpoint(pathOnly);
  if (!isLocalUsbPath && !bridgeSinglesId) {
    throw new Error('Record Vault bridge is not configured for this user');
  }

  const headers = {};
  if (bridgeSinglesId) {
    headers['X-Record-Vault-Singles-Id'] = String(bridgeSinglesId);
  }

  const response = await bridgeFetch(String(path || ''), {
    method: 'POST',
    headers,
    body: formData,
    signal: AbortSignal.timeout(timeoutMs)
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw buildBridgeError(response.status, payload);
  }

  return { data: payload };
}

export async function bridgeRequest({ method = 'GET', url, data, params, storageType = null }) {
  const pathOnly = pathWithoutQuery(url);
  const isLocalUsbPath = isBridgeUsbEndpoint(pathOnly);
  if (!isLocalUsbPath && !bridgeSinglesId) {
    throw new Error('Record Vault bridge is not configured for this user');
  }

  let path = String(url || '');
  if (params && typeof params === 'object') {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value != null && String(value).trim() !== '') {
        search.set(key, String(value));
      }
    }
    const query = search.toString();
    if (query) path += (path.includes('?') ? '&' : '?') + query;
  }

  const headers = {};
  if (bridgeSinglesId) {
    headers['X-Record-Vault-Singles-Id'] = String(bridgeSinglesId);
  }
  const activeStorageType = storageType ?? bridgeVaultStorageType;
  if (activeStorageType) {
    headers['X-Record-Vault-Storage'] = activeStorageType;
  }
  const hasBody = data != null && method !== 'GET' && method !== 'HEAD';
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await bridgeFetch(path, {
    method,
    headers,
    body: hasBody ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(15000)
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw buildBridgeError(response.status, payload);
  }

  return { data: payload };
}

export function shouldRoutePhotoAlbumsThroughBridge(path, storageType = null) {
  const normalized = pathWithoutQuery(path);
  const activeStorageType = storageType ?? bridgeVaultStorageType;
  if (!bridgeEnabled) return false;
  if (normalized.startsWith('/api/photoAlbums/access/')) return false;
  // Icon secrets live on the main API DB — never on the local bridge.
  if (normalized === '/api/photoAlbums/usb/icon-derived-key') return false;
  // USB unlock/session/CRUD must hit the bridge process that holds the in-memory vault session.
  // (Previously only locations/unlock-guard were force-routed; /usb/status went to the main API
  // after unlock and immediately cleared the FE "unlocked" flag.)
  if (normalized.startsWith('/api/photoAlbums/usb/')) {
    if (isPhotoAlbumsBridgeHostContext()) {
      return bridgeAvailable || bridgeUserGestureGranted;
    }
    return bridgeAvailable;
  }
  // OneDrive unlock + CRUD stay on the main API server (bridge has no cloud session).
  if (activeStorageType === 'onedrive') return false;
  if (!bridgeAvailable) return false;
  if (!bridgeSinglesId) return false;
  if (activeStorageType !== 'usb') return false;
  return normalized.startsWith('/api/photoAlbums');
}
