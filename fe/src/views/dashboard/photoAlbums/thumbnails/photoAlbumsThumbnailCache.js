/**
 * Thumbnail blob → object URL cache for the album thumbnail tray.
 *
 * - One fetch per key at a time (concurrent loads share the same promise).
 * - Failed fetches retry with backoff, then reject; failures are never cached.
 * - Object URLs are reference counted: a URL is never revoked while any thumbnail
 *   still shows it. Unused URLs stay in a bounded idle pool (LRU) so re-mounts are instant.
 * - A `generation` guard drops results of loads that were invalidated mid-flight.
 */

const NON_IMAGE_TYPE_RE = /json|text\/html|text\/plain/i;

export function photoAlbumsThumbnailKey({ storageType, noteId, attachmentId }) {
  const note = Number(noteId);
  const attachment = Number(attachmentId);
  if (!Number.isFinite(note) || note < 1 || !Number.isFinite(attachment) || attachment < 1) return '';
  return `${String(storageType || 'default')}:${Math.trunc(note)}:${Math.trunc(attachment)}`;
}

function defaultSleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class PhotoAlbumsThumbnailFetchError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'PhotoAlbumsThumbnailFetchError';
    this.cause = cause;
  }
}

/**
 * @param {{
 *   fetchBlob: (params: { noteId: number, attachmentId: number, storageType: string|null }) => Promise<Blob>,
 *   createObjectUrl?: (blob: Blob) => string,
 *   revokeObjectUrl?: (url: string) => void,
 *   maxAttempts?: number,
 *   retryDelayMs?: number,
 *   maxIdleEntries?: number,
 *   sleep?: (ms: number) => Promise<void>
 * }} opts
 */
export function createPhotoAlbumsThumbnailCache({
  fetchBlob,
  createObjectUrl = (blob) => URL.createObjectURL(blob),
  revokeObjectUrl = (url) => URL.revokeObjectURL(url),
  maxAttempts = 3,
  retryDelayMs = 400,
  maxIdleEntries = 400,
  sleep = defaultSleep
}) {
  if (typeof fetchBlob !== 'function') throw new Error('fetchBlob is required');

  /** key → { url, mimeType } */
  const ready = new Map();
  /** key → Promise<{ url, mimeType }> */
  const inflight = new Map();
  /** key → refcount */
  const refs = new Map();
  /** key → generation (bumped by invalidate) */
  const generations = new Map();
  /** Insertion-ordered set of ready keys with refcount 0 (oldest first). */
  const idle = new Set();

  const refCount = (key) => refs.get(key) || 0;
  const generationOf = (key) => generations.get(key) || 0;

  function dropReady(key) {
    const entry = ready.get(key);
    ready.delete(key);
    idle.delete(key);
    if (entry?.url) {
      try {
        revokeObjectUrl(entry.url);
      } catch {
        // ignore
      }
    }
  }

  function trimIdle() {
    while (idle.size > maxIdleEntries) {
      const oldest = idle.values().next().value;
      dropReady(oldest);
    }
  }

  function markIdleIfUnused(key) {
    if (!ready.has(key)) return;
    if (refCount(key) > 0) {
      idle.delete(key);
      return;
    }
    idle.delete(key);
    idle.add(key);
    trimIdle();
  }

  async function fetchWithRetry(params) {
    let lastErr = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const blob = await fetchBlob(params);
        if (!blob || !(blob.size > 0)) throw new Error('Empty thumbnail');
        const type = String(blob.type || '');
        if (NON_IMAGE_TYPE_RE.test(type)) throw new Error(`Unexpected thumbnail type ${type}`);
        return blob;
      } catch (err) {
        lastErr = err;
        if (Number(err?.response?.status) === 404 || Number(err?.status) === 404) break;
        if (attempt < maxAttempts) await sleep(retryDelayMs * attempt);
      }
    }
    throw new PhotoAlbumsThumbnailFetchError('Thumbnail could not be loaded', lastErr);
  }

  /** Cached `{ url, mimeType }` for a key, or null. */
  function peek(key) {
    return ready.get(key) || null;
  }

  /** Resolve `{ url, mimeType }` for a thumbnail, fetching once if needed. */
  function load({ storageType = null, noteId, attachmentId }) {
    const key = photoAlbumsThumbnailKey({ storageType, noteId, attachmentId });
    if (!key) return Promise.reject(new Error('Invalid thumbnail key'));
    const hit = ready.get(key);
    if (hit) return Promise.resolve(hit);
    const pending = inflight.get(key);
    if (pending) return pending;

    const gen = generationOf(key);
    const params = { noteId: Number(noteId), attachmentId: Number(attachmentId), storageType };
    const promise = (async () => {
      try {
        const blob = await fetchWithRetry(params);
        if (generationOf(key) !== gen) {
          throw new PhotoAlbumsThumbnailFetchError('Thumbnail load was invalidated');
        }
        const entry = { url: createObjectUrl(blob), mimeType: String(blob.type || '') };
        ready.set(key, entry);
        markIdleIfUnused(key);
        return entry;
      } finally {
        if (inflight.get(key) === promise) inflight.delete(key);
      }
    })();
    inflight.set(key, promise);
    return promise;
  }

  /** A mounted thumbnail holds a reference so its URL is never revoked underneath it. */
  function retain(key) {
    if (!key) return;
    refs.set(key, refCount(key) + 1);
    idle.delete(key);
  }

  function release(key) {
    if (!key) return;
    const next = refCount(key) - 1;
    if (next > 0) refs.set(key, next);
    else refs.delete(key);
    markIdleIfUnused(key);
  }

  /** Forget a broken/stale thumbnail so the next load refetches. */
  function invalidate(key) {
    if (!key) return;
    generations.set(key, generationOf(key) + 1);
    inflight.delete(key);
    dropReady(key);
  }

  /** Drop every cached thumbnail for one album (e.g. after the album is deleted). */
  function invalidateNote({ storageType, noteId }) {
    const prefix = photoAlbumsThumbnailKey({ storageType, noteId, attachmentId: 1 }).replace(/:1$/, ':');
    if (!prefix) return;
    const keys = new Set([...ready.keys(), ...inflight.keys()]);
    for (const key of keys) {
      if (key.startsWith(prefix)) invalidate(key);
    }
  }

  function clear() {
    for (const key of [...ready.keys()]) dropReady(key);
    for (const key of [...inflight.keys()]) generations.set(key, generationOf(key) + 1);
    inflight.clear();
  }

  function stats() {
    return { ready: ready.size, inflight: inflight.size, idle: idle.size, retained: refs.size };
  }

  return { load, peek, retain, release, invalidate, invalidateNote, clear, stats };
}
