/**
 * Per-menu-page Video Tutorials YouTube URLs.
 * Mirrored from ~/.ssh/be/.env at Vite startup (see fe/vite.config.mjs).
 */

export const PAGE_VIDEO_TUTORIAL_KEYS = {
  topRight: 'TOPRIGHT_VIDEO_TUTORIAL',
  allSingles: 'ALL_SINGLES_VIDEO_TUTORIAL',
  picksPosts: 'PICKS_POSTS_VIDEO_TUTORIAL',
  acquaintBuddies: 'ACQUAINTS_BUDDIES_VIDEO_TUTORIAL',
  myAlbum: 'MYALBUM_VIDEO_TUTORIAL',
  mySelfReportBio: 'MYSELFREPORTBIO_VIDEO_TUTORIAL',
  receivedBioRequest: 'RECEIVED_BIO_REQUEST_VIDEO_TUTORIAL',
  profileRecords: 'PROFILE_RECORDS_VIDEO_TUTORIAL'
};

/** Sticky-note alias used in some docs / older env copies. */
const ACQUAINT_BUDDIES_ALIAS_KEY = 'ACQUAINT_BUDDIES_VIDEO_TUTORIAL';

function readEnvUrl(envKey) {
  const raw = import.meta.env?.[envKey];
  const url = String(raw ?? '').trim();
  return url || '';
}

/**
 * @param {keyof typeof PAGE_VIDEO_TUTORIAL_KEYS | string} pageKey
 * @returns {string} Absolute YouTube (or other) URL, or '' when unset.
 */
export function getPageVideoTutorialUrl(pageKey) {
  const envKey = PAGE_VIDEO_TUTORIAL_KEYS[pageKey];
  if (!envKey) return '';
  const primary = readEnvUrl(envKey);
  if (primary) return primary;
  if (pageKey === 'acquaintBuddies') {
    return readEnvUrl(ACQUAINT_BUDDIES_ALIAS_KEY);
  }
  return '';
}
