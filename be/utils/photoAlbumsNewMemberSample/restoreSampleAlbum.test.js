import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { PHOTO_ALBUMS_VAULT_TABLES as T } from '../photoAlbumsUsb/vaultPgStore.js';
import { acquireTestVaultMember } from '../photoAlbumsUsb/vaultPgTestMember.js';
import {
  loadInitializeSampleManifest,
  loadSampleAlbumBodyHtml,
  remapSampleAlbumBodyAttachmentIds,
  restorePhotoAlbumsSampleAlbumDb,
  sampleAttachmentIdFloor,
  seedPhotoAlbumsNewMemberSampleDb
} from './seedPhotoAlbumsNewMemberSample.js';

let member = null;

const liveSampleIds = () =>
  loadInitializeSampleManifest()
    .attachments.filter((a) => a.deleted !== true)
    .map((a) => Number(a.attachmentId));

const all = (sql, params = []) => member.db.all(sql, [member.singlesId, ...params]);
const run = (sql, params = []) => member.db.run(sql, [member.singlesId, ...params]);

const liveIds = async () =>
  (
    await all(
      `SELECT attachment_id FROM ${T.attachments} WHERE singles_id = $1 AND deleted_at IS NULL ORDER BY attachment_id`
    )
  ).map((r) => Number(r.attachment_id));

/** Attachment ids placed on album pages (Blue Tray) in a body's data-album-templates. */
function pageAttachmentIds(bodyHtml) {
  const match = /data-album-templates="([^"]*)"/.exec(String(bodyHtml || ''));
  if (!match) return [];
  const json = match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  return JSON.parse(json).flatMap((page) => (page.attachmentIds || []).map(Number));
}

async function addAlbum(name, attachmentIds) {
  const nb = await all(`SELECT COALESCE(MAX(notebook_id), 0) + 1 AS id FROM ${T.notebooks} WHERE singles_id = $1`);
  const notebookId = Number(nb[0].id);
  await run(`INSERT INTO ${T.notebooks} (singles_id, notebook_id, notebook_name) VALUES ($1, $2, $3)`, [
    notebookId,
    `${name} SET`
  ]);
  const nt = await all(`SELECT COALESCE(MAX(note_id), 0) + 1 AS id FROM ${T.notes} WHERE singles_id = $1`);
  const noteId = Number(nt[0].id);
  await run(`INSERT INTO ${T.notes} (singles_id, note_id, notebook_id, note_name) VALUES ($1, $2, $3, $4)`, [
    noteId,
    notebookId,
    name
  ]);
  for (const id of attachmentIds) {
    await run(
      `INSERT INTO ${T.attachments} (singles_id, attachment_id, note_id, file_name, file_extension, relative_path)
       VALUES ($1, $2, $3, $4, 'jpg', $5)`,
      [id, noteId, `mine${id}.jpg`, `${notebookId}/${noteId}/att_${id}_${id}.jpg`]
    );
  }
  return { notebookId, noteId };
}

describe('restorePhotoAlbumsSampleAlbumDb (Postgres)', { concurrency: false }, () => {
  before(async () => {
    member = await acquireTestVaultMember();
  });

  after(async () => {
    if (member) await member.release();
  });

  beforeEach(async (t) => {
    if (!member) {
      t.skip('Postgres dev DB not reachable');
      return;
    }
    await member.reset();
  });

  it('is a no-op for an intact sample album', async () => {
    await seedPhotoAlbumsNewMemberSampleDb(member.db);
    const result = await restorePhotoAlbumsSampleAlbumDb(member.db);
    assert.deepEqual(result.restoredAttachmentIds, []);
    assert.equal((await all(`SELECT 1 FROM ${T.notebooks} WHERE singles_id = $1`)).length, 1);
    assert.equal((await all(`SELECT 1 FROM ${T.notes} WHERE singles_id = $1`)).length, 1);
    assert.equal((await all(`SELECT 1 FROM ${T.shortcuts} WHERE singles_id = $1`)).length, 1);
  });

  it('revives sample photos removed with X All (soft-deleted rows)', async () => {
    await seedPhotoAlbumsNewMemberSampleDb(member.db);
    await run(`UPDATE ${T.attachments} SET deleted_at = NOW() WHERE singles_id = $1`);
    const result = await restorePhotoAlbumsSampleAlbumDb(member.db);
    assert.deepEqual(result.restoredAttachmentIds, liveSampleIds());
    const live = await all(`SELECT note_id FROM ${T.attachments} WHERE singles_id = $1 AND deleted_at IS NULL`);
    assert.equal(live.length, liveSampleIds().length);
    assert.ok(live.every((row) => Number(row.note_id) === result.noteId));
  });

  it('recreates SAMPLE SET / SAMPLE ALBUM after they were deleted, keeping other albums', async () => {
    await seedPhotoAlbumsNewMemberSampleDb(member.db);
    const mine = await addAlbum('MY ALBUM', [8]);
    await run(`DELETE FROM ${T.attachments} WHERE singles_id = $1 AND note_id <> $2`, [mine.noteId]);
    await run(`DELETE FROM ${T.shortcuts} WHERE singles_id = $1`);
    await run(`UPDATE ${T.notes} SET deleted_at = NOW() WHERE singles_id = $1 AND note_id <> $2`, [mine.noteId]);
    await run(`UPDATE ${T.notebooks} SET deleted_at = NOW() WHERE singles_id = $1 AND notebook_id <> $2`, [
      mine.notebookId
    ]);

    const result = await restorePhotoAlbumsSampleAlbumDb(member.db);
    assert.deepEqual(result.restoredAttachmentIds, liveSampleIds());
    assert.notEqual(result.notebookId, mine.notebookId);
    const sets = await all(
      `SELECT notebook_name FROM ${T.notebooks} WHERE singles_id = $1 AND deleted_at IS NULL ORDER BY display_order`
    );
    assert.deepEqual(
      sets.map((row) => row.notebook_name),
      [loadInitializeSampleManifest().notebookName || 'SAMPLE SET', 'MY ALBUM SET']
    );
    const myPhoto = await all(`SELECT note_id FROM ${T.attachments} WHERE singles_id = $1 AND attachment_id = 8`);
    assert.equal(Number(myPhoto[0].note_id), mine.noteId);
    assert.equal(
      (await all(`SELECT 1 FROM ${T.shortcuts} WHERE singles_id = $1 AND note_id = $2`, [result.noteId])).length,
      1
    );
  });

  it('restores template photos under fresh ids when another album owns the sample ids (1 Green + 5 Blue)', async () => {
    const mine = await addAlbum('MY ALBUM', [1, 2, 3, 4, 5, 6, 7]);
    const result = await restorePhotoAlbumsSampleAlbumDb(member.db);

    const myPhotos = await all(
      `SELECT attachment_id FROM ${T.attachments} WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL`,
      [mine.noteId]
    );
    assert.equal(myPhotos.length, 7, 'member photos stay in their own album');

    const map = new Map(result.attachmentIdMap);
    assert.deepEqual([...map.keys()].sort((a, b) => a - b), liveSampleIds());
    assert.ok([...map.values()].every((id) => id > sampleAttachmentIdFloor()));

    const sampleLive = (
      await all(
        `SELECT attachment_id FROM ${T.attachments} WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL`,
        [result.noteId]
      )
    ).map((r) => Number(r.attachment_id));
    assert.equal(sampleLive.length, liveSampleIds().length);

    const [note] = await all(`SELECT body_text FROM ${T.notes} WHERE singles_id = $1 AND note_id = $2`, [
      result.noteId
    ]);
    assert.equal(note.body_text, remapSampleAlbumBodyAttachmentIds(loadSampleAlbumBodyHtml(), map));
    const onPages = new Set(pageAttachmentIds(note.body_text));
    const blue = sampleLive.filter((id) => onPages.has(id));
    const green = sampleLive.filter((id) => !onPages.has(id));
    assert.equal(blue.length, 5, 'Blue Tray (photos on pages)');
    assert.equal(green.length, 1, 'Green Tray (unplaced photos)');

    const again = await restorePhotoAlbumsSampleAlbumDb(member.db);
    assert.deepEqual(again.restoredAttachmentIds, [], 'second restore reuses the relocated copies');
    assert.deepEqual(new Map(again.attachmentIdMap), map);
  });

  it('seeds a new member with the template layout and only the template photos live', async () => {
    await seedPhotoAlbumsNewMemberSampleDb(member.db);
    const [note] = await all(`SELECT body_text FROM ${T.notes} WHERE singles_id = $1`);
    assert.equal(note.body_text, loadSampleAlbumBodyHtml());
    assert.deepEqual(await liveIds(), liveSampleIds());
    const onPages = new Set(pageAttachmentIds(note.body_text));
    assert.equal(liveSampleIds().filter((id) => onPages.has(id)).length, 5);
    assert.equal(liveSampleIds().filter((id) => !onPages.has(id)).length, 1);
  });

  it('resets an edited SAMPLE ALBUM back to the template layout and photos', async () => {
    await seedPhotoAlbumsNewMemberSampleDb(member.db);
    await run(`UPDATE ${T.notes} SET body_text = '<p>my edits</p>' WHERE singles_id = $1`);
    await run(`UPDATE ${T.attachments} SET deleted_at = NULL WHERE singles_id = $1`);
    const [sample] = await all(`SELECT note_id FROM ${T.notes} WHERE singles_id = $1`);
    await run(
      `INSERT INTO ${T.attachments} (singles_id, attachment_id, note_id, file_name, file_extension, relative_path)
       VALUES ($1, 20, $2, 'mine.jpg', 'jpg', '1/1/att_20_20.jpg')`,
      [Number(sample.note_id)]
    );
    const result = await restorePhotoAlbumsSampleAlbumDb(member.db);
    const [note] = await all(`SELECT body_text FROM ${T.notes} WHERE singles_id = $1`);
    assert.equal(note.body_text, loadSampleAlbumBodyHtml());
    assert.deepEqual(await liveIds(), liveSampleIds());
    assert.ok(result.removedAttachmentIds.includes(20));
    assert.equal((await all(`SELECT 1 FROM ${T.notes} WHERE singles_id = $1`)).length, 1);
  });
});
