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
import { ID_INITIALIZATION_REQUIRED_EVENT } from 'utils/idInitializationRequired';

/** Keeps members on Self-Report-Bio until singles.id_initialization_completed is true. */
export default function IdentificationVerificationSetupRedirect() {
  const { user, loading, refreshSessionStatus } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [lockTick, setLockTick] = useState(0);

  useEffect(() => {
    const onLockChanged = () => setLockTick((tick) => tick + 1);
    window.addEventListener(SIGNUP_ID_VERIFICATION_LOCK_CHANGED_EVENT, onLockChanged);
    return () => window.removeEventListener(SIGNUP_ID_VERIFICATION_LOCK_CHANGED_EVENT, onLockChanged);
  }, []);

  useEffect(() => {
    const onRequired = () => void refreshSessionStatus?.({ force: true });
    window.addEventListener(ID_INITIALIZATION_REQUIRED_EVENT, onRequired);
    return () => window.removeEventListener(ID_INITIALIZATION_REQUIRED_EVENT, onRequired);
  }, [refreshSessionStatus]);

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
