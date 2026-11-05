import { fetchRecordVaultStorageLogoffProgress } from 'api/recordVaultFe';
import { RECORD_VAULT_THROTTLE_WAIT_POLL_MS } from './recordVaultThrottleWaitProgress';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * After a vault API response finishes, the server may still be sleeping through the
 * over-quota throttle (meter runs on res.end). Poll Redis until that wait clears.
 */
export async function waitForVaultTransferThrottleTail({
  onProgress,
  maxMs = 10 * 60 * 1000,
  graceMs = 3500
} = {}) {
  const startedAt = Date.now();
  const deadline = startedAt + Math.max(1000, Number(maxMs) || 0);
  let sawThrottle = false;

  while (Date.now() < deadline) {
    let percent = 0;
    let label = '';
    try {
      ({ percent, label } = await fetchRecordVaultStorageLogoffProgress());
    } catch {
      await sleep(RECORD_VAULT_THROTTLE_WAIT_POLL_MS);
      continue;
    }
    const pct = Math.round(Number(percent) || 0);
    if (pct > 0) {
      sawThrottle = true;
      onProgress?.({ phase: 'throttle', percent: pct, label });
      await sleep(RECORD_VAULT_THROTTLE_WAIT_POLL_MS);
      continue;
    }
    if (sawThrottle) break;
    if (Date.now() - startedAt > graceMs) break;
    await sleep(RECORD_VAULT_THROTTLE_WAIT_POLL_MS);
  }
}
