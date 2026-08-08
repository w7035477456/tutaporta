import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';

import useMediaQuery from '@mui/material/useMediaQuery';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';

// project imports
import AuthWrapper1 from './AuthWrapper1';
import AuthCardWrapper from './AuthCardWrapper';
import AuthStandardDialogFrame from './AuthStandardDialogFrame';

import Logo from 'ui-component/Logo';
import AuthFooter from 'ui-component/cards/AuthFooter';
import AnimateButton from 'ui-component/extended/AnimateButton';
import { authShellStackSx, authFixedFooterContentPaddingBottom, authButtonBoldSx } from './authPageLayoutSx';
import { cleanupVerificationsByEmail } from 'api/verifyPhoneFe';

// ================================|| AUTH - PHONE VERIFICATION SUCCESS ||================================ //

export default function PhoneVerificationSuccess() {
  const downMD = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';

  useEffect(() => {
    if (!email) return;
    cleanupVerificationsByEmail(email).catch((error) => {
      console.error('Failed to cleanup verifications on success page:', error);
    });
  }, [email]);

  const handleGoToLogin = () => {
    navigate('/pages/login', { state: { email } });
  };

  return (
    <AuthWrapper1>
      <Stack sx={{ ...authShellStackSx, ...authFixedFooterContentPaddingBottom }}>
        <AuthStandardDialogFrame>
          <AuthCardWrapper fullWidth>
            <Stack sx={{ alignItems: 'center', justifyContent: 'center', gap: 3 }}>
              <Box sx={{ mb: 3 }}>
                <Link to="#" aria-label="logo">
                  <Logo authBranding />
                </Link>
              </Box>
              <Stack sx={{ alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <Typography variant={downMD ? 'h4' : 'h3'} sx={{ color: 'var(--theme-primary-color)', textAlign: 'center' }}>
                  Congratulation, Registration email {email || '[your email]'} and Phone verification completed. You can login now.
                </Typography>
              </Stack>
              <Box sx={{ width: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <AnimateButton>
                  <Button
                    color="secondary"
                    fullWidth
                    size="large"
                    variant="contained"
                    onClick={handleGoToLogin}
                    sx={{
                      ...authButtonBoldSx,
                      bgcolor: 'var(--theme-primary-color)',
                      color: 'var(--theme-white-color)',
                      '&:hover': { bgcolor: 'var(--theme-primary-color)' }
                    }}
                  >
                    Go to Login
                  </Button>
                </AnimateButton>
              </Box>
            </Stack>
          </AuthCardWrapper>
        </AuthStandardDialogFrame>
        <AuthFooter />
      </Stack>
    </AuthWrapper1>
  );
}
