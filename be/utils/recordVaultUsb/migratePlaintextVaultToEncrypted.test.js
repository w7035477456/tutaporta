import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import pool from '../../db/connection.js';
import { listEnvVaultUnlockKeys } from '../recordVaultIconKeys.js';
import { openVaultBuffer } from './vaultCrypto.js';
import { vaultFilesRoot, vaultMetaPath } from './vaultPaths.js';
import {
  getVaultSession,
  initializeVaultOnUsbWithKey,
  logoffVaultUsb,
  unlockVaultUsbWithKey
} from './vaultSession.js';
import { acquireTestVaultMember } from './vaultPgTestMember.js';
import { deleteNotesMemberVault } from './vaultPgStore.js';

/**
 * Ensures plaintext→encrypted migrate seals files and flips vault.meta.
 * Requires NOTES_ENCRYPT_PHOTO_AND_DB (+ TUTANOTES_ENCRYPT_ALLOWED) and TEMPKEY_ONEDRIVE/TUTADRIVE.
 */
describe('migratePlaintextVaultToEncrypted', { concurrency: false }, () => {
  let member = null;
  let mountPath = null;
  let prevEncryptAllowed;
  let prevEncryptPhoto;
  let prevIconEnc;
  let prevTempKey;

  before(() => {
    prevEncryptAllowed = process.env.TUTANOTES_ENCRYPT_ALLOWED;
    prevEncryptPhoto = process.env.NOTES_ENCRYPT_PHOTO_AND_DB;
    prevIconEnc = process.env.NOTES_ICON_ENCRYPTION;
    prevTempKey = process.env.TEMPKEY_ONEDRIVE;
    process.env.TUTANOTES_ENCRYPT_ALLOWED = 'true';
    process.env.NOTES_ENCRYPT_PHOTO_AND_DB = 'true';
    process.env.NOTES_ICON_ENCRYPTION = 'false';
    if (!String(process.env.TEMPKEY_ONEDRIVE || '').trim() && !String(process.env.TEMPKEY_TUTADRIVE || '').trim()) {
      process.env.TEMPKEY_ONEDRIVE = crypto.randomBytes(32).toString('hex');
    }
  });

  after(async () => {
    if (member) {
      await logoffVaultUsb(member.singlesId, 'onedrive').catch(() => {});
      await deleteNotesMemberVault(member.singlesId).catch(() => {});
      await member.release();
    }
    if (mountPath) fs.rmSync(mountPath, { recursive: true, force: true });
    if (prevEncryptAllowed === undefined) delete process.env.TUTANOTES_ENCRYPT_ALLOWED;
    else process.env.TUTANOTES_ENCRYPT_ALLOWED = prevEncryptAllowed;
    if (prevEncryptPhoto === undefined) delete process.env.NOTES_ENCRYPT_PHOTO_AND_DB;
    else process.env.NOTES_ENCRYPT_PHOTO_AND_DB = prevEncryptPhoto;
    if (prevIconEnc === undefined) delete process.env.NOTES_ICON_ENCRYPTION;
    else process.env.NOTES_ICON_ENCRYPTION = prevIconEnc;
    if (prevTempKey === undefined) delete process.env.TEMPKEY_ONEDRIVE;
    else process.env.TEMPKEY_ONEDRIVE = prevTempKey;
    try {
      await pool.end();
    } catch {
      // ignore
    }
  });

  it('seals existing files/ and sets vault.meta encryption on unlock', async (t) => {
    try {
      member = await acquireTestVaultMember();
    } catch {
      return t.skip('Postgres dev DB not reachable');
    }
    mountPath = fs.mkdtempSync(path.join(os.tmpdir(), 'tutanotes-plain-migrate-'));
    await initializeVaultOnUsbWithKey(mountPath, null);
    const metaPath = vaultMetaPath(mountPath);
    const metaBefore = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    assert.equal(metaBefore.encryption, 'none');

    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    const relDir = path.join(vaultFilesRoot(mountPath), '1', '2');
    fs.mkdirSync(relDir, { recursive: true });
    const plainFile = path.join(relDir, '9.png');
    fs.writeFileSync(plainFile, png);
    assert.equal(fs.readFileSync(plainFile).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');

    await unlockVaultUsbWithKey(member.singlesId, mountPath, null, {
      storageType: 'onedrive',
      skipBackup: true
    });
    const session = getVaultSession(member.singlesId, 'onedrive');
    assert.ok(session);
    assert.ok(session.key, 'session should hold at-rest key after migrate');
    assert.equal(session.meta?.encryption, 'aes-256-gcm-icon-key');
    assert.ok(session.meta?.kdfSalt);

    const metaAfter = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    assert.equal(metaAfter.encryption, 'aes-256-gcm-icon-key');
    assert.equal(metaAfter.version, 2);

    assert.equal(fs.existsSync(plainFile), false, 'plaintext path should be removed');
    const encFile = `${plainFile}.enc`;
    assert.ok(fs.existsSync(encFile), 'sealed .enc file should exist');
    const sealed = fs.readFileSync(encFile);
    assert.notEqual(sealed.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const opened = openVaultBuffer(sealed, session.key);
    assert.deepEqual(opened, png);

    // Re-unlock with env key from meta salt must succeed.
    await logoffVaultUsb(member.singlesId, 'onedrive');
    const keys = await listEnvVaultUnlockKeys('tutadrive', metaAfter);
    await unlockVaultUsbWithKey(member.singlesId, mountPath, keys[0].key, {
      storageType: 'onedrive',
      skipBackup: true
    });
    const session2 = getVaultSession(member.singlesId, 'onedrive');
    assert.ok(session2?.key);
    assert.equal(session2.meta?.encryption, 'aes-256-gcm-icon-key');
  });
});
