import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bodyHasInlineDataImage,
  decodeDataImageUrl,
  mimeSubtypeToExt,
  rewriteInlineDataImages
} from './extractInlineDataImages.js';

const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('extractInlineDataImages', () => {
  it('detects data:image bodies and skips inner-encrypted', () => {
    assert.equal(bodyHasInlineDataImage(`<img src="data:image/png;base64,${TINY_PNG_B64}">`), true);
    assert.equal(bodyHasInlineDataImage('<p>hi</p>'), false);
    assert.equal(bodyHasInlineDataImage(`\u2063RVI${'x'.repeat(20)}`), false);
  });

  it('decodes png data urls', () => {
    const decoded = decodeDataImageUrl(`data:image/png;base64,${TINY_PNG_B64}`);
    assert.ok(decoded);
    assert.equal(decoded.ext, 'png');
    assert.equal(decoded.mimeType, 'image/png');
    assert.ok(decoded.buffer.length > 10);
  });

  it('maps jpeg subtype to jpg', () => {
    assert.equal(mimeSubtypeToExt('jpeg'), 'jpg');
  });

  it('rewrites img tags to data-file-id pointers', async () => {
    const html = `<p>x</p><img src="data:image/png;base64,${TINY_PNG_B64}" alt="a"><p>y</p>`;
    let n = 0;
    const { html: out, extracted, failed } = await rewriteInlineDataImages(html, async () => {
      n += 1;
      return { fileId: 40 + n };
    });
    assert.equal(extracted, 1);
    assert.equal(failed, 0);
    assert.equal(n, 1);
    assert.match(out, /data-file-id="41"/);
    assert.doesNotMatch(out, /data:image/);
    assert.doesNotMatch(out, /\ssrc=/i);
  });
});
