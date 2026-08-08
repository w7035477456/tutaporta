import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);
const THUMB_SIZE_PX = 256;
const ICON_WIDTH_RATIO = 0.32;
const ICON_INSET_RATIO = 0.06;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_ICON_PATH = path.resolve(__dirname, '../assets/images/videoIcon.png');

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

function isAudioOnlyVideoPath(videoPath) {
  return String(videoPath ?? '').toLowerCase().endsWith('.mp3');
}

/**
 * @param {string} videoPath — absolute path to saved video file
 * @returns {Promise<Buffer|null>}
 */
async function extractVideoFramePng(videoPath) {
  if (isAudioOnlyVideoPath(videoPath)) return null;

  const ffmpeg = await resolveFfmpegPath();
  try {
    const { stdout } = await execFileAsync(
      ffmpeg,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-ss',
        '0.1',
        '-i',
        videoPath,
        '-vframes',
        '1',
        '-f',
        'image2pipe',
        '-vcodec',
        'png',
        'pipe:1'
      ],
      { maxBuffer: 16 * 1024 * 1024, encoding: 'buffer' }
    );
    return stdout?.length ? stdout : null;
  } catch (err) {
    console.error('[generateVideoThumbnail] ffmpeg frame extract failed:', err?.message ?? err);
    return null;
  }
}

/**
 * Create JPEG thumbnail with play-icon overlay; return filename (not full path).
 * @param {{ videoFullPath: string, videoFileName: string, outputDir: string }} params
 * @returns {Promise<string|null>}
 */
export async function generateAndSaveVideoThumbnail({ videoFullPath, videoFileName, outputDir }) {
  const baseName = String(videoFileName ?? '').trim();
  const dir = String(outputDir ?? '').trim();
  if (!baseName || !dir || !videoFullPath || !fs.existsSync(videoFullPath)) return null;
  if (!fs.existsSync(VIDEO_ICON_PATH)) {
    console.error('[generateVideoThumbnail] missing icon asset:', VIDEO_ICON_PATH);
    return null;
  }

  const framePng = await extractVideoFramePng(videoFullPath);
  if (!framePng?.length) return null;

  const thumbFileName = `${baseName}_thumb.jpg`;
  const thumbFullPath = path.join(dir, thumbFileName);

  try {
    const frameBuffer = await sharp(framePng).resize(THUMB_SIZE_PX, THUMB_SIZE_PX, { fit: 'cover' }).png().toBuffer();

    const iconWidth = Math.max(24, Math.round(THUMB_SIZE_PX * ICON_WIDTH_RATIO));
    const inset = Math.round(THUMB_SIZE_PX * ICON_INSET_RATIO);
    const iconBuffer = await sharp(VIDEO_ICON_PATH).resize(iconWidth).png().toBuffer();
    const iconMeta = await sharp(iconBuffer).metadata();
    const iconHeight = Number(iconMeta.height) || iconWidth;
    const iconLeft = inset;
    const iconTop = Math.max(0, THUMB_SIZE_PX - iconHeight - inset);

    await sharp(frameBuffer)
      .composite([{ input: iconBuffer, top: iconTop, left: iconLeft }])
      .jpeg({ quality: 85 })
      .toFile(thumbFullPath);

    return thumbFileName;
  } catch (err) {
    console.error('[generateVideoThumbnail] sharp composite failed:', err?.message ?? err);
    try {
      if (fs.existsSync(thumbFullPath)) fs.unlinkSync(thumbFullPath);
    } catch {
      // ignore cleanup failure
    }
    return null;
  }
}

export function videoThumbnailFileNameForVideoFileName(videoFileName) {
  const base = String(videoFileName ?? '').trim();
  return base ? `${base}_thumb.jpg` : '';
}
