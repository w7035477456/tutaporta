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
  'exe',
  'dmg',
  'mp4',
  'mp3',
  'avi',
  'mov',
  'wmv',
  // Image / design formats (also attachable + encryptable)
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

const RECORD_VAULT_MIME_TO_EXTENSION = {
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/x-icon': 'ico',
  'application/postscript': 'eps',
  'application/illustrator': 'ai',
  'image/vnd.adobe.photoshop': 'psd',
  'application/json': 'json',
  'application/sql': 'sql',
  'text/csv': 'csv',
  'text/plain': 'txt',
  'text/html': 'html',
  'application/xhtml+xml': 'html',
  'text/javascript': 'js',
  'application/javascript': 'js',
  'text/css': 'css',
  'text/xml': 'xml',
  'application/xml': 'xml',
  'text/yaml': 'yaml',
  'text/x-yaml': 'yaml',
  'application/x-yaml': 'yaml',
  'application/yaml': 'yaml',
  'text/x-c': 'c',
  'text/x-java-source': 'java',
  'application/x-tar': 'tar',
  'application/gzip': 'gz',
  'application/x-gzip': 'gz',
  'application/x-xz': 'xz',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'application/x-msi': 'msi',
  'application/x-msdownload': 'exe',
  'application/x-msdos-program': 'exe',
  'application/vnd.microsoft.portable-executable': 'exe',
  'application/x-apple-diskimage': 'dmg',
  'application/x-apple-aspen-config': 'pkg',
  'application/vnd.apple.installer+xml': 'pkg',
  'application/x-xar': 'pkg',
  'application/pdf': 'pdf',
  'application/x-pdf': 'pdf',
  'application/vnd.adobe.pdf': 'pdf',
  'video/mp4': 'mp4',
  'video/x-m4v': 'mp4',
  'video/m4v': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'video/x-msvideo': 'avi',
  'video/quicktime': 'mov',
  'video/x-ms-wmv': 'wmv'
};

export const RECORD_VAULT_ACCEPTED_FILE_EXTENSIONS_UI =
  '*.doc, *.docx, *.xls, *.xlsx, *.ppt, *.pptx, *.pdf, *.sql, *.json, *.csv, *.txt, *.html, *.js, *.css, *.xml, *.yaml, *.tar, *.gz, *.xz, *.zip, *.msi, *.pkg, *.exe, *.dmg, *.mp4, *.mp3, *.avi, *.mov, *.wmv, *.jpg, *.jpeg, *.png, *.gif, *.svg, *.webp, *.avif, *.tif, *.bmp, *.heic, *.raw, *.psd, *.ai, *.eps, *.ico';

export const RECORD_VAULT_FILE_INPUT_ACCEPT = [
  ...RECORD_VAULT_ALLOWED_FILE_EXTENSIONS,
  'application/pdf',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/css',
  'text/xml',
  'application/xml',
  'text/yaml',
  'application/gzip',
  'application/x-xz',
  'image/*',
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-ms-wmv',
  'audio/mpeg'
]
  .map((entry) => (entry.includes('/') ? entry : `.${entry}`))
  .join(',');

export function fileExtensionLower(file) {
  const name = String(file?.name ?? '').trim().toLowerCase();
  if (!name) return '';
  // Prefer compound archive extensions used in downloads (*.tar.gz / *.tar.xz).
  if (name.endsWith('.tar.gz') || name.endsWith('.tgz')) return name.endsWith('.tgz') ? 'tgz' : 'gz';
  if (name.endsWith('.tar.xz')) return 'xz';
  const dot = name.lastIndexOf('.');
  if (dot < 1) return '';
  return name.slice(dot + 1);
}

export function resolveRecordVaultFileExtension(file) {
  const fromName = fileExtensionLower(file);
  if (fromName && RECORD_VAULT_ALLOWED_FILE_EXTENSIONS.has(fromName)) return fromName;
  const mime = String(file?.type || '')
    .trim()
    .toLowerCase();
  if (!mime) return fromName;
  const mapped = RECORD_VAULT_MIME_TO_EXTENSION[mime];
  if (mapped && RECORD_VAULT_ALLOWED_FILE_EXTENSIONS.has(mapped)) return mapped;
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('json')) return 'json';
  if (mime.includes('csv')) return 'csv';
  if (mime.includes('javascript')) return 'js';
  if (mime.includes('zip')) return 'zip';
  if (mime.includes('msdownload') || mime.includes('msdos-program') || mime.includes('portable-executable')) {
    return 'exe';
  }
  if (mime.includes('apple-diskimage') || mime.endsWith('/dmg')) return 'dmg';
  if (mime.includes('mpeg')) return 'mp3';
  if (mime.includes('mp4') || mime.includes('m4v')) return 'mp4';
  if (mime.includes('quicktime')) return 'mov';
  if (mime.includes('msvideo') || mime.includes('avi')) return 'avi';
  if (mime.includes('wmv')) return 'wmv';
  if (mime.includes('powerpoint') || mime.includes('presentationml') || mime.includes('mspowerpoint')) {
    return mime.includes('openxml') ? 'pptx' : 'ppt';
  }
  if (mime.includes('msword') || mime.includes('wordprocessingml')) {
    return mime.includes('openxml') ? 'docx' : 'doc';
  }
  if (mime.includes('ms-excel') || mime.includes('spreadsheetml')) {
    return mime.includes('openxml') ? 'xlsx' : 'xls';
  }
  if (mime.includes('yaml') || mime.includes('yml')) return 'yaml';
  if (mime.includes('css')) return 'css';
  if (mime.includes('xml')) return 'xml';
  if (mime.includes('gzip') || mime.endsWith('/gz')) return 'gz';
  if (mime.includes('xz')) return 'xz';
  if (mime.includes('svg')) return 'svg';
  if (mime.includes('avif')) return 'avif';
  if (mime.includes('heic')) return 'heic';
  if (mime.includes('heif')) return 'heif';
  if (mime.includes('tiff')) return 'tiff';
  if (mime.includes('bmp')) return 'bmp';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('png')) return 'png';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('photoshop') || mime.includes('psd')) return 'psd';
  if (mime.includes('illustrator')) return 'ai';
  if (mime.includes('postscript') || mime.includes('eps')) return 'eps';
  if (mime.includes('icon')) return 'ico';
  if (mime.includes('plain')) return 'txt';
  if (mime.includes('html')) return 'html';
  return fromName;
}

export function isAllowedRecordVaultFile(file) {
  if (!file) return false;
  const ext = resolveRecordVaultFileExtension(file);
  return ext ? RECORD_VAULT_ALLOWED_FILE_EXTENSIONS.has(ext) : false;
}

/** OS file drag — include video/audio MIME types (e.g. video/mp4) not only application/text. */
export function isOsFileDragTransfer(dataTransfer) {
  if (!dataTransfer) return false;
  const types = dataTransfer.types ? Array.from(dataTransfer.types) : [];
  if (types.includes('Files')) return true;
  if (dataTransfer.files?.length) return true;
  const items = dataTransfer.items;
  if (items?.length) {
    for (let i = 0; i < items.length; i += 1) {
      if (items[i]?.kind === 'file') return true;
    }
  }
  if (types.includes('application/pdf') || types.includes('public.file-url')) return true;
  return types.some((type) => {
    const normalized = String(type).toLowerCase();
    if (normalized.startsWith('application/x-record-vault-')) return false;
    return (
      normalized.startsWith('application/') ||
      normalized.startsWith('text/') ||
      normalized.startsWith('video/') ||
      normalized.startsWith('audio/')
    );
  });
}

export function recordVaultUploadFileName(file) {
  const ext = resolveRecordVaultFileExtension(file);
  const name = String(file?.name || '').trim();
  if (!ext) return name || 'file.bin';
  if (fileExtensionLower(file) === ext) return name || `file.${ext}`;
  if (!name) return `file.${ext}`;
  if (!name.includes('.')) return `${name}.${ext}`;
  return name;
}

export function formatRecordVaultFileSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return '';
  if (value >= 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${value} B`;
}

export function extensionFromRecordVaultAttachment(attachment) {
  const fromField = String(attachment?.file_extension || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
  if (fromField) return fromField;
  return fileExtensionLower({ name: String(attachment?.file_name || '') });
}

/** @returns {'pdf'|'text'|'video'|'audio'|'image'|'docx'|'xlsx'|'legacy-office'|null} */
export function getRecordVaultAttachmentViewKind(ext) {
  const normalized = String(ext || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
  if (!normalized) return null;
  if (normalized === 'pdf') return 'pdf';
  if (['txt', 'sql', 'json', 'csv', 'js', 'jsx', 'c', 'java', 'html', 'htm', 'css', 'xml'].includes(normalized)) return 'text';
  if (['mp4', 'avi', 'mov', 'wmv'].includes(normalized)) return 'video';
  if (normalized === 'mp3') return 'audio';
  if (
    [
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
      'tif',
      'tiff',
      'ico'
    ].includes(normalized)
  ) {
    return 'image';
  }
  if (normalized === 'docx') return 'docx';
  if (normalized === 'xlsx') return 'xlsx';
  if (normalized === 'doc' || normalized === 'xls' || normalized === 'ppt' || normalized === 'pptx') {
    return 'legacy-office';
  }
  return null;
}

export function canViewRecordVaultAttachment(ext) {
  return getRecordVaultAttachmentViewKind(ext) != null;
}

/**
 * Extensions shown inline on the note (not only View/Download/Remove).
 * PDF + common raster images + browser-friendly video (first-frame thumb) + text.
 */
const RECORD_VAULT_INLINE_PREVIEW_EXTENSIONS = new Set([
  'pdf',
  'jpg',
  'jpeg',
  'gif',
  'bmp',
  'png',
  'mp4',
  'mov',
  'txt',
  'sql',
  'json',
  'csv',
  'js',
  'jsx',
  'c',
  'java',
  'html',
  'htm',
  'css',
  'xml',
  'docx'
]);

/** .mp4 / .mov — show first frame on the note (not only View/Download/Remove). */
const RECORD_VAULT_INLINE_VIDEO_PREVIEW_EXTENSIONS = new Set(['mp4', 'mov']);

/** Plain-text-ish files shown as readable body on the note. */
const RECORD_VAULT_INLINE_TEXT_PREVIEW_EXTENSIONS = new Set([
  'txt',
  'sql',
  'json',
  'csv',
  'js',
  'jsx',
  'c',
  'java',
  'html',
  'htm',
  'css',
  'xml'
]);

/** .docx — convert with mammoth and embed HTML on the note. */
const RECORD_VAULT_INLINE_DOCX_PREVIEW_EXTENSIONS = new Set(['docx']);

export function canInlinePreviewRecordVaultAttachment(ext) {
  const normalized = String(ext || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
  return RECORD_VAULT_INLINE_PREVIEW_EXTENSIONS.has(normalized);
}

export function canInlineVideoPreviewRecordVaultAttachment(ext) {
  const normalized = String(ext || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
  return RECORD_VAULT_INLINE_VIDEO_PREVIEW_EXTENSIONS.has(normalized);
}

export function canInlineTextPreviewRecordVaultAttachment(ext) {
  const normalized = String(ext || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
  return RECORD_VAULT_INLINE_TEXT_PREVIEW_EXTENSIONS.has(normalized);
}

export function canInlineDocxPreviewRecordVaultAttachment(ext) {
  const normalized = String(ext || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
  return RECORD_VAULT_INLINE_DOCX_PREVIEW_EXTENSIONS.has(normalized);
}

/** Word/Excel/PowerPoint files that can open in the Mac default desktop app via backend `open`. */
export function canNativeOpenRecordVaultAttachment(ext) {
  const normalized = String(ext || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
  return (
    normalized === 'doc' ||
    normalized === 'docx' ||
    normalized === 'xls' ||
    normalized === 'xlsx' ||
    normalized === 'ppt' ||
    normalized === 'pptx'
  );
}
