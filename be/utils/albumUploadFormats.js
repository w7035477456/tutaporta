/** Album & Posts upload — accepted photo extensions and MIME types. */

export const ALBUM_PHOTO_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'jpe',
  'jif',
  'jfif',
  'jfi',
  'png',
  'apng',
  'gif',
  'svg',
  'webp',
  'avif',
  'tif',
  'tiff',
  'bmp',
  'dib',
  'heic',
  'heif',
  'raw',
  'cr2',
  'nef',
  'arw',
  'dng',
  'orf',
  'psd',
  'ai',
  'eps',
  'ico'
]);

/** Extensions stored as-is (no Sharp resize). */
export const ALBUM_PHOTO_PASSTHROUGH_EXTENSIONS = new Set([
  'svg',
  'eps',
  'raw',
  'psd',
  'cr2',
  'nef',
  'arw',
  'dng',
  'orf',
  'heic',
  'heif',
  'ai',
  'ico',
  'apng'
]);

export const ALBUM_PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/apng',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/tiff',
  'image/bmp',
  'image/x-ms-bmp',
  'image/svg+xml',
  'image/heic',
  'image/heif',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/eps',
  'image/x-eps',
  'application/postscript',
  'application/illustrator',
  'image/vnd.adobe.photoshop',
  'application/x-photoshop',
  'image/x-canon-cr2',
  'image/x-nikon-nef',
  'image/x-sony-arw',
  'image/x-adobe-dng',
  'image/x-olympus-orf',
  'image/x-raw',
  'application/octet-stream'
]);

const EXT_FROM_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/png': 'png',
  'image/apng': 'apng',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/tiff': 'tiff',
  'image/bmp': 'bmp',
  'image/x-ms-bmp': 'bmp',
  'image/svg+xml': 'svg',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/eps': 'eps',
  'image/x-eps': 'eps',
  'application/postscript': 'eps',
  'application/illustrator': 'ai',
  'image/vnd.adobe.photoshop': 'psd',
  'application/x-photoshop': 'psd',
  'image/x-canon-cr2': 'cr2',
  'image/x-nikon-nef': 'nef',
  'image/x-sony-arw': 'arw',
  'image/x-adobe-dng': 'dng',
  'image/x-olympus-orf': 'orf',
  'image/x-raw': 'raw'
};

const CONTENT_TYPE_BY_EXT = {
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
  tiff: 'image/tiff',
  tif: 'image/tiff',
  bmp: 'image/bmp',
  dib: 'image/bmp',
  svg: 'image/svg+xml',
  heic: 'image/heic',
  heif: 'image/heif',
  ico: 'image/x-icon',
  eps: 'application/postscript',
  ai: 'application/illustrator',
  raw: 'application/octet-stream',
  psd: 'image/vnd.adobe.photoshop',
  cr2: 'image/x-canon-cr2',
  nef: 'image/x-nikon-nef',
  arw: 'image/x-sony-arw',
  dng: 'image/x-adobe-dng',
  orf: 'image/x-olympus-orf'
};

export function normalizePhotoExtension(ext) {
  const e = String(ext ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
  if (['jpe', 'jif', 'jfif', 'jfi', 'jpeg'].includes(e)) return 'jpeg';
  if (e === 'tif') return 'tiff';
  if (e === 'dib') return 'bmp';
  return e;
}

export function isAllowedAlbumPhotoExtension(ext) {
  const normalized = normalizePhotoExtension(ext);
  return ALBUM_PHOTO_EXTENSIONS.has(normalized) || ALBUM_PHOTO_EXTENSIONS.has(ext);
}

export function isPassthroughAlbumPhotoExtension(ext) {
  return ALBUM_PHOTO_PASSTHROUGH_EXTENSIONS.has(normalizePhotoExtension(ext));
}

export function isAllowedAlbumPhotoContentType(contentType, fileExtension = '') {
  const base = String(contentType ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (ALBUM_PHOTO_MIME_TYPES.has(base)) {
    if (base === 'application/octet-stream') {
      return isAllowedAlbumPhotoExtension(fileExtension);
    }
    return true;
  }
  return false;
}

export function contentTypeToExt(contentType, fileExtension = '') {
  const base = String(contentType ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (EXT_FROM_MIME[base]) return EXT_FROM_MIME[base];
  const ext = normalizePhotoExtension(fileExtension);
  if (ext && isAllowedAlbumPhotoExtension(ext)) return ext === 'jpeg' ? 'jpg' : ext;
  const t = base;
  if (t.includes('svg')) return 'svg';
  if (t.includes('avif')) return 'avif';
  if (t.includes('tiff')) return 'tiff';
  if (t.includes('bmp')) return 'bmp';
  if (t.includes('heic')) return 'heic';
  if (t.includes('heif')) return 'heif';
  if (t.includes('icon')) return 'ico';
  if (t.includes('eps') || t.includes('postscript')) return 'eps';
  if (t.includes('illustrator') || t.endsWith('/ai')) return 'ai';
  if (t.includes('photoshop') || t.includes('psd')) return 'psd';
  if (t.includes('cr2') || t.includes('canon')) return 'cr2';
  if (t.includes('nef') || t.includes('nikon')) return 'nef';
  if (t.includes('arw') || t.includes('sony')) return 'arw';
  if (t.includes('dng')) return 'dng';
  if (t.includes('orf') || t.includes('olympus')) return 'orf';
  if (t.includes('raw')) return 'raw';
  if (t.includes('webp')) return 'webp';
  if (t.includes('apng')) return 'apng';
  if (t.includes('png')) return 'png';
  if (t.includes('gif')) return 'gif';
  return 'jpg';
}

export function extToContentType(ext) {
  const e = normalizePhotoExtension(ext);
  return CONTENT_TYPE_BY_EXT[e] || CONTENT_TYPE_BY_EXT[ext] || 'image/jpeg';
}

export const ALBUM_PHOTO_EXTENSIONS_ERROR =
  'jpg, jpeg, jpe, png, gif, svg, webp, avif, tiff, bmp, heic, heif, raw, cr2, nef, arw, dng, orf, psd, ai, eps, ico, and apng';
