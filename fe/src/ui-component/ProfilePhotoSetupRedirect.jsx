import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { FIRST_LOGIN_AUTO_POPUPS_ENABLED } from 'config/firstLoginAutoPopupsEnv';
import { useAuth } from 'contexts/AuthContext';
import {
  getFirstLoginOnboardingPhase,
  isPathAllowedDuringFirstLoginPhase,
  needsMyStoryFirstLoginSetup
} from 'utils/firstLoginOnboarding';
import { MY_STORY_PATH } from 'utils/profilePhotoSetup';
import { isIdentificationVerificationLockActive } from 'utils/signupIdentificationVerification';

/** Sends members who still need photo / alias / secret to My Album & Postings. */
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
    navigate(MY_STORY_PATH, { replace: true });
  }, [loading, user, pathname, navigate]);

  return null;
}
