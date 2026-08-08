import { dispatchTooManyRequestsModal } from 'ui-component/TooManyRequestsModal';

/** Call when any `fetch` receives HTTP 429 so the same UI as axios runs. */
export function notifyRateLimit429(status) {
  if (status === 429 && typeof window !== 'undefined') {
    dispatchTooManyRequestsModal();
  }
}
