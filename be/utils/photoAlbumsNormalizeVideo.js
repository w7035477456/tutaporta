/**
 * Normalize TutaPhotoAlbums video uploads to 720p-by-short-side, ≤30 fps,
 * H.264 + AAC MP4. Stops 4K / 60 fps phone clips from wasting vault space.
 *
 * Called from vaultAddNoteAttachment on every new video (web, mobile, USB
 * transfer, cross-pane). Photos, overlay text, and the 100 MB upload cap
 * are unchanged. Failures leave the original bytes so an upload still lands.
 */

import { execFile } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

import { isPhotoAlbumsStagingVideoExtension } from './photoAlbumsFileFormats.js';

const execFileAsync = promisify(execFile);

export const PHOTO_ALBUMS_VIDEO_SHORT_SIDE_PX = 720;
export const PHOTO_ALBUMS_VIDEO_MAX_FPS = 30;
export const PHOTO_ALBUMS_VIDEO_CRF = 23;
export const PHOTO_ALBUMS_VIDEO_PRESET = 'medium';
export const PHOTO_ALBUMS_VIDEO_OUT_EXT = 'mp4';
export const PHOTO_ALBUMS_VIDEO_OUT_MIME = 'video/mp4';

const PROBE_TIMEOUT_MS = 30_000;
const ENCODE_TIMEOUT_MS = 10 * 60 * 1000;
const FPS_EPSILON = 0.05;

let ffmpegPathPromise;

async function resolveFfmpegPath() {
  if (!ffmpegPathPromise) {
    ffmpegPathPromise = (async () => {
      try {
        const mod = await import('ffmpeg-static');
        if (mod?.default) return mod.default;
      } catch {
        // fall through to system ffmpeg
      }
      return 'ffmpeg';
    })();
  }
  return ffmpegPathPromise;
}

function evenPx(n) {
  const i = Math.max(2, Math.round(Number(n) || 0));
  return i % 2 === 0 ? i : i - 1;
}

function isH264Codec(name) {
  return /^(h264|avc1|avc|libx264)$/i.test(String(name || '').trim());
}

function isAacCodec(name) {
  return /^(aac|mp4a)$/i.test(String(name || '').trim());
}

/**
 * Fit inside 720p-by-short-side without upscaling. Aspect ratio kept; both
 * edges even so yuv420p encode succeeds.
 */
export function fitPhotoAlbumsVideoSize(width, height) {
  const w = Math.max(0, Number(width) || 0);
  const h = Math.max(0, Number(height) || 0);
  if (!(w > 0 && h > 0)) return { width: 0, height: 0 };
  const short = Math.min(w, h);
  if (short <= PHOTO_ALBUMS_VIDEO_SHORT_SIDE_PX) {
    return { width: evenPx(w), height: evenPx(h) };
  }
  const scale = PHOTO_ALBUMS_VIDEO_SHORT_SIDE_PX / short;
  return { width: evenPx(w * scale), height: evenPx(h * scale) };
}

export function displayVideoSize(probe) {
  const w = Number(probe?.width) || 0;
  const h = Number(probe?.height) || 0;
  const rot = Math.abs(Number(probe?.rotationDeg) || 0) % 180;
  if (rot === 90) return { width: h, height: w };
  return { width: w, height: h };
}

export function parseFfmpegInputProbe(stderr) {
  const text = String(stderr || '');
  const videoLine = text.split('\n').find((line) => /Stream #.*Video:/i.test(line)) || '';
  const audioLine = text.split('\n').find((line) => /Stream #.*Audio:/i.test(line)) || '';

  let videoCodec = '';
  const codecMatch = videoLine.match(/Video:\s*([^\s,(]+)/i);
  if (codecMatch) videoCodec = String(codecMatch[1]).replace(/,$/, '');

  let width = 0;
  let height = 0;
  const dimMatch = videoLine.match(/\b(\d{2,5})x(\d{2,5})\b/);
  if (dimMatch) {
    width = Number(dimMatch[1]) || 0;
    height = Number(dimMatch[2]) || 0;
  }

  let fps = 0;
  const fpsMatch = videoLine.match(/(\d+(?:\.\d+)?)\s*fps/i);
  if (fpsMatch) fps = Number(fpsMatch[1]) || 0;
  if (!fps) {
    const tbrMatch = videoLine.match(/(\d+(?:\.\d+)?)\s*tbr/i);
    if (tbrMatch) fps = Number(tbrMatch[1]) || 0;
  }

  let audioCodec = '';
  const audioMatch = audioLine.match(/Audio:\s*([^\s,(]+)/i);
  if (audioMatch) audioCodec = String(audioMatch[1]).replace(/,$/, '');

  let rotationDeg = 0;
  const rotateMeta = text.match(/rotate\s*:\s*(-?\d+(?:\.\d+)?)/i);
  const rotateSide = text.match(/rotation of\s*(-?\d+(?:\.\d+)?)\s*degrees/i);
  if (rotateMeta) rotationDeg = Number(rotateMeta[1]) || 0;
  else if (rotateSide) rotationDeg = Number(rotateSide[1]) || 0;

  return {
    hasVideo: Boolean(videoLine && width > 0 && height > 0),
    hasAudio: Boolean(audioLine),
    videoCodec,
    audioCodec,
    width,
    height,
    fps,
    rotationDeg
  };
}

export function photoAlbumsVideoNeedsReencode(probe) {
  if (!probe?.hasVideo) return false;
  const shown = displayVideoSize(probe);
  const short = Math.min(shown.width, shown.height);
  if (short > PHOTO_ALBUMS_VIDEO_SHORT_SIDE_PX) return true;
  if ((Number(probe.fps) || 0) > PHOTO_ALBUMS_VIDEO_MAX_FPS + FPS_EPSILON) return true;
  if (!isH264Codec(probe.videoCodec)) return true;
  if (probe.hasAudio && !isAacCodec(probe.audioCodec)) return true;
  return false;
}

async function probeInputFile(ffmpeg, inputPath) {
  let stderr = '';
  try {
    const result = await execFileAsync(ffmpeg, ['-hide_banner', '-i', inputPath], {
      encoding: 'utf8',
      timeout: PROBE_TIMEOUT_MS,
      maxBuffer: 2 * 1024 * 1024
    });
    stderr = `${result.stderr || ''}\n${result.stdout || ''}`;
  } catch (err) {
    stderr = `${err?.stderr || ''}\n${err?.stdout || ''}`;
  }
  return parseFfmpegInputProbe(stderr);
}

async function runFfmpeg(ffmpeg, args, timeoutMs) {
  try {
    await execFileAsync(ffmpeg, args, {
      timeout: timeoutMs,
      maxBuffer: 2 * 1024 * 1024
    });
  } catch (err) {
    const detail = String(err?.stderr || err?.message || err).trim();
    throw new Error(detail || 'ffmpeg failed');
  }
}

/**
 * @returns {Promise<{ buffer: Buffer, changed: boolean, skipped: boolean, ext: string, mimeType: string }>}
 */
export async function normalizePhotoAlbumsVideoBuffer(buffer, { ext = '' } = {}) {
  const cleanExt = String(ext || '').replace(/^\./, '').toLowerCase();
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    return {
      buffer,
      changed: false,
      skipped: true,
      ext: cleanExt || PHOTO_ALBUMS_VIDEO_OUT_EXT,
      mimeType: PHOTO_ALBUMS_VIDEO_OUT_MIME
    };
  }
  if (!isPhotoAlbumsStagingVideoExtension(cleanExt)) {
    return { buffer, changed: false, skipped: true, ext: cleanExt, mimeType: '' };
  }

  const ffmpeg = await resolveFfmpegPath();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tutaphoto-vid-'));
  const inputPath = path.join(tmpDir, `in.${cleanExt || 'mp4'}`);
  const outputPath = path.join(tmpDir, 'out.mp4');

  try {
    await fs.writeFile(inputPath, buffer);
    const probe = await probeInputFile(ffmpeg, inputPath);
    if (!probe.hasVideo) {
      return {
        buffer,
        changed: false,
        skipped: true,
        ext: cleanExt,
        mimeType: PHOTO_ALBUMS_VIDEO_OUT_MIME
      };
    }

    const needsReencode = photoAlbumsVideoNeedsReencode(probe);
    const alreadyMp4 = cleanExt === PHOTO_ALBUMS_VIDEO_OUT_EXT;

    if (!needsReencode && alreadyMp4) {
      return {
        buffer,
        changed: false,
        skipped: true,
        ext: PHOTO_ALBUMS_VIDEO_OUT_EXT,
        mimeType: PHOTO_ALBUMS_VIDEO_OUT_MIME
      };
    }

    if (!needsReencode) {
      await runFfmpeg(
        ffmpeg,
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-i',
          inputPath,
          '-map',
          '0:v:0',
          '-map',
          '0:a:0?',
          '-c',
          'copy',
          '-movflags',
          '+faststart',
          outputPath
        ],
        ENCODE_TIMEOUT_MS
      );
    } else {
      const shown = displayVideoSize(probe);
      const target = fitPhotoAlbumsVideoSize(shown.width, shown.height);
      const capFps = (Number(probe.fps) || 0) > PHOTO_ALBUMS_VIDEO_MAX_FPS + FPS_EPSILON;
      const filters = [];
      if (capFps) filters.push(`fps=${PHOTO_ALBUMS_VIDEO_MAX_FPS}`);
      if (target.width > 0 && target.height > 0) {
        filters.push(`scale=${target.width}:${target.height}`);
      }
      const args = [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        inputPath,
        '-map',
        '0:v:0',
        '-map',
        '0:a:0?',
        '-c:v',
        'libx264',
        '-preset',
        PHOTO_ALBUMS_VIDEO_PRESET,
        '-crf',
        String(PHOTO_ALBUMS_VIDEO_CRF),
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-ac',
        '2',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        outputPath
      ];
      if (filters.length) {
        args.splice(args.indexOf('-c:v'), 0, '-vf', filters.join(','));
      }
      await runFfmpeg(ffmpeg, args, ENCODE_TIMEOUT_MS);
    }

    const out = await fs.readFile(outputPath);
    if (!out?.length) throw new Error('ffmpeg produced an empty file');
    return {
      buffer: out,
      changed: true,
      skipped: false,
      ext: PHOTO_ALBUMS_VIDEO_OUT_EXT,
      mimeType: PHOTO_ALBUMS_VIDEO_OUT_MIME
    };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
