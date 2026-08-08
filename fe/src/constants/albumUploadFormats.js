/** Album & Posts upload — accepted photo extensions (matches BE albumUploadFormats.js). */

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

const ALBUM_PHOTO_MIME_TYPES = new Set([
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
  'application/pdf',
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

/** Normalize aliases to a canonical extension used in allow-lists. */
export function normalizeAlbumPhotoExtension(ext) {
  const e = String(ext ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
  if (['jpe', 'jif', 'jfif', 'jfi', 'jpeg'].includes(e)) return 'jpeg';
  if (e === 'jpg') return 'jpg';
  if (e === 'tif') return 'tiff';
  if (e === 'dib') return 'bmp';
  return e;
}

export function getAlbumPhotoExtension(fileName) {
  if (!fileName || typeof fileName !== 'string') return '';
  const i = fileName.lastIndexOf('.');
  if (i <= 0 || i === fileName.length - 1) return '';
  return normalizeAlbumPhotoExtension(fileName.slice(i + 1));
}

/**
 * Safari often leaves file.type empty for valid files picked in Finder — trust extension when type is missing.
 */
export function isAllowedAlbumPhotoFile(file) {
  if (!file) return false;
  const raw = String(file.name || '');
  const i = raw.lastIndexOf('.');
  const rawExt = i > 0 ? raw.slice(i + 1).trim().toLowerCase() : '';
  const ext = getAlbumPhotoExtension(file.name);
  const allowed =
    (ext && ALBUM_PHOTO_EXTENSIONS.has(ext)) ||
    (rawExt && ALBUM_PHOTO_EXTENSIONS.has(rawExt));
  if (!allowed) return false;
  const type = String(file.type || '').trim().toLowerCase();
  if (!type) return true;
  if (type === 'application/octet-stream') return true;
  if (ALBUM_PHOTO_MIME_TYPES.has(type)) return true;
  return type.startsWith('image/');
}

/** UI copy for My Album&Posts upload area (per product spec). */
export const ALBUM_ACCEPTED_PHOTO_EXTENSIONS_UI =
  'Accepted photo extensions are: *.jpg, *.jpeg, *.jpe, *.png, *.gif, *.svg, *.webp, *.avif, *.tif, *.tiff, *.bmp, *.heic, *.heif, *.raw, *.cr2, *.nef, *.arw, *.dng, *.orf, *.psd, *.ai, *.eps, *.ico, and *.apng.';

export const ALBUM_ACCEPTED_VIDEO_EXTENSIONS_UI =
  'For video *.mp3, *.mp4, *.webm, *.mov, *.avi, and *.wmv';
