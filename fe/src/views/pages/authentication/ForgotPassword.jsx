import { Link } from 'react-router-dom';

import useMediaQuery from '@mui/material/useMediaQuery';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

import AuthWrapper1 from './AuthWrapper1';
import AuthCardWrapper from './AuthCardWrapper';
import AuthStandardDialogFrame from './AuthStandardDialogFrame';

import Logo from 'ui-component/Logo';
import AuthFooter from 'ui-component/cards/AuthFooter';
import AuthForgotPassword from '../auth-forms/AuthForgotPassword';
import { authShellStackSx, authFixedFooterContentPaddingBottom } from './authPageLayoutSx';

export default function ForgotPassword() {
  const downMD = useMediaQuery((t) => t.breakpoints.down('md'));

  return (
    <AuthWrapper1>
      <Stack sx={{ ...authShellStackSx, ...authFixedFooterContentPaddingBottom }}>
        <AuthStandardDialogFrame>
          <AuthCardWrapper fullWidth>
            <Stack sx={{ alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <Box sx={{ mb: 3 }}>
                <Link to="#" aria-label="logo">
                  <Logo authBranding />
                </Link>
              </Box>
              <Typography variant={downMD ? 'h3' : 'h2'} sx={{ color: 'var(--theme-primary-color)', textAlign: 'center' }}>
                Email Password Reset
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', maxWidth: 360 }}>
                Enter the email for your account. If it exists, we will send a link to reset your password.
              </Typography>
              <Box sx={{ width: 1 }}>
                <AuthForgotPassword />
              </Box>
            </Stack>
          </AuthCardWrapper>
        </AuthStandardDialogFrame>
        <AuthFooter />
      </Stack>
    </AuthWrapper1>
  );
}
