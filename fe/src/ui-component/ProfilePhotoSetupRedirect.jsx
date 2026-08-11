import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from 'contexts/AuthContext';
import { isImpersonationSession, isToolsOnlyAdminSession } from 'utils/adminSession';
import { isPathRequiringProfilePhoto, MY_STORY_PATH, needsProfilePhotoSetup } from 'utils/profilePhotoSetup';
import { isIdentificationVerificationLockActive } from 'utils/signupIdentificationVerification';

/** Sends new members (no profile photo) to My Album & Postings from blocked dating routes. */
export default function ProfilePhotoSetupRedirect() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (isToolsOnlyAdminSession(user) || isImpersonationSession(user)) return;
    // Do not fight mandatory IDV redirect (Self-Report ↔ My Story loop).
    if (isIdentificationVerificationLockActive(user)) return;
    if (!needsProfilePhotoSetup(user)) return;
    if (!isPathRequiringProfilePhoto(pathname)) return;
    navigate(MY_STORY_PATH, { replace: true });
  }, [loading, user, pathname, navigate]);

  return null;
}
