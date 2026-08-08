import { useLocation } from 'react-router-dom';
import { isVettedFriendsPath } from 'routes/vettedFriendsPaths';

/** Bell + badge live next to Refresh Post(s) / Refresh Chats instead of the header. */
export function isInlineNotificationBellPath(pathname) {
  return pathname === '/myPicks' || isVettedFriendsPath(pathname);
}

export default function useInlineNotificationBell() {
  const { pathname } = useLocation();
  return isInlineNotificationBellPath(pathname);
}
