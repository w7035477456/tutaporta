import fs from 'fs';
import path from 'path';

/** Stop adding folders after this many so a huge tree can't stall the request. */
const MAX_TREE_FOLDERS = 20000;

/** Admin Tools → Tree tab: `large` = LARGE_CHEAP_STORAGE_FOLDER (left), `fast` = FAST_STORAGE_FOLDER (right). */
const STORAGE_ROOT_ENV = {
  large: 'LARGE_CHEAP_STORAGE_FOLDER',
  fast: 'FAST_STORAGE_FOLDER'
};

const KIND_BY_EXT = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif', 'heic', 'heif', 'svg', 'ico'],
  video: ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', 'ogv'],
  audio: ['mp3', 'm4a', 'wav', 'ogg', 'aac', 'flac'],
  pdf: ['pdf'],
  text: ['txt', 'log', 'json', 'md', 'csv', 'tsv', 'xml', 'yml', 'yaml', 'ini', 'conf', 'sql', 'sh', 'js', 'mjs', 'ts', 'jsx', 'css', 'html', 'htm', 'env']
};

const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  ogv: 'video/ogg',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
  flac: 'audio/flac',
  pdf: 'application/pdf'
};

export function formatTreeBytes(bytes) {
  const units = ['B', 'K', 'M', 'G', 'T'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return unit === 0 ? `${value}B` : `${value.toFixed(1)}${units[unit]}`;
}

function byteOrder(a, b) {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

function fileExt(name) {
  const ext = path.extname(String(name || '')).slice(1).toLowerCase();
  return ext;
}

export function storageFileKind(name) {
  const ext = fileExt(name);
  for (const [kind, exts] of Object.entries(KIND_BY_EXT)) {
    if (exts.includes(ext)) return kind;
  }
  return 'other';
}

/**
 * Content type for serving a storage file to the admin. Text and unknown files (including html/js)
 * are sent as text/plain or octet-stream so nothing renders as a page on our origin.
 */
export function storageFileContentType(name) {
  const ext = fileExt(name);
  if (MIME_BY_EXT[ext]) return MIME_BY_EXT[ext];
  if (KIND_BY_EXT.text.includes(ext)) return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

function storageRootFor(rootKey) {
  const envVar = STORAGE_ROOT_ENV[rootKey];
  if (!envVar) {
    const err = new Error('Unknown storage root');
    err.statusCode = 400;
    throw err;
  }
  const raw = String(process.env[envVar] || '').trim();
  if (!raw) {
    const err = new Error(`${envVar} is not set`);
    err.statusCode = 404;
    throw err;
  }
  return { envVar, root: path.resolve(raw) };
}

function isInside(root, target) {
  return target === root || target.startsWith(root + path.sep);
}

/**
 * Resolve `relPath` under the chosen storage root, refusing `..` and symlinks that escape it.
 * @returns {Promise<{ root: string, fullPath: string, stat: fs.Stats }>}
 */
export async function resolveStoragePath(rootKey, relPath) {
  const { root } = storageRootFor(rootKey);
  const fullPath = path.resolve(root, String(relPath || '').replace(/^\/+/, ''));
  const notFound = () => {
    const err = new Error('Not found');
    err.statusCode = 404;
    return err;
  };
  if (!isInside(root, fullPath)) throw notFound();
  let realRoot;
  let realFull;
  try {
    [realRoot, realFull] = await Promise.all([fs.promises.realpath(root), fs.promises.realpath(fullPath)]);
  } catch {
    throw notFound();
  }
  if (!isInside(realRoot, realFull)) throw notFound();
  return { root, fullPath: realFull, stat: await fs.promises.stat(realFull) };
}

/**
 * Folder tree (folders only, with per-folder file count) for one storage root.
 * Node: { name, path, fileCount, children }. `path` is relative to the root ('' for the root).
 */
async function buildTree(rootKey) {
  const envVar = STORAGE_ROOT_ENV[rootKey];
  let root;
  try {
    ({ root } = storageRootFor(rootKey));
    if (!(await fs.promises.stat(root)).isDirectory()) throw new Error('not a directory');
  } catch (err) {
    return { rootKey, envVar, root: root || null, tree: null, totalBytes: 0, truncated: false, error: err?.message || String(err) };
  }

  let totalBytes = 0;
  let folders = 0;
  let truncated = false;

  async function walk(dir, rel, name) {
    const node = { name, path: rel, fileCount: 0, children: [] };
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return node;
    }
    const files = entries.filter((e) => e.isFile());
    node.fileCount = files.length;
    const sizes = await Promise.all(
      files.map((e) =>
        fs.promises
          .stat(path.join(dir, e.name))
          .then((s) => s.size)
          .catch(() => 0)
      )
    );
    for (const size of sizes) totalBytes += size;

    const subdirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort(byteOrder);
    for (const sub of subdirs) {
      if (folders >= MAX_TREE_FOLDERS) {
        truncated = true;
        break;
      }
      folders += 1;
      node.children.push(await walk(path.join(dir, sub), rel ? `${rel}/${sub}` : sub, sub));
    }
    return node;
  }

  const tree = await walk(root, '', path.basename(root));
  return { rootKey, envVar, root, tree, totalBytes, totalLabel: formatTreeBytes(totalBytes), truncated, maxFolders: MAX_TREE_FOLDERS };
}

export async function buildStorageTrees() {
  const [largeCheap, fast] = await Promise.all([buildTree('large'), buildTree('fast')]);
  return { largeCheap, fast };
}

/** Files (not folders) directly inside one storage folder, with size and preview kind. */
export async function listStorageFolderFiles(rootKey, relPath) {
  const { fullPath, stat } = await resolveStoragePath(rootKey, relPath);
  if (!stat.isDirectory()) {
    const err = new Error('Not a folder');
    err.statusCode = 400;
    throw err;
  }
  const entries = await fs.promises.readdir(fullPath, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((e) => e.isFile())
      .map(async (e) => {
        const s = await fs.promises.stat(path.join(fullPath, e.name)).catch(() => null);
        const size = s?.size ?? 0;
        return {
          name: e.name,
          size,
          sizeLabel: formatTreeBytes(size),
          modified: s ? s.mtime.toISOString() : null,
          kind: storageFileKind(e.name)
        };
      })
  );
  files.sort((a, b) => byteOrder(a.name, b.name));
  return { files };
}
