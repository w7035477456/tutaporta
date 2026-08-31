import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router-dom';

import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project imports
import AuthWrapper1 from './AuthWrapper1';
import AuthCardWrapper from './AuthCardWrapper';
import AuthStandardDialogFrame from './AuthStandardDialogFrame';

import Logo from 'ui-component/Logo';
import Footer from 'layout/MainLayout/Footer';
import AuthLogin from '../auth-forms/AuthLogin';
import SessionEndNoticeDialog from 'ui-component/SessionEndNoticeDialog';
import { LoginDemoModeProvider } from 'contexts/LoginDemoModeContext';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';
import { consumeSessionEndNotice } from 'utils/sessionEndNotice';
import {
  authEnvTextFontSize,
  authShellStackSx,
  authFixedFooterContentPaddingBottom
} from './authPageLayoutSx';
import { getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTextFontSizeVw } from 'config/singlesMemberCardFontEnv';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import useConfig from 'hooks/useConfig';
import { MAIN_FONT_FAMILY, resetMainFontToEnvDefault } from 'config/mainFontEnv';

// ================================|| AUTH3 - LOGIN ||================================ //

function LoginSignupPrompt({ signupEnabled, signupPromptSx }) {
  if (signupEnabled) {
    return (
      <Typography
        component={Link}
        to="/register"
        variant="subtitle1"
        {...guestDemoAllowProps()}
        sx={signupPromptSx}
      >
        Don&apos;t have an account?
      </Typography>
    );
  }

  return (
    <Typography
      variant="subtitle1"
      aria-disabled="true"
      sx={{ ...signupPromptSx, cursor: 'default', userSelect: 'none' }}
    >
      Don&apos;t have an account?
    </Typography>
  );
}

LoginSignupPrompt.propTypes = {
  signupEnabled: PropTypes.bool,
  signupPromptSx: PropTypes.object
};

function Login() {
  const navigate = useNavigate();
  const { setField } = useConfig();
  const defaultSignupEnabled = ['true', '1', 'yes', 'on'].includes(
    String(import.meta.env.NEW_ACCOUNT_SIGNUP ?? import.meta.env.VITE_NEW_ACCOUNT_SIGNUP ?? '')
      .trim()
      .toLowerCase()
  );
  const [signupEnabled, setSignupEnabled] = useState(defaultSignupEnabled);
  const [idleLogoutNotice, setIdleLogoutNotice] = useState(null);

  useEffect(() => {
    const message = consumeSessionEndNotice();
    if (message) setIdleLogoutNotice(message);
  }, []);

  // MAIN_FONT (Algerian) until login loads user_customization.main_font.
  useEffect(() => {
    const stack = resetMainFontToEnvDefault();
    setField('fontFamily', stack);
  }, [setField]);

  useEffect(() => {
    if (sessionStorage.getItem('logoutBlockBack') !== '1') return;
    const handlePopState = () => {
      navigate('/pages/login', { replace: true });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${getApiBaseUrl()}/api/publicConfig`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data || typeof data.newAccountSignup !== 'boolean') return;
        setSignupEnabled(data.newAccountSignup);
      })
      .catch(() => {
        // Keep env-derived default on failures.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signupPromptSx = {
    textDecoration: 'underline',
    color: 'var(--theme-primary-color)',
    fontSize: { xs: getMobileSinglesTextFontSizeVw(), sm: getDesktopTextFontSizeVw() }
  };

  return (
    <LoginDemoModeProvider>
      <AuthWrapper1>
        <SessionEndNoticeDialog
          open={Boolean(idleLogoutNotice)}
          message={idleLogoutNotice || ''}
          onClose={() => setIdleLogoutNotice(null)}
        />
        <Stack sx={{ ...authShellStackSx, ...authFixedFooterContentPaddingBottom, boxSizing: 'border-box' }}>
          <AuthStandardDialogFrame>
            <AuthCardWrapper fullWidth>
              <Stack sx={{ alignItems: 'stretch', justifyContent: 'center', gap: 2, width: '100%' }}>
                <Box sx={{ mb: 1, alignSelf: 'center' }}>
                  <Link to="#" aria-label="logo">
                    <Logo authBranding />
                  </Link>
                </Box>
                <Typography
                  component="h1"
                  variant="h5"
                  sx={(theme) => ({
                    textAlign: 'center',
                    fontWeight: 700,
                    fontFamily: MAIN_FONT_FAMILY,
                    color: 'var(--theme-primary-color)',
                    lineHeight: 1.2,
                    maxWidth: '100%',
                    wordBreak: 'break-word',
                    fontSize: `calc(${theme.typography.h5.fontSize} * 2)`
                  })}
                >
                  <Box component="span" sx={{ display: 'block' }}>
                    Login TutaMall.com
                  </Box>
                  <Box component="span" sx={{ display: 'block', fontSize: '0.5em' }}>
                    (formerly OnlineMall.website)
                  </Box>
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ fontSize: '16px', textAlign: 'center', color: 'var(--theme-primary-color)' }}
                >
                  Enter your credentials to continue
                </Typography>
                <Box sx={{ width: 1, alignSelf: 'stretch', minWidth: 0 }}>
                  <AuthLogin />
                </Box>
                <Divider sx={{ width: 1 }} />
                <Stack sx={{ alignItems: 'center' }}>
                  <LoginSignupPrompt signupEnabled={signupEnabled} signupPromptSx={signupPromptSx} />
                </Stack>
                <Typography
                  sx={{
                    fontSize: authEnvTextFontSize,
                    textAlign: 'center',
                    color: 'var(--theme-primary-color)',
                    lineHeight: 1.4
                  }}
                >
                  You must be 18 or older to use this website. First-time logins will require a driver&apos;s license upload
                  for age verification.
                </Typography>
              </Stack>
            </AuthCardWrapper>
          </AuthStandardDialogFrame>
          <Footer />
        </Stack>
      </AuthWrapper1>
    </LoginDemoModeProvider>
  );
}

export default Login;
