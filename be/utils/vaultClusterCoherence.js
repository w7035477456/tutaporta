/**
 * Cluster coherence for TutaPhoto (photo_albums) / TutaNotes (record_vault) vaults.
 *
 * Each Node worker keeps the member's SQLite vault open in memory (sql.js). With several
 * PM2 workers and/or web servers behind round-robin, those in-memory copies used to drift:
 * a note created on worker A was "Note not found" on worker B, and whichever worker flushed
 * vault.db last overwrote the others.
 *
 * Postgres (`outdateddbsnapshotoct2024.vault_cluster_state`) is the single source of truth for:
 *   - unlock registry (mount path, generation, expiry) — replaces the Redis-only registry
 *   - db_version — bumped after every committed vault.db write
 *   - a lease lock — serializes vault writes for one member across all workers/servers
 *
 * Per request (see createVaultClusterCoherenceMiddleware):
 *   - read the member's state; drop local sessions that were locked/re-unlocked elsewhere
 *   - write methods take the lease lock first
 *   - reload vault.db from disk when the local copy is older than db_version
 *   - write methods persist vault.db + bump db_version BEFORE the response is sent,
 *     so the next request (any worker) reads the change
 *
 * Every query here (SELECTs included) must hit the Primary, never a read replica: replica
 * lag would hand a worker a stale db_version / unlock state and bring back the stale-copy bug.
 *
 * Requires every worker to see the same vault mount path (same box, or shared storage).
 * Disabled in the standalone desktop USB bridge (single process, no Postgres).
 */
import crypto from 'crypto';
import pool from '../db/connection.js';
import { isRecordVaultBridgeStandalone } from '../recordVaultBridge/standaloneMode.js';

export const VAULT_PRODUCT_PHOTO_ALBUMS = 'photo_albums';
export const VAULT_PRODUCT_RECORD_VAULT = 'record_vault';

const STORAGE_TYPES = ['usb', 'onedrive'];
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const UNLOCK_TTL_SEC = 24 * 60 * 60;
const UNLOCK_RENEW_BELOW_SEC = 23 * 60 * 60;
const LOCK_LEASE_SEC = 60;
const LOCK_HEARTBEAT_MS = 15_000;
const LOCK_MAX_HOLD_MS = 30 * 60 * 1000;
const LOCK_WAIT_MAX_MS = 120_000;
const OLD_DB_CLOSE_DELAY_MS = 60_000;

const STATE_DDL = `
  CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.vault_cluster_state (
    product text NOT NULL,
    singles_id bigint NOT NULL,
    storage_type text NOT NULL,
    unlocked boolean NOT NULL DEFAULT false,
    unlock_generation bigint NOT NULL DEFAULT 0,
    mount_path text,
    backup_mount_path text,
    drive_folder_id text,
    unlocked_at timestamptz,
    unlock_expires_at timestamptz,
    db_version bigint NOT NULL DEFAULT 0,
    lock_token text,
    lock_expires_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT vault_cluster_state_pkey PRIMARY KEY (product, singles_id, storage_type),
    CONSTRAINT vault_cluster_state_product_check CHECK (product IN ('photo_albums', 'record_vault')),
    CONSTRAINT vault_cluster_state_storage_type_check CHECK (storage_type IN ('usb', 'onedrive'))
  )
`;

const STATE_COLUMNS = `
  storage_type,
  db_version,
  unlock_generation,
  mount_path,
  backup_mount_path,
  drive_folder_id,
  unlocked_at,
  (unlocked AND unlock_expires_at IS NOT NULL AND unlock_expires_at > NOW()) AS unlocked_active,
  (unlocked AND unlock_expires_at IS NOT NULL AND unlock_expires_at > NOW()
     AND unlock_expires_at < NOW() + make_interval(secs => ${UNLOCK_RENEW_BELOW_SEC})) AS unlock_needs_renew
`;

export function isVaultClusterCoherenceEnabled() {
  return !isRecordVaultBridgeStandalone();
}

let schemaPromise = null;

export function ensureVaultClusterStateSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      try {
        await pool.query(STATE_DDL);
      } catch (err) {
        // Two workers racing CREATE TABLE IF NOT EXISTS can collide on pg_type.
        const { rows } = await pool.query(
          `SELECT to_regclass('outdateddbsnapshotoct2024.vault_cluster_state') AS t`
        );
        if (!rows[0]?.t) throw err;
      }
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

async function stateQuery(sql, params) {
  await ensureVaultClusterStateSchema();
  return pool.query(sql, params);
}

function normalizeProduct(product) {
  if (product === VAULT_PRODUCT_PHOTO_ALBUMS || product === VAULT_PRODUCT_RECORD_VAULT) return product;
  throw new Error(`Unknown vault product: ${product}`);
}

function normalizeType(storageType) {
  return String(storageType || 'usb').trim().toLowerCase() === 'onedrive' ? 'onedrive' : 'usb';
}

function normalizeId(singlesId) {
  const id = Math.trunc(Number(singlesId));
  return Number.isFinite(id) && id > 0 ? id : null;
}

function mapStateRow(row) {
  if (!row) return null;
  return {
    storageType: normalizeType(row.storage_type),
    dbVersion: Number(row.db_version) || 0,
    unlockGeneration: Number(row.unlock_generation) || 0,
    mountPath: row.mount_path ? String(row.mount_path) : null,
    backupMountPath: row.backup_mount_path ? String(row.backup_mount_path) : null,
    driveFolderId: row.drive_folder_id ? String(row.drive_folder_id) : null,
    unlockedAt: row.unlocked_at ? new Date(row.unlocked_at).getTime() : null,
    unlockedActive: Boolean(row.unlocked_active),
    unlockNeedsRenew: Boolean(row.unlock_needs_renew)
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ───────────────────────────── Unlock registry ───────────────────────────── */

/** Marks the vault unlocked cluster-wide; bumps generation so other workers reopen it. */
export async function registerVaultClusterUnlockState(
  product,
  { singlesId, storageType, mountPath, backupMountPath = null, driveFolderId = null }
) {
  const id = normalizeId(singlesId);
  const mount = String(mountPath || '').trim();
  if (!id || !mount) return null;
  const { rows } = await stateQuery(
    `INSERT INTO outdateddbsnapshotoct2024.vault_cluster_state AS s
       (product, singles_id, storage_type, unlocked, unlock_generation, mount_path, backup_mount_path,
        drive_folder_id, unlocked_at, unlock_expires_at, db_version, updated_at)
     VALUES ($1, $2, $3, true, 1, $4, $5, $6, NOW(), NOW() + make_interval(secs => $7), 1, NOW())
     ON CONFLICT (product, singles_id, storage_type) DO UPDATE
       SET unlocked = true,
           unlock_generation = s.unlock_generation + 1,
           mount_path = EXCLUDED.mount_path,
           backup_mount_path = EXCLUDED.backup_mount_path,
           drive_folder_id = EXCLUDED.drive_folder_id,
           unlocked_at = NOW(),
           unlock_expires_at = EXCLUDED.unlock_expires_at,
           db_version = s.db_version + 1,
           updated_at = NOW()
     RETURNING db_version, unlock_generation`,
    [
      normalizeProduct(product),
      id,
      normalizeType(storageType),
      mount,
      backupMountPath ? String(backupMountPath).trim() : null,
      driveFolderId ? String(driveFolderId).trim() : null,
      UNLOCK_TTL_SEC
    ]
  );
  const row = rows[0];
  return row
    ? { dbVersion: Number(row.db_version) || 0, unlockGeneration: Number(row.unlock_generation) || 0 }
    : null;
}

export async function clearVaultClusterUnlockState(product, singlesId, storageType = null) {
  const id = normalizeId(singlesId);
  if (!id) return;
  const params = [normalizeProduct(product), id];
  let typeClause = '';
  if (storageType) {
    params.push(normalizeType(storageType));
    typeClause = 'AND storage_type = $3';
  }
  await stateQuery(
    `UPDATE outdateddbsnapshotoct2024.vault_cluster_state
        SET unlocked = false, unlock_expires_at = NULL, updated_at = NOW()
      WHERE product = $1 AND singles_id = $2 ${typeClause}`,
    params
  );
}

/** Same shape as the old Redis registry entry, plus generation/version. */
export async function getVaultClusterUnlockState(product, singlesId, storageType) {
  const id = normalizeId(singlesId);
  if (!id) return null;
  const { rows } = await stateQuery(
    `SELECT ${STATE_COLUMNS}
       FROM outdateddbsnapshotoct2024.vault_cluster_state
      WHERE product = $1 AND singles_id = $2 AND storage_type = $3`,
    [normalizeProduct(product), id, normalizeType(storageType)]
  );
  const state = mapStateRow(rows[0]);
  if (!state?.unlockedActive || !state.mountPath) return null;
  return {
    singlesId: id,
    storageType: state.storageType,
    mountPath: state.mountPath,
    backupMountPath: state.backupMountPath,
    driveFolderId: state.driveFolderId,
    unlockedAt: state.unlockedAt,
    unlockGeneration: state.unlockGeneration,
    dbVersion: state.dbVersion
  };
}

/**
 * Vault files were replaced on disk outside the session (TutaMall restore): every worker
 * must drop its in-memory copy unsaved and reopen from disk on the member's next request.
 */
export async function invalidateVaultClusterSessions(product, singlesId) {
  if (!isVaultClusterCoherenceEnabled()) return;
  const id = normalizeId(singlesId);
  if (!id) return;
  await stateQuery(
    `UPDATE outdateddbsnapshotoct2024.vault_cluster_state
        SET unlock_generation = unlock_generation + 1,
            db_version = db_version + 1,
            updated_at = NOW()
      WHERE product = $1 AND singles_id = $2`,
    [normalizeProduct(product), id]
  );
}

async function readVaultClusterStates(product, singlesId) {
  const { rows } = await stateQuery(
    `SELECT ${STATE_COLUMNS}
       FROM outdateddbsnapshotoct2024.vault_cluster_state
      WHERE product = $1 AND singles_id = $2`,
    [product, singlesId]
  );
  const states = { usb: null, onedrive: null };
  const renew = [];
  for (const row of rows) {
    const state = mapStateRow(row);
    states[state.storageType] = state;
    if (state.unlockNeedsRenew) renew.push(state.storageType);
  }
  if (renew.length) {
    // Active sessions keep their unlock alive (the old Redis entry silently expired after 24h).
    await stateQuery(
      `UPDATE outdateddbsnapshotoct2024.vault_cluster_state
          SET unlock_expires_at = NOW() + make_interval(secs => $4)
        WHERE product = $1 AND singles_id = $2 AND storage_type = ANY($3::text[])
          AND unlocked AND unlock_expires_at > NOW()`,
      [product, singlesId, renew, UNLOCK_TTL_SEC]
    );
  }
  return states;
}

/* ───────────────────────────────── Lease lock ──────────────────────────────── */

/** Locks held by this process: `${product}:${id}:${type}` → { token, heartbeat }. */
const heldLocks = new Map();

function lockKey(product, singlesId, storageType) {
  return `${product}:${singlesId}:${normalizeType(storageType)}`;
}

export function isVaultClusterLockHeld(product, singlesId, storageType) {
  const id = normalizeId(singlesId);
  if (!id) return false;
  return heldLocks.has(lockKey(product, id, storageType));
}

class VaultBusyError extends Error {
  constructor() {
    super('Vault is busy saving another change — please try again.');
    this.code = 'VAULT_BUSY';
  }
}

async function acquireVaultClusterLock(product, singlesId, storageType) {
  const type = normalizeType(storageType);
  const token = `${process.pid}:${crypto.randomUUID()}`;
  const deadline = Date.now() + LOCK_WAIT_MAX_MS;
  let delayMs = 20;
  for (;;) {
    const { rows } = await stateQuery(
      `INSERT INTO outdateddbsnapshotoct2024.vault_cluster_state AS s
         (product, singles_id, storage_type, lock_token, lock_expires_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW() + make_interval(secs => $5), NOW())
       ON CONFLICT (product, singles_id, storage_type) DO UPDATE
         SET lock_token = EXCLUDED.lock_token,
             lock_expires_at = EXCLUDED.lock_expires_at
         WHERE s.lock_token IS NULL OR s.lock_expires_at IS NULL OR s.lock_expires_at < NOW()
       RETURNING ${STATE_COLUMNS}`,
      [product, singlesId, type, token, LOCK_LEASE_SEC]
    );
    if (rows[0]) {
      const startedAt = Date.now();
      const heartbeat = setInterval(() => {
        if (Date.now() - startedAt > LOCK_MAX_HOLD_MS) {
          clearInterval(heartbeat);
          return;
        }
        stateQuery(
          `UPDATE outdateddbsnapshotoct2024.vault_cluster_state
              SET lock_expires_at = NOW() + make_interval(secs => $5)
            WHERE product = $1 AND singles_id = $2 AND storage_type = $3 AND lock_token = $4`,
          [product, singlesId, type, token, LOCK_LEASE_SEC]
        ).catch((err) => console.warn('[vaultClusterCoherence] lock heartbeat failed', err?.message || err));
      }, LOCK_HEARTBEAT_MS);
      heartbeat.unref?.();
      heldLocks.set(lockKey(product, singlesId, type), { token, heartbeat });
      return { token, state: mapStateRow(rows[0]) };
    }
    if (Date.now() >= deadline) throw new VaultBusyError();
    await sleep(delayMs);
    delayMs = Math.min(250, delayMs * 2);
  }
}

async function releaseVaultClusterLock(product, singlesId, storageType, token) {
  const type = normalizeType(storageType);
  const key = lockKey(product, singlesId, type);
  const held = heldLocks.get(key);
  if (held?.token === token) {
    clearInterval(held.heartbeat);
    heldLocks.delete(key);
  }
  try {
    await stateQuery(
      `UPDATE outdateddbsnapshotoct2024.vault_cluster_state
          SET lock_token = NULL, lock_expires_at = NULL
        WHERE product = $1 AND singles_id = $2 AND storage_type = $3 AND lock_token = $4`,
      [product, singlesId, type, token]
    );
  } catch (err) {
    // Lease expires on its own after LOCK_LEASE_SEC.
    console.warn('[vaultClusterCoherence] lock release failed', err?.message || err);
  }
}

async function publishVaultDbVersion(product, singlesId, storageType, token) {
  const { rows } = await stateQuery(
    `UPDATE outdateddbsnapshotoct2024.vault_cluster_state
        SET db_version = db_version + 1, updated_at = NOW()
      WHERE product = $1 AND singles_id = $2 AND storage_type = $3 AND lock_token = $4
      RETURNING db_version, unlock_generation`,
    [product, singlesId, normalizeType(storageType), token]
  );
  if (!rows[0]) {
    console.error('[vaultClusterCoherence] lost vault lock before publishing db_version', {
      product,
      singlesId,
      storageType
    });
    return null;
  }
  return { dbVersion: Number(rows[0].db_version) || 0, unlockGeneration: Number(rows[0].unlock_generation) || 0 };
}

/* ──────────────────────────── Session synchronization ─────────────────────────── */

/**
 * Hooks each vaultSession module provides:
 *   readRequestedStorageType(req) → 'usb' | 'onedrive' | null
 *   getLocalSession(singlesId, type) → session | null   (unlocked sessions in this process)
 *   dropLocalSession(singlesId, type)                    (forget without saving)
 *   rehydrateSession(singlesId, type) → session | null   (open from disk via registry)
 *   reloadSessionDb(session)                             (re-read vault.db from disk)
 *   persistSessionNow(session)                           (export + write vault.db)
 *
 * Session fields owned here: clusterGeneration, clusterDbVersion, clusterFlushedSinceCommit.
 */

export function markVaultSessionClusterState(session, { dbVersion, unlockGeneration } = {}) {
  if (!session) return;
  if (Number.isFinite(Number(dbVersion))) session.clusterDbVersion = Number(dbVersion);
  if (Number.isFinite(Number(unlockGeneration))) session.clusterGeneration = Number(unlockGeneration);
  session.clusterFlushedSinceCommit = false;
}

/** Old sql.js handles stay open briefly so in-flight requests holding them can finish. */
export function closeVaultDbLater(db) {
  if (!db) return;
  const timer = setTimeout(() => {
    try {
      db.close();
    } catch {
      // already closed
    }
  }, OLD_DB_CLOSE_DELAY_MS);
  timer.unref?.();
}

async function reloadSessionDbDeduped(hooks, session) {
  if (!session._clusterReloadPromise) {
    session._clusterReloadPromise = (async () => {
      try {
        await hooks.reloadSessionDb(session);
      } finally {
        session._clusterReloadPromise = null;
      }
    })();
  }
  return session._clusterReloadPromise;
}

async function syncLocalSession(hooks, singlesId, type, state, allowRehydrate) {
  let local = hooks.getLocalSession(singlesId, type);
  if (!state?.unlockedActive) {
    // Logged off / expired on some worker — this copy must not keep serving the vault.
    if (local) hooks.dropLocalSession(singlesId, type);
    return;
  }
  if (local && local.clusterGeneration !== state.unlockGeneration) {
    hooks.dropLocalSession(singlesId, type);
    local = null;
  }
  if (!local) {
    if (allowRehydrate) await hooks.rehydrateSession(singlesId, type);
    return;
  }
  if (local.clusterDbVersion !== state.dbVersion) {
    try {
      await reloadSessionDbDeduped(hooks, local);
      local.clusterDbVersion = state.dbVersion;
    } catch (err) {
      // e.g. key/meta rotated by another worker's unlock — reopen from the registry.
      console.warn('[vaultClusterCoherence] reload failed, reopening vault', err?.message || err);
      hooks.dropLocalSession(singlesId, type);
      if (allowRehydrate) await hooks.rehydrateSession(singlesId, type);
    }
  }
}

async function commitSessionUnderLock(product, hooks, session, token) {
  if (session.dirty) hooks.persistSessionNow(session);
  const published = await publishVaultDbVersion(product, session.singlesId, session.storageType, token);
  if (published) markVaultSessionClusterState(session, published);
}

/**
 * Persist a session's pending vault.db change when this process does not already hold the
 * lock (read-triggered repairs, fire-and-forget work after a response). If another worker
 * committed in the meantime, the local change was built on stale data and is discarded.
 */
export async function commitVaultSessionWithClusterLock(product, hooks, session) {
  if (!isVaultClusterCoherenceEnabled()) return;
  if (!session || session.locked) return;
  if (!session.dirty && !session.clusterFlushedSinceCommit) return;
  const singlesId = normalizeId(session.singlesId);
  if (!singlesId) return;
  const type = normalizeType(session.storageType);
  const lock = await acquireVaultClusterLock(product, singlesId, type);
  try {
    if (session.locked || hooks.getLocalSession(singlesId, type) !== session) return;
    const { state } = lock;
    if (!state?.unlockedActive) return;
    if (state.unlockGeneration === session.clusterGeneration && state.dbVersion === session.clusterDbVersion) {
      await commitSessionUnderLock(product, hooks, session, lock.token);
      return;
    }
    console.warn('[vaultClusterCoherence] discarding local vault change made on a stale copy', {
      product,
      singlesId,
      storageType: type
    });
    session.dirty = false;
    session.clusterFlushedSinceCommit = false;
    if (state.unlockGeneration === session.clusterGeneration) {
      await reloadSessionDbDeduped(hooks, session);
      session.clusterDbVersion = state.dbVersion;
    } else {
      hooks.dropLocalSession(singlesId, type);
    }
  } finally {
    await releaseVaultClusterLock(product, singlesId, type, lock.token);
  }
}

/** Coalesced fire-and-forget variant for synchronous call sites (flushDbToUsb). */
export function scheduleVaultSessionClusterCommit(product, hooks, session) {
  if (!session || session._clusterCommitTimer) return;
  session._clusterCommitTimer = setTimeout(() => {
    session._clusterCommitTimer = null;
    commitVaultSessionWithClusterLock(product, hooks, session).catch((err) =>
      console.error('[vaultClusterCoherence] background commit failed', err?.message || err)
    );
  }, 50);
  session._clusterCommitTimer.unref?.();
}

async function commitAfterWriteRequest(product, hooks, singlesId, held) {
  try {
    for (const type of STORAGE_TYPES) {
      const local = hooks.getLocalSession(singlesId, type);
      if (!local || (!local.dirty && !local.clusterFlushedSinceCommit)) continue;
      const lock = held.find((h) => h.type === type);
      if (lock) {
        await commitSessionUnderLock(product, hooks, local, lock.token);
      } else {
        // Vault opened during this request (unlock): commit before the response leaves.
        await commitVaultSessionWithClusterLock(product, hooks, local);
      }
    }
  } finally {
    for (const h of held) {
      await releaseVaultClusterLock(product, singlesId, h.type, h.token);
    }
  }
}

/**
 * Express middleware — mount right after requireAuth on every vault route of one product.
 */
export function createVaultClusterCoherenceMiddleware({ product, hooks }) {
  const productKey = normalizeProduct(product);
  return async function vaultClusterCoherence(req, res, next) {
    if (!isVaultClusterCoherenceEnabled()) return next();
    const singlesId = normalizeId(req.auth?.singles_id);
    if (!singlesId) return next();

    const isWrite = !SAFE_METHODS.has(String(req.method || 'GET').toUpperCase());
    const held = [];
    try {
      const requestedType = hooks.readRequestedStorageType(req);
      const states = await readVaultClusterStates(productKey, singlesId);
      if (isWrite) {
        for (const type of STORAGE_TYPES) {
          if (!states[type]?.unlockedActive) continue;
          if (requestedType && requestedType !== type) continue;
          const lock = await acquireVaultClusterLock(productKey, singlesId, type);
          held.push({ type, token: lock.token });
          states[type] = lock.state;
        }
      }
      for (const type of STORAGE_TYPES) {
        await syncLocalSession(hooks, singlesId, type, states[type], !requestedType || requestedType === type);
      }
    } catch (err) {
      for (const h of held) {
        await releaseVaultClusterLock(productKey, singlesId, h.type, h.token);
      }
      if (err?.code === 'VAULT_BUSY') {
        return res.status(503).json({ error: err.message, code: 'VAULT_BUSY' });
      }
      console.error('[vaultClusterCoherence] sync failed', err?.message || err);
      return res.status(503).json({
        error: 'Vault sync is temporarily unavailable — please try again.',
        code: 'VAULT_SYNC_UNAVAILABLE'
      });
    }

    if (!isWrite) {
      // Reads never delay the response; read-triggered repairs commit in the background.
      let done = false;
      const afterRead = () => {
        if (done) return;
        done = true;
        for (const type of STORAGE_TYPES) {
          const local = hooks.getLocalSession(singlesId, type);
          if (local?.dirty) scheduleVaultSessionClusterCommit(productKey, hooks, local);
        }
      };
      res.on('finish', afterRead);
      res.on('close', afterRead);
      return next();
    }

    // Writes: persist + publish before the response body completes (read-your-writes on
    // whichever worker serves the next request), and always release the lease.
    let commitPromise = null;
    const commitOnce = () => {
      if (!commitPromise) {
        commitPromise = commitAfterWriteRequest(productKey, hooks, singlesId, held).catch((err) =>
          console.error('[vaultClusterCoherence] commit failed', err?.message || err)
        );
      }
      return commitPromise;
    };
    const originalEnd = res.end;
    res.end = function vaultClusterCommitThenEnd(...args) {
      res.end = originalEnd;
      commitOnce().finally(() => originalEnd.apply(res, args));
      return res;
    };
    res.on('close', () => {
      void commitOnce();
    });
    return next();
  };
}
