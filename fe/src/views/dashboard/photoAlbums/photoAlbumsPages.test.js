import { describe, expect, it } from 'vitest';
import {
  parseAlbumPageInstancesFromHtml,
  readLegacyPlacedPhotoAttachmentIds,
  serializeAlbumPageInstances
} from './photoAlbumsPages';

const twoPageMarker =
  '<div data-rv-album-template="" data-album-templates="[{&quot;key&quot;:&quot;a&quot;,&quot;x&quot;:0,&quot;y&quot;:0,&quot;w&quot;:568,&quot;h&quot;:682},{&quot;key&quot;:&quot;b&quot;,&quot;x&quot;:662,&quot;y&quot;:0,&quot;w&quot;:568,&quot;h&quot;:682}]" data-album-orientation="portrait" data-album-page-width="568" style="display:none"></div>';
const legacyPhotos = [1, 2, 3]
  .map((id) => `<div data-attachment-id="${id}" data-file-name="p${id}.jpg" data-rv-attachment=""></div>`)
  .join('');

describe('album pages', () => {
  it('round-trips page photos through the marker', () => {
    const json = serializeAlbumPageInstances([{ key: 'p', x: 0, y: 0, w: 500, h: 600, attachmentId: 9 }]);
    const pages = parseAlbumPageInstancesFromHtml(`<div data-rv-album-template="" data-album-templates="${json}"></div>`);
    expect(pages).toEqual([{ key: 'p', x: 0, y: 0, w: 500, h: 600, attachmentId: 9 }]);
  });

  it('reads legacy placed photo ids in document order', () => {
    expect(readLegacyPlacedPhotoAttachmentIds(`<p></p>${legacyPhotos}`)).toEqual([1, 2, 3]);
  });

  it('puts legacy placed photos one per page, adding spread pages', () => {
    const pages = parseAlbumPageInstancesFromHtml(`${twoPageMarker}<p></p>${legacyPhotos}`);
    expect(pages.map((p) => [p.key.length > 0, p.x, p.y, p.attachmentId])).toEqual([
      [true, 0, 0, 1],
      [true, 662, 0, 2],
      [true, 0, 706, 3]
    ]);
  });

  it('ignores legacy markup once pages already hold photos', () => {
    const json = serializeAlbumPageInstances([{ key: 'p', x: 0, y: 0, w: 500, h: 600, attachmentId: 5 }]);
    const html = `<div data-rv-album-template="" data-album-templates="${json}"></div>${legacyPhotos}`;
    expect(parseAlbumPageInstancesFromHtml(html).map((p) => p.attachmentId)).toEqual([5]);
  });
});
