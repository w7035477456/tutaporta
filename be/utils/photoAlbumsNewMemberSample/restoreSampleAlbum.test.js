import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import initSqlJs from 'sql.js';

import { VAULT_SCHEMA_SQL } from '../photoAlbumsUsb/vaultSchema.js';
import {
  loadInitializeSampleManifest,
  loadSampleAlbumBodyHtml,
  restorePhotoAlbumsSampleAlbumDb,
  seedPhotoAlbumsNewMemberSampleDb
} from './seedPhotoAlbumsNewMemberSample.js';

let SQL;

function freshDb() {
  const db = new SQL.Database();
  db.exec(VAULT_SCHEMA_SQL);
  return db;
}

function all(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

const sampleIds = () => loadInitializeSampleManifest().attachments.map((a) => Number(a.attachmentId));
const liveSampleIds = () =>
  loadInitializeSampleManifest()
    .attachments.filter((a) => a.deleted !== true)
    .map((a) => Number(a.attachmentId));
const liveIds = (db) =>
  all(db, `SELECT attachment_id FROM note_attachments WHERE deleted_at IS NULL ORDER BY attachment_id`).map((r) =>
    Number(r.attachment_id)
  );

describe('restorePhotoAlbumsSampleAlbumDb', () => {
  before(async () => {
    SQL = await initSqlJs();
  });

  it('is a no-op for an intact sample album', () => {
    const db = freshDb();
    seedPhotoAlbumsNewMemberSampleDb(db);
    const result = restorePhotoAlbumsSampleAlbumDb(db);
    assert.deepEqual(result.restoredAttachmentIds, []);
    assert.equal(all(db, `SELECT * FROM notebooks`).length, 1);
    assert.equal(all(db, `SELECT * FROM notes`).length, 1);
    assert.equal(all(db, `SELECT * FROM shortcuts`).length, 1);
  });

  it('revives sample photos removed with X All (soft-deleted rows)', () => {
    const db = freshDb();
    seedPhotoAlbumsNewMemberSampleDb(db);
    db.run(`UPDATE note_attachments SET deleted_at = datetime('now')`);
    const result = restorePhotoAlbumsSampleAlbumDb(db);
    assert.deepEqual(result.restoredAttachmentIds, liveSampleIds());
    const live = all(db, `SELECT note_id FROM note_attachments WHERE deleted_at IS NULL`);
    assert.equal(live.length, liveSampleIds().length);
    assert.ok(live.every((row) => Number(row.note_id) === result.noteId));
  });

  it('recreates SAMPLE SET / SAMPLE ALBUM after they were deleted, keeping other albums', () => {
    const db = freshDb();
    seedPhotoAlbumsNewMemberSampleDb(db);
    db.run(`INSERT INTO notebooks (notebook_name, display_order) VALUES ('MY SET', 1)`);
    const mySet = Number(all(db, `SELECT last_insert_rowid() AS id`)[0].id);
    db.run(`INSERT INTO notes (notebook_id, note_name, display_order) VALUES (?, 'MY ALBUM', 0)`, [mySet]);
    const myAlbum = Number(all(db, `SELECT last_insert_rowid() AS id`)[0].id);
    db.run(
      `INSERT INTO note_attachments (note_id, file_name, file_extension, relative_path)
       VALUES (?, 'mine.jpg', 'jpg', 'x/y/att_8_8.jpg')`,
      [myAlbum]
    );
    // Deleting the sample album hard-deletes its attachment rows; the set is soft-deleted.
    db.run(`DELETE FROM note_attachments WHERE note_id <> ?`, [myAlbum]);
    db.run(`DELETE FROM shortcuts`);
    db.run(`UPDATE notes SET deleted_at = datetime('now') WHERE note_id <> ?`, [myAlbum]);
    db.run(`UPDATE notebooks SET deleted_at = datetime('now') WHERE notebook_id <> ?`, [mySet]);

    const result = restorePhotoAlbumsSampleAlbumDb(db);
    assert.deepEqual(result.restoredAttachmentIds, liveSampleIds());
    assert.notEqual(result.notebookId, mySet);
    const sets = all(db, `SELECT notebook_name FROM notebooks WHERE deleted_at IS NULL ORDER BY display_order`);
    assert.deepEqual(
      sets.map((row) => row.notebook_name),
      [loadInitializeSampleManifest().notebookName || 'SAMPLE SET', 'MY SET']
    );
    const mine = all(db, `SELECT note_id FROM note_attachments WHERE file_name = 'mine.jpg'`);
    assert.equal(Number(mine[0].note_id), myAlbum);
    assert.equal(all(db, `SELECT * FROM shortcuts WHERE note_id = ?`, [result.noteId]).length, 1);
  });

  it('leaves a sample id alone when a live album elsewhere still uses it', () => {
    const db = freshDb();
    db.run(`INSERT INTO notebooks (notebook_name) VALUES ('MY SET')`);
    db.run(`INSERT INTO notes (notebook_id, note_name) VALUES (1, 'MY ALBUM')`);
    db.run(
      `INSERT INTO note_attachments (attachment_id, note_id, file_name, file_extension, relative_path)
       VALUES (1, 1, 'mine.jpg', 'jpg', '1/1/att_1_1.jpg')`
    );
    const result = restorePhotoAlbumsSampleAlbumDb(db);
    assert.ok(!result.restoredAttachmentIds.includes(1));
    const row = all(db, `SELECT note_id, file_name FROM note_attachments WHERE attachment_id = 1`)[0];
    assert.equal(row.file_name, 'mine.jpg');
    assert.equal(Number(row.note_id), 1);
  });

  it('seeds a new member with the template layout and only the template photos live', () => {
    const db = freshDb();
    seedPhotoAlbumsNewMemberSampleDb(db);
    assert.equal(all(db, `SELECT body_text FROM notes`)[0].body_text, loadSampleAlbumBodyHtml());
    assert.deepEqual(liveIds(db), liveSampleIds());
    assert.equal(all(db, `SELECT * FROM note_attachments`).length, sampleIds().length);
  });

  it('resets an edited SAMPLE ALBUM back to the template layout and photos', () => {
    const db = freshDb();
    seedPhotoAlbumsNewMemberSampleDb(db);
    db.run(`UPDATE notes SET body_text = '<p>my edits</p>'`);
    db.run(`UPDATE note_attachments SET deleted_at = NULL`);
    db.run(
      `INSERT INTO note_attachments (attachment_id, note_id, file_name, file_extension, relative_path)
       VALUES (20, 1, 'mine.jpg', 'jpg', '1/1/att_20_20.jpg')`
    );
    const result = restorePhotoAlbumsSampleAlbumDb(db);
    assert.equal(all(db, `SELECT body_text FROM notes`)[0].body_text, loadSampleAlbumBodyHtml());
    assert.deepEqual(liveIds(db), liveSampleIds());
    assert.ok(result.removedAttachmentIds.includes(20));
    assert.equal(all(db, `SELECT * FROM notes`).length, 1);
  });
});
