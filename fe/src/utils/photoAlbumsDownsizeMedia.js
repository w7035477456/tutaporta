/**
 * Client-side downsizing for TutaPhoto uploads that exceed the free-tier size caps.
 *
 * Images are re-encoded to JPEG, stepping quality down first (cheap, keeps
 * resolution) and only then shrinking dimensions. Videos cannot be transcoded in
 * the browser without shipping a WASM encoder, so callers must treat an
 * oversized video as a downsize failure and tell the user to resize externally.
 */

const QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4];
const SCALE_STEPS = [1, 0.8, 0.64, 0.5, 0.4, 0.32, 0.25, 0.2];

/** Browsers have no built-in video transcoder. */
export const CAN_DOWNSIZE_VIDEO_IN_BROWSER = false;

export function bytesToMbLabel(bytes) {
  return (Number(bytes || 0) / (1024 * 1024)).toFixed(1);
}

function jpegFileName(name) {
  const base = String(name || 'photo').replace(/\.[^.]+$/, '');
  return `${base || 'photo'}.jpg`;
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
    } catch {
      resolve(null);
    }
  });
}

async function decodeImageFile(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the <img> path — Safari/HEIC often needs it.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('decode failed'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Shrink an image until it fits `maxMb`.
 *
 * @returns {Promise<File|null>} the smaller file, the original when it already
 *   fit, or null when the image could not be decoded or could not be squeezed
 *   under the cap.
 */
export async function downsizeImageFileToMaxMb(file, maxMb) {
  const maxBytes = Math.floor(Number(maxMb) * 1024 * 1024);
  if (!file || !Number.isFinite(maxBytes) || maxBytes <= 0) return null;
  if (file.size <= maxBytes) return file;

  let source = null;
  try {
    source = await decodeImageFile(file);
  } catch {
    return null;
  }
  const srcWidth = source?.width || source?.naturalWidth || 0;
  const srcHeight = source?.height || source?.naturalHeight || 0;
  if (!srcWidth || !srcHeight) {
    source?.close?.();
    return null;
  }

  try {
    for (const scale of SCALE_STEPS) {
      const width = Math.max(1, Math.round(srcWidth * scale));
      const height = Math.max(1, Math.round(srcHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(source, 0, 0, width, height);
      for (const quality of QUALITY_STEPS) {
        // eslint-disable-next-line no-await-in-loop
        const blob = await canvasToBlob(canvas, quality);
        if (blob && blob.size > 0 && blob.size <= maxBytes) {
          return new File([blob], jpegFileName(file.name), {
            type: 'image/jpeg',
            lastModified: file.lastModified || Date.now()
          });
        }
      }
    }
  } catch {
    return null;
  } finally {
    source?.close?.();
  }
  return null;
}
