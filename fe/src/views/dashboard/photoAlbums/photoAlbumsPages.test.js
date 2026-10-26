import { describe, expect, it } from 'vitest';
import {
  albumPagePhotoCells,
  albumPagePhotoIds,
  albumPagePhotoView,
  albumPhotoViewTransform,
  createAlbumPageInstance,
  createAlbumPhotoOverlay,
  normalizeAlbumPhotoView,
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
    const json = serializeAlbumPageInstances([{ key: 'p', x: 0, y: 0, w: 500, h: 600, attachmentIds: [9, 4] }]);
    const pages = parseAlbumPageInstancesFromHtml(`<div data-rv-album-template="" data-album-templates="${json}"></div>`);
    expect(pages).toEqual([{ key: 'p', x: 0, y: 0, w: 500, h: 600, attachmentIds: [9, 4] }]);
  });

  it('reads the single attachmentId saved before multi-photo pages', () => {
    const json = serializeAlbumPageInstances([{ key: 'p', x: 0, y: 0, w: 500, h: 600 }]).replace(
      '&quot;h&quot;:600',
      '&quot;h&quot;:600,&quot;attachmentId&quot;:7'
    );
    const pages = parseAlbumPageInstancesFromHtml(`<div data-rv-album-template="" data-album-templates="${json}"></div>`);
    expect(pages[0].attachmentIds).toEqual([7]);
  });

  it('caps a page at 4 unique photos', () => {
    expect(albumPagePhotoIds({ attachmentIds: [1, 2, 2, 3, 4, 5, 'x'] })).toEqual([1, 2, 3, 4]);
    expect(albumPagePhotoIds({})).toEqual([]);
  });

  it('lays out 1 full, 2–3 stacked, 4 as a 2×2 grid', () => {
    const frame = { left: 0, top: 0, width: 208, height: 308 };
    expect(albumPagePhotoCells(frame, 1, 8)).toEqual([{ left: 0, top: 0, width: 208, height: 308 }]);
    expect(albumPagePhotoCells(frame, 2, 8)).toEqual([
      { left: 0, top: 0, width: 208, height: 150 },
      { left: 0, top: 158, width: 208, height: 150 }
    ]);
    expect(albumPagePhotoCells(frame, 3, 8).map((c) => c.top)).toEqual([0, 105, 211]);
    expect(albumPagePhotoCells(frame, 4, 8)).toEqual([
      { left: 0, top: 0, width: 100, height: 150 },
      { left: 108, top: 0, width: 100, height: 150 },
      { left: 0, top: 158, width: 100, height: 150 },
      { left: 108, top: 158, width: 100, height: 150 }
    ]);
  });

  it('reads legacy placed photo ids in document order', () => {
    expect(readLegacyPlacedPhotoAttachmentIds(`<p></p>${legacyPhotos}`)).toEqual([1, 2, 3]);
  });

  it('puts legacy placed photos one per page, adding spread pages', () => {
    const pages = parseAlbumPageInstancesFromHtml(`${twoPageMarker}<p></p>${legacyPhotos}`);
    expect(pages.map((p) => [p.key.length > 0, p.x, p.y, p.attachmentIds])).toEqual([
      [true, 0, 0, [1]],
      [true, 662, 0, [2]],
      [true, 0, 706, [3]]
    ]);
  });

  it('ignores legacy markup once pages already hold photos', () => {
    const json = serializeAlbumPageInstances([{ key: 'p', x: 0, y: 0, w: 500, h: 600, attachmentIds: [5] }]);
    const html = `<div data-rv-album-template="" data-album-templates="${json}"></div>${legacyPhotos}`;
    expect(parseAlbumPageInstancesFromHtml(html).map((p) => p.attachmentIds)).toEqual([[5]]);
  });

  it('round-trips photo zoom / pan / rotation and drops views of photos no longer on the page', () => {
    const view = { zoom: 1.5, panFx: 0.1, panFy: -0.2, rotationDeg: 30 };
    const json = serializeAlbumPageInstances([
      { key: 'p', x: 0, y: 0, w: 500, h: 600, attachmentIds: [9], photoViews: { 9: view, 4: view } }
    ]);
    const [page] = parseAlbumPageInstancesFromHtml(`<div data-rv-album-template="" data-album-templates="${json}"></div>`);
    expect(page.photoViews).toEqual({ 9: view });
    expect(albumPagePhotoView(page, 9)).toEqual(view);
    expect(albumPagePhotoView(page, 4)).toEqual({ zoom: 1, panFx: 0, panFy: 0, rotationDeg: 0 });
  });

  it('omits untouched photo views and clamps out-of-range ones', () => {
    expect(normalizeAlbumPhotoView({ zoom: 1, panFx: 0, panFy: 0, rotationDeg: 0 })).toBeNull();
    expect(normalizeAlbumPhotoView({ zoom: 9, panFx: 0, panFy: 0, rotationDeg: 400 })).toEqual({
      zoom: 3,
      panFx: 0,
      panFy: 0,
      rotationDeg: 180
    });
    const page = createAlbumPageInstance({ key: 'p', attachmentIds: [1], photoViews: { 1: { zoom: 1 } } });
    expect(page).not.toHaveProperty('photoViews');
  });

  it('draws pan as a fraction of the photo cell', () => {
    expect(albumPhotoViewTransform({ zoom: 2, panFx: 0.5, panFy: -0.25, rotationDeg: 90 }, 200, 400)).toBe(
      'translate(100px, -100px) rotate(90deg) scale(2)'
    );
  });

  it('keeps emoji / blur on an otherwise untouched photo and drops bad ones', () => {
    const emoji = createAlbumPhotoOverlay('emoji', '😀');
    const blur = createAlbumPhotoOverlay('blur');
    expect(emoji).toMatchObject({ kind: 'emoji', emoji: '😀', fx: 0.5, fy: 0.5 });
    expect(blur).toMatchObject({ kind: 'blur', fx: 0.5, fy: 0.5 });
    expect(blur).not.toHaveProperty('emoji');
    const view = normalizeAlbumPhotoView({
      zoom: 1,
      panFx: 0,
      panFy: 0,
      rotationDeg: 0,
      overlays: [emoji, { kind: 'emoji' }, { kind: 'star' }, { ...blur, fx: 5, size: 0 }]
    });
    expect(view.overlays).toEqual([emoji, { ...blur, fx: 1, size: 0.04 }]);
    const json = serializeAlbumPageInstances([
      { key: 'p', x: 0, y: 0, w: 500, h: 600, attachmentIds: [3], photoViews: { 3: view } }
    ]);
    const [page] = parseAlbumPageInstancesFromHtml(`<div data-rv-album-template="" data-album-templates="${json}"></div>`);
    expect(albumPagePhotoView(page, 3).overlays).toEqual(view.overlays);
  });
});
