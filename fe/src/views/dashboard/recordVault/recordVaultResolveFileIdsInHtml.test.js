import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveRecordVaultFileIdsInHtml,
  stripResolvedFileSrcFromHtml
} from './recordVaultResolveFileIdsInHtml.js';

describe('recordVaultResolveFileIdsInHtml', () => {
  it('adds inline attachment src for data-file-id', () => {
    const html = '<p>x</p><img data-file-id="12" alt=""><p>y</p>';
    const out = resolveRecordVaultFileIdsInHtml(html, 99);
    assert.match(out, /data-file-id="12"/);
    assert.match(out, /src="\/api\/recordVault\/notes\/99\/attachments\/12\?inline=1"/);
  });

  it('strips resolved src before save', () => {
    const html =
      '<img src="/api/recordVault/notes/99/attachments/12?inline=1" data-file-id="12" alt="">';
    const out = stripResolvedFileSrcFromHtml(html);
    assert.match(out, /data-file-id="12"/);
    assert.doesNotMatch(out, /\ssrc=/);
  });
});
