import { Link } from 'react-router-dom';

import useMediaQuery from '@mui/material/useMediaQuery';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project imports
import AuthWrapper1 from './AuthWrapper1';
import AuthCardWrapper from './AuthCardWrapper';
import AuthStandardDialogFrame from './AuthStandardDialogFrame';

import Logo from 'ui-component/Logo';
import AuthFooter from 'ui-component/cards/AuthFooter';
import AuthPhoneVerification from '../auth-forms/AuthPhoneVerification';
import { authShellStackSx, authFixedFooterContentPaddingBottom } from './authPageLayoutSx';

// ================================|| AUTH - PHONE VERIFICATION ||================================ //

export default function PhoneVerification() {
  const downMD = useMediaQuery((t) => t.breakpoints.down('md'));

  return (
    <AuthWrapper1>
      <Stack sx={{ ...authShellStackSx, ...authFixedFooterContentPaddingBottom }}>
        <AuthStandardDialogFrame>
          <AuthCardWrapper fullWidth sx={{ bgcolor: '#fff' }}>
            <Stack sx={{ alignItems: 'center', justifyContent: 'center', gap: 2, px: { xs: 1, sm: 2 }, boxSizing: 'border-box', width: '100%' }}>
              <Box sx={{ mb: 3 }}>
                <Link to="#" aria-label="logo">
                  <Logo authBranding />
                </Link>
              </Box>
              <Stack sx={{ alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <Typography variant={downMD ? 'h3' : 'h2'} sx={{ color: 'var(--theme-primary-color)' }}>
                  Sign up continue
                </Typography>
              </Stack>
              <Box sx={{ width: 1, maxWidth: '100%' }}>
                <AuthPhoneVerification />
              </Box>
            </Stack>
          </AuthCardWrapper>
        </AuthStandardDialogFrame>
        <AuthFooter />
      </Stack>
    </AuthWrapper1>
  );
}
