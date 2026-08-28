/**
 * Decoders for formats the bundled libvips build cannot read:
 *   - HEIC / HEIF: prebuilt sharp ships libheif without the HEVC codec, so pixel
 *     decode fails ("source: bad seek") even though metadata parses fine.
 *   - BMP / DIB and ICO: the `magick` loader is absent from the prebuilt build,
 *     so libvips has no reader for either.
 *
 * Each falls back to a pure-JS/WASM decoder that hands pixels back to sharp.
 */

/** ISO-BMFF brands that mean HEVC-coded HEIF (AVIF brands are excluded — sharp reads those). */
const HEIF_HEVC_BRANDS = new Set([
  'heic',
  'heix',
  'heim',
  'heis',
  'hevc',
  'hevx',
  'hevm',
  'hevs',
  'mif1',
  'msf1'
]);

/**
 * Identify a buffer that may need a fallback decoder, using magic bytes rather
 * than the file extension. Returns 'heic' | 'bmp' | 'ico' | null.
 */
export function sniffPhotoAlbumsFallbackFormat(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return null;
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return 'bmp';
  // ICONDIR: reserved 0x0000, type 1 (icon) or 2 (cursor), then image count.
  if (
    buffer.readUInt16LE(0) === 0 &&
    (buffer.readUInt16LE(2) === 1 || buffer.readUInt16LE(2) === 2) &&
    buffer.readUInt16LE(4) >= 1
  ) {
    return 'ico';
  }
  if (buffer.toString('latin1', 4, 8) === 'ftyp') {
    const brand = buffer.toString('latin1', 8, 12).toLowerCase();
    if (HEIF_HEVC_BRANDS.has(brand)) return 'heic';
  }
  return null;
}

let heicDecodePromise = null;
function loadHeicDecode() {
  if (!heicDecodePromise) {
    heicDecodePromise = import('heic-decode').then((mod) => mod?.default || mod);
  }
  return heicDecodePromise;
}

let bmpDecodePromise = null;
function loadBmpDecode() {
  if (!bmpDecodePromise) {
    bmpDecodePromise = import('bmp-js').then((mod) => mod?.default || mod);
  }
  return bmpDecodePromise;
}

async function decodeHeicToRaw(buffer) {
  const decode = await loadHeicDecode();
  const { width, height, data } = await decode({ buffer });
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1 || !data?.length) {
    throw new Error('HEIC decode produced no pixels');
  }
  return {
    input: Buffer.from(data.buffer || data, data.byteOffset || 0, data.length),
    options: { raw: { width: w, height: h, channels: 4 } }
  };
}

let icoDecodePromise = null;
function loadIcoDecode() {
  if (!icoDecodePromise) {
    icoDecodePromise = import('decode-ico').then((mod) => mod?.default || mod);
  }
  return icoDecodePromise;
}

async function decodeIcoToRaw(buffer) {
  const decode = await loadIcoDecode();
  const frames = decode(buffer);
  if (!frames?.length) throw new Error('ICO has no frames');
  // Largest frame wins — icons pack several sizes.
  const frame = frames.reduce((best, f) =>
    Number(f.width) * Number(f.height) > Number(best.width) * Number(best.height) ? f : best
  );
  const data = Buffer.from(frame.data);
  // PNG-payload frames come back as encoded PNG bytes; BMP frames as RGBA pixels.
  if (frame.type === 'png') {
    return { input: data, options: { failOn: 'none' } };
  }
  return {
    input: data,
    options: { raw: { width: Number(frame.width), height: Number(frame.height), channels: 4 } }
  };
}

async function decodeBmpToRaw(buffer) {
  const bmp = await loadBmpDecode();
  const decoded = bmp.decode(buffer);
  const w = Number(decoded?.width);
  const h = Number(decoded?.height);
  const src = decoded?.data;
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1 || !src?.length) {
    throw new Error('BMP decode produced no pixels');
  }
  // bmp-js packs 4 bytes per pixel with red at offset 2 and blue at offset 0.
  // Alpha is dropped: every consumer re-encodes to JPEG.
  const rgb = Buffer.allocUnsafe(w * h * 3);
  for (let i = 0, j = 0; j < rgb.length; i += 4, j += 3) {
    rgb[j] = src[i + 2];
    rgb[j + 1] = src[i + 1];
    rgb[j + 2] = src[i];
  }
  return { input: rgb, options: { raw: { width: w, height: h, channels: 3 } } };
}

/**
 * Decode a buffer sharp could not open into raw pixels.
 * Returns `{ input, options }` ready for `sharp(input, options)`, or null when
 * the format is not one we have a fallback for.
 */
export async function decodePhotoAlbumsImageFallback(buffer, ext = '') {
  const cleanExt = String(ext || '')
    .replace(/^\./, '')
    .toLowerCase();
  let kind = sniffPhotoAlbumsFallbackFormat(buffer);
  if (!kind) {
    if (cleanExt === 'heic' || cleanExt === 'heif' || cleanExt === 'hif') kind = 'heic';
    else if (cleanExt === 'bmp' || cleanExt === 'dib') kind = 'bmp';
    else if (cleanExt === 'ico' || cleanExt === 'cur') kind = 'ico';
  }
  if (kind === 'heic') return decodeHeicToRaw(buffer);
  if (kind === 'bmp') return decodeBmpToRaw(buffer);
  if (kind === 'ico') return decodeIcoToRaw(buffer);
  return null;
}
