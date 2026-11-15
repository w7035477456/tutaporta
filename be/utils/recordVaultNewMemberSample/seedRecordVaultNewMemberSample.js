import { fileRelativePath } from '../recordVaultUsb/vaultPaths.js';
import { NOTES_VAULT_TABLES as T } from '../recordVaultUsb/vaultPgStore.js';
import {
  loadRecordVaultNewMemberSampleManifest,
  loadRecordVaultSampleNoteBodyHtml,
  listRecordVaultSampleAttachmentDefs,
  listRecordVaultSampleNotebooks,
  listRecordVaultSampleNoteDefs
} from './sampleManifest.js';
import {
  linkRecordVaultSharedSamplesIntoVault,
  recordVaultNewMemberSampleSeedMarker
} from './sharedSampleMedia.js';

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

/** No-op: shared_content_key exists in Postgres notes_note_attachments. */
export function ensureRecordVaultSharedContentKeyColumn(_db) {
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
    if (garbageHits > 0 && garbageHits === atts.length) return true;
  }
  if (noteLooksLikeCanonicalSample(body)) return false;
  if (body.includes(GARBAGE_V1_MARKER)) return true;
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

async function findLiveNoteByName(db, noteName) {
  const name = String(noteName || '')
    .trim()
    .toUpperCase();
  if (!name) return null;
  return db.one(
    `SELECT note_id, note_name, body_text, notebook_id FROM ${T.notes}
      WHERE singles_id = $1 AND deleted_at IS NULL AND upper(trim(note_name)) = $2
      ORDER BY note_id ASC LIMIT 1`,
    [db.singlesId, name]
  );
}

async function findSoftDeletedNotebookByName(db, notebookName) {
  const name = String(notebookName || '')
    .trim()
    .toUpperCase();
  if (!name) return null;
  return db.one(
    `SELECT notebook_id, notebook_name, deleted_at FROM ${T.notebooks}
      WHERE singles_id = $1 AND deleted_at IS NOT NULL AND upper(trim(notebook_name)) = $2
      ORDER BY notebook_id ASC LIMIT 1`,
    [db.singlesId, name]
  );
}

async function findSoftDeletedNoteByName(db, noteName) {
  const name = String(noteName || '')
    .trim()
    .toUpperCase();
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
    const noteName = String(noteDef.noteName || '').trim();
    const row = await findLiveNoteByName(db, noteName);
    if (!row) return false;
    if (await noteLooksLikeGarbageV1(db, row)) return false;
    const body = String(row.body_text || '');
    if (!noteLooksLikeCanonicalSample(body) && !body.includes(marker)) return false;
    if (!(await noteHasCanonicalDm1Attachments(db, row.note_id, noteDef.attachments || []))) return false;
  }
  return noteDefs.length > 0;
}

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

function isLegacyDefaultNotebook1Name(notebookName) {
  return (
    String(notebookName || '')
      .trim()
      .toUpperCase() === 'NOTEBOOK 1'
  );
}

export async function purgeLegacyDefaultNotebook1(db) {
  const rows = await db.all(
    `SELECT notebook_id, notebook_name FROM ${T.notebooks}
      WHERE singles_id = $1 AND deleted_at IS NULL`,
    [db.singlesId]
  );
  let removed = 0;
  for (const row of rows) {
    if (!isLegacyDefaultNotebook1Name(row.notebook_name)) continue;
    const notebookId = Number(row.notebook_id);
    const notes = await db.all(
      `SELECT note_id FROM ${T.notes}
        WHERE singles_id = $1 AND notebook_id = $2 AND deleted_at IS NULL`,
      [db.singlesId, notebookId]
    );
    for (const note of notes) {
      await db.run(
        `UPDATE ${T.attachments} SET deleted_at = NOW()
          WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL`,
        [db.singlesId, note.note_id]
      );
      await db.run(`DELETE FROM ${T.shortcuts} WHERE singles_id = $1 AND note_id = $2`, [
        db.singlesId,
        note.note_id
      ]);
      await db.run(
        `UPDATE ${T.notes} SET deleted_at = NOW(), updated_at = NOW()
          WHERE singles_id = $1 AND note_id = $2`,
        [db.singlesId, note.note_id]
      );
    }
    await db.run(`DELETE FROM ${T.shortcuts} WHERE singles_id = $1 AND notebook_id = $2`, [
      db.singlesId,
      notebookId
    ]);
    await db.run(
      `UPDATE ${T.notebooks} SET deleted_at = NOW(), updated_at = NOW()
        WHERE singles_id = $1 AND notebook_id = $2`,
      [db.singlesId, notebookId]
    );
    removed += 1;
  }
  return removed;
}

export async function purgeLegacyV2SampleSet(db) {
  const rows = await db.all(
    `SELECT notebook_id, notebook_name FROM ${T.notebooks}
      WHERE singles_id = $1 AND deleted_at IS NULL`,
    [db.singlesId]
  );
  let removed = 0;
  for (const row of rows) {
    const nbName = String(row.notebook_name || '')
      .trim()
      .toUpperCase();
    if (!LEGACY_V2_NOTEBOOK_NAMES.has(nbName)) continue;
    const notebookId = Number(row.notebook_id);
    const notes = await db.all(
      `SELECT note_id, note_name, body_text FROM ${T.notes}
        WHERE singles_id = $1 AND notebook_id = $2 AND deleted_at IS NULL`,
      [db.singlesId, notebookId]
    );
    if (!notes.length) continue;
    const allLegacyNotes = notes.every((n) => {
      const name = String(n.note_name || '')
        .trim()
        .toUpperCase();
      return LEGACY_V2_NOTE_NAMES.has(name) || String(n.body_text || '').includes(GARBAGE_V2_MARKER);
    });
    if (!allLegacyNotes) continue;
    for (const note of notes) {
      await db.run(
        `UPDATE ${T.attachments} SET deleted_at = NOW()
          WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL`,
        [db.singlesId, note.note_id]
      );
      await db.run(`DELETE FROM ${T.shortcuts} WHERE singles_id = $1 AND note_id = $2`, [
        db.singlesId,
        note.note_id
      ]);
      await db.run(
        `UPDATE ${T.notes} SET deleted_at = NOW(), updated_at = NOW()
          WHERE singles_id = $1 AND note_id = $2`,
        [db.singlesId, note.note_id]
      );
    }
    await db.run(`DELETE FROM ${T.shortcuts} WHERE singles_id = $1 AND notebook_id = $2`, [
      db.singlesId,
      notebookId
    ]);
    await db.run(
      `UPDATE ${T.notebooks} SET deleted_at = NOW(), updated_at = NOW()
        WHERE singles_id = $1 AND notebook_id = $2`,
      [db.singlesId, notebookId]
    );
    removed += 1;
  }
  return removed;
}

async function purgeOrphanedLegacySampleNotes(db) {
  const rows = await db.all(
    `SELECT n.note_id, n.note_name, n.notebook_id
       FROM ${T.notes} n
       INNER JOIN ${T.notebooks} nb
         ON nb.singles_id = n.singles_id AND nb.notebook_id = n.notebook_id
      WHERE n.singles_id = $1 AND n.deleted_at IS NULL AND nb.deleted_at IS NOT NULL`,
    [db.singlesId]
  );
  let removed = 0;
  for (const row of rows) {
    const name = String(row.note_name || '')
      .trim()
      .toUpperCase();
    if (!LEGACY_V2_NOTE_NAMES.has(name)) continue;
    await db.run(
      `UPDATE ${T.attachments} SET deleted_at = NOW()
        WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL`,
      [db.singlesId, row.note_id]
    );
    await db.run(`DELETE FROM ${T.shortcuts} WHERE singles_id = $1 AND note_id = $2`, [
      db.singlesId,
      row.note_id
    ]);
    await db.run(
      `UPDATE ${T.notes} SET deleted_at = NOW(), updated_at = NOW()
        WHERE singles_id = $1 AND note_id = $2`,
      [db.singlesId, row.note_id]
    );
    removed += 1;
  }
  return removed;
}

export async function purgeGarbageRecordVaultV1SampleNotes(db) {
  const rows = await db.all(
    `SELECT note_id, notebook_id, note_name, body_text FROM ${T.notes}
      WHERE singles_id = $1 AND deleted_at IS NULL`,
    [db.singlesId]
  );
  let removed = 0;
  const touchedNotebooks = new Set();
  for (const row of rows) {
    const name = String(row.note_name || '')
      .trim()
      .toUpperCase();
    const isSampleName = name === 'SAMPLE NOTE1' || name === 'SAMPLE NOTE2';
    if (!isSampleName && !String(row.body_text || '').includes(GARBAGE_V1_MARKER)) continue;
    if (!(await noteLooksLikeGarbageV1(db, row)) && !String(row.body_text || '').includes(GARBAGE_V1_MARKER)) {
      continue;
    }
    await db.run(
      `UPDATE ${T.attachments} SET deleted_at = NOW()
        WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL`,
      [db.singlesId, row.note_id]
    );
    await db.run(`DELETE FROM ${T.shortcuts} WHERE singles_id = $1 AND note_id = $2`, [
      db.singlesId,
      row.note_id
    ]);
    await db.run(
      `UPDATE ${T.notes} SET deleted_at = NOW(), updated_at = NOW()
        WHERE singles_id = $1 AND note_id = $2`,
      [db.singlesId, row.note_id]
    );
    touchedNotebooks.add(Number(row.notebook_id));
    removed += 1;
  }

  for (const notebookId of touchedNotebooks) {
    const left = await db.one(
      `SELECT COUNT(*)::int AS c FROM ${T.notes}
        WHERE singles_id = $1 AND notebook_id = $2 AND deleted_at IS NULL`,
      [db.singlesId, notebookId]
    );
    if (Number(left?.c || 0) > 0) continue;
    const nb = await db.one(
      `SELECT notebook_name FROM ${T.notebooks}
        WHERE singles_id = $1 AND notebook_id = $2 AND deleted_at IS NULL`,
      [db.singlesId, notebookId]
    );
    const nbName = String(nb?.notebook_name || '')
      .trim()
      .toUpperCase();
    if (nbName === 'SAMPLE NOTEBOOK' || nbName === 'SAMPLE NOTEBOOK 1') {
      await db.run(`DELETE FROM ${T.shortcuts} WHERE singles_id = $1 AND notebook_id = $2`, [
        db.singlesId,
        notebookId
      ]);
      await db.run(
        `UPDATE ${T.notebooks} SET deleted_at = NOW(), updated_at = NOW()
          WHERE singles_id = $1 AND notebook_id = $2`,
        [db.singlesId, notebookId]
      );
    }
  }
  return removed;
}

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
    const sum = String(row.checksum || '')
      .trim()
      .toLowerCase();
    const key = byChecksum.get(sum);
    if (!key) continue;
    if (String(row.shared_content_key || '').trim() === key) continue;
    await db.run(
      `UPDATE ${T.attachments} SET shared_content_key = $3
        WHERE singles_id = $1 AND attachment_id = $2`,
      [db.singlesId, row.attachment_id, key]
    );
    updated += 1;
  }
  return updated;
}

function isBundledDefaultSampleNoteRow(row, noteDef) {
  const body = String(row?.body_text || '');
  const noteKey = String(noteDef?.noteKey || '').trim();
  if (body.includes('rv-new-member-sample-v3')) return true;
  if (body.includes('rv-new-member-sample-v4')) return true;
  if (body.includes('rv-new-member-sample-v5')) return true;
  if (noteKey && body.includes(`note=${noteKey}`)) return true;
  const name = String(noteDef?.noteName || '')
    .trim()
    .toUpperCase();
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

async function upgradeCanonicalSampleNoteBodies(db) {
  let updated = 0;
  for (const noteDef of listRecordVaultSampleNoteDefs()) {
    const row = await findLiveNoteByName(db, noteDef.noteName);
    if (!row || !isBundledDefaultSampleNoteRow(row, noteDef)) continue;
    const canonicalBody = loadRecordVaultSampleNoteBodyHtml(noteDef.bodyHtmlFile);
    if (!canonicalBody || canonicalBody === String(row.body_text || '')) continue;
    const attachments = await db.all(
      `SELECT file_name FROM ${T.attachments}
        WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL
        ORDER BY display_order`,
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

async function insertSampleAttachments(db, { notebookId, noteId, attachments }) {
  for (let index = 0; index < (attachments || []).length; index += 1) {
    const att = attachments[index];
    const preferredId = Number(att.attachmentId);
    let attachmentId;
    if (Number.isFinite(preferredId) && preferredId >= 1) {
      const taken = await db.one(
        `SELECT attachment_id FROM ${T.attachments}
          WHERE singles_id = $1 AND attachment_id = $2`,
        [db.singlesId, preferredId]
      );
      attachmentId = taken ? await db.nextId('attachments') : preferredId;
    } else {
      attachmentId = await db.nextId('attachments');
    }
    const ext = String(att.fileExtension || 'bin').replace(/^\./, '').toLowerCase();
    const relativePath = fileRelativePath(notebookId, noteId, attachmentId, ext);
    const sharedKey = String(att.sharedKey || '').trim() || null;
    await db.run(
      `INSERT INTO ${T.attachments} (
         singles_id, attachment_id, note_id, file_name, file_extension, relative_path,
         file_size_bytes, checksum, mime_type, display_order, shared_content_key
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        db.singlesId,
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
  }
}

async function insertSampleNote(db, { notebookId, noteDef }) {
  const bodyHtml = loadRecordVaultSampleNoteBodyHtml(noteDef.bodyHtmlFile);
  const attachments = Array.isArray(noteDef.attachments) ? noteDef.attachments : [];
  const noteName = String(noteDef.noteName || 'SAMPLE NOTE').trim() || 'SAMPLE NOTE';
  const searchText = buildSearchText(noteName, bodyHtml, attachments);
  const noteId = await db.nextId('notes');
  await db.run(
    `INSERT INTO ${T.notes} (singles_id, note_id, notebook_id, note_name, body_text, display_order, search_text)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [db.singlesId, noteId, notebookId, noteName, bodyHtml, Number(noteDef.displayOrder) || 0, searchText]
  );
  await insertSampleAttachments(db, { notebookId, noteId, attachments });
  if (noteDef.shortcut) {
    const orderRow = await db.one(
      `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM ${T.shortcuts}
        WHERE singles_id = $1`,
      [db.singlesId]
    );
    const shortcutId = await db.nextId('shortcuts');
    await db.run(
      `INSERT INTO ${T.shortcuts} (singles_id, shortcut_id, target_type, notebook_id, note_id, display_order)
       VALUES ($1, $2, 'note', $3, $4, $5)`,
      [db.singlesId, shortcutId, notebookId, noteId, Number(orderRow?.next_order ?? 0)]
    );
  }
  return noteId;
}

async function seedSampleNotebooksIntoDb(db, { onlyWhenEmpty = false } = {}) {
  if (onlyWhenEmpty) {
    const countRow = await db.one(
      `SELECT COUNT(*)::int AS c FROM ${T.notebooks} WHERE singles_id = $1 AND deleted_at IS NULL`,
      [db.singlesId]
    );
    if (Number(countRow?.c ?? 0) > 0) return false;
  }
  if (await userRemovedNewMemberSample(db)) return false;

  const manifest = loadRecordVaultNewMemberSampleManifest();
  let insertedAny = false;

  for (const nbDef of listRecordVaultSampleNotebooks(manifest)) {
    const notebookName = String(nbDef.notebookName || '').trim();
    if (!notebookName) continue;
    if (await findSoftDeletedNotebookByName(db, notebookName)) continue;

    let notebookRow = await db.one(
      `SELECT notebook_id FROM ${T.notebooks}
        WHERE singles_id = $1 AND deleted_at IS NULL AND upper(trim(notebook_name)) = upper(trim($2))
        ORDER BY notebook_id ASC LIMIT 1`,
      [db.singlesId, notebookName]
    );
    let notebookId = notebookRow ? Number(notebookRow.notebook_id) : null;
    if (!notebookId) {
      const orderRow = await db.one(
        `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order
           FROM ${T.notebooks} WHERE singles_id = $1 AND deleted_at IS NULL`,
        [db.singlesId]
      );
      notebookId = await db.nextId('notebooks');
      await db.run(
        `INSERT INTO ${T.notebooks} (singles_id, notebook_id, notebook_name, display_order)
         VALUES ($1, $2, $3, $4)`,
        [db.singlesId, notebookId, notebookName, Number(nbDef.displayOrder ?? orderRow?.next_order ?? 0)]
      );
      insertedAny = true;
    }

    for (const noteDef of nbDef.notes || []) {
      const noteName = String(noteDef.noteName || '').trim();
      if (!noteName) continue;
      if (await findSoftDeletedNoteByName(db, noteName)) continue;
      const existing = await findLiveNoteByName(db, noteName);
      if (existing) {
        if (await noteLooksLikeGarbageV1(db, existing)) {
          await db.run(
            `UPDATE ${T.attachments} SET deleted_at = NOW()
              WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL`,
            [db.singlesId, existing.note_id]
          );
          await db.run(`DELETE FROM ${T.shortcuts} WHERE singles_id = $1 AND note_id = $2`, [
            db.singlesId,
            existing.note_id
          ]);
          await db.run(`UPDATE ${T.notes} SET deleted_at = NOW() WHERE singles_id = $1 AND note_id = $2`, [
            db.singlesId,
            existing.note_id
          ]);
        } else {
          continue;
        }
      }
      await insertSampleNote(db, { notebookId, noteDef });
      insertedAny = true;
    }
  }
  await relinkCanonicalAttachmentsToSharedKeys(db);
  return insertedAny;
}

/**
 * Fresh empty vault: sample notebooks/notes (shared attachment pointers).
 * Must run inside db.tx() so nextId works.
 */
export async function seedRecordVaultNewMemberSampleDb(db) {
  return db.tx ? db.tx((tx) => seedSampleNotebooksIntoDb(tx, { onlyWhenEmpty: true })) : seedSampleNotebooksIntoDb(db, { onlyWhenEmpty: true });
}

/**
 * Existing vaults: purge garbage / legacy sets; seed once into an empty vault.
 * @returns {Promise<'inserted'|'present'|'upgraded'|'skipped'>}
 */
export async function ensureRecordVaultNewMemberSampleDb(db, { allowSeed = true } = {}) {
  const run = async (tx) => {
    const purgedLegacyNb1 = await purgeLegacyDefaultNotebook1(tx);
    const purgedV2 = await purgeLegacyV2SampleSet(tx);
    const purgedOrphans = await purgeOrphanedLegacySampleNotes(tx);
    const purged = await purgeGarbageRecordVaultV1SampleNotes(tx);
    const relinked = await relinkCanonicalAttachmentsToSharedKeys(tx);
    const bodiesSynced = await upgradeCanonicalSampleNoteBodies(tx);
    const changedMeta =
      purgedLegacyNb1 > 0 ||
      purgedV2 > 0 ||
      purgedOrphans > 0 ||
      purged > 0 ||
      relinked > 0 ||
      bodiesSynced > 0;

    if (await vaultAlreadyHasNewMemberSample(tx)) {
      return changedMeta ? 'upgraded' : 'present';
    }
    if (await userRemovedNewMemberSample(tx)) {
      return changedMeta ? 'upgraded' : 'present';
    }
    if (!allowSeed) {
      return changedMeta ? 'upgraded' : 'present';
    }

    const notebookCount = Number(
      (
        await tx.one(
          `SELECT COUNT(*)::int AS c FROM ${T.notebooks} WHERE singles_id = $1 AND deleted_at IS NULL`,
          [tx.singlesId]
        )
      )?.c ?? 0
    );
    if (notebookCount === 0) {
      const seeded = await seedSampleNotebooksIntoDb(tx, { onlyWhenEmpty: true });
      if (!seeded) return changedMeta ? 'upgraded' : 'skipped';
      return purgedLegacyNb1 > 0 || purgedV2 > 0 || purgedOrphans > 0 || purged > 0 ? 'upgraded' : 'inserted';
    }
    return changedMeta ? 'upgraded' : 'present';
  };

  if (db.client) return run(db);
  return db.tx(run);
}

export async function seedRecordVaultNewMemberSampleMedia(args) {
  return linkRecordVaultSharedSamplesIntoVault(args);
}

export { canonicalChecksumSet };
