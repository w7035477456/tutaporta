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
