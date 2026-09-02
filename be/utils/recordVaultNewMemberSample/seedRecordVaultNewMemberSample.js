import { fileRelativePath } from '../recordVaultUsb/vaultPaths.js';
import {
  loadRecordVaultNewMemberSampleManifest,
  loadRecordVaultSampleNoteBodyHtml
} from './sampleManifest.js';
import {
  linkRecordVaultSharedSamplesIntoVault,
  recordVaultNewMemberSampleSeedMarker
} from './sharedSampleMedia.js';

function queryOne(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function attachmentHasSharedContentKeyColumn(db) {
  return queryAll(db, `PRAGMA table_info(note_attachments)`).some(
    (row) => String(row.name || '') === 'shared_content_key'
  );
}

/** Ensure note_attachments.shared_content_key exists (pointer to shared sample bytes). */
export function ensureRecordVaultSharedContentKeyColumn(db) {
  if (attachmentHasSharedContentKeyColumn(db)) return false;
  try {
    db.run(`ALTER TABLE note_attachments ADD COLUMN shared_content_key TEXT`);
    return true;
  } catch {
    return false;
  }
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

function vaultAlreadyHasNewMemberSample(db) {
  const marker = recordVaultNewMemberSampleSeedMarker();
  const rows = queryAll(
    db,
    `SELECT note_id, note_name, body_text FROM notes WHERE deleted_at IS NULL`
  );
  let foundNote1 = false;
  let foundNote2 = false;
  for (const row of rows) {
    const name = String(row.note_name || '').trim().toUpperCase();
    const body = String(row.body_text || '');
    const marked = body.includes(marker);
    if (name === 'SAMPLE NOTE1' || (marked && body.includes('note=1'))) foundNote1 = true;
    if (name === 'SAMPLE NOTE2' || (marked && body.includes('note=2'))) foundNote2 = true;
  }
  return foundNote1 && foundNote2;
}

function insertSampleAttachments(db, { notebookId, noteId, attachments, startAttachmentId }) {
  ensureRecordVaultSharedContentKeyColumn(db);
  let nextId = Number(startAttachmentId) || 1;
  const maxRow = queryOne(db, `SELECT COALESCE(MAX(attachment_id), 0) AS m FROM note_attachments`);
  nextId = Math.max(nextId, Number(maxRow?.m || 0) + 1);

  (attachments || []).forEach((att, index) => {
    const preferredId = Number(att.attachmentId);
    const preferredFree =
      Number.isFinite(preferredId) &&
      preferredId >= 1 &&
      !queryOne(db, `SELECT attachment_id FROM note_attachments WHERE attachment_id = ?`, [
        preferredId
      ]);
    let attachmentId;
    if (preferredFree) {
      attachmentId = preferredId;
    } else {
      attachmentId = nextId;
      nextId += 1;
    }
    if (attachmentId >= nextId) nextId = attachmentId + 1;

    const ext = String(att.fileExtension || 'bin').replace(/^\./, '').toLowerCase();
    const relativePath = fileRelativePath(notebookId, noteId, attachmentId, ext);
    const sharedKey = String(att.sharedKey || '').trim() || null;
    db.run(
      `INSERT INTO note_attachments (
         attachment_id, note_id, file_name, file_extension, relative_path,
         file_size_bytes, checksum, mime_type, display_order, shared_content_key
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        sharedKey
      ]
    );
  });
  return nextId;
}

function insertSampleNote(db, { notebookId, noteDef, nextAttachmentId }) {
  const bodyHtml = loadRecordVaultSampleNoteBodyHtml(noteDef.bodyHtmlFile);
  const attachments = Array.isArray(noteDef.attachments) ? noteDef.attachments : [];
  const noteName = String(noteDef.noteName || 'SAMPLE NOTE').trim() || 'SAMPLE NOTE';
  const searchText = buildSearchText(noteName, bodyHtml, attachments);
  db.run(
    `INSERT INTO notes (notebook_id, note_name, body_text, display_order, search_text)
     VALUES (?, ?, ?, ?, ?)`,
    [notebookId, noteName, bodyHtml, Number(noteDef.displayOrder) || 0, searchText]
  );
  const noteId = Number(queryOne(db, `SELECT last_insert_rowid() AS id`).id);
  const afterId = insertSampleAttachments(db, {
    notebookId,
    noteId,
    attachments,
    startAttachmentId: nextAttachmentId
  });
  if (noteDef.shortcut) {
    const orderRow = queryOne(
      db,
      `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM shortcuts`
    );
    db.run(
      `INSERT INTO shortcuts (target_type, notebook_id, note_id, display_order) VALUES (?, ?, ?, ?)`,
      ['note', notebookId, noteId, Number(orderRow?.next_order ?? 0)]
    );
  }
  return { noteId, nextAttachmentId: afterId };
}

/**
 * Fresh empty vault: SAMPLE NOTEBOOK + SAMPLE NOTE1/2 + shared attachment pointers.
 * @returns {boolean} true when seed rows were inserted
 */
export function seedRecordVaultNewMemberSampleDb(db) {
  ensureRecordVaultSharedContentKeyColumn(db);
  const countRow = queryOne(db, `SELECT COUNT(*) AS c FROM notebooks WHERE deleted_at IS NULL`);
  if (Number(countRow?.c ?? 0) > 0) return false;

  const manifest = loadRecordVaultNewMemberSampleManifest();
  const notebookName = String(manifest.notebookName || 'SAMPLE NOTEBOOK').trim() || 'SAMPLE NOTEBOOK';
  db.run(`INSERT INTO notebooks (notebook_name, display_order) VALUES (?, ?)`, [notebookName, 0]);
  const notebookId = Number(queryOne(db, `SELECT last_insert_rowid() AS id`).id);

  let nextAttachmentId = 1;
  for (const noteDef of manifest.notes || []) {
    const inserted = insertSampleNote(db, { notebookId, noteDef, nextAttachmentId });
    nextAttachmentId = inserted.nextAttachmentId;
  }
  return true;
}

/**
 * Existing vaults: add SAMPLE NOTEBOOK + two notes if missing (never wipe user data).
 * @returns {'inserted'|'present'|'skipped'}
 */
export function ensureRecordVaultNewMemberSampleDb(db) {
  ensureRecordVaultSharedContentKeyColumn(db);
  if (vaultAlreadyHasNewMemberSample(db)) return 'present';

  const notebookCount = Number(
    queryOne(db, `SELECT COUNT(*) AS c FROM notebooks WHERE deleted_at IS NULL`)?.c ?? 0
  );
  if (notebookCount === 0) {
    return seedRecordVaultNewMemberSampleDb(db) ? 'inserted' : 'skipped';
  }

  const manifest = loadRecordVaultNewMemberSampleManifest();
  const notebookName = String(manifest.notebookName || 'SAMPLE NOTEBOOK').trim() || 'SAMPLE NOTEBOOK';

  let notebookRow = queryOne(
    db,
    `SELECT notebook_id, notebook_name FROM notebooks
     WHERE deleted_at IS NULL AND lower(trim(notebook_name)) = lower(?)
     ORDER BY notebook_id ASC LIMIT 1`,
    [notebookName]
  );
  let notebookId = notebookRow ? Number(notebookRow.notebook_id) : null;
  if (!notebookId) {
    const orderRow = queryOne(
      db,
      `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM notebooks WHERE deleted_at IS NULL`
    );
    db.run(`INSERT INTO notebooks (notebook_name, display_order) VALUES (?, ?)`, [
      notebookName,
      Number(orderRow?.next_order ?? 0)
    ]);
    notebookId = Number(queryOne(db, `SELECT last_insert_rowid() AS id`).id);
  }

  const existingNames = new Set(
    queryAll(db, `SELECT note_name FROM notes WHERE deleted_at IS NULL`).map((r) =>
      String(r.note_name || '')
        .trim()
        .toUpperCase()
    )
  );

  let nextAttachmentId =
    Number(queryOne(db, `SELECT COALESCE(MAX(attachment_id), 0) AS m FROM note_attachments`)?.m || 0) +
    1;
  let inserted = false;
  for (const noteDef of manifest.notes || []) {
    const name = String(noteDef.noteName || '')
      .trim()
      .toUpperCase();
    if (existingNames.has(name)) continue;
    const result = insertSampleNote(db, { notebookId, noteDef, nextAttachmentId });
    nextAttachmentId = result.nextAttachmentId;
    inserted = true;
  }
  return inserted ? 'inserted' : 'present';
}

export async function seedRecordVaultNewMemberSampleMedia(args) {
  return linkRecordVaultSharedSamplesIntoVault(args);
}
