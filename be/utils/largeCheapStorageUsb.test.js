import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import {
  STORAGE_ROOT_MISSING_CODE,
  assertStorageRootPresent,
  ensurePathWritableOrThrow,
  ensureStorageRootWritable,
  storageRootMayBeCreated,
  storageRootMustAlreadyExist
} from './appStorageFolderPerms.js';
import { atomicWriteFileSync } from './photoAlbumsUsb/vaultPaths.js';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tutamall-usb-test-'));
const savedEnv = { LARGE_CHEAP_STORAGE_FOLDER: process.env.LARGE_CHEAP_STORAGE_FOLDER };

after(() => {
  process.env.LARGE_CHEAP_STORAGE_FOLDER = savedEnv.LARGE_CHEAP_STORAGE_FOLDER;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function openFdCount() {
  for (const dir of ['/dev/fd', '/proc/self/fd']) {
    try {
      return fs.readdirSync(dir).length;
    } catch {
      // try next
    }
  }
  return null;
}

describe('LARGE_CHEAP_STORAGE_FOLDER on a removable drive', () => {
  it('only LARGE_CHEAP_STORAGE_FOLDER is required to pre-exist', () => {
    assert.equal(storageRootMustAlreadyExist('LARGE_CHEAP_STORAGE_FOLDER'), true);
    assert.equal(storageRootMustAlreadyExist('FAST_STORAGE_FOLDER'), false);
    assert.equal(storageRootMustAlreadyExist('TUTADATES_PHOTO_FOLDER'), false);
  });

  it('allows auto-create only directly under the home folder', () => {
    assert.equal(storageRootMayBeCreated(path.join(os.homedir(), 'tutamallStorage')), true);
    assert.equal(storageRootMayBeCreated('/media/usbdrive/tutamallStorage'), false);
    assert.equal(storageRootMayBeCreated(path.join(os.homedir(), 'a', 'b')), false);
  });

  it('accepts an existing root directory', () => {
    const root = path.join(tmpRoot, 'mounted');
    fs.mkdirSync(root);
    assert.equal(assertStorageRootPresent(root), root);
  });

  it('refuses a missing root (unmounted drive) and does not create it', () => {
    const root = path.join(tmpRoot, 'unmounted-drive', 'tutamallStorage');
    assert.throws(
      () => assertStorageRootPresent(root),
      (err) => err.code === STORAGE_ROOT_MISSING_CODE && /mounted/.test(err.message)
    );
    assert.equal(fs.existsSync(root), false);
  });

  it('refuses a root that is a file, not a directory', () => {
    const root = path.join(tmpRoot, 'not-a-dir');
    fs.writeFileSync(root, 'x');
    assert.throws(() => assertStorageRootPresent(root), { code: STORAGE_ROOT_MISSING_CODE });
  });

  it('startup check reports a missing LARGE_CHEAP root without creating it', () => {
    const root = path.join(tmpRoot, 'gone', 'storage');
    const result = ensureStorageRootWritable(root, 'LARGE_CHEAP_STORAGE_FOLDER');
    assert.equal(result.ok, false);
    assert.equal(result.err.code, STORAGE_ROOT_MISSING_CODE);
    assert.equal(fs.existsSync(path.join(tmpRoot, 'gone')), false);
  });

  it('member folder creation never recreates a missing LARGE_CHEAP root', () => {
    const root = path.join(tmpRoot, 'usb-not-mounted', 'storage');
    process.env.LARGE_CHEAP_STORAGE_FOLDER = root;
    const memberAlbums = path.join(root, 'users', 'M123', 'photoalbums');
    assert.throws(() => ensurePathWritableOrThrow(memberAlbums), { code: STORAGE_ROOT_MISSING_CODE });
    assert.equal(fs.existsSync(path.join(tmpRoot, 'usb-not-mounted')), false);
  });

  it('member folder creation works once the root exists (drive mounted)', () => {
    const root = path.join(tmpRoot, 'usb-mounted', 'storage');
    fs.mkdirSync(root, { recursive: true });
    process.env.LARGE_CHEAP_STORAGE_FOLDER = root;
    const memberAlbums = path.join(root, 'users', 'M123', 'photoalbums');
    assert.equal(ensurePathWritableOrThrow(memberAlbums).ok, true);
    assert.equal(fs.statSync(memberAlbums).isDirectory(), true);
  });
});

describe('atomicWriteFileSync', () => {
  it('writes, overwrites, and leaves no temp files behind', () => {
    const target = path.join(tmpRoot, 'atomic', 'att_1_1_thumbnail.jpg');
    atomicWriteFileSync(target, Buffer.from('first'));
    atomicWriteFileSync(target, Buffer.from('second'));
    assert.equal(fs.readFileSync(target, 'utf8'), 'second');
    assert.deepEqual(fs.readdirSync(path.dirname(target)), ['att_1_1_thumbnail.jpg']);
  });

  it('does not leak file descriptors', () => {
    const before = openFdCount();
    if (before == null) return;
    const target = path.join(tmpRoot, 'atomic-fd', 'vault.db');
    for (let i = 0; i < 200; i += 1) atomicWriteFileSync(target, Buffer.from(String(i)));
    const afterCount = openFdCount();
    assert.ok(afterCount - before < 5, `fd count grew from ${before} to ${afterCount}`);
  });
});
