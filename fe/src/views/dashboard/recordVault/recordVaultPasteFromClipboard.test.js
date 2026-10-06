import { describe, expect, it } from 'vitest';
import {
  buildRecordVaultPasteHtml,
  buildRecordVaultPasteResult,
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

  it('treats Apple RTFD relative image names and file: paths as unusable', () => {
    expect(isUnusableImageSrc('Pasted Graphic.png')).toBe(true);
    expect(isUnusableImageSrc('image.tiff')).toBe(true);
    expect(isUnusableImageSrc('file:///Users/a/x.png')).toBe(true);
    expect(isUnusableImageSrc('blob:http://localhost:3000/abc')).toBe(false);
    expect(isUnusableImageSrc('https://example.com/a.png')).toBe(false);
    expect(isUnusableImageSrc('/api/photo/1')).toBe(false);
  });

  it('maps a clipboard image onto an Apple attachment marker (U+FFFC) in HTML', async () => {
    const result = await buildRecordVaultPasteResult(
      mockClipboardData({
        html: '<p>Sept 1st rent</p><p>\uFFFC</p><p>Aug 1st rent</p>',
        plain: 'Sept 1st rent\n\uFFFC\nAug 1st rent',
        files: [pngFile('util.png')]
      })
    );
    if (typeof DOMParser === 'undefined') return;
    expect(result.expectedImages).toBe(1);
    expect(result.insertedImages).toBe(1);
    expect(result.html).toMatch(/Sept 1st rent/);
    expect(result.html).toMatch(/src="data:image\/png;base64,/);
    expect(result.html.indexOf('Sept 1st')).toBeLessThan(result.html.indexOf('<img'));
    expect(result.html.indexOf('<img')).toBeLessThan(result.html.indexOf('Aug 1st'));
  });

  it('reports images the clipboard did not expose', async () => {
    const result = await buildRecordVaultPasteResult(
      mockClipboardData({
        html: '<p>Tenant rent</p><img src="webkit-fake-url://a"><img src="Pasted Graphic.png">',
        plain: 'Tenant rent'
      })
    );
    expect(result.html).toMatch(/Tenant rent/);
    if (typeof DOMParser === 'undefined') return;
    expect(result.expectedImages).toBe(2);
    expect(result.insertedImages).toBe(0);
    expect(result.html).not.toMatch(/<img\b/i);
  });

  it('plain-text paste with U+FFFC slots inserts clipboard images in place', async () => {
    const result = await buildRecordVaultPasteResult(
      mockClipboardData({ plain: 'line one\n\uFFFC\nline two', files: [pngFile('p.png')] })
    );
    if (typeof DOMParser === 'undefined') return;
    expect(result.insertedImages).toBe(1);
    expect(result.html).toMatch(/line one/);
    expect(result.html).toMatch(/line two/);
    expect(result.html).not.toMatch(/\uFFFC/);
  });

  it('paste signature matches identical clipboard payloads', () => {
    const cd = mockClipboardData({ html: '<p>x</p>', plain: 'x' });
    expect(recordVaultPasteSignature(cd)).toBe(recordVaultPasteSignature(cd));
  });
});

/** Shape of Chrome's clipboard HTML for an amazon.com deal row (matched CSS inlined per element). */
function amazonCard(n, imgStyle = 'width: 160px; height: 160px;') {
  return (
    `<div class="a-cardui" style="box-sizing: border-box; display: block; width: 180px; background-color: rgb(255, 255, 255); text-align: center;">` +
    `<a href="https://www.amazon.com/dp/B0${n}" style="color: rgb(15, 17, 17); text-decoration: none;">` +
    `<img alt="Product ${n}" src="https://m.media-amazon.com/images/I/p${n}._AC_SY200_.jpg" style="${imgStyle}"></a>` +
    `<div style="display: flex; gap: 4px; align-items: center;">` +
    `<span style="background: none 0% 0% / auto repeat scroll padding-box border-box rgb(204, 12, 57); color: rgb(255, 255, 255); font-size: 0.75rem; font-weight: 700;">2${n}% off</span>` +
    `<span style="color: rgb(204, 12, 57); font-size: 12px;">Limited time deal</span></div>` +
    `<div style="font-size: 1.5em;">$1${n}9<sup>99</sup></div></div>`
  );
}

const amazonRowHtml =
  `<meta charset='utf-8'><div class="dcl-container-inner" style="box-sizing: border-box; color: rgb(15, 17, 17); font-family: &quot;Amazon Ember&quot;, Arial, sans-serif; font-size: 14px; font-weight: 400; text-align: start;">` +
  `<div style="display: flex; justify-content: space-between;">` +
  `<h2 style="font-size: 21px; font-weight: 700; color: rgb(255, 255, 255); background-color: rgb(35, 47, 62);">Buy now, pay over time</h2>` +
  `<a href="javascript:void(0)" style="color: rgb(0, 113, 133);">See more</a></div>` +
  `<div class="carousel" style="display: flex; flex-direction: row; width: 1100px;">` +
  `${amazonCard(1)}${amazonCard(2)}${amazonCard(3)}` +
  `</div><div style="display: none;">hidden carousel template</div></div>`;

const describeDom = typeof DOMParser === 'undefined' ? describe.skip : describe;

describeDom('web page paste (amazon.com)', () => {
  it('lays side-by-side product cards out as a table row with card background', () => {
    const html = normalizePastedHtml(amazonRowHtml);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rows = doc.querySelectorAll('table tr');
    expect(rows).toHaveLength(1);
    const cells = rows[0].querySelectorAll('td');
    expect(cells).toHaveLength(3);
    expect(cells[0].getAttribute('style')).toMatch(/background-color:\s*rgb\(255, 255, 255\)/);
    expect(cells[1].querySelector('img')?.getAttribute('src')).toMatch(/p2\._AC_SY200_\.jpg$/);
  });

  it('keeps pixel image width', () => {
    const html = normalizePastedHtml(amazonRowHtml);
    expect(html).toMatch(/<img[^>]*\swidth="160"/);
  });

  it('puts inherited font, size, color and background on each text run', () => {
    const html = normalizePastedHtml(amazonRowHtml);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const styledRun = (text) =>
      [...doc.querySelectorAll('span[style]')].find((s) => s.textContent === text);
    const badge = styledRun('21% off');
    const style = badge?.getAttribute('style') || '';
    expect(style).toMatch(/color:\s*rgb\(255, 255, 255\)/);
    expect(style).toMatch(/background-color:\s*rgb\(204, 12, 57\)/);
    expect(style).toMatch(/font-size:\s*12px/);
    expect(style).toMatch(/font-weight:\s*700/);
    expect(style).toMatch(/Amazon Ember/);

    const price = styledRun('$119');
    expect(price?.getAttribute('style')).toMatch(/font-size:\s*21px/);
  });

  it('keeps short text flex rows on one line', () => {
    const html = normalizePastedHtml(amazonRowHtml);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const cellParagraphs = [...doc.querySelectorAll('td')[0].querySelectorAll('p')].map((p) =>
      p.textContent.trim()
    );
    expect(cellParagraphs).toContain('21% off Limited time deal');
  });

  it('centers paragraphs from centered cards', () => {
    const html = normalizePastedHtml(amazonRowHtml);
    expect(html).toMatch(/<p style="text-align: center">/);
  });

  it('drops hidden elements and javascript: links', () => {
    const html = normalizePastedHtml(amazonRowHtml);
    expect(html).not.toMatch(/hidden carousel template/);
    expect(html).not.toMatch(/javascript:/i);
    expect(html).toMatch(/See more/);
    expect(html).toMatch(/href="https:\/\/www\.amazon\.com\/dp\/B01"/);
  });

  it('wraps long carousels into rows of at most 4 cards', () => {
    const cards = Array.from({ length: 9 }, (_, i) => amazonCard(i + 1)).join('');
    const html = normalizePastedHtml(`<div style="display: flex;">${cards}</div>`);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rows = [...doc.querySelectorAll('table tr')];
    expect(rows.map((r) => r.querySelectorAll('td').length)).toEqual([4, 4, 4]);
  });

  it('uses the grid column count for CSS grids', () => {
    const cards = Array.from({ length: 4 }, (_, i) => amazonCard(i + 1)).join('');
    const html = normalizePastedHtml(
      `<div style="display: grid; grid-template-columns: 180px 180px;">${cards}</div>`
    );
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rows = [...doc.querySelectorAll('table tr')];
    expect(rows.map((r) => r.querySelectorAll('td').length)).toEqual([2, 2]);
  });

  it('converts pt font sizes (Word) to px', () => {
    const html = normalizePastedHtml('<p><span style="font-size: 12pt; font-family: Calibri">Hi there</span></p>');
    expect(html).toMatch(/font-size:\s*16px/);
    expect(html).toMatch(/font-family:\s*Calibri/);
  });

  it('leaves plain Apple Notes style markup unstyled', () => {
    const html = normalizePastedHtml('<div>Sept 1st rent</div><div><br></div><div>Aug 1st rent</div>');
    expect(html).toBe('<p>Sept 1st rent</p><p><br></p><p>Aug 1st rent</p>');
  });
});
