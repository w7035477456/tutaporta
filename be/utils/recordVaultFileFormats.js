/** Extensions allowed for Record Vault file attachments (lowercase, no dot). */
export const RECORD_VAULT_ALLOWED_FILE_EXTENSIONS = new Set([
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
  webp: 'image/webp',
  avif: 'image/avif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  bmp: 'image/bmp',
  dib: 'image/bmp',
  heic: 'image/heic',
  heif: 'image/heif',
  raw: 'application/octet-stream',
  cr2: 'image/x-canon-cr2',
  nef: 'image/x-nikon-nef',
  arw: 'image/x-sony-arw',
  dng: 'image/x-adobe-dng',
  orf: 'image/x-olympus-orf',
  psd: 'image/vnd.adobe.photoshop',
  ai: 'application/illustrator',
  eps: 'application/postscript',
  ico: 'image/x-icon'
};

export function normalizeRecordVaultFileExtension(raw) {
  const ext = String(raw ?? '')
    .trim()
    .replace(/^\./, '')
    .toLowerCase();
  if (!ext || !RECORD_VAULT_ALLOWED_FILE_EXTENSIONS.has(ext)) return null;
  return ext;
}

export function extensionFromFileName(fileName) {
  const name = String(fileName ?? '').trim().toLowerCase();
  if (!name) return null;
  if (name.endsWith('.tar.gz') || name.endsWith('.tgz')) {
    return normalizeRecordVaultFileExtension(name.endsWith('.tgz') ? 'tgz' : 'gz');
  }
  if (name.endsWith('.tar.xz')) {
    return normalizeRecordVaultFileExtension('xz');
  }
  const dot = name.lastIndexOf('.');
  if (dot < 1) return null;
  return normalizeRecordVaultFileExtension(name.slice(dot + 1));
}

export function mimeTypeForRecordVaultExtension(ext) {
  const normalized = normalizeRecordVaultFileExtension(ext);
  if (!normalized) return 'application/octet-stream';
  return EXTENSION_MIME[normalized] || 'application/octet-stream';
}

export function isAllowedRecordVaultFileExtension(ext) {
  return normalizeRecordVaultFileExtension(ext) != null;
}
