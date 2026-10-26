import { useCallback, useEffect, useRef, useState } from 'react';
import { photoAlbumsThumbnailCache } from './photoAlbumsThumbnailStore';
import { photoAlbumsThumbnailKey } from './photoAlbumsThumbnailCache';

const MAX_RENDER_RETRIES = 2;

function stateFor(cache, key) {
  const hit = key ? cache.peek(key) : null;
  if (hit) return { key, status: 'ready', url: hit.url, mimeType: hit.mimeType };
  return { key, status: key ? 'loading' : 'idle', url: '', mimeType: '' };
}

/**
 * Load one attachment thumbnail through the shared cache.
 * `reportBroken()` is for `<img onError>`: it drops the cached URL and refetches (bounded).
 *
 * @returns {{ status: 'idle'|'loading'|'ready'|'error', url: string, mimeType: string, reportBroken: () => void }}
 */
export default function usePhotoAlbumsThumbnail({
  noteId,
  attachmentId,
  storageType = null,
  cache = photoAlbumsThumbnailCache
}) {
  const key = photoAlbumsThumbnailKey({ storageType, noteId, attachmentId });
  const [state, setState] = useState(() => stateFor(cache, key));
  const [reloadNonce, setReloadNonce] = useState(0);
  const retriesRef = useRef({ key, count: 0 });
  if (retriesRef.current.key !== key) retriesRef.current = { key, count: 0 };

  useEffect(() => {
    if (!key) {
      setState(stateFor(cache, ''));
      return undefined;
    }
    let active = true;
    cache.retain(key);
    const initial = stateFor(cache, key);
    setState(initial);
    if (initial.status !== 'ready') {
      cache
        .load({ storageType, noteId, attachmentId })
        .then((entry) => {
          if (active) setState({ key, status: 'ready', url: entry.url, mimeType: entry.mimeType });
        })
        .catch(() => {
          if (active) setState({ key, status: 'error', url: '', mimeType: '' });
        });
    }
    return () => {
      active = false;
      cache.release(key);
    };
  }, [cache, key, reloadNonce, storageType, noteId, attachmentId]);

  const reportBroken = useCallback(() => {
    if (!key) return;
    cache.invalidate(key);
    if (retriesRef.current.count >= MAX_RENDER_RETRIES) {
      setState({ key, status: 'error', url: '', mimeType: '' });
      return;
    }
    retriesRef.current.count += 1;
    setReloadNonce((n) => n + 1);
  }, [cache, key]);

  const current = state.key === key ? state : stateFor(cache, key);
  return { status: current.status, url: current.url, mimeType: current.mimeType, reportBroken };
}
