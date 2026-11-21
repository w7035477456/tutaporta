import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import { findSealedVaultSampleFile, sealPlaintextVaultTree } from './vaultAtRestSeal.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-seal-'));
const seal = (buf) => Buffer.concat([Buffer.from('SEALED:'), buf]);
const write = (abs, buf) => {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buf);
};

describe('sealPlaintextVaultTree', () => {
  after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('seals plaintext files, drops every symlink under files/ (not its target), keeps sealed twins', () => {
    const files = path.join(tmp, 'vault', 'files');
    const photos = path.join(tmp, 'vault', 'photos');
    const shared = path.join(tmp, 'shared');
    write(path.join(files, '1', '1', 'a.jpg'), Buffer.from('plain-a'));
    write(path.join(files, '1', '1', 'b_thumbnail.jpg'), Buffer.from('stale-plain'));
    write(path.join(files, '1', '1', 'b_thumbnail.jpg.enc'), Buffer.from('SEALED:newer'));
    write(path.join(shared, 'sample.jpg'), Buffer.from('shared-sample'));
    fs.mkdirSync(path.join(shared, 'dir'), { recursive: true });
    fs.symlinkSync(path.join(shared, 'sample.jpg'), path.join(files, '1', '1', 'att_1_1.jpg'));
    fs.symlinkSync(path.join(shared, 'dir'), path.join(files, 'linked-dir'));
    write(path.join(photos, '2.png'), Buffer.from('plain-photo'));

    const counts = sealPlaintextVaultTree([{ dir: photos }, { dir: files, removeSymlinks: true }], {
      key: Buffer.alloc(32),
      sealVaultBuffer: seal,
      atomicWriteFileSync: (abs, buf) => write(abs, buf),
      logPrefix: '[test]'
    });

    assert.deepEqual(counts, { sealed: 3, skipped: 0, unlinked: 2 });
    assert.equal(fs.readFileSync(path.join(files, '1', '1', 'a.jpg.enc'), 'utf8'), 'SEALED:plain-a');
    assert.equal(fs.existsSync(path.join(files, '1', '1', 'a.jpg')), false);
    assert.equal(fs.readFileSync(path.join(files, '1', '1', 'b_thumbnail.jpg.enc'), 'utf8'), 'SEALED:newer');
    assert.equal(fs.existsSync(path.join(files, '1', '1', 'b_thumbnail.jpg')), false);
    assert.equal(fs.existsSync(path.join(files, '1', '1', 'att_1_1.jpg')), false);
    assert.equal(fs.readFileSync(path.join(shared, 'sample.jpg'), 'utf8'), 'shared-sample');
    assert.equal(fs.existsSync(path.join(files, 'linked-dir')), false);
    assert.ok(fs.statSync(path.join(shared, 'dir')).isDirectory());
    assert.equal(fs.readFileSync(path.join(photos, '2.png.enc'), 'utf8'), 'SEALED:plain-photo');

    assert.ok(findSealedVaultSampleFile(files).endsWith('.enc'));
  });
});
