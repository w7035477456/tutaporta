import { fileRelativePath } from '../recordVaultUsb/vaultPaths.js';
import {
  loadRecordVaultNewMemberSampleManifest,
  loadRecordVaultSampleNoteBodyHtml
} from './sampleManifest.js';
import {
  linkRecordVaultSharedSamplesIntoVault,
  recordVaultNewMemberSampleSeedMarker
} from './sharedSampleMedia.js';

/** Prior placeholder sample (tiny generated files) — remove on upgrade to dm1 set. */
const GARBAGE_V1_MARKER = 'rv-new-member-sample-v1';
const GARBAGE_V1_SHARED_KEYS = new Set([
  'welcome-pdf',
  'welcome-txt',
  'welcome-png',
  'welcome-jpg',
  'formats-txt',
  'formats-csv'
]);
const GARBAGE_V1_CHECKSUMS = new Set([
  '01023dc513fffa44eac665782c409e43928c1b6f0a0e30c0a4f1cc9dcd970777',
  '73c6a3c61334d14f8d2f38dd249cb2d691ae9bb5da3f03327da756392baedbf4',
  'edee5069c02ce271861c4d58b035e04999703c495b7af23e17d4bbfffd337e45',
  '3d53287e8f7fe6438170e3ce451a83d4fee21cad67e38cf96ef79492f535e473',
  'fd5200c3cca7409b32f7c274ec4b0b6f2b2f0c608a11c14208746bdec9a70bb1',
  '9a74391ab25a4f510091eebe9593a2feef13b707f0f16ea4e905806f82a3f8f2'
]);

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

function canonicalChecksumSet() {
  const manifest = loadRecordVaultNewMemberSampleManifest();
  const set = new Set();
  for (const note of manifest.notes || []) {
    for (const att of note.attachments || []) {
      const c = String(att.checksum || '')
        .trim()
        .toLowerCase();
      if (c) set.add(c);
    }
  }
  return set;
}

/** dm1 / v2 canonical welcome or formats note — never treat as garbage. */
function noteLooksLikeCanonicalDm1(bodyText) {
  const body = String(bodyText || '');
  if (body.includes('rv-new-member-sample-v2')) return true;
  // Original dm1@gmail.com SAMPLE NOTE1 welcome copy (no seed marker).
  if (body.includes('Flexible Organization')) return true;
  if (body.includes('We’ve created a sample note') || body.includes("We've created a sample note")) {
    return true;
  }
  // Original dm1 SAMPLE NOTE2 formats copy.
  if (body.includes('Formats the code can')) return true;
  return false;
}

function noteLooksLikeGarbageV1(db, noteRow) {
  const body = String(noteRow?.body_text || '');
  const atts = queryAll(
    db,
    `SELECT checksum, shared_content_key FROM note_attachments
     WHERE note_id = ? AND deleted_at IS NULL`,
    [noteRow.note_id]
  );
  if (atts.length) {
    let garbageHits = 0;
    for (const att of atts) {
      const key = String(att.shared_content_key || '').trim();
      const sum = String(att.checksum || '')
        .trim()
        .toLowerCase();
      if (GARBAGE_V1_SHARED_KEYS.has(key) || GARBAGE_V1_CHECKSUMS.has(sum)) garbageHits += 1;
    }
    // All live attachments are tiny v1 placeholders → garbage (even if body was later overwritten).
    if (garbageHits > 0 && garbageHits === atts.length) return true;
  }
  // Canonical dm1 set must never be purged (SAMPLE NOTE1 has zero attachments by design).
  if (noteLooksLikeCanonicalDm1(body)) return false;
  if (body.includes(GARBAGE_V1_MARKER)) return true;
  // Empty SAMPLE NOTE1 without dm1/v2 body is not auto-purged (avoid wiping user edits).
  return false;
}

/**
 * Revive soft-deleted SAMPLE NOTE1 that matches the dm1 welcome copy
 * (e.g. earlier buggy purge of empty SAMPLE NOTE1). Never revive SAMPLE NOTE2 —
 * that note must be re-seeded with shared attachment pointers when missing.
 * @returns {number} notes revived
 */
function reviveSoftDeletedCanonicalSampleNotes(db) {
  const rows = queryAll(
    db,
    `SELECT note_id, note_name, body_text FROM notes WHERE deleted_at IS NOT NULL`
  );
  let revived = 0;
  for (const row of rows) {
    const name = String(row.note_name || '')
      .trim()
      .toUpperCase();
    // Only SAMPLE NOTE1 (no required attachments). SAMPLE NOTE2 must be re-inserted with pointers.
    if (name !== 'SAMPLE NOTE1') continue;
    if (!noteLooksLikeCanonicalDm1(row.body_text)) continue;
    const live = queryOne(
      db,
      `SELECT note_id FROM notes
       WHERE deleted_at IS NULL AND upper(trim(note_name)) = ?
       LIMIT 1`,
      [name]
    );
    if (live) continue;
    db.run(`UPDATE notes SET deleted_at = NULL, updated_at = datetime('now') WHERE note_id = ?`, [
      row.note_id
    ]);
    revived += 1;
  }
  return revived;
}

function noteHasCanonicalDm1Attachments(db, noteId, expectedAttachments) {
  const expected = Array.isArray(expectedAttachments) ? expectedAttachments : [];
  if (!expected.length) return true;
  const rows = queryAll(
    db,
    `SELECT checksum, shared_content_key, file_name FROM note_attachments
     WHERE note_id = ? AND deleted_at IS NULL`,
    [noteId]
  );
  if (rows.length < expected.length) return false;
  const byChecksum = new Set(
    rows.map((r) =>
      String(r.checksum || '')
        .trim()
        .toLowerCase()
    )
  );
  const byKey = new Set(rows.map((r) => String(r.shared_content_key || '').trim()).filter(Boolean));
  return expected.every((att) => {
    const sum = String(att.checksum || '')
      .trim()
      .toLowerCase();
    const key = String(att.sharedKey || '').trim();
    return (sum && byChecksum.has(sum)) || (key && byKey.has(key));
  });
}

function vaultAlreadyHasNewMemberSample(db) {
  const marker = recordVaultNewMemberSampleSeedMarker();
  const manifest = loadRecordVaultNewMemberSampleManifest();
  const note1Def = (manifest.notes || []).find((n) => String(n.noteKey) === 'sample-note-1');
  const note2Def = (manifest.notes || []).find((n) => String(n.noteKey) === 'sample-note-2');
  const rows = queryAll(
    db,
    `SELECT note_id, note_name, body_text FROM notes WHERE deleted_at IS NULL`
  );

  let note1 = null;
  let note2 = null;
  for (const row of rows) {
    const name = String(row.note_name || '')
      .trim()
      .toUpperCase();
    const body = String(row.body_text || '');
    if (name === 'SAMPLE NOTE1' || (body.includes(marker) && body.includes('note=1'))) note1 = row;
    if (name === 'SAMPLE NOTE2' || (body.includes(marker) && body.includes('note=2'))) note2 = row;
  }
  if (!note1 || !note2) return false;
  if (noteLooksLikeGarbageV1(db, note1) || noteLooksLikeGarbageV1(db, note2)) return false;

  // SAMPLE NOTE2 must point at the shared dm1 demo attachments (checksum or shared_content_key).
  if (!noteHasCanonicalDm1Attachments(db, note2.note_id, note2Def?.attachments || [])) {
    return false;
  }
  // SAMPLE NOTE1 may be empty (no attachments) — accept dm1 welcome or v2 marker.
  if (!noteLooksLikeCanonicalDm1(note1.body_text) && !String(note1.body_text || '').includes(marker)) {
    return false;
  }
  return true;
}

/** Pre-sample starter notebook name (legacy registration default). */
function isLegacyDefaultNotebook1Name(notebookName) {
  return String(notebookName || '')
    .trim()
    .toUpperCase() === 'NOTEBOOK 1';
}

/**
 * Soft-delete legacy registration default "Notebook 1" / "NOTEBOOK 1" (+ its notes).
 * Does not touch SAMPLE NOTEBOOK / SAMPLE NOTEBOOK 1.
 * @returns {number} notebooks removed
 */
export function purgeLegacyDefaultNotebook1(db) {
  const rows = queryAll(
    db,
    `SELECT notebook_id, notebook_name FROM notebooks WHERE deleted_at IS NULL`
  );
  let removed = 0;
  for (const row of rows) {
    if (!isLegacyDefaultNotebook1Name(row.notebook_name)) continue;
    const notebookId = Number(row.notebook_id);
    const notes = queryAll(
      db,
      `SELECT note_id FROM notes WHERE notebook_id = ? AND deleted_at IS NULL`,
      [notebookId]
    );
    for (const note of notes) {
      db.run(
        `UPDATE note_attachments SET deleted_at = datetime('now') WHERE note_id = ? AND deleted_at IS NULL`,
        [note.note_id]
      );
      db.run(`DELETE FROM shortcuts WHERE note_id = ?`, [note.note_id]);
      db.run(
        `UPDATE notes SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE note_id = ?`,
        [note.note_id]
      );
    }
    db.run(`DELETE FROM shortcuts WHERE notebook_id = ?`, [notebookId]);
    db.run(
      `UPDATE notebooks SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE notebook_id = ?`,
      [notebookId]
    );
    removed += 1;
  }
  return removed;
}

/**
 * Soft-delete prior garbage v1 placeholder SAMPLE NOTE1/2 (+ empty sample notebook).
 * @returns {number} notes removed
 */
export function purgeGarbageRecordVaultV1SampleNotes(db) {
  ensureRecordVaultSharedContentKeyColumn(db);
  const rows = queryAll(
    db,
    `SELECT note_id, notebook_id, note_name, body_text FROM notes WHERE deleted_at IS NULL`
  );
  let removed = 0;
  const touchedNotebooks = new Set();
  for (const row of rows) {
    const name = String(row.note_name || '')
      .trim()
      .toUpperCase();
    const isSampleName = name === 'SAMPLE NOTE1' || name === 'SAMPLE NOTE2';
    if (!isSampleName && !String(row.body_text || '').includes(GARBAGE_V1_MARKER)) continue;
    if (!noteLooksLikeGarbageV1(db, row) && !String(row.body_text || '').includes(GARBAGE_V1_MARKER)) {
      continue;
    }
    db.run(`UPDATE note_attachments SET deleted_at = datetime('now') WHERE note_id = ? AND deleted_at IS NULL`, [
      row.note_id
    ]);
    db.run(`DELETE FROM shortcuts WHERE note_id = ?`, [row.note_id]);
    db.run(`UPDATE notes SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE note_id = ?`, [
      row.note_id
    ]);
    touchedNotebooks.add(Number(row.notebook_id));
    removed += 1;
  }

  for (const notebookId of touchedNotebooks) {
    const left = queryOne(
      db,
      `SELECT COUNT(*) AS c FROM notes WHERE notebook_id = ? AND deleted_at IS NULL`,
      [notebookId]
    );
    if (Number(left?.c || 0) > 0) continue;
    const nb = queryOne(
      db,
      `SELECT notebook_name FROM notebooks WHERE notebook_id = ? AND deleted_at IS NULL`,
      [notebookId]
    );
    const nbName = String(nb?.notebook_name || '')
      .trim()
      .toUpperCase();
    if (nbName === 'SAMPLE NOTEBOOK' || nbName === 'SAMPLE NOTEBOOK 1') {
      db.run(`DELETE FROM shortcuts WHERE notebook_id = ?`, [notebookId]);
      db.run(
        `UPDATE notebooks SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE notebook_id = ?`,
        [notebookId]
      );
    }
  }
  return removed;
}

/**
 * Point existing dm1-checksum attachments at shared_content_key (no byte copy).
 */
function relinkCanonicalAttachmentsToSharedKeys(db) {
  ensureRecordVaultSharedContentKeyColumn(db);
  const manifest = loadRecordVaultNewMemberSampleManifest();
  const byChecksum = new Map();
  for (const note of manifest.notes || []) {
    for (const att of note.attachments || []) {
      const sum = String(att.checksum || '')
        .trim()
        .toLowerCase();
      if (sum) byChecksum.set(sum, String(att.sharedKey || '').trim());
    }
  }
  if (!byChecksum.size) return 0;
  const rows = queryAll(
    db,
    `SELECT attachment_id, checksum, shared_content_key FROM note_attachments WHERE deleted_at IS NULL`
  );
  let updated = 0;
  for (const row of rows) {
    const sum = String(row.checksum || '')
      .trim()
      .toLowerCase();
    const key = byChecksum.get(sum);
    if (!key) continue;
    if (String(row.shared_content_key || '').trim() === key) continue;
    db.run(`UPDATE note_attachments SET shared_content_key = ? WHERE attachment_id = ?`, [
      key,
      row.attachment_id
    ]);
    updated += 1;
  }
  return updated;
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
    const orderRow = queryOne(db, `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM shortcuts`);
    db.run(
      `INSERT INTO shortcuts (target_type, notebook_id, note_id, display_order) VALUES (?, ?, ?, ?)`,
      ['note', notebookId, noteId, Number(orderRow?.next_order ?? 0)]
    );
  }
  return { noteId, nextAttachmentId: afterId };
}

/**
 * Fresh empty vault: SAMPLE NOTEBOOK 1 + SAMPLE NOTE1/2 + shared attachment pointers (dm1 set).
 * @returns {boolean} true when seed rows were inserted
 */
export function seedRecordVaultNewMemberSampleDb(db) {
  ensureRecordVaultSharedContentKeyColumn(db);
  const countRow = queryOne(db, `SELECT COUNT(*) AS c FROM notebooks WHERE deleted_at IS NULL`);
  if (Number(countRow?.c ?? 0) > 0) return false;

  const manifest = loadRecordVaultNewMemberSampleManifest();
  const notebookName = String(manifest.notebookName || 'SAMPLE NOTEBOOK 1').trim() || 'SAMPLE NOTEBOOK 1';
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
 * Existing vaults: purge garbage v1 placeholders, then ensure dm1 SAMPLE NOTE1/2 exist.
 * Never wipes unrelated user notebooks/notes.
 * @returns {'inserted'|'present'|'upgraded'|'skipped'}
 */
export function ensureRecordVaultNewMemberSampleDb(db) {
  ensureRecordVaultSharedContentKeyColumn(db);
  const purgedLegacyNb1 = purgeLegacyDefaultNotebook1(db);
  const purged = purgeGarbageRecordVaultV1SampleNotes(db);
  const revived = reviveSoftDeletedCanonicalSampleNotes(db);
  const relinked = relinkCanonicalAttachmentsToSharedKeys(db);
  const changedMeta = purgedLegacyNb1 > 0 || purged > 0 || revived > 0 || relinked > 0;

  if (vaultAlreadyHasNewMemberSample(db)) {
    return changedMeta ? 'upgraded' : 'present';
  }

  const notebookCount = Number(
    queryOne(db, `SELECT COUNT(*) AS c FROM notebooks WHERE deleted_at IS NULL`)?.c ?? 0
  );
  if (notebookCount === 0) {
    const seeded = seedRecordVaultNewMemberSampleDb(db);
    if (!seeded) return 'skipped';
    return purgedLegacyNb1 > 0 || purged > 0 || revived > 0 ? 'upgraded' : 'inserted';
  }

  const manifest = loadRecordVaultNewMemberSampleManifest();
  const notebookName = String(manifest.notebookName || 'SAMPLE NOTEBOOK 1').trim() || 'SAMPLE NOTEBOOK 1';

  let notebookRow = queryOne(
    db,
    `SELECT notebook_id, notebook_name FROM notebooks
     WHERE deleted_at IS NULL AND lower(trim(notebook_name)) = lower(?)
     ORDER BY notebook_id ASC LIMIT 1`,
    [notebookName]
  );
  // Also accept prior "SAMPLE NOTEBOOK" title as host for the two notes.
  if (!notebookRow) {
    notebookRow = queryOne(
      db,
      `SELECT notebook_id, notebook_name FROM notebooks
       WHERE deleted_at IS NULL AND upper(trim(notebook_name)) IN ('SAMPLE NOTEBOOK', 'SAMPLE NOTEBOOK 1')
       ORDER BY notebook_id ASC LIMIT 1`
    );
  }
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

  const existingByName = new Map();
  for (const row of queryAll(db, `SELECT note_id, note_name, body_text FROM notes WHERE deleted_at IS NULL`)) {
    existingByName.set(
      String(row.note_name || '')
        .trim()
        .toUpperCase(),
      row
    );
  }

  let nextAttachmentId =
    Number(queryOne(db, `SELECT COALESCE(MAX(attachment_id), 0) AS m FROM note_attachments`)?.m || 0) + 1;
  let inserted = false;
  for (const noteDef of manifest.notes || []) {
    const name = String(noteDef.noteName || '')
      .trim()
      .toUpperCase();
    const existing = existingByName.get(name);
    if (existing) {
      if (noteLooksLikeGarbageV1(db, existing)) {
        db.run(`UPDATE note_attachments SET deleted_at = datetime('now') WHERE note_id = ? AND deleted_at IS NULL`, [
          existing.note_id
        ]);
        db.run(`DELETE FROM shortcuts WHERE note_id = ?`, [existing.note_id]);
        db.run(`UPDATE notes SET deleted_at = datetime('now') WHERE note_id = ?`, [existing.note_id]);
      } else {
        // Keep user/dm1 note; ensure shared pointers on matching checksums.
        continue;
      }
    }
    const result = insertSampleNote(db, { notebookId, noteDef, nextAttachmentId });
    nextAttachmentId = result.nextAttachmentId;
    inserted = true;
  }
  relinkCanonicalAttachmentsToSharedKeys(db);
  if (inserted && !changedMeta) return 'inserted';
  if (inserted || changedMeta) {
    return purgedLegacyNb1 > 0 || purged > 0 || revived > 0 ? 'upgraded' : 'inserted';
  }
  return changedMeta ? 'upgraded' : 'present';
}

export async function seedRecordVaultNewMemberSampleMedia(args) {
  return linkRecordVaultSharedSamplesIntoVault(args);
}

export { canonicalChecksumSet };
