import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  loadMemberIdForSingles,
  tutaDriveNotesMountPath,
  ensureTutaDriveMemberLayout
} from './tutaDriveMemberPaths.js';
import { ensurePathWritableOrThrow } from './appStorageFolderPerms.js';

const BILL_RECEIPTS_DIR = 'bill_receipts';

function sanitizeFileName(raw) {
  const base = path.basename(String(raw || 'file').trim() || 'file');
  const cleaned = base.replace(/[^\w.\-()+ ]+/g, '_').replace(/\s+/g, '_').slice(0, 180);
  return cleaned || 'file';
}

function uniqueStoredName(originalFileName) {
  const safe = sanitizeFileName(originalFileName);
  const ext = path.extname(safe);
  const stem = path.basename(safe, ext).slice(0, 80) || 'file';
  const stamp = `${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  return `${stem}_${stamp}${ext}`;
}

/**
 * Resolve member notes mount for singles_id and ensure layout exists.
 * @returns {{ memberId: string, notesMount: string }}
 */
export async function resolvePaidRecordNotesMount(singlesId) {
  const memberId = await loadMemberIdForSingles(singlesId);
  if (!memberId) {
    throw new Error('member_id not found for this account');
  }
  ensureTutaDriveMemberLayout(memberId, { singlesId });
  const notesMount = tutaDriveNotesMountPath(memberId);
  ensurePathWritableOrThrow(notesMount, {
    route: 'paidRecordStorage:notes',
    singlesId
  });
  return { memberId, notesMount };
}

/** Absolute dir: …/notes/bill_receipts/{paid_record_id}/ */
export function billReceiptsDirAbs(notesMount, paidRecordId) {
  return path.join(notesMount, BILL_RECEIPTS_DIR, String(paidRecordId));
}

/** Relative to notes mount: bill_receipts/{paid_record_id}/{stored_file_name} */
export function billReceiptRelativePath(paidRecordId, storedFileName) {
  return path.join(BILL_RECEIPTS_DIR, String(paidRecordId), storedFileName).split(path.sep).join('/');
}

export async function ensureBillReceiptsDir(singlesId, paidRecordId) {
  const { memberId, notesMount } = await resolvePaidRecordNotesMount(singlesId);
  const absDir = billReceiptsDirAbs(notesMount, paidRecordId);
  fs.mkdirSync(absDir, { recursive: true });
  ensurePathWritableOrThrow(absDir, {
    route: 'paidRecordStorage:bill_receipts',
    singlesId
  });
  return { memberId, notesMount, absDir };
}

/**
 * Write attachment bytes under bill_receipts/{paid_record_id}/.
 * @returns {{ storedFileName, relativePath, absPath, byteSize }}
 */
export async function writePaidRecordAttachmentFile(singlesId, paidRecordId, { buffer, originalFileName }) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    throw new Error('Empty file');
  }
  const { notesMount, absDir } = await ensureBillReceiptsDir(singlesId, paidRecordId);
  const storedFileName = uniqueStoredName(originalFileName);
  const absPath = path.join(absDir, storedFileName);
  fs.writeFileSync(absPath, buffer);
  const relativePath = billReceiptRelativePath(paidRecordId, storedFileName);
  return {
    storedFileName,
    relativePath,
    absPath,
    byteSize: buffer.length,
    notesMount
  };
}

export async function resolvePaidRecordAttachmentAbsPath(singlesId, relativePath) {
  const rel = String(relativePath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  if (!rel || rel.includes('..') || !rel.startsWith(`${BILL_RECEIPTS_DIR}/`)) {
    throw new Error('Invalid attachment path');
  }
  const { notesMount } = await resolvePaidRecordNotesMount(singlesId);
  const absPath = path.resolve(notesMount, rel);
  const notesResolved = path.resolve(notesMount);
  if (!absPath.startsWith(notesResolved + path.sep) && absPath !== notesResolved) {
    throw new Error('Invalid attachment path');
  }
  return absPath;
}

export async function readPaidRecordAttachmentFile(singlesId, relativePath) {
  const absPath = await resolvePaidRecordAttachmentAbsPath(singlesId, relativePath);
  if (!fs.existsSync(absPath)) {
    const err = new Error('Attachment file missing on disk');
    err.statusCode = 404;
    throw err;
  }
  return { absPath, buffer: fs.readFileSync(absPath) };
}

export async function deletePaidRecordAttachmentFile(singlesId, relativePath) {
  try {
    const absPath = await resolvePaidRecordAttachmentAbsPath(singlesId, relativePath);
    if (fs.existsSync(absPath)) {
      fs.unlinkSync(absPath);
    }
  } catch (err) {
    if (err?.statusCode === 404) return;
    // ignore missing / invalid for delete best-effort
    if (!/Invalid attachment path/i.test(String(err?.message || ''))) {
      console.warn('[paidRecordStorage] delete file:', err?.message || err);
    }
  }
}
