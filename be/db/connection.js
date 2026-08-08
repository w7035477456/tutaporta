import { createRequire } from 'module';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { getDBConfig, getDBSchema } from '../config/envConfig.js';
import { recordPgQueryError, setPgQueryErrorCountsPool } from './pgQueryErrorCounts.js';
import { isRecordVaultBridgeStandalone } from '../recordVaultBridge/standaloneMode.js';
import { loadHomeEnvExpanded } from '../utils/expandHomeEnv.js';

const STANDALONE = isRecordVaultBridgeStandalone();
const require = createRequire(import.meta.url);
const pkg = STANDALONE ? { Pool: class Pool {}, Client: { prototype: {} } } : require('pg');
const { Pool } = pkg;

const TARGET_APP_SCHEMA = 'helloworldjunktest';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BE_ROOT = path.resolve(__dirname, '..');

const homeEnvPath = path.join(os.homedir(), '.ssh', 'be', '.env');
if (!STANDALONE && !process.env.DB_HOST) {
  console.log('[connection] DB_HOST not set – attempting fallback load from:', homeEnvPath);
  loadHomeEnvExpanded(homeEnvPath, { override: false });
}

let cfg = getDBConfig();
if (!STANDALONE && (!cfg.database || !cfg.user)) {
  console.error('Error: environment variable DB_NAME and DB_USER missing');
  console.error('Fix: set DB_NAME and DB_USER in ~/.ssh/be/.env');
  process.exit(9);
}

const REFRESH_MS = 60 * 1000;

/** node-pg pool size (set PG_POOL_MAX in ~/.ssh/be/.env). Used for local busy %. */
function readPoolMax() {
  const n = Number(String(process.env.PG_POOL_MAX ?? process.env.DB_POOL_MAX ?? '10').trim());
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.trunc(n), 100) : 10;
}

/** How often to sample Postgres server connection count (ms). Set PG_BUSY_SAMPLE_MS=0 to disable. */
function readBusySampleMs() {
  const n = Number(String(process.env.PG_BUSY_SAMPLE_MS ?? '1000').trim());
  if (!Number.isFinite(n) || n < 0) return 1000;
  return Math.trunc(n);
}

const PG_BUSY_SAMPLE_SQL = `
  SELECT
    (SELECT count(*)::int
       FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()) AS backend_count,
    (SELECT current_setting('max_connections')::int) AS max_connections,
    (SELECT current_setting('superuser_reserved_connections')::int) AS reserved_connections
`;

let inFlightQueries = 0;
let cachedServerBusyPct = 0;
let busySampleInFlight = false;

function poolMaxConnections(pool) {
  return Number(pool?.options?.max) || readPoolMax();
}

/** Local app pool pressure: checked-out clients + wait queue vs pool max. */
function getPoolBusyPercent(pool) {
  const max = poolMaxConnections(pool);
  const active = Math.max(0, (pool?.totalCount ?? 0) - (pool?.idleCount ?? 0));
  const waiting = pool?.waitingCount ?? 0;
  return Math.min(100, Math.round(((active + waiting) / max) * 100));
}

/** In-flight queries on this Node process (instant signal during UI test bursts). */
function getInFlightBusyPercent(pool) {
  const max = poolMaxConnections(pool);
  return Math.min(100, Math.round((inFlightQueries / max) * 100));
}

/**
 * Combined Postgres busy estimate for console logs: 0% idle, 100% saturated.
 * Uses max(local pool %, in-flight %, cached server backend %).
 */
function getPostgresBusyPercent(pool) {
  const target = pool ?? currentPool;
  return Math.min(
    100,
    Math.max(getPoolBusyPercent(target), getInFlightBusyPercent(target), cachedServerBusyPct)
  );
}

function isBusySampleSql(sqlText) {
  return /pg_stat_activity|max_connections|superuser_reserved_connections/i.test(String(sqlText ?? ''));
}

async function samplePostgresServerBusy(pool) {
  if (busySampleInFlight) return cachedServerBusyPct;
  busySampleInFlight = true;
  try {
    const result = await pool.query(PG_BUSY_SAMPLE_SQL);
    const row = result.rows?.[0] ?? {};
    const backends = Math.max(0, Number(row.backend_count) || 0);
    const maxConn = Math.max(1, Number(row.max_connections) || 100);
    const reserved = Math.max(0, Number(row.reserved_connections) || 3);
    const usableMax = Math.max(1, maxConn - reserved);
    cachedServerBusyPct = Math.min(100, Math.round((backends / usableMax) * 100));
  } catch {
    // keep last sample
  } finally {
    busySampleInFlight = false;
  }
  return cachedServerBusyPct;
}

function startPostgresBusySampler(pool) {
  const intervalMs = readBusySampleMs();
  if (intervalMs <= 0) return;
  void samplePostgresServerBusy(pool);
  setInterval(() => {
    void samplePostgresServerBusy(currentPool);
  }, intervalMs);
}

/** Verbose pool/query logging (set SHOW_PG_PERFORMANCE_LOG=false in ~/.ssh/be/.env to disable). */
function isPgLogEnabled() {
  const raw = String(process.env.SHOW_PG_PERFORMANCE_LOG ?? 'true').trim().toLowerCase();
  return !['0', 'false', 'no', 'off', 'n'].includes(raw);
}

/** [p N%, Mmsec] — busy % (server estimate) + per-query Postgres time when measured. */
function formatPgPerfPrefix(pool, delayMs = null) {
  const pct = getPostgresBusyPercent(pool);
  const ms = delayMs != null ? Math.max(0, Math.round(delayMs)) : 0;
  return `[p ${pct}%, ${ms}msec]`;
}

function pgLog(...args) {
  if (!isPgLogEnabled()) return;
  console.log(formatPgPerfPrefix(currentPool), ...args);
}

function pgLogQueryDelay(delayMs, ...args) {
  if (!isPgLogEnabled()) return;
  console.log(formatPgPerfPrefix(currentPool, delayMs), ...args);
}

function pgCallerLabel() {
  const stack = new Error().stack || '';
  const lines = stack.split('\n');
  for (const line of lines) {
    if (/connection\.js|loggedConnect|node_modules[\\/]pg/.test(line)) continue;
    const paren = line.match(/\(([^)]+)\)/);
    const at = line.match(/\bat\s+(.+)$/);
    const raw = (paren?.[1] || at?.[1] || '').trim();
    if (!raw) continue;
    const normalized = raw.replace(`file://${BE_ROOT}/`, '').replace(`${BE_ROOT}/`, '').replace(/^be\//, '');
    if (normalized.includes('/be/') || normalized.startsWith('routes/') || normalized.startsWith('middleware/')) {
      return normalized.includes('/be/') ? normalized.split('/be/').pop() : normalized;
    }
    if (normalized.endsWith('.js')) return normalized;
  }
  return 'app';
}

function formatSqlForLog(sqlText) {
  const one = String(sqlText ?? '').replace(/\s+/g, ' ').trim();
  if (!one) return '';
  return one.length > 240 ? `${one.slice(0, 237)}...` : one;
}

function extractSqlFromQueryArgs(config) {
  if (typeof config === 'string') return config;
  if (config && typeof config === 'object' && typeof config.text === 'string') return config.text;
  return '';
}

let poolClientSeq = 0;

function attachPoolPgLogging(pool) {
  pool.on('connect', (client) => {
    poolClientSeq += 1;
    const seq = poolClientSeq;
    void client
      .query("SET client_encoding TO 'UTF8'")
      .then(() => {
        const pid = client.processID != null ? client.processID : '?';
        pgLog(`pool client #${seq} connected (backend pid=${pid})`);
        pgLog("SET client_encoding TO 'UTF8'");
      })
      .catch((err) => {
        console.error('[pg] SET client_encoding failed:', err?.message || err);
      });
  });

}

function createPool() {
  const pool = new Pool({
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    max: readPoolMax()
  });
  attachPoolPgLogging(pool);
  return pool;
}

function rewriteSchemaQuery(sqlText) {
  if (typeof sqlText !== 'string') return sqlText;
  const schema = TARGET_APP_SCHEMA;
  const quotedSchema = `"${String(schema).replace(/"/g, '""')}"`;
  return sqlText
    .replace(/\bpublic\./g, `${quotedSchema}.`)
    .replace(/table_schema\s*=\s*'public'/gi, `table_schema = '${schema}'`);
}

function createNoopPool() {
  const empty = { rows: [], rowCount: 0 };
  const client = {
    query: async () => empty,
    release() {}
  };
  return {
    query: async () => empty,
    connect: async () => client,
    on() {},
    end: async () => {},
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0,
    options: { max: 1 }
  };
}

let currentPool;
let poolProxy;

if (STANDALONE) {
  currentPool = createNoopPool();
  poolProxy = currentPool;
  setPgQueryErrorCountsPool(poolProxy);
} else {
  const originalClientQuery = pkg.Client.prototype.query;
  pkg.Client.prototype.query = function patchedQuery(config, values, callback) {
    const rawSql = extractSqlFromQueryArgs(config);
    const skipBusyLog = isBusySampleSql(rawSql);
    const shouldLogQuery = rawSql && isPgLogEnabled() && !skipBusyLog;
    const queryStartMs = shouldLogQuery ? performance.now() : null;

    inFlightQueries += 1;

    const logQueryFinished = (err) => {
      if (err) {
        recordPgQueryError(rawSql);
      }
      if (!shouldLogQuery) return;
      const delayMs = performance.now() - queryStartMs;
      pgLogQueryDelay(delayMs, 'query +', pgCallerLabel());
      pgLogQueryDelay(delayMs, formatSqlForLog(rewriteSchemaQuery(rawSql)));
      if (err) pgLogQueryDelay(delayMs, 'query error:', err?.message || err);
    };

    const trackDone = () => {
      inFlightQueries = Math.max(0, inFlightQueries - 1);
    };

    const invoke = (cfgArg, valsArg, cbArg) => {
      if (typeof cbArg === 'function') {
        return originalClientQuery.call(this, cfgArg, valsArg, (err, result) => {
          trackDone();
          logQueryFinished(err);
          cbArg(err, result);
        });
      }
      const promise = originalClientQuery.call(this, cfgArg, valsArg, cbArg);
      if (promise && typeof promise.then === 'function') {
        return promise.then(
          (result) => {
            trackDone();
            logQueryFinished(null);
            return result;
          },
          (err) => {
            trackDone();
            logQueryFinished(err);
            throw err;
          }
        );
      }
      trackDone();
      logQueryFinished(null);
      return promise;
    };

    if (typeof config === 'string') {
      return invoke(rewriteSchemaQuery(config), values, callback);
    }
    if (config && typeof config === 'object' && typeof config.text === 'string') {
      const rewrittenConfig = { ...config, text: rewriteSchemaQuery(config.text) };
      return invoke(rewrittenConfig, values, callback);
    }
    return invoke(config, values, callback);
  };

  // Proxy so pool.query() etc. always use current pool
  currentPool = createPool();

  currentPool.on('error', (err) => {
    console.error('[pg] Unexpected error on idle client', err);
    console.error('Please check your database connection settings in ~/.ssh/be/.env');
    process.exit(-1);
  });

  poolProxy = new Proxy(currentPool, {
    get(_, prop) {
      return currentPool[prop];
    }
  });

  // Refresh pool every minute from envConfig
  setInterval(() => {
    const next = getDBConfig();
    const same =
      next.host === cfg.host &&
      next.port === cfg.port &&
      next.database === cfg.database &&
      next.user === cfg.user &&
      next.password === cfg.password;
    if (!same) {
      cfg = next;
      const old = currentPool;
      currentPool = createPool();
      currentPool.on('error', (err) => {
        console.error('[connection] Pool error after refresh:', err.message);
      });
      old.end().catch(() => {});
      console.log('[connection] DB config refreshed from ~/.ssh/be/.env');
    }
  }, REFRESH_MS);

  console.log('[connection] DB_HOST:', cfg.host, 'DB_PORT:', cfg.port, 'DB_NAME:', cfg.database, 'DB_SCHEMA:', getDBSchema());
  if (isPgLogEnabled()) {
    console.log(
      '[connection] SHOW_PG_PERFORMANCE_LOG enabled — SQL logged as [p N%, Mmsec] (busy % + query time; set SHOW_PG_PERFORMANCE_LOG=false to disable)'
    );
    startPostgresBusySampler(currentPool);
  }

  currentPool
    .query('SELECT NOW()')
    .then(() => pgLog('database connection test successful (SELECT NOW())'))
    .catch((err) => {
      console.error('[pg] Database connection test failed:', err.message);
      process.exit(9);
    });

  setPgQueryErrorCountsPool(poolProxy);
}

export default poolProxy;
export { getDBSchema, getPostgresBusyPercent };
