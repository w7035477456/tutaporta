import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildBackupDownloadHeaders } from './backupDownloadHeaders.js';

const NOW = new Date('2026-11-04T20:30:00.000Z');
const STORED_MS = Date.parse('2026-11-04T18:15:30.000Z');

describe('buildBackupDownloadHeaders', () => {
  it('sends Last-Modified + ETag for a stored backup', () => {
    const headers = buildBackupDownloadHeaders({ sizeBytes: 653_721_600, mtimeMs: STORED_MS }, NOW);
    assert.equal(headers['Last-Modified'], 'Wed, 04 Nov 2026 18:15:30 GMT');
    assert.match(headers.ETag, /^"[0-9a-f]+-[0-9a-f]+"$/);
  });

  it('builds a stable ETag from size + mtime', () => {
    const a = buildBackupDownloadHeaders({ sizeBytes: 1000, mtimeMs: STORED_MS }, NOW);
    const b = buildBackupDownloadHeaders({ sizeBytes: 1000, mtimeMs: STORED_MS }, NOW);
    const bigger = buildBackupDownloadHeaders({ sizeBytes: 2000, mtimeMs: STORED_MS }, NOW);
    assert.equal(a.ETag, b.ETag);
    assert.notEqual(a.ETag, bigger.ETag);
  });

  it('omits headers when the mtime is unknown (never fakes "now")', () => {
    assert.deepEqual(buildBackupDownloadHeaders({ sizeBytes: 10, mtimeMs: 0 }, NOW), {});
    assert.deepEqual(buildBackupDownloadHeaders({ sizeBytes: 10, mtimeMs: NaN }, NOW), {});
    assert.deepEqual(buildBackupDownloadHeaders({ sizeBytes: 10, mtimeMs: null }, NOW), {});
    assert.deepEqual(buildBackupDownloadHeaders({}, NOW), {});
  });

  it('clamps a future mtime so the file never looks newer than it is', () => {
    const future = Date.parse('2027-01-01T00:00:00.000Z');
    const headers = buildBackupDownloadHeaders({ sizeBytes: 10, mtimeMs: future }, NOW);
    assert.equal(headers['Last-Modified'], 'Wed, 04 Nov 2026 20:30:00 GMT');
  });

  it('never throws on a garbage size', () => {
    const headers = buildBackupDownloadHeaders({ sizeBytes: 'x', mtimeMs: STORED_MS }, NOW);
    assert.match(headers.ETag, /^"0-/);
  });

  it('keeps a past mtime unchanged (the normal case)', () => {
    const past = Date.parse('2026-11-03T09:00:00.000Z');
    const headers = buildBackupDownloadHeaders({ sizeBytes: 42, mtimeMs: past }, NOW);
    assert.equal(headers['Last-Modified'], 'Tue, 03 Nov 2026 09:00:00 GMT');
  });
});
