#!/usr/bin/env node
/**
 * Repair TutaNotes vault files whose on-disk `.enc` size is file_size_bytes + 56 (double-sealed).
 *
 * Layout (be/utils/recordVaultUsb/vaultCrypto.js): IV 12 + TAG 16 + ciphertext => +28 overhead.
 *   file_size_bytes        = plaintext length at seal time (vaultAddNoteAttachment)
 *   correct `.enc` size    = file_size_bytes + 28
 *   double-sealed `.enc`   = file_size_bytes + 56   (sealed bytes were written, then sealed again)
 *
 * SAFETY (why this script refuses more often than it repairs):
 *   Decrypting once returns a buffer of length file_size_bytes + 28 — that is exactly what the
 *   read path (readEncryptedVaultFile -> openVaultBuffer once) serves to the browser as image/png,
 *   which is why the <img> is broken. Length alone does NOT prove the inner bytes are the plaintext:
 *   they are the second seal. The real test is decrypting twice and matching the stored checksum.
 *   This script only overwrites a `.enc` when the twice-decrypted bytes match
 *   file_size_bytes + checksum (sha256 of the plaintext). Otherwise it reports the file as
 *   UNRECOVERABLE and leaves it untouched (the second-seal key is not the current vault key).
 *
 * Candidate second-seal keys tried, in order:
 *   1. the vault at-rest key from TEMPKEY_TUTADRIVE + vault.meta.json KDF params (always);
 *   2. an extra key derived from --salt-env (base64 salt) + TEMPKEY_TUTADRIVE — for a rotated
 *      kdfSalt (vault.meta.json was rewritten after the seal pass);
 *   3. --key-env: a base64 32-byte AES key to try directly;
 *   4. the member's TutaNotes E2E DEK, when the Encrypt Password is supplied (see --password-env).
 *      The DEK is unwrapped in-process from notes_vault (Argon2id KEK -> AES-GCM wrap) and never
 *      printed; the password is read from an environment variable so it stays out of argv/history.
 *
 * Usage (from repo root or be/):
 *   node be/scripts/repairTutaNotesDoubleSealedAttachments.mjs                 # dry run, all members
 *   node be/scripts/repairTutaNotesDoubleSealedAttachments.mjs --note 115       # dry run, one note
 *   node be/scripts/repairTutaNotesDoubleSealedAttachments.mjs --apply         # write repairs
 *   node be/scripts/repairTutaNotesDoubleSealedAttachments.mjs --apply --note 115 --singles 66
 *
 * Options: --apply | --dry-run (default) | --singles <id> | --note <id> | --member <M…> |
 *          --mount <path> | --backup-dir <path> | --salt-env <VAR> | --key-env <VAR> |
 *          --password-env <VAR> | --quiet
 *
 * Never prints secrets from ~/.ssh/be/.env; keys are derived in-process only.
 */
import '../loadEnv.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import argon2 from 'argon2';
import unzipper from 'unzipper';
import pool from '../db/connection.js';
import {
  deriveVaultKeyFromSecretArgon2id,
  deriveVaultKeyFromSecretSha256,
  listEnvVaultUnlockKeys,
  parseVaultKdfSalt,
  vaultMetaUsesArgon2idKdf
} from '../utils/vaultKeys.js';
import { isVaultPhotoAndDbEncryptionEnabled } from '../utils/recordVaultUsb/vaultCrypto.js';
import { decryptBuffer, encryptBuffer } from '../utils/recordVaultUsb/vaultCrypto.js';
import {
  resolveVaultFileStoragePath,
  resolveVaultPhotoStoragePath,
  vaultFilesRoot,
  vaultPhotosRoot,
  vaultRootOnMount
} from '../utils/recordVaultUsb/vaultPaths.js';
import { vaultMetaUsesPlaintextStorage } from '../utils/recordVaultIconEncryption.js';
import {
  loadMemberIdForSingles,
  tutaDriveNotesMountPath
} from '../utils/tutaDriveMemberPaths.js';

const SEAL_OVERHEAD = 12 + 16; // IV + TAG
const DOUBLE_SEAL_SIZE = SEAL_OVERHEAD * 2; // +56

/** Browser WebCrypto layout: iv(12) | ciphertext | tag(16). Server layout is iv | tag | ciphertext. */
function decryptWebCryptoLayout(buf, key) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (b.length < SEAL_OVERHEAD) throw new Error('too short');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, b.subarray(0, 12));
  decipher.setAuthTag(b.subarray(b.length - 16));
  return Buffer.concat([decipher.update(b.subarray(12, b.length - 16)), decipher.final()]);
}

function decryptAnyLayout(buf, key) {
  try {
    return decryptBuffer(buf, key);
  } catch {
    return decryptWebCryptoLayout(buf, key);
  }
}

function parseArgs(argv) {
  const opts = {
    apply: false,
    quiet: false,
    singlesId: null,
    noteId: null,
    memberId: null,
    mount: null,
    backupDir: null,
    passwordEnv: null,
    saltEnv: null,
    keyEnv: null,
    fromBackups: [],
    fromPlainDirs: [],
    keepExtract: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i]);
    const next = () => String(argv[i + 1] ?? '');
    if (arg === '--apply') opts.apply = true;
    else if (arg === '--dry-run') opts.apply = false;
    else if (arg === '--quiet') opts.quiet = true;
    else if (arg === '--singles') { opts.singlesId = Number(next()); i += 1; }
    else if (arg === '--note') { opts.noteId = Number(next()); i += 1; }
    else if (arg === '--member') { opts.memberId = String(next()).trim(); i += 1; }
    else if (arg === '--mount') { opts.mount = String(next()).trim(); i += 1; }
    else if (arg === '--backup-dir') { opts.backupDir = String(next()).trim(); i += 1; }
    else if (arg === '--password-env') { opts.passwordEnv = String(next()).trim(); i += 1; }
    else if (arg === '--salt-env') { opts.saltEnv = String(next()).trim(); i += 1; }
    else if (arg === '--key-env') { opts.keyEnv = String(next()).trim(); i += 1; }
    else if (arg === '--from-backup') { opts.fromBackups.push(String(next()).trim()); i += 1; }
    else if (arg === '--from-plain-dir') { opts.fromPlainDirs.push(String(next()).trim()); i += 1; }
    else if (arg === '--keep-extract') opts.keepExtract = true;
    else if (arg === '--help' || arg === '-h') { opts.help = true; }
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
}

function readVaultMeta(notesMount) {
  const metaPath = path.join(vaultRootOnMount(notesMount), 'vault.meta.json');
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch {
    return null;
  }
}

/** Derive the vault at-rest key(s) for this mount, same way the session unlock does. */
async function resolveVaultKeys(notesMount, meta) {
  if (!meta || vaultMetaUsesPlaintextStorage(meta)) return [];
  if (!isVaultPhotoAndDbEncryptionEnabled()) return [];
  const keys = await listEnvVaultUnlockKeys('tutaCloud', meta);
  return keys.map((k) => k.key).filter(Boolean);
}

/**
 * Unwrap the member's TutaNotes E2E DEK from notes_vault (same math as the browser:
 * Argon2id(Encrypt Password, kdf_salt) -> KEK, AES-256-GCM unwrap of wrapped_dek).
 * Used only when --password-env supplies the password; the DEK never leaves this process.
 */
async function unwrapMemberDek(singlesId, password) {
  const pwd = String(password ?? '');
  if (!pwd) return null;
  const { rows } = await pool.query(
    `SELECT kdf_algo, kdf_salt, kdf_mem_kib, kdf_time, kdf_parallelism, wrapped_dek
       FROM outdateddbsnapshotoct2024.notes_vault
      WHERE singles_id = $1 AND storage_backend = 'tutaCloud'
      LIMIT 1`,
    [Number(singlesId)]
  );
  const row = rows[0];
  if (!row?.kdf_salt || !row?.wrapped_dek) return null;
  const kek = Buffer.from(
    await argon2.hash(pwd, {
      type: argon2.argon2id,
      salt: Buffer.from(row.kdf_salt),
      raw: true,
      hashLength: 32,
      memoryCost: Number(row.kdf_mem_kib) || 65536,
      timeCost: Number(row.kdf_time) || 3,
      parallelism: Number(row.kdf_parallelism) || 1
    })
  );
  try {
    const dek = decryptWebCryptoLayout(Buffer.from(row.wrapped_dek), kek);
    return dek.length === 32 ? dek : null;
  } catch {
    return null; // wrong Encrypt Password
  }
}

async function loadAttachmentRows(singlesId, noteId) {
  const params = [singlesId];
  let where = 'singles_id = $1 AND relative_path IS NOT NULL AND relative_path <> \'\'';
  if (Number.isFinite(noteId) && noteId > 0) {
    params.push(noteId);
    where += ` AND note_id = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT 'attachment' AS kind, attachment_id AS row_id, note_id, file_name, file_extension,
            relative_path, file_size_bytes, checksum, shared_content_key
       FROM outdateddbsnapshotoct2024.notes_note_attachments
      WHERE ${where}
      ORDER BY note_id, attachment_id`,
    params
  );
  return rows;
}

async function loadExtraImageRows(singlesId, noteId) {
  const params = [singlesId];
  let where = 'singles_id = $1 AND relative_path IS NOT NULL AND relative_path <> \'\'';
  if (Number.isFinite(noteId) && noteId > 0) {
    params.push(noteId);
    where += ` AND note_id = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT 'extra_image' AS kind, image_id AS row_id, note_id, file_name, file_extension,
            relative_path, file_size_bytes, checksum, NULL::text AS shared_content_key
       FROM outdateddbsnapshotoct2024.notes_note_extra_images
      WHERE ${where}
      ORDER BY note_id, image_id`,
    params
  );
  return rows;
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Open the outer seal with any key, then the inner seal with any key (both byte layouts).
 * Success only when the twice-opened bytes match file_size_bytes + checksum.
 */
function tryRecover(encBytes, keys, row) {
  const expectedSize = Number(row.file_size_bytes) || 0;
  const expectedSha = String(row.checksum || '').trim().toLowerCase();
  let lastInner = null;
  for (const outerKey of keys) {
    let once;
    try {
      once = decryptBuffer(encBytes, outerKey);
    } catch {
      continue;
    }
    lastInner = once;
    if (expectedSize > 0 && once.length !== expectedSize + SEAL_OVERHEAD) continue;
    for (const innerKey of keys) {
      let twice;
      try {
        twice = decryptAnyLayout(once, innerKey);
      } catch {
        continue;
      }
      if (expectedSize > 0 && twice.length !== expectedSize) continue;
      if (expectedSha && sha256(twice) !== expectedSha) continue;
      return { ok: true, plain: twice, inner: once };
    }
  }
  return { ok: false, inner: lastInner };
}

/**
 * Unseal a TNBAK2 backup zip (browser format) with the Encrypt Password:
 *   TNBAK2 | version(1) | headerLen(u32 BE) | header JSON | iv(12) | ciphertext+tag   (AAD = everything before iv)
 */
async function unsealTnbak2(bytes, password) {
  const magic = bytes.subarray(0, 6).toString('latin1');
  if (magic !== 'TNBAK2') throw new Error(`unsupported backup format "${magic}" (only TNBAK2)`);
  const headerLen = bytes.readUInt32BE(7);
  const prefixLen = 11 + headerLen;
  const header = JSON.parse(bytes.subarray(11, prefixLen).toString('utf8'));
  const kek = Buffer.from(
    await argon2.hash(String(password), {
      type: argon2.argon2id,
      salt: Buffer.from(String(header.kdfSaltB64), 'base64'),
      raw: true,
      hashLength: 32,
      memoryCost: Number(header.kdfMemKib) || 65536,
      timeCost: Number(header.kdfTime) || 3,
      parallelism: Number(header.kdfParallelism) || 1
    })
  );
  let dek;
  try {
    dek = decryptWebCryptoLayout(Buffer.from(String(header.wrappedDekB64), 'base64'), kek);
  } catch {
    throw new Error('wrong Encrypt Password for this backup');
  }
  const iv = bytes.subarray(prefixLen, prefixLen + 12);
  const data = bytes.subarray(prefixLen + 12);
  const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
  decipher.setAAD(bytes.subarray(0, prefixLen));
  decipher.setAuthTag(data.subarray(data.length - 16));
  const zip = Buffer.concat([decipher.update(data.subarray(0, data.length - 16)), decipher.final()]);
  return { zip, dek };
}

const BACKUP_ENV_SECRETS = ['TEMPKEY_TUTADRIVE', 'TEMPKEY_ONEDRIVE', 'TEMPKEY_USB'];

/** Resolve 32-byte AES key from RECORD_NOTES_ICON_KEYS_MASTER_KEY (base64url or passphrase). */
function resolveNotesIconMasterKey() {
  const value = String(process.env.RECORD_NOTES_ICON_KEYS_MASTER_KEY ?? '').trim();
  if (!value) return null;
  try {
    const decoded = Buffer.from(value, 'base64url');
    if (decoded.length === 32) return decoded;
  } catch {
    // passphrase path
  }
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

/** Decrypt global.record_vault_icon_keys_enc → { iconName: secret }. */
async function loadIconSecretMap() {
  const master = resolveNotesIconMasterKey();
  if (!master) return {};
  const { rows } = await pool.query(
    `SELECT record_vault_icon_keys_enc FROM outdateddbsnapshotoct2024.global WHERE id = 1 LIMIT 1`
  );
  const blob = String(rows[0]?.record_vault_icon_keys_enc ?? '').trim();
  if (!blob) return {};
  const buf = Buffer.from(blob, 'base64');
  if (buf.length < 12 + 16 + 1) return {};
  const decipher = crypto.createDecipheriv('aes-256-gcm', master, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  const plain = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
  const map = JSON.parse(plain);
  return map && typeof map === 'object' ? map : {};
}

let cachedIconSecrets = null;
async function getIconSecrets() {
  if (cachedIconSecrets) return cachedIconSecrets;
  try {
    cachedIconSecrets = await loadIconSecretMap();
  } catch (err) {
    console.warn('[repair] icon key map unavailable:', err?.message || err);
    cachedIconSecrets = {};
  }
  return cachedIconSecrets;
}

/**
 * Keys a backup's vault files may be sealed with: every env secret the server has used for
 * TutaNotes (before and after work_337) run through the backup's own vault.meta.json KDF,
 * the legacy SHA-256 form of each, every security-icon secret (pre-work_337 unlock path),
 * and the backup's E2E DEK.
 */
async function backupCandidateKeys(meta, dek) {
  const out = [];
  const seen = new Set();
  const add = (label, key) => {
    if (!key || key.length !== 32) return;
    const id = key.toString('hex');
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ label, key });
  };
  const salt = meta && vaultMetaUsesArgon2idKdf(meta) ? parseVaultKdfSalt(meta.kdfSalt) : null;
  const kdfOpts = salt
    ? {
        memoryCost: meta.kdfMemory,
        timeCost: meta.kdfIterations,
        parallelism: meta.kdfParallelism
      }
    : null;
  for (const name of BACKUP_ENV_SECRETS) {
    const secret = String(process.env[name] ?? '').trim();
    if (!secret) continue;
    if (salt) add(`${name}+argon2id`, await deriveVaultKeyFromSecretArgon2id(secret, salt, kdfOpts));
    add(`${name}+sha256`, deriveVaultKeyFromSecretSha256(secret));
  }
  const iconMap = await getIconSecrets();
  const iconNames = Object.keys(iconMap);
  if (iconNames.length) {
    console.log(`[backup] deriving ${iconNames.length} icon vault keys (one-time Argon2id)…`);
    for (const name of iconNames) {
      const secret = String(iconMap[name] ?? '').trim();
      if (!secret) continue;
      if (salt) {
        add(`icon:${name}+argon2id`, await deriveVaultKeyFromSecretArgon2id(secret, salt, kdfOpts));
      }
      add(`icon:${name}+sha256`, deriveVaultKeyFromSecretSha256(secret));
    }
  }
  add('backup-E2E-DEK', dek);
  return out;
}

function walkFiles(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(abs, out);
    else if (ent.isFile()) out.push(abs);
  }
  return out;
}

const DATA_IMAGE_RE = /data:[a-z]+\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/=]+)/gi;

/** Every data:…;base64 payload inside any string of the (parsed) notes index. */
function collectInlineDataPayloads(value, out) {
  if (typeof value === 'string') {
    if (value.includes(';base64,')) {
      for (const m of value.matchAll(DATA_IMAGE_RE)) out.push(m[1]);
    }
  } else if (Array.isArray(value)) {
    for (const v of value) collectInlineDataPayloads(v, out);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectInlineDataPayloads(v, out);
  }
  return out;
}

/** Unix symlink mode bits in a ZIP external-file-attributes field (high 16 bits). */
const ZIP_S_IFLNK = 0o120000;
const ZIP_S_IFMT = 0o170000;

/**
 * Extract a zip Buffer with unzipper, skipping symlinks.
 * macOS `unzip` dies with "symlink error: Permission denied" on TutaNotes/photos → ../photos.
 */
async function extractZipBufferSkippingSymlinks(zipBuf, extractDir) {
  const directory = await unzipper.Open.buffer(zipBuf);
  const root = path.resolve(extractDir);
  let files = 0;
  let skippedLinks = 0;
  for (const entry of directory.files) {
    if (entry.type === 'Directory') continue;
    const mode = (entry.externalFileAttributes >>> 16) & ZIP_S_IFMT;
    if (mode === ZIP_S_IFLNK) {
      skippedLinks += 1;
      continue;
    }
    if (entry.type !== 'File') continue;
    const out = path.resolve(root, entry.path);
    if (out !== root && !out.startsWith(`${root}${path.sep}`)) {
      throw new Error(`zip entry escapes extract dir: ${entry.path}`);
    }
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await new Promise((resolve, reject) => {
      entry
        .stream()
        .on('error', reject)
        .pipe(fs.createWriteStream(out))
        .on('error', reject)
        .on('finish', resolve);
    });
    files += 1;
  }
  return { files, skippedLinks };
}

/**
 * Index plaintext files under one or more old vault trees (e.g. ~/mac_storage.orig/.../notes)
 * by sha256. No password — used when an unencrypted copy still exists on disk.
 */
function buildPlainDirChecksumIndex(plainDirs, { log }) {
  const bySha = new Map();
  for (const dir of plainDirs) {
    const abs = path.resolve(String(dir).replace(/^~(?=$|\/)/, os.homedir()));
    if (!fs.existsSync(abs)) {
      log(`[plain] skip missing ${abs}`);
      continue;
    }
    let n = 0;
    for (const file of walkFiles(abs)) {
      const base = path.basename(file);
      if (base === 'vault.meta.json' || base.endsWith('.json') || base.endsWith('.enc')) continue;
      const buf = fs.readFileSync(file);
      if (!buf.length) continue;
      const sha = sha256(buf);
      if (!bySha.has(sha)) {
        bySha.set(sha, () => fs.readFileSync(file));
        n += 1;
      }
    }
    log(`[plain] ${abs}: ${n} plaintext files indexed`);
  }
  return bySha;
}

/**
 * Decrypt + extract each backup and index every recoverable plaintext by sha256:
 * vault files (opened once or twice with the backup's server key, or plaintext) and
 * data:image payloads still inline in note bodies of the backup's notes index.
 * Map value = loader returning the plaintext Buffer.
 */
async function buildBackupChecksumIndex(backupPaths, password, { keepExtract, log, workDirs }) {
  const bySha = new Map();
  for (const backupPath of backupPaths) {
    const abs = path.resolve(backupPath.replace(/^~(?=$|\/)/, os.homedir()));
    log(`[backup] unsealing ${abs}`);
    const { zip: plainZip, dek } = await unsealTnbak2(fs.readFileSync(abs), password);
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tnbak-restore-'));
    if (!keepExtract) workDirs.push(workDir);
    const extractDir = path.join(workDir, 'x');
    fs.mkdirSync(extractDir);
    const extracted = await extractZipBufferSkippingSymlinks(plainZip, extractDir);
    log(
      `[backup] extracted ${extracted.files} files` +
        `${extracted.skippedLinks ? ` (skipped ${extracted.skippedLinks} symlink${extracted.skippedLinks === 1 ? '' : 's'})` : ''}` +
        ` to ${extractDir}${keepExtract ? ' (kept)' : ''}`
    );

    const metaPath = walkFiles(extractDir).find((p) => path.basename(p) === 'vault.meta.json');
    const meta = metaPath ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : null;
    const keys = await backupCandidateKeys(meta, dek);
    const keySummary = keys.reduce((acc, k) => {
      const group = k.label.startsWith('icon:') ? 'icon' : k.label;
      acc[group] = (acc[group] || 0) + 1;
      return acc;
    }, {});
    log(`[backup] candidate keys: ${keys.length} (${JSON.stringify(keySummary)})`);

    const tryOpen = (buf) => {
      const hits = [];
      for (const { label, key } of keys) {
        try {
          hits.push({ label, plain: decryptAnyLayout(buf, key) });
        } catch {
          // not sealed with this key
        }
      }
      return hits;
    };
    /** Raw bytes plus every once- and twice-opened layer, each tagged with the key path. */
    const openLayers = (buf) => {
      const layers = [{ label: 'raw', plain: buf }];
      for (const once of tryOpen(buf)) {
        layers.push(once);
        for (const twice of tryOpen(once.plain)) {
          layers.push({ label: `${once.label}>${twice.label}`, plain: twice.plain });
        }
      }
      return layers;
    };

    let files = 0;
    let unopened = 0;
    let inline = 0;
    const byLabel = {};
    for (const file of walkFiles(extractDir)) {
      const base = path.basename(file);
      if (base === 'vault.meta.json' || base.endsWith('.json')) continue;
      const layers = openLayers(fs.readFileSync(file));
      if (layers.length === 1) unopened += 1;
      layers.forEach(({ label, plain }, depth) => {
        byLabel[label] = (byLabel[label] || 0) + 1;
        const sha = sha256(plain);
        if (!bySha.has(sha)) {
          bySha.set(sha, () => openLayers(fs.readFileSync(file))[depth]?.plain ?? null);
          files += 1;
        }
      });
    }
    log(`[backup] files opened per key: ${JSON.stringify(byLabel)}; files no key opened: ${unopened}`);

    const indexPath = walkFiles(extractDir).find((p) => /^TutaNotesIndex\.json(\.enc)?$/.test(path.basename(p)));
    if (indexPath) {
      const rawIndex = fs.readFileSync(indexPath);
      let index = null;
      for (const { plain: layer } of openLayers(rawIndex)) {
        try {
          index = JSON.parse(layer.toString('utf8'));
          break;
        } catch {
          // try next layer
        }
      }
      for (const b64 of collectInlineDataPayloads(index, [])) {
        const buf = Buffer.from(b64, 'base64');
        const sha = sha256(buf);
        if (!bySha.has(sha)) {
          bySha.set(sha, () => buf);
          inline += 1;
        }
      }
    }
    log(`[backup] ${path.basename(abs)}: ${files} file layers + ${inline} inline images indexed`);
  }
  return bySha;
}

function backupFile(absPath, backupDir, kind) {
  fs.mkdirSync(backupDir, { recursive: true });
  const flat = absPath.replace(/^\//, '').replace(/[\\/]/g, '__');
  const dest = path.join(backupDir, `${flat}.${kind}.bak`);
  if (!fs.existsSync(dest)) fs.copyFileSync(absPath, dest);
  return dest;
}

function atomicWriteFileSync(absPath, buffer) {
  const dir = path.dirname(absPath);
  const tmp = `${absPath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, buffer);
  try {
    fs.fsyncSync(fs.openSync(tmp, 'r'));
  } catch {
    // best effort
  }
  fs.renameSync(tmp, absPath);
  try {
    fs.fsyncSync(fs.openSync(dir, 'r'));
  } catch {
    // ignore
  }
}

function magicOf(buf) {
  return Buffer.isBuffer(buf) && buf.length >= 4 ? buf.subarray(0, 4).toString('hex') : '';
}

async function repairMember({ singlesId, memberId, notesMount, opts, counters, noteStats, log }) {
  const meta = readVaultMeta(notesMount);
  if (!meta) {
    log(`[skip] singles_id=${singlesId} no vault.meta.json under ${vaultRootOnMount(notesMount)}`);
    counters.skipped += 1;
    return;
  }
  const keys = await resolveVaultKeys(notesMount, meta);
  if (opts.saltEnv) {
    const saltB64 = String(process.env[opts.saltEnv] ?? '').trim();
    if (!saltB64) {
      log(`[warn] singles_id=${singlesId} env ${opts.saltEnv} is empty — skipping alternate-salt key`);
    } else {
      try {
        const alt = await listEnvVaultUnlockKeys('tutaCloud', {
          ...meta,
          kdf: 'argon2id',
          kdfSalt: saltB64,
          kdfMemory: meta.kdfMemory ?? 65536,
          kdfIterations: meta.kdfIterations ?? 3,
          kdfParallelism: meta.kdfParallelism ?? 1
        });
        for (const k of alt.map((x) => x.key).filter(Boolean)) keys.push(k);
        log(`[vault] singles_id=${singlesId} + alternate-salt key from ${opts.saltEnv}`);
      } catch (err) {
        log(`[warn] singles_id=${singlesId} alternate-salt key failed: ${err?.message || err}`);
      }
    }
  }
  if (opts.keyEnv) {
    const raw = String(process.env[opts.keyEnv] ?? '').trim();
    if (!raw) {
      log(`[warn] singles_id=${singlesId} env ${opts.keyEnv} is empty — skipping direct key`);
    } else {
      const buf = Buffer.from(raw, 'base64');
      if (buf.length === 32) {
        keys.push(buf);
        log(`[vault] singles_id=${singlesId} + direct key from ${opts.keyEnv}`);
      } else {
        log(`[warn] singles_id=${singlesId} ${opts.keyEnv} is not a base64 32-byte key`);
      }
    }
  }
  if (opts.passwordEnv) {
    const pwd = String(process.env[opts.passwordEnv] ?? '');
    if (!pwd) {
      log(`[warn] singles_id=${singlesId} env ${opts.passwordEnv} is empty — skipping E2E DEK candidate`);
    } else {
      const dek = await unwrapMemberDek(singlesId, pwd);
      if (dek) {
        keys.push(dek);
        log(`[vault] singles_id=${singlesId} + E2E DEK candidate (unwrapped from notes_vault)`);
      } else {
        log(`[warn] singles_id=${singlesId} could not unwrap E2E DEK — wrong Encrypt Password for this member`);
      }
    }
  }
  if (!keys.length) {
    log(
      `[skip] singles_id=${singlesId} vault key unavailable ` +
        `(meta encryption=${meta.encryption ?? 'none'}, NOTES_ENCRYPT_PHOTO_AND_DB / TEMPKEY_TUTADRIVE must be set)`
    );
    counters.skipped += 1;
    return;
  }
  log(
    `[vault] singles_id=${singlesId} member=M${memberId} mount=${notesMount} ` +
      `kdf=${meta.kdf ?? 'sha256'} keys=${keys.length}`
  );

  const rows = [
    ...(await loadAttachmentRows(singlesId, opts.noteId)),
    ...(await loadExtraImageRows(singlesId, opts.noteId))
  ].filter((r) => !r.shared_content_key);

  for (const row of rows) {
    const isPhotoKind = row.kind === 'extra_image';
    const abs = isPhotoKind
      ? resolveVaultPhotoStoragePath(notesMount, row.relative_path)
      : resolveVaultFileStoragePath(notesMount, row.relative_path);
    const label = `${row.kind} note=${row.note_id} id=${row.row_id} ${row.file_name || row.relative_path}`;

    if (!fs.existsSync(abs)) {
      counters.skipped += 1;
      noteStats(row, 'missing');
      log(`[missing] ${label}`);
      continue;
    }
    const size = fs.statSync(abs).size;
    const delta = size - (Number(row.file_size_bytes) || 0);
    if (delta === SEAL_OVERHEAD) {
      counters.singleSealed += 1;
      noteStats(row, 'ok');
      continue;
    }
    if (delta !== DOUBLE_SEAL_SIZE) {
      counters.skipped += 1;
      noteStats(row, 'skipped');
      log(`[skip] ${label} unexpected delta=${delta} (size=${size} db=${row.file_size_bytes})`);
      continue;
    }

    counters.doubleSealed += 1;
    const encBytes = fs.readFileSync(abs);
    let recovered = tryRecover(encBytes, keys, row);
    let source = 'unwrap';
    if (!recovered.ok && opts.backupIndex) {
      const expectedSha = String(row.checksum || '').trim().toLowerCase();
      const load = expectedSha ? opts.backupIndex.get(expectedSha) : null;
      const plain = load ? load() : null;
      if (plain && plain.length === (Number(row.file_size_bytes) || 0) && sha256(plain) === expectedSha) {
        recovered = { ok: true, plain };
        source = 'backup';
      }
    }
    if (!recovered.ok) {
      counters.failed += 1;
      noteStats(row, 'unrecoverable');
      const innerLen = recovered.inner?.length ?? null;
      log(
        `[unrecoverable] ${label} size=${size} db=${row.file_size_bytes} ` +
          `innerLen=${innerLen ?? 'n/a'} — no key unwraps it` +
          `${opts.backupIndex ? ' and no backup copy matches its checksum' : ''}`
      );
      continue;
    }

    if (!opts.apply) {
      counters.repairable += 1;
      noteStats(row, 'repairable');
      log(
        `[dry-run] would repair ${label} from ${source} -> ${recovered.plain.length} bytes magic=${magicOf(recovered.plain)}`
      );
      continue;
    }

    const backupPath = backupFile(
      abs,
      opts.backupDir ||
        path.join(path.dirname(abs), '.doubleseal-backup'),
      'doubleseal'
    );
    // Re-seal the recovered plaintext once with the vault key (the inner key may differ).
    atomicWriteFileSync(abs, encryptBuffer(recovered.plain, keys[0]));
    // Verify in place: one open now returns exactly the plaintext.
    let verify = null;
    try {
      verify = decryptBuffer(fs.readFileSync(abs), keys[0]);
    } catch {
      verify = null;
    }
    const verifyOk =
      verify &&
      verify.length === (Number(row.file_size_bytes) || 0) &&
      (!row.checksum || sha256(verify) === String(row.checksum).toLowerCase());
    if (!verifyOk) {
      fs.copyFileSync(backupPath, abs);
      counters.failed += 1;
      noteStats(row, 'verify-failed');
      log(`[fail] ${label} verify failed after write — restored from ${backupPath}`);
      continue;
    }
    counters.repaired += 1;
    noteStats(row, 'repaired');
    log(`[repaired] ${label} -> ${verify.length} bytes magic=${magicOf(verify)} backup=${backupPath}`);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(
      'Usage: node be/scripts/repairTutaNotesDoubleSealedAttachments.mjs ' +
        '[--apply] [--singles <id>] [--note <id>] [--member <M...>] [--mount <path>] ' +
        '[--backup-dir <path>] [--salt-env <VAR>] [--key-env <VAR>] [--password-env <VAR>] ' +
        '[--from-backup <TNBAK2 zip>]... [--from-plain-dir <vault notes dir>]... [--keep-extract]'
    );
    return;
  }
  const quiet = opts.quiet;
  const log = quiet ? () => {} : (msg) => console.log(msg);

  const singlesList = [];
  if (Number.isFinite(opts.singlesId) && opts.singlesId > 0) {
    singlesList.push(opts.singlesId);
  } else {
    const { rows } = await pool.query(
      `SELECT DISTINCT singles_id
         FROM outdateddbsnapshotoct2024.notes_note_attachments
        ORDER BY singles_id ASC`
    );
    for (const r of rows) singlesList.push(Number(r.singles_id));
  }

  const counters = {
    members: 0,
    singleSealed: 0,
    doubleSealed: 0,
    repairable: 0,
    repaired: 0,
    failed: 0,
    skipped: 0
  };
  const perNote = new Map();
  function noteStats(row, status) {
    const key = `${row.note_id}`;
    if (!perNote.has(key)) perNote.set(key, { total: 0, statuses: {} });
    const entry = perNote.get(key);
    entry.total += 1;
    entry.statuses[status] = (entry.statuses[status] || 0) + 1;
  }

  console.log(
    `[repair] mode=${opts.apply ? 'APPLY' : 'DRY-RUN'} singles=${singlesList.join(',')}` +
      `${opts.noteId ? ` note=${opts.noteId}` : ''}`
  );

  opts.backupIndex = opts.backupIndex || new Map();
  if (opts.fromPlainDirs.length) {
    const plainIndex = buildPlainDirChecksumIndex(opts.fromPlainDirs, {
      log: (msg) => console.log(msg)
    });
    for (const [sha, load] of plainIndex) {
      if (!opts.backupIndex.has(sha)) opts.backupIndex.set(sha, load);
    }
  }
  if (opts.fromBackups.length) {
    const pwd = opts.passwordEnv ? String(process.env[opts.passwordEnv] ?? '') : '';
    if (!pwd) throw new Error('--from-backup needs the Encrypt Password (use --ask-password / --password-env)');
    const bakIndex = await buildBackupChecksumIndex(opts.fromBackups, pwd, {
      keepExtract: opts.keepExtract,
      log: (msg) => console.log(msg),
      workDirs: cleanupDirs
    });
    for (const [sha, load] of bakIndex) {
      if (!opts.backupIndex.has(sha)) opts.backupIndex.set(sha, load);
    }
  }
  if (!opts.backupIndex.size) opts.backupIndex = null;

  for (const singlesId of singlesList) {
    let memberId = opts.memberId || (await loadMemberIdForSingles(singlesId));
    if (!memberId) {
      console.log(`[skip] singles_id=${singlesId} has no member_id`);
      counters.skipped += 1;
      continue;
    }
    const notesMount = opts.mount || tutaDriveNotesMountPath(memberId);
    if (!fs.existsSync(vaultFilesRoot(notesMount)) && !fs.existsSync(vaultPhotosRoot(notesMount))) {
      console.log(`[skip] singles_id=${singlesId} vault folders missing under ${notesMount}`);
      counters.skipped += 1;
      continue;
    }
    counters.members += 1;
    await repairMember({ singlesId, memberId, notesMount, opts, counters, noteStats, log });
  }

  // Note 115 (and any explicit --note) summary.
  const focusNote = Number.isFinite(opts.noteId) && opts.noteId > 0 ? String(opts.noteId) : null;
  if (focusNote) {
    const entry = perNote.get(focusNote) || { total: 0, statuses: {} };
    console.log(`[note ${focusNote}] rows=${entry.total} ${JSON.stringify(entry.statuses)}`);
  }

  console.log('\n=== SUMMARY ===');
  console.log(
    JSON.stringify(
      {
        mode: opts.apply ? 'apply' : 'dry-run',
        members: counters.members,
        singleSealedOk: counters.singleSealed,
        doubleSealed: counters.doubleSealed,
        repairable: counters.repairable,
        repaired: counters.repaired,
        failed: counters.failed,
        skipped: counters.skipped
      },
      null,
      2
    )
  );
  if (!opts.apply && counters.repairable === 0 && counters.doubleSealed > 0) {
    console.log(
      '\nNo file is safely repairable: no key unwraps the inner layer' +
        `${opts.backupIndex ? ' and no backup copy matches the checksums' : ''}. Nothing was written.\n` +
        'Try --from-backup <EncryptedTutaNotesZip_….zip> --ask-password to restore originals from an older backup.'
    );
  }
}

const cleanupDirs = [];
function removeCleanupDirs() {
  for (const dir of cleanupDirs) fs.rmSync(dir, { recursive: true, force: true });
}

main()
  .then(async () => {
    removeCleanupDirs();
    await pool.end().catch(() => {});
    process.exit(0);
  })
  .catch(async (err) => {
    removeCleanupDirs();
    console.error('[repair] failed:', err?.message || err);
    await pool.end().catch(() => {});
    process.exit(1);
  });
