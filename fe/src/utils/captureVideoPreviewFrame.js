/**
 * Capture a still frame from a video blob/URL for inline note previews.
 * Skips mostly-black / empty frames (common at t=0) by probing several seek times.
 */

const SEEK_FRACTIONS = [0.05, 0.1, 0.2, 0.35, 0.5];
const SEEK_SECONDS = [0.1, 0.5, 1, 2, 3];
const MAX_FRAME_EDGE = 960;
const BLACK_LUMA = 28;
const MIN_NON_BLACK_RATIO = 0.04;

function waitForEvent(target, eventName, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`Timeout waiting for ${eventName}`));
    }, timeoutMs);

    const onOk = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const onErr = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`Video ${eventName} failed`));
    };

    const cleanup = () => {
      clearTimeout(timer);
      target.removeEventListener(eventName, onOk);
      target.removeEventListener('error', onErr);
    };

    target.addEventListener(eventName, onOk, { once: true });
    target.addEventListener('error', onErr, { once: true });
  });
}

function seekVideo(video, timeSec) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      video.removeEventListener('seeked', onSeeked);
      reject(new Error('Seek timeout'));
    }, 8000);

    const onSeeked = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };

    video.addEventListener('seeked', onSeeked, { once: true });
    try {
      const duration = Number(video.duration);
      const maxT = Number.isFinite(duration) && duration > 0 ? Math.max(0, duration - 0.05) : timeSec;
      video.currentTime = Math.min(Math.max(0, timeSec), maxT);
    } catch (err) {
      clearTimeout(timer);
      video.removeEventListener('seeked', onSeeked);
      reject(err);
    }
  });
}

function frameNonBlackRatio(ctx, width, height) {
  const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 48));
  let total = 0;
  let nonBlack = 0;
  const { data } = ctx.getImageData(0, 0, width, height);
  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      if (a < 8) continue;
      total += 1;
      const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      if (luma > BLACK_LUMA) nonBlack += 1;
    }
  }
  return total > 0 ? nonBlack / total : 0;
}

function canvasToObjectUrl(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not encode preview frame'));
          return;
        }
        resolve(URL.createObjectURL(blob));
      },
      'image/jpeg',
      0.85
    );
  });
}

function buildSeekTimes(duration) {
  const times = new Set();
  for (const sec of SEEK_SECONDS) times.add(sec);
  if (Number.isFinite(duration) && duration > 0) {
    for (const frac of SEEK_FRACTIONS) {
      times.add(duration * frac);
    }
    times.add(Math.min(0.25, duration * 0.5));
  } else {
    times.add(0.25);
  }
  return [...times]
    .filter((t) => Number.isFinite(t) && t >= 0)
    .sort((a, b) => a - b)
    .slice(0, 8);
}

/**
 * @param {string} videoSrc — blob: or http(s) URL
 * @returns {Promise<string|null>} object URL of a JPEG still (caller must revoke)
 */
export async function captureVideoPreviewFrame(videoSrc) {
  const src = String(videoSrc || '').trim();
  if (!src || typeof document === 'undefined') return null;

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  // blob: URLs are same-origin; do not set crossOrigin (can block canvas readback).
  video.src = src;

  try {
    await waitForEvent(video, 'loadeddata');
    // Some browsers need play→pause before canvas draw is allowed / non-empty.
    try {
      await video.play();
      video.pause();
    } catch {
      // Autoplay blocked — still try seek + draw.
    }

    const duration = Number(video.duration);
    const seekTimes = buildSeekTimes(duration);
    let bestUrl = null;
    let bestScore = -1;

    for (const t of seekTimes) {
      try {
        await seekVideo(video, t);
      } catch {
        continue;
      }

      const vw = video.videoWidth || 0;
      const vh = video.videoHeight || 0;
      if (vw < 2 || vh < 2) continue;

      const scale = Math.min(1, MAX_FRAME_EDGE / Math.max(vw, vh));
      const width = Math.max(1, Math.round(vw * scale));
      const height = Math.max(1, Math.round(vh * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;

      try {
        ctx.drawImage(video, 0, 0, width, height);
      } catch {
        continue;
      }

      const score = frameNonBlackRatio(ctx, width, height);
      if (score < MIN_NON_BLACK_RATIO) continue;

      const url = await canvasToObjectUrl(canvas);
      if (score > bestScore) {
        if (bestUrl) URL.revokeObjectURL(bestUrl);
        bestUrl = url;
        bestScore = score;
      } else {
        URL.revokeObjectURL(url);
      }

      // Good enough — stop early.
      if (bestScore >= 0.12) break;
    }

    return bestUrl;
  } catch {
    return null;
  } finally {
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch {
      // ignore
    }
  }
}
