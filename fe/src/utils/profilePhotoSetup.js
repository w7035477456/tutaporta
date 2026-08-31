import { isTutaDatesPath, TUTADATES_MY_STORE_PATH } from 'constants/tutaDatesRoute';
import { SELF_REPORT_BIOGRAPHY_PATH } from 'constants/selfReportBiographyRoute';
import { RECEIVED_BIO_REQUESTS_PATH } from 'constants/receivedBioRequestsRoute';
import { PROFILES_RECORDS_PATH } from 'constants/profilesRecordsRoute';
import { isVettedFriendsPath } from 'routes/vettedFriendsPaths';
import { FIRST_LOGIN_AUTO_POPUPS_ENABLED } from 'config/firstLoginAutoPopupsEnv';
import {
  hasProfilePhotoFk,
  isFirstLoginOnboardingExempt,
  needsMyStoryFirstLoginSetup
} from 'utils/firstLoginOnboarding';

export const MY_STORY_PATH = '/myStory';
export const MY_STORE_PATH = TUTADATES_MY_STORE_PATH;
export const PROFILE_PHOTO_MENU_ID = 'myStory';

/** True when the member has not set a profile photo yet (mandatory onboarding). */
export function needsProfilePhotoSetup(user) {
  if (!FIRST_LOGIN_AUTO_POPUPS_ENABLED) return false;
  if (isFirstLoginOnboardingExempt(user)) return false;
  return !hasProfilePhotoFk(user);
}

/** Dating / vetting routes that require a profile photo before access. */
export function isPathRequiringProfilePhoto(pathname) {
  const p = String(pathname ?? '');
  if (p === MY_STORY_PATH || p === MY_STORE_PATH) return false;
  // Self-Report stays reachable only during IDV phase (redirect components decide).
  if (p === SELF_REPORT_BIOGRAPHY_PATH) return false;
  if (isTutaDatesPath(p)) return true;
  if (p === '/allSingles' || p === '/myPicks' || p === '/interestedSingles') return true;
  if (p === RECEIVED_BIO_REQUESTS_PATH || p === PROFILES_RECORDS_PATH) return true;
  if (p === '/request-ive-sent' || p === '/send-flower') return true;
  if (isVettedFriendsPath(p) || p.startsWith('/request-ive-sent/')) return true;
  if (p === '/verifyself') return true;
  if (p.startsWith('/request-')) return true;
  return false;
}

/** True when My Story must finish photo and/or alias+secret before other routes. */
export function needsMyStorySetupRedirect(user) {
  return needsMyStoryFirstLoginSetup(user);
}

/** Disable every sidebar item except My Album & Postings until profile photo is set. */
export function applyProfilePhotoMenuDisabled(menuConfig, needsSetup) {
  if (!menuConfig?.items) return menuConfig;
  if (!needsSetup) {
    return {
      ...menuConfig,
      items: menuConfig.items.map((group) => ({
        ...group,
        children: (group.children ?? []).map((item) => {
          if (!item || item.disabled !== true) return item;
          const { disabled: _disabled, ...enabledItem } = item;
          return enabledItem;
        })
      }))
    };
  }
  return {
    ...menuConfig,
    items: menuConfig.items.map((group) => ({
      ...group,
      children: (group.children ?? []).map((item) => ({
        ...item,
        disabled: item?.id !== PROFILE_PHOTO_MENU_ID && item?.id !== 'util-tools'
      }))
    }))
  };
}
