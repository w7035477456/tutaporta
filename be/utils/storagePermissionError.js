/**
 * Detection, diagnostics, and user-facing text for media-storage permission faults.
 *
 * A storage folder owned by the wrong user makes every upload die at write time
 * with EACCES. The request looks healthy through auth, parsing, and validation,
 * so without an explicit signal it surfaces as a generic 500.
 *
 * Cluster note: web servers are round-robin with no sticky sessions, so a single
 * misconfigured host breaks roughly 1 in N uploads while the others succeed. Every
 * line below is stamped with hostname and pid — that is what makes an intermittent
 * failure traceable to one machine.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

export const STORAGE_PERMISSION_CODE = 'STORAGE_PERMISSION';
export const STORAGE_PERMISSION_USER_MESSAGE = 'Upload failed. Permission error. Please contact admin.';

const PERMISSION_CODES = new Set(['EACCES', 'EPERM', 'EROFS']);
const TAG = '[STORAGE_PERMISSION]';

export function isStoragePermissionError(err) {
  return PERMISSION_CODES.has(String(err?.code ?? '').trim());
}

/** uid/gid -> name via /etc/passwd, /etc/group. Numeric fallback keeps this safe on any host. */
function nameLookup(file, id) {
  try {
    const line = fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .find((l) => l.split(':')[2] === String(id));
    return line ? `${line.split(':')[0]}(${id})` : String(id);
  } catch {
    return String(id);
  }
}

function describeLevel(target) {
  try {
    const st = fs.statSync(target);
    const mode = (st.mode & 0o7777).toString(8).padStart(3, '0');
    const owner = nameLookup('/etc/passwd', st.uid);
    const group = nameLookup('/etc/group', st.gid);
    let access = 'no-write';
    try {
      fs.accessSync(target, fs.constants.W_OK);
      access = 'writable';
    } catch {
      /* keep no-write */
    }
    return `${target}  owner=${owner}:${group} mode=${mode} ${access}`;
  } catch (statErr) {
    return `${target}  <${statErr?.code || 'unreadable'}>`;
  }
}

/** namei-style walk: shows which level in the chain actually blocks the write. */
function describePathChain(target) {
  const abs = path.resolve(String(target || ''));
  const parts = abs.split(path.sep).filter(Boolean);
  const levels = ['/'];
  let cur = '';
  for (const part of parts) {
    cur += `${path.sep}${part}`;
    levels.push(cur);
  }
  return levels.map(describeLevel);
}

/**
 * Emits a loud, greppable block. Uses console.error rather than appLog on purpose:
 * this must never be filtered out by PM2_LOG_LEVEL.
 */
export function logStoragePermissionFailure(err, context = {}) {
  const { route = 'unknown', envKey = 'VSINGLES_PHOTO_FOLDER', folder = '', singlesId = null } = context;

  const failedPath = String(err?.path ?? '').trim();
  const targetDir = failedPath ? path.dirname(failedPath) : String(folder || '').replace(/\/+$/, '');
  const host = os.hostname();
  const pid = process.pid;
  const stamp = `${TAG} host=${host} pid=${pid}`;

  let procUser = `uid=${typeof process.getuid === 'function' ? process.getuid() : '?'}`;
  try {
    const info = os.userInfo();
    procUser = `${info.username} (uid=${info.uid} gid=${info.gid})`;
  } catch {
    /* keep uid fallback */
  }

  const lines = [
    '',
    '='.repeat(78),
    `${stamp} MEDIA STORAGE PERMISSION FAILURE — UPLOADS ARE BROKEN ON THIS HOST`,
    '='.repeat(78),
    `${stamp} route            : ${route}`,
    `${stamp} singles_id       : ${singlesId ?? 'n/a'}`,
    `${stamp} errno code       : ${err?.code ?? 'n/a'}`,
    `${stamp} syscall          : ${err?.syscall ?? 'n/a'}`,
    `${stamp} message          : ${err?.message ?? 'n/a'}`,
    `${stamp} failed path      : ${failedPath || '(not reported by errno)'}`,
    `${stamp} target directory : ${targetDir || '(unknown)'}`,
    `${stamp} env key          : ${envKey}`,
    `${stamp} env value        : ${folder || process.env[envKey] || '(unset)'}`,
    `${stamp} node runs as     : ${procUser}`,
    `${stamp} node version     : ${process.version}`,
    '',
    `${stamp} PATH OWNERSHIP CHAIN (first non-writable level is the culprit):`
  ];

  if (targetDir) {
    for (const level of describePathChain(targetDir)) {
      lines.push(`${stamp}   ${level}`);
    }
  } else {
    lines.push(`${stamp}   (no path available to inspect)`);
  }

  const fixTarget = targetDir || `$${envKey}`;
  let owner = 'lawsen0';
  try {
    owner = os.userInfo().username;
  } catch {
    /* keep default */
  }

  lines.push(
    '',
    `${stamp} HOW TO FIX — run on host "${host}" as a sudoer:`,
    `${stamp}   sudo chown -R ${owner}:${owner} '${fixTarget}'`,
    `${stamp}   sudo chmod -R u+rwX '${fixTarget}'`,
    `${stamp}   pm2 restart onlinemallwebsite`,
    `${stamp}   # verify:  checkstorage      # fix every host:  fixstorage --all-hosts`,
    '',
    `${stamp} CLUSTER WARNING: web servers are round-robin with no sticky sessions.`,
    `${stamp} Only host "${host}" is confirmed broken. Uploads will keep succeeding on`,
    `${stamp} healthy hosts, so users see INTERMITTENT failures. Check EVERY web server.`,
    '='.repeat(78),
    ''
  );

  console.error(lines.join('\n'));
}
