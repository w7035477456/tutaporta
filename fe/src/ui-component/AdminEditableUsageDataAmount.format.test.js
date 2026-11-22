import {
  USAGE_DATA_GB_THRESHOLD_MB,
  formatUsageDataAmount,
  formatUsageDataAmountFromBytes
} from './AdminEditableUsageDataAmount';

describe('formatUsageDataAmount (>999MB → #.#gb)', () => {
  it('keeps values at or below 999MB in mb', () => {
    expect(formatUsageDataAmount(999)).toBe('999.0mb');
    expect(formatUsageDataAmount(999, { precisionMb: 0 })).toBe('999mb');
    expect(USAGE_DATA_GB_THRESHOLD_MB).toBe(999);
  });

  it('shows GB with one decimal once MB exceeds 999', () => {
    expect(formatUsageDataAmount(1000)).toBe('1.0gb');
    expect(formatUsageDataAmount(1607)).toBe('1.6gb');
    expect(formatUsageDataAmount(384)).toBe('384.0mb');
  });

  it('formats bytes with the same threshold', () => {
    const MiB = 1024 * 1024;
    expect(formatUsageDataAmountFromBytes(384 * MiB, { precisionMb: 0 })).toBe('384mb');
    expect(formatUsageDataAmountFromBytes(1607 * MiB)).toBe('1.6gb');
  });
});
