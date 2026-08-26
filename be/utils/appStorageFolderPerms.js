/**
 * Auto-fix permissions on app storage roots (Mac + Ubuntu) when the Node
 * process owns the files. Covers:
 *   - STORAGE_FOLDER          (e.g. …/onlinemallwebsite_storage)
 *   - LARGE_CHEAP_STORAGE_FOLDER (e.g. …/onlinemallwebsite_largecheapstorage)
 * and all subfolders/files under them.
 *
 * chown only works as root — as lawsen0 we best-effort chmod (dirs 0755, files 0644)
 * and prove writability with a probe file. If still blocked, throw a structured
 * STORAGE_PERMISSION error for UI + PM2 logging.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

export const FOLDER_PERMISSION_CODE = 'STORAGE_PERMISSION';
export const FOLDER_PERMISSION_USER_MESSAGE =
  'Folder permission error. Please contact your admin';

const DIR_MODE = 0o755;
const FILE_MODE = 0o644;
/** Cap walk depth/files so startup does not hang on huge trees. */
const MAX_WALK_ENTRIES = 50000;

function expandEnvPath(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (s.startsWith('~/')) return path.join(os.homedir(), s.slice(2));
  return path.resolve(s);
}

/** Configured storage roots from ~/.ssh/be/.env (deduped, absolute). */
export function listAppStorageRoots() {
  const keys = ['STORAGE_FOLDER', 'LARGE_CHEAP_STORAGE_FOLDER', 'VSINGLES_PHOTO_FOLDER'];
  const out = [];
  const seen = new Set();
  for (const envKey of keys) {
    const abs = expandEnvPath(process.env[envKey]);
    if (!abs || seen.has(abs)) continue;
    // Skip photo folder if it is already under STORAGE_FOLDER (avoid double walk)
    if (envKey === 'VSINGLES_PHOTO_FOLDER') {
      const underExisting = out.some(
        (r) => abs === r.abs || abs.startsWith(r.abs + path.sep)
      );
      if (underExisting) continue;
    }
    seen.add(abs);
    out.push({ envKey, abs });
  }
  return out;
}

function tryChmodPath(targetPath) {
  const p = String(targetPath || '').trim();
  if (!p || !fs.existsSync(p)) return false;
  try {
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink()) return true;
    fs.chmodSync(p, st.isDirectory() ? DIR_MODE : FILE_MODE);
    return true;
  } catch {
    return false;
  }
}

/** Best-effort: if running as root, chown to the Node process user. */
function tryChownPath(targetPath) {
  const p = String(targetPath || '').trim();
  if (!p || !fs.existsSync(p)) return false;
  if (typeof process.getuid !== 'function' || process.getuid() !== 0) return false;
  try {
    const info = os.userInfo();
    // Prefer non-root owner from env process when started via sudo -u … — rarely root PM2.
    const uid = typeof process.getuid === 'function' ? process.getuid() : info.uid;
    const gid = typeof process.getgid === 'function' ? process.getgid() : info.gid;
    // When we ARE root, chown to SUDO_UID / common app user if set; else leave.
    const sudoUid = Number(process.env.SUDO_UID);
    const sudoGid = Number(process.env.SUDO_GID);
    const targetUid = Number.isFinite(sudoUid) ? sudoUid : uid;
    const targetGid = Number.isFinite(sudoGid) ? sudoGid : gid;
    if (targetUid === 0) return false;
    fs.chownSync(p, targetUid, targetGid);
    return true;
  } catch {
    return false;
  }
}

/**
 * Walk tree and chmod (and chown-as-root) every path we can touch.
 * @returns {{ fixed: number, failed: number }}
 */
export function tryFixStorageTreePerms(rootPath) {
  const root = path.resolve(String(rootPath || ''));
  let fixed = 0;
  let failed = 0;
  let walked = 0;

  function visit(p) {
    if (walked >= MAX_WALK_ENTRIES) return;
    walked += 1;
    tryChownPath(p);
    if (tryChmodPath(p)) fixed += 1;
    else failed += 1;
    let st;
    try {
      st = fs.lstatSync(p);
    } catch {
      return;
    }
    if (!st.isDirectory() || st.isSymbolicLink()) return;
    let entries = [];
    try {
      entries = fs.readdirSync(p, { withFileTypes: true });
    } catch {
      failed += 1;
      return;
    }
    for (const ent of entries) {
      if (walked >= MAX_WALK_ENTRIES) break;
      visit(path.join(p, ent.name));
    }
  }

  if (!root || !fs.existsSync(root)) return { fixed: 0, failed: 0, missing: true };
  visit(root);
  return { fixed, failed, missing: false, walked };
}

function writeProbe(dirPath) {
  const dir = path.resolve(String(dirPath || ''));
  fs.mkdirSync(dir, { recursive: true });
  const probe = path.join(dir, `.perm_probe_${process.pid}_${Date.now()}`);
  fs.writeFileSync(probe, 'ok');
  fs.unlinkSync(probe);
}

/**
 * Ensure one root is writable: mkdir, fix tree, probe write at root (+ users/ when present).
 * @returns {{ ok: true, abs: string } | { ok: false, abs: string, err: Error }}
 */
export function ensureStorageRootWritable(rootAbs) {
  const abs = path.resolve(String(rootAbs || ''));
  const usersDir = path.join(abs, 'users');
  const probeTargets = [abs];
  try {
    fs.mkdirSync(abs, { recursive: true });
    // LARGE_CHEAP / storage layout uses users/M{id}/…
    try {
      fs.mkdirSync(usersDir, { recursive: true });
      probeTargets.push(usersDir);
    } catch {
      /* root may not allow users/ — still probe root */
    }
    tryFixStorageTreePerms(abs);
    for (const dir of probeTargets) writeProbe(dir);
    return { ok: true, abs };
  } catch (firstErr) {
    tryFixStorageTreePerms(abs);
    try {
      fs.mkdirSync(abs, { recursive: true });
      for (const dir of probeTargets) {
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch {
          /* continue */
        }
        writeProbe(dir);
      }
      return { ok: true, abs };
    } catch (retryErr) {
      const e = new Error(FOLDER_PERMISSION_USER_MESSAGE);
      e.code = retryErr?.code || firstErr?.code || 'EACCES';
      e.cause = retryErr || firstErr;
      e.path = abs;
      e.storageRoot = abs;
      return { ok: false, abs, err: e };
    }
  }
}

/**
 * PM2 / console line — exact wording requested by ops.
 * Lists the full folder path(s) that failed (and implies all subfolders).
 */
export function formatFolderPermissionPm2Log(folders) {
  const list = (Array.isArray(folders) ? folders : [folders])
    .map((f) => String(f || '').trim())
    .filter(Boolean);
  const shown =
    list.length === 0
      ? '(unknown storage folder)'
      : list.map((f) => `${f} and all subfolders`).join('; ');
  return `Folder permission error at folder [${shown}]. Please contact your admin`;
}

export function logFolderPermissionError(folders, context = {}) {
  const line = formatFolderPermissionPm2Log(folders);
  const host = os.hostname();
  const pid = process.pid;
  console.error('');
  console.error('='.repeat(78));
  console.error(`[STORAGE_PERMISSION] host=${host} pid=${pid} ${line}`);
  if (context.route) console.error(`[STORAGE_PERMISSION] route: ${context.route}`);
  if (context.singlesId != null) {
    console.error(`[STORAGE_PERMISSION] singles_id: ${context.singlesId}`);
  }
  if (context.err) {
    console.error(
      `[STORAGE_PERMISSION] errno: ${context.err?.code || 'n/a'} — ${context.err?.message || context.err}`
    );
  }
  console.error('='.repeat(78));
  console.error('');
}

/**
 * Fix + probe all configured app storage roots.
 * @param {{ throwOnFail?: boolean, route?: string }} [opts]
 * @returns {{ ok: boolean, roots: string[], failed: string[] }}
 */
export function ensureAllAppStorageFoldersWritable(opts = {}) {
  const roots = listAppStorageRoots();
  const failed = [];
  const okRoots = [];
  for (const { abs } of roots) {
    const result = ensureStorageRootWritable(abs);
    if (result.ok) okRoots.push(abs);
    else failed.push(abs);
  }
  if (failed.length) {
    logFolderPermissionError(failed, { route: opts.route || 'ensureAllAppStorageFoldersWritable' });
    if (opts.throwOnFail) {
      const err = new Error(FOLDER_PERMISSION_USER_MESSAGE);
      err.code = 'EACCES';
      err.storageRoots = failed;
      throw err;
    }
  }
  return { ok: failed.length === 0, roots: okRoots, failed };
}

/**
 * Ensure a specific path under a storage root is writable (member notes/photos etc.).
 * Tries auto-fix on the closest configured storage root first.
 */
export function ensurePathWritableOrThrow(targetPath, context = {}) {
  const absTarget = path.resolve(String(targetPath || ''));
  const roots = listAppStorageRoots();
  const matching = roots.find((r) => absTarget === r.abs || absTarget.startsWith(r.abs + path.sep));
  const rootAbs = matching?.abs || absTarget;

  tryFixStorageTreePerms(rootAbs);
  try {
    fs.mkdirSync(absTarget, { recursive: true });
    writeProbe(absTarget);
    return { ok: true, abs: absTarget };
  } catch (err) {
    tryFixStorageTreePerms(rootAbs);
    try {
      fs.mkdirSync(absTarget, { recursive: true });
      writeProbe(absTarget);
      return { ok: true, abs: absTarget };
    } catch (retryErr) {
      const folders = matching ? [matching.abs] : [rootAbs];
      logFolderPermissionError(folders, {
        route: context.route || 'ensurePathWritableOrThrow',
        singlesId: context.singlesId,
        err: retryErr
      });
      const e = new Error(FOLDER_PERMISSION_USER_MESSAGE);
      e.code = retryErr?.code || 'EACCES';
      e.cause = retryErr;
      e.path = absTarget;
      e.storageRoots = folders;
      throw e;
    }
  }
}
