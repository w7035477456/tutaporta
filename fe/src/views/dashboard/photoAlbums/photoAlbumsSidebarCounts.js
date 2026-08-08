import {
  getPhotoAlbumsAttachmentViewKind,
  resolvePhotoAlbumsFileExtension
} from 'utils/photoAlbumsFileFormats';

function sidebarMediaExtension(att) {
  const raw = att?.file_extension || att?.fileExtension || att?.file_name || att?.fileName || '';
  const fromName = resolvePhotoAlbumsFileExtension({ name: String(raw) });
  if (fromName) return fromName;
  return String(raw).trim().toLowerCase().replace(/^\./, '');
}

export function isPhotoAlbumsSidebarMediaAttachment(att) {
  if (!att) return false;
  const ext = sidebarMediaExtension(att);
  const kind = getPhotoAlbumsAttachmentViewKind(ext);
  return kind === 'image' || kind === 'video';
}

/** Count photo + video attachments belonging to one album note. */
export function countPhotoAlbumsSidebarMediaInAttachments(attachments) {
  if (!Array.isArray(attachments)) return 0;
  let count = 0;
  for (const att of attachments) {
    if (isPhotoAlbumsSidebarMediaAttachment(att)) count += 1;
  }
  return count;
}

/** Sidebar album row count — prefer live attachments when loaded, else tree metadata. */
export function photoAlbumsSidebarAlbumMediaCount(note) {
  if (!note) return 0;
  if (note.content_loaded && Array.isArray(note.attachments)) {
    return countPhotoAlbumsSidebarMediaInAttachments(note.attachments);
  }
  const cached = Number(note.album_media_count);
  if (Number.isFinite(cached) && cached >= 0) return cached;
  return countPhotoAlbumsSidebarMediaInAttachments(note.attachments);
}

/** Sidebar album-set row count — albums in the set. */
export function photoAlbumsSidebarAlbumSetCount(notebook) {
  return Array.isArray(notebook?.notes) ? notebook.notes.length : 0;
}
