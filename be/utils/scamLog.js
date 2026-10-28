/**
 * Append-only safe-keeping copy of every chat_scam_alert row: `${LOG_FOLER}/scamlog.txt`
 * (LOG_FOLDER also accepted), one JSON object per line. The file is only ever opened in append
 * mode; nothing in the app truncates, rotates or deletes it.
 *
 * If the log folder env var is unset or does not resolve to an absolute path, falls back to
 * `${LARGE_CHEAP_STORAGE_FOLDER}/logs` so every web server writes the same shared file.
 */
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const LOG = '[scamLog]';
export const SCAM_LOG_FILE_NAME = 'scamlog.txt';

let warnedFallback = false;

function expandEnvRefs(raw, env) {
  let value = String(raw || '').trim();
  if (value === '~' || value.startsWith('~/')) value = path.join(os.homedir(), value.slice(1));
  return value.replace(/\$\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)|\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, a, b) =>
    String(env[a || b] ?? '')
  );
}

export function resolveScamLogFolder(env = process.env) {
  const configured = expandEnvRefs(env.LOG_FOLER || env.LOG_FOLDER || '', env);
  if (configured && path.isAbsolute(configured) && !configured.includes('$')) return configured;

  const shared = String(env.LARGE_CHEAP_STORAGE_FOLDER || '').trim();
  const fallback = shared ? path.join(shared, 'logs') : path.join(os.homedir(), 'logs');
  if (!warnedFallback) {
    warnedFallback = true;
    console.warn(`${LOG} LOG_FOLER is unset or not an absolute path after expansion — writing to ${fallback}`);
  }
  return fallback;
}

export function scamLogFilePath(env = process.env) {
  return path.join(resolveScamLogFolder(env), SCAM_LOG_FILE_NAME);
}

/** Append one line. Never throws: a log-disk problem must not break scam detection. */
export async function appendScamLog(entry) {
  const file = scamLogFilePath();
  const line = `${JSON.stringify({ logged_at: new Date().toISOString(), host: os.hostname(), ...entry })}\n`;
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.appendFile(file, line, { encoding: 'utf8', flag: 'a' });
  } catch (err) {
    console.error(`${LOG} append to ${file} failed:`, err?.message || err);
  }
}
