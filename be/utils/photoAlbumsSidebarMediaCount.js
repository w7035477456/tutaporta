/** Photo/video extensions counted in Album-Set / Album sidebar badges. */
const PHOTO_ALBUMS_SIDEBAR_MEDIA_EXTENSIONS = new Set([
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
  'mp4',
  'mov',
  'avi',
  'wmv'
]);

export function normalizePhotoAlbumsSidebarMediaExtension(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
}

export function isPhotoAlbumsSidebarMediaExtension(raw) {
  const ext = normalizePhotoAlbumsSidebarMediaExtension(raw);
  return ext ? PHOTO_ALBUMS_SIDEBAR_MEDIA_EXTENSIONS.has(ext) : false;
}

/** note_id → count of photo/video attachments for sidebar album rows. */
export function loadPhotoAlbumsAlbumMediaCountByNoteId(db, queryAll) {
  const rows = queryAll(
    db,
    `SELECT note_id, file_extension
     FROM note_attachments
     WHERE deleted_at IS NULL`
  );
  const counts = new Map();
  for (const row of rows) {
    if (!isPhotoAlbumsSidebarMediaExtension(row.file_extension)) continue;
    const noteId = Number(row.note_id);
    if (!Number.isFinite(noteId) || noteId < 1) continue;
    counts.set(noteId, (counts.get(noteId) || 0) + 1);
  }
  return counts;
}
