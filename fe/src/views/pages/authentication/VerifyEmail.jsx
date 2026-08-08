import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

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
import { verifyRegistrationCode } from 'api/verifyRegistrationCodeFe';
import { buildCreatePasswordQuery, SIGNUP_REGISTER_PHONE_KEY } from 'utils/signupParams';
import { getSignupReferralCodeFromSearchParams } from 'utils/signupReferralCode';

const CODE_ERROR = 'The verification code is invalid or expired. Please try again.';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getSignupReferralCodeFromSearchParams(searchParams);
  }, [searchParams]);

  const handleSignUp = async () => {
    const code = verificationCode.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
    if (code.length !== 6) {
      setError('Please enter the 6-character verification code from your email.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      const data = await verifyRegistrationCode(code);
      if (!data?.valid || !data?.email) {
        setError(CODE_ERROR);
        return;
      }

      if (data.phone && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(SIGNUP_REGISTER_PHONE_KEY, data.phone);
      }

      const referralToken =
        getSignupReferralCodeFromSearchParams(searchParams) || String(data.token ?? data.ref ?? '').trim();

      const qs = buildCreatePasswordQuery({
        email: data.email,
        code,
        phone: data.phone || '',
        token: referralToken
      });
      navigate(`/pages/createPassword?${qs}`);
    } catch {
      setError(CODE_ERROR);
    } finally {
      setIsSubmitting(false);
    }
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
                Enter Verify Email Code here
              </Typography>

              <TextField
                value={verificationCode}
                onChange={(e) => {
                  const next = e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
                  setVerificationCode(next);
                  if (error) setError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSignUp();
                  }
                }}
                fullWidth
                size="small"
                autoComplete="off"
                placeholder="TWXYSC"
                disabled={isSubmitting}
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
                    fontSize: authEnvTextFontSize,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase'
                  }
                }}
              />

              {error ? (
                <Typography variant="body2" color="error" sx={{ textAlign: 'center' }}>
                  {error}
                </Typography>
              ) : null}

              <SelectedButtonTemplate
                fullWidth
                fitLabelWidth={false}
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleSignUp()}
              >
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
