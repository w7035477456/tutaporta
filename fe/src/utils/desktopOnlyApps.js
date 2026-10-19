import { isTutaDatesPath } from 'constants/tutaDatesRoute';
import {
  MY_PHOTO_ALBUMS_LEGACY_PATH,
  MY_PHOTO_ALBUMS_OLD_PATH,
  MY_PHOTO_ALBUMS_PATH
} from 'constants/myPhotoAlbumsRoute';
import { MY_RECORD_VAULT_LEGACY_PATH, MY_RECORD_VAULT_PATH } from 'constants/myRecordVaultRoute';
import { isIdInitializationIncomplete } from 'utils/firstLoginOnboarding';

/** window event — open the desktop-only notice for TutaDates / TutaNotes / TutaPhoto. */
export const DESKTOP_ONLY_APPS_EVENT = 'desktop-only-apps-notice';

const MY_STORY_PATH = '/myStory';

const TUTADATES_EXTRA_PREFIXES = ['/allSingles', '/myPicks', '/interestedSingles', '/speedDating'];

function pathMatches(pathname, prefixes) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * App name when this URL is one of the three desktop-only products.
 * /myStory stays available while ID initialization is still unfinished.
 * @returns {'TutaDates' | 'TutaNotes' | 'TutaPhoto' | null}
 */
export function desktopOnlyAppForPath(pathname, user) {
  const path = String(pathname ?? '').replace(/\/+$/, '') || '/';
  if (path === MY_STORY_PATH || path.startsWith(`${MY_STORY_PATH}/`)) {
    if (isIdInitializationIncomplete(user)) return null;
    return 'TutaDates';
  }
  if (isTutaDatesPath(path) || pathMatches(path, TUTADATES_EXTRA_PREFIXES)) return 'TutaDates';
  if (pathMatches(path, [MY_RECORD_VAULT_PATH, MY_RECORD_VAULT_LEGACY_PATH])) return 'TutaNotes';
  if (pathMatches(path, [MY_PHOTO_ALBUMS_PATH, MY_PHOTO_ALBUMS_LEGACY_PATH, MY_PHOTO_ALBUMS_OLD_PATH])) {
    return 'TutaPhoto';
  }
  return null;
}

let lastNoticeAt = 0;

/** Ask the mounted dialog to explain that this app needs a desktop screen. */
export function requestDesktopOnlyAppsNotice(appName) {
  const now = Date.now();
  if (now - lastNoticeAt < 800) return;
  lastNoticeAt = now;
  if (typeof window === 'undefined') return;
  const name = String(appName || '').trim();
  try {
    window.dispatchEvent(new CustomEvent(DESKTOP_ONLY_APPS_EVENT, { detail: { appName: name } }));
  } catch {
    // ignore
  }
}
