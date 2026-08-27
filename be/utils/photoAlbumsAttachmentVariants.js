import sharp from 'sharp';

/** Bytes — photos larger than this are re-encoded toward ~TARGET. */
export const PHOTO_ALBUMS_NORMALIZE_OVER_BYTES = 1024 * 1024;
/** Target size after normalize (~0.5 MB). */
export const PHOTO_ALBUMS_NORMALIZE_TARGET_BYTES = 512 * 1024;
/** Long-edge for album page display files (`att_N_1000px.jpg`). */
export const PHOTO_ALBUMS_DISPLAY_MAX_EDGE_PX = 1000;
/** Long-edge for thumbnail alley (`att_N_thumbnail.jpg`). */
export const PHOTO_ALBUMS_THUMB_MAX_EDGE_PX = 320;

const RASTER_IMAGE_EXTS = new Set([
  'jpg',
  'jpeg',
  'jpe',
  'jif',
  'jfif',
  'jfi',
  'png',
  'apng',
  'gif',
  'webp',
  'avif',
  'tif',
  'tiff',
  'bmp',
  'dib',
  'heic',
  'heif'
]);

export function isPhotoAlbumsRasterImageExtension(ext) {
  return RASTER_IMAGE_EXTS.has(String(ext || '').replace(/^\./, '').toLowerCase());
}

export function normalizeAttachmentVariant(raw) {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (v === 'thumb' || v === 'thumbnail' || v === 'alley') return 'thumb';
  if (v === 'display' || v === '1000' || v === '1000px' || v === 'page') return 'display';
  return 'full';
}

/**
 * Sibling files next to att_{id}.jpg:
 *   att_{id}_1000px.jpg
 *   att_{id}_thumbnail.jpg
 */
export function fileRelativePathForVariant(baseRelativePath, variant) {
  const rel = String(baseRelativePath || '').replace(/\\/g, '/');
  const v = normalizeAttachmentVariant(variant);
  if (v === 'full' || !rel) return rel;
  const m = rel.match(/^(.*\/)?(att_\d+)\.([^.]+)$/i);
  if (!m) return rel;
  const dir = m[1] || '';
  const stem = m[2];
  if (v === 'display') return `${dir}${stem}_1000px.jpg`;
  return `${dir}${stem}_thumbnail.jpg`;
}

async function encodeJpegWithMaxEdge(buffer, maxEdge, quality) {
  let pipeline = sharp(buffer, { failOn: 'none' }).rotate();
  const meta = await pipeline.metadata();
  const w = Number(meta.width) || 0;
  const h = Number(meta.height) || 0;
  if (w > maxEdge || h > maxEdge) {
    pipeline = sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize({
        width: maxEdge,
        height: maxEdge,
        fit: 'inside',
        withoutEnlargement: true
      });
  } else {
    pipeline = sharp(buffer, { failOn: 'none' }).rotate();
  }
  return pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
}

/**
 * If buffer > 1MB, re-encode toward ~0.5MB JPEG (always .jpg).
 * Under 1MB: leave bytes as-is (caller keeps original ext) unless forceJpeg.
 */
export async function normalizePhotoAlbumsAttachmentBuffer(buffer, { forceJpeg = false } = {}) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    throw new Error('Empty image');
  }
  if (buffer.length <= PHOTO_ALBUMS_NORMALIZE_OVER_BYTES && !forceJpeg) {
    return { buffer, normalized: false, changed: false };
  }

  let maxEdge = 2400;
  let quality = 85;
  let best = await encodeJpegWithMaxEdge(buffer, maxEdge, quality);

  // Iteratively tighten until near 0.5MB (or floors).
  for (let i = 0; i < 8; i += 1) {
    if (best.length <= PHOTO_ALBUMS_NORMALIZE_TARGET_BYTES) break;
    if (quality > 55) {
      quality -= 8;
    } else if (maxEdge > 1200) {
      maxEdge = Math.round(maxEdge * 0.82);
      quality = Math.min(quality + 4, 78);
    } else {
      quality = Math.max(40, quality - 5);
    }
    best = await encodeJpegWithMaxEdge(buffer, maxEdge, quality);
  }

  // If still huge, one more hard shrink.
  if (best.length > PHOTO_ALBUMS_NORMALIZE_TARGET_BYTES * 1.35 && maxEdge > 900) {
    best = await encodeJpegWithMaxEdge(buffer, 900, 55);
  }

  return {
    buffer: best,
    normalized: true,
    changed: true,
    ext: 'jpg',
    mimeType: 'image/jpeg'
  };
}

export async function buildPhotoAlbumsDisplay1000pxBuffer(buffer) {
  const out = await encodeJpegWithMaxEdge(
    buffer,
    PHOTO_ALBUMS_DISPLAY_MAX_EDGE_PX,
    82
  );
  return out;
}

export async function buildPhotoAlbumsThumbnailBuffer(buffer) {
  const out = await encodeJpegWithMaxEdge(buffer, PHOTO_ALBUMS_THUMB_MAX_EDGE_PX, 80);
  return out;
}
