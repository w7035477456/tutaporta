import { describe, expect, it, vi } from 'vitest';
import { createPhotoAlbumsThumbnailCache, photoAlbumsThumbnailKey } from './photoAlbumsThumbnailCache';

function fakeBlob(type = 'image/jpeg', size = 10) {
  return { type, size };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(overrides = {}) {
  let urlSeq = 0;
  const revoked = [];
  const fetchBlob = overrides.fetchBlob || vi.fn(async () => fakeBlob());
  const cache = createPhotoAlbumsThumbnailCache({
    fetchBlob,
    createObjectUrl: () => {
      urlSeq += 1;
      return `blob:${urlSeq}`;
    },
    revokeObjectUrl: (url) => revoked.push(url),
    sleep: async () => {},
    ...overrides
  });
  return { cache, fetchBlob, revoked };
}

const P = { storageType: 'local', noteId: 10, attachmentId: 3 };
const KEY = photoAlbumsThumbnailKey(P);

describe('photoAlbumsThumbnailKey', () => {
  it('builds a stable key and rejects invalid ids', () => {
    expect(KEY).toBe('local:10:3');
    expect(photoAlbumsThumbnailKey({ noteId: 10, attachmentId: 3 })).toBe('default:10:3');
    expect(photoAlbumsThumbnailKey({ noteId: 0, attachmentId: 3 })).toBe('');
    expect(photoAlbumsThumbnailKey({ noteId: 1, attachmentId: 'x' })).toBe('');
  });

  it('separates storage types so the same ids never collide', () => {
    expect(photoAlbumsThumbnailKey({ ...P, storageType: 'cloud' })).not.toBe(KEY);
  });
});

describe('createPhotoAlbumsThumbnailCache', () => {
  it('requires a fetcher', () => {
    expect(() => createPhotoAlbumsThumbnailCache({})).toThrow();
  });

  it('dedupes concurrent loads into one fetch', async () => {
    const d = deferred();
    const fetchBlob = vi.fn(() => d.promise);
    const { cache } = setup({ fetchBlob });
    const a = cache.load(P);
    const b = cache.load(P);
    d.resolve(fakeBlob());
    const [ra, rb] = await Promise.all([a, b]);
    expect(fetchBlob).toHaveBeenCalledTimes(1);
    expect(fetchBlob).toHaveBeenCalledWith({ noteId: 10, attachmentId: 3, storageType: 'local' });
    expect(ra).toBe(rb);
    expect(ra.url).toBe('blob:1');
    expect(ra.mimeType).toBe('image/jpeg');
  });

  it('serves later loads from cache without refetching', async () => {
    const { cache, fetchBlob } = setup();
    await cache.load(P);
    await cache.load(P);
    expect(fetchBlob).toHaveBeenCalledTimes(1);
    expect(cache.peek(KEY).url).toBe('blob:1');
  });

  it('retries transient failures and then succeeds', async () => {
    const fetchBlob = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(fakeBlob('', 0))
      .mockResolvedValueOnce(fakeBlob());
    const { cache } = setup({ fetchBlob });
    const entry = await cache.load(P);
    expect(fetchBlob).toHaveBeenCalledTimes(3);
    expect(entry.url).toBe('blob:1');
  });

  it('rejects after max attempts and does not cache the failure', async () => {
    const fetchBlob = vi.fn().mockRejectedValue(new Error('down'));
    const { cache } = setup({ fetchBlob, maxAttempts: 2 });
    await expect(cache.load(P)).rejects.toThrow('Thumbnail could not be loaded');
    expect(fetchBlob).toHaveBeenCalledTimes(2);
    expect(cache.peek(KEY)).toBeNull();
    fetchBlob.mockResolvedValue(fakeBlob());
    await expect(cache.load(P)).resolves.toMatchObject({ url: 'blob:1' });
  });

  it('does not retry a 404', async () => {
    const err = Object.assign(new Error('nf'), { response: { status: 404 } });
    const fetchBlob = vi.fn().mockRejectedValue(err);
    const { cache } = setup({ fetchBlob });
    await expect(cache.load(P)).rejects.toThrow();
    expect(fetchBlob).toHaveBeenCalledTimes(1);
  });

  it('treats JSON / HTML error bodies as failures', async () => {
    const fetchBlob = vi.fn().mockResolvedValue(fakeBlob('application/json'));
    const { cache } = setup({ fetchBlob, maxAttempts: 1 });
    await expect(cache.load(P)).rejects.toThrow();
  });

  it('never revokes a URL that is still retained, even under idle-pool pressure', async () => {
    const { cache, revoked } = setup({ maxIdleEntries: 0 });
    cache.retain(KEY);
    await cache.load(P);
    await cache.load({ ...P, attachmentId: 4 });
    expect(revoked).toEqual(['blob:2']);
    expect(cache.peek(KEY).url).toBe('blob:1');
    cache.release(KEY);
    expect(revoked).toEqual(['blob:2', 'blob:1']);
    expect(cache.peek(KEY)).toBeNull();
  });

  it('keeps unused URLs in a bounded LRU idle pool', async () => {
    const { cache, revoked } = setup({ maxIdleEntries: 2 });
    await cache.load({ ...P, attachmentId: 1 });
    await cache.load({ ...P, attachmentId: 2 });
    await cache.load({ ...P, attachmentId: 3 });
    expect(revoked).toEqual(['blob:1']);
    expect(cache.stats().idle).toBe(2);
  });

  it('a released-then-reacquired thumbnail reuses the same URL', async () => {
    const { cache, fetchBlob, revoked } = setup();
    cache.retain(KEY);
    await cache.load(P);
    cache.release(KEY);
    cache.retain(KEY);
    expect(cache.peek(KEY).url).toBe('blob:1');
    expect(revoked).toEqual([]);
    expect(fetchBlob).toHaveBeenCalledTimes(1);
  });

  it('refcounts multiple holders of the same key', async () => {
    const { cache, revoked } = setup({ maxIdleEntries: 0 });
    cache.retain(KEY);
    cache.retain(KEY);
    await cache.load(P);
    cache.release(KEY);
    expect(revoked).toEqual([]);
    cache.release(KEY);
    expect(revoked).toEqual(['blob:1']);
  });

  it('invalidate revokes and forces a refetch', async () => {
    const { cache, fetchBlob, revoked } = setup();
    await cache.load(P);
    cache.invalidate(KEY);
    expect(revoked).toEqual(['blob:1']);
    const entry = await cache.load(P);
    expect(entry.url).toBe('blob:2');
    expect(fetchBlob).toHaveBeenCalledTimes(2);
  });

  it('drops the result of a load invalidated mid-flight', async () => {
    const first = deferred();
    const fetchBlob = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(fakeBlob('image/png'));
    const { cache } = setup({ fetchBlob, maxAttempts: 1 });
    const stale = cache.load(P);
    cache.invalidate(KEY);
    const fresh = cache.load(P);
    first.resolve(fakeBlob('image/jpeg'));
    await expect(stale).rejects.toThrow();
    await expect(fresh).resolves.toMatchObject({ mimeType: 'image/png' });
    expect(cache.peek(KEY).mimeType).toBe('image/png');
  });

  it('invalidateNote only clears that album', async () => {
    const { cache } = setup();
    await cache.load({ storageType: 'local', noteId: 10, attachmentId: 1 });
    await cache.load({ storageType: 'local', noteId: 100, attachmentId: 1 });
    cache.invalidateNote({ storageType: 'local', noteId: 10 });
    expect(cache.peek('local:10:1')).toBeNull();
    expect(cache.peek('local:100:1')).not.toBeNull();
  });

  it('rejects invalid ids without fetching', async () => {
    const { cache, fetchBlob } = setup();
    await expect(cache.load({ noteId: 0, attachmentId: 1 })).rejects.toThrow();
    expect(fetchBlob).not.toHaveBeenCalled();
  });
});
