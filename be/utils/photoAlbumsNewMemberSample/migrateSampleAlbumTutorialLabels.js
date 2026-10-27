import { expandPhotoAlbumsBodyTextForSearch } from '../photoAlbumsSearch.js';
import { DEFAULT_SAMPLE_ALBUM_NAME } from '../photoAlbumsUsb/vaultSchema.js';
import { PHOTO_ALBUMS_VAULT_TABLES as T } from '../photoAlbumsUsb/vaultPgStore.js';
import { loadInitializeSampleManifest } from './initializeSampleManifest.js';

/** Matches vaultSession NOTE_INNER_ENCRYPT_BODY_PREFIX — avoid circular import. */
const NOTE_INNER_ENCRYPT_BODY_PREFIX = '\u2063RVI';

const SAMPLE_TUTORIAL_LABEL_MARKER_PREFIX = 'tl_sample_hint_';

async function refreshSampleAlbumSearchText(db, noteId, albumName, bodyHtml) {
  const kwRows = await db.all(
    `SELECT keyword FROM ${T.keywords} WHERE singles_id = $1 AND note_id = $2 ORDER BY keyword_normalized ASC`,
    [db.singlesId, noteId]
  );
  const attRows = await db.all(
    `SELECT file_name FROM ${T.attachments} WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL`,
    [db.singlesId, noteId]
  );
  const bodyForSearch = expandPhotoAlbumsBodyTextForSearch(bodyHtml);
  const searchText = [albumName, bodyForSearch, ...kwRows.map((r) => r.keyword), ...attRows.map((r) => r.file_name)]
    .map((p) => String(p ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ');
  await db.run(
    `UPDATE ${T.notes} SET search_text = $3, updated_at = NOW() WHERE singles_id = $1 AND note_id = $2`,
    [db.singlesId, noteId, searchText]
  );
}

const SAMPLE_TUTORIAL_LABEL_RE = /<div\b[^>]*\bdata-label-id="tl_sample_hint_[^"]*"[^>]*>[\s\S]*?<\/div>(?:<p><\/p>)?/g;

/** Remove the retired SAMPLE ALBUM hint labels ("Double me to edit photo", video hint). */
export function stripSampleAlbumTutorialLabels(bodyHtml) {
  return String(bodyHtml ?? '').replace(SAMPLE_TUTORIAL_LABEL_RE, '');
}

/**
 * Strip the retired tutorial hint labels from SAMPLE ALBUM. Safe no-op when
 * none are present or the body is inner-encrypted.
 *
 * @param {import('../photoAlbumsUsb/vaultPgStore.js').VaultPgDb} db
 * @returns {Promise<{ migrated: boolean, reason?: string, noteId?: number }>}
 */
export async function migrateSampleAlbumTutorialLabelsDb(db) {
  const manifest = loadInitializeSampleManifest();
  const albumName = manifest.albumName || DEFAULT_SAMPLE_ALBUM_NAME;

  const note = await db.one(
    `SELECT note_id, body_text, inner_encrypt_enabled
       FROM ${T.notes}
      WHERE singles_id = $1 AND note_name = $2 AND deleted_at IS NULL
      ORDER BY note_id ASC
      LIMIT 1`,
    [db.singlesId, albumName]
  );
  if (!note) {
    return { migrated: false, reason: 'no_sample_album' };
  }

  const noteId = Number(note.note_id);
  const body = String(note.body_text || '');
  if (Number(note.inner_encrypt_enabled) === 1 || body.startsWith(NOTE_INNER_ENCRYPT_BODY_PREFIX)) {
    return { migrated: false, reason: 'inner_encrypted', noteId };
  }
  if (!body.includes(SAMPLE_TUTORIAL_LABEL_MARKER_PREFIX)) {
    return { migrated: false, reason: 'no_tutorial_labels', noteId };
  }

  const bodyHtml = stripSampleAlbumTutorialLabels(body);
  if (bodyHtml === body) {
    return { migrated: false, reason: 'no_tutorial_labels', noteId };
  }
  await db.tx(async (tx) => {
    await tx.run(
      `UPDATE ${T.notes} SET body_text = $3, updated_at = NOW() WHERE singles_id = $1 AND note_id = $2`,
      [tx.singlesId, noteId, bodyHtml]
    );
    await refreshSampleAlbumSearchText(tx, noteId, albumName, bodyHtml);
  });
  return { migrated: true, noteId };
}
