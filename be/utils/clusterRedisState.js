import { getSingleLoginRedis } from './singleLoginSession.js';

/** In-process fallback when Redis is unavailable (Mac single-node dev only). */
const memoryFallback = new Map();

function redis() {
  return getSingleLoginRedis();
}

export function isClusterRedisAvailable() {
  return Boolean(redis());
}

function memoryKey(key) {
  return `mem:${key}`;
}

export async function clusterRedisGet(key) {
  const client = redis();
  if (!client) {
    const entry = memoryFallback.get(memoryKey(key));
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      memoryFallback.delete(memoryKey(key));
      return null;
    }
    return entry.value;
  }
  try {
    return await client.get(key);
  } catch {
    return null;
  }
}

export async function clusterRedisSet(key, value, ttlSec = null) {
  const client = redis();
  if (!client) {
    const expiresAt = ttlSec != null && Number(ttlSec) > 0 ? Date.now() + Number(ttlSec) * 1000 : null;
    memoryFallback.set(memoryKey(key), { value, expiresAt });
    return true;
  }
  try {
    if (ttlSec != null && Number(ttlSec) > 0) {
      await client.set(key, value, 'EX', Math.trunc(Number(ttlSec)));
    } else {
      await client.set(key, value);
    }
    return true;
  } catch {
    return false;
  }
}

export async function clusterRedisDel(...keys) {
  if (!keys.length) return 0;
  const client = redis();
  if (!client) {
    let n = 0;
    for (const key of keys) {
      if (memoryFallback.delete(memoryKey(key))) n += 1;
    }
    return n;
  }
  try {
    return await client.del(...keys);
  } catch {
    return 0;
  }
}

export async function clusterRedisGetJson(key) {
  const raw = await clusterRedisGet(key);
  if (raw == null || raw === '') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clusterRedisSetJson(key, obj, ttlSec = null) {
  return clusterRedisSet(key, JSON.stringify(obj), ttlSec);
}

export async function clusterRedisSAdd(key, member) {
  const value = String(member ?? '').trim();
  if (!value) return 0;
  const client = redis();
  if (!client) {
    const memKey = memoryKey(key);
    let set = memoryFallback.get(memKey)?.value;
    if (!(set instanceof Set)) {
      set = new Set();
      memoryFallback.set(memKey, { value: set, expiresAt: null });
    }
    const before = set.size;
    set.add(value);
    return set.size > before ? 1 : 0;
  }
  try {
    return await client.sadd(key, value);
  } catch {
    return 0;
  }
}

export async function clusterRedisSMembers(key) {
  const client = redis();
  if (!client) {
    const set = memoryFallback.get(memoryKey(key))?.value;
    return set instanceof Set ? [...set] : [];
  }
  try {
    const members = await client.smembers(key);
    return Array.isArray(members) ? members : [];
  } catch {
    return [];
  }
}

export async function clusterRedisSRem(key, member) {
  const value = String(member ?? '').trim();
  if (!value) return 0;
  const client = redis();
  if (!client) {
    const set = memoryFallback.get(memoryKey(key))?.value;
    if (!(set instanceof Set)) return 0;
    return set.delete(value) ? 1 : 0;
  }
  try {
    return await client.srem(key, value);
  } catch {
    return 0;
  }
}

export async function clusterRedisSCard(key) {
  const client = redis();
  if (!client) {
    const set = memoryFallback.get(memoryKey(key))?.value;
    return set instanceof Set ? set.size : 0;
  }
  try {
    return Number(await client.scard(key)) || 0;
  } catch {
    return 0;
  }
}

export async function clusterRedisIncrBy(key, delta) {
  const n = Math.trunc(Number(delta));
  if (!Number.isFinite(n) || n === 0) return 0;
  const client = redis();
  if (!client) {
    const memKey = memoryKey(key);
    const entry = memoryFallback.get(memKey);
    const current = Number(entry?.value) || 0;
    const next = current + n;
    memoryFallback.set(memKey, { value: String(next), expiresAt: entry?.expiresAt ?? null });
    return next;
  }
  try {
    return await client.incrby(key, n);
  } catch {
    return 0;
  }
}

export async function clusterRedisGetInt(key) {
  const raw = await clusterRedisGet(key);
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/** SET key value NX EX ttl — returns true when lock acquired. */
export async function clusterRedisSetNxEx(key, value, ttlSec) {
  const client = redis();
  const ttl = Math.trunc(Number(ttlSec));
  if (!client) {
    const memKey = memoryKey(key);
    if (memoryFallback.has(memKey)) return false;
    memoryFallback.set(memKey, {
      value: String(value),
      expiresAt: ttl > 0 ? Date.now() + ttl * 1000 : null
    });
    return true;
  }
  try {
    const result = await client.set(key, String(value), 'NX', 'EX', ttl > 0 ? ttl : 60);
    return result === 'OK';
  } catch {
    return false;
  }
}

export async function clusterRedisRPush(key, value) {
  const item = String(value ?? '').trim();
  if (!item) return 0;
  const client = redis();
  if (!client) {
    const memKey = memoryKey(key);
    let list = memoryFallback.get(memKey)?.value;
    if (!Array.isArray(list)) {
      list = [];
      memoryFallback.set(memKey, { value: list, expiresAt: null });
    }
    list.push(item);
    return list.length;
  }
  try {
    return await client.rpush(key, item);
  } catch {
    return 0;
  }
}

export async function clusterRedisLLen(key) {
  const client = redis();
  if (!client) {
    const list = memoryFallback.get(memoryKey(key))?.value;
    return Array.isArray(list) ? list.length : 0;
  }
  try {
    return await client.llen(key);
  } catch {
    return 0;
  }
}

/** Peek list items without removing (inclusive start/stop, Redis LRANGE semantics). */
export async function clusterRedisLRange(key, start = 0, stop = -1) {
  const client = redis();
  if (!client) {
    const list = memoryFallback.get(memoryKey(key))?.value;
    if (!Array.isArray(list) || !list.length) return [];
    const lo = Math.max(0, Number(start) || 0);
    const hi = stop < 0 ? list.length - 1 : Math.min(list.length - 1, Number(stop) || 0);
    if (hi < lo) return [];
    return list.slice(lo, hi + 1).map((v) => String(v ?? ''));
  }
  try {
    const rows = await client.lrange(key, start, stop);
    return Array.isArray(rows) ? rows.map((v) => String(v ?? '')) : [];
  } catch {
    return [];
  }
}

export async function clusterRedisLPop(key) {
  const client = redis();
  if (!client) {
    const memKey = memoryKey(key);
    const list = memoryFallback.get(memKey)?.value;
    if (!Array.isArray(list) || !list.length) return null;
    const item = list.shift();
    if (!list.length) memoryFallback.delete(memKey);
    return item ?? null;
  }
  try {
    return await client.lpop(key);
  } catch {
    return null;
  }
}

/** Atomic rename. Returns false when source key is missing. */
export async function clusterRedisRename(fromKey, toKey) {
  const client = redis();
  if (!client) {
    const from = memoryKey(fromKey);
    const to = memoryKey(toKey);
    if (!memoryFallback.has(from)) return false;
    memoryFallback.set(to, memoryFallback.get(from));
    memoryFallback.delete(from);
    return true;
  }
  try {
    await client.rename(fromKey, toKey);
    return true;
  } catch {
    return false;
  }
}

/** GET then DEL in one round-trip when Redis supports GETDEL; otherwise GET+DEL. */
export async function clusterRedisTakeRaw(key) {
  const client = redis();
  if (!client) {
    const memKey = memoryKey(key);
    const entry = memoryFallback.get(memKey);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      memoryFallback.delete(memKey);
      return null;
    }
    memoryFallback.delete(memKey);
    return entry.value ?? null;
  }
  try {
    if (typeof client.getdel === 'function') {
      return await client.getdel(key);
    }
    const raw = await client.get(key);
    if (raw != null) await client.del(key);
    return raw;
  } catch {
    return null;
  }
}

/** GET then DEL in one round-trip when Redis supports GETDEL; otherwise GET+DEL. */
export async function clusterRedisTakeInt(key) {
  const raw = await clusterRedisTakeRaw(key);
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}
