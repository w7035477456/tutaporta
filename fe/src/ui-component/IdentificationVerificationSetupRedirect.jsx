import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { SELF_REPORT_BIOGRAPHY_PATH } from 'constants/selfReportBiographyRoute';
import { FIRST_LOGIN_AUTO_POPUPS_ENABLED } from 'config/firstLoginAutoPopupsEnv';
import { useAuth } from 'contexts/AuthContext';
import {
  isPathAllowedDuringFirstLoginPhase,
  needsIdentificationVerificationFirstLogin
} from 'utils/firstLoginOnboarding';
import {
  isIdentificationVerificationLockActive,
  markSignupIdentificationVerificationRequired,
  SIGNUP_ID_VERIFICATION_LOCK_CHANGED_EVENT
} from 'utils/signupIdentificationVerification';

/** Keeps members on Self-Report-Bio until Identification Verification (over_18) completes. */
export default function IdentificationVerificationSetupRedirect() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [lockTick, setLockTick] = useState(0);

  useEffect(() => {
    const onLockChanged = () => setLockTick((tick) => tick + 1);
    window.addEventListener(SIGNUP_ID_VERIFICATION_LOCK_CHANGED_EVENT, onLockChanged);
    return () => window.removeEventListener(SIGNUP_ID_VERIFICATION_LOCK_CHANGED_EVENT, onLockChanged);
  }, []);

  useEffect(() => {
    if (!FIRST_LOGIN_AUTO_POPUPS_ENABLED) return;
    if (loading || !user) return;
    if (needsIdentificationVerificationFirstLogin(user)) {
      markSignupIdentificationVerificationRequired();
    }
  }, [loading, user]);

  useEffect(() => {
    if (!FIRST_LOGIN_AUTO_POPUPS_ENABLED) return;
    if (loading) return;
    if (!isIdentificationVerificationLockActive(user)) return;
    if (isPathAllowedDuringFirstLoginPhase(pathname, 'id_verification')) return;
    navigate(SELF_REPORT_BIOGRAPHY_PATH, {
      replace: true,
      state: { openIdentificationVerification: true }
    });
  }, [loading, user, pathname, navigate, lockTick]);

  return null;
}
