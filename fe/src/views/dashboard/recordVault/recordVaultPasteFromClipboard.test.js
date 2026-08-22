import { describe, expect, it } from 'vitest';
import {
  buildRecordVaultPasteHtml,
  collectClipboardImageFiles,
  countUnmaterializedImages,
  dedupeImageFiles,
  dedupeMirroredPasteHtml,
  htmlHintsImages,
  isUnusableImageSrc,
  materializePastedHtmlImages,
  normalizePastedHtml,
  plainTextToHtml,
  recordVaultPasteSignature
} from './recordVaultPasteFromClipboard';

function mockClipboardData({ html = '', plain = '', files = [] } = {}) {
  const items = files.map((file) => ({
    kind: 'file',
    type: file.type,
    getAsFile: () => file
  }));
  return {
    getData(type) {
      if (type === 'text/html') return html;
      if (type === 'text/plain') return plain;
      return '';
    },
    files,
    items
  };
}

function pngFile(name = 'a.png') {
  // Minimal PNG header bytes
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  return new File([bytes], name, { type: 'image/png' });
}

describe('recordVaultPasteFromClipboard', () => {
  it('detects Apple Notes fake image URLs', () => {
    expect(isUnusableImageSrc('webkit-fake-url://abc')).toBe(true);
    expect(isUnusableImageSrc('data:image/png;base64,abc')).toBe(false);
  });

  it('hints when HTML contains Apple image placeholders', () => {
    expect(htmlHintsImages('<img src="webkit-fake-url://x">')).toBe(true);
    expect(htmlHintsImages('<p>hello</p>')).toBe(false);
  });

  it('preserves image-only divs during normalize', () => {
    const html = normalizePastedHtml(
      '<div><img src="webkit-fake-url://note-image-1"></div><p>caption</p>'
    );
    expect(html).toMatch(/<img\b/i);
    expect(html).toMatch(/caption/);
  });

  it('maps clipboard image files onto unusable image placeholders', async () => {
    const normalized =
      '<p>before</p><img src="#"><img src=""><p>after</p>';

    const f1 = pngFile('1.png');
    const f2 = pngFile('2.png');
    const { html, unusedFiles } = await materializePastedHtmlImages(normalized, [f1, f2]);

    if (typeof DOMParser === 'undefined') {
      expect(html).toContain('before');
      return;
    }

    expect(unusedFiles).toHaveLength(0);
    expect(html.match(/<img\b/gi)?.length).toBe(2);
    expect(html).toMatch(/src="data:image\/png;base64,/);
    expect(html).toMatch(/before/);
    expect(html).toMatch(/after/);
  });

  it('normalize keeps Apple Notes img placeholders in browser-like HTML', () => {
    const html = normalizePastedHtml(
      '<!--StartFragment--><div><img src="webkit-fake-url://note-image-1"></div><!--EndFragment-->'
    );
    expect(html).toMatch(/<img\b/i);
  });

  it('appends leftover image files when HTML has no img tags', async () => {
    const { html, unusedFiles } = await materializePastedHtmlImages('<p>text only</p>', [pngFile()]);
    expect(unusedFiles).toHaveLength(1);
    expect(html).toMatch(/text only/);
  });

  it('collects image files from clipboardData.items', () => {
    const f1 = pngFile('x.png');
    const f2 = pngFile('y.png');
    f2.__testSizeOverride = true;
    Object.defineProperty(f2, 'size', { value: f1.size + 1 });
    const cd = mockClipboardData({ files: [f1, f2] });
    const out = collectClipboardImageFiles(cd);
    expect(out).toHaveLength(2);
  });

  it('dedupes identical files', () => {
    const f = pngFile();
    expect(dedupeImageFiles([f, f])).toHaveLength(1);
  });

  it('plainTextToHtml keeps paragraph breaks', () => {
    const html = plainTextToHtml('line1\n\nline2');
    expect(html).toMatch(/line1/);
    expect(html).toMatch(/line2/);
  });

  it('dedupes mirrored Apple Notes HTML (same block twice)', () => {
    const block = '<p>Device manual</p><table><tr><td>Handle</td></tr></table>';
    const doubled = `${block}${block}`;
    const once = dedupeMirroredPasteHtml(doubled);
    expect(once).toBe(block);
  });

  it('dedupes consecutive identical top-level blocks', () => {
    const block = '<div><p>section A with enough text to exceed dedupe threshold comfortably</p></div>';
    const html = dedupeMirroredPasteHtml(`${block}${block}`);
    expect(html).toBe(block);
  });

  it('buildRecordVaultPasteHtml does not duplicate mirrored clipboard HTML', async () => {
    const block =
      '<p>Power station parts list with enough characters to trip mirror detection easily.</p>' +
      '<img src="webkit-fake-url://x">';
    const html = await buildRecordVaultPasteHtml(
      mockClipboardData({ html: `${block}${block}`, plain: 'parts list' })
    );
    expect(html).toMatch(/parts list/);
    expect((html.match(/Power station parts/g) || []).length).toBe(1);
  });

  it('paste signature matches identical clipboard payloads', () => {
    const cd = mockClipboardData({ html: '<p>x</p>', plain: 'x' });
    expect(recordVaultPasteSignature(cd)).toBe(recordVaultPasteSignature(cd));
  });
});
