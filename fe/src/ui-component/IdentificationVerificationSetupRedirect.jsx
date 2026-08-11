import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { SELF_REPORT_BIOGRAPHY_PATH } from 'constants/selfReportBiographyRoute';
import { useAuth } from 'contexts/AuthContext';
import { isImpersonationSession, isToolsOnlyAdminSession } from 'utils/adminSession';
import {
  isIdentificationVerificationLockActive,
  isPathAllowedDuringIdentificationVerificationLock,
  SIGNUP_ID_VERIFICATION_LOCK_CHANGED_EVENT
} from 'utils/signupIdentificationVerification';

/** Keeps new members on Self-Report-Bio until Identification Verification completes. */
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
    if (loading) return;
    if (isToolsOnlyAdminSession(user) || isImpersonationSession(user)) return;
    if (!isIdentificationVerificationLockActive(user)) return;
    if (isPathAllowedDuringIdentificationVerificationLock(pathname)) return;
    navigate(SELF_REPORT_BIOGRAPHY_PATH, {
      replace: true,
      state: { openIdentificationVerification: true }
    });
  }, [loading, user, pathname, navigate, lockTick]);

  return null;
}
