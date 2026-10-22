/**
 * Append-only hard-copy logs next to ~/.ssh/be/.env.
 * Never unlink, truncate, or overwrite — fs.appendFile only (flag 'a').
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { normalizeLogIp, shouldSkipIpLog } from './ipLogSkipList.js';

const BE_DIR = path.join(os.homedir(), '.ssh', 'be');
export const DEMO_HARD_COPY_LOG_PATH = path.join(BE_DIR, 'demolog.log');
export const REGISTER_HARD_COPY_LOG_PATH = path.join(BE_DIR, 'registerlog.log');
export const REQUEST_HARD_COPY_LOG_PATH = path.join(BE_DIR, 'requestlog.log');
export const APPROVE_HARD_COPY_LOG_PATH = path.join(BE_DIR, 'approvelog.log');
export const RAFFLE_HARD_COPY_LOG_PATH = path.join(BE_DIR, 'raffle_log.log');

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

/** Full client IP for the log line (`-` when unknown). */
function logIp(raw) {
  return logField(normalizeLogIp(raw));
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

/** `device=… browser=… os=…` from clientDeviceInfo.parseClientDevice (`-` when unknown). */
function deviceFields(device) {
  return [
    `device=${logField(device?.deviceType)}`,
    `browser=${logField(device?.browser)}`,
    `os=${logField(device?.os)}`
  ].join('\t');
}

/** Login with the "demo" alias (not guest). Full IP; local / home IPs are not logged. */
export function appendDemoLoginHardCopy({ clientIp, device, at } = {}) {
  if (shouldSkipIpLog(clientIp)) return;
  const when = formatLogDate(at instanceof Date ? at : new Date());
  const ip = logIp(clientIp);
  appendOnly(DEMO_HARD_COPY_LOG_PATH, `${when}\tlogin=demo\tip=${ip}\t${deviceFields(device)}`);
}

/** Registration: email, phone, full IP, device, date/time. Local / home IPs are not logged. */
export function appendRegisterHardCopy({ clientIp, email, phone, device, at } = {}) {
  if (shouldSkipIpLog(clientIp)) return;
  const when = formatLogDate(at instanceof Date ? at : new Date());
  const ip = logIp(clientIp);
  const em = String(email ?? '').trim() || '-';
  const ph = String(phone ?? '').trim() || '-';
  appendOnly(
    REGISTER_HARD_COPY_LOG_PATH,
    `${when}\tip=${ip}\temail=${em}\tphone=${ph}\t${deviceFields(device)}`
  );
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

/** Brief/full bio request. Full client IP. */
export function appendBioRequestHardCopy({
  clientIp,
  bioKind,
  requester = {},
  requestee = {},
  at
} = {}) {
  const when = formatLogDate(at instanceof Date ? at : new Date());
  const ip = logIp(clientIp);
  const bio = String(bioKind ?? '').trim().toLowerCase() === 'full' ? 'full' : 'brief';
  appendOnly(
    REQUEST_HARD_COPY_LOG_PATH,
    `${when}\tip=${ip}\tbio=${bio}\t${partyFields('requester', requester)}\t${partyFields('requestee', requestee)}`
  );
}

function isoField(value) {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? logField(value) : formatLogDate(d);
}

/** Generate My Raffle: one line per newly issued raffle number. */
export function appendRaffleHardCopy({
  raffleNumber,
  raffleGenerateId,
  raffleGenerateDatetime,
  singlesId,
  singlesEmail,
  singlesFullname,
  eventTitle,
  hostFullName,
  hostUrl,
  hostEventStart,
  hostEventEnd
} = {}) {
  appendOnly(
    RAFFLE_HARD_COPY_LOG_PATH,
    [
      'action=generate',
      `raffle_generate_id=${logField(raffleGenerateId)}`,
      `raffle_generate_datetime=${isoField(raffleGenerateDatetime)}`,
      `raffle_number=${logField(raffleNumber)}`,
      `singles_id=${logField(singlesId)}`,
      `singles_email=${logField(singlesEmail)}`,
      `singles_fullname=${logField(singlesFullname)}`,
      `event_title=${logField(eventTitle)}`,
      `host_full_name=${logField(hostFullName)}`,
      `host_url=${logField(hostUrl)}`,
      `host_event_start=${isoField(hostEventStart)}`,
      `host_event_end=${isoField(hostEventEnd)}`
    ].join('\t')
  );
}

/**
 * /host action (draw | scan | code), same append-only raffle_log.log.
 * `fields` keys are written in insertion order as key=value after action= and datetime=.
 */
export function appendRaffleHostActionHardCopy(action, fields = {}, at = new Date()) {
  const parts = [`action=${logField(action)}`, `datetime=${formatLogDate(at instanceof Date ? at : new Date())}`];
  for (const [key, value] of Object.entries(fields)) {
    parts.push(`${key}=${value instanceof Date ? isoField(value) : logField(value)}`);
  }
  appendOnly(RAFFLE_HARD_COPY_LOG_PATH, parts.join('\t'));
}

/** Brief/full bio approval. Full client IP. */
export function appendBioApproveHardCopy({
  clientIp,
  bioKind,
  approver = {},
  requester = {},
  requestee = {},
  at
} = {}) {
  const when = formatLogDate(at instanceof Date ? at : new Date());
  const ip = logIp(clientIp);
  const bio = String(bioKind ?? '').trim().toLowerCase() === 'full' ? 'full' : 'brief';
  appendOnly(
    APPROVE_HARD_COPY_LOG_PATH,
    `${when}\tip=${ip}\tbio=${bio}\t${partyFields('approver', approver)}\t${partyFields('requester', requester)}\t${partyFields('requestee', requestee)}`
  );
}
