/**
 * Factory Reset disk cleanup: remove one member's mobile uploads from every
 * storage root those uploads can land in.
 *
 * Member trees (users/M{id}) and singles-id staging dirs are removed entirely.
 * Shared flat folders only lose files named for this member.
 * Installer drop folders (USB_DMG_EXE / USB_IMG_EXE) are left alone.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getMobileUploadFolder } from './mobileUploadFolder.js';

function memberFolderName(memberId) {
  const id = String(memberId ?? '').trim();
  if (!id) return '';
  return id.startsWith('M') || id.startsWith('m') ? `M${id.slice(1)}` : `M${id}`;
}

const LOG_PREFIX = '[factoryResetStorage]';

function expandEnvPath(raw) {
  const trimmed = String(raw || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (trimmed === '~') return path.resolve(os.homedir());
  if (trimmed.startsWith('~/')) return path.resolve(os.homedir(), trimmed.slice(2));
  return path.resolve(trimmed);
}

function safeSegment(raw) {
  const segment = String(raw ?? '').trim();
  if (!segment || segment === '.' || segment === '..') return '';
  if (segment.includes('/') || segment.includes('\\') || segment.includes('\0')) return '';
  return segment;
}

/**
 * Remove root/parts… only when the resolved path stays strictly inside root.
 * @returns {{ removed: boolean, path?: string, reason?: string }}
 */
function removeInsideRoot(rootRaw, parts) {
  const root = expandEnvPath(rootRaw);
  if (!root) return { removed: false, reason: 'root unset' };
  const segments = [];
  for (const part of parts) {
    const segment = safeSegment(part);
    if (!segment) return { removed: false, reason: 'unsafe path' };
    segments.push(segment);
  }
  if (!segments.length) return { removed: false, reason: 'unsafe path' };

  const rootResolved = path.resolve(root);
  const target = path.resolve(rootResolved, ...segments);
  if (target === rootResolved || !target.startsWith(`${rootResolved}${path.sep}`)) {
    return { removed: false, reason: 'escapes root', path: target };
  }
  if (!fs.existsSync(target)) return { removed: false, reason: 'missing', path: target };

  const st = fs.lstatSync(target);
  if (st.isSymbolicLink()) {
    fs.unlinkSync(target);
    return { removed: true, path: target };
  }
  fs.rmSync(target, { recursive: true, force: true });
  return { removed: true, path: target };
}

function unlinkPrefixedFiles(folderRaw, prefixes) {
  const dir = expandEnvPath(folderRaw);
  const removed = [];
  if (!dir || !prefixes.length || !fs.existsSync(dir)) return removed;
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return removed;
  }
  const dirResolved = path.resolve(dir);
  for (const name of names) {
    if (!prefixes.some((prefix) => name.startsWith(prefix))) continue;
    const abs = path.resolve(dirResolved, name);
    if (abs === dirResolved || !abs.startsWith(`${dirResolved}${path.sep}`)) continue;
    try {
      const st = fs.lstatSync(abs);
      if (!st.isFile()) continue;
      fs.unlinkSync(abs);
      removed.push(abs);
    } catch {
      // skip unreadable
    }
  }
  return removed;
}

function singlesPrefix(singlesId) {
  return `${singlesId}_`;
}

async function deleteMobileUploadStagingFiles(singlesId) {
  const removed = [];
  const folders = new Set();
  try {
    folders.add(path.resolve(getMobileUploadFolder()));
  } catch {
    // UPLOAD_FOLDER unset
  }
  for (const key of ['UPLOAD_FOLDER', 'GP_USB_FOLDER']) {
    const expanded = expandEnvPath(process.env[key]);
    if (expanded) folders.add(expanded);
  }
  const fast = expandEnvPath(process.env.FAST_STORAGE_FOLDER);
  if (fast) folders.add(path.resolve(fast, 'mobile_upload'));

  const prefix = singlesPrefix(singlesId);
  for (const folder of folders) {
    if (!fs.existsSync(folder)) continue;
    let names;
    try {
      names = fs.readdirSync(folder);
    } catch {
      continue;
    }
    const folderResolved = path.resolve(folder);
    for (const name of names) {
      if (!name.startsWith(prefix)) continue;
      const abs = path.resolve(folderResolved, name);
      if (abs === folderResolved || !abs.startsWith(`${folderResolved}${path.sep}`)) continue;
      try {
        const st = fs.lstatSync(abs);
        if (!st.isFile()) continue;
        fs.unlinkSync(abs);
        removed.push(abs);
      } catch {
        // skip
      }
    }
  }
  return removed;
}

/**
 * @param {{ singlesId: number, memberId?: string | number | null }} args
 */
export async function deleteMemberMobileUploadsOnFactoryReset({ singlesId, memberId = null } = {}) {
  const id = Math.trunc(Number(singlesId));
  if (!Number.isFinite(id) || id < 1) {
    throw new Error('Valid singles_id is required.');
  }

  const summary = {
    mobileUploadFilesRemoved: [],
    directoriesRemoved: [],
    legacyFilesRemoved: [],
    skipped: []
  };

  const noteRemovedDir = (label, result) => {
    if (result?.removed && result.path) {
      summary.directoriesRemoved.push({ label, path: result.path });
      return;
    }
    if (result?.reason && result.reason !== 'missing' && result.reason !== 'root unset') {
      summary.skipped.push({ label, reason: result.reason, path: result.path || null });
    }
  };

  try {
    summary.mobileUploadFilesRemoved = await deleteMobileUploadStagingFiles(id);
  } catch (err) {
    summary.skipped.push({ label: 'mobile-upload', reason: err?.message || String(err) });
  }

  const singlesKey = String(id);
  noteRemovedDir(
    'photoalbums-onedrive-staging',
    removeInsideRoot(process.env.RECORD_PHOTOALBUMS_ONEDRIVE_STAGING_ROOT, [singlesKey])
  );
  noteRemovedDir(
    'notes-onedrive-staging',
    removeInsideRoot(process.env.RECORD_NOTES_ONEDRIVE_STAGING_ROOT, [singlesKey])
  );
  noteRemovedDir(
    'recordvault-onedrive-tmpdir',
    removeInsideRoot(path.join(os.tmpdir(), 'recordvault-onedrive'), [singlesKey])
  );
  noteRemovedDir('record-notes-folder', removeInsideRoot(process.env.RECORD_NOTES_FOLDER, [singlesKey]));

  let folderName = '';
  const memberPart = memberId == null ? '' : String(memberId).trim();
  if (memberPart) {
    try {
      folderName = memberFolderName(memberPart);
    } catch {
      folderName = '';
    }
    if (!/^M\d+$/i.test(folderName)) folderName = '';
  }
  // New uploads use users/M{member_id}. When member_id is unset, layout falls back to singles_id.
  if (!folderName) folderName = `M${id}`;

  noteRemovedDir(
    'fast-storage-member',
    removeInsideRoot(process.env.FAST_STORAGE_FOLDER, ['users', folderName])
  );
  noteRemovedDir(
    'large-cheap-member',
    removeInsideRoot(process.env.LARGE_CHEAP_STORAGE_FOLDER, ['users', folderName])
  );

  const idForPrefix = memberPart ? memberPart.replace(/^M/i, '') : String(id);
  const uniquePrefixes = [...new Set([`${idForPrefix}_`, singlesPrefix(id)].filter(Boolean))];
  const legacyFolders = [process.env.TUTADATES_PHOTO_FOLDER, process.env.TUTADATES_VIDEO_FOLDER];
  const fast = expandEnvPath(process.env.FAST_STORAGE_FOLDER);
  if (fast) {
    legacyFolders.push(path.join(fast, 'photos'), path.join(fast, 'videos'));
  }
  for (const folder of legacyFolders) {
    for (const filePath of unlinkPrefixedFiles(folder, uniquePrefixes)) {
      summary.legacyFilesRemoved.push(filePath);
    }
  }

  console.log(LOG_PREFIX, 'member storage cleanup', {
    singlesId: id,
    memberFolder: folderName || null,
    mobileUploadFiles: summary.mobileUploadFilesRemoved.length,
    directories: summary.directoriesRemoved.map((row) => row.path),
    legacyFiles: summary.legacyFilesRemoved.length,
    skipped: summary.skipped
  });

  return summary;
}
