import { describe, expect, it } from 'vitest';
import {
  buildPhotoAlbumsTrayItems,
  photoAlbumsTrayItemDisplayName,
  toPhotoAlbumsTrayItem
} from './photoAlbumsTrayItems';

describe('toPhotoAlbumsTrayItem', () => {
  it('normalizes a snake_case vault row', () => {
    expect(
      toPhotoAlbumsTrayItem({
        attachment_id: '7',
        file_name: 'beach.JPG',
        file_extension: 'JPG',
        file_size_bytes: '1234',
        album_photo_seq: 3
      })
    ).toEqual({
      attachmentId: 7,
      fileName: 'beach.JPG',
      fileExtension: 'jpg',
      fileSizeBytes: 1234,
      albumPhotoSeq: 3,
      isVideo: false
    });
  });

  it('flags videos and accepts camelCase rows', () => {
    const item = toPhotoAlbumsTrayItem({ attachmentId: 9, fileName: 'clip.mov', fileExtension: 'mov' });
    expect(item.isVideo).toBe(true);
    expect(item.albumPhotoSeq).toBeNull();
    expect(item.fileSizeBytes).toBeNull();
  });

  it('falls back to the filename extension when file_extension is empty', () => {
    expect(toPhotoAlbumsTrayItem({ attachment_id: 2, file_name: 'x.heic' })?.fileExtension).toBe('heic');
  });

  it('rejects non-media and invalid rows', () => {
    expect(toPhotoAlbumsTrayItem({ attachment_id: 1, file_name: 'a.pdf', file_extension: 'pdf' })).toBeNull();
    expect(toPhotoAlbumsTrayItem({ attachment_id: 0, file_extension: 'jpg' })).toBeNull();
    expect(toPhotoAlbumsTrayItem({ attachment_id: 'abc', file_extension: 'jpg' })).toBeNull();
    expect(toPhotoAlbumsTrayItem(null)).toBeNull();
  });
});

describe('buildPhotoAlbumsTrayItems', () => {
  it('returns [] for empty / invalid input', () => {
    expect(buildPhotoAlbumsTrayItems(undefined)).toEqual([]);
    expect(buildPhotoAlbumsTrayItems(null)).toEqual([]);
    expect(buildPhotoAlbumsTrayItems([])).toEqual([]);
  });

  it('dedupes by id (first wins), drops non-media, sorts by seq then id', () => {
    const items = buildPhotoAlbumsTrayItems([
      { attachment_id: 5, file_extension: 'jpg', album_photo_seq: 2 },
      { attachment_id: 3, file_extension: 'png' },
      { attachment_id: 4, file_extension: 'mp4', album_photo_seq: 1 },
      { attachment_id: 5, file_extension: 'jpg', album_photo_seq: 99 },
      { attachment_id: 6, file_extension: 'docx', album_photo_seq: 0 },
      { attachment_id: 1, file_extension: 'gif' }
    ]);
    expect(items.map((i) => i.attachmentId)).toEqual([4, 5, 1, 3]);
    expect(items.find((i) => i.attachmentId === 5).albumPhotoSeq).toBe(2);
  });

  it('is deterministic for the same input', () => {
    const rows = [
      { attachment_id: 2, file_extension: 'jpg' },
      { attachment_id: 1, file_extension: 'jpg' }
    ];
    expect(buildPhotoAlbumsTrayItems(rows)).toEqual(buildPhotoAlbumsTrayItems([...rows].reverse()));
  });
});

describe('photoAlbumsTrayItemDisplayName', () => {
  it('appends the extension only when missing', () => {
    expect(photoAlbumsTrayItemDisplayName({ attachmentId: 1, fileName: 'a.jpg', fileExtension: 'jpg' })).toBe('a.jpg');
    expect(photoAlbumsTrayItemDisplayName({ attachmentId: 1, fileName: 'a', fileExtension: 'jpg' })).toBe('a.jpg');
    expect(photoAlbumsTrayItemDisplayName({ attachmentId: 8, fileName: '', fileExtension: 'png' })).toBe('photo-8.png');
  });
});
