/** Bumped when album photos change so /api/photo URLs get ?v= cache busting. */
let photosAlbumCacheBust = Date.now();
const listeners = new Set();

export function getPhotosAlbumCacheBust() {
  return photosAlbumCacheBust;
}

export function bumpPhotosAlbumCacheBust(nextValue) {
  photosAlbumCacheBust =
    nextValue == null || nextValue === '' ? Date.now() : Number(nextValue) || Date.now();
  listeners.forEach((listener) => {
    try {
      listener(photosAlbumCacheBust);
    } catch {
      // ignore listener errors
    }
  });
  return photosAlbumCacheBust;
}

export function subscribePhotosAlbumCacheBust(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function withPhotoApiCacheBust(url) {
  const raw = String(url ?? '').trim();
  if (!raw || !/\/api\/photo\/\d+/i.test(raw)) return raw;
  const withoutHash = raw.split('#')[0];
  const queryIndex = withoutHash.indexOf('?');
  const pathOnly = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const params = new URLSearchParams(queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : '');
  params.set('v', String(getPhotosAlbumCacheBust()));
  const query = params.toString();
  return query ? `${pathOnly}?${query}` : pathOnly;
}
