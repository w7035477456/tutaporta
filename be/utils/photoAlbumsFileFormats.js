/** Extensions allowed for Record Vault file attachments (lowercase, no dot). */
export const PHOTO_ALBUMS_ALLOWED_FILE_EXTENSIONS = new Set([
  'docx',
  'doc',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'pdf',
  'sql',
  'json',
  'csv',
  'txt',
  'html',
  'htm',
  'js',
  'jsx',
  'c',
  'java',
  'css',
  'xml',
  'yaml',
  'yml',
  'tar',
  'gz',
  'xz',
  'tgz',
  'zip',
  'msi',
  'pkg',
  'mp4',
  'mp3',
  'avi',
  'mov',
  'wmv',
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
  'svgz',
  'webp',
  'avif',
  'tif',
  'tiff',
  'bmp',
  'dib',
  'heic',
  'heif',
  'ico',
  // Attachable design/camera files (vault only — not album-slot previewable)
  'raw',
  'cr2',
  'cr3',
  'nef',
  'nrw',
  'arw',
  'dng',
  'orf',
  'pef',
  'rw2',
  'sr2',
  'srf',
  'k25',
  'psd',
  'ai',
  'eps',
  'jxl',
  'jp2',
  'j2k',
  'jpf',
  'jpx',
  'jpm',
  'mj2',
  'tga',
  'wmf',
  'pcx',
  'pict',
  'xcf',
  'indd',
  'ind',
  'indt'
]);

const EXTENSION_MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  pdf: 'application/pdf',
  sql: 'application/sql',
  json: 'application/json',
  csv: 'text/csv',
  txt: 'text/plain',
  html: 'text/html',
  htm: 'text/html',
  js: 'text/javascript',
  jsx: 'text/javascript',
  c: 'text/x-c',
  java: 'text/x-java-source',
  css: 'text/css',
  xml: 'application/xml',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  tar: 'application/x-tar',
  gz: 'application/gzip',
  xz: 'application/x-xz',
  tgz: 'application/gzip',
  zip: 'application/zip',
  msi: 'application/x-msi',
  pkg: 'application/octet-stream',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  wmv: 'video/x-ms-wmv',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpe: 'image/jpeg',
  jif: 'image/jpeg',
  jfif: 'image/jpeg',
  jfi: 'image/jpeg',
  png: 'image/png',
  apng: 'image/apng',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  svgz: 'image/svg+xml',
  webp: 'image/webp',
  avif: 'image/avif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  bmp: 'image/bmp',
  dib: 'image/bmp',
  heic: 'image/heic',
  heif: 'image/heif',
  ico: 'image/x-icon',
  raw: 'application/octet-stream',
  cr2: 'image/x-canon-cr2',
  cr3: 'image/x-canon-cr3',
  nef: 'image/x-nikon-nef',
  nrw: 'image/x-nikon-nrw',
  arw: 'image/x-sony-arw',
  dng: 'image/x-adobe-dng',
  orf: 'image/x-olympus-orf',
  pef: 'image/x-pentax-pef',
  rw2: 'image/x-panasonic-rw2',
  sr2: 'image/x-sony-sr2',
  srf: 'image/x-sony-srf',
  k25: 'image/x-kodak-k25',
  psd: 'image/vnd.adobe.photoshop',
  ai: 'application/illustrator',
  eps: 'application/postscript',
  jxl: 'image/jxl',
  jp2: 'image/jp2',
  j2k: 'image/j2k',
  jpf: 'image/jpx',
  jpx: 'image/jpx',
  jpm: 'image/jpm',
  mj2: 'video/mj2',
  tga: 'image/x-tga',
  wmf: 'image/wmf',
  pcx: 'image/x-pcx',
  pict: 'image/x-pict',
  xcf: 'image/x-xcf',
  indd: 'application/x-indesign',
  ind: 'application/x-indesign',
  indt: 'application/x-indesign'
};

/** Photo tray / template slots — must be browser-viewable (natively or via inline preview). */
export const PHOTO_ALBUMS_STAGING_PHOTO_EXTENSIONS = new Set([
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
  'svgz',
  'webp',
  'avif',
  'bmp',
  'dib',
  'tif',
  'tiff',
  'ico',
  'heic',
  'heif'
]);

export function isPhotoAlbumsStagingPhotoExtension(ext) {
  const normalized = normalizePhotoAlbumsFileExtension(ext);
  return normalized != null && PHOTO_ALBUMS_STAGING_PHOTO_EXTENSIONS.has(normalized);
}

export function normalizePhotoAlbumsFileExtension(raw) {
  const ext = String(raw ?? '')
    .trim()
    .replace(/^\./, '')
    .toLowerCase();
  if (!ext || !PHOTO_ALBUMS_ALLOWED_FILE_EXTENSIONS.has(ext)) return null;
  return ext;
}

export function extensionFromFileName(fileName) {
  const name = String(fileName ?? '').trim().toLowerCase();
  if (!name) return null;
  if (name.endsWith('.tar.gz') || name.endsWith('.tgz')) {
    return normalizePhotoAlbumsFileExtension(name.endsWith('.tgz') ? 'tgz' : 'gz');
  }
  if (name.endsWith('.tar.xz')) {
    return normalizePhotoAlbumsFileExtension('xz');
  }
  const dot = name.lastIndexOf('.');
  if (dot < 1) return null;
  return normalizePhotoAlbumsFileExtension(name.slice(dot + 1));
}

export function mimeTypeForPhotoAlbumsExtension(ext) {
  const normalized = normalizePhotoAlbumsFileExtension(ext);
  if (!normalized) return 'application/octet-stream';
  return EXTENSION_MIME[normalized] || 'application/octet-stream';
}

export function isAllowedPhotoAlbumsFileExtension(ext) {
  return normalizePhotoAlbumsFileExtension(ext) != null;
}
