import { describe, expect, it } from 'vitest';
import { buildBackupProgressBytesText } from './backupProgressBytesText';

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;

describe('buildBackupProgressBytesText', () => {
  it('returns empty when there is nothing to show', () => {
    expect(buildBackupProgressBytesText(null)).toBe('');
    expect(buildBackupProgressBytesText({})).toBe('');
    expect(buildBackupProgressBytesText({ loadedBytes: 0, totalBytes: 0 })).toBe('');
  });

  it('shows gb on row 1 and mb on row 2 for the same progress', () => {
    const text = buildBackupProgressBytesText({
      loadedBytes: 1.4 * GiB,
      totalBytes: 1.9 * GiB
    });
    expect(text).toBe('1.4gb of 1.9gb done\n1434mb of 1946mb done');
  });

  it('still shows both units when only loaded is known', () => {
    expect(buildBackupProgressBytesText({ loadedBytes: 512 * MiB })).toBe('0.5gb done\n512mb done');
  });

  it('uses reported total on the server stage', () => {
    const text = buildBackupProgressBytesText({
      stage: 'server',
      totalBytes: 2 * GiB
    });
    expect(text).toBe('2.0gb of 2.0gb done\n2048mb of 2048mb done');
  });
});
