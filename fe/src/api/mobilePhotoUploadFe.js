import api from './axios';
import {
  getMobilePhotoUploadDebugLines,
  isMobilePhotoUploadDebugEnabled,
  mobilePhotoUploadDebugLog,
  summarizeFetchResponse
} from 'utils/mobilePhotoUploadDebug';

/** POST /api/mobilePhotoUpload/session — desktop creates phone upload link */
export async function createMobilePhotoUploadSession({ purpose } = {}) {
  const body = {};
  if (purpose != null && String(purpose).trim() !== '') {
    body.purpose = String(purpose).trim();
  }
  mobilePhotoUploadDebugLog('createSession START', { purpose: body.purpose || 'profile' });
  try {
    const { data } = await api.post('/api/mobilePhotoUpload/session', body);
    mobilePhotoUploadDebugLog('createSession OK', {
      purpose: data?.purpose,
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

/** POST /api/mobilePhotoUpload/photo?token= — phone upload (no login cookie required) */
export async function uploadPhotoViaMobileSession(token, file) {
  const trimmed = String(token ?? '').trim().replace(/\s+/g, '');
  const fileName = String(file?.name ?? '').trim() || 'photo.jpg';
  const form = new FormData();
  form.append('photo', file, fileName);

  const url = `/api/mobilePhotoUpload/photo?token=${encodeURIComponent(trimmed)}`;
  mobilePhotoUploadDebugLog('upload START', {
    tokenLen: trimmed.length,
    fileName,
    fileSize: file?.size,
    fileType: file?.type
  });

  let res;
  try {
    // Multipart (binary) — same wire format as the original HTML form POST.
    res = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      cache: 'no-store',
      body: form,
      redirect: 'manual'
    });
  } catch (networkErr) {
    mobilePhotoUploadDebugLog('upload network error', { message: networkErr?.message });
    const err = new Error('Could not reach the server. Check your connection and try again.');
    err.cause = networkErr;
    throw err;
  }

  mobilePhotoUploadDebugLog('upload response headers', {
    status: res.status,
    contentType: res.headers.get('content-type'),
    location: res.headers.get('location')
  });

  // Legacy BE: multipart upload redirects back to /mobilePhotoUpload?…&uploaded=1
  if (res.status >= 300 && res.status < 400) {
    const location = String(res.headers.get('Location') || '');
    mobilePhotoUploadDebugLog('upload redirect', { location: location.slice(0, 200) });
    if (location.includes('uploaded=1')) {
      return { success: true };
    }
    const errMatch = location.match(/[?&]error=([^&]+)/);
    if (errMatch) {
      throw new Error(decodeURIComponent(errMatch[1]));
    }
    throw new Error('Upload failed. Scan a fresh QR code from your computer and try again.');
  }

  const data = await parseApiResponse(res);
  if (!res.ok) {
    mobilePhotoUploadDebugLog('upload FAIL', { status: res.status, error: data?.error, debug: data?._debug });
    throw mobileUploadFetchError(res, data, 'Upload failed');
  }
  mobilePhotoUploadDebugLog('upload OK', { photosId: data?.photos_id, fileName: data?.fileName });
  return data;
}

export { getMobilePhotoUploadDebugLines, isMobilePhotoUploadDebugEnabled };
