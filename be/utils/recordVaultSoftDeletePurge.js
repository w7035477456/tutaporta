/**
 * Hourly hard-purge of soft-deleted TutaNotes notebooks/notes past the 48-hour
 * Undo Delete retention window. Uses a Postgres advisory lock so only one worker
 * in the cluster runs the sweep at a time.
 */
import fs from 'fs';
import path from 'path';
import pool from '../db/connection.js';
import {
  NOTES_VAULT_TABLES as T,
  VaultPgDb
} from './recordVaultUsb/vaultPgStore.js';
import {
  getVaultSession,
  vaultPurgeExpiredSoftDeletes,
  RECORD_VAULT_SOFT_DELETE_RETENTION_MS,
  RECORD_VAULT_SOFT_DELETE_RETENTION_HOURS
} from './recordVaultUsb/vaultSession.js';
import {
  loadMemberIdForSingles,
  tutaDriveNotesMountPath
} from './tutaDriveMemberPaths.js';
import { vaultRootOnMount } from './recordVaultUsb/vaultPaths.js';

const LOG = '[recordVaultSoftDeletePurge]';
/** Distinct from bill-overdue advisory lock. */
const ADVISORY_LOCK_KEY = 872314048;
const INTERVAL_MS = 60 * 60 * 1000;

let refreshTimer = null;
let runInFlight = null;

function buildDiskSession(singlesId, mountPath, existing = null) {
  if (existing?.db && existing?.mountPath) return existing;
  return {
    singlesId: Number(singlesId),
    mountPath: path.resolve(mountPath),
    backupMountPath: null,
    db: existing?.db || new VaultPgDb(singlesId),
    key: existing?.key ?? null,
    meta: existing?.meta ?? null,
    locked: false,
    storageType: existing?.storageType || 'tutaCloud'
  };
}

async function resolvePurgeSession(singlesId) {
  const unlocked =
    getVaultSession(singlesId, 'tutaCloud') ||
    getVaultSession(singlesId, 'usb') ||
    getVaultSession(singlesId);
  if (unlocked?.mountPath && unlocked?.db) return unlocked;

  const memberId = await loadMemberIdForSingles(singlesId);
  if (!memberId) return null;
  const notesMount = tutaDriveNotesMountPath(memberId);
  if (!fs.existsSync(vaultRootOnMount(notesMount)) && !fs.existsSync(notesMount)) {
    // Still purge DB rows even if the vault folder is missing (orphaned index).
    return buildDiskSession(singlesId, notesMount, unlocked);
  }
  return buildDiskSession(singlesId, notesMount, unlocked);
}

async function listSinglesNeedingPurge(client, cutoffIso) {
  const { rows } = await client.query(
    `SELECT DISTINCT singles_id
       FROM (
         SELECT singles_id FROM ${T.notebooks}
          WHERE deleted_at IS NOT NULL AND deleted_at < $1::timestamptz
         UNION
         SELECT n.singles_id
           FROM ${T.notes} n
           JOIN ${T.notebooks} nb
             ON nb.singles_id = n.singles_id
            AND nb.notebook_id = n.notebook_id
            AND nb.deleted_at IS NULL
          WHERE n.deleted_at IS NOT NULL AND n.deleted_at < $1::timestamptz
       ) expired
      ORDER BY singles_id ASC`,
    [cutoffIso]
  );
  return rows.map((r) => Number(r.singles_id)).filter((id) => Number.isFinite(id) && id > 0);
}

export async function runRecordVaultSoftDeletePurge() {
  const client = await pool.connect();
  let locked = false;
  try {
    const lockRes = await client.query(`SELECT pg_try_advisory_lock($1) AS ok`, [ADVISORY_LOCK_KEY]);
    locked = Boolean(lockRes.rows[0]?.ok);
    if (!locked) {
      console.log(`${LOG} another worker holds the advisory lock — skip`);
      return { ok: true, skipped: true, reason: 'lock' };
    }

    const cutoffIso = new Date(Date.now() - RECORD_VAULT_SOFT_DELETE_RETENTION_MS).toISOString();
    const singlesIds = await listSinglesNeedingPurge(client, cutoffIso);
    let notes = 0;
    let notebooks = 0;
    for (const singlesId of singlesIds) {
      try {
        const session = await resolvePurgeSession(singlesId);
        if (!session) continue;
        const result = await vaultPurgeExpiredSoftDeletes(session);
        notes += Number(result?.notes || 0);
        notebooks += Number(result?.notebooks || 0);
      } catch (err) {
        console.warn(`${LOG} singles_id=${singlesId} failed:`, err?.message ?? err);
      }
    }

    if (notes > 0 || notebooks > 0) {
      console.log(
        `${LOG} purged notes=${notes} notebooks=${notebooks} (retention=${RECORD_VAULT_SOFT_DELETE_RETENTION_HOURS}h)`
      );
    }
    return { ok: true, singles: singlesIds.length, notes, notebooks };
  } finally {
    if (locked) {
      try {
        await client.query(`SELECT pg_advisory_unlock($1)`, [ADVISORY_LOCK_KEY]);
      } catch {
        // ignore
      }
    }
    client.release();
  }
}

export function runRecordVaultSoftDeletePurgeNow() {
  if (runInFlight) return runInFlight;
  runInFlight = runRecordVaultSoftDeletePurge().finally(() => {
    runInFlight = null;
  });
  return runInFlight;
}

function scheduleNextRun(delayMs = INTERVAL_MS) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    void (async () => {
      try {
        await runRecordVaultSoftDeletePurgeNow();
      } catch (err) {
        console.error(`${LOG} scheduled run failed:`, err?.message ?? err);
      }
      scheduleNextRun(INTERVAL_MS);
    })();
  }, delayMs);
  refreshTimer.unref?.();
}

/** Start hourly purge; first sweep after a short delay so boot is not blocked. */
export function startRecordVaultSoftDeletePurge() {
  console.log(
    `${LOG} scheduled every ${INTERVAL_MS / 60000}m (retention ${RECORD_VAULT_SOFT_DELETE_RETENTION_HOURS}h)`
  );
  scheduleNextRun(90_000);
}
