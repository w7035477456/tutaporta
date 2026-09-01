import api from './axios';
import {
  getMobilePhotoUploadDebugLines,
  isMobilePhotoUploadDebugEnabled,
  mobilePhotoUploadDebugLog,
  summarizeFetchResponse
} from 'utils/mobilePhotoUploadDebug';

/** POST /api/mobilePhotoUpload/session — desktop creates phone upload link */
export async function createMobilePhotoUploadSession({ purpose, paidRecordId } = {}) {
  const body = {};
  if (purpose != null && String(purpose).trim() !== '') {
    body.purpose = String(purpose).trim();
  }
  const prId = Number(paidRecordId);
  if (Number.isFinite(prId) && prId >= 1) {
    body.paid_record_id = prId;
  }
  mobilePhotoUploadDebugLog('createSession START', {
    purpose: body.purpose || 'profile',
    paidRecordId: body.paid_record_id || null
  });
  try {
    const { data } = await api.post('/api/mobilePhotoUpload/session', body);
    mobilePhotoUploadDebugLog('createSession OK', {
      purpose: data?.purpose,
      paidRecordId: data?.paidRecordId,
      expiresAt: data?.expiresAt,
      mobileUrlHost: (() => {
        try {
          return new URL(data?.mobileUrl).host;
        } catch {
          return null;
        }
      })()
    });
    return data;
  } catch (err) {
    mobilePhotoUploadDebugLog('createSession FAIL', {
      message: err?.message,
      status: err?.response?.status,
      error: err?.response?.data?.error
    });
    throw err;
  }
}

/** GET /api/mobilePhotoUpload/session/:token/status — desktop checks if phone finished */
export async function fetchMobilePhotoUploadSessionStatus(token) {
  mobilePhotoUploadDebugLog('pollStatus START', { tokenLen: String(token ?? '').length });
  const { data } = await api.get(`/api/mobilePhotoUpload/session/${encodeURIComponent(token)}/status`);
  mobilePhotoUploadDebugLog('pollStatus OK', {
    valid: data?.valid,
    completed: data?.completed,
    photosId: data?.photosId,
    purpose: data?.purpose
  });
  return data;
}

async function parseApiResponse(res) {
  const text = await res.text();
  const summary = summarizeFetchResponse(res, text);
  mobilePhotoUploadDebugLog('parseApiResponse', summary);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    if (summary.isHtml) {
      if (res.status === 403) {
        return {
          error:
            'Upload blocked (HTTP 403). Cloudflare or the firewall may be blocking phone photo POSTs. Add a WAF skip rule for /api/mobilePhotoUpload (see haproxy/cloudflare-allowlist.md), deploy, then scan a fresh QR code.',
          _debug: summary
        };
      }
      const sizeHint =
        res.status === 413 || res.status >= 500
          ? ' Photo may be too large for the server — try a smaller image or scan a fresh QR code.'
          : '';
      return {
        error: `Server returned HTML instead of JSON (HTTP ${res.status}). Rebuild/deploy the backend with mobile upload routes, or scan a fresh QR code.${sizeHint}`,
        _debug: summary
      };
    }
    return { error: text.slice(0, 200), _debug: summary };
  }
}

function mobileUploadFetchError(res, data, fallback) {
  const serverMsg = data?.error || data?.message;
  if (serverMsg) {
    const err = new Error(serverMsg);
    err.response = { data, status: res.status };
    err.debug = data?._debug;
    return err;
  }
  const err = new Error(`${fallback} (HTTP ${res.status})`);
  err.response = { data, status: res.status };
  err.debug = data?._debug;
  return err;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchValidateUrl(url) {
  mobilePhotoUploadDebugLog('validate fetch', { url: url.slice(0, 80) });
  const res = await fetch(url, { credentials: 'omit', cache: 'no-store' });
  const data = await parseApiResponse(res);
  return { res, data };
}

function isValidSessionPayload(data) {
  return data != null && typeof data.valid === 'boolean';
}

/** GET /api/mobilePhotoUpload/ping — phone health check */
export async function pingMobilePhotoUploadApi() {
  const res = await fetch('/api/mobilePhotoUpload/ping', { credentials: 'omit', cache: 'no-store' });
  const data = await parseApiResponse(res);
  mobilePhotoUploadDebugLog('ping', { ok: res.ok, status: res.status, data });
  return { res, data };
}

/** GET /api/mobilePhotoUpload/validate?token= — phone page (no login cookie required) */
export async function fetchMobilePhotoUploadSessionPublic(token) {
  const trimmed = String(token ?? '').trim().replace(/\s+/g, '');
  if (!trimmed) {
    throw new Error('Missing upload token. Scan the QR code again from your computer.');
  }

  mobilePhotoUploadDebugLog('validate START', { tokenLen: trimmed.length });

  try {
    const ping = await pingMobilePhotoUploadApi();
    if (!ping.res.ok) {
      mobilePhotoUploadDebugLog('validate ping FAIL', { status: ping.res.status });
    }
  } catch (pingErr) {
    mobilePhotoUploadDebugLog('validate ping network error', { message: pingErr?.message });
  }

  const validateUrl = `/api/mobilePhotoUpload/validate?token=${encodeURIComponent(trimmed)}`;
  const legacyUrl = `/api/mobilePhotoUpload/session/${encodeURIComponent(trimmed)}`;
  let lastErr;

  for (const url of [validateUrl, legacyUrl]) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const { res, data } = await fetchValidateUrl(url);
        if (res.ok && isValidSessionPayload(data)) {
          mobilePhotoUploadDebugLog('validate OK', {
            valid: data.valid,
            expired: data.expired,
            completed: data.completed,
            purpose: data.purpose
          });
          return data;
        }
        if (res.status === 404 && attempt < 3) {
          mobilePhotoUploadDebugLog('validate 404 retry', { attempt: attempt + 1, url: url.slice(0, 60) });
          await sleep(400 * (attempt + 1));
          continue;
        }
        if (!res.ok) {
          lastErr = mobileUploadFetchError(res, data, 'Upload link is not valid');
          mobilePhotoUploadDebugLog('validate HTTP error', {
            status: res.status,
            error: data?.error,
            debug: data?._debug
          });
          break;
        }
        lastErr = new Error(
          'Server returned an unexpected response. Run febeprod on the server, then tap New QR code.'
        );
        mobilePhotoUploadDebugLog('validate unexpected payload', { data });
        break;
      } catch (networkErr) {
        lastErr = new Error('Could not reach the server. Check Wi‑Fi or cellular data and scan a fresh QR code.');
        lastErr.cause = networkErr;
        mobilePhotoUploadDebugLog('validate network error', { message: networkErr?.message });
        break;
      }
    }
  }

  throw lastErr ?? new Error('Upload link is not valid');
}

/** Phone uplinks are slow; give a big photo time but never spin forever. */
export const MOBILE_UPLOAD_TIMEOUT_MS = 180_000;

const UPLOAD_BLOCKED_MESSAGE =
  'Upload blocked (HTTP 403). Cloudflare or the firewall may be blocking phone photo POSTs. Add a WAF skip rule for /api/mobilePhotoUpload (see haproxy/cloudflare-allowlist.md), deploy, then scan a fresh QR code.';

function looksLikeHtml(text, contentType) {
  return /^\s*</.test(String(text || '')) || String(contentType || '').includes('text/html');
}

/**
 * XHR instead of fetch: upload progress events and a real timeout, so a stalled
 * cellular POST fails with a message instead of spinning forever.
 */
function xhrUpload({ url, body, contentType, onProgress, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.timeout = Number(timeoutMs) || MOBILE_UPLOAD_TIMEOUT_MS;
    xhr.responseType = 'text';
    xhr.setRequestHeader('Accept', 'application/json');
    if (contentType) xhr.setRequestHeader('Content-Type', contentType);

    if (xhr.upload && typeof onProgress === 'function') {
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || !event.total) return;
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      };
    }

    xhr.onload = () => {
      resolve({
        status: xhr.status,
        text: String(xhr.responseText || ''),
        contentType: xhr.getResponseHeader('content-type') || ''
      });
    };
    xhr.onerror = () => {
      const err = new Error('Could not reach the server. Check your connection and try again.');
      err.networkFailure = true;
      reject(err);
    };
    xhr.ontimeout = () => {
      const err = new Error(
        'Upload timed out. Your connection may be too slow for this photo — move closer to Wi‑Fi or try a smaller photo.'
      );
      err.timedOut = true;
      reject(err);
    };
    xhr.onabort = () => reject(new Error('Upload cancelled.'));

    xhr.send(body);
  });
}

function parseUploadResponse({ status, text, contentType }) {
  const summary = { status, contentType, isHtml: looksLikeHtml(text, contentType), bodyPreview: String(text).slice(0, 240) };
  if (!text) return { data: {}, summary };
  try {
    return { data: JSON.parse(text), summary };
  } catch {
    if (summary.isHtml && status === 403) {
      return { data: { error: UPLOAD_BLOCKED_MESSAGE, _debug: summary }, summary };
    }
    if (summary.isHtml) {
      const sizeHint =
        status === 413 || status >= 500
          ? ' Photo may be too large for the server — try a smaller image or scan a fresh QR code.'
          : '';
      return {
        data: {
          error: `Server returned HTML instead of JSON (HTTP ${status}). Rebuild/deploy the backend with mobile upload routes, or scan a fresh QR code.${sizeHint}`,
          _debug: summary
        },
        summary
      };
    }
    return { data: { error: String(text).slice(0, 200), _debug: summary }, summary };
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the photo from your phone.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Some WAF managed rules inspect multipart file uploads but pass plain JSON, so
 * a 403 on the binary POST is retried once as a base64 JSON body.
 */
async function uploadAsJsonFallback(url, file, fileName, { onProgress, timeoutMs }) {
  mobilePhotoUploadDebugLog('upload JSON fallback START', { fileName, fileSize: file?.size });
  const dataUrl = await readFileAsDataUrl(file);
  const extMatch = fileName.match(/\.([^.]+)$/);
  const body = JSON.stringify({
    image: dataUrl,
    originalFileName: fileName,
    ...(extMatch ? { file_extension: extMatch[1].toLowerCase() } : {})
  });
  return xhrUpload({ url, body, contentType: 'application/json', onProgress, timeoutMs });
}

/** POST /api/mobilePhotoUpload/photo?token= — phone upload (no login cookie required) */
export async function uploadPhotoViaMobileSession(token, file, { onProgress, timeoutMs } = {}) {
  const trimmed = String(token ?? '').trim().replace(/\s+/g, '');
  const fileName = String(file?.name ?? '').trim() || 'photo.jpg';
  const url = `/api/mobilePhotoUpload/photo?token=${encodeURIComponent(trimmed)}`;

  mobilePhotoUploadDebugLog('upload START', {
    tokenLen: trimmed.length,
    fileName,
    fileSize: file?.size,
    fileType: file?.type
  });

  const form = new FormData();
  form.append('photo', file, fileName);
  // Let the browser set the multipart boundary.
  let raw = await xhrUpload({ url, body: form, onProgress, timeoutMs });
  let { data, summary } = parseUploadResponse(raw);
  mobilePhotoUploadDebugLog('upload response', summary);

  if (raw.status === 403) {
    mobilePhotoUploadDebugLog('upload 403 — retrying as JSON', summary);
    try {
      raw = await uploadAsJsonFallback(url, file, fileName, { onProgress, timeoutMs });
      ({ data, summary } = parseUploadResponse(raw));
      mobilePhotoUploadDebugLog('upload JSON fallback response', summary);
    } catch (fallbackErr) {
      mobilePhotoUploadDebugLog('upload JSON fallback FAIL', { message: fallbackErr?.message });
      throw fallbackErr;
    }
  }

  if (raw.status < 200 || raw.status >= 300) {
    mobilePhotoUploadDebugLog('upload FAIL', { status: raw.status, error: data?.error });
    const err = new Error(data?.error || data?.message || `Upload failed (HTTP ${raw.status})`);
    err.response = { data, status: raw.status };
    err.debug = data?._debug;
    throw err;
  }

  mobilePhotoUploadDebugLog('upload OK', { photosId: data?.photos_id, fileName: data?.fileName });
  return data;
}

export { getMobilePhotoUploadDebugLines, isMobilePhotoUploadDebugEnabled };
