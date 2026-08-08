/**
 * In-process cache for information_schema / table-exists probes.
 * Disable with CACHE_DB_SCHEMA_METADATA=false in ~/.ssh/be/.env (reloads on env file change via envConfig).
 */

const cache = new Map();

export function isDbSchemaCacheEnabled() {
  return String(process.env.CACHE_DB_SCHEMA_METADATA ?? 'true').trim().toLowerCase() !== 'false';
}

/**
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} loader
 * @returns {Promise<T>}
 */
export async function withSchemaCache(key, loader) {
  if (!isDbSchemaCacheEnabled()) {
    return loader();
  }
  if (cache.has(key)) {
    return cache.get(key);
  }
  const value = await loader();
  cache.set(key, value);
  return value;
}

/** Clear all entries (tests / migrations). */
export function clearSchemaMetadataCache() {
  cache.clear();
}
