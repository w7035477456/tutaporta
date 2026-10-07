/**
 * TutaDrive member backup — encrypted backup files under users/M{id}/.
 * Plain vault zip is produced server-side; Encrypt Password sealing happens in the browser (DEK).
 *
 * Stored name: EncryptedTutaNotesZip_YYYY_MM_DD[_<note>][_N].zip  (payload = TNBAK2 — or legacy TNBAK1 — sealed bytes from client)
 * Legacy names EncryptedBackup_* / backup_YYYY-MM-DD[_HH-MM-SS].zip are still listed / restorable / deletable.
 * Per-file note + password hint live in backup_notes.json (hint is shown when Restore / Merge asks for the password).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZipArchive } from 'archiver';
import { Extract } from 'unzipper';
import {
  ensureTutaDriveMemberLayout,
  loadMemberIdForSingles,
  tutaDriveMemberRoot
} from './tutaDriveMemberPaths.js';
import { getVaultSession, flushDbToUsb, logoffVaultUsb } from './recordVaultUsb/vaultSession.js';
import {
  vaultPhotosRoot,
  vaultRootOnMount,
  VAULT_DIR_NAME,
  VAULT_META_FILE
} from './recordVaultUsb/vaultPaths.js';
import {
  resolveTutaDriveBackupDateStamp,
  TUTADRIVE_BACKUP_HINT_MAX_LEN,
  TUTADRIVE_BACKUP_NAME_RE,
  TUTADRIVE_BACKUP_NOTE_MAX_LEN,
  tutaDriveBackupFileName
} from './tutaDriveBackupNames.js';

export { TUTADRIVE_BACKUP_NAME_RE };
const BACKUP_NAME_RE = TUTADRIVE_BACKUP_NAME_RE;
const BACKUP_NOTES_FILE = 'backup_notes.json';
/** Legacy notes (before the <20 char rule) may be longer; keep them readable. */
const BACKUP_NOTE_STORED_MAX_LEN = 500;

function sanitizeBackupNote(note) {
  return String(note || '').trim().slice(0, BACKUP_NOTE_STORED_MAX_LEN);
}

function sanitizeBackupHint(hint) {
  return String(hint || '').trim().slice(0, TUTADRIVE_BACKUP_HINT_MAX_LEN);
}

function backupNotesAbsPath(memberId) {
  return path.join(tutaDriveMemberRoot(memberId), BACKUP_NOTES_FILE);
}

const B64_RE = /^[A-Za-z0-9+/=]{8,200}$/;

function boundedInt(value, min, max) {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

/**
 * Per-backup password check (TNBAK3 header): Argon2id salt + params + SHA-256 verifier.
 * Lets Restore / Merge verify the typed password before decrypting. Params are bounded so a
 * crafted file cannot make the browser run an enormous KDF.
 */
function sanitizePasswordCheck(check) {
  if (!check || typeof check !== 'object') return null;
  const kdfSaltB64 = String(check.kdfSaltB64 || '');
  const verifierB64 = String(check.verifierB64 || '');
  if (!B64_RE.test(kdfSaltB64) || !B64_RE.test(verifierB64)) return null;
  const kdfMemKib = boundedInt(check.kdfMemKib, 8192, 262144);
  const kdfTime = boundedInt(check.kdfTime, 1, 10);
  const kdfParallelism = boundedInt(check.kdfParallelism, 1, 4);
  if (kdfMemKib == null || kdfTime == null || kdfParallelism == null) return null;
  return { kdfAlgo: 'argon2id', kdfSaltB64, kdfMemKib, kdfTime, kdfParallelism, verifierB64 };
}

/** Plaintext header of a TNBAK3 (per-backup password) sealed zip, or null for other formats. */
export function readTutaDriveBackupPasswordHeader(buf) {
  const bytes = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || []);
  const MAGIC = 'TNBAK3';
  if (bytes.length < MAGIC.length + 5 || bytes.toString('latin1', 0, MAGIC.length) !== MAGIC) return null;
  const headerLen = bytes.readUInt32BE(MAGIC.length + 1);
  const start = MAGIC.length + 5;
  if (headerLen > 64 * 1024 || bytes.length < start + headerLen) return null;
  try {
    const header = JSON.parse(bytes.toString('utf8', start, start + headerLen));
    return {
      passwordCheck: sanitizePasswordCheck(header),
      hint: sanitizeBackupHint(header?.hint),
      note: sanitizeBackupNote(header?.note)
    };
  } catch {
    return null;
  }
}

/** fileName → { note, hint, passwordCheck }. Legacy entries store the note as a plain string. */
function readBackupMetaMap(memberId) {
  const abs = backupNotesAbsPath(memberId);
  if (!fs.existsSync(abs)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out = {};
    for (const [fileName, value] of Object.entries(parsed)) {
      if (!BACKUP_NAME_RE.test(fileName)) continue;
      const raw = value && typeof value === 'object' ? value : { note: value };
      const note = sanitizeBackupNote(raw.note);
      const hint = sanitizeBackupHint(raw.hint);
      const passwordCheck = sanitizePasswordCheck(raw.passwordCheck);
      if (note || hint || passwordCheck) out[fileName] = { note, hint, passwordCheck };
    }
    return out;
  } catch {
    return {};
  }
}

function writeBackupMetaMap(memberId, map) {
  ensureTutaDriveMemberLayout(memberId);
  const abs = backupNotesAbsPath(memberId);
  const cleaned = {};
  for (const [fileName, value] of Object.entries(map || {})) {
    if (!BACKUP_NAME_RE.test(fileName)) continue;
    const note = sanitizeBackupNote(value?.note);
    const hint = sanitizeBackupHint(value?.hint);
    const passwordCheck = sanitizePasswordCheck(value?.passwordCheck);
    if (!note && !hint && !passwordCheck) continue;
    cleaned[fileName] = {
      ...(note ? { note } : {}),
      ...(hint ? { hint } : {}),
      ...(passwordCheck ? { passwordCheck } : {})
    };
  }
  if (!Object.keys(cleaned).length) {
    if (fs.existsSync(abs)) fs.rmSync(abs, { force: true });
    return;
  }
  fs.writeFileSync(abs, `${JSON.stringify(cleaned, null, 2)}\n`, 'utf8');
}

/**
 * Update note / hint / passwordCheck for one backup file. `undefined` keeps the current value.
 * @returns {{ note: string, hint: string, passwordCheck: object|null }}
 */
export function setTutaDriveBackupMeta(memberId, fileName, { note, hint, passwordCheck } = {}) {
  const wanted = String(fileName || '').trim();
  if (!BACKUP_NAME_RE.test(wanted)) return { note: '', hint: '', passwordCheck: null };
  const map = readBackupMetaMap(memberId);
  const current = map[wanted] || { note: '', hint: '', passwordCheck: null };
  const next = {
    note: note === undefined ? current.note : sanitizeBackupNote(note),
    hint: hint === undefined ? current.hint : sanitizeBackupHint(hint),
    passwordCheck: passwordCheck === undefined ? current.passwordCheck : sanitizePasswordCheck(passwordCheck)
  };
  if (next.note || next.hint || next.passwordCheck) {
    map[wanted] = next;
  } else {
    delete map[wanted];
  }
  writeBackupMetaMap(memberId, map);
  return next;
}

function deleteTutaDriveBackupNote(memberId, fileName) {
  setTutaDriveBackupMeta(memberId, fileName, { note: '', hint: '', passwordCheck: null });
}

function pruneTutaDriveBackupNotes(memberId) {
  const map = readBackupMetaMap(memberId);
  const existing = new Set(listTutaDriveBackupFileNames(memberId));
  let changed = false;
  for (const fileName of Object.keys(map)) {
    if (!existing.has(fileName)) {
      delete map[fileName];
      changed = true;
    }
  }
  if (changed) writeBackupMetaMap(memberId, map);
}

function listTutaDriveBackupFileNames(memberId) {
  const root = tutaDriveMemberRoot(memberId);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).filter((name) => BACKUP_NAME_RE.test(name));
}

function todayBackupStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day}_${hh}-${mm}-${ss}`;
}

/** Next free EncryptedTutaNotesZip_<date>[_note][_N].zip in the member folder (never overwrites). */
export function tutaDriveBackupAbsPath(memberId, { dateStamp, note = '' } = {}) {
  const root = tutaDriveMemberRoot(memberId);
  const stamp = resolveTutaDriveBackupDateStamp(dateStamp);
  for (let suffix = 1; suffix < 1000; suffix += 1) {
    const abs = path.join(root, tutaDriveBackupFileName({ dateStamp: stamp, note, suffix }));
    if (!fs.existsSync(abs)) return abs;
  }
  throw new Error('Too many backups with the same date and note');
}

export const TUTADRIVE_BACKUP_MAX = 3;

/**
 * Delete EncryptedBackup_* / legacy backup_* files that exceed the max limit (oldest first).
 * Pass keepAbsPath to always preserve a just-written file even before it
 * appears in the sorted list.
 */
export function clearPreviousTutaDriveBackups(memberId, keepAbsPath = null, max = TUTADRIVE_BACKUP_MAX) {
  const root = tutaDriveMemberRoot(memberId);
  if (!fs.existsSync(root)) return [];
  const keep = keepAbsPath ? path.resolve(keepAbsPath) : null;
  const all = fs
    .readdirSync(root)
    .filter((name) => BACKUP_NAME_RE.test(name))
    .map((name) => ({ name, abs: path.join(root, name), mtime: fs.statSync(path.join(root, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime); // newest first

  // How many to keep: slots minus the one we just created (if keepAbsPath is the newest)
  const keepCount = Math.max(0, max - (keepAbsPath ? 1 : 0));
  const removed = [];
  let kept = 0;
  for (const entry of all) {
    if (keep && path.resolve(entry.abs) === keep) continue; // always keep the new file
    if (kept < keepCount) { kept += 1; continue; }
    fs.rmSync(entry.abs, { force: true });
    deleteTutaDriveBackupNote(memberId, entry.name);
    removed.push(entry.abs);
  }
  pruneTutaDriveBackupNotes(memberId);
  return removed;
}

/**
 * Delete a specific backup file by name (safe: EncryptedBackup_* or legacy backup_*).
 * Returns true when deleted, false when not found.
 */
export function deleteTutaDriveBackupByName(memberId, fileName) {
  if (!BACKUP_NAME_RE.test(String(fileName || ''))) return false;
  const abs = path.join(tutaDriveMemberRoot(memberId), String(fileName));
  if (!fs.existsSync(abs)) return false;
  fs.rmSync(abs, { force: true });
  deleteTutaDriveBackupNote(memberId, String(fileName));
  pruneTutaDriveBackupNotes(memberId);
  return true;
}

export function listTutaDriveBackups(memberId) {
  const root = tutaDriveMemberRoot(memberId);
  if (!fs.existsSync(root)) return [];
  const metaMap = readBackupMetaMap(memberId);
  return fs
    .readdirSync(root)
    .filter((name) => BACKUP_NAME_RE.test(name))
    .map((name) => {
      const abs = path.join(root, name);
      const st = fs.statSync(abs);
      return {
        fileName: name,
        absPath: abs,
        sizeBytes: st.size,
        mtimeMs: st.mtimeMs,
        note: metaMap[name]?.note || '',
        hint: metaMap[name]?.hint || '',
        passwordCheck: metaMap[name]?.passwordCheck || null
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function walkLocalFiles(dirPath, basePath = dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const entries = [];
  for (const name of fs.readdirSync(dirPath)) {
    const abs = path.join(dirPath, name);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      entries.push(...walkLocalFiles(abs, basePath));
    } else {
      entries.push(path.relative(basePath, abs).split(path.sep).join('/'));
    }
  }
  return entries;
}

function copyEntryRecursive(srcPath, destPath) {
  const stat = fs.statSync(srcPath);
  if (stat.isDirectory()) {
    fs.mkdirSync(destPath, { recursive: true });
    for (const name of fs.readdirSync(srcPath)) {
      copyEntryRecursive(path.join(srcPath, name), path.join(destPath, name));
    }
    return;
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(srcPath, destPath);
}

function removeDirRecursive(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  fs.rmSync(dirPath, { recursive: true, force: true });
}

/**
 * Drop the live TutaNotes vault so restore can copy into a clean tree.
 * Unlink photos/ first when it is a symlink (do not follow it and wipe sibling photos/).
 */
function wipeTutaDriveVaultForRestore(notesMount) {
  const vaultRoot = vaultRootOnMount(notesMount);
  const photosRoot = vaultPhotosRoot(notesMount);
  try {
    const st = fs.lstatSync(photosRoot);
    if (st.isSymbolicLink()) fs.unlinkSync(photosRoot);
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }
  removeDirRecursive(vaultRoot);
}

function resolveVaultRootFromExtractedDir(extractDir) {
  const namedRoot = path.join(extractDir, VAULT_DIR_NAME);
  if (fs.existsSync(path.join(namedRoot, VAULT_META_FILE))) {
    return namedRoot;
  }
  if (fs.existsSync(path.join(extractDir, VAULT_META_FILE))) {
    return extractDir;
  }
  throw new Error(`Backup zip must contain a ${VAULT_DIR_NAME} folder with ${VAULT_META_FILE}`);
}

async function resolveMemberNotesMount(singlesId) {
  const memberId = await loadMemberIdForSingles(singlesId);
  if (!memberId) throw new Error('Your member number is not set; cannot backup TutaDrive.');
  const layout = ensureTutaDriveMemberLayout(memberId, { singlesId });
  return { memberId, ...layout };
}

/**
 * Stream a plain zip of the member TutaNotes vault (for client Encrypt-Password sealing).
 */
export async function streamTutaDriveVaultBackupZip(singlesId, res) {
  const { memberId, notesMount } = await resolveMemberNotesMount(singlesId);
  const session = getVaultSession(singlesId, 'onedrive');
  if (session?.mountPath) {
    const expected = path.resolve(notesMount);
    const actual = path.resolve(String(session.mountPath));
    if (actual === expected) {
      flushDbToUsb(session);
    }
  }

  const vaultRoot = vaultRootOnMount(notesMount);
  if (!fs.existsSync(vaultRoot)) {
    throw new Error(`Missing ${VAULT_DIR_NAME} folder on TutaDrive`);
  }

  const zipName = `TutaNotes_TutaDrive_${todayBackupStamp()}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

  const archive = new ZipArchive({ zlib: { level: 6 } });
  await new Promise((resolve, reject) => {
    archive.on('error', reject);
    archive.on('end', resolve);
    archive.pipe(res);
    archive.directory(vaultRoot, VAULT_DIR_NAME);
    void archive.finalize();
  });

  return { fileName: zipName, memberId, notesMount };
}

/**
 * Store the client-sealed backup. Keeps up to TUTADRIVE_BACKUP_MAX zips.
 * The note (<20 chars) is appended to the file name; dateStamp (YYYY_MM_DD) is the browser's local date.
 * For per-backup-password zips (TNBAK3) the hint + password check come from the file header,
 * so a downloaded zip uploaded again keeps them.
 */
export function storeTutaDriveEncryptedBackup(memberId, encryptedBytes, { note = '', hint = '', dateStamp = '' } = {}) {
  const buf = Buffer.isBuffer(encryptedBytes) ? encryptedBytes : Buffer.from(encryptedBytes || []);
  if (!buf.length) throw new Error('Encrypted backup is empty');

  const header = readTutaDriveBackupPasswordHeader(buf);
  const shortNote = String(note || header?.note || '')
    .trim()
    .slice(0, TUTADRIVE_BACKUP_NOTE_MAX_LEN);
  ensureTutaDriveMemberLayout(memberId);
  const dest = tutaDriveBackupAbsPath(memberId, { dateStamp, note: shortNote });
  clearPreviousTutaDriveBackups(memberId, dest);
  fs.writeFileSync(dest, buf);
  const st = fs.statSync(dest);
  const fileName = path.basename(dest);
  const saved = setTutaDriveBackupMeta(memberId, fileName, {
    note: shortNote,
    hint: header ? header.hint : hint,
    passwordCheck: header?.passwordCheck || null
  });
  return {
    fileName,
    absPath: dest,
    sizeBytes: st.size,
    memberFolder: path.basename(tutaDriveMemberRoot(memberId)),
    relativePath: path.join(path.basename(tutaDriveMemberRoot(memberId)), fileName),
    note: saved.note,
    hint: saved.hint,
    passwordCheck: saved.passwordCheck
  };
}

/** Replace an existing backup zip in place (same file name, new sealed bytes). */
export function replaceTutaDriveEncryptedBackup(memberId, fileName, encryptedBytes, note = undefined) {
  const wanted = String(fileName || '').trim();
  if (!BACKUP_NAME_RE.test(wanted)) {
    throw new Error('Invalid backup file name');
  }
  const buf = Buffer.isBuffer(encryptedBytes) ? encryptedBytes : Buffer.from(encryptedBytes || []);
  if (!buf.length) throw new Error('Encrypted backup is empty');

  ensureTutaDriveMemberLayout(memberId);
  const dest = path.join(tutaDriveMemberRoot(memberId), wanted);
  if (!fs.existsSync(dest)) {
    throw new Error('Backup file not found');
  }
  fs.writeFileSync(dest, buf);
  const st = fs.statSync(dest);
  // New bytes → the old hint / password check no longer apply; take them from the new file (if any).
  const header = readTutaDriveBackupPasswordHeader(buf);
  const saved = setTutaDriveBackupMeta(memberId, wanted, {
    note: note === undefined ? header?.note || undefined : note,
    hint: header ? header.hint : '',
    passwordCheck: header?.passwordCheck || null
  });
  return {
    fileName: path.basename(dest),
    absPath: dest,
    sizeBytes: st.size,
    memberFolder: path.basename(tutaDriveMemberRoot(memberId)),
    relativePath: path.join(path.basename(tutaDriveMemberRoot(memberId)), path.basename(dest)),
    note: saved.note,
    hint: saved.hint,
    passwordCheck: saved.passwordCheck
  };
}

/** Read a sealed backup by file name, or the newest if fileName is omitted. */
export function readTutaDriveEncryptedBackup(memberId, fileName = null) {
  const list = listTutaDriveBackups(memberId);
  if (!list.length) return null;
  const wanted = String(fileName || '').trim();
  const current = wanted
    ? list.find((row) => String(row.fileName).toLowerCase() === wanted.toLowerCase())
    : list[0];
  if (!current) return null;
  const data = fs.readFileSync(current.absPath);
  return { ...current, data };
}

/**
 * Restore plain (already decrypted) zip into the member TutaNotes vault.
 * Closes cloud session first so files are not locked.
 */
export async function restoreTutaDriveVaultFromZipFile(singlesId, zipFilePath) {
  const { memberId, notesMount } = await resolveMemberNotesMount(singlesId);
  await logoffVaultUsb(singlesId, 'onedrive').catch(() => {});

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rv-tutadrive-restore-'));
  const extractDir = path.join(tmpRoot, 'extract');
  fs.mkdirSync(extractDir, { recursive: true });

  try {
    await fs
      .createReadStream(zipFilePath)
      .pipe(Extract({ path: extractDir }))
      .promise();

    const sourceRoot = resolveVaultRootFromExtractedDir(extractDir);
    const relFiles = walkLocalFiles(sourceRoot);
    if (!relFiles.length) {
      throw new Error('Backup zip is empty');
    }

    const vaultRoot = vaultRootOnMount(notesMount);
    wipeTutaDriveVaultForRestore(notesMount);
    fs.mkdirSync(vaultRoot, { recursive: true });
    for (const name of fs.readdirSync(sourceRoot)) {
      copyEntryRecursive(path.join(sourceRoot, name), path.join(vaultRoot, name));
    }

    let restoredBytes = 0;
    for (const rel of relFiles) {
      try {
        restoredBytes += fs.statSync(path.join(vaultRoot, rel)).size;
      } catch {
        // ignore
      }
    }

    ensureTutaDriveMemberLayout(memberId, { singlesId });

    return {
      restoredFiles: relFiles.length,
      restoredBytes,
      memberId,
      notesMount,
      requiresReunlock: true
    };
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}
