/**
 * Append-only hard-copy logs next to ~/.ssh/be/.env.
 * Never unlink, truncate, or overwrite — fs.appendFile only (flag 'a').
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

const BE_DIR = path.join(os.homedir(), '.ssh', 'be');
export const DEMO_HARD_COPY_LOG_PATH = path.join(BE_DIR, 'demolog.log');
export const REGISTER_HARD_COPY_LOG_PATH = path.join(BE_DIR, 'registerlog.log');
export const REQUEST_HARD_COPY_LOG_PATH = path.join(BE_DIR, 'requestlog.log');
export const APPROVE_HARD_COPY_LOG_PATH = path.join(BE_DIR, 'approvelog.log');

function formatLogDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  const offMin = -date.getTimezoneOffset();
  const sign = offMin >= 0 ? '+' : '-';
  const abs = Math.abs(offMin);
  const oh = pad(Math.floor(abs / 60));
  const om = pad(abs % 60);
  return `${y}-${m}-${d} ${hh}:${mm}:${ss} ${sign}${oh}${om}`;
}

/** Privacy: only the last decimal digit, as x.x.x.# — never a full address. */
function maskedIp(raw) {
  let ip = String(raw ?? '').trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice('::ffff:'.length);
  if (/^x\.x\.x\.[0-9]$/.test(ip)) return ip;
  if (!ip || ip === 'unknown') return 'x.x.x.?';
  const lastOctet = ip.includes('.') ? ip.split('.').pop() : ip;
  const digits = String(lastOctet ?? '').replace(/\D/g, '');
  if (!digits) return 'x.x.x.?';
  return `x.x.x.${digits.slice(-1)}`;
}

/** Append one line. Never replaces the file. Login/signup must not fail if this throws. */
function appendOnly(filePath, line) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
    const text = line.endsWith('\n') ? line : `${line}\n`;
    fs.appendFileSync(filePath, text, { flag: 'a', encoding: 'utf8', mode: 0o600 });
  } catch (err) {
    console.error('[hardCopyAuthLog] append failed:', filePath, err?.message ?? err);
  }
}

/** Login with the "demo" alias (not guest). IP stored as x.x.x.# only. */
export function appendDemoLoginHardCopy({ clientIp, at } = {}) {
  const when = formatLogDate(at instanceof Date ? at : new Date());
  const ip = maskedIp(clientIp);
  appendOnly(DEMO_HARD_COPY_LOG_PATH, `${when}\tlogin=demo\tip=${ip}`);
}

/** Registration: email, phone, masked IP, date/time. */
export function appendRegisterHardCopy({ clientIp, email, phone, at } = {}) {
  const when = formatLogDate(at instanceof Date ? at : new Date());
  const ip = maskedIp(clientIp);
  const em = String(email ?? '').trim() || '-';
  const ph = String(phone ?? '').trim() || '-';
  appendOnly(REGISTER_HARD_COPY_LOG_PATH, `${when}\tip=${ip}\temail=${em}\tphone=${ph}`);
}

function logField(value) {
  const s = String(value ?? '')
    .trim()
    .replace(/[\t\r\n]+/g, ' ');
  return s || '-';
}

function partyFields(prefix, party = {}) {
  return [
    `${prefix}_alias=${logField(party.alias)}`,
    `${prefix}_member=${logField(party.member)}`,
    `${prefix}_email=${logField(party.email)}`,
    `${prefix}_phone=${logField(party.phone)}`
  ].join('\t');
}

/** Brief/full bio request. IP is x.x.x.# only. */
export function appendBioRequestHardCopy({
  clientIp,
  bioKind,
  requester = {},
  requestee = {},
  at
} = {}) {
  const when = formatLogDate(at instanceof Date ? at : new Date());
  const ip = maskedIp(clientIp);
  const bio = String(bioKind ?? '').trim().toLowerCase() === 'full' ? 'full' : 'brief';
  appendOnly(
    REQUEST_HARD_COPY_LOG_PATH,
    `${when}\tip=${ip}\tbio=${bio}\t${partyFields('requester', requester)}\t${partyFields('requestee', requestee)}`
  );
}

/** Brief/full bio approval. IP is x.x.x.# only. */
export function appendBioApproveHardCopy({
  clientIp,
  bioKind,
  approver = {},
  requester = {},
  requestee = {},
  at
} = {}) {
  const when = formatLogDate(at instanceof Date ? at : new Date());
  const ip = maskedIp(clientIp);
  const bio = String(bioKind ?? '').trim().toLowerCase() === 'full' ? 'full' : 'brief';
  appendOnly(
    APPROVE_HARD_COPY_LOG_PATH,
    `${when}\tip=${ip}\tbio=${bio}\t${partyFields('approver', approver)}\t${partyFields('requester', requester)}\t${partyFields('requestee', requestee)}`
  );
}
