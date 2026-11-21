import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import sharp from 'sharp';

import { buildPhotoAlbumsSearchChain, evaluatePhotoAlbumsSearchChain } from '../photoAlbumsSearch.js';
import { loadInitializeSampleManifest } from '../photoAlbumsNewMemberSample/seedPhotoAlbumsNewMemberSample.js';
import { listEnvVaultUnlockKeys } from '../vaultKeys.js';
import { readVaultMeta } from './usbScan.js';
import { vaultMetaUsesPlaintextStorage } from '../photoAlbumsIconEncryption.js';
import { vaultFilesRoot, vaultRootOnMount } from './vaultPaths.js';
import {
  deletePhotoAlbumsMemberVault,
  exportPhotoAlbumsMemberVaultIndex,
  importPhotoAlbumsMemberVaultIndex,
  loadPhotoAlbumsMemberVault
} from './vaultPgStore.js';
import { acquireTestVaultMember } from './vaultPgTestMember.js';
import {
  getVaultSession,
  initializeVaultOnUsbWithKey,
  logoffVaultUsb,
  unlockVaultUsbWithKey,
  vaultAddNoteAttachment,
  vaultCreateNote,
  vaultCreateNotebook,
  vaultCreateShortcut,
  vaultDeleteNote,
  vaultDeleteNotebook,
  vaultDeleteNoteAttachment,
  vaultGetNote,
  vaultGetTree,
  vaultReorderNotebooks,
  vaultSearch,
  vaultTransferNoteAttachment,
  vaultUpdateNote
} from './vaultSession.js';

let member = null;
let mountPath = null;

/** The index lives in Postgres: the vault folder holds only vault.meta.json + photos/ + files/. */
function vaultFolderTopLevel() {
  return fs.readdirSync(vaultRootOnMount(mountPath)).filter((name) => !name.startsWith('.')).sort();
}

const liveSampleAttachmentCount = () =>
  loadInitializeSampleManifest().attachments.filter((a) => a.deleted !== true).length;

/** Same key choice as the TutaDrive unlock route: env key once the vault is sealed. */
async function routeUnlockKey() {
  const meta = readVaultMeta(mountPath);
  if (vaultMetaUsesPlaintextStorage(meta)) return null;
  return (await listEnvVaultUnlockKeys('tutaCloud', meta))[0]?.key ?? null;
}

async function unlock() {
  await unlockVaultUsbWithKey(member.singlesId, mountPath, await routeUnlockKey(), { storageType: 'tutaCloud', skipBackup: true });
  return getVaultSession(member.singlesId, 'tutaCloud');
}

const jpeg = (r) =>
  sharp({ create: { width: 64, height: 48, channels: 3, background: { r, g: 10, b: 10 } } }).jpeg().toBuffer();

describe('TutaPhoto vault on Postgres', { concurrency: false }, () => {
  before(async () => {
    member = await acquireTestVaultMember();
    mountPath = fs.mkdtempSync(path.join(os.tmpdir(), 'tutaphoto-pg-vault-'));
  });

  after(async () => {
    if (member) {
      await logoffVaultUsb(member.singlesId, 'tutaCloud').catch(() => {});
      await member.release();
    }
    fs.rmSync(mountPath, { recursive: true, force: true });
  });

  it('first unlock creates the album index in Postgres and seeds the sample album', async (t) => {
    if (!member) return t.skip('Postgres dev DB not reachable');
    const meta = await initializeVaultOnUsbWithKey(mountPath, null);
    assert.deepEqual(vaultFolderTopLevel(), ['files', 'photos', 'vault.meta.json']);

    const session = await unlock();
    assert.ok(session);
    assert.equal((await loadPhotoAlbumsMemberVault(member.singlesId)).vault_id, meta.vaultId);
    const tree = await vaultGetTree(session);
    assert.equal(tree.notebooks.length, 1);
    assert.equal(tree.notebooks[0].notes[0].album_media_count, liveSampleAttachmentCount());
    assert.equal(tree.shortcuts.length, 1);
  });

  it('notebooks, notes, keywords, uploads, search, transfer and delete', async (t) => {
    if (!member) return t.skip('Postgres dev DB not reachable');
    const session = getVaultSession(member.singlesId, 'tutaCloud');
    const nb = await vaultCreateNotebook(session, 'MY SET');
    const note = await vaultCreateNote(session, nb.notebook_id, {
      noteName: 'MY ALBUM',
      keywords: ['Beach', 'beach', 'Sun']
    });
    assert.deepEqual(note.keywords, ['Beach', 'Sun']);

    const buf = await jpeg(200);
    const att = await vaultAddNoteAttachment(session, note.note_id, { buffer: buf, fileName: 'a.jpg', ext: 'jpg' });
    assert.ok(att.attachment_id > 7, 'uploads never take the reserved sample ids');
    assert.equal(att.album_photo_seq, 1);
    const dup = await vaultAddNoteAttachment(session, note.note_id, { buffer: buf, fileName: 'b.jpg', ext: 'jpg' });
    assert.equal(dup.duplicate, true);
    assert.equal(dup.attachment_id, att.attachment_id);
    assert.ok(fs.existsSync(path.join(vaultFilesRoot(mountPath), String(nb.notebook_id), String(note.note_id))));

    const updated = await vaultUpdateNote(session, note.note_id, { note_name: 'MY BEACH ALBUM', keywords: ['Sea'] });
    assert.equal(updated.note_name, 'MY BEACH ALBUM');
    assert.deepEqual(updated.keywords, ['Sea']);
    assert.equal(updated.attachments.length, 1);

    const results = await vaultSearch(
      session,
      buildPhotoAlbumsSearchChain('sea', '', '', 'and', 'and'),
      evaluatePhotoAlbumsSearchChain
    );
    assert.deepEqual(results.map((r) => r.note_id), [note.note_id]);

    const other = await vaultCreateNote(session, nb.notebook_id, { noteName: 'OTHER' });
    const moved = await vaultTransferNoteAttachment(session, note.note_id, att.attachment_id, other.note_id, 'move');
    assert.equal(moved.duplicate, false);
    assert.notEqual(moved.attachment.attachment_id, att.attachment_id);
    assert.equal((await vaultGetNote(session, note.note_id)).attachments.length, 0);
    assert.equal((await vaultGetNote(session, other.note_id)).attachments.length, 1);

    const shortcut = await vaultCreateShortcut(session, {
      targetType: 'note',
      notebookId: nb.notebook_id,
      noteId: other.note_id
    });
    assert.equal(shortcut.label, 'OTHER');

    await vaultDeleteNoteAttachment(session, other.note_id, moved.attachment.attachment_id);
    assert.equal((await vaultGetNote(session, other.note_id)).attachments.length, 0);
    await vaultDeleteNote(session, other.note_id);
    assert.equal(await vaultGetNote(session, other.note_id), null);

    const tree = await vaultGetTree(session);
    await vaultReorderNotebooks(
      session,
      tree.notebooks.map((n) => n.notebook_id).reverse()
    );
    assert.equal((await vaultGetTree(session)).notebooks[0].notebook_name, 'MY SET');
    await vaultDeleteNotebook(session, nb.notebook_id);
    assert.equal((await vaultGetTree(session)).notebooks.length, 1);
  });

  it('logoff + unlock again (any worker) sees the same rows; no vault.db is written', async (t) => {
    if (!member) return t.skip('Postgres dev DB not reachable');
    const session = getVaultSession(member.singlesId, 'tutaCloud');
    const nb = await vaultCreateNotebook(session, 'KEEP ME');
    await logoffVaultUsb(member.singlesId, 'tutaCloud');
    const reopened = await unlock();
    const names = (await vaultGetTree(reopened)).notebooks.map((n) => n.notebook_name);
    assert.ok(names.includes('KEEP ME'));
    assert.deepEqual(vaultFolderTopLevel(), ['files', 'photos', 'vault.meta.json']);
    await vaultDeleteNotebook(reopened, nb.notebook_id);
  });

  it('backup index export → import restores the photoalbums index (ids kept)', async (t) => {
    if (!member) return t.skip('Postgres dev DB not reachable');
    const session = getVaultSession(member.singlesId, 'tutaCloud');
    const nb = await vaultCreateNotebook(session, 'FROM BACKUP');
    const index = JSON.parse(JSON.stringify(await exportPhotoAlbumsMemberVaultIndex(member.singlesId)));
    await logoffVaultUsb(member.singlesId, 'tutaCloud');

    await deletePhotoAlbumsMemberVault(member.singlesId);
    const counts = await importPhotoAlbumsMemberVaultIndex(member.singlesId, index, { source: 'restore' });
    assert.equal(counts.notebooks, index.tables.notebooks.length);

    const reopened = await unlock();
    const restored = (await vaultGetTree(reopened)).notebooks.find((n) => n.notebook_name === 'FROM BACKUP');
    assert.equal(Number(restored?.notebook_id), Number(nb.notebook_id));
    assert.equal((await loadPhotoAlbumsMemberVault(member.singlesId)).source, 'restore');
    assert.deepEqual(vaultFolderTopLevel(), ['files', 'photos', 'vault.meta.json']);
  });
});
