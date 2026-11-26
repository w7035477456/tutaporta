import { fileRelativePath } from '../recordVaultUsb/vaultPaths.js';
import { NOTES_VAULT_TABLES as T } from '../recordVaultUsb/vaultPgStore.js';
import {
  loadRecordVaultNewMemberSampleManifest,
  loadRecordVaultSampleNoteBodyHtml,
  listRecordVaultSampleAttachmentDefs,
  listRecordVaultSampleNotebooks,
  listRecordVaultSampleNoteDefs
} from './sampleManifest.js';
import { recordVaultNewMemberSampleSeedMarker } from './sharedSampleMedia.js';

/** Prior v2 dm1 placeholder set (single SAMPLE NOTEBOOK 1 + SAMPLE NOTE1/2). */
const GARBAGE_V2_MARKER = 'rv-new-member-sample-v2';
const LEGACY_V2_NOTEBOOK_NAMES = new Set(['SAMPLE NOTEBOOK 1', 'SAMPLE NOTEBOOK']);
const LEGACY_V2_NOTE_NAMES = new Set(['SAMPLE NOTE1', 'SAMPLE NOTE2']);

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

/** Postgres notes_note_attachments always has shared_content_key — kept for older callers. */
export async function ensureRecordVaultSharedContentKeyColumn(_db) {
  return false;
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
  const set = new Set();
  for (const note of listRecordVaultSampleNoteDefs()) {
    for (const att of note.attachments || []) {
      const c = String(att.checksum || '')
        .trim()
        .toLowerCase();
      if (c) set.add(c);
    }
  }
  return set;
}

/** v3 canonical sample note — never treat as garbage. */
function noteLooksLikeCanonicalSample(bodyText) {
  const body = String(bodyText || '');
  const marker = recordVaultNewMemberSampleSeedMarker();
  if (marker && body.includes(marker)) return true;
  if (body.includes('rv-new-member-sample-v3')) return true;
  if (body.includes('rv-new-member-sample-v4')) return true;
  if (body.includes('rv-new-member-sample-v5')) return true;
  if (body.includes('SAMPLE MISC') && body.includes('SAMPLE TAX RECORDS')) return true;
  if (body.includes('Formats the code can')) return true;
  if (body.includes('Costco Grocery Receipt') || body.includes('Costco Grocery receipt')) return true;
  if (body.includes('2025 1040 Tax') || body.includes('2024 1040 tax')) return true;
  // Legacy v2 dm1 welcome / formats copy.
  if (body.includes('rv-new-member-sample-v2')) return true;
  if (body.includes('Flexible Organization')) return true;
  return false;
}

async function noteLooksLikeGarbageV1(db, noteRow) {
  const body = String(noteRow?.body_text || '');
  const atts = await db.all(
    `SELECT checksum, shared_content_key FROM ${T.attachments}
      WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL`,
    [db.singlesId, noteRow.note_id]
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
  // Canonical sample notes must never be purged.
  if (noteLooksLikeCanonicalSample(body)) return false;
  if (body.includes(GARBAGE_V1_MARKER)) return true;
  // Empty SAMPLE NOTE1 without dm1/v2 body is not auto-purged (avoid wiping user edits).
  return false;
}

async function noteHasCanonicalDm1Attachments(db, noteId, expectedAttachments) {
  const expected = Array.isArray(expectedAttachments) ? expectedAttachments : [];
  if (!expected.length) return true;
  const rows = await db.all(
    `SELECT checksum, shared_content_key, file_name FROM ${T.attachments}
      WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL`,
    [db.singlesId, noteId]
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

function upperName(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase();
}

async function findLiveNoteByName(db, noteName) {
  const name = upperName(noteName);
  if (!name) return null;
  return db.one(
    `SELECT note_id, note_name, body_text, notebook_id FROM ${T.notes}
      WHERE singles_id = $1 AND deleted_at IS NULL AND upper(trim(note_name)) = $2
      ORDER BY note_id ASC LIMIT 1`,
    [db.singlesId, name]
  );
}

/** Soft-deleted row with this notebook name (user removed it intentionally). */
async function findSoftDeletedNotebookByName(db, notebookName) {
  const name = upperName(notebookName);
  if (!name) return null;
  return db.one(
    `SELECT notebook_id, notebook_name, deleted_at FROM ${T.notebooks}
      WHERE singles_id = $1 AND deleted_at IS NOT NULL AND upper(trim(notebook_name)) = $2
      ORDER BY notebook_id ASC LIMIT 1`,
    [db.singlesId, name]
  );
}

/** Soft-deleted note with this name (user removed it intentionally). */
async function findSoftDeletedNoteByName(db, noteName) {
  const name = upperName(noteName);
  if (!name) return null;
  return db.one(
    `SELECT note_id, note_name, deleted_at FROM ${T.notes}
      WHERE singles_id = $1 AND deleted_at IS NOT NULL AND upper(trim(note_name)) = $2
      ORDER BY note_id ASC LIMIT 1`,
    [db.singlesId, name]
  );
}

async function vaultAlreadyHasNewMemberSample(db) {
  const marker = recordVaultNewMemberSampleSeedMarker();
  const noteDefs = listRecordVaultSampleNoteDefs();

  for (const noteDef of noteDefs) {
    const row = await findLiveNoteByName(db, String(noteDef.noteName || '').trim());
    if (!row) return false;
    if (await noteLooksLikeGarbageV1(db, row)) return false;
    const body = String(row.body_text || '');
    if (!noteLooksLikeCanonicalSample(body) && !body.includes(marker)) return false;
    if (!(await noteHasCanonicalDm1Attachments(db, row.note_id, noteDef.attachments || []))) return false;
  }
  return noteDefs.length > 0;
}

/**
 * True when the member previously had the registration sample set and soft-deleted it.
 * Soft-deleted rows mean "seed once already happened; do not recreate."
 */
async function userRemovedNewMemberSample(db) {
  const manifest = loadRecordVaultNewMemberSampleManifest();
  for (const nbDef of listRecordVaultSampleNotebooks(manifest)) {
    const notebookName = String(nbDef.notebookName || '').trim();
    if (notebookName && (await findSoftDeletedNotebookByName(db, notebookName))) return true;
    for (const noteDef of nbDef.notes || []) {
      const noteName = String(noteDef.noteName || '').trim();
      if (noteName && (await findSoftDeletedNoteByName(db, noteName))) return true;
    }
  }
  return false;
}

async function softDeleteNoteRows(db, noteId) {
  const sid = db.singlesId;
  await db.run(
    `UPDATE ${T.attachments} SET deleted_at = NOW()
      WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL`,
    [sid, noteId]
  );
  await db.run(`DELETE FROM ${T.shortcuts} WHERE singles_id = $1 AND note_id = $2`, [sid, noteId]);
  await db.run(
    `UPDATE ${T.notes} SET deleted_at = NOW(), updated_at = NOW() WHERE singles_id = $1 AND note_id = $2`,
    [sid, noteId]
  );
}

async function softDeleteNotebookRow(db, notebookId) {
  const sid = db.singlesId;
  await db.run(`DELETE FROM ${T.shortcuts} WHERE singles_id = $1 AND notebook_id = $2`, [sid, notebookId]);
  await db.run(
    `UPDATE ${T.notebooks} SET deleted_at = NOW(), updated_at = NOW() WHERE singles_id = $1 AND notebook_id = $2`,
    [sid, notebookId]
  );
}

async function liveNotebooks(db) {
  return db.all(
    `SELECT notebook_id, notebook_name FROM ${T.notebooks} WHERE singles_id = $1 AND deleted_at IS NULL`,
    [db.singlesId]
  );
}

/**
 * Soft-delete legacy registration default "Notebook 1" / "NOTEBOOK 1" (+ its notes).
 * Does not touch SAMPLE NOTEBOOK / SAMPLE NOTEBOOK 1.
 * @returns {Promise<number>} notebooks removed
 */
export async function purgeLegacyDefaultNotebook1(db) {
  let removed = 0;
  for (const row of await liveNotebooks(db)) {
    if (upperName(row.notebook_name) !== 'NOTEBOOK 1') continue;
    const notebookId = Number(row.notebook_id);
    const notes = await db.all(
      `SELECT note_id FROM ${T.notes} WHERE singles_id = $1 AND notebook_id = $2 AND deleted_at IS NULL`,
      [db.singlesId, notebookId]
    );
    for (const note of notes) await softDeleteNoteRows(db, note.note_id);
    await softDeleteNotebookRow(db, notebookId);
    removed += 1;
  }
  return removed;
}

/**
 * Soft-delete legacy v2 sample set (SAMPLE NOTEBOOK 1 + SAMPLE NOTE1/2) when upgrading to v3.
 * @returns {Promise<number>} notebooks removed
 */
export async function purgeLegacyV2SampleSet(db) {
  let removed = 0;
  for (const row of await liveNotebooks(db)) {
    if (!LEGACY_V2_NOTEBOOK_NAMES.has(upperName(row.notebook_name))) continue;
    const notebookId = Number(row.notebook_id);
    const notes = await db.all(
      `SELECT note_id, note_name, body_text FROM ${T.notes}
        WHERE singles_id = $1 AND notebook_id = $2 AND deleted_at IS NULL`,
      [db.singlesId, notebookId]
    );
    if (!notes.length) continue;
    const allLegacyNotes = notes.every(
      (n) => LEGACY_V2_NOTE_NAMES.has(upperName(n.note_name)) || String(n.body_text || '').includes(GARBAGE_V2_MARKER)
    );
    if (!allLegacyNotes) continue;
    for (const note of notes) await softDeleteNoteRows(db, note.note_id);
    await softDeleteNotebookRow(db, notebookId);
    removed += 1;
  }
  return removed;
}

/** Soft-delete live notes stuck on a deleted notebook (legacy v2 purge leftovers). */
async function purgeOrphanedLegacySampleNotes(db) {
  const rows = await db.all(
    `SELECT n.note_id, n.note_name
       FROM ${T.notes} n
       JOIN ${T.notebooks} nb ON nb.singles_id = n.singles_id AND nb.notebook_id = n.notebook_id
      WHERE n.singles_id = $1 AND n.deleted_at IS NULL AND nb.deleted_at IS NOT NULL`,
    [db.singlesId]
  );
  let removed = 0;
  for (const row of rows) {
    if (!LEGACY_V2_NOTE_NAMES.has(upperName(row.note_name))) continue;
    await softDeleteNoteRows(db, row.note_id);
    removed += 1;
  }
  return removed;
}

/**
 * Soft-delete prior garbage v1 placeholder SAMPLE NOTE1/2 (+ empty sample notebook).
 * @returns {Promise<number>} notes removed
 */
export async function purgeGarbageRecordVaultV1SampleNotes(db) {
  const sid = db.singlesId;
  const rows = await db.all(
    `SELECT note_id, notebook_id, note_name, body_text FROM ${T.notes} WHERE singles_id = $1 AND deleted_at IS NULL`,
    [sid]
  );
  let removed = 0;
  const touchedNotebooks = new Set();
  for (const row of rows) {
    const name = upperName(row.note_name);
    const hasMarker = String(row.body_text || '').includes(GARBAGE_V1_MARKER);
    const isSampleName = name === 'SAMPLE NOTE1' || name === 'SAMPLE NOTE2';
    if (!isSampleName && !hasMarker) continue;
    if (!hasMarker && !(await noteLooksLikeGarbageV1(db, row))) continue;
    await softDeleteNoteRows(db, row.note_id);
    touchedNotebooks.add(Number(row.notebook_id));
    removed += 1;
  }

  for (const notebookId of touchedNotebooks) {
    const left = await db.one(
      `SELECT COUNT(*)::int AS c FROM ${T.notes} WHERE singles_id = $1 AND notebook_id = $2 AND deleted_at IS NULL`,
      [sid, notebookId]
    );
    if (Number(left?.c || 0) > 0) continue;
    const nb = await db.one(
      `SELECT notebook_name FROM ${T.notebooks} WHERE singles_id = $1 AND notebook_id = $2 AND deleted_at IS NULL`,
      [sid, notebookId]
    );
    const nbName = upperName(nb?.notebook_name);
    if (nbName === 'SAMPLE NOTEBOOK' || nbName === 'SAMPLE NOTEBOOK 1') {
      await softDeleteNotebookRow(db, notebookId);
    }
  }
  return removed;
}

/** Point existing dm1-checksum attachments at shared_content_key (no byte copy). */
async function relinkCanonicalAttachmentsToSharedKeys(db) {
  const byChecksum = new Map();
  for (const att of listRecordVaultSampleAttachmentDefs()) {
    const sum = String(att.checksum || '')
      .trim()
      .toLowerCase();
    if (sum) byChecksum.set(sum, String(att.sharedKey || '').trim());
  }
  if (!byChecksum.size) return 0;
  const rows = await db.all(
    `SELECT attachment_id, checksum, shared_content_key FROM ${T.attachments}
      WHERE singles_id = $1 AND deleted_at IS NULL`,
    [db.singlesId]
  );
  let updated = 0;
  for (const row of rows) {
    const key = byChecksum.get(
      String(row.checksum || '')
        .trim()
        .toLowerCase()
    );
    if (!key) continue;
    if (String(row.shared_content_key || '').trim() === key) continue;
    await db.run(
      `UPDATE ${T.attachments} SET shared_content_key = $3 WHERE singles_id = $1 AND attachment_id = $2`,
      [db.singlesId, row.attachment_id, key]
    );
    updated += 1;
  }
  return updated;
}

/**
 * Demo attachments seeded before the demoOnly_ rename keep their old display name
 * (e.g. f1040.pdf). Rename them to the manifest name (demoOnly_f1040.pdf) — only rows that
 * still carry the demo shared_content_key AND the untouched legacy name.
 * @returns {Promise<number>} rows renamed
 */
async function renameLegacySampleAttachmentNames(db) {
  let renamed = 0;
  for (const att of listRecordVaultSampleAttachmentDefs()) {
    const key = String(att.sharedKey || '').trim();
    const legacy = String(att.legacyFileName || '').trim();
    const next = String(att.fileName || '').trim();
    if (!key || !legacy || !next || legacy === next) continue;
    const res = await db.run(
      `UPDATE ${T.attachments} SET file_name = $4
        WHERE singles_id = $1 AND shared_content_key = $2 AND file_name = $3 AND deleted_at IS NULL`,
      [db.singlesId, key, legacy, next]
    );
    renamed += Number(res) || 0; // VaultPgDb.run returns rowCount
  }
  return renamed;
}

/** True when a live note row is the bundled default sample (safe to refresh body from manifest). */
function isBundledDefaultSampleNoteRow(row, noteDef) {
  const body = String(row?.body_text || '');
  const noteKey = String(noteDef?.noteKey || '').trim();
  if (body.includes('rv-new-member-sample-v3')) return true;
  if (body.includes('rv-new-member-sample-v4')) return true;
  if (body.includes('rv-new-member-sample-v5')) return true;
  if (noteKey && body.includes(`note=${noteKey}`)) return true;
  const name = upperName(noteDef?.noteName);
  if (name === 'SAMPLE RECEIPTS') {
    return (
      body.includes('search for') ||
      body.includes('Flexible Organization') ||
      body.includes('Costco Grocery') ||
      body.includes('Home Depo') ||
      body.includes('Best Buy')
    );
  }
  if (name === 'SAMPLE VARIOUS FORMATS') return body.includes('Formats the code can');
  if (name === '2025 TAX') return body.includes('2025') && body.includes('1040');
  if (name === '2024 TAX') return body.includes('2024') && body.includes('1040');
  return false;
}

/**
 * Refresh bundled default sample note bodies + search_text from manifest HTML
 * (e.g. receipt label copy fixes) without touching member-edited notes.
 * @returns {Promise<number>} notes updated
 */
async function upgradeCanonicalSampleNoteBodies(db) {
  let updated = 0;
  for (const noteDef of listRecordVaultSampleNoteDefs()) {
    const row = await findLiveNoteByName(db, noteDef.noteName);
    if (!row || !isBundledDefaultSampleNoteRow(row, noteDef)) continue;
    const canonicalBody = loadRecordVaultSampleNoteBodyHtml(noteDef.bodyHtmlFile);
    if (!canonicalBody || canonicalBody === String(row.body_text || '')) continue;
    const attachments = await db.all(
      `SELECT file_name FROM ${T.attachments}
        WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL ORDER BY display_order`,
      [db.singlesId, row.note_id]
    );
    const searchText = buildSearchText(
      noteDef.noteName,
      canonicalBody,
      attachments.map((a) => ({ fileName: a.file_name }))
    );
    await db.run(
      `UPDATE ${T.notes} SET body_text = $3, search_text = $4, updated_at = NOW()
        WHERE singles_id = $1 AND note_id = $2`,
      [db.singlesId, row.note_id, canonicalBody, searchText]
    );
    updated += 1;
  }
  return updated;
}

/** Inside db.tx(). Keeps the manifest attachment id when it is free for this member. */
async function insertSampleAttachments(tx, { notebookId, noteId, attachments }) {
  for (const [index, att] of (attachments || []).entries()) {
    const preferredId = Number(att.attachmentId);
    const preferredFree =
      Number.isFinite(preferredId) &&
      preferredId >= 1 &&
      !(await tx.one(`SELECT 1 AS ok FROM ${T.attachments} WHERE singles_id = $1 AND attachment_id = $2`, [
        tx.singlesId,
        preferredId
      ]));
    const attachmentId = preferredFree ? preferredId : await tx.nextId('attachments');
    const ext = String(att.fileExtension || 'bin').replace(/^\./, '').toLowerCase();
    await tx.run(
      `INSERT INTO ${T.attachments} (
         singles_id, attachment_id, note_id, file_name, file_extension, relative_path,
         file_size_bytes, checksum, mime_type, display_order, shared_content_key
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        tx.singlesId,
        attachmentId,
        noteId,
        att.fileName,
        ext,
        fileRelativePath(notebookId, noteId, attachmentId, ext),
        Number(att.fileSizeBytes) || 0,
        att.checksum || null,
        att.mimeType || null,
        index,
        String(att.sharedKey || '').trim() || null
      ]
    );
  }
}

/** Inside db.tx(). */
async function insertSampleNote(tx, { notebookId, noteDef }) {
  const bodyHtml = loadRecordVaultSampleNoteBodyHtml(noteDef.bodyHtmlFile);
  const attachments = Array.isArray(noteDef.attachments) ? noteDef.attachments : [];
  const noteName = String(noteDef.noteName || 'SAMPLE NOTE').trim() || 'SAMPLE NOTE';
  const noteId = await tx.nextId('notes');
  await tx.run(
    `INSERT INTO ${T.notes} (singles_id, note_id, notebook_id, note_name, body_text, display_order, search_text)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      tx.singlesId,
      noteId,
      notebookId,
      noteName,
      bodyHtml,
      Number(noteDef.displayOrder) || 0,
      buildSearchText(noteName, bodyHtml, attachments)
    ]
  );
  await insertSampleAttachments(tx, { notebookId, noteId, attachments });
  if (noteDef.shortcut) {
    const orderRow = await tx.one(
      `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM ${T.shortcuts} WHERE singles_id = $1`,
      [tx.singlesId]
    );
    const shortcutId = await tx.nextId('shortcuts');
    await tx.run(
      `INSERT INTO ${T.shortcuts} (singles_id, shortcut_id, target_type, notebook_id, note_id, display_order)
       VALUES ($1, $2, 'note', $3, $4, $5)`,
      [tx.singlesId, shortcutId, notebookId, noteId, Number(orderRow?.next_order ?? 0)]
    );
  }
  return noteId;
}

/** Inside db.tx(). */
async function seedSampleNotebooksIntoDb(tx, { onlyWhenEmpty = false } = {}) {
  const sid = tx.singlesId;
  if (onlyWhenEmpty) {
    const countRow = await tx.one(
      `SELECT COUNT(*)::int AS c FROM ${T.notebooks} WHERE singles_id = $1 AND deleted_at IS NULL`,
      [sid]
    );
    if (Number(countRow?.c ?? 0) > 0) return false;
  }
  // Never recreate sample notebooks/notes the member already soft-deleted.
  if (await userRemovedNewMemberSample(tx)) return false;

  const manifest = loadRecordVaultNewMemberSampleManifest();
  let insertedAny = false;

  for (const nbDef of listRecordVaultSampleNotebooks(manifest)) {
    const notebookName = String(nbDef.notebookName || '').trim();
    if (!notebookName) continue;

    // Soft-deleted SAMPLE notebook = user removed it; do not insert a new one.
    if (await findSoftDeletedNotebookByName(tx, notebookName)) continue;

    const notebookRow = await tx.one(
      `SELECT notebook_id FROM ${T.notebooks}
        WHERE singles_id = $1 AND deleted_at IS NULL AND upper(trim(notebook_name)) = $2
        ORDER BY notebook_id ASC LIMIT 1`,
      [sid, upperName(notebookName)]
    );
    let notebookId = notebookRow ? Number(notebookRow.notebook_id) : null;
    if (!notebookId) {
      const orderRow = await tx.one(
        `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order
           FROM ${T.notebooks} WHERE singles_id = $1 AND deleted_at IS NULL`,
        [sid]
      );
      notebookId = await tx.nextId('notebooks');
      await tx.run(
        `INSERT INTO ${T.notebooks} (singles_id, notebook_id, notebook_name, display_order) VALUES ($1, $2, $3, $4)`,
        [sid, notebookId, notebookName, Number(nbDef.displayOrder ?? orderRow?.next_order ?? 0)]
      );
      insertedAny = true;
    }

    for (const noteDef of nbDef.notes || []) {
      const noteName = String(noteDef.noteName || '').trim();
      if (!noteName) continue;
      // Soft-deleted sample note = user removed it; do not recreate.
      if (await findSoftDeletedNoteByName(tx, noteName)) continue;
      const existing = await findLiveNoteByName(tx, noteName);
      if (existing) {
        if (!(await noteLooksLikeGarbageV1(tx, existing))) continue;
        await softDeleteNoteRows(tx, existing.note_id);
      }
      await insertSampleNote(tx, { notebookId, noteDef });
      insertedAny = true;
    }
  }
  await relinkCanonicalAttachmentsToSharedKeys(tx);
  return insertedAny;
}

/**
 * Fresh empty vault: SAMPLE MISC + SAMPLE TAX RECORDS and four sample notes (shared attachment pointers).
 * @param {import('../recordVaultUsb/vaultPgStore.js').VaultPgDb} db
 * @returns {Promise<boolean>} true when seed rows were inserted
 */
export async function seedRecordVaultNewMemberSampleDb(db) {
  return db.tx((tx) => seedSampleNotebooksIntoDb(tx, { onlyWhenEmpty: true }));
}

/**
 * Existing vaults: purge garbage v1 placeholders / legacy sets.
 * Registration SAMPLE MISC + SAMPLE TAX RECORDS are seeded once (empty vault only).
 * Soft-deleted or previously seeded (meta / hard-deleted) samples are never recreated.
 * @param {import('../recordVaultUsb/vaultPgStore.js').VaultPgDb} db
 * @param {{ allowSeed?: boolean }} [options] allowSeed=false when vault.meta already marked seeded
 * @returns {Promise<'inserted'|'present'|'upgraded'|'skipped'>}
 */
export async function ensureRecordVaultNewMemberSampleDb(db, { allowSeed = true } = {}) {
  return db.tx(async (tx) => {
    const purgedLegacyNb1 = await purgeLegacyDefaultNotebook1(tx);
    const purgedV2 = await purgeLegacyV2SampleSet(tx);
    const purgedOrphans = await purgeOrphanedLegacySampleNotes(tx);
    const purged = await purgeGarbageRecordVaultV1SampleNotes(tx);
    const relinked = await relinkCanonicalAttachmentsToSharedKeys(tx);
    const renamedDemo = await renameLegacySampleAttachmentNames(tx);
    const bodiesSynced = await upgradeCanonicalSampleNoteBodies(tx);
    const purgedAny = purgedLegacyNb1 > 0 || purgedV2 > 0 || purgedOrphans > 0 || purged > 0;
    const changedMeta = purgedAny || relinked > 0 || renamedDemo > 0 || bodiesSynced > 0;
    const unchanged = changedMeta ? 'upgraded' : 'present';

    if (await vaultAlreadyHasNewMemberSample(tx)) return unchanged;
    // Member already deleted the registration samples — leave them gone.
    if (await userRemovedNewMemberSample(tx)) return unchanged;
    // Meta stamp / prior seed — do not recreate after hard delete.
    if (!allowSeed) return unchanged;

    const notebookCount = Number(
      (
        await tx.one(
          `SELECT COUNT(*)::int AS c FROM ${T.notebooks} WHERE singles_id = $1 AND deleted_at IS NULL`,
          [tx.singlesId]
        )
      )?.c ?? 0
    );
    // Seed only into a truly empty vault (first open / new registration).
    if (notebookCount !== 0) return unchanged;
    const seeded = await seedSampleNotebooksIntoDb(tx, { onlyWhenEmpty: true });
    if (!seeded) return changedMeta ? 'upgraded' : 'skipped';
    return purgedAny ? 'upgraded' : 'inserted';
  });
}

export { canonicalChecksumSet };
