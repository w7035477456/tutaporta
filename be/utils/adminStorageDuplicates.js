/**
 * Admin Tools → Duplicate: find duplicate files under both storage roots' users/ folders
 *   FAST_STORAGE_FOLDER/users/M{id}/…        (tutadates/photos)
 *   LARGE_CHEAP_STORAGE_FOLDER/users/M{id}/… (notes/, photoalbums/)
 * and remove the copies nothing uses.
 *
 * Match: same byte size → same SHA-256 of the first 64 KB → same full SHA-256.
 *
 * Default demo content is left out of the scan entirely (every member gets the same demo notes
 * and demo photo album, so those copies are expected):
 *   - files whose SHA-256 equals a bundled sample file (be/assets/recordVaultNewMemberSample/media,
 *     the photo-album initializeSample folder incl. its .variants cache, manifest checksums);
 *   - note attachments whose DB row has shared_content_key (seeded demo attachment);
 *   - photo-album files for demo attachment ids 1–7 (isInitializeSampleRelativePath).
 *
 * "In use" (never deleted): a DB row points at the file —
 *   notes_* / photo_albums_* attachments, extra images, note images (live AND soft-deleted rows,
 *   so Trash restore keeps working), paid_record_attachment (bill receipts), photos (TutaDates).
 * Matching is deliberately loose (path suffix, `.enc` / `_1000px` / `_thumbnail` / `_thumb` /
 * `orig` / extension ignored): an uncertain file counts as in use.
 * Only files inside known media folders can be "unused"; anything else is reported but kept.
 * Owner must be known: a member folder with no singles row (or, for notes / albums, no vault row
 * in notes_member_vault / photo_albums_member_vault) in THIS database is kept — its data may be
 * indexed on another server (e.g. Ubuntu members copied to the Mac storage).
 * Dot-folders (.merge_staging, .chunked-uploads, …) and symlinks are never scanned.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import pool from '../db/connection.js';
import { storageRootFor } from './storageTree.js';
import {
  RECORD_VAULT_NEW_MEMBER_SAMPLE_ASSET_ROOT,
  listRecordVaultSampleAttachmentDefs
} from './recordVaultNewMemberSample/sampleManifest.js';
import { resolveInitializeSampleDir } from './photoAlbumsNewMemberSample/initializeSampleDir.js';
import { isInitializeSampleRelativePath } from './photoAlbumsNewMemberSample/initializeSampleMedia.js';

const S = 'outdateddbsnapshotoct2024';
const HEAD_BYTES = 64 * 1024;
const ROOT_KEYS = ['fast', 'large'];

/** Folders (relative to users/M{id}/) whose files may be removed when unused. */
const MEDIA_AREAS = [
  { prefix: 'tutadates/photos/', kind: 'TutaDates photo' },
  { prefix: 'notes/TutaNotes/files/', kind: 'Note attachment' },
  { prefix: 'notes/TutaNotes/photos/', kind: 'Note image' },
  { prefix: 'notes/bill_receipts/', kind: 'Bill receipt' },
  { prefix: 'photoalbums/TutaPhotoAlbums/files/', kind: 'Album file' },
  { prefix: 'photoalbums/TutaPhotoAlbums/photos/', kind: 'Album image' }
];

function formatBytes(n) {
  const v = Number(n) || 0;
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  if (v < 1024 * 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(2)} MB`;
  return `${(v / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function sha256File(file, limit = null) {
  const h = crypto.createHash('sha256');
  const fh = await fs.promises.open(file, 'r');
  try {
    const buf = Buffer.alloc(1024 * 1024);
    let read = 0;
    for (;;) {
      const want = limit == null ? buf.length : Math.min(buf.length, limit - read);
      if (want <= 0) break;
      const { bytesRead } = await fh.read(buf, 0, want, null);
      if (!bytesRead) break;
      h.update(buf.subarray(0, bytesRead));
      read += bytesRead;
    }
  } finally {
    await fh.close();
  }
  return h.digest('hex');
}

/** Regular files under dir (no symlinks, no dot-entries, no temp files). */
async function walk(dir, out) {
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name.includes('.tmp-')) continue;
    const abs = path.join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) await walk(abs, out);
    else if (e.isFile()) out.push(abs);
  }
}

/** Strip `.enc`, variant suffixes and extension → comparable stem ("11/99/265", "1/5/att_47_1"). */
function pathStem(rel) {
  let p = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
  p = p.replace(/\.enc$/i, '');
  p = p.replace(/\.[A-Za-z0-9]{1,8}$/, '');
  p = p.replace(/(_1000px|_thumbnail|_thumb|orig)$/i, '');
  return p.toLowerCase();
}

let demoHashCache = null;
async function demoHashes() {
  if (demoHashCache) return demoHashCache;
  const set = new Set();
  for (const att of listRecordVaultSampleAttachmentDefs()) {
    const sum = String(att.checksum || '').trim().toLowerCase();
    if (/^[a-f0-9]{64}$/.test(sum)) set.add(sum);
  }
  const dirs = [path.join(RECORD_VAULT_NEW_MEMBER_SAMPLE_ASSET_ROOT, 'media'), resolveInitializeSampleDir()];
  for (const dir of dirs) {
    const files = [];
    // .variants is a dot-folder: walk it explicitly.
    await walk(dir, files);
    await walk(path.join(dir, '.variants'), files);
    for (const f of files) {
      try {
        set.add(await sha256File(f));
      } catch {
        // unreadable sample file — skip
      }
    }
  }
  demoHashCache = set;
  return set;
}

async function tableHas(table, column) {
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
    [S, table, column]
  );
  return rows.length > 0;
}

/**
 * DB references keyed by member folder ("M485668"):
 *   stems: Set of pathStem(relative_path) — any live or soft-deleted row
 *   demoStems: Set of stems for seeded demo note attachments (shared_content_key)
 * plus photoBases: Set of TutaDates photo_file_name (lower-case) across all members.
 */
async function loadReferences() {
  const byMember = new Map();
  const ref = (member) => {
    if (!byMember.has(member)) byMember.set(member, { stems: new Set(), demoStems: new Set() });
    return byMember.get(member);
  };
  const { rows: members } = await pool.query(
    `SELECT singles_id, member_id FROM ${S}.singles WHERE member_id IS NOT NULL`
  );
  const memberOf = new Map(members.map((r) => [Number(r.singles_id), `M${String(r.member_id).trim().replace(/^m/i, '')}`]));
  const knownMembers = new Set(memberOf.values());
  const vaultMembers = { notes: new Set(), photoalbums: new Set() };
  for (const [key, table] of [['notes', 'notes_member_vault'], ['photoalbums', 'photo_albums_member_vault']]) {
    if (!(await tableHas(table, 'singles_id'))) continue;
    const { rows } = await pool.query(`SELECT DISTINCT singles_id FROM ${S}.${table}`);
    for (const r of rows) {
      const m = memberOf.get(Number(r.singles_id));
      if (m) vaultMembers[key].add(m);
    }
  }

  const sources = [
    ['notes_note_attachments', ['relative_path'], true],
    ['notes_note_extra_images', ['relative_path'], false],
    ['notes_notes', ['image_relative_path', 'image_top_relative_path', 'image_bottom_relative_path'], false],
    ['photo_albums_note_attachments', ['relative_path'], false],
    ['photo_albums_note_extra_images', ['relative_path'], false],
    ['photo_albums_notes', ['image_relative_path', 'image_top_relative_path', 'image_bottom_relative_path'], false],
    ['paid_record_attachment', ['relative_path'], false]
  ];
  for (const [table, cols, hasShared] of sources) {
    const present = [];
    for (const c of cols) if (await tableHas(table, c)) present.push(c);
    if (!present.length) continue;
    const shared = hasShared && (await tableHas(table, 'shared_content_key'));
    const { rows } = await pool.query(
      `SELECT singles_id, ${present.join(', ')}${shared ? ', shared_content_key' : ''} FROM ${S}.${table}`
    );
    for (const r of rows) {
      const member = memberOf.get(Number(r.singles_id));
      if (!member) continue;
      const m = ref(member);
      for (const c of present) {
        const stem = pathStem(r[c]);
        if (!stem) continue;
        m.stems.add(stem);
        if (shared && String(r.shared_content_key || '').trim()) m.demoStems.add(stem);
      }
    }
  }

  const photoBases = new Set();
  const { rows: photos } = await pool.query(`SELECT photo_file_name FROM ${S}.photos WHERE photo_file_name IS NOT NULL`);
  for (const p of photos) photoBases.add(String(p.photo_file_name).trim().toLowerCase());
  return { byMember, photoBases, knownMembers, vaultMembers };
}

/** True when some reference stem equals the file stem or is a "/"-bounded suffix of it. */
function stemReferenced(fileStem, stems) {
  if (stems.has(fileStem)) return true;
  const parts = fileStem.split('/');
  for (let i = 1; i < parts.length; i += 1) {
    if (stems.has(parts.slice(i).join('/'))) return true;
  }
  return false;
}

function classify(rootKey, root, abs, refs) {
  const usersRoot = path.join(root, 'users') + path.sep;
  const rel = abs.slice(usersRoot.length).split(path.sep).join('/');
  const [memberFolder, ...rest] = rel.split('/');
  const inner = rest.join('/');
  const area = MEDIA_AREAS.find((a) => inner.startsWith(a.prefix));
  const base = {
    rootKey,
    treePath: `users/${rel}`,
    fullPath: abs,
    member: memberFolder,
    kind: area?.kind || 'Other',
    demo: false,
    inUse: true,
    usedBy: ''
  };
  if (!area) return { ...base, usedBy: 'Not a media folder — always kept' };

  const memberRefs = refs.byMember.get(memberFolder) || { stems: new Set(), demoStems: new Set() };
  const stemInArea = pathStem(inner.slice(area.prefix.length));
  if (area.prefix.startsWith('photoalbums/') && isInitializeSampleRelativePath(`/${inner}`)) {
    return { ...base, demo: true };
  }
  if (stemReferenced(stemInArea, memberRefs.demoStems)) return { ...base, demo: true };

  // Unknown owner → we cannot prove the file is unused here: keep it.
  if (!refs.knownMembers.has(memberFolder)) {
    return { ...base, usedBy: `Owner ${memberFolder} not in this database — kept` };
  }
  const vaultKey = inner.startsWith('notes/TutaNotes/') ? 'notes' : inner.startsWith('photoalbums/') ? 'photoalbums' : null;
  if (vaultKey && !refs.vaultMembers[vaultKey].has(memberFolder)) {
    return { ...base, usedBy: `No ${vaultKey} vault index for ${memberFolder} in this database — kept` };
  }

  if (area.kind === 'TutaDates photo') {
    const photoBase = path.basename(stemInArea);
    const used = refs.photoBases.has(photoBase);
    return { ...base, inUse: used, usedBy: used ? `photos row ${photoBase}` : '' };
  }
  const fullStem = pathStem(inner);
  const used = stemReferenced(stemInArea, memberRefs.stems) || stemReferenced(fullStem, memberRefs.stems);
  return { ...base, inUse: used, usedBy: used ? `${area.kind} row (${memberFolder})` : '' };
}

/**
 * Scan both users/ folders.
 * @returns {{ roots, groups, summary }}  groups: [{ sha256, sizeBytes, sizeLabel, files[], removable[] }]
 */
export async function scanStorageDuplicates() {
  const roots = [];
  for (const key of ROOT_KEYS) {
    try {
      const { envVar, root } = storageRootFor(key);
      roots.push({ rootKey: key, envVar, root, usersDir: path.join(root, 'users') });
    } catch (err) {
      roots.push({ rootKey: key, error: err?.message || String(err) });
    }
  }

  const seenInodes = new Set();
  const bySize = new Map();
  let scanned = 0;
  for (const r of roots) {
    if (!r.usersDir || !fs.existsSync(r.usersDir)) continue;
    const files = [];
    await walk(r.usersDir, files);
    for (const abs of files) {
      let st;
      try {
        st = await fs.promises.lstat(abs);
      } catch {
        continue;
      }
      const ino = `${st.dev}:${st.ino}`;
      if (seenInodes.has(ino) || st.size <= 0) continue;
      seenInodes.add(ino);
      scanned += 1;
      if (!bySize.has(st.size)) bySize.set(st.size, []);
      bySize.get(st.size).push({ r, abs, size: st.size, mtimeMs: st.mtimeMs });
    }
  }

  const [demo, refs] = await Promise.all([demoHashes(), loadReferences()]);
  const groups = [];
  let demoSkipped = 0;
  for (const [size, list] of bySize) {
    if (list.length < 2) continue;
    const byHead = new Map();
    for (const f of list) {
      try {
        const k = await sha256File(f.abs, HEAD_BYTES);
        if (!byHead.has(k)) byHead.set(k, []);
        byHead.get(k).push(f);
      } catch {
        // vanished / unreadable
      }
    }
    for (const [headSum, headList] of byHead) {
      if (headList.length < 2) continue;
      const byFull = new Map();
      for (const f of headList) {
        try {
          const k = size <= HEAD_BYTES ? headSum : await sha256File(f.abs);
          if (!byFull.has(k)) byFull.set(k, []);
          byFull.get(k).push(f);
        } catch {
          // skip
        }
      }
      for (const [sha256, same] of byFull) {
        if (same.length < 2) continue;
        if (demo.has(sha256)) {
          demoSkipped += same.length;
          continue;
        }
        let files = same.map((f) => ({
          ...classify(f.r.rootKey, f.r.root, f.abs, refs),
          sizeBytes: size,
          modifiedAt: new Date(f.mtimeMs).toISOString()
        }));
        const demoFiles = files.filter((f) => f.demo);
        demoSkipped += demoFiles.length;
        files = files.filter((f) => !f.demo);
        if (files.length < 2) continue;
        files.sort((a, b) => Number(b.inUse) - Number(a.inUse) || a.modifiedAt.localeCompare(b.modifiedAt) || a.treePath.localeCompare(b.treePath));
        // Always keep one copy: the first in-use copy, else the oldest file.
        const keep = files[0];
        for (const f of files) {
          f.keep = f === keep;
          f.removable = !f.keep && !f.inUse;
        }
        groups.push({
          sha256,
          sizeBytes: size,
          sizeLabel: formatBytes(size),
          files,
          removableCount: files.filter((f) => f.removable).length
        });
      }
    }
  }
  groups.sort((a, b) => b.removableCount * b.sizeBytes - a.removableCount * a.sizeBytes || b.sizeBytes - a.sizeBytes);
  const removableBytes = groups.reduce((s, g) => s + g.removableCount * g.sizeBytes, 0);
  return {
    roots: roots.map(({ rootKey, envVar, usersDir, error }) => ({ rootKey, envVar, usersDir, error })),
    groups,
    summary: {
      scannedFiles: scanned,
      groupCount: groups.length,
      copyCount: groups.reduce((s, g) => s + g.files.length, 0),
      removableCount: groups.reduce((s, g) => s + g.removableCount, 0),
      removableBytes,
      removableLabel: formatBytes(removableBytes),
      demoFilesSkipped: demoSkipped
    }
  };
}

/**
 * Delete the unused copies of the given groups (null = every group). Each file is re-hashed right
 * before it is deleted, and a fresh scan decides what is unused — the client only names groups.
 */
export async function removeUnusedStorageDuplicates(sha256List = null) {
  const wanted = Array.isArray(sha256List)
    ? new Set(sha256List.map((s) => String(s).trim().toLowerCase()).filter((s) => /^[a-f0-9]{64}$/.test(s)))
    : null;
  const before = await scanStorageDuplicates();
  const deleted = [];
  const failed = [];
  for (const g of before.groups) {
    if (wanted && !wanted.has(g.sha256)) continue;
    const kept = g.files.filter((f) => !f.removable);
    if (!kept.length) continue; // never delete every copy
    for (const f of g.files.filter((x) => x.removable)) {
      try {
        if ((await sha256File(f.fullPath)) !== g.sha256) {
          failed.push({ treePath: f.treePath, rootKey: f.rootKey, error: 'File changed since scan — skipped' });
          continue;
        }
        await fs.promises.unlink(f.fullPath);
        deleted.push({ rootKey: f.rootKey, treePath: f.treePath, sizeBytes: f.sizeBytes });
        console.log(`[admin-duplicates] removed unused copy ${f.rootKey}:${f.treePath} (sha256 ${g.sha256.slice(0, 12)}…)`);
      } catch (err) {
        failed.push({ treePath: f.treePath, rootKey: f.rootKey, error: err?.message || String(err) });
      }
    }
  }
  const after = await scanStorageDuplicates();
  const freed = deleted.reduce((s, d) => s + d.sizeBytes, 0);
  return { ...after, removed: { count: deleted.length, bytes: freed, label: formatBytes(freed), files: deleted, failed } };
}
