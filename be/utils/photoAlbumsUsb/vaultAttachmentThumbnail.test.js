import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { after, before, beforeEach, describe, it } from 'node:test';

import sharp from 'sharp';

import { fileRelativePathForVariant } from '../photoAlbumsAttachmentVariants.js';
import { vaultFilesRoot } from './vaultPaths.js';
import { PHOTO_ALBUMS_VAULT_TABLES as T } from './vaultPgStore.js';
import { acquireTestVaultMember } from './vaultPgTestMember.js';
import {
  readEncryptedVaultFile,
  vaultEnsureNoteAttachmentThumbnail,
  vaultGetNoteAttachment,
  writeEncryptedVaultFile
} from './vaultSession.js';

const execFileAsync = promisify(execFile);

let member = null;
const tmpDirs = [];

async function makeSession() {
  const mountPath = await fs.mkdtemp(path.join(os.tmpdir(), 'tutaphoto-thumb-test-'));
  tmpDirs.push(mountPath);
  return { db: member.db, key: crypto.randomBytes(32), mountPath, meta: {}, storageType: 'onedrive' };
}

async function addAttachment(session, { id, noteId = 1, ext, deleted = false }) {
  const rel = `notebook_1/note_${noteId}/att_${id}_${id}.${ext}`;
  await session.db.run(
    `INSERT INTO ${T.attachments}
       (singles_id, attachment_id, note_id, file_name, file_extension, relative_path, deleted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [session.db.singlesId, id, noteId, `file${id}.${ext}`, ext, rel, deleted ? new Date('2026-01-01') : null]
  );
  return rel;
}

async function jpegOf(width, height) {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 40, b: 40 } } })
    .jpeg()
    .toBuffer();
}

async function videoOf(width, height) {
  const ffmpeg = (await import('ffmpeg-static')).default;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tutaphoto-thumb-vid-'));
  tmpDirs.push(dir);
  const out = path.join(dir, 'v.mp4');
  await execFileAsync(
    ffmpeg,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      `testsrc=size=${width}x${height}:rate=30:duration=1.5`,
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      '-y',
      out
    ],
    { timeout: 30_000 }
  );
  return fs.readFile(out);
}

/** Overwrite the on-disk thumb with raw bytes (simulates a torn write). */
function writeRawThumb(session, rel, bytes) {
  const thumbRel = fileRelativePathForVariant(rel, 'thumb');
  for (const name of [thumbRel, `${thumbRel}.enc`]) {
    const abs = path.join(vaultFilesRoot(session.mountPath), name);
    if (fsSync.existsSync(abs)) fsSync.writeFileSync(abs, bytes);
  }
}

before(async () => {
  member = await acquireTestVaultMember();
  if (member) await member.reset();
});

after(async () => {
  for (const dir of tmpDirs) await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  if (member) await member.release();
});

describe('vaultEnsureNoteAttachmentThumbnail', () => {
  beforeEach((t) => {
    if (!member) t.skip('Postgres dev DB not reachable');
  });

  it('rebuilds a missing image thumbnail (≤320px JPEG) from the full file', async () => {
    const session = await makeSession();
    const rel = await addAttachment(session, { id: 11, ext: 'jpg' });
    writeEncryptedVaultFile(session, rel, await jpegOf(1600, 1200));

    assert.equal(await vaultEnsureNoteAttachmentThumbnail(session, 1, 11), true);
    const thumb = readEncryptedVaultFile(session, fileRelativePathForVariant(rel, 'thumb'));
    const meta = await sharp(thumb).metadata();
    assert.equal(meta.format, 'jpeg');
    assert.equal(meta.width, 320);
    assert.equal(meta.height, 240);

    const served = await vaultGetNoteAttachment(session, 1, 11, { variant: 'thumb' });
    assert.equal(served.variant, 'thumb');
    assert.equal(served.contentType, 'image/jpeg');
  });

  it('prefers the 1000px display file as the rebuild source', async () => {
    const session = await makeSession();
    const rel = await addAttachment(session, { id: 12, ext: 'png' });
    writeEncryptedVaultFile(session, fileRelativePathForVariant(rel, 'display'), await jpegOf(1000, 500));
    assert.equal(await vaultEnsureNoteAttachmentThumbnail(session, 1, 12), true);
    const meta = await sharp(readEncryptedVaultFile(session, fileRelativePathForVariant(rel, 'thumb'))).metadata();
    assert.equal(meta.width, 320);
    assert.equal(meta.height, 160);
  });

  it('leaves a valid existing thumbnail untouched', async () => {
    const session = await makeSession();
    const rel = await addAttachment(session, { id: 13, ext: 'jpg' });
    writeEncryptedVaultFile(session, rel, await jpegOf(800, 800));
    const existing = await jpegOf(50, 50);
    writeEncryptedVaultFile(session, fileRelativePathForVariant(rel, 'thumb'), existing);
    assert.equal(await vaultEnsureNoteAttachmentThumbnail(session, 1, 13), true);
    assert.deepEqual(readEncryptedVaultFile(session, fileRelativePathForVariant(rel, 'thumb')), existing);
  });

  it('replaces a truncated / corrupt thumbnail', async () => {
    const session = await makeSession();
    const rel = await addAttachment(session, { id: 14, ext: 'jpg' });
    writeEncryptedVaultFile(session, rel, await jpegOf(640, 480));
    const good = await jpegOf(100, 100);
    writeEncryptedVaultFile(session, fileRelativePathForVariant(rel, 'thumb'), good);
    writeRawThumb(session, rel, good.subarray(0, Math.floor(good.length / 2)));

    assert.equal(await vaultEnsureNoteAttachmentThumbnail(session, 1, 14), true);
    const meta = await sharp(readEncryptedVaultFile(session, fileRelativePathForVariant(rel, 'thumb'))).metadata();
    assert.equal(meta.width, 320);
  });

  it('generates a JPEG poster thumbnail for a video', { timeout: 60_000 }, async () => {
    const session = await makeSession();
    const rel = await addAttachment(session, { id: 15, ext: 'mp4' });
    writeEncryptedVaultFile(session, rel, await videoOf(640, 360));
    assert.equal(await vaultEnsureNoteAttachmentThumbnail(session, 1, 15), true);
    const served = await vaultGetNoteAttachment(session, 1, 15, { variant: 'thumb' });
    assert.equal(served.variant, 'thumb');
    assert.equal(served.contentType, 'image/jpeg');
    const meta = await sharp(served.buffer).metadata();
    assert.equal(meta.width, 320);
    assert.equal(meta.height, 180);
  });

  it('concurrent requests share one rebuild and all succeed', async () => {
    const session = await makeSession();
    const rel = await addAttachment(session, { id: 16, ext: 'jpg' });
    writeEncryptedVaultFile(session, rel, await jpegOf(1200, 900));
    const results = await Promise.all(
      Array.from({ length: 5 }, () => vaultEnsureNoteAttachmentThumbnail(session, 1, 16))
    );
    assert.deepEqual(results, [true, true, true, true, true]);
  });

  it('returns false (never throws) when it cannot build a thumbnail', async () => {
    const session = await makeSession();
    await addAttachment(session, { id: 17, ext: 'jpg' });
    assert.equal(await vaultEnsureNoteAttachmentThumbnail(session, 1, 17), false);

    const relBad = await addAttachment(session, { id: 18, ext: 'jpg' });
    writeEncryptedVaultFile(session, relBad, Buffer.from('definitely not an image'));
    assert.equal(await vaultEnsureNoteAttachmentThumbnail(session, 1, 18), false);

    const relDel = await addAttachment(session, { id: 19, ext: 'jpg', deleted: true });
    writeEncryptedVaultFile(session, relDel, await jpegOf(400, 400));
    assert.equal(await vaultEnsureNoteAttachmentThumbnail(session, 1, 19), false);

    assert.equal(await vaultEnsureNoteAttachmentThumbnail(session, 1, 999), false);
    assert.equal(await vaultEnsureNoteAttachmentThumbnail(session, 2, 17), false);
    assert.equal(await vaultEnsureNoteAttachmentThumbnail(null, 1, 17), false);
  });

  it('falls back to the full file when no thumbnail can be produced', async () => {
    const session = await makeSession();
    const rel = await addAttachment(session, { id: 20, ext: 'pdf' });
    writeEncryptedVaultFile(session, rel, Buffer.from('%PDF-1.4 fake'));
    assert.equal(await vaultEnsureNoteAttachmentThumbnail(session, 1, 20), false);
    const served = await vaultGetNoteAttachment(session, 1, 20, { variant: 'thumb' });
    assert.equal(served.variant, 'full');
  });
});
