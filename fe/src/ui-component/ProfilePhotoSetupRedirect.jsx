import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { FIRST_LOGIN_AUTO_POPUPS_ENABLED } from 'config/firstLoginAutoPopupsEnv';
import { useAuth } from 'contexts/AuthContext';
import {
  getFirstLoginOnboardingPhase,
  isPathAllowedDuringFirstLoginPhase,
  needsMyStoryFirstLoginSetup
} from 'utils/firstLoginOnboarding';
import { isPathRequiringProfilePhoto, MY_STORY_PATH } from 'utils/profilePhotoSetup';
import { isIdentificationVerificationLockActive } from 'utils/signupIdentificationVerification';

/**
 * Dating-only first-login gate: photo / nickname / secret icon are required when entering
 * TutaDates routes — not when opening TutaNotes or TutaPhotos from the mall.
 */
export default function ProfilePhotoSetupRedirect() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!FIRST_LOGIN_AUTO_POPUPS_ENABLED) return;
    if (loading) return;
    // Do not fight mandatory IDV redirect.
    if (isIdentificationVerificationLockActive(user)) return;
    if (!needsMyStoryFirstLoginSetup(user)) return;
    const phase = getFirstLoginOnboardingPhase(user);
    if (isPathAllowedDuringFirstLoginPhase(pathname, phase)) return;
    // Only yank to MyStory when the user opens a dating path (e.g. TutaDates tile).
    if (!isPathRequiringProfilePhoto(pathname)) return;
    navigate(MY_STORY_PATH, { replace: true });
  }, [loading, user, pathname, navigate]);

  return null;
}
