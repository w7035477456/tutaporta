import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';

import {
  PHOTO_ALBUMS_VIDEO_MAX_FPS,
  PHOTO_ALBUMS_VIDEO_SHORT_SIDE_PX,
  fitPhotoAlbumsVideoSize,
  normalizePhotoAlbumsVideoBuffer,
  parseFfmpegInputProbe,
  photoAlbumsVideoNeedsReencode
} from './photoAlbumsNormalizeVideo.js';

const execFileAsync = promisify(execFile);

async function ffmpegPath() {
  const mod = await import('ffmpeg-static');
  return mod.default;
}

async function probeFile(filePath) {
  const ffmpeg = await ffmpegPath();
  let stderr = '';
  try {
    await execFileAsync(ffmpeg, ['-hide_banner', '-i', filePath], {
      encoding: 'utf8',
      timeout: 30_000
    });
  } catch (err) {
    stderr = String(err?.stderr || '');
  }
  return parseFfmpegInputProbe(stderr);
}

async function makeSourceVideo({ width, height, fps, durationSec = 0.4, ext = 'mp4' }) {
  const ffmpeg = await ffmpegPath();
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tutaphoto-vid-test-'));
  const outPath = path.join(dir, `src.${ext}`);
  await execFileAsync(
    ffmpeg,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      `testsrc=size=${width}x${height}:rate=${fps}:duration=${durationSec}`,
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=440:duration=${durationSec}`,
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-shortest',
      '-y',
      outPath
    ],
    { timeout: 30_000 }
  );
  const buffer = await fs.readFile(outPath);
  return { dir, outPath, buffer };
}

describe('fitPhotoAlbumsVideoSize', () => {
  it('maps 16:9 landscape 1080p to 1280x720', () => {
    assert.deepEqual(fitPhotoAlbumsVideoSize(1920, 1080), { width: 1280, height: 720 });
  });

  it('maps 9:16 portrait 1080p to 720x1280', () => {
    assert.deepEqual(fitPhotoAlbumsVideoSize(1080, 1920), { width: 720, height: 1280 });
  });

  it('maps square 1080 to 720x720', () => {
    assert.deepEqual(fitPhotoAlbumsVideoSize(1080, 1080), { width: 720, height: 720 });
  });

  it('does not upscale a smaller clip', () => {
    assert.deepEqual(fitPhotoAlbumsVideoSize(640, 360), { width: 640, height: 360 });
  });
});

describe('parseFfmpegInputProbe', () => {
  it('reads h264/aac 1080p60', () => {
    const probe = parseFfmpegInputProbe(`
Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'a.mp4':
  Duration: 00:00:01.00, start: 0.000000, bitrate: 500 kb/s
    Stream #0:0(und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(progressive), 1920x1080, 400 kb/s, 60 fps, 60 tbr, 15360 tbn (default)
    Stream #0:1(und): Audio: aac (LC) (mp4a / 0x6134706D), 48000 Hz, stereo, fltp, 128 kb/s (default)
`);
    assert.equal(probe.hasVideo, true);
    assert.equal(probe.hasAudio, true);
    assert.equal(probe.videoCodec, 'h264');
    assert.equal(probe.audioCodec, 'aac');
    assert.equal(probe.width, 1920);
    assert.equal(probe.height, 1080);
    assert.equal(probe.fps, 60);
    assert.equal(photoAlbumsVideoNeedsReencode(probe), true);
  });

  it('skips already-compliant portrait 720p30', () => {
    const probe = parseFfmpegInputProbe(`
    Stream #0:0(und): Video: h264 (Main) (avc1 / 0x31637661), yuv420p, 720x1280, 30 fps, 30 tbr, 600 tbn
    Stream #0:1(und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 96 kb/s
`);
    assert.equal(photoAlbumsVideoNeedsReencode(probe), false);
    const shown = { width: probe.width, height: probe.height };
    assert.equal(Math.min(shown.width, shown.height), PHOTO_ALBUMS_VIDEO_SHORT_SIDE_PX);
  });

  it('treats 90-degree rotation as portrait for the short-side check', () => {
    const probe = parseFfmpegInputProbe(`
    Stream #0:0(und): Video: h264 (High) (avc1 / 0x31637661), yuv420p, 1920x1080, 30 fps, 30 tbr, 600 tbn
    Metadata:
      rotate          : 90
`);
    assert.equal(probe.rotationDeg, 90);
    assert.equal(photoAlbumsVideoNeedsReencode(probe), true);
  });
});

describe('normalizePhotoAlbumsVideoBuffer', () => {
  it('downscales 1080p60 portrait to 720x1280 at 30fps', { timeout: 90_000 }, async () => {
    const src = await makeSourceVideo({ width: 1080, height: 1920, fps: 60 });
    try {
      const result = await normalizePhotoAlbumsVideoBuffer(src.buffer, { ext: 'mp4' });
      assert.equal(result.changed, true);
      const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tutaphoto-vid-out-'));
      const outPath = path.join(outDir, 'out.mp4');
      try {
        await fs.writeFile(outPath, result.buffer);
        const probe = await probeFile(outPath);
        assert.equal(probe.width, 720);
        assert.equal(probe.height, 1280);
        assert.ok(probe.fps <= PHOTO_ALBUMS_VIDEO_MAX_FPS + 0.05);
      } finally {
        await fs.rm(outDir, { recursive: true, force: true });
      }
    } finally {
      await fs.rm(src.dir, { recursive: true, force: true });
    }
  });

  it('downscales 1080p60 landscape to 1280x720 at 30fps', { timeout: 90_000 }, async () => {
    const src = await makeSourceVideo({ width: 1920, height: 1080, fps: 60 });
    try {
      const result = await normalizePhotoAlbumsVideoBuffer(src.buffer, { ext: 'mp4' });
      assert.equal(result.changed, true);
      assert.equal(result.ext, 'mp4');
      const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tutaphoto-vid-out-'));
      const outPath = path.join(outDir, 'out.mp4');
      try {
        await fs.writeFile(outPath, result.buffer);
        const probe = await probeFile(outPath);
        assert.equal(probe.videoCodec, 'h264');
        assert.equal(probe.audioCodec, 'aac');
        assert.equal(probe.width, 1280);
        assert.equal(probe.height, 720);
        assert.ok(probe.fps <= PHOTO_ALBUMS_VIDEO_MAX_FPS + 0.05);
      } finally {
        await fs.rm(outDir, { recursive: true, force: true });
      }
    } finally {
      await fs.rm(src.dir, { recursive: true, force: true });
    }
  });

  it('skips re-encode when already 720p30 h264/aac mp4', { timeout: 60_000 }, async () => {
    const src = await makeSourceVideo({ width: 720, height: 1280, fps: 30 });
    try {
      const result = await normalizePhotoAlbumsVideoBuffer(src.buffer, { ext: 'mp4' });
      assert.equal(result.changed, false);
      assert.equal(result.skipped, true);
      assert.equal(result.buffer.length, src.buffer.length);
    } finally {
      await fs.rm(src.dir, { recursive: true, force: true });
    }
  });
});
