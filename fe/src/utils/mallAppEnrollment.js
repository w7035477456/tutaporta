/** sessionStorage — show mall app enrollment popup once after each sign-in. */
export const MALL_APP_ENROLLMENT_PENDING_KEY = 'mallAppEnrollmentPending';
export const MALL_APP_ENROLLMENT_EVENT = 'mall-app-enrollment';

export function requestMallAppEnrollmentPopup() {
  try {
    sessionStorage.setItem(MALL_APP_ENROLLMENT_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MALL_APP_ENROLLMENT_EVENT));
  }
}

export function peekMallAppEnrollmentPending() {
  try {
    return sessionStorage.getItem(MALL_APP_ENROLLMENT_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearMallAppEnrollmentPending() {
  try {
    sessionStorage.removeItem(MALL_APP_ENROLLMENT_PENDING_KEY);
  } catch {
    /* ignore */
  }
}
