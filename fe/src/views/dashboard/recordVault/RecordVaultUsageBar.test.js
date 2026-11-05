import { describe, expect, it } from 'vitest';
import { DEFAULT_VISIBLE_THROTTLE_FACTOR, resolveVisibleThrottleFactor } from './RecordVaultUsageBar';

describe('resolveVisibleThrottleFactor', () => {
  it('uses the backend multiple when it reports a real slowdown', () => {
    expect(resolveVisibleThrottleFactor(10, true)).toBe(10);
    expect(resolveVisibleThrottleFactor(3, true)).toBe(3);
    expect(resolveVisibleThrottleFactor(2.5, true)).toBe(2.5);
  });

  it('falls back to the default multiple while depleted', () => {
    expect(resolveVisibleThrottleFactor(undefined, true)).toBe(DEFAULT_VISIBLE_THROTTLE_FACTOR);
    expect(resolveVisibleThrottleFactor(null, true)).toBe(DEFAULT_VISIBLE_THROTTLE_FACTOR);
    expect(resolveVisibleThrottleFactor(0, true)).toBe(DEFAULT_VISIBLE_THROTTLE_FACTOR);
    expect(resolveVisibleThrottleFactor(1, true)).toBe(DEFAULT_VISIBLE_THROTTLE_FACTOR);
    expect(resolveVisibleThrottleFactor('x', true)).toBe(DEFAULT_VISIBLE_THROTTLE_FACTOR);
  });

  it('reports full speed when not depleted', () => {
    expect(resolveVisibleThrottleFactor(undefined, false)).toBe(1);
    expect(resolveVisibleThrottleFactor(1, false)).toBe(1);
  });
});
