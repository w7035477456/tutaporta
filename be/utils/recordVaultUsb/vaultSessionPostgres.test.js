import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import {
  buildRecordVaultSearchChain,
  evaluateRecordVaultSearchChain
} from '../recordVaultSearch.js';
import { vaultFilesRoot, vaultRootOnMount, VAULT_DB_FILE_PLAIN } from './vaultPaths.js';
import {
  NOTES_VAULT_TABLES as T,
  deleteNotesMemberVault,
  exportNotesMemberVaultToSqliteBuffer,
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

async function unlock() {
  await unlockVaultUsbWithKey(member.singlesId, mountPath, null, { storageType: 'onedrive', skipBackup: true });
  return getVaultSession(member.singlesId, 'onedrive');
}

describe('TutaNotes vault on Postgres', { concurrency: false }, () => {
  before(async () => {
    member = await acquireTestVaultMember();
    mountPath = fs.mkdtempSync(path.join(os.tmpdir(), 'tutanotes-pg-vault-'));
  });

  after(async () => {
    if (member) {
      await logoffVaultUsb(member.singlesId, 'onedrive').catch(() => {});
      await member.release();
    }
    fs.rmSync(mountPath, { recursive: true, force: true });
  });

  it('first unlock creates the notes index in Postgres and seeds the sample notebook', async (t) => {
    if (!member) return t.skip('Postgres dev DB not reachable');
    const meta = await initializeVaultOnUsbWithKey(mountPath, null);
    assert.equal(fs.existsSync(path.join(vaultRootOnMount(mountPath), VAULT_DB_FILE_PLAIN)), false);

    const session = await unlock();
    assert.ok(session);
    assert.equal((await loadNotesMemberVault(member.singlesId)).vault_id, meta.vaultId);
    const tree = await vaultGetTree(session);
    assert.ok(tree.notebooks.length >= 1);
    assert.ok(tree.notebooks[0].notes?.length >= 1);
  });

  it('create, update, search, and delete notes', async (t) => {
    if (!member) return t.skip('Postgres dev DB not reachable');
    const session = getVaultSession(member.singlesId, 'onedrive');
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
    const session = getVaultSession(member.singlesId, 'onedrive');
    const nb = await vaultCreateNotebook(session, 'KEEP NOTEBOOK');
    await logoffVaultUsb(member.singlesId, 'onedrive');
    const reopened = await unlock();
    const names = (await vaultGetTree(reopened)).notebooks.map((n) => n.notebook_name);
    assert.ok(names.includes('KEEP NOTEBOOK'));
    assert.equal(fs.existsSync(path.join(vaultRootOnMount(mountPath), VAULT_DB_FILE_PLAIN)), false);
    await vaultDeleteNotebook(reopened, nb.notebook_id);
  });

  it('imports a legacy vault.db once on unlock, then renames it', async (t) => {
    if (!member) return t.skip('Postgres dev DB not reachable');
    const session = getVaultSession(member.singlesId, 'onedrive');
    await vaultCreateNotebook(session, 'FROM LEGACY');
    const legacy = await exportNotesMemberVaultToSqliteBuffer(member.singlesId);
    await logoffVaultUsb(member.singlesId, 'onedrive');

    await deleteNotesMemberVault(member.singlesId);
    const root = vaultRootOnMount(mountPath);
    fs.writeFileSync(path.join(root, VAULT_DB_FILE_PLAIN), legacy);

    const reopened = await unlock();
    const names = (await vaultGetTree(reopened)).notebooks.map((n) => n.notebook_name);
    assert.ok(names.includes('FROM LEGACY'));
    assert.equal((await loadNotesMemberVault(member.singlesId)).source, 'import');
    assert.equal(fs.existsSync(path.join(root, VAULT_DB_FILE_PLAIN)), false);
    assert.ok(fs.readdirSync(root).some((name) => /^vault-imported-to-postgres-.*\.db$/.test(name)));

    const rows = await member.db.all(`SELECT COUNT(*)::int AS n FROM ${T.notebooks} WHERE singles_id = $1`, [
      member.singlesId
    ]);
    assert.ok(rows[0].n >= 2);
    assert.ok(fs.existsSync(vaultFilesRoot(mountPath)));
  });
});