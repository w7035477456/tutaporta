import { fileRelativePath } from '../photoAlbumsUsb/vaultPaths.js';
import {
  DEFAULT_SAMPLE_ALBUM_NAME,
  DEFAULT_SAMPLE_NOTEBOOK_NAME
} from '../photoAlbumsUsb/vaultSchema.js';
import { PHOTO_ALBUMS_VAULT_TABLES as T } from '../photoAlbumsUsb/vaultPgStore.js';
import { linkInitializeSampleIntoVault } from './initializeSampleMedia.js';
import {
  loadInitializeSampleManifest,
  loadSampleAlbumBodyHtml
} from './initializeSampleManifest.js';

export { loadInitializeSampleManifest, loadSampleAlbumBodyHtml } from './initializeSampleManifest.js';

/**
 * Highest bundled sample attachment id. Member uploads are numbered above it, so
 * Restore Sample Album can always put the template photos back under their own ids.
 */
export function sampleAttachmentIdFloor() {
  const manifest = loadInitializeSampleManifest();
  return (manifest.attachments || []).reduce(
    (max, att, index) => Math.max(max, Number(att.attachmentId) || index + 1),
    0
  );
}

async function softDeleteAttachment(db, attachmentId) {
  await db.run(
    `UPDATE ${T.attachments} SET deleted_at = NOW() WHERE singles_id = $1 AND attachment_id = $2`,
    [db.singlesId, attachmentId]
  );
}

/** Template photos marked `deleted` in manifest.json are seeded soft-deleted (as in the source vault). */
function isTemplateDeleted(att) {
  return att?.deleted === true;
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

function decodeHtmlAttribute(value) {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function encodeHtmlAttribute(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/**
 * Point the album page layout (data-album-templates: attachmentIds + photoViews keys) at the
 * vault ids the template photos were restored under.
 */
export function remapSampleAlbumBodyAttachmentIds(bodyHtml, attachmentIdMap) {
  const html = String(bodyHtml ?? '');
  if (!attachmentIdMap?.size) return html;
  const mapId = (id) => Number(attachmentIdMap.get(Number(id)) ?? id);
  return html.replace(/data-album-templates="([^"]*)"/, (whole, encoded) => {
    let pages;
    try {
      pages = JSON.parse(decodeHtmlAttribute(encoded));
    } catch {
      return whole;
    }
    if (!Array.isArray(pages)) return whole;
    for (const page of pages) {
      if (Array.isArray(page?.attachmentIds)) page.attachmentIds = page.attachmentIds.map(mapId);
      if (page?.photoViews && typeof page.photoViews === 'object') {
        page.photoViews = Object.fromEntries(
          Object.entries(page.photoViews).map(([id, view]) => [String(mapId(id)), view])
        );
      }
    }
    return `data-album-templates="${encodeHtmlAttribute(JSON.stringify(pages))}"`;
  });
}

function sampleAttachmentValues(att, index, notebookId, noteId, attachmentId = null) {
  const id = Number(attachmentId) || Number(att.attachmentId) || index + 1;
  const albumPhotoSeq = Number(att.albumPhotoSeq) || Number(att.attachmentId) || index + 1;
  const ext = String(att.fileExtension || 'bin').replace(/^\./, '').toLowerCase();
  return {
    attachmentId: id,
    row: {
      note_id: noteId,
      file_name: att.fileName,
      file_extension: ext,
      relative_path: fileRelativePath(notebookId, noteId, id, ext, albumPhotoSeq),
      file_size_bytes: Number(att.fileSizeBytes) || 0,
      checksum: att.checksum || null,
      mime_type: att.mimeType || null,
      display_order: index,
      source_taken_at_ms: Number(att.sourceTakenAtMs) || null,
      album_photo_seq: albumPhotoSeq
    }
  };
}

const ATTACHMENT_VALUE_COLUMNS = [
  'note_id',
  'file_name',
  'file_extension',
  'relative_path',
  'file_size_bytes',
  'checksum',
  'mime_type',
  'display_order',
  'source_taken_at_ms',
  'album_photo_seq'
];

/** Insert or overwrite (revive) one template attachment row under `attachmentId`. */
async function upsertSampleAttachment(db, attachmentId, row, { deleted = false } = {}) {
  const values = ATTACHMENT_VALUE_COLUMNS.map((col) => row[col]);
  await db.run(
    `INSERT INTO ${T.attachments} (
       singles_id, attachment_id, ${ATTACHMENT_VALUE_COLUMNS.join(', ')}, created_at, deleted_at
     ) VALUES ($1, $2, ${ATTACHMENT_VALUE_COLUMNS.map((_, i) => `$${i + 3}`).join(', ')}, NOW(),
               CASE WHEN $${ATTACHMENT_VALUE_COLUMNS.length + 3}::boolean THEN NOW() END)
     ON CONFLICT (singles_id, attachment_id) DO UPDATE SET
       ${ATTACHMENT_VALUE_COLUMNS.map((col) => `${col} = EXCLUDED.${col}`).join(', ')},
       created_at = NOW(),
       deleted_at = EXCLUDED.deleted_at`,
    [db.singlesId, attachmentId, ...values, Boolean(deleted)]
  );
}

/**
 * Postgres seed for a fresh TutaPhotoAlbums vault: SAMPLE SET + SAMPLE ALBUM + the template photos.
 * Attachment ids are the manifest ids (1…7) so sampleAlbumBody.html matches on first open.
 * No-op when the member already has a live album-set.
 * @param {import('../photoAlbumsUsb/vaultPgStore.js').VaultPgDb} db
 */
export async function seedPhotoAlbumsNewMemberSampleDb(db) {
  return db.tx(async (tx) => {
    const countRow = await tx.one(
      `SELECT COUNT(*)::int AS c FROM ${T.notebooks} WHERE singles_id = $1 AND deleted_at IS NULL`,
      [tx.singlesId]
    );
    if (Number(countRow?.c ?? 0) > 0) return false;

    const manifest = loadInitializeSampleManifest();
    const notebookName = manifest.notebookName || DEFAULT_SAMPLE_NOTEBOOK_NAME;
    const albumName = manifest.albumName || DEFAULT_SAMPLE_ALBUM_NAME;
    const bodyHtml = loadSampleAlbumBodyHtml();
    const attachments = Array.isArray(manifest.attachments) ? manifest.attachments : [];

    const notebookId = await tx.nextId('notebooks');
    await tx.run(
      `INSERT INTO ${T.notebooks} (singles_id, notebook_id, notebook_name, display_order) VALUES ($1, $2, $3, 0)`,
      [tx.singlesId, notebookId, notebookName]
    );

    const noteId = await tx.nextId('notes');
    await tx.run(
      `INSERT INTO ${T.notes} (singles_id, note_id, notebook_id, note_name, body_text, display_order, search_text)
       VALUES ($1, $2, $3, $4, $5, 0, $6)`,
      [tx.singlesId, noteId, notebookId, albumName, bodyHtml, buildSearchText(albumName, bodyHtml, attachments)]
    );

    for (const [index, att] of attachments.entries()) {
      const { attachmentId, row } = sampleAttachmentValues(att, index, notebookId, noteId);
      await upsertSampleAttachment(tx, attachmentId, row, { deleted: isTemplateDeleted(att) });
    }

    const shortcutId = await tx.nextId('shortcuts');
    await tx.run(
      `INSERT INTO ${T.shortcuts} (singles_id, shortcut_id, target_type, notebook_id, note_id, display_order)
       VALUES ($1, $2, 'note', $3, $4, 0)`,
      [tx.singlesId, shortcutId, notebookId, noteId]
    );
    return true;
  });
}

/**
 * "Restore Sample Album": reset SAMPLE SET / SAMPLE ALBUM to the bundled template (layout from
 * sampleAlbumBody.html + the manifest's photos) without touching the member's other albums.
 * Reuses an active SAMPLE SET / SAMPLE ALBUM by name (overwriting its layout), otherwise creates
 * them at the top of the list. Template photos keep their manifest ids (1…7) when free: a
 * soft-deleted or orphaned row with that id is revived into the sample album. When a live album
 * elsewhere still uses a manifest id (vaults from before ids were reserved), the template photo is
 * restored under a new id and the page layout is rewritten to match. Template photos marked
 * `deleted` and photos the member added are soft-deleted.
 * Returns { notebookId, noteId, restoredAttachmentIds, removedAttachmentIds, attachmentIdMap }.
 * @param {import('../photoAlbumsUsb/vaultPgStore.js').VaultPgDb} db
 */
export async function restorePhotoAlbumsSampleAlbumDb(db) {
  return db.tx(async (tx) => {
    const manifest = loadInitializeSampleManifest();
    const notebookName = manifest.notebookName || DEFAULT_SAMPLE_NOTEBOOK_NAME;
    const albumName = manifest.albumName || DEFAULT_SAMPLE_ALBUM_NAME;
    const attachments = Array.isArray(manifest.attachments) ? manifest.attachments : [];
    const sid = tx.singlesId;

    let notebookId = Number(
      (
        await tx.one(
          `SELECT notebook_id FROM ${T.notebooks}
            WHERE singles_id = $1 AND deleted_at IS NULL AND notebook_name = $2
            ORDER BY notebook_id LIMIT 1`,
          [sid, notebookName]
        )
      )?.notebook_id ?? 0
    );
    if (!notebookId) {
      const top = await tx.one(
        `SELECT MIN(display_order) AS m FROM ${T.notebooks} WHERE singles_id = $1 AND deleted_at IS NULL`,
        [sid]
      );
      const order = top?.m == null ? 0 : Number(top.m) - 1;
      notebookId = await tx.nextId('notebooks');
      await tx.run(
        `INSERT INTO ${T.notebooks} (singles_id, notebook_id, notebook_name, display_order) VALUES ($1, $2, $3, $4)`,
        [sid, notebookId, notebookName, order]
      );
    }

    let noteId = Number(
      (
        await tx.one(
          `SELECT note_id FROM ${T.notes}
            WHERE singles_id = $1 AND deleted_at IS NULL AND notebook_id = $2 AND note_name = $3
            ORDER BY note_id LIMIT 1`,
          [sid, notebookId, albumName]
        )
      )?.note_id ?? 0
    );
    if (!noteId) {
      const top = await tx.one(
        `SELECT MIN(display_order) AS m FROM ${T.notes}
          WHERE singles_id = $1 AND deleted_at IS NULL AND notebook_id = $2`,
        [sid, notebookId]
      );
      const order = top?.m == null ? 0 : Number(top.m) - 1;
      noteId = await tx.nextId('notes');
      await tx.run(
        `INSERT INTO ${T.notes} (singles_id, note_id, notebook_id, note_name, body_text, display_order)
         VALUES ($1, $2, $3, $4, '', $5)`,
        [sid, noteId, notebookId, albumName, order]
      );
    }

    const liveInAlbum = await tx.all(
      `SELECT attachment_id, file_name, checksum FROM ${T.attachments}
        WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL`,
      [sid, noteId]
    );
    const templateIds = new Set(attachments.map((att, index) => Number(att.attachmentId) || index + 1));
    const floor = sampleAttachmentIdFloor();
    const attachmentIdMap = new Map();
    const keepIds = new Set();
    const restoredAttachmentIds = [];
    const removedAttachmentIds = [];

    for (const [index, att] of attachments.entries()) {
      const manifestId = Number(att.attachmentId) || index + 1;
      const existing = await tx.one(
        `SELECT a.note_id, a.deleted_at, n.note_id AS live_note_id
           FROM ${T.attachments} a
           LEFT JOIN ${T.notes} n
             ON n.singles_id = a.singles_id AND n.note_id = a.note_id AND n.deleted_at IS NULL
          WHERE a.singles_id = $1 AND a.attachment_id = $2`,
        [sid, manifestId]
      );
      const isLive = Boolean(existing) && existing.deleted_at == null && existing.live_note_id != null;
      const inThisAlbum = isLive && Number(existing.note_id) === noteId;

      if (isTemplateDeleted(att)) {
        if (inThisAlbum) {
          await softDeleteAttachment(tx, manifestId);
          removedAttachmentIds.push(manifestId);
        }
        continue;
      }

      if (inThisAlbum) {
        keepIds.add(manifestId);
        await tx.run(
          `UPDATE ${T.attachments} SET display_order = $3 WHERE singles_id = $1 AND attachment_id = $2`,
          [sid, manifestId, index]
        );
        continue;
      }

      if (!isLive) {
        const { row } = sampleAttachmentValues(att, index, notebookId, noteId, manifestId);
        await upsertSampleAttachment(tx, manifestId, row);
        keepIds.add(manifestId);
        restoredAttachmentIds.push(manifestId);
        continue;
      }

      // Manifest id belongs to a live photo in another album: reuse an earlier relocated copy
      // already in SAMPLE ALBUM, otherwise restore the template photo under a fresh id.
      const relocated = liveInAlbum.find(
        (row) =>
          !templateIds.has(Number(row.attachment_id)) &&
          !keepIds.has(Number(row.attachment_id)) &&
          att.checksum &&
          row.checksum === att.checksum &&
          row.file_name === att.fileName
      );
      if (relocated) {
        const vaultId = Number(relocated.attachment_id);
        keepIds.add(vaultId);
        attachmentIdMap.set(manifestId, vaultId);
        await tx.run(
          `UPDATE ${T.attachments} SET display_order = $3 WHERE singles_id = $1 AND attachment_id = $2`,
          [sid, vaultId, index]
        );
        continue;
      }
      const vaultId = await tx.nextId('attachments', { floor });
      const { row } = sampleAttachmentValues(att, index, notebookId, noteId, vaultId);
      await upsertSampleAttachment(tx, vaultId, row);
      keepIds.add(vaultId);
      attachmentIdMap.set(manifestId, vaultId);
      restoredAttachmentIds.push(vaultId);
    }

    // Photos the member added to SAMPLE ALBUM are not part of the template.
    for (const row of liveInAlbum) {
      const attachmentId = Number(row.attachment_id);
      if (keepIds.has(attachmentId) || removedAttachmentIds.includes(attachmentId)) continue;
      await softDeleteAttachment(tx, attachmentId);
      removedAttachmentIds.push(attachmentId);
    }

    // Reset the SAMPLE ALBUM to the template layout (pages, photo edits, emojis, text).
    const bodyHtml = remapSampleAlbumBodyAttachmentIds(loadSampleAlbumBodyHtml(), attachmentIdMap);
    await tx.run(
      `UPDATE ${T.notes}
          SET body_text = $3, search_text = $4, inner_encrypt_enabled = 0, inner_pin_salt = NULL,
              updated_at = NOW()
        WHERE singles_id = $1 AND note_id = $2`,
      [sid, noteId, bodyHtml, buildSearchText(albumName, bodyHtml, attachments)]
    );

    const shortcut = await tx.one(
      `SELECT shortcut_id FROM ${T.shortcuts} WHERE singles_id = $1 AND target_type = 'note' AND note_id = $2`,
      [sid, noteId]
    );
    if (!shortcut) {
      const shortcutId = await tx.nextId('shortcuts');
      await tx.run(
        `INSERT INTO ${T.shortcuts} (singles_id, shortcut_id, target_type, notebook_id, note_id, display_order)
         VALUES ($1, $2, 'note', $3, $4, 0)`,
        [sid, shortcutId, notebookId, noteId]
      );
    }

    return {
      notebookId,
      noteId,
      restoredAttachmentIds,
      removedAttachmentIds,
      attachmentIdMap: [...attachmentIdMap.entries()]
    };
  });
}

/**
 * Link shared initializeSample media into a new vault (symlinks when plaintext; shared read otherwise).
 */
export async function seedPhotoAlbumsNewMemberSampleMedia({ mountPath, key, meta, db }) {
  const countRow = await db.one(
    `SELECT COUNT(*)::int AS c FROM ${T.attachments} WHERE singles_id = $1 AND deleted_at IS NULL`,
    [db.singlesId]
  );
  if (Number(countRow?.c ?? 0) < 1) return false;
  return linkInitializeSampleIntoVault({ mountPath, key, meta, db });
}
