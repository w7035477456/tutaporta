import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSpecialLoginPrefill } from 'config/specialLoginEnv';
import { markSecretLoginDemoVolume } from 'utils/secretLoginDemoVolume';

/**
 * SPECIAL_LINK from ~/.ssh/be/.env opens the normal login page with prefilled credentials.
 * Does not auto-login or bypass password checks.
 */
export default function LoginBypass() {
  const navigate = useNavigate();
  const { email, password } = getSpecialLoginPrefill();

  useEffect(() => {
    markSecretLoginDemoVolume();
    navigate('/pages/login', {
      replace: true,
      state: {
        ...(email ? { email } : {}),
        ...(password ? { password } : {})
      }
    });
  }, [navigate, email, password]);

  return null;
}
