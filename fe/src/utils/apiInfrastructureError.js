import { SYSTEM_OVERLOADED_CODE } from 'constants/systemOverload';

/**
 * True when the failure is likely unreachable / overloaded backend or DB,
 * not a normal auth or validation error. Used to show ServiceNotice instead of ErrorPopup.
 */
export function isApiInfrastructureError(err) {
  if (!err) return false;
  if (err?.code === SYSTEM_OVERLOADED_CODE || err?.response?.data?.code === SYSTEM_OVERLOADED_CODE) {
    return false;
  }
  if (err.name === 'TypeError') return true;
  const s = err.status ?? err?.response?.status;
  if (typeof s !== 'number') return false;
  if (s === 503 && err?.response?.data?.code === SYSTEM_OVERLOADED_CODE) return false;
  // 500: route-level DB errors; 502–504: proxy / unavailable
  return s === 500 || (s >= 502 && s <= 504);
}
