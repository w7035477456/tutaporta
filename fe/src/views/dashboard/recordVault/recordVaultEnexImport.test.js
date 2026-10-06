import { describe, expect, it } from 'vitest';
import { md5 } from 'hash-wasm';
import { convertEnexToHtml, enexImportSummaryMessage } from './recordVaultEnexImport';
import {
  buildRecordVaultPasteResult,
  isEvernoteClipboardHtml,
  recordVaultMissingPasteImagesMessage
} from './recordVaultPasteFromClipboard';

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const CONF_TEXT = '# GeoIP.conf\n\nAccountID 123\n\nEditionIDs GeoLite2-City';

function toBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

async function buildEnex({ swapResourceOrder = false } = {}) {
  const confBytes = new TextEncoder().encode(CONF_TEXT);
  const pngHash = await md5(PNG_BYTES);
  const confHash = await md5(confBytes);
  const pngRes = `<resource><data encoding="base64">\n${toBase64(PNG_BYTES)}\n</data><mime>image/png</mime><resource-attributes><file-name>shot.png</file-name></resource-attributes></resource>`;
  const confRes = `<resource><data encoding="base64">${toBase64(confBytes)}</data><mime>text/plain</mime><resource-attributes><file-name>GeoIP.conf</file-name></resource-attributes></resource>`;
  const content =
    '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">' +
    '<en-note><div>Still use</div>' +
    '<div><b><span style="color:rgb(252, 18, 51);">LICENSE: abc</span></b></div>' +
    `<en-media type="text/plain" hash="${confHash}"/>` +
    `<div><en-todo checked="true"/>done item</div>` +
    `<en-media type="image/png" hash="${pngHash}" width="300"/>` +
    '<div>after image</div></en-note>';
  const resources = swapResourceOrder ? `${pngRes}${confRes}` : `${confRes}${pngRes}`;
  return (
    '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE en-export SYSTEM "http://xml.evernote.com/pub/evernote-export4.dtd">' +
    `<en-export><note><title>maxmind (April 25)</title><content><![CDATA[${content}]]></content>${resources}</note></en-export>`
  );
}

const describeDom = typeof DOMParser === 'undefined' ? describe.skip : describe;

describeDom('Evernote .enex import', () => {
  it('embeds images by md5 hash and inlines text attachments in place', async () => {
    const { html, title, stats } = await convertEnexToHtml(await buildEnex({ swapResourceOrder: true }));
    expect(title).toBe('maxmind (April 25)');
    expect(stats.images).toBe(1);
    expect(stats.attachments).toBe(1);
    expect(html).toContain(`src="data:image/png;base64,${toBase64(PNG_BYTES)}"`);
    expect(html).toMatch(/<img[^>]*width="300"/);
    expect(html).toContain('Attachment: GeoIP.conf');
    expect(html).toContain('AccountID 123');
    expect(html).not.toMatch(/\n\n/);
    expect(html.indexOf('LICENSE: abc')).toBeLessThan(html.indexOf('GeoIP.conf'));
    expect(html.indexOf('GeoIP.conf')).toBeLessThan(html.indexOf('<img'));
    expect(html.indexOf('<img')).toBeLessThan(html.indexOf('after image'));
    expect(html).toContain('☑ done item');
    expect(html).toContain('color:rgb(252, 18, 51)');
    expect(enexImportSummaryMessage(stats)).toBe('');
  });

  it('rejects files that are not Evernote exports', async () => {
    await expect(convertEnexToHtml('not xml <')).rejects.toThrow(/not a valid Evernote export/);
  });
});

const evernoteClipboardHtml =
  `<meta charset='utf-8'><div data-pm-slice="0 0 []" data-en-clipboard="true"><br></div><div>Still use</div>` +
  `<div><b><span style="font-size: 30px;"><span style="color:rgb(252, 18, 51);">LICENSE: abc</span></span></b></div>` +
  `<img data-type="text/plain" data-hash="85cd" src="en-cache://tokenKey%3D%22AuthToken%3AUser%3A1%22+x+85cd+https%3A%2F%2Fpublic.www.evernote.com%2Fresources%2Fs1%2Fa">` +
  `<img data-natural-width="1347" data-natural-height="943" data-type="image/png" data-hash="2287" src="en-cache://tokenKey%3D%22AuthToken%3AUser%3A1%22+x+2287+https%3A%2F%2Fpublic.www.evernote.com%2Fresources%2Fs1%2Fb">`;

describeDom('Evernote app paste', () => {
  it('pastes text, labels the file attachment, and reports the image as Evernote-held', async () => {
    expect(isEvernoteClipboardHtml(evernoteClipboardHtml)).toBe(true);
    const cd = { getData: (t) => (t === 'text/html' ? evernoteClipboardHtml : t === 'text/plain' ? 'Still use' : ''), files: [], items: [] };
    const result = await buildRecordVaultPasteResult(cd);
    expect(result.source).toBe('evernote');
    expect(result.html).toMatch(/LICENSE: abc/);
    expect(result.html).toMatch(/font-size: 30px/);
    expect(result.html).toMatch(/Evernote attachment \(text\/plain\)/);
    expect(result.html).not.toMatch(/en-cache:/);
    expect(result.expectedImages).toBe(1);
    expect(result.insertedImages).toBe(0);
    expect(recordVaultMissingPasteImagesMessage(1, result.source)).toMatch(/File → Import → Evernote \(\.enex\)/);
  });
});
