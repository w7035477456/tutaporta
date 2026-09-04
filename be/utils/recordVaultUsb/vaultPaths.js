import fs from 'fs';
import path from 'path';
import { isVaultPhotoAndDbEncryptionEnabled } from './vaultCrypto.js';
import { vaultMetaUsesPlaintextStorage } from '../recordVaultIconEncryption.js';

//export const VAULT_DIR_NAME = '.recordvault';
export const VAULT_DIR_NAME = 'TutaNotes';
/** Older USB folder name — still opened if present; new formats use VAULT_DIR_NAME. */
export const LEGACY_VAULT_DIR_NAMES = ['OMNotes'];
export const VAULT_META_FILE = 'vault.meta.json';
export const VAULT_DB_FILE_ENCRYPTED = 'vault.db.enc';
export const VAULT_DB_FILE_PLAIN = 'vault.db';
export const VAULT_PHOTOS_DIR = 'photos';
export const VAULT_FILES_DIR = 'files';

/** @deprecated Use getVaultDbFileName() — kept for imports that expect a string symbol. */
export const VAULT_DB_FILE = VAULT_DB_FILE_ENCRYPTED;

function readVaultMetaFromMount(mountPath) {
  try {
    const metaPath = vaultMetaPath(mountPath);
    if (!fs.existsSync(metaPath)) return null;
    return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch {
    return null;
  }
}

/** Plain filenames when vault meta is v3/none or NOTES_ENCRYPT_PHOTO_AND_DB=false. */
export function useEncryptedVaultFilenames(meta = null) {
  if (meta && vaultMetaUsesPlaintextStorage(meta)) return false;
  return isVaultPhotoAndDbEncryptionEnabled();
}

export function getVaultDbFileName(meta = null) {
  return useEncryptedVaultFilenames(meta) ? VAULT_DB_FILE_ENCRYPTED : VAULT_DB_FILE_PLAIN;
}

export function listVaultDbFileNames() {
  return [VAULT_DB_FILE_ENCRYPTED, VAULT_DB_FILE_PLAIN];
}

/** Download order — prefer vault.meta.json naming (plain vs .enc) over legacy default. */
export function listVaultDbFileNamesForRead(meta = null) {
  const preferred = getVaultDbFileName(meta);
  const alternate =
    preferred === VAULT_DB_FILE_PLAIN ? VAULT_DB_FILE_ENCRYPTED : VAULT_DB_FILE_PLAIN;
  return [preferred, alternate];
}

export function isSqliteVaultDbBuffer(buf) {
  return Buffer.isBuffer(buf) && buf.length >= 16 && buf.slice(0, 15).toString('utf8') === 'SQLite format 3';
}

/** Header-only SQLite check — avoids reading multi‑MB vault.db into memory. */
export function isSqliteVaultDbFile(absPath) {
  let fd;
  try {
    fd = fs.openSync(absPath, 'r');
    const buf = Buffer.alloc(16);
    const n = fs.readSync(fd, buf, 0, 16, 0);
    return isSqliteVaultDbBuffer(n >= 16 ? buf : buf.subarray(0, n));
  } catch {
    return false;
  } finally {
    if (fd != null) {
      try {
        fs.closeSync(fd);
      } catch {
        // ignore
      }
    }
  }
}

export function isVaultDbRelativePath(relativePath) {
  const base = path.basename(String(relativePath || ''));
  return base === VAULT_DB_FILE_PLAIN || base === VAULT_DB_FILE_ENCRYPTED;
}

/** Atomic write — temp file + rename + fsync. */
export function atomicWriteFileSync(absPath, buffer) {
  const dir = path.dirname(absPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${absPath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, buffer);
  try {
    fs.fsyncSync(fs.openSync(tmpPath, 'r'));
  } catch {
    // fsync best-effort (some FS ignore)
  }
  fs.renameSync(tmpPath, absPath);
  try {
    fs.fsyncSync(fs.openSync(dir, 'r'));
  } catch {
    // ignore
  }
}

export function vaultRootOnMount(mountPath) {
  const base = String(mountPath || '').replace(/\/+$/, '');
  const preferred = path.join(base, VAULT_DIR_NAME);
  try {
    if (fs.existsSync(preferred)) return preferred;
  } catch {
    // fall through
  }
  for (const legacy of LEGACY_VAULT_DIR_NAMES) {
    const legacyRoot = path.join(base, legacy);
    try {
      if (fs.existsSync(legacyRoot)) return legacyRoot;
    } catch {
      // try next
    }
  }
  return preferred;
}

export function vaultMetaPath(mountPath) {
  return path.join(vaultRootOnMount(mountPath), VAULT_META_FILE);
}

export function vaultDbPath(mountPath, meta = null) {
  const resolvedMeta = meta ?? readVaultMetaFromMount(mountPath);
  return path.join(vaultRootOnMount(mountPath), getVaultDbFileName(resolvedMeta));
}

/** Alias — vault DB path (encrypted or plain filename per env). */
export function vaultDbEncPath(mountPath) {
  return vaultDbPath(mountPath);
}

export function resolveVaultDbPath(mountPath) {
  const root = vaultRootOnMount(mountPath);
  const plain = path.join(root, VAULT_DB_FILE_PLAIN);
  const enc = path.join(root, VAULT_DB_FILE_ENCRYPTED);
  if (fs.existsSync(plain)) return plain;
  if (fs.existsSync(enc)) return enc;
  return vaultDbPath(mountPath);
}

export function vaultHasDbFile(mountPath) {
  const root = vaultRootOnMount(mountPath);
  return listVaultDbFileNames().some((name) => fs.existsSync(path.join(root, name)));
}

export function vaultPhotosRoot(mountPath) {
  return path.join(vaultRootOnMount(mountPath), VAULT_PHOTOS_DIR);
}

export function vaultFilesRoot(mountPath) {
  return path.join(vaultRootOnMount(mountPath), VAULT_FILES_DIR);
}

export function vaultPhotoStorageRelativePath(relativePath, meta = null) {
  const rel = String(relativePath || '').replace(/^\/+/, '');
  return useEncryptedVaultFilenames(meta) ? `${rel}.enc` : rel;
}

export function vaultFileStorageRelativePath(relativePath, meta = null) {
  const rel = String(relativePath || '').replace(/^\/+/, '');
  return useEncryptedVaultFilenames(meta) ? `${rel}.enc` : rel;
}

export function vaultPhotoStoragePath(mountPath, relativePath, meta = null) {
  const resolvedMeta = meta ?? readVaultMetaFromMount(mountPath);
  return path.join(vaultPhotosRoot(mountPath), vaultPhotoStorageRelativePath(relativePath, resolvedMeta));
}

export function vaultFileStoragePath(mountPath, relativePath, meta = null) {
  const resolvedMeta = meta ?? readVaultMetaFromMount(mountPath);
  return path.join(vaultFilesRoot(mountPath), vaultFileStorageRelativePath(relativePath, resolvedMeta));
}

/** Read path — prefers current env naming, falls back to legacy .enc (or plain) on disk. */
export function resolveVaultPhotoStoragePath(mountPath, relativePath) {
  const rel = String(relativePath || '').replace(/^\/+/, '');
  const plain = path.join(vaultPhotosRoot(mountPath), rel);
  const enc = path.join(vaultPhotosRoot(mountPath), `${rel}.enc`);
  if (fs.existsSync(plain)) return plain;
  if (fs.existsSync(enc)) return enc;
  return vaultPhotoStoragePath(mountPath, rel);
}

export function resolveVaultFileStoragePath(mountPath, relativePath) {
  const rel = String(relativePath || '').replace(/^\/+/, '');
  const plain = path.join(vaultFilesRoot(mountPath), rel);
  const enc = path.join(vaultFilesRoot(mountPath), `${rel}.enc`);
  if (fs.existsSync(plain)) return plain;
  if (fs.existsSync(enc)) return enc;
  return vaultFileStoragePath(mountPath, rel);
}

/** @deprecated Use vaultPhotoStoragePath */
export function encryptedPhotoPath(mountPath, relativePath) {
  return vaultPhotoStoragePath(mountPath, relativePath);
}

/** @deprecated Use vaultFileStoragePath */
export function encryptedFilePath(mountPath, relativePath) {
  return vaultFileStoragePath(mountPath, relativePath);
}

/** Relative path inside photos/: {notebookId}/{noteId}[_top|_bottom] */
export function photoRelativePath(notebookId, noteId, slot = 'center', ext = 'jpg') {
  const cleanExt = String(ext || 'jpg').replace(/^\./, '').toLowerCase();
  const suffix = slot === 'top' ? '_top' : slot === 'bottom' ? '_bottom' : '';
  return `${notebookId}/${noteId}${suffix}.${cleanExt}`;
}

/** Relative path for additional inline photos beyond the three fixed slots. */
export function extraPhotoRelativePath(notebookId, noteId, imageId, ext = 'jpg') {
  const cleanExt = String(ext || 'jpg').replace(/^\./, '').toLowerCase();
  return `${notebookId}/${noteId}_e${imageId}.${cleanExt}`;
}

/** Relative path inside files/: {notebookId}/{noteId}/att_{attachmentId}.{ext} */
export function fileRelativePath(notebookId, noteId, attachmentId, ext = 'bin') {
  const cleanExt = String(ext || 'bin').replace(/^\./, '').toLowerCase();
  return `${notebookId}/${noteId}/att_${attachmentId}.${cleanExt}`;
}

/** Minimal TutaNotes vault layout: meta + photos/ + files/ (db checked separately). */
export const REQUIRED_VAULT_PATHS = [VAULT_META_FILE, VAULT_PHOTOS_DIR, VAULT_FILES_DIR];

/** Create standard empty vault subfolders (photos, files) if missing — cloud sync may omit empty dirs. */
export function ensureVaultLayoutDirs(mountPath) {
  const photosRoot = vaultPhotosRoot(mountPath);
  try {
    const st = fs.lstatSync(photosRoot);
    // Broken symlink (e.g. FAST_STORAGE_FOLDER relocated) makes mkdirSync throw ENOENT.
    if (st.isSymbolicLink()) {
      if (!fs.existsSync(photosRoot)) {
        fs.unlinkSync(photosRoot);
      }
      // Valid symlink already satisfies photos/; mkdir would throw EEXIST.
    } else if (!st.isDirectory()) {
      fs.rmSync(photosRoot, { force: true });
    }
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }
  if (!fs.existsSync(photosRoot)) {
    fs.mkdirSync(photosRoot, { recursive: true });
  }
  fs.mkdirSync(vaultFilesRoot(mountPath), { recursive: true });
}

/** Rename legacy *.enc filenames on staging when vault uses plain filenames. */
export function normalizeVaultStagingFilenames(mountPath) {
  const meta = readVaultMetaFromMount(mountPath);
  if (useEncryptedVaultFilenames(meta)) return;

  const root = vaultRootOnMount(mountPath);
  const encDb = path.join(root, VAULT_DB_FILE_ENCRYPTED);
  const plainDb = path.join(root, VAULT_DB_FILE_PLAIN);
  if (fs.existsSync(encDb) && !fs.existsSync(plainDb)) {
    fs.renameSync(encDb, plainDb);
  }

  const renameEncFilesInTree = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      if (fs.statSync(abs).isDirectory()) {
        renameEncFilesInTree(abs);
        continue;
      }
      if (!name.endsWith('.enc')) continue;
      const dest = path.join(dir, name.slice(0, -4));
      if (!fs.existsSync(dest)) fs.renameSync(abs, dest);
    }
  };

  renameEncFilesInTree(vaultPhotosRoot(mountPath));
  renameEncFilesInTree(vaultFilesRoot(mountPath));
}
