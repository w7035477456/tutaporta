/**
 * Hand off album HTML to a Full screen / Full Slide tab via localStorage
 * (sessionStorage is not shared across tabs).
 */

export const PHOTO_ALBUMS_PRESENTATION_STORAGE_PREFIX = 'paAlbumPresentation:';

/** Presentation payload TTL — enough for a long Full Slide loop. */
const PRESENTATION_TTL_MS = 2 * 60 * 60 * 1000;

export function storePhotoAlbumsPresentation(payload) {
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const storageKey = `${PHOTO_ALBUMS_PRESENTATION_STORAGE_PREFIX}${key}`;
  const body = {
    ...payload,
    expiresAt: Date.now() + PRESENTATION_TTL_MS
  };
  try {
    localStorage.setItem(storageKey, JSON.stringify(body));
  } catch {
    // Quota / private mode — caller may fall back to in-tab overlay.
    return null;
  }
  return key;
}

export function loadPhotoAlbumsPresentation(key) {
  const id = String(key || '').trim();
  if (!id) return null;
  const storageKey = `${PHOTO_ALBUMS_PRESENTATION_STORAGE_PREFIX}${id}`;
  let raw = null;
  try {
    raw = localStorage.getItem(storageKey);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data?.expiresAt && Date.now() > Number(data.expiresAt)) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
      return null;
    }
    return data;
  } catch {
    return null;
  }
}
