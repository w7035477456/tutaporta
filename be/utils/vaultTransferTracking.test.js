import { describe, expect, it } from 'vitest';
import { vaultTransferThrottleProgressPercent } from './vaultTransferTracking.js';

describe('vaultTransferThrottleProgressPercent', () => {
  it('returns 0 when total throttle ms is missing', () => {
    expect(vaultTransferThrottleProgressPercent({ remainingMs: 500, totalThrottleMs: 0 })).toBe(0);
  });

  it('maps remaining time to 1–99 percent complete', () => {
    expect(
      vaultTransferThrottleProgressPercent({ remainingMs: 9000, totalThrottleMs: 10000 })
    ).toBe(10);
    expect(
      vaultTransferThrottleProgressPercent({ remainingMs: 5000, totalThrottleMs: 10000 })
    ).toBe(50);
    expect(
      vaultTransferThrottleProgressPercent({ remainingMs: 0, totalThrottleMs: 10000 })
    ).toBe(99);
  });
});
