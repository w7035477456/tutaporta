import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { getTerramasterEnclosureStatus } from './terramasterEnclosureStatus.js';

const execFileAsync = promisify(execFile);

const RESTIC_TIMEOUT_MS = 60_000;
const RESTIC_MAX_BUFFER = 32 * 1024 * 1024;
const RESTIC_ERROR_MAX_CHARS = 600;

/**
 * Same secrets file the `showrestic` alias sources (RESTIC_REPOSITORY / RESTIC_PASSWORD…).
 * Override with ~/.ssh/be/.env RESTIC_SECRETS_ENV_FILE.
 */
export function resolveResticSecretsEnvFile(env = process.env, platform = process.platform, homeDir = os.homedir()) {
  const configured = String(env.RESTIC_SECRETS_ENV_FILE ?? '').trim();
  if (configured) return configured;
  const hostSuffix = platform === 'darwin' ? 'mac' : 'ubuntu';
  return path.join(homeDir, 'backups', `.backup-secrets-${hostSuffix}.env`);
}

const RESTIC_CRON_TZ = 'America/New_York';

/**
 * Readable copy of root's backup-nightly crontab line (root's crontab itself needs sudo).
 * Written by set-restic-cron-hour.sh / `resticcron` next to the secrets file.
 */
export function resolveResticCronLineFile(env = process.env, envFile = resolveResticSecretsEnvFile(env)) {
  const configured = String(env.RESTIC_CRON_LINE_FILE ?? '').trim();
  return configured || path.join(path.dirname(envFile), 'restic-cron.line');
}

function formatHour12(h24) {
  return `${h24 % 12 || 12}:00 ${h24 < 12 ? 'AM' : 'PM'}`;
}

/**
 * `0 17,18 * * * [ "$(TZ=America/New_York date +\%H)" = 13 ] && …backup-nightly.sh … >> LOG 2>&1`
 * → schedule fields shown by `resticcron` → "1) WHEN IT RUNS".
 */
export function parseResticCronLine(line) {
  const text = String(line ?? '').trim();
  const fields = text.split(/\s+/);
  if (!/^\d{1,2}$/.test(fields[0] ?? '') || !/^\d{1,2}(,\d{1,2})*$/.test(fields[1] ?? '')) return null;
  const minute = Number(fields[0]);
  const utcHours = fields[1].split(',').map(Number).filter((h) => h <= 23);
  if (minute > 59 || !utcHours.length) return null;
  const guard = text.match(/date \+\\?%H\)" = (\d{1,2}) \]/);
  const guardHour = guard ? Number(guard[1]) : null;
  const log = text.match(/>>\s*(\S+)/);
  return {
    minute,
    utcHours,
    guardHour,
    timeZone: RESTIC_CRON_TZ,
    dailyAt: guardHour === null ? null : `${formatHour12(guardHour)} ${RESTIC_CRON_TZ}`,
    log: log ? log[1] : ''
  };
}

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    hourCycle: 'h23',
    minute: '2-digit',
    timeZoneName: 'short'
  }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** Next instant cron fires with the guard passing, e.g. `Thu Nov 12 1:00 PM EST (in 23h 05m)`. */
export function describeNextResticRun(schedule, now = new Date()) {
  if (!schedule || schedule.guardHour === null) return null;
  const start = new Date(now);
  start.setUTCSeconds(0, 0);
  start.setUTCMinutes(schedule.minute);
  if (start <= now) start.setUTCHours(start.getUTCHours() + 1);
  for (let i = 0; i < 49; i += 1) {
    const t = new Date(start.getTime() + i * 3_600_000);
    if (!schedule.utcHours.includes(t.getUTCHours())) continue;
    const p = zonedParts(t, schedule.timeZone);
    if (Number(p.hour) !== schedule.guardHour) continue;
    const mins = Math.round((t - now) / 60_000);
    const h24 = Number(p.hour);
    const when = `${p.weekday} ${p.month} ${p.day} ${h24 % 12 || 12}:${p.minute} ${h24 < 12 ? 'AM' : 'PM'} ${p.timeZoneName}`;
    return `${when} (in ${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m)`;
  }
  return null;
}

function readResticCronSchedule(envFile) {
  const file = resolveResticCronLineFile(process.env, envFile);
  try {
    const line = fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .find((l) => l.includes('backup-nightly.sh') && !l.trim().startsWith('#'));
    const schedule = parseResticCronLine(line);
    return schedule ? { ...schedule, nextRun: describeNextResticRun(schedule) } : null;
  } catch {
    return null;
  }
}

/** restic JSON time (`2026-11-05T13:22:20.123-05:00`) → `2026-11-05 13:22:20`, the host-local time `restic snapshots` prints. */
export function formatResticSnapshotTime(time) {
  const match = String(time ?? '').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
  return match ? `${match[1]} ${match[2]}` : String(time ?? '');
}

/**
 * `restic snapshots --json` → rows for the Admin Tools Restic tab (same columns as `showrestic`).
 * @param {string} jsonText
 */
export function parseResticSnapshotsJson(jsonText) {
  const parsed = JSON.parse(String(jsonText ?? '').trim() || '[]');
  if (!Array.isArray(parsed)) return [];
  return parsed.map((snap) => {
    const fullId = String(snap?.id ?? '');
    return {
      id: String(snap?.short_id ?? '') || fullId.slice(0, 8),
      fullId,
      time: formatResticSnapshotTime(snap?.time),
      host: String(snap?.hostname ?? ''),
      tags: Array.isArray(snap?.tags) ? snap.tags.map(String) : [],
      paths: Array.isArray(snap?.paths) ? snap.paths.map(String) : []
    };
  });
}

/**
 * Read-only snapshot list for the restic repo in the secrets file (`--no-lock`, never writes the repo).
 * No secrets file means restic isn't set up on this host (e.g. Mac dev) — not an error.
 * @returns {Promise<{ configured: boolean, envFile: string, snapshots: ReturnType<typeof parseResticSnapshotsJson> }>}
 */
export async function listResticSnapshots() {
  const envFile = resolveResticSecretsEnvFile();
  if (!fs.existsSync(envFile)) {
    return { configured: false, envFile, schedule: null, snapshots: [] };
  }
  const schedule = readResticCronSchedule(envFile);

  try {
    const { stdout } = await execFileAsync(
      'bash',
      ['-c', 'set -a; source "$1" >/dev/null; set +a; exec restic snapshots --json --no-lock', 'restic-snapshots', envFile],
      { timeout: RESTIC_TIMEOUT_MS, maxBuffer: RESTIC_MAX_BUFFER, env: process.env }
    );
    return { configured: true, envFile, schedule, snapshots: parseResticSnapshotsJson(stdout) };
  } catch (cause) {
    const stderr = String(cause?.stderr ?? '').trim();
    const detail = (stderr || cause?.message || 'restic snapshots failed').slice(0, RESTIC_ERROR_MAX_CHARS);
    const enclosure = getTerramasterEnclosureStatus();
    const enclosureHint = enclosure.status === 'not_configured' ? '' : ` — TerraMaster: ${enclosure.label}`;
    const err = new Error(`restic snapshots failed: ${detail}${enclosureHint}`);
    // Not 502/504: Cloudflare swaps those origin responses for its own page, hiding this JSON.
    err.statusCode = 503;
    err.schedule = schedule;
    throw err;
  }
}
