/**
 * Parse a data URL (supports codec params before base64, e.g. video/webm;codecs=vp9,opus).
 * @param {string} dataUrl
 * @returns {{ contentType: string, base64: string } | null}
 */
export function parseMediaDataUrl(dataUrl) {
  const raw = String(dataUrl ?? '').trim();
  if (!raw.startsWith('data:')) return null;
  const marker = ';base64,';
  const base64Index = raw.indexOf(marker);
  if (base64Index === -1) return null;
  const meta = raw.slice(5, base64Index).trim();
  const base64 = raw.slice(base64Index + marker.length).trim();
  if (!base64) return null;
  const contentType = meta.split(';')[0].trim().toLowerCase();
  if (!contentType) return null;
  return { contentType, base64 };
}

export function normalizeVideoContentType(contentType) {
  const raw = String(contentType ?? '').trim().toLowerCase();
  if (raw.startsWith('video/webm')) return 'video/webm';
  if (raw.startsWith('video/mp4')) return 'video/mp4';
  if (raw.startsWith('video/quicktime')) return 'video/quicktime';
  if (raw.startsWith('video/x-msvideo') || raw.includes('avi')) return 'video/x-msvideo';
  if (raw.startsWith('video/x-ms-wmv') || raw.includes('wmv')) return 'video/x-ms-wmv';
  if (raw.startsWith('audio/mpeg') || raw.startsWith('audio/mp3')) return 'audio/mpeg';
  return raw;
}
