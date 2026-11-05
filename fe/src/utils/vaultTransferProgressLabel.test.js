import { buildVaultTransferProgressLabel, formatVaultTransferBytes } from './vaultTransferProgressLabel';

describe('formatVaultTransferBytes', () => {
  it('formats common sizes', () => {
    expect(formatVaultTransferBytes(512)).toBe('512 B');
    expect(formatVaultTransferBytes(2048)).toBe('2.0 KB');
    expect(formatVaultTransferBytes(5 * 1024 * 1024)).toMatch(/MB/);
  });
});

describe('buildVaultTransferProgressLabel', () => {
  it('shows byte counts during download', () => {
    const line = buildVaultTransferProgressLabel({
      phase: 'download',
      loadedBytes: 512 * 1024,
      totalBytes: 2 * 1024 * 1024,
      bytesPerSec: 256 * 1024
    });
    expect(line).toMatch(/Transfer:/);
    expect(line).toMatch(/\/.*MB/);
    expect(line).toMatch(/KB\/s|MB\/s/);
  });

  it('shows received-only when total is unknown', () => {
    const line = buildVaultTransferProgressLabel({ phase: 'download', loadedBytes: 4096, totalBytes: 0 });
    expect(line).toContain('4096 B received');
  });
});
