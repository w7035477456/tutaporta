import { fetchPhotoAlbumsNoteAttachmentBlob } from 'api/photoAlbumsFe';
import { createPhotoAlbumsThumbnailCache } from './photoAlbumsThumbnailCache';

/** App-wide thumbnail cache backed by the vault `variant=thumb` endpoint. */
export const photoAlbumsThumbnailCache = createPhotoAlbumsThumbnailCache({
  fetchBlob: ({ noteId, attachmentId, storageType }) =>
    fetchPhotoAlbumsNoteAttachmentBlob(noteId, attachmentId, {
      inline: true,
      storageType,
      variant: 'thumb'
    })
});

/** Album page photos — the vault `variant=display` (1000px) file. */
export const photoAlbumsPagePhotoCache = createPhotoAlbumsThumbnailCache({
  maxIdleEntries: 60,
  fetchBlob: ({ noteId, attachmentId, storageType }) =>
    fetchPhotoAlbumsNoteAttachmentBlob(noteId, attachmentId, {
      inline: true,
      storageType,
      variant: 'display'
    })
});
