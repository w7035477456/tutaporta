import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import {
  consumePendingGoogleOAuthResult,
  GOOGLE_SIGNUP_OAUTH_ACK_TYPE,
  persistGoogleSignupEmail,
  persistGoogleSignupToken,
  clearGoogleSignupToken
} from 'utils/googleSignupOAuth';

/** Popup fallback when Google OAuth loses window.opener — close or navigate away from /api callback. */
export default function GoogleOAuthBridge() {
  const navigate = useNavigate();
  const [showCloseHint, setShowCloseHint] = useState(false);

  useEffect(() => {
    const result = consumePendingGoogleOAuthResult();
    if (result?.email) {
      persistGoogleSignupEmail(result.email);
      if (result.action === 'register' && result.signupToken) {
        persistGoogleSignupToken(result.signupToken);
      } else {
        clearGoogleSignupToken();
      }
    }

    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: GOOGLE_SIGNUP_OAUTH_ACK_TYPE, received: true }, window.location.origin);
        window.opener.focus();
      }
    } catch {
      // ignore
    }

    const isOAuthPopup = window.name === 'googleSignupOAuth';

    const attemptClose = () => {
      try {
        window.close();
      } catch {
        // ignore
      }
    };

    attemptClose();
    const closeInterval = window.setInterval(attemptClose, 250);
    const closeStop = window.setTimeout(() => {
      window.clearInterval(closeInterval);
      if (!window.closed && isOAuthPopup) {
        setShowCloseHint(true);
      }
    }, 1500);

    let navTimer = null;
    if (!isOAuthPopup) {
      navTimer = window.setTimeout(() => {
        if (!window.closed) {
          if (result?.action === 'login') {
            navigate('/main', { replace: true });
          } else if (result?.email) {
            navigate('/register', { state: { email: result.email }, replace: true });
          } else {
            navigate('/pages/login', { replace: true });
          }
        }
      }, 400);
    }

    return () => {
      window.clearInterval(closeInterval);
      window.clearTimeout(closeStop);
      if (navTimer != null) window.clearTimeout(navTimer);
    };
  }, [navigate]);

  return (
    <Box sx={{ p: 3, textAlign: 'center' }}>
      <Typography component="p" variant="body1">
        {showCloseHint ? 'Google sign-in complete. You can close this window.' : 'Completing Google sign-in…'}
      </Typography>
    </Box>
  );
}
