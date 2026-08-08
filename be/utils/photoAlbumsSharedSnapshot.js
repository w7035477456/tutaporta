import fs from 'fs';
import path from 'path';
import {
  NOTE_INNER_ENCRYPT_BODY_PREFIX,
  vaultGetNote,
  vaultGetNoteAttachment
} from './photoAlbumsUsb/vaultSession.js';

function sanitizeFileToken(value) {
  return String(value ?? '')
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 120);
}

export function getPhotoAlbumsSharedRoot() {
  const fromEnv = String(process.env.PHOTO_ALBUMS_SHARED_ROOT || '').trim();
  if (fromEnv) return fromEnv;
  const photoRoot = String(process.env.VSINGLES_PHOTO_FOLDER || '').trim();
  if (photoRoot) return path.join(photoRoot, 'photo_albums_shared');
  return path.join(process.cwd(), 'photo_albums_shared');
}

export function sharedInviteAttachmentDir(inviteId) {
  return path.join(getPhotoAlbumsSharedRoot(), String(inviteId));
}

function noteBodyIsInnerEncrypted(bodyText) {
  return String(bodyText || '').startsWith(NOTE_INNER_ENCRYPT_BODY_PREFIX);
}

/**
 * Copy album HTML + attachment bytes from the owner's open vault session.
 * Called when an invite email is sent (owner must have vault unlocked).
 */
export function capturePhotoAlbumsInviteSnapshot(session, inviteId, noteId) {
  const id = Number(inviteId);
  const nid = Number(noteId);
  if (!Number.isFinite(id) || id < 1 || !Number.isFinite(nid) || nid < 1) {
    throw new Error('Invalid invite or note id');
  }

  const note = vaultGetNote(session, nid);
  if (!note) throw new Error('Album not found in vault');

  const html = String(note.body_text ?? '');
  if (noteBodyIsInnerEncrypted(html) || Number(note.inner_encrypt_enabled) === 1) {
    throw new Error('Unlock this album before sharing it with someone.');
  }

  const dir = sharedInviteAttachmentDir(id);
  fs.mkdirSync(dir, { recursive: true });

  const attachments = Array.isArray(note.attachments) ? note.attachments : [];
  const snapshotAttachments = [];

  for (const row of attachments) {
    const attachmentId = Number(row.attachment_id ?? row.attachmentId);
    if (!Number.isFinite(attachmentId) || attachmentId < 1) continue;

    const file = vaultGetNoteAttachment(session, nid, attachmentId);
    if (!file?.buffer?.length) continue;

    const storageFileName = `${attachmentId}_${sanitizeFileToken(row.file_name || file.fileName || 'file')}`;
    fs.writeFileSync(path.join(dir, storageFileName), file.buffer);

    snapshotAttachments.push({
      attachmentId,
      fileName: String(row.file_name || file.fileName || ''),
      fileExtension: String(row.file_extension || ''),
      mimeType: String(file.contentType || row.mime_type || 'application/octet-stream'),
      storageFileName
    });
  }

  return {
    html,
    attachments: snapshotAttachments,
    snapshotAt: new Date().toISOString()
  };
}

export function readSharedInviteAttachmentFile(inviteId, storageFileName) {
  const dir = sharedInviteAttachmentDir(inviteId);
  const safeName = path.basename(String(storageFileName || ''));
  if (!safeName) return null;
  const fullPath = path.join(dir, safeName);
  if (!fullPath.startsWith(dir)) return null;
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath);
}
