import { getPublicAppUrl } from '../publicAppUrl.js';

const GRAPH_API = 'https://graph.microsoft.com/v1.0';
/** Older OneDrive folder names to purge/recognize; primary is getOneDriveVaultFolderName(). */
const LEGACY_ONEDRIVE_PHOTOALBUMS_FOLDER_NAMES = ['OMPhotoAlbums'];

/** OneDrive root folder for Photo Albums. Override: ONEDRIVE_PHOTOALBUMS_FOLDER_NAME */
export function getOneDriveVaultFolderName() {
  const name = String(process.env.ONEDRIVE_PHOTOALBUMS_FOLDER_NAME || 'TutaPhotoAlbums').trim();
  return name || 'TutaPhotoAlbums';
}

export function isOneDriveVaultRootFolderName(name) {
  const folderName = String(name || '').trim();
  if (!folderName) return false;
  if (folderName === getOneDriveVaultFolderName()) return true;
  return LEGACY_ONEDRIVE_PHOTOALBUMS_FOLDER_NAMES.includes(folderName);
}

export function listOneDriveVaultRootFolderNamesToPurge() {
  return [...new Set([getOneDriveVaultFolderName(), ...LEGACY_ONEDRIVE_PHOTOALBUMS_FOLDER_NAMES])];
}

function isPlaceholderOAuthCredential(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized.includes('your_') ||
    normalized.includes('placeholder') ||
    normalized.includes('changeme') ||
    normalized.includes('example') ||
    normalized === 'todo'
  );
}

function parseTrustedOriginList(raw) {
  return String(raw || '')
    .split(',')
    .map((item) => {
      try {
        return new URL(String(item || '').trim()).origin;
      } catch {
        return '';
      }
    })
    .filter(Boolean);
}

function normalizeOAuthOrigin(value) {
  try {
    return new URL(String(value || '').trim()).origin;
  } catch {
    return '';
  }
}

function trustedOneDriveOAuthFrontendOrigins() {
  const origins = new Set();
  const add = (value) => {
    const origin = normalizeOAuthOrigin(value);
    if (origin) origins.add(origin);
  };
  add(getPublicAppUrl());
  add(process.env.PUBLIC_APP_URL);
  add(process.env.FRONTEND_PUBLIC_URL);
  for (const origin of parseTrustedOriginList(process.env.DEV_ALLOWED_ORIGINS)) {
    origins.add(origin);
  }
  return origins;
}

/** OAuth redirect — must match Azure app registration (same URI as Notes / Record Vault). */
export function resolveOneDriveOAuthRedirectUri(returnOrigin) {
  const config = getMicrosoftOAuthConfig();
  if (!config) return null;
  const origin = normalizeOAuthOrigin(returnOrigin);
  if (origin && trustedOneDriveOAuthFrontendOrigins().has(origin)) {
    return `${origin}/api/recordVault/onedrive/oauth/callback`;
  }
  return config.redirectUri;
}

function getMicrosoftOAuthConfig() {
  const clientId = String(process.env.MICROSOFT_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.MICROSOFT_OAUTH_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) return null;
  if (isPlaceholderOAuthCredential(clientId) || isPlaceholderOAuthCredential(clientSecret)) {
    return null;
  }
  // Azure registers Notes callback only — always use that URI (product demuxed via OAuth state).
  const redirectUri =
    String(process.env.ONEDRIVE_VAULT_REDIRECT_URI || '').trim() ||
    `${getPublicAppUrl()}/api/recordVault/onedrive/oauth/callback`;
  return { clientId, clientSecret, redirectUri };
}

export function isOneDriveVaultOAuthConfigured() {
  return Boolean(getMicrosoftOAuthConfig());
}

export async function exchangeOneDriveOAuthCode(code, redirectUri = null) {
  const config = getMicrosoftOAuthConfig();
  if (!config) throw new Error('OneDrive is not configured on this server');
  const effectiveRedirectUri = String(redirectUri || config.redirectUri || '').trim();
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: String(code),
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: effectiveRedirectUri,
      grant_type: 'authorization_code'
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = String(data?.error || 'token_exchange_failed');
    const desc = String(data?.error_description || data?.error?.message || '').trim();
    const codes = data?.error_codes ? JSON.stringify(data.error_codes) : '';
    const trace = data?.correlation_id || data?.trace_id || '';
    const detail = [desc, codes && `error_codes=${codes}`, trace && `correlation_id=${trace}`]
      .filter(Boolean)
      .join(' | ');
    throw new Error(detail ? `Microsoft token exchange failed (${err}): ${detail}` : `Microsoft token exchange failed (${err})`);
  }
  return data;
}

export async function refreshOneDriveAccessToken(refreshToken) {
  const config = getMicrosoftOAuthConfig();
  if (!config) throw new Error('OneDrive is not configured on this server');
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: String(refreshToken),
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token'
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error_description || data?.error || 'Failed to refresh OneDrive token');
  }
  return data;
}

export async function fetchOneDriveUserEmail(accessToken) {
  const response = await fetch(`${GRAPH_API}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Failed to load Microsoft profile');
  }
  return String(data?.mail || data?.userPrincipalName || '').trim().toLowerCase();
}

async function graphRequest(accessToken, path, options = {}) {
  const url = path.startsWith('http') ? path : `${GRAPH_API}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body && !(options.body instanceof Buffer) ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  if (response.status === 204) return null;
  const contentType = String(response.headers.get('content-type') || '');
  if (contentType.includes('application/json')) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error?.message || 'OneDrive request failed');
    }
    return data;
  }
  if (!response.ok) {
    throw new Error('OneDrive request failed');
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** Always read raw bytes — Graph serves vault.meta.json as application/json but body is file bytes. */
async function graphBinaryRequest(accessToken, path, options = {}) {
  const url = path.startsWith('http') ? path : `${GRAPH_API}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/octet-stream',
      ...(options.body && !(options.body instanceof Buffer) ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  if (response.status === 204) return Buffer.alloc(0);
  if (!response.ok) {
    let message = 'OneDrive request failed';
    const contentType = String(response.headers.get('content-type') || '');
    if (contentType.includes('application/json')) {
      const data = await response.json().catch(() => ({}));
      message = data?.error?.message || message;
    }
    throw new Error(message);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function isOneDriveConflictError(err) {
  return /eTag mismatch|resource has changed|nameAlreadyExists|resourceModified/i.test(String(err?.message || ''));
}

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withOneDriveConflictRetries(label, fn, { attempts = 3 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (!isOneDriveConflictError(err) || attempt >= attempts - 1) throw err;
      console.warn('[OneDrive]', `${label} conflict — retrying`, {
        attempt: attempt + 1,
        message: err?.message || String(err)
      });
      await sleepMs(120 * (attempt + 1));
    }
  }
  throw lastErr;
}

function oneDriveParentSegment(parentId) {
  return parentId === 'root' ? 'root' : `items/${encodeURIComponent(parentId)}`;
}

function encodeOneDrivePath(relativePath) {
  return String(relativePath || '')
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function isOneDriveNotFoundError(err) {
  return /not be found|itemnotfound|resource could not be found/i.test(String(err?.message || ''));
}

/** Path-based metadata — same addressing as Test Write content PUT. */
export async function getOneDriveItemAtPath(accessToken, parentId, relativePath, select = 'id,name,folder,file') {
  const encodedPath = encodeOneDrivePath(relativePath);
  if (!encodedPath) throw new Error('OneDrive path is required');
  try {
    return await graphRequest(
      accessToken,
      `/me/drive/${oneDriveParentSegment(parentId)}:/${encodedPath}:?${new URLSearchParams({ $select: select }).toString()}`
    );
  } catch (err) {
    if (isOneDriveNotFoundError(err)) return null;
    throw err;
  }
}

/** Path-based download — avoids OData $filter misses on /children. */
export async function downloadOneDriveFileAtPath(accessToken, parentId, relativePath) {
  const encodedPath = encodeOneDrivePath(relativePath);
  if (!encodedPath) throw new Error('OneDrive path is required');
  try {
    return await graphBinaryRequest(
      accessToken,
      `/me/drive/${oneDriveParentSegment(parentId)}:/${encodedPath}:/content`
    );
  } catch (err) {
    if (isOneDriveNotFoundError(err)) {
      throw new Error(`The resource could not be found: ${relativePath}`);
    }
    throw err;
  }
}

/** Path-based upsert — create or replace by path (Test Write pattern). */
export async function upsertOneDriveFileAtPath(
  accessToken,
  parentId,
  relativePath,
  buffer,
  mimeType = 'application/octet-stream'
) {
  const encodedPath = encodeOneDrivePath(relativePath);
  if (!encodedPath) throw new Error('OneDrive path is required');
  const contentPath =
    `/me/drive/${oneDriveParentSegment(parentId)}:/${encodedPath}:/content` +
    '?@microsoft.graph.conflictBehavior=replace';

  return withOneDriveConflictRetries(`upsert ${relativePath}`, async () => {
    try {
      const data = await graphRequest(accessToken, contentPath, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        body: buffer
      });
      return data?.id || null;
    } catch (err) {
      if (!isOneDriveConflictError(err)) throw err;
      const item = await getOneDriveItemAtPath(accessToken, parentId, relativePath, 'id');
      if (!item?.id) throw err;
      await updateOneDriveFileContent(accessToken, item.id, buffer, mimeType);
      return item.id;
    }
  });
}

export async function deleteOneDriveItemAtPath(accessToken, parentId, relativePath) {
  const item = await getOneDriveItemAtPath(accessToken, parentId, relativePath, 'id');
  if (!item?.id) return false;
  await deleteOneDriveItem(accessToken, item.id);
  return true;
}

export async function findOneDriveItemByName(accessToken, parentId, name, folderOnly = false) {
  const byPath = await getOneDriveItemAtPath(accessToken, parentId, name, 'id,name,folder,file');
  if (byPath?.id) {
    if (folderOnly && !byPath.folder) return null;
    return byPath;
  }
  const children = await listOneDriveChildren(accessToken, parentId);
  const match = children.find((item) => String(item?.name || '') === String(name));
  if (!match?.id) return null;
  if (folderOnly && !match.folder) return null;
  return match;
}

export async function createOneDriveFolder(accessToken, parentId, name) {
  const parentPath =
    parentId === 'root'
      ? '/me/drive/root/children'
      : `/me/drive/items/${encodeURIComponent(parentId)}/children`;
  const data = await graphRequest(accessToken, parentPath, {
    method: 'POST',
    body: JSON.stringify({
      name,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail'
    })
  });
  return data?.id || null;
}

export async function createOneDriveFile(accessToken, parentId, name, buffer, mimeType = 'application/octet-stream') {
  return upsertOneDriveFileAtPath(accessToken, parentId, name, buffer, mimeType);
}

export async function updateOneDriveFileContent(accessToken, itemId, buffer, mimeType = 'application/octet-stream') {
  await withOneDriveConflictRetries(`update item ${itemId}`, async () => {
    await graphRequest(
      accessToken,
      `/me/drive/items/${encodeURIComponent(itemId)}/content?@microsoft.graph.conflictBehavior=replace`,
      {
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        body: buffer
      }
    );
  });
}

export async function downloadOneDriveFile(accessToken, itemId) {
  return graphBinaryRequest(accessToken, `/me/drive/items/${encodeURIComponent(itemId)}/content`);
}

export async function deleteOneDriveItem(accessToken, itemId) {
  await graphRequest(accessToken, `/me/drive/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
}

export async function getOneDriveItem(accessToken, itemId, select = 'id,name,folder') {
  return graphRequest(
    accessToken,
    `/me/drive/items/${encodeURIComponent(itemId)}?${new URLSearchParams({ $select: select }).toString()}`
  );
}

export async function listOneDriveChildren(accessToken, parentId) {
  const parentPath =
    parentId === 'root'
      ? '/me/drive/root/children'
      : `/me/drive/items/${encodeURIComponent(parentId)}/children`;
  const items = [];
  let nextLink = `${parentPath}?$select=id,name,folder,file,size&$top=200`;
  for (;;) {
    const data = await graphRequest(accessToken, nextLink);
    if (Array.isArray(data?.value)) items.push(...data.value);
    nextLink = String(data?.['@odata.nextLink'] || '').trim();
    if (!nextLink) break;
  }
  return items;
}

export async function ensureVaultRootFolder(accessToken) {
  const folderName = getOneDriveVaultFolderName();
  const existing = await findOneDriveItemByName(accessToken, 'root', folderName, true);
  if (existing?.id) return existing.id;
  return createOneDriveFolder(accessToken, 'root', folderName);
}

function roundGbFromBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round((value / (1024 * 1024 * 1024)) * 10) / 10;
}

/** Whole-account quota — matches OneDrive UI "10.4 GB used of 100 GB". */
export async function fetchOneDriveStorageQuota(accessToken) {
  const data = await graphRequest(accessToken, '/me/drive?$select=quota');
  const q = data?.quota || {};
  const totalBytes = Number(q.total) || 0;
  const usedBytes = Number(q.used) || 0;
  const remainingBytes =
    q.remaining != null ? Number(q.remaining) || 0 : Math.max(0, totalBytes - usedBytes);
  const storageLeftPct =
    totalBytes > 0 ? Math.round((remainingBytes / totalBytes) * 1000) / 10 : 100;
  return {
    totalBytes,
    usedBytes,
    remainingBytes,
    usedGb: roundGbFromBytes(usedBytes),
    totalGb: roundGbFromBytes(totalBytes),
    storageLeftPct
  };
}

/** Recursive byte size of a OneDrive folder (e.g. onlinemallwebsitevault). */
export async function computeOneDriveFolderSizeBytes(accessToken, folderItemId) {
  let total = 0;
  const stack = [folderItemId];
  while (stack.length) {
    const parentId = stack.pop();
    const children = await listOneDriveChildren(accessToken, parentId);
    for (const item of children) {
      if (!item?.id) continue;
      if (item.folder) {
        stack.push(item.id);
        continue;
      }
      if (!item.file) continue;
      if (item.size != null) {
        total += Number(item.size) || 0;
        continue;
      }
      const meta = await getOneDriveItem(accessToken, item.id, 'id,size');
      total += Number(meta?.size) || 0;
    }
  }
  return total;
}

export { getMicrosoftOAuthConfig, getOneDriveVaultFolderName as VAULT_FOLDER_NAME };
