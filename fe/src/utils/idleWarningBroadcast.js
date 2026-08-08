/** Header badge ↔ SessionTimeoutWarning (custom_logout_duration main countdown). */
export const VSINGLES_IDLE_WARNING_EVENT = 'vsingles-idle-warning';

/** @param {{ active: boolean, phase?: 'idle' | 'main' | 'warn', remainingSeconds?: number }} detail */
export function dispatchIdleWarningState(detail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(VSINGLES_IDLE_WARNING_EVENT, { detail }));
}
