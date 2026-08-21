import api from './axios';
import { normalizeVerificationImageFile } from 'utils/normalizeVerificationImage';

/** Max width before phone QR upload — keeps multipart payloads small and converts HEIC → JPEG. */
const MOBILE_UPLOAD_MAX_WIDTH_PX = 2048;

/** POST /api/mobilePhotoUpload/session — desktop creates phone upload link */
export async function createMobilePhotoUploadSession({ purpose } = {}) {
  const body = {};
  if (purpose != null && String(purpose).trim() !== '') {
    body.purpose = String(purpose).trim();
  }
  const { data } = await api.post('/api/mobilePhotoUpload/session', body);
  return data;
}

/** GET /api/mobilePhotoUpload/session/:token/status — desktop checks if phone finished */
export async function fetchMobilePhotoUploadSessionStatus(token) {
  const { data } = await api.get(`/api/mobilePhotoUpload/session/${encodeURIComponent(token)}/status`);
  return data;
}

async function parseApiResponse(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    if (/^\s*</.test(text)) {
      return {
        error: `Server returned HTML instead of JSON (HTTP ${res.status}). Rebuild/deploy the backend with mobile upload routes, or scan a fresh QR code.`
      };
    }
    return { error: text.slice(0, 200) };
  }
}

function mobileUploadFetchError(res, data, fallback) {
  const serverMsg = data?.error || data?.message;
  if (serverMsg) {
    const err = new Error(serverMsg);
    err.response = { data, status: res.status };
    return err;
  }
  const err = new Error(`${fallback} (HTTP ${res.status})`);
  err.response = { data, status: res.status };
  return err;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchValidateUrl(url) {
  const res = await fetch(url, { credentials: 'omit', cache: 'no-store' });
  const data = await parseApiResponse(res);
  return { res, data };
}

function isValidSessionPayload(data) {
  return data != null && typeof data.valid === 'boolean';
}

/** GET /api/mobilePhotoUpload/validate?token= — phone page (no login cookie required) */
export async function fetchMobilePhotoUploadSessionPublic(token) {
  const trimmed = String(token ?? '').trim().replace(/\s+/g, '');
  if (!trimmed) {
    throw new Error('Missing upload token. Scan the QR code again from your computer.');
  }

  const validateUrl = `/api/mobilePhotoUpload/validate?token=${encodeURIComponent(trimmed)}`;
  const legacyUrl = `/api/mobilePhotoUpload/session/${encodeURIComponent(trimmed)}`;
  let lastErr;

  for (const url of [validateUrl, legacyUrl]) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const { res, data } = await fetchValidateUrl(url);
        if (res.ok && isValidSessionPayload(data)) {
          return data;
        }
        if (res.status === 404 && attempt < 3) {
          await sleep(400 * (attempt + 1));
          continue;
        }
        if (!res.ok) {
          lastErr = mobileUploadFetchError(res, data, 'Upload link is not valid');
          break;
        }
        lastErr = new Error(
          'Server returned an unexpected response. Run febeprod on the server, then tap New QR code.'
        );
        break;
      } catch (networkErr) {
        lastErr = new Error('Could not reach the server. Check Wi‑Fi or cellular data and scan a fresh QR code.');
        lastErr.cause = networkErr;
        break;
      }
    }
  }

  throw lastErr ?? new Error('Upload link is not valid');
}

function dataUrlToUploadBlob(dataUrl, fileName = 'photo.jpg') {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  const mime = match?.[1]?.trim() || 'image/jpeg';
  const base64 = match?.[2] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileName, { type: mime });
}

/** Resize HEIC/large gallery picks to JPEG before upload (avoids passthrough size limits). */
async function prepareMobileUploadFile(file) {
  try {
    const dataUrl = await normalizeVerificationImageFile(file, MOBILE_UPLOAD_MAX_WIDTH_PX);
    return dataUrlToUploadBlob(dataUrl, 'photo.jpg');
  } catch {
    return file;
  }
}

/** POST /api/mobilePhotoUpload/photo?token= — phone upload (no login cookie required) */
export async function uploadPhotoViaMobileSession(token, file) {
  const trimmed = String(token ?? '').trim().replace(/\s+/g, '');
  const uploadFile = await prepareMobileUploadFile(file);

  const formData = new FormData();
  formData.append('photo', uploadFile, uploadFile.name || 'photo.jpg');

  const url = `/api/mobilePhotoUpload/photo?token=${encodeURIComponent(trimmed)}`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      cache: 'no-store',
      body: formData
    });
  } catch (networkErr) {
    const err = new Error('Could not reach the server. Check your connection and try again.');
    err.cause = networkErr;
    throw err;
  }
  const data = await parseApiResponse(res);
  if (!res.ok) {
    if (res.status === 413 || data?.code === 'REQUEST_BODY_TOO_LARGE') {
      throw new Error(
        data?.error ||
          'Photo is too large for the server. Try taking a new photo with the camera button instead of gallery.'
      );
    }
    if (data?.code === 'FILE_TOO_LARGE') {
      throw new Error(data.error || 'Photo is too large. Try the camera button or a smaller image.');
    }
    throw mobileUploadFetchError(res, data, 'Upload failed');
  }
  return data;
}
