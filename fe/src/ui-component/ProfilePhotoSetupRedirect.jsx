import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from 'contexts/AuthContext';
import { isToolsOnlyAdminSession } from 'utils/adminSession';
import { isPathRequiringProfilePhoto, MY_STORY_PATH, needsProfilePhotoSetup } from 'utils/profilePhotoSetup';

/** Sends new members (no profile photo) to My Album & Postings from blocked dating routes. */
export default function ProfilePhotoSetupRedirect() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (isToolsOnlyAdminSession(user)) return;
    if (!needsProfilePhotoSetup(user)) return;
    if (!isPathRequiringProfilePhoto(pathname)) return;
    navigate(MY_STORY_PATH, { replace: true });
  }, [loading, user, pathname, navigate]);

  return null;
}
