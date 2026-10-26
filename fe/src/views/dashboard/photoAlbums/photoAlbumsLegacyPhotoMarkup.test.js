import { describe, expect, it } from 'vitest';
import { hasLegacyAlbumPhotoMarkup, stripLegacyAlbumPhotoMarkup } from './photoAlbumsLegacyPhotoMarkup';

const TEMPLATE =
  '<div data-rv-album-template="" data-album-templates="[]" data-album-orientation="portrait" style="display:none"></div>';
const LABEL = '<div data-rv-text-label="" class="rv-text-label" data-text="Hi">Hi</div>';

describe('stripLegacyAlbumPhotoMarkup', () => {
  it('removes placed photo atoms regardless of attribute order', () => {
    const html =
      `${TEMPLATE}<p>a</p>` +
      '<div data-attachment-id="12" data-file-name="x &gt; y.jpg" data-frame-left="10" data-rv-attachment=""></div>' +
      '<div data-rv-attachment="" data-attachment-id="13"></div>' +
      LABEL;
    expect(stripLegacyAlbumPhotoMarkup(html)).toBe(`${TEMPLATE}<p>a</p>${LABEL}`);
  });

  it('removes the staging tray JSON marker', () => {
    const html = `${TEMPLATE}<div data-rv-album-staging="" data-staging-json="[{&quot;attachmentId&quot;:5}]" style="display:none"></div><p>x</p>`;
    expect(stripLegacyAlbumPhotoMarkup(html)).toBe(`${TEMPLATE}<p>x</p>`);
  });

  it('keeps text labels, pages and plain content untouched', () => {
    const html = `${TEMPLATE}<p>hello</p>${LABEL}`;
    expect(stripLegacyAlbumPhotoMarkup(html)).toBe(html);
  });

  it('handles empty / nullish input', () => {
    expect(stripLegacyAlbumPhotoMarkup('')).toBe('');
    expect(stripLegacyAlbumPhotoMarkup(null)).toBe('');
    expect(stripLegacyAlbumPhotoMarkup(undefined)).toBe('');
  });

  it('is idempotent', () => {
    const html = `<div data-rv-attachment="" data-attachment-id="1"></div>${LABEL}`;
    const once = stripLegacyAlbumPhotoMarkup(html);
    expect(stripLegacyAlbumPhotoMarkup(once)).toBe(once);
  });
});

describe('hasLegacyAlbumPhotoMarkup', () => {
  it('detects legacy markup and is stable across repeated calls', () => {
    const html = '<div data-rv-attachment="" data-attachment-id="1"></div>';
    expect(hasLegacyAlbumPhotoMarkup(html)).toBe(true);
    expect(hasLegacyAlbumPhotoMarkup(html)).toBe(true);
    expect(hasLegacyAlbumPhotoMarkup(LABEL)).toBe(false);
  });
});
