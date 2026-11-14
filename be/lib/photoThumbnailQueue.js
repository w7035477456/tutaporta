import fs from 'fs';
import os from 'os';
import path from 'path';
import pool from '../db/connection.js';
import { generateAndSavePhotoThumbnail, regeneratePhotoThumbnail } from '../utils/photoThumbnail.js';

/**
 * Cluster-wide queue for photo thumbnails, on the shared Redis in REDIS_URL
 * (pre-production: xbox1; All-in-1: xbox2). Every BE process on every web server
 * drains it; a claimed job sits in the processing ZSET until acked, so a worker that
 * dies mid-job has its job requeued by any other process.
 */

const LOG_PREFIX = '[photo-thumb-queue]';
const QUEUE_KEY = 'v1:queue:photoThumbnail';
const PROCESSING_KEY = 'v1:queue:photoThumbnail:processing';
const ATTEMPTS_KEY = 'v1:queue:photoThumbnail:attempts';

function readIntEnv(name, fallback, min = 0) {
  const n = Number(String(process.env[name] ?? '').trim());
  return Number.isFinite(n) && n >= min ? Math.trunc(n) : fallback;
}

const POLL_MS = readIntEnv('PHOTO_THUMBNAIL_QUEUE_POLL_MS', 500, 100);
/** Sharp jobs in flight per BE process; keeps libuv threads free for request traffic. */
const CONCURRENCY = readIntEnv('PHOTO_THUMBNAIL_QUEUE_CONCURRENCY', 2, 1);
const LEASE_MS = readIntEnv('PHOTO_THUMBNAIL_QUEUE_LEASE_MS', 120000, 10000);
const MAX_ATTEMPTS = readIntEnv('PHOTO_THUMBNAIL_QUEUE_MAX_ATTEMPTS', 3, 1);
const REAP_EVERY_MS = 30000;

const WORKER_ID = `${os.hostname()}:${process.pid}`;

const CLAIM_LUA = `
local job = redis.call('RPOP', KEYS[1])
if job then redis.call('ZADD', KEYS[2], ARGV[1], job) end
return job
`;

/** Requeue jobs whose lease expired; drop them after ARGV[2] attempts. Returns {requeued, dropped}. */
const REAP_LUA = `
local jobs = redis.call('ZRANGEBYSCORE', KEYS[2], '-inf', ARGV[1], 'LIMIT', 0, 100)
local requeued, dropped = 0, 0
for _, job in ipairs(jobs) do
  redis.call('ZREM', KEYS[2], job)
  local n = redis.call('HINCRBY', KEYS[3], job, 1)
  if n >= tonumber(ARGV[2]) then
    redis.call('HDEL', KEYS[3], job)
    dropped = dropped + 1
  else
    redis.call('LPUSH', KEYS[1], job)
    requeued = requeued + 1
  end
end
return {requeued, dropped}
`;

let redis = null;
let pollTimer = null;
let reapTimer = null;
let inFlight = 0;
let claiming = false;

export function setPhotoThumbnailQueueRedis(client) {
  redis = client || null;
  if (redis && typeof redis.photoThumbClaim !== 'function') {
    redis.defineCommand('photoThumbClaim', { numberOfKeys: 2, lua: CLAIM_LUA });
    redis.defineCommand('photoThumbReap', { numberOfKeys: 3, lua: REAP_LUA });
  }
}

function redisReady() {
  return Boolean(redis && redis.status === 'ready');
}

/**
 * Queue a thumbnail for a photos row that is already committed and whose original
 * file is already on shared storage. Falls back to generating inline when Redis is
 * down so the photo still gets a thumbnail.
 * @returns {Promise<'queued' | 'inline' | 'failed'>}
 */
export async function enqueuePhotoThumbnail({ photosId, fullPath, fileNameBase, outputDir, buffer }) {
  const job = JSON.stringify({ photosId: Number(photosId), fullPath, fileNameBase, outputDir });
  if (redisReady()) {
    try {
      await redis.lpush(QUEUE_KEY, job);
      return 'queued';
    } catch (err) {
      console.error(`${LOG_PREFIX} enqueue failed, generating inline:`, err?.message ?? err);
    }
  }
  try {
    const thumb = await regeneratePhotoThumbnail(pool, photosId, buffer);
    return thumb ? 'inline' : 'failed';
  } catch (err) {
    console.error(`${LOG_PREFIX} inline thumbnail failed photos_id=${photosId}:`, err?.message ?? err);
    return 'failed';
  }
}

async function ack(job) {
  await redis.multi().zrem(PROCESSING_KEY, job).hdel(ATTEMPTS_KEY, job).exec();
}

/** Throws on transient errors (DB / storage) so the job stays leased and is retried. */
async function processJob(job) {
  let parsed;
  try {
    parsed = JSON.parse(job);
  } catch {
    return;
  }
  const photosId = Number(parsed?.photosId);
  const { fullPath, fileNameBase, outputDir } = parsed ?? {};
  if (!Number.isFinite(photosId) || photosId < 1 || !fullPath || !fileNameBase || !outputDir) return;

  const { rows } = await pool.query(
    `SELECT photo_thumbnail FROM outdateddbsnapshotoct2024.photos WHERE photos_id = $1 LIMIT 1`,
    [photosId]
  );
  if (!rows.length || rows[0].photo_thumbnail) return;

  let imageBuffer;
  try {
    imageBuffer = await fs.promises.readFile(fullPath);
  } catch (err) {
    if (err?.code === 'ENOENT') return;
    throw err;
  }

  const photoThumbnail = await generateAndSavePhotoThumbnail({ imageBuffer, photoFileNameBase: fileNameBase, outputDir });
  if (!photoThumbnail) return;

  const updated = await pool.query(
    `UPDATE outdateddbsnapshotoct2024.photos
        SET photo_thumbnail = $2
      WHERE photos_id = $1 AND photo_thumbnail IS NULL`,
    [photosId, photoThumbnail]
  );
  if (!updated.rowCount) {
    const stillExists = await pool.query(
      `SELECT 1 FROM outdateddbsnapshotoct2024.photos WHERE photos_id = $1`,
      [photosId]
    );
    if (!stillExists.rowCount) {
      await fs.promises.unlink(path.join(outputDir, photoThumbnail)).catch(() => {});
    }
  }
}

async function runJob(job) {
  try {
    await processJob(job);
    await ack(job);
  } catch (err) {
    console.error(`${LOG_PREFIX} job failed, will retry after lease:`, err?.message ?? err);
  } finally {
    inFlight -= 1;
  }
}

async function tick() {
  if (claiming || !redisReady()) return;
  claiming = true;
  try {
    while (inFlight < CONCURRENCY) {
      const job = await redis.photoThumbClaim(QUEUE_KEY, PROCESSING_KEY, Date.now() + LEASE_MS);
      if (!job) break;
      inFlight += 1;
      void runJob(job);
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} claim failed:`, err?.message ?? err);
  } finally {
    claiming = false;
  }
}

async function reap() {
  if (!redisReady()) return;
  try {
    const [requeued, dropped] = await redis.photoThumbReap(QUEUE_KEY, PROCESSING_KEY, ATTEMPTS_KEY, Date.now(), MAX_ATTEMPTS);
    if (requeued) console.warn(`${LOG_PREFIX} requeued ${requeued} job(s) with expired lease`);
    if (dropped) console.error(`${LOG_PREFIX} dropped ${dropped} job(s) after ${MAX_ATTEMPTS} attempts (photo shows full image)`);
  } catch (err) {
    console.error(`${LOG_PREFIX} reap failed:`, err?.message ?? err);
  }
}

export function startPhotoThumbnailQueueWorker() {
  if (pollTimer) return;
  if (!redis) {
    console.warn(`${LOG_PREFIX} Redis not configured — thumbnails are generated inline during upload`);
    return;
  }
  pollTimer = setInterval(() => void tick(), POLL_MS);
  reapTimer = setInterval(() => void reap(), REAP_EVERY_MS);
  pollTimer.unref?.();
  reapTimer.unref?.();
  console.log(
    `${LOG_PREFIX} worker ${WORKER_ID} polling ${QUEUE_KEY} every ${POLL_MS}ms (concurrency ${CONCURRENCY}, lease ${LEASE_MS}ms, max ${MAX_ATTEMPTS} attempts)`
  );
}

export function stopPhotoThumbnailQueueWorker() {
  clearInterval(pollTimer);
  clearInterval(reapTimer);
  pollTimer = null;
  reapTimer = null;
}
