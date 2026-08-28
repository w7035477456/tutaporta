/** Canonical route for Acquaint. & Buddies (sidebar + bell chat navigation). */
export const VETTED_FRIENDS_PATH = '/acquaintNBuddies';

/** Legacy URL — redirect to {@link VETTED_FRIENDS_PATH}. */
export const LEGACY_VETTED_FRIENDS_PATH = '/vettedFriends';

export function vettedFriendsMemberPath(memberId) {
  const id = Number(memberId);
  if (!Number.isFinite(id) || id < 1) return VETTED_FRIENDS_PATH;
  return `${VETTED_FRIENDS_PATH}/member/${Math.trunc(id)}`;
}

export function isVettedFriendsPath(pathname) {
  const path = String(pathname ?? '');
  return (
    path === VETTED_FRIENDS_PATH ||
    path.startsWith(`${VETTED_FRIENDS_PATH}/`) ||
    path === LEGACY_VETTED_FRIENDS_PATH ||
    path.startsWith(`${LEGACY_VETTED_FRIENDS_PATH}/`)
  );
}
