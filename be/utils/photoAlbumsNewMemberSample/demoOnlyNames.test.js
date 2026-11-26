import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { PHOTO_ALBUMS_VAULT_TABLES as PA } from '../photoAlbumsUsb/vaultPgStore.js';
import { acquireTestVaultMember as acquireAlbumMember } from '../photoAlbumsUsb/vaultPgTestMember.js';
import { migrateSampleAlbumDemoOnlyNamesDb } from './migrateSampleAlbumTutorialLabels.js';
import { loadInitializeSampleManifest, seedPhotoAlbumsNewMemberSampleDb } from './seedPhotoAlbumsNewMemberSample.js';

/**
 * Demo album photos are named demoOnly_<name>. Members seeded before that rename still have the
 * old names; unlocking the vault must rename only untouched demo rows.
 */
describe('photo albums (SAMPLE ALBUM)', () => {
  let member = null;
  before(async () => {
    member = await acquireAlbumMember();
    if (member) await member.reset();
  });
  after(async () => {
    if (member) await member.release();
  });

  it('renames legacy demo album photos by checksum + old name only', async () => {
    await seedPhotoAlbumsNewMemberSampleDb(member.db);
    const manifest = loadInitializeSampleManifest();
    for (const a of manifest.attachments) {
      await member.db.run(`UPDATE ${PA.attachments} SET file_name = $3 WHERE singles_id = $1 AND attachment_id = $2`, [
        member.singlesId,
        a.attachmentId,
        a.legacyFileName
      ]);
    }
    // Member's own photo named photo1.jpg (different checksum) must keep its name.
    const first = manifest.attachments[0];
    await member.db.run(`UPDATE ${PA.attachments} SET checksum = 'not-the-demo' WHERE singles_id = $1 AND attachment_id = $2`, [
      member.singlesId,
      first.attachmentId
    ]);

    const { renamed } = await migrateSampleAlbumDemoOnlyNamesDb(member.db);
    assert.equal(renamed, manifest.attachments.length - 1);
    const rows = await member.db.all(
      `SELECT attachment_id, file_name FROM ${PA.attachments} WHERE singles_id = $1 ORDER BY attachment_id`,
      [member.singlesId]
    );
    for (const a of manifest.attachments) {
      const row = rows.find((r) => Number(r.attachment_id) === Number(a.attachmentId));
      assert.equal(row.file_name, a === first ? a.legacyFileName : a.fileName);
    }
    assert.equal((await migrateSampleAlbumDemoOnlyNamesDb(member.db)).renamed, 0);
  });
});
