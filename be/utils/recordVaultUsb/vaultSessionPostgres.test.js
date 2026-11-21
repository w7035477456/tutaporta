import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import {
  buildRecordVaultSearchChain,
  evaluateRecordVaultSearchChain
} from '../recordVaultSearch.js';
import { listEnvVaultUnlockKeys } from '../vaultKeys.js';
import { readVaultMeta } from './usbScan.js';
import { vaultMetaUsesPlaintextStorage } from '../recordVaultIconEncryption.js';
import { vaultRootOnMount } from './vaultPaths.js';
import {
  deleteNotesMemberVault,
  exportNotesMemberVaultIndex,
  importNotesMemberVaultIndex,
  loadNotesMemberVault
} from './vaultPgStore.js';
import { acquireTestVaultMember } from './vaultPgTestMember.js';
import {
  getVaultSession,
  initializeVaultOnUsbWithKey,
  logoffVaultUsb,
  unlockVaultUsbWithKey,
  vaultCreateNote,
  vaultCreateNotebook,
  vaultDeleteNote,
  vaultDeleteNotebook,
  vaultGetNote,
  vaultGetTree,
  vaultSearch,
  vaultUpdateNote
} from './vaultSession.js';

let member = null;
let mountPath = null;

/** The index lives in Postgres: the vault folder holds only vault.meta.json + photos/ + files/. */
function vaultFolderTopLevel() {
  return fs.readdirSync(vaultRootOnMount(mountPath)).filter((name) => !name.startsWith('.')).sort();
}

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

describe('TutaNotes vault on Postgres', { concurrency: false }, () => {
  before(async () => {
    member = await acquireTestVaultMember();
    mountPath = fs.mkdtempSync(path.join(os.tmpdir(), 'tutanotes-pg-vault-'));
  });

  after(async () => {
    if (member) {
      await logoffVaultUsb(member.singlesId, 'tutaCloud').catch(() => {});
      await member.release();
    }
    fs.rmSync(mountPath, { recursive: true, force: true });
  });

  it('first unlock creates the notes index in Postgres and seeds the sample notebook', async (t) => {
    if (!member) return t.skip('Postgres dev DB not reachable');
    const meta = await initializeVaultOnUsbWithKey(mountPath, null);
    assert.deepEqual(vaultFolderTopLevel(), ['files', 'photos', 'vault.meta.json']);

    const session = await unlock();
    assert.ok(session);
    assert.equal((await loadNotesMemberVault(member.singlesId)).vault_id, meta.vaultId);
    const tree = await vaultGetTree(session);
    assert.ok(tree.notebooks.length >= 1);
    assert.ok(tree.notebooks[0].notes?.length >= 1);
  });

  it('create, update, search, and delete notes', async (t) => {
    if (!member) return t.skip('Postgres dev DB not reachable');
    const session = getVaultSession(member.singlesId, 'tutaCloud');
    const nb = await vaultCreateNotebook(session, 'WORK NOTEBOOK');
    const note = await vaultCreateNote(session, nb.notebook_id, { noteName: 'Draft', bodyText: 'Pacific sunset' });
    assert.equal(note.note_name, 'Draft');

    const updated = await vaultUpdateNote(session, note.note_id, {
      note_name: 'Beach memo',
      body_text: '<p>Pacific sunset and waves</p>'
    });
    assert.equal(updated.note_name, 'Beach memo');

    const results = await vaultSearch(
      session,
      buildRecordVaultSearchChain('pacific', '', '', 'and', 'and'),
      evaluateRecordVaultSearchChain
    );
    assert.ok(results.some((r) => Number(r.note_id) === Number(note.note_id)));

    assert.ok((await vaultGetNote(session, note.note_id)).body_text.includes('Pacific'));
    await vaultDeleteNote(session, note.note_id);
    assert.equal(await vaultGetNote(session, note.note_id), null);
    await vaultDeleteNotebook(session, nb.notebook_id);
    assert.equal(
      (await vaultGetTree(session)).notebooks.find((n) => n.notebook_id === nb.notebook_id),
      undefined
    );
  });

  it('logoff + unlock again (any worker) sees the same rows; no vault.db is written', async (t) => {
    if (!member) return t.skip('Postgres dev DB not reachable');
    const session = getVaultSession(member.singlesId, 'tutaCloud');
    const nb = await vaultCreateNotebook(session, 'KEEP NOTEBOOK');
    await logoffVaultUsb(member.singlesId, 'tutaCloud');
    const reopened = await unlock();
    const names = (await vaultGetTree(reopened)).notebooks.map((n) => n.notebook_name);
    assert.ok(names.includes('KEEP NOTEBOOK'));
    assert.deepEqual(vaultFolderTopLevel(), ['files', 'photos', 'vault.meta.json']);
    await vaultDeleteNotebook(reopened, nb.notebook_id);
  });

  it('backup index export → import restores the notes index (ids kept)', async (t) => {
    if (!member) return t.skip('Postgres dev DB not reachable');
    const session = getVaultSession(member.singlesId, 'tutaCloud');
    const nb = await vaultCreateNotebook(session, 'FROM BACKUP');
    const index = JSON.parse(JSON.stringify(await exportNotesMemberVaultIndex(member.singlesId)));
    await logoffVaultUsb(member.singlesId, 'tutaCloud');

    await deleteNotesMemberVault(member.singlesId);
    const counts = await importNotesMemberVaultIndex(member.singlesId, index, { source: 'restore' });
    assert.equal(counts.notebooks, index.tables.notebooks.length);

    const reopened = await unlock();
    const restored = (await vaultGetTree(reopened)).notebooks.find((n) => n.notebook_name === 'FROM BACKUP');
    assert.equal(Number(restored?.notebook_id), Number(nb.notebook_id));
    assert.equal((await loadNotesMemberVault(member.singlesId)).source, 'restore');
    assert.deepEqual(vaultFolderTopLevel(), ['files', 'photos', 'vault.meta.json']);
  });
});