const MAX_LINES = 40;
const lines = [];

function timestamp() {
  return new Date().toISOString().slice(11, 23);
}

export function isMobilePhotoUploadDebugEnabled() {
  if (import.meta.env.DEV) return true;
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('debug') === '1' || params.get('mupDebug') === '1') return true;
      if (window.localStorage?.getItem('mobilePhotoUploadDebug') === '1') return true;
    }
  } catch {
    // ignore
  }
  return String(import.meta.env.VITE_MOBILE_PHOTO_UPLOAD_DEBUG || '').toLowerCase() === 'true';
}

/** Append a line to the in-memory ring buffer and mirror to console when debug is on. */
export function mobilePhotoUploadDebugLog(step, detail) {
  const line = { at: timestamp(), step, detail };
  lines.push(line);
  while (lines.length > MAX_LINES) lines.shift();
  if (!isMobilePhotoUploadDebugEnabled()) return;
  if (detail !== undefined) {
    console.log('[mobilePhotoUpload:fe]', step, detail);
  } else {
    console.log('[mobilePhotoUpload:fe]', step);
  }
}

export function getMobilePhotoUploadDebugLines() {
  return [...lines];
}

export function summarizeFetchResponse(res, text) {
  const contentType = String(res.headers?.get?.('content-type') || '');
  const isHtml = /^\s*</.test(String(text || '')) || contentType.includes('text/html');
  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    contentType,
    isHtml,
    bodyPreview: String(text || '').slice(0, 240),
    bodyLength: String(text || '').length
  };
}
