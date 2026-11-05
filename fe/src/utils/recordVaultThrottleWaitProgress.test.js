import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

/**
 * The exported hook is a thin useSyncExternalStore wrapper, so the logic worth
 * testing is the shared poller behind it: ref counting, monotonic percent,
 * reset on "no throttle wait", and teardown.
 */
const fetchMock = vi.fn();

vi.mock('api/recordVaultFe', () => ({
  fetchRecordVaultStorageLogoffProgress: (...args) => fetchMock(...args)
}));

describe('recordVaultThrottleWaitProgress poller', () => {
  let mod;

  beforeEach(async () => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.useFakeTimers();
    mod = await import('./recordVaultThrottleWaitProgress');
  });

  afterEach(() => {
    mod.resetRecordVaultThrottleWaitProgress();
    vi.useRealTimers();
  });

  it('publishes the live backend percent', async () => {
    fetchMock.mockResolvedValue({ percent: 42, label: '' });
    const listener = vi.fn();
    const unsubscribe = mod.subscribeRecordVaultThrottleWaitProgress(listener);

    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(mod.RECORD_VAULT_THROTTLE_WAIT_POLL_MS);

    expect(mod.getRecordVaultThrottleWaitProgressSnapshot()).toBe(42);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('never goes backwards between once-a-second backend reports', async () => {
    fetchMock.mockResolvedValue({ percent: 60, label: '' });
    fetchMock.mockResolvedValueOnce({ percent: 60, label: '' });
    const unsubscribe = mod.subscribeRecordVaultThrottleWaitProgress(() => {});
    await vi.advanceTimersByTimeAsync(mod.RECORD_VAULT_THROTTLE_WAIT_POLL_MS);
    expect(mod.getRecordVaultThrottleWaitProgressSnapshot()).toBe(60);

    // A slower in-flight request must not drag the displayed number backwards.
    fetchMock.mockResolvedValue({ percent: 12, label: '' });
    await vi.advanceTimersByTimeAsync(mod.RECORD_VAULT_THROTTLE_WAIT_POLL_MS);
    expect(mod.getRecordVaultThrottleWaitProgressSnapshot()).toBe(60);
    unsubscribe();
  });

  it('clears the percent once the throttled wait ends', async () => {
    fetchMock.mockResolvedValue({ percent: 88, label: '' });
    fetchMock.mockResolvedValueOnce({ percent: 88, label: '' });
    const unsubscribe = mod.subscribeRecordVaultThrottleWaitProgress(() => {});
    await vi.advanceTimersByTimeAsync(mod.RECORD_VAULT_THROTTLE_WAIT_POLL_MS);
    expect(mod.getRecordVaultThrottleWaitProgressSnapshot()).toBe(88);

    fetchMock.mockResolvedValue({ percent: 0, label: '' });
    await vi.advanceTimersByTimeAsync(mod.RECORD_VAULT_THROTTLE_WAIT_POLL_MS);
    expect(mod.getRecordVaultThrottleWaitProgressSnapshot()).toBeNull();
    unsubscribe();
  });

  it('polls only while at least one overlay is subscribed', async () => {
    fetchMock.mockResolvedValue({ percent: 10, label: '' });
    const first = mod.subscribeRecordVaultThrottleWaitProgress(() => {});
    const second = mod.subscribeRecordVaultThrottleWaitProgress(() => {});
    expect(vi.getTimerCount()).toBe(1);

    first();
    expect(vi.getTimerCount()).toBe(1);
    second();
    expect(vi.getTimerCount()).toBe(0);
    expect(mod.getRecordVaultThrottleWaitProgressSnapshot()).toBeNull();
  });

  it('survives a failing poll without throwing', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const unsubscribe = mod.subscribeRecordVaultThrottleWaitProgress(() => {});
    await vi.advanceTimersByTimeAsync(mod.RECORD_VAULT_THROTTLE_WAIT_POLL_MS * 2);
    expect(mod.getRecordVaultThrottleWaitProgressSnapshot()).toBeNull();
    unsubscribe();
  });
});
