import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { encryptBuffer } from './vaultCrypto.js';
import { vaultFileStoragePath } from './vaultPaths.js';
import { readVaultAttachmentBuffer } from './vaultSession.js';

/**
 * A double-sealed `.enc` is file_size_bytes + 56 and opens once to another sealed blob.
 * readVaultAttachmentBuffer must never return that blob as the attachment (the browser would
 * render ciphertext labelled image/png as a broken image, with no error).
 */
describe('readVaultAttachmentBuffer — double-sealed file guard', { concurrency: false }, () => {
  let mountPath;
  let key;
  let prevEncryptAllowed;
  let prevEncryptPhoto;

  before(() => {
    prevEncryptAllowed = process.env.TUTANOTES_ENCRYPT_ALLOWED;
    prevEncryptPhoto = process.env.NOTES_ENCRYPT_PHOTO_AND_DB;
    process.env.TUTANOTES_ENCRYPT_ALLOWED = 'true';
    process.env.NOTES_ENCRYPT_PHOTO_AND_DB = 'true';
    mountPath = fs.mkdtempSync(path.join(os.tmpdir(), 'rv-doubleseal-'));
    key = crypto.randomBytes(32);
  });

  after(() => {
    if (prevEncryptAllowed === undefined) delete process.env.TUTANOTES_ENCRYPT_ALLOWED;
    else process.env.TUTANOTES_ENCRYPT_ALLOWED = prevEncryptAllowed;
    if (prevEncryptPhoto === undefined) delete process.env.NOTES_ENCRYPT_PHOTO_AND_DB;
    else process.env.NOTES_ENCRYPT_PHOTO_AND_DB = prevEncryptPhoto;
    fs.rmSync(mountPath, { recursive: true, force: true });
  });

  /** Write a `.enc` holding `sealTimes` layers of the plaintext. */
  function writeAttachment(relativePath, plain, sealTimes) {
    let bytes = plain;
    for (let i = 0; i < sealTimes; i += 1) bytes = encryptBuffer(bytes, key);
    const abs = vaultFileStoragePath(mountPath, relativePath, { version: 2, encryption: 'aes-256-gcm-icon-key' });
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, bytes);
    return abs;
  }

  const session = () => ({ singlesId: 1, mountPath, key, meta: { version: 2, encryption: 'aes-256-gcm-icon-key' } });

  it('returns the plaintext for a healthy single-sealed attachment', () => {
    const plain = Buffer.from('healthy-bytes');
    writeAttachment('1/1/1.png', plain, 1);
    const out = readVaultAttachmentBuffer(session(), {
      relative_path: '1/1/1.png',
      file_size_bytes: plain.length,
      shared_content_key: null
    });
    assert.ok(out);
    assert.equal(out.toString(), 'healthy-bytes');
  });

  it('refuses to serve a double-sealed attachment', () => {
    const plain = crypto.randomBytes(2048);
    writeAttachment('1/2/2.png', plain, 2);
    const out = readVaultAttachmentBuffer(session(), {
      relative_path: '1/2/2.png',
      file_size_bytes: plain.length,
      shared_content_key: null
    });
    assert.equal(out, null, 'double-sealed bytes must not be served as the attachment');
  });

  it('still serves files whose stored size is unknown', () => {
    const plain = Buffer.from('no-size-row');
    writeAttachment('1/3/3.png', plain, 1);
    const out = readVaultAttachmentBuffer(session(), {
      relative_path: '1/3/3.png',
      file_size_bytes: 0,
      shared_content_key: null
    });
    assert.ok(out);
    assert.equal(out.toString(), 'no-size-row');
  });

  it('returns null when the attachment file is missing', () => {
    const out = readVaultAttachmentBuffer(session(), {
      relative_path: '1/4/missing.png',
      file_size_bytes: 10,
      shared_content_key: null
    });
    assert.equal(out, null);
  });
});
