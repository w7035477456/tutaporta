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
  'mov',
  'mkv',
  'webm',
  'avi',
  'wmv',
  'mts',
  'm2ts',
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

/** Drop onto photo tray / place in template slots — must preview in browser (native or BE inline). */
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
  'heif',
  'mp4',
  'mov',
  'mkv',
  'webm',
  'avi',
  'wmv',
  'mts',
  'm2ts'
]);

/** Staging-tray / template-slot video (browser-native playback when codec allows). */
export const PHOTO_ALBUMS_STAGING_VIDEO_EXTENSIONS = new Set([
  'mp4',
  'mov',
  'mkv',
  'webm',
  'avi',
  'wmv',
  'mts',
  'm2ts'
]);

const PHOTO_ALBUMS_MIME_TO_EXTENSION = {
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/apng': 'apng',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/x-ms-bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/jxl': 'jxl',
  'image/jp2': 'jp2',
  'image/jpx': 'jpx',
  'image/jpm': 'jpm',
  'image/x-tga': 'tga',
  'image/targa': 'tga',
  'image/wmf': 'wmf',
  'image/x-wmf': 'wmf',
  'image/x-pcx': 'pcx',
  'image/x-pict': 'pict',
  'image/x-xcf': 'xcf',
  'application/postscript': 'eps',
  'application/illustrator': 'ai',
  'image/vnd.adobe.photoshop': 'psd',
  'application/x-indesign': 'indd',
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
  'application/x-msdownload': 'msi',
  'application/x-apple-aspen-config': 'pkg',
  'application/vnd.apple.installer+xml': 'pkg',
  'application/x-xar': 'pkg',
  'application/pdf': 'pdf',
  'application/x-pdf': 'pdf',
  'application/vnd.adobe.pdf': 'pdf',
  'video/mp4': 'mp4',
  'video/x-m4v': 'mp4',
  'video/m4v': 'mp4',
  'video/webm': 'webm',
  'video/x-matroska': 'mkv',
  'video/mp2t': 'mts',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'video/x-msvideo': 'avi',
  'video/quicktime': 'mov',
  'video/x-ms-wmv': 'wmv'
};

export const PHOTO_ALBUMS_ACCEPTED_FILE_EXTENSIONS_UI =
  '*.doc, *.docx, *.xls, *.xlsx, *.ppt, *.pptx, *.pdf, *.sql, *.json, *.csv, *.txt, *.html, *.js, *.css, *.xml, *.yaml, *.tar, *.gz, *.xz, *.zip, *.msi, *.pkg, *.mp4, *.mp3, *.avi, *.mov, *.wmv, *.jpg, *.jpeg, *.png, *.gif, *.svg, *.svgz, *.webp, *.avif, *.tif, *.tiff, *.bmp, *.heic, *.heif, *.ico, *.apng, *.raw, *.psd, *.ai, *.eps, *.jxl, *.jp2, *.tga, …';

export const PHOTO_ALBUMS_FILE_INPUT_ACCEPT = [
  ...PHOTO_ALBUMS_ALLOWED_FILE_EXTENSIONS,
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
  'video/webm',
  'video/x-matroska',
  'video/x-msvideo',
  'video/x-ms-wmv',
  'video/mp2t',
  'audio/mpeg'
]
  .map((entry) => (entry.includes('/') ? entry : `.${entry}`))
  .join(',');

export function fileExtensionLower(file) {
  const name = String(file?.name ?? '')
    .trim()
    .toLowerCase();
  if (!name) return '';
  // Prefer compound archive extensions used in downloads (*.tar.gz / *.tar.xz).
  if (name.endsWith('.tar.gz') || name.endsWith('.tgz')) return name.endsWith('.tgz') ? 'tgz' : 'gz';
  if (name.endsWith('.tar.xz')) return 'xz';
  const dot = name.lastIndexOf('.');
  if (dot < 1) return '';
  return name.slice(dot + 1);
}

export function resolvePhotoAlbumsFileExtension(file) {
  const fromName = fileExtensionLower(file);
  if (fromName && PHOTO_ALBUMS_ALLOWED_FILE_EXTENSIONS.has(fromName)) return fromName;
  const mime = String(file?.type || '')
    .trim()
    .toLowerCase();
  if (!mime) return fromName;
  const mapped = PHOTO_ALBUMS_MIME_TO_EXTENSION[mime];
  if (mapped && PHOTO_ALBUMS_ALLOWED_FILE_EXTENSIONS.has(mapped)) return mapped;
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('json')) return 'json';
  if (mime.includes('csv')) return 'csv';
  if (mime.includes('javascript')) return 'js';
  if (mime.includes('zip')) return 'zip';
  if (mime.includes('mpeg')) return 'mp3';
  if (mime.includes('mp4') || mime.includes('m4v')) return 'mp4';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('matroska') || mime.includes('mkv')) return 'mkv';
  if (mime.includes('mp2t') || mime.includes('mpeg2')) return 'mts';
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
  if (mime.includes('apng')) return 'apng';
  if (mime.includes('png')) return 'png';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('jxl')) return 'jxl';
  if (mime.includes('jp2') || mime.includes('jpx')) return 'jp2';
  if (mime.includes('targa') || mime.endsWith('/tga')) return 'tga';
  if (mime.includes('photoshop') || mime.includes('psd')) return 'psd';
  if (mime.includes('illustrator')) return 'ai';
  if (mime.includes('postscript') || mime.includes('eps')) return 'eps';
  if (mime.includes('indesign')) return 'indd';
  if (mime.includes('icon')) return 'ico';
  if (mime.includes('plain')) return 'txt';
  if (mime.includes('html')) return 'html';
  return fromName;
}

export function isAllowedPhotoAlbumsFile(file) {
  if (!file) return false;
  const ext = resolvePhotoAlbumsFileExtension(file);
  return ext ? PHOTO_ALBUMS_ALLOWED_FILE_EXTENSIONS.has(ext) : false;
}

/** macOS AppleDouble sidecars (._name), .DS_Store, etc. — not displayable photos. */
export function isMacOsMetadataFileName(name) {
  const base = String(name || '').trim();
  if (!base) return false;
  const leaf = base.replace(/\\/g, '/').split('/').pop() || base;
  if (leaf === '.DS_Store' || leaf === 'Thumbs.db' || leaf === 'desktop.ini') return true;
  if (leaf.startsWith('._')) return true;
  return false;
}

/** Hide in Files Explorer (Finder default — no resource-fork sidecars). */
export function isPhotoAlbumsFilesExplorerHiddenEntry(name, kind = 'file') {
  if (String(kind) === 'directory' && String(name || '').trim() === '__MACOSX') return true;
  return isMacOsMetadataFileName(name);
}

/** True when the file can go in the photo tray and render in template slots. */
export function isPhotoAlbumsStagingPhotoFile(file) {
  if (!file) return false;
  if (isMacOsMetadataFileName(file.name)) return false;
  const ext = resolvePhotoAlbumsFileExtension(file);
  return Boolean(ext && PHOTO_ALBUMS_STAGING_PHOTO_EXTENSIONS.has(ext));
}

/** Photo tray or MP4 video slot media. */
export function isPhotoAlbumsStagingAlbumMediaFile(file) {
  return isPhotoAlbumsStagingPhotoFile(file) || isPhotoAlbumsStagingVideoFile(file);
}

/** @returns {string} MIME type for `<video src>` / blob URLs */
export function mimeTypeForPhotoAlbumsVideoExtension(ext) {
  const normalized = String(ext || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
  const last = normalized.includes('.') ? normalized.slice(normalized.lastIndexOf('.') + 1) : normalized;
  const map = {
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    mkv: 'video/x-matroska',
    webm: 'video/webm',
    avi: 'video/x-msvideo',
    wmv: 'video/x-ms-wmv',
    mts: 'video/mp2t',
    m2ts: 'video/mp2t'
  };
  return map[last] || 'video/mp4';
}

export function isPhotoAlbumsStagingVideoExtension(ext) {
  const normalized = String(ext || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
  const last = normalized.includes('.') ? normalized.slice(normalized.lastIndexOf('.') + 1) : normalized;
  return PHOTO_ALBUMS_STAGING_VIDEO_EXTENSIONS.has(last);
}

/** True when the file is an album-tray / template-slot video. */
export function isPhotoAlbumsStagingVideoFile(file) {
  if (!file) return false;
  if (isMacOsMetadataFileName(file.name)) return false;
  const ext = resolvePhotoAlbumsFileExtension(file);
  return Boolean(ext && PHOTO_ALBUMS_STAGING_VIDEO_EXTENSIONS.has(ext));
}

export function isPhotoAlbumsAlbumSlotMediaExtension(ext) {
  return (
    isPhotoAlbumsStagingPhotoExtension(ext) ||
    isPhotoAlbumsStagingVideoExtension(ext)
  );
}

/** Formats the browser often cannot decode locally — trust BE sharp + vault thumb/display JPEG. */
export const PHOTO_ALBUMS_STAGING_SERVER_THUMB_EXTENSIONS = new Set([
  'heic',
  'heif',
  'tif',
  'tiff',
  'ico',
  'avif',
  'apng'
]);

export function photoAlbumsStagingPhotoPrefersServerThumb(ext) {
  const normalized = String(ext || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
  const last = normalized.includes('.') ? normalized.slice(normalized.lastIndexOf('.') + 1) : normalized;
  return PHOTO_ALBUMS_STAGING_SERVER_THUMB_EXTENSIONS.has(last);
}

/** Decode-check raster photos before staging (rejects ._ sidecars that mimic .jpg). */
export async function probePhotoAlbumsImageFile(file) {
  if (!(file instanceof Blob) || file.size < 1) return false;
  const ext = resolvePhotoAlbumsFileExtension(file);
  if (ext === 'svg' || ext === 'svgz') return true;
  if (photoAlbumsStagingPhotoPrefersServerThumb(ext)) return true;

  try {
    if (typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(file);
      const ok = bmp.width > 0 && bmp.height > 0;
      bmp.close();
      return ok;
    }
  } catch {
    // fall through to Image()
  }

  return new Promise((resolve) => {
    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {
      resolve(false);
      return;
    }
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img.naturalWidth > 0 && img.naturalHeight > 0);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(false);
    };
    img.src = objectUrl;
  });
}

export function isPhotoAlbumsStagingPhotoExtension(ext) {
  const normalized = String(ext || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
  const last = normalized.includes('.') ? normalized.slice(normalized.lastIndexOf('.') + 1) : normalized;
  return PHOTO_ALBUMS_STAGING_PHOTO_EXTENSIONS.has(last);
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

export function photoAlbumsUploadFileName(file) {
  const ext = resolvePhotoAlbumsFileExtension(file);
  const name = String(file?.name || '').trim();
  if (!ext) return name || 'file.bin';
  if (fileExtensionLower(file) === ext) return name || `file.${ext}`;
  if (!name) return `file.${ext}`;
  if (!name.includes('.')) return `${name}.${ext}`;
  return name;
}

export function formatPhotoAlbumsFileSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return '';
  if (value >= 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${value} B`;
}

export function extensionFromPhotoAlbumsAttachment(attachment) {
  const fromField = String(attachment?.file_extension || attachment?.fileExtension || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
  // Some rows store a bare extension; others accidentally store "name.jpeg" — take the last segment.
  const fieldExt = fromField.includes('.') ? fromField.slice(fromField.lastIndexOf('.') + 1) : fromField;
  if (fieldExt && PHOTO_ALBUMS_ALLOWED_FILE_EXTENSIONS.has(fieldExt)) return fieldExt;
  const fromName = fileExtensionLower({
    name: String(attachment?.file_name || attachment?.fileName || '')
  });
  if (fromName && PHOTO_ALBUMS_ALLOWED_FILE_EXTENSIONS.has(fromName)) return fromName;
  return fieldExt || fromName || '';
}

/** @returns {'pdf'|'text'|'video'|'audio'|'image'|'docx'|'xlsx'|'legacy-office'|null} */
export function getPhotoAlbumsAttachmentViewKind(ext) {
  let normalized = String(ext || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
  // "177.jpeg" / "foo.JPG" → use the real extension segment.
  if (normalized.includes('.')) {
    normalized = normalized.slice(normalized.lastIndexOf('.') + 1);
  }
  if (!normalized) return null;
  if (normalized === 'pdf') return 'pdf';
  if (['txt', 'sql', 'json', 'csv', 'js', 'jsx', 'c', 'java', 'html', 'htm'].includes(normalized)) return 'text';
  if (['mp4', 'mov', 'mkv', 'webm', 'avi', 'wmv', 'mts', 'm2ts'].includes(normalized)) return 'video';
  if (normalized === 'mp3') return 'audio';
  if (PHOTO_ALBUMS_STAGING_PHOTO_EXTENSIONS.has(normalized)) {
    return 'image';
  }
  if (normalized === 'docx') return 'docx';
  if (normalized === 'xlsx') return 'xlsx';
  if (normalized === 'doc' || normalized === 'xls' || normalized === 'ppt' || normalized === 'pptx') {
    return 'legacy-office';
  }
  return null;
}

export function canViewPhotoAlbumsAttachment(ext) {
  return getPhotoAlbumsAttachmentViewKind(ext) != null;
}

/** Word/Excel/PowerPoint files that can open in the Mac default desktop app via backend `open`. */
export function canNativeOpenPhotoAlbumsAttachment(ext) {
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
