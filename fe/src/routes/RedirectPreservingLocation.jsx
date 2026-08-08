import { Navigate, useLocation, useParams } from 'react-router-dom';
import { vettedFriendsMemberPath, VETTED_FRIENDS_PATH } from './vettedFriendsPaths';

/** Permanent alias redirect (keeps ?query and location.state). */
export default function RedirectPreservingLocation({ to = VETTED_FRIENDS_PATH }) {
  const location = useLocation();
  return <Navigate to={{ pathname: to, search: location.search }} state={location.state} replace />;
}

/** /request-ive-sent/member/:memberId → /vettedFriends/member/:memberId */
export function RedirectLegacyVettedFriendsMember() {
  const { memberId } = useParams();
  const location = useLocation();
  return (
    <Navigate
      to={{ pathname: vettedFriendsMemberPath(memberId), search: location.search }}
      state={location.state}
      replace
    />
  );
}
