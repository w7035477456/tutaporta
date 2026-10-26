import { fileRelativePath } from '../photoAlbumsUsb/vaultPaths.js';
import {
  DEFAULT_SAMPLE_ALBUM_NAME,
  DEFAULT_SAMPLE_NOTEBOOK_NAME
} from '../photoAlbumsUsb/vaultSchema.js';
import { linkInitializeSampleIntoVault } from './initializeSampleMedia.js';
import {
  loadInitializeSampleManifest,
  loadSampleAlbumBodyHtml
} from './initializeSampleManifest.js';

export { loadInitializeSampleManifest, loadSampleAlbumBodyHtml } from './initializeSampleManifest.js';

function queryOne(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

function buildSearchText(noteName, bodyHtml, attachments) {
  const parts = [
    noteName,
    String(bodyHtml || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
    ...(attachments || []).map((a) => a.fileName)
  ]
    .map((p) => String(p ?? '').trim())
    .filter(Boolean);
  return parts.join(' ').toLowerCase().replace(/\s+/g, ' ');
}

/**
 * SQLite seed for a fresh TutaPhotoAlbums vault: SAMPLE SET + SAMPLE ALBUM + 7 attachments.
 * Attachment ids are fixed 1…7 so sampleAlbumBody.html matches on first open.
 */
export function seedPhotoAlbumsNewMemberSampleDb(db) {
  const countRow = queryOne(db, `SELECT COUNT(*) AS c FROM notebooks WHERE deleted_at IS NULL`);
  if (Number(countRow?.c ?? 0) > 0) return false;

  const manifest = loadInitializeSampleManifest();
  const notebookName = manifest.notebookName || DEFAULT_SAMPLE_NOTEBOOK_NAME;
  const albumName = manifest.albumName || DEFAULT_SAMPLE_ALBUM_NAME;
  const bodyHtml = loadSampleAlbumBodyHtml();
  const attachments = Array.isArray(manifest.attachments) ? manifest.attachments : [];

  db.run(`INSERT INTO notebooks (notebook_name, display_order) VALUES (?, ?)`, [notebookName, 0]);
  const notebookId = Number(queryOne(db, `SELECT last_insert_rowid() AS id`).id);

  const searchText = buildSearchText(albumName, bodyHtml, attachments);
  db.run(
    `INSERT INTO notes (notebook_id, note_name, body_text, display_order, search_text)
     VALUES (?, ?, ?, ?, ?)`,
    [notebookId, albumName, bodyHtml, 0, searchText]
  );
  const noteId = Number(queryOne(db, `SELECT last_insert_rowid() AS id`).id);

  attachments.forEach((att, index) => {
    const attachmentId = Number(att.attachmentId) || index + 1;
    const albumPhotoSeq = Number(att.albumPhotoSeq) || attachmentId;
    const ext = String(att.fileExtension || 'bin').replace(/^\./, '').toLowerCase();
    const relativePath = fileRelativePath(notebookId, noteId, attachmentId, ext, albumPhotoSeq);
    db.run(
      `INSERT INTO note_attachments (
         attachment_id, note_id, file_name, file_extension, relative_path,
         file_size_bytes, checksum, mime_type, display_order, source_taken_at_ms, album_photo_seq
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        attachmentId,
        noteId,
        att.fileName,
        ext,
        relativePath,
        Number(att.fileSizeBytes) || 0,
        att.checksum || null,
        att.mimeType || null,
        index,
        Number(att.sourceTakenAtMs) || null,
        albumPhotoSeq
      ]
    );
  });

  db.run(
    `INSERT INTO shortcuts (target_type, notebook_id, note_id, display_order) VALUES (?, ?, ?, ?)`,
    ['note', notebookId, noteId, 0]
  );

  return true;
}

function insertSampleAttachmentValues(att, index, notebookId, noteId) {
  const attachmentId = Number(att.attachmentId) || index + 1;
  const albumPhotoSeq = Number(att.albumPhotoSeq) || attachmentId;
  const ext = String(att.fileExtension || 'bin').replace(/^\./, '').toLowerCase();
  return {
    attachmentId,
    values: [
      noteId,
      att.fileName,
      ext,
      fileRelativePath(notebookId, noteId, attachmentId, ext, albumPhotoSeq),
      Number(att.fileSizeBytes) || 0,
      att.checksum || null,
      att.mimeType || null,
      index,
      Number(att.sourceTakenAtMs) || null,
      albumPhotoSeq
    ]
  };
}

/**
 * "Restore Sample Album": bring SAMPLE SET / SAMPLE ALBUM and its 7 bundled photos back into
 * an existing vault without touching the member's other albums. Reuses an active SAMPLE SET /
 * SAMPLE ALBUM by name, otherwise creates them at the top of the list. Sample attachment ids
 * stay fixed (1…7): a soft-deleted or orphaned row with that id is revived into the sample
 * album; an id still used by a live album elsewhere is left alone.
 * Returns { notebookId, noteId, restoredAttachmentIds }.
 */
export function restorePhotoAlbumsSampleAlbumDb(db) {
  const manifest = loadInitializeSampleManifest();
  const notebookName = manifest.notebookName || DEFAULT_SAMPLE_NOTEBOOK_NAME;
  const albumName = manifest.albumName || DEFAULT_SAMPLE_ALBUM_NAME;
  const attachments = Array.isArray(manifest.attachments) ? manifest.attachments : [];

  let notebookId = Number(
    queryOne(
      db,
      `SELECT notebook_id FROM notebooks WHERE deleted_at IS NULL AND notebook_name = ?
       ORDER BY notebook_id LIMIT 1`,
      [notebookName]
    )?.notebook_id ?? 0
  );
  if (!notebookId) {
    const top = queryOne(db, `SELECT MIN(display_order) AS m FROM notebooks WHERE deleted_at IS NULL`);
    const order = top?.m == null ? 0 : Number(top.m) - 1;
    db.run(`INSERT INTO notebooks (notebook_name, display_order) VALUES (?, ?)`, [notebookName, order]);
    notebookId = Number(queryOne(db, `SELECT last_insert_rowid() AS id`).id);
  }

  let noteId = Number(
    queryOne(
      db,
      `SELECT note_id FROM notes WHERE deleted_at IS NULL AND notebook_id = ? AND note_name = ?
       ORDER BY note_id LIMIT 1`,
      [notebookId, albumName]
    )?.note_id ?? 0
  );
  if (!noteId) {
    const bodyHtml = loadSampleAlbumBodyHtml();
    const top = queryOne(
      db,
      `SELECT MIN(display_order) AS m FROM notes WHERE deleted_at IS NULL AND notebook_id = ?`,
      [notebookId]
    );
    const order = top?.m == null ? 0 : Number(top.m) - 1;
    db.run(
      `INSERT INTO notes (notebook_id, note_name, body_text, display_order, search_text)
       VALUES (?, ?, ?, ?, ?)`,
      [notebookId, albumName, bodyHtml, order, buildSearchText(albumName, bodyHtml, attachments)]
    );
    noteId = Number(queryOne(db, `SELECT last_insert_rowid() AS id`).id);
  }

  const restoredAttachmentIds = [];
  attachments.forEach((att, index) => {
    const { attachmentId, values } = insertSampleAttachmentValues(att, index, notebookId, noteId);
    const existing = queryOne(
      db,
      `SELECT a.note_id, a.deleted_at, n.note_id AS live_note_id
         FROM note_attachments a
         LEFT JOIN notes n ON n.note_id = a.note_id AND n.deleted_at IS NULL
        WHERE a.attachment_id = ?`,
      [attachmentId]
    );
    if (!existing) {
      db.run(
        `INSERT INTO note_attachments (
           attachment_id, note_id, file_name, file_extension, relative_path,
           file_size_bytes, checksum, mime_type, display_order, source_taken_at_ms, album_photo_seq
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [attachmentId, ...values]
      );
      restoredAttachmentIds.push(attachmentId);
      return;
    }
    const isLive = existing.deleted_at == null && existing.live_note_id != null;
    if (isLive) return;
    db.run(
      `UPDATE note_attachments
          SET note_id = ?, file_name = ?, file_extension = ?, relative_path = ?, file_size_bytes = ?,
              checksum = ?, mime_type = ?, display_order = ?, source_taken_at_ms = ?, album_photo_seq = ?,
              deleted_at = NULL, created_at = datetime('now')
        WHERE attachment_id = ?`,
      [...values, attachmentId]
    );
    restoredAttachmentIds.push(attachmentId);
  });

  const shortcut = queryOne(
    db,
    `SELECT shortcut_id FROM shortcuts WHERE target_type = 'note' AND note_id = ?`,
    [noteId]
  );
  if (!shortcut) {
    db.run(
      `INSERT INTO shortcuts (target_type, notebook_id, note_id, display_order) VALUES (?, ?, ?, ?)`,
      ['note', notebookId, noteId, 0]
    );
  }

  return { notebookId, noteId, restoredAttachmentIds };
}

/**
 * Link shared initializeSample media into a new vault (symlinks when plaintext; shared read otherwise).
 */
export async function seedPhotoAlbumsNewMemberSampleMedia({ mountPath, key, meta, db }) {
  const countRow = queryOne(db, `SELECT COUNT(*) AS c FROM note_attachments WHERE deleted_at IS NULL`);
  if (Number(countRow?.c ?? 0) < 1) return false;
  return linkInitializeSampleIntoVault({ mountPath, key, meta, db });
}
