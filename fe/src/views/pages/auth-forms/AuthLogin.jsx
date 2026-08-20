import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from 'contexts/AuthContext';
import { useLoginDemoMode } from 'contexts/LoginDemoModeContext';
import { ADMIN_TOOLS_PATH } from 'constants/adminToolsRoute';
import { DEMO_LOGIN_PASSWORD_HINT, guestDemoAllowProps, isDemoLoginAliasId } from 'utils/guestDemoLogin';

// material-ui
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project imports
import api from 'api/axios';
import GreenButton from 'ui-component/GreenButton';
import ColorTemplate16InputTemplate from 'ui-component/ColorTemplate16InputTemplate';
import { getDesktopIconSizeVw, getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import { authFormContentSx } from '../authentication/authPageLayoutSx';
import enterEmailImg from 'assets/images/enterEmail.png';
import enterPasswordImg from 'assets/images/enterPassword.png';

// assets
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

// ===============================|| JWT - LOGIN ||=============================== //

const MOBILE_LOGIN_NOTICE =
  'We are smoothing final fixes to Mobile UI for Android and Iphone, so this application will be availble soon.  Mean while, please use dekstop browser for this website at URL https://OnlineMall.Website. Thank you for your patient';

/** Avoid a bare max-height rule: mobile browsers change the layout viewport when the URL bar hides,
 *  which can flip (max-height: 667px) off and re-enable Sign In after the dialog closes.
 *  - Portrait phones: max-width 600px (stable width).
 *  - Landscape phones: short viewports that are still "phone-wide", not a shrink-tall desktop window. */
const COMPACT_LOGIN_MEDIA = '(max-width: 600px), ((max-width: 926px) and (max-height: 540px))';

function compactLoginMatches() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return Boolean(window.matchMedia(COMPACT_LOGIN_MEDIA).matches);
}

function useCompactLoginViewport() {
  const [compact, setCompact] = useState(() => compactLoginMatches());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(COMPACT_LOGIN_MEDIA);
    const sync = () => setCompact(Boolean(mq.matches));
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return compact;
}

const fieldWithRightImageRowSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: { xs: 0.5, sm: 0.75 },
  width: '100%',
  minWidth: 0
};

/** Input grows with modal width; graphic stays fixed-size at the content’s right edge. */
const fieldWithRightImageInputColSx = {
  flex: '1 1 0%',
  minWidth: 0,
  width: '100%'
};

/** fe/.env DESKTOP_ICON_SIZE — enter email / enter password graphics beside fields */
const fieldWithRightImagePicSx = {
  flex: '0 0 auto',
  flexShrink: 0,
  width: getDesktopIconSizeVw(),
  height: getDesktopIconSizeVw(),
  objectFit: 'contain',
  alignSelf: 'center'
};

/** fe/.env DESKTOP_ICON_SIZE — password visibility toggle */
const loginVisibilityIconButtonSx = {
  '& .MuiSvgIcon-root': {
    width: getDesktopIconSizeVw(),
    height: getDesktopIconSizeVw(),
    fontSize: getDesktopIconSizeVw()
  }
};

const loginErrorPrimarySx = {
  fontSize: { xs: '0.9rem', sm: getDesktopTextFontSizeVw() },
  fontWeight: 700,
  color: '#b71c1c !important',
  WebkitTextFillColor: '#b71c1c !important',
  bgcolor: '#ffcdd2',
  border: '2px solid #000',
  borderRadius: 1,
  px: 2,
  py: 1,
  width: '100%',
  textAlign: 'center'
};

const loginErrorSecondarySx = {
  fontSize: { xs: '0.9rem', sm: getDesktopTextFontSizeVw() },
  fontWeight: 600,
  color: '#b71c1c !important',
  WebkitTextFillColor: '#b71c1c !important',
  width: '100%',
  textAlign: 'center'
};

export default function AuthLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { setLoginCredentials, blockDemoAction } = useLoginDemoMode();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorSecondary, setErrorSecondary] = useState('');
  const [maxAttemptsReached, setMaxAttemptsReached] = useState(false);
  const [mobileNoticeDismissed, setMobileNoticeDismissed] = useState(false);
  const [blockMobile, setBlockMobile] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const isMobileViewport = useCompactLoginViewport();
  const mobileLoginBlocked = blockMobile && isMobileViewport;
  const isDemoAliasLogin = isDemoLoginAliasId(email);
  const passwordVisible = showPassword || isDemoAliasLogin;
  const isFormValid = email.trim().length > 0 && (isDemoAliasLogin || password.trim().length > 0);
  const signInDisabled = mobileLoginBlocked || isLoading || !isFormValid || maxAttemptsReached;

  useEffect(() => {
    setLoginCredentials(email, password);
  }, [email, password, setLoginCredentials]);

  useEffect(() => {
    const stateEmail = location.state?.email;
    const statePassword = location.state?.password;
    if (stateEmail && typeof stateEmail === 'string') {
      setEmail(stateEmail.trim());
    }
    if (statePassword && typeof statePassword === 'string') {
      setPassword(statePassword);
    }
  }, [location.state]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await api.get('/api/publicConfig');
        if (!cancelled && typeof data?.blockMobile === 'boolean') {
          setBlockMobile(data.blockMobile);
        }
      } catch {
        // keep default (block mobile)
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mobileLoginBlocked) setMobileNoticeDismissed(false);
  }, [mobileLoginBlocked]);

  const dismissMobileNotice = useCallback(() => setMobileNoticeDismissed(true), []);

  const handleEmailChange = (event) => {
    const next = event.target.value;
    const nextIsDemo = isDemoLoginAliasId(next);
    const prevIsDemo = isDemoLoginAliasId(email);
    setEmail(next);
    if (nextIsDemo && !prevIsDemo) {
      setShowPassword(true);
      setPassword(DEMO_LOGIN_PASSWORD_HINT);
      return;
    }
    if (!nextIsDemo && prevIsDemo) {
      setShowPassword(false);
      setPassword((prev) => (prev === DEMO_LOGIN_PASSWORD_HINT ? '' : prev));
    }
  };

  const handleClickShowPassword = (event) => {
    if (blockDemoAction(event)) return;
    if (isDemoAliasLogin) return;
    setShowPassword(!showPassword);
  };

  const handleMouseDownPassword = (event) => {
    event.preventDefault();
  };

  /** Ensures Enter submits the form from email/password fields (native submit can be unreliable with MUI + disabled submit). */
  const handleCredentialKeyDown = (event) => {
    if (event.key !== 'Enter' || event.nativeEvent?.isComposing) return;
    if (signInDisabled) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  const completeLoginNavigation = useCallback(
    (response) => {
      if (response?.success) {
        if (response.tools_only || response.user?.tools_only) {
          navigate(ADMIN_TOOLS_PATH);
          return;
        }
        const from = location.state?.from;
        if (from?.pathname) {
          navigate(
            { pathname: from.pathname, search: from.search || '', hash: from.hash || '' },
            { replace: true }
          );
          return;
        }
        navigate('/mall');
      }
    },
    [navigate, location.state]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (signInDisabled) return;
    setIsLoading(true);
    setError('');
    setErrorSecondary('');
    setMaxAttemptsReached(false);

    try {
      const response = await login(email, password, false);
      completeLoginNavigation(response);
    } catch (err) {
      const responseData = err?.response?.data;
      if (responseData?.maxAttemptsReached) {
        setMaxAttemptsReached(true);
        setError(
          responseData?.error || 'Maximum attempts reached. Only 3 attempts per 24 hour period allowed.'
        );
        setErrorSecondary('');
      } else if (responseData?.errorPrimary) {
        setError(responseData.errorPrimary);
        setErrorSecondary(responseData.errorSecondary || '');
      } else {
        const message = responseData?.error || err?.message || 'Login or Password fail';
        navigate('/pages/loginFailure', { state: { message } });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signInButton = (
    <GreenButton type="submit" disabled={signInDisabled} {...guestDemoAllowProps()}>
      {isLoading ? 'Signing in...' : 'Sign In'}
    </GreenButton>
  );

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%', ...authFormContentSx }}>
      <Dialog
        open={mobileLoginBlocked && !mobileNoticeDismissed}
        onClose={dismissMobileNotice}
        aria-labelledby="mobile-login-notice-title"
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle id="mobile-login-notice-title">Please use a desktop browser</DialogTitle>
        <DialogContent>
          <Typography component="p" variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
            {MOBILE_LOGIN_NOTICE}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={dismissMobileNotice} variant="contained" color="primary" autoFocus>
            OK
          </Button>
        </DialogActions>
      </Dialog>
      <Box sx={{ ...fieldWithRightImageRowSx, mb: 2 }}>
        <Box sx={fieldWithRightImageInputColSx}>
          <ColorTemplate16InputTemplate
            id="outlined-adornment-email-login"
            label="Email or Phone"
            type="text"
            value={email}
            onChange={handleEmailChange}
            name="email"
            autoComplete="username"
            required
            inputProps={{ onKeyDown: handleCredentialKeyDown }}
          />
        </Box>
        <Box
          component="img"
          src={enterEmailImg}
          alt=""
          onClick={(event) => {
            blockDemoAction(event);
          }}
          sx={{ ...fieldWithRightImagePicSx, cursor: 'default' }}
        />
      </Box>

      <Box sx={fieldWithRightImageRowSx}>
        <Box sx={fieldWithRightImageInputColSx}>
          <ColorTemplate16InputTemplate
            id="outlined-adornment-password-login"
            label="Password"
            type={passwordVisible ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            name="password"
            required={!isDemoAliasLogin}
            inputProps={{ onKeyDown: handleCredentialKeyDown }}
            endAdornment={
              <InputAdornment position="end">
                <IconButton
                  aria-label="toggle password visibility"
                  onClick={handleClickShowPassword}
                  onMouseDown={handleMouseDownPassword}
                  edge="end"
                  sx={loginVisibilityIconButtonSx}
                >
                  {passwordVisible ? <Visibility /> : <VisibilityOff />}
                </IconButton>
              </InputAdornment>
            }
          />
        </Box>
        <Box
          component="img"
          src={enterPasswordImg}
          alt=""
          onClick={(event) => {
            blockDemoAction(event);
          }}
          sx={{ ...fieldWithRightImagePicSx, cursor: 'default' }}
        />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
        <Typography
          variant="subtitle1"
          component={Link}
          to="/pages/forgotPassword"
          {...guestDemoAllowProps()}
          sx={{ textDecoration: 'underline', color: 'var(--theme-primary-color)' }}
        >
          Forgot Password?
        </Typography>
      </Box>
      {error ? (
        <Typography component="div" sx={{ ...loginErrorPrimarySx, mt: 2 }}>
          {error}
        </Typography>
      ) : null}
      {errorSecondary ? (
        <Typography component="div" sx={{ ...loginErrorSecondarySx, mt: error ? 1 : 2 }}>
          {errorSecondary}
        </Typography>
      ) : null}
      {!maxAttemptsReached ? (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', width: 1 }}>{signInButton}</Box>
      ) : null}
    </Box>
  );
}
