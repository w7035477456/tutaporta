import { describe, expect, it } from 'vitest';
import {
  VAULT_OVERAGE_THROTTLE_BUSY_MESSAGE,
  speedThrottledPhrase,
  throttleMultipleLabel,
  transferSpeedThrottledPhrase,
  vaultOverageThrottleAriaMessage
} from './recordVaultOverageThrottleUi';

describe('throttle multiple copy', () => {
  it('formats whole and fractional multiples', () => {
    expect(throttleMultipleLabel(10)).toBe('10x');
    expect(throttleMultipleLabel('5')).toBe('5x');
    expect(throttleMultipleLabel(2.5)).toBe('2.5x');
    expect(throttleMultipleLabel(2.46)).toBe('2.5x');
  });

  it('omits the multiple at full speed or when unknown', () => {
    expect(throttleMultipleLabel(1)).toBe('');
    expect(throttleMultipleLabel(0)).toBe('');
    expect(throttleMultipleLabel(-4)).toBe('');
    expect(throttleMultipleLabel(null)).toBe('');
    expect(throttleMultipleLabel(undefined)).toBe('');
    expect(throttleMultipleLabel('fast')).toBe('');
    expect(throttleMultipleLabel(NaN)).toBe('');
  });

  it('builds the usage-bar phrase with the multiple', () => {
    expect(speedThrottledPhrase(10)).toBe('speed throttled 10x');
    expect(speedThrottledPhrase(2.5)).toBe('speed throttled 2.5x');
    expect(speedThrottledPhrase(1)).toBe('speed throttled');
    expect(speedThrottledPhrase(null)).toBe('speed throttled');
  });

  it('builds the full notice phrase with the multiple', () => {
    expect(transferSpeedThrottledPhrase(10)).toBe('Transfer Speed is being throttled 10x');
    expect(transferSpeedThrottledPhrase(1)).toBe('Transfer Speed is being throttled');
  });

  it('builds the complete aria sentence', () => {
    expect(vaultOverageThrottleAriaMessage(10)).toBe(
      'Data Transfer Refill Depleted. Transfer Speed is being throttled 10x. Please REFILL to return to maximum speed.'
    );
    expect(vaultOverageThrottleAriaMessage(1)).toBe(VAULT_OVERAGE_THROTTLE_BUSY_MESSAGE);
  });

  it('still matches throttle lines with the multiple appended', () => {
    const re = /Transfer Speed is being throttled|Data Transfer Refill Depleted|Remain Transfer Data exceeded|Please REFILL/i;
    expect(re.test(transferSpeedThrottledPhrase(10))).toBe(true);
    expect(re.test(vaultOverageThrottleAriaMessage(10))).toBe(true);
    expect(re.test('Uploading photo 3 of 10')).toBe(false);
  });
});
