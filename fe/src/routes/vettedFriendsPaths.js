/** Canonical route for Vetted Friends (sidebar + bell chat navigation). */
export const VETTED_FRIENDS_PATH = '/vettedFriends';

export function vettedFriendsMemberPath(memberId) {
  const id = Number(memberId);
  if (!Number.isFinite(id) || id < 1) return VETTED_FRIENDS_PATH;
  return `${VETTED_FRIENDS_PATH}/member/${Math.trunc(id)}`;
}

export function isVettedFriendsPath(pathname) {
  return pathname === VETTED_FRIENDS_PATH || pathname.startsWith(`${VETTED_FRIENDS_PATH}/`);
}
