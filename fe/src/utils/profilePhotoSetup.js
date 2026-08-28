import { isTutaDatesPath, TUTADATES_MY_STORE_PATH } from 'constants/tutaDatesRoute';
import { SELF_REPORT_BIOGRAPHY_PATH } from 'constants/selfReportBiographyRoute';
import { RECEIVED_BIO_REQUESTS_PATH } from 'constants/receivedBioRequestsRoute';
import { PROFILES_RECORDS_PATH } from 'constants/profilesRecordsRoute';
import { isVettedFriendsPath } from 'routes/vettedFriendsPaths';
import { isImpersonationSession, isToolsOnlyAdminSession } from 'utils/adminSession';
import { isInitialSetupBypassMemberCategory } from 'utils/memberCategory';

export const MY_STORY_PATH = '/myStory';
export const MY_STORE_PATH = TUTADATES_MY_STORE_PATH;
export const PROFILE_PHOTO_MENU_ID = 'myStory';

/** True when the member has not set a profile photo yet. */
export function needsProfilePhotoSetup(user) {
  if (isToolsOnlyAdminSession(user) || isImpersonationSession(user)) return false;
  // DemoUser / RegularMember: never lock the sidebar behind profile photo.
  if (isInitialSetupBypassMemberCategory(user?.member_category)) return false;
  const id = Number(user?.profile_image_fk);
  return !Number.isFinite(id) || id < 1;
}

/** Dating / vetting routes that require a profile photo before access. */
export function isPathRequiringProfilePhoto(pathname) {
  const p = String(pathname ?? '');
  if (p === MY_STORY_PATH || p === MY_STORE_PATH) return false;
  // Self-Report must stay reachable during mandatory IDV (no photo ↔ IDV redirect fight).
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
        disabled:
          item?.id !== PROFILE_PHOTO_MENU_ID && item?.id !== 'util-tools'
      }))
    }))
  };
}
