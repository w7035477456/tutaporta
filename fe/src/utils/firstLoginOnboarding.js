import { SELF_REPORT_BIOGRAPHY_PATH } from 'constants/selfReportBiographyRoute';
import { LIVE_FACE_SCAN_POPUP_PATH } from 'constants/liveFaceScanPopupRoute';
import { FIRST_LOGIN_AUTO_POPUPS_ENABLED } from 'config/firstLoginAutoPopupsEnv';
import { isImpersonationSession, isToolsOnlyAdminSession } from 'utils/adminSession';
import { isGuestDemoLogin } from 'utils/guestDemoLogin';
import { isOver18VerificationPending } from 'utils/over18Verified';

const MY_STORY_PATH = '/myStory';
const CONGRATS_PENDING_KEY = 'firstLoginOnboardingCongratsPending';

/** Demo login + admin tools/impersonation skip mandatory first-login onboarding. */
export function isFirstLoginOnboardingExempt(user) {
  if (!FIRST_LOGIN_AUTO_POPUPS_ENABLED) return true;
  if (!user) return true;
  if (isToolsOnlyAdminSession(user) || isImpersonationSession(user)) return true;
  if (isGuestDemoLogin(user)) return true;
  return false;
}

export function hasProfilePhotoFk(user) {
  const id = Number(user?.profile_image_fk);
  return Number.isFinite(id) && id >= 1;
}

export function hasAliasNickname(user) {
  return Boolean(String(user?.alias ?? '').trim());
}

export function hasSecretIconSet(user) {
  return user?.has_secret_icon === true || user?.has_secret_icon === 'true';
}

/**
 * @returns {'profile_photo' | 'alias_secret' | 'id_verification' | 'done'}
 */
export function getFirstLoginOnboardingPhase(user) {
  if (isFirstLoginOnboardingExempt(user)) return 'done';
  if (!hasProfilePhotoFk(user)) return 'profile_photo';
  if (!hasAliasNickname(user) || !hasSecretIconSet(user)) return 'alias_secret';
  if (isOver18VerificationPending(user?.over_18_verified)) return 'id_verification';
  return 'done';
}

export function needsMyStoryFirstLoginSetup(user) {
  const phase = getFirstLoginOnboardingPhase(user);
  return phase === 'profile_photo' || phase === 'alias_secret';
}

export function needsIdentificationVerificationFirstLogin(user) {
  return getFirstLoginOnboardingPhase(user) === 'id_verification';
}

export function isPathAllowedDuringFirstLoginPhase(pathname, phase) {
  const path = String(pathname ?? '');
  if (phase === 'profile_photo' || phase === 'alias_secret') {
    return path === MY_STORY_PATH;
  }
  if (phase === 'id_verification') {
    return path === SELF_REPORT_BIOGRAPHY_PATH || path === LIVE_FACE_SCAN_POPUP_PATH;
  }
  return true;
}

export function markFirstLoginOnboardingCongratsPending() {
  try {
    sessionStorage.setItem(CONGRATS_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function isFirstLoginOnboardingCongratsPending() {
  try {
    return sessionStorage.getItem(CONGRATS_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

export function consumeFirstLoginOnboardingCongratsPending() {
  try {
    const pending = sessionStorage.getItem(CONGRATS_PENDING_KEY) === '1';
    if (pending) sessionStorage.removeItem(CONGRATS_PENDING_KEY);
    return pending;
  } catch {
    return false;
  }
}
