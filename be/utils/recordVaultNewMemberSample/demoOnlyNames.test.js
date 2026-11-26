import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { NOTES_VAULT_TABLES as NT } from '../recordVaultUsb/vaultPgStore.js';
import { acquireTestVaultMember as acquireNotesMember } from '../recordVaultUsb/vaultPgTestMember.js';
import { listRecordVaultSampleAttachmentDefs } from './sampleManifest.js';
import { ensureRecordVaultNewMemberSampleDb, seedRecordVaultNewMemberSampleDb } from './seedRecordVaultNewMemberSample.js';

/**
 * Demo (sample) note files are named demoOnly_<name>. Members seeded before that rename still have
 * the old names; opening the vault must rename only untouched demo rows.
 */
describe('notes (SAMPLE MISC / SAMPLE TAX RECORDS)', () => {
  let member = null;
  before(async () => {
    member = await acquireNotesMember();
    if (member) await member.reset();
  });
  after(async () => {
    if (member) await member.release();
  });

  it('new members get demoOnly_ names; legacy-named demo rows are renamed on open', async () => {
    await seedRecordVaultNewMemberSampleDb(member.db);
    const names = async () =>
      (
        await member.db.all(`SELECT file_name FROM ${NT.attachments} WHERE singles_id = $1 AND deleted_at IS NULL ORDER BY attachment_id`, [
          member.singlesId
        ])
      ).map((r) => r.file_name);
    const expected = listRecordVaultSampleAttachmentDefs().map((a) => a.fileName);
    assert.ok(expected.every((n) => n.startsWith('demoOnly_')));
    assert.deepEqual(await names(), expected);

    // Simulate a member seeded before the rename: old names on every demo row.
    for (const a of listRecordVaultSampleAttachmentDefs()) {
      await member.db.run(`UPDATE ${NT.attachments} SET file_name = $3 WHERE singles_id = $1 AND attachment_id = $2`, [
        member.singlesId,
        a.attachmentId,
        a.legacyFileName
      ]);
    }
    // A member's own upload that only shares a demo name (other bytes, no shared key) stays as is.
    await member.db.run(
      `UPDATE ${NT.attachments} SET shared_content_key = NULL, checksum = 'not-the-demo' WHERE singles_id = $1 AND attachment_id = 9`,
      [member.singlesId]
    );

    await ensureRecordVaultNewMemberSampleDb(member.db, { allowSeed: false });
    const after = await names();
    const want = listRecordVaultSampleAttachmentDefs().map((a) => (Number(a.attachmentId) === 9 ? a.legacyFileName : a.fileName));
    assert.deepEqual(after, want);
  });
});
