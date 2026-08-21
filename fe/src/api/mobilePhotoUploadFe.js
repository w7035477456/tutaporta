import api from './axios';

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

function fileExtensionFromName(fileName) {
  const name = String(fileName ?? '');
  const i = name.lastIndexOf('.');
  if (i <= 0 || i === name.length - 1) return '';
  return name.slice(i + 1).toLowerCase();
}

/** POST /api/mobilePhotoUpload/photo?token= — phone upload (no login cookie required) */
export async function uploadPhotoViaMobileSession(token, file) {
  const trimmed = String(token ?? '').trim().replace(/\s+/g, '');
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.readAsDataURL(file);
  });

  const fileExtension = fileExtensionFromName(file?.name);
  const body = { image: dataUrl };
  if (fileExtension) body.file_extension = fileExtension;
  if (file?.name) body.originalFileName = String(file.name);

  const url = `/api/mobilePhotoUpload/photo?token=${encodeURIComponent(trimmed)}`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'omit',
      cache: 'no-store',
      body: JSON.stringify(body)
    });
  } catch (networkErr) {
    const err = new Error('Could not reach the server. Check your connection and try again.');
    err.cause = networkErr;
    throw err;
  }
  const data = await parseApiResponse(res);
  if (!res.ok) {
    throw mobileUploadFetchError(res, data, 'Upload failed');
  }
  return data;
}
