import zlib from 'zlib';
import sharp from 'sharp';

/**
 * Extensions that browsers often cannot render in <img> (Chrome), but sharp can
 * decode — convert to JPEG for ?inline=1 / ?view=1 preview responses.
 */
const SHARP_INLINE_PREVIEW_EXTENSIONS = new Set(['tif', 'tiff', 'heic', 'heif', 'svgz']);

/** Browser-native raster/vector — serve original bytes with a correct image MIME. */
const BROWSER_NATIVE_IMAGE_EXTENSIONS = new Set([
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
  'bmp',
  'dib',
  'svg',
  'ico'
]);

const PREVIEW_MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpe: 'image/jpeg',
  jif: 'image/jpeg',
  jfif: 'image/jpeg',
  jfi: 'image/jpeg',
  png: 'image/png',
  apng: 'image/apng',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  dib: 'image/bmp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  heic: 'image/heic',
  heif: 'image/heif',
  svgz: 'image/svg+xml'
};

function normalizeExt(ext) {
  return String(ext || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
}

function gunzipIfNeeded(buffer) {
  if (!buffer?.length || buffer.length < 2) return buffer;
  // gzip magic 1f 8b
  if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
    try {
      return zlib.gunzipSync(buffer);
    } catch {
      return buffer;
    }
  }
  return buffer;
}

/**
 * For inline album thumbs / page slots: return browser-displayable bytes.
 * Non-inline downloads should keep the original vault buffer.
 *
 * @returns {Promise<{ buffer: Buffer, contentType: string, converted: boolean }>}
 */
export async function photoAlbumsInlinePreviewPayload(buffer, ext, fallbackContentType) {
  const normalized = normalizeExt(ext);
  const originalType =
    String(fallbackContentType || '').trim() ||
    PREVIEW_MIME_BY_EXT[normalized] ||
    'application/octet-stream';

  if (!buffer?.length) {
    return { buffer, contentType: originalType, converted: false };
  }

  if (BROWSER_NATIVE_IMAGE_EXTENSIONS.has(normalized)) {
    return {
      buffer,
      contentType: PREVIEW_MIME_BY_EXT[normalized] || originalType,
      converted: false
    };
  }

  if (!SHARP_INLINE_PREVIEW_EXTENSIONS.has(normalized)) {
    return { buffer, contentType: originalType, converted: false };
  }

  try {
    let input = buffer;
    if (normalized === 'svgz') {
      input = gunzipIfNeeded(buffer);
      // After gunzip, SVG is browser-native — prefer serving SVG over rasterizing.
      if (input !== buffer || String.fromCharCode(input[0] || 0) === '<') {
        const looksSvg =
          input.includes(Buffer.from('<svg')) ||
          input.includes(Buffer.from('<SVG')) ||
          input.slice(0, 200).toString('utf8').includes('svg');
        if (looksSvg) {
          return { buffer: input, contentType: 'image/svg+xml', converted: true };
        }
      }
    }

    const jpeg = await sharp(input, { failOn: 'none' })
      .rotate()
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
    if (!jpeg?.length) {
      return { buffer, contentType: originalType, converted: false };
    }
    return { buffer: jpeg, contentType: 'image/jpeg', converted: true };
  } catch (err) {
    console.warn('[photoAlbumsInlinePreview] convert failed', normalized, err?.message || err);
    return { buffer, contentType: originalType, converted: false };
  }
}

export function isPhotoAlbumsInlinePreviewExtension(ext) {
  const normalized = normalizeExt(ext);
  return (
    BROWSER_NATIVE_IMAGE_EXTENSIONS.has(normalized) || SHARP_INLINE_PREVIEW_EXTENSIONS.has(normalized)
  );
}
