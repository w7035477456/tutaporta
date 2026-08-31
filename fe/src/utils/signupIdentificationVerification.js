import { SELF_REPORT_BIOGRAPHY_PATH } from 'constants/selfReportBiographyRoute';
import { LIVE_FACE_SCAN_POPUP_PATH } from 'constants/liveFaceScanPopupRoute';
import { FIRST_LOGIN_AUTO_POPUPS_ENABLED } from 'config/firstLoginAutoPopupsEnv';
import { needsIdentificationVerificationFirstLogin } from 'utils/firstLoginOnboarding';

const STORAGE_KEY = 'signupIdVerificationRequired';
export const SIGNUP_ID_VERIFICATION_LOCK_CHANGED_EVENT = 'signup-id-verification-lock-changed';

function notifyIdentificationVerificationLockChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SIGNUP_ID_VERIFICATION_LOCK_CHANGED_EVENT));
}

export function markSignupIdentificationVerificationRequired() {
  if (!FIRST_LOGIN_AUTO_POPUPS_ENABLED) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, '1');
    notifyIdentificationVerificationLockChanged();
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearSignupIdentificationVerificationRequired() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    notifyIdentificationVerificationLockChanged();
  } catch {
    /* ignore */
  }
}

export function isSignupIdentificationVerificationRequired() {
  if (!FIRST_LOGIN_AUTO_POPUPS_ENABLED) return false;
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Force Identification Verification when photo+alias+secret are done and
 * over_18_verified is still null.
 */
export function isIdentificationVerificationLockActive(user) {
  if (!FIRST_LOGIN_AUTO_POPUPS_ENABLED) return false;
  return needsIdentificationVerificationFirstLogin(user);
}

export function isPathAllowedDuringIdentificationVerificationLock(pathname) {
  const path = String(pathname ?? '');
  return path === SELF_REPORT_BIOGRAPHY_PATH || path === LIVE_FACE_SCAN_POPUP_PATH;
}

/** Disable every sidebar nav item during mandatory Identification Verification. */
export function applyIdentificationVerificationMenuDisabled(menuConfig, lockActive) {
  if (!lockActive || !menuConfig?.items) return menuConfig;
  return {
    ...menuConfig,
    items: menuConfig.items.map((group) => ({
      ...group,
      children: (group.children ?? []).map((item) => ({
        ...item,
        disabled: true
      }))
    }))
  };
}
