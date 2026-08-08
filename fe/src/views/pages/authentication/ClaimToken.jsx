import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import AuthWrapper1 from './AuthWrapper1';
import AuthCardWrapper from './AuthCardWrapper';
import AuthStandardDialogFrame from './AuthStandardDialogFrame';
import Logo from 'ui-component/Logo';
import Footer from 'layout/MainLayout/Footer';
import SelectedButtonTemplate from 'ui-component/SelectedButtonTemplate';
import {
  authEnvTextFontSize,
  authFixedFooterContentPaddingBottom,
  authShellStackSx
} from './authPageLayoutSx';
import { getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTextFontSizeVw } from 'config/singlesMemberCardFontEnv';
import {
  buildEnterTokenUrlWithReferral,
  buildRegisterUrlWithReferral,
  getClaimTokenReferralFromSearchParams,
  normalizeSignupReferralCode
} from 'utils/signupReferralCode';

export default function ClaimToken() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isEnterTokenPath = location.pathname === '/entertoken';
  const [referrerCode, setReferrerCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fromUrl = getClaimTokenReferralFromSearchParams(searchParams);
    if (fromUrl) {
      setReferrerCode(fromUrl);
    }
  }, [searchParams]);

  const handleSignUp = () => {
    const code = normalizeSignupReferralCode(referrerCode);
    if (!code) {
      setError('Please enter a valid 6-digit referrer code.');
      return;
    }
    setError('');
    navigate(isEnterTokenPath ? buildEnterTokenUrlWithReferral(code) : buildRegisterUrlWithReferral(code));
  };

  const accountLinkSx = {
    textDecoration: 'underline',
    color: 'var(--theme-primary-color)',
    fontSize: { xs: getMobileSinglesTextFontSizeVw(), sm: getDesktopTextFontSizeVw() }
  };

  return (
    <AuthWrapper1>
      <Stack sx={{ ...authShellStackSx, ...authFixedFooterContentPaddingBottom }}>
        <AuthStandardDialogFrame>
          <AuthCardWrapper fullWidth>
            <Stack sx={{ alignItems: 'stretch', justifyContent: 'center', gap: 2, width: '100%' }}>
              <Box sx={{ mb: 1, alignSelf: 'center' }}>
                <Link to="#" aria-label="theme logo">
                  <Logo authBranding />
                </Link>
              </Box>

              <Typography
                sx={{
                  color: 'var(--theme-primary-color)',
                  fontWeight: 600,
                  fontSize: authEnvTextFontSize,
                  textAlign: 'center'
                }}
              >
                Enter Referrer Code here:
              </Typography>

              <TextField
                value={referrerCode}
                onChange={(e) => {
                  setReferrerCode(e.target.value);
                  if (error) setError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSignUp();
                  }
                }}
                fullWidth
                size="small"
                inputMode="numeric"
                autoComplete="off"
                placeholder="123456"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: '#ffffff',
                    '& fieldset': { borderColor: '#000000' },
                    '&:hover fieldset': { borderColor: '#000000' },
                    '&.Mui-focused fieldset': { borderColor: '#000000' }
                  },
                  '& .MuiInputBase-input': {
                    color: '#000000 !important',
                    WebkitTextFillColor: '#000000',
                    fontSize: authEnvTextFontSize
                  }
                }}
              />

              {error ? (
                <Typography variant="body2" color="error" sx={{ textAlign: 'center' }}>
                  {error}
                </Typography>
              ) : null}

              <SelectedButtonTemplate fullWidth fitLabelWidth={false} type="button" onClick={handleSignUp}>
                Sign Up
              </SelectedButtonTemplate>

              <Divider sx={{ width: 1 }} />
              <Stack sx={{ alignItems: 'center' }}>
                <Typography component={Link} to="/pages/login" variant="subtitle1" sx={accountLinkSx}>
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
