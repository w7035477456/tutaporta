import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

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
import AuthRegister from '../auth-forms/AuthRegister';
import {
  authEnvTextFontSize,
  authEnvTitleFontSize,
  authFixedFooterContentPaddingBottom,
  authShellStackSx
} from './authPageLayoutSx';
import { validateReferralCode } from 'api/validateReferralCodeFe';
import {
  getSignupReferralCodeFromSearchParams,
  normalizeSignupReferralCode,
  formatValidReferralMessage
} from 'utils/signupReferralCode';

const REGISTER_CACHE_BUST_KEY = 'registerCacheBusted';

const REFERRAL_MSG = {
  invalid:
    'The referral code provided is invalid. Please note that no credit will be applied if you continue. Please verify that the registration link or code is correct.',
  absent: 'Registration without referer code. Ok to proceed'
};

export default function Register() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [referralStatus, setReferralStatus] = useState('loading');
  const [referrerAlias, setReferrerAlias] = useState('');
  const [referrerMemberCode, setReferrerMemberCode] = useState('');

  // One-time cache-busting reload when opening email registration so browser uses fresh code
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasBusted = sessionStorage.getItem(REGISTER_CACHE_BUST_KEY);
    const hasBustParam = new URLSearchParams(location.search).has('_cb');
    if (!hasBusted && !hasBustParam) {
      sessionStorage.setItem(REGISTER_CACHE_BUST_KEY, '1');
      const params = new URLSearchParams(location.search);
      params.set('_cb', String(Date.now()));
      window.location.replace(`${location.pathname}?${params.toString()}`);
      return;
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    const urlRef = normalizeSignupReferralCode(searchParams.get('ref') ?? searchParams.get('token'));
    if (urlRef) {
      getSignupReferralCodeFromSearchParams(searchParams);
    }

    if (!urlRef) {
      setReferralStatus('absent');
      setReferrerAlias('');
      setReferrerMemberCode('');
      return;
    }

    let cancelled = false;
    setReferralStatus('loading');
    setReferrerAlias('');
    setReferrerMemberCode('');

    validateReferralCode(urlRef)
      .then((data) => {
        if (cancelled) return;
        setReferralStatus(data?.valid ? 'valid' : 'invalid');
        setReferrerAlias(data?.referrerAlias ?? '');
        setReferrerMemberCode(data?.referrerMemberCode ?? '');
      })
      .catch(() => {
        if (cancelled) return;
        setReferralStatus('invalid');
        setReferrerAlias('');
        setReferrerMemberCode('');
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const referralMessage =
    referralStatus === 'valid'
      ? formatValidReferralMessage(referrerAlias, referrerMemberCode)
      : referralStatus === 'invalid'
        ? REFERRAL_MSG.invalid
        : referralStatus === 'absent'
          ? REFERRAL_MSG.absent
          : null;

  const referralMessageColor =
    referralStatus === 'valid'
      ? 'var(--theme-success-color, #2e7d32)'
      : referralStatus === 'invalid'
        ? 'var(--theme-error-color, #d32f2f)'
        : 'var(--theme-primary-color)';

  return (
    <AuthWrapper1>
      <Stack sx={{ ...authShellStackSx, ...authFixedFooterContentPaddingBottom }}>
        <AuthStandardDialogFrame>
          <AuthCardWrapper fullWidth>
            <Stack sx={{ alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <Box sx={{ mb: 3 }}>
                <Link to="#" aria-label="theme logo">
                  <Logo authBranding />
                </Link>
              </Box>
              {referralMessage ? (
                <Typography
                  role="status"
                  sx={{
                    width: '100%',
                    px: 1,
                    textAlign: 'center',
                    fontSize: authEnvTextFontSize,
                    fontWeight: 600,
                    lineHeight: 1.4,
                    color: referralMessageColor
                  }}
                >
                  {referralMessage}
                </Typography>
              ) : null}
              <Stack sx={{ alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <Typography
                  component="h1"
                  gutterBottom
                  sx={{ color: 'var(--theme-primary-color)', mb: 0, fontWeight: 700, fontSize: authEnvTitleFontSize }}
                >
                  Sign up
                </Typography>
                <Typography
                  sx={{
                    fontSize: authEnvTextFontSize,
                    textAlign: { xs: 'center', md: 'inherit' },
                    color: 'var(--theme-primary-color)'
                  }}
                >
                  Please enter your email address to continue
                </Typography>
              </Stack>
              <Box>
                <AuthRegister />
              </Box>
              <Divider sx={{ width: 1 }} />
              <Stack sx={{ alignItems: 'center' }}>
                <Typography
                  component={Link}
                  to="/pages/login"
                  sx={{
                    fontSize: authEnvTextFontSize,
                    textDecoration: 'underline',
                    color: 'var(--theme-primary-color)',
                    fontWeight: 600,
                    '&:hover': { textDecoration: 'underline', opacity: 0.85 }
                  }}
                >
                  Already have an account?
                </Typography>
              </Stack>
            </Stack>
          </AuthCardWrapper>
        </AuthStandardDialogFrame>
        <Footer />
      </Stack>
    </AuthWrapper1>
  );
}
