import { Link } from 'react-router-dom';

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

// ================================|| AUTH - PHONE VERIFICATION FAILURE ||================================ //

export default function PhoneVerificationFailure() {
  const downMD = useMediaQuery((theme) => theme.breakpoints.down('md'));

  const handleClose = () => {
    window.location.href = '/register';
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
                <Typography variant={downMD ? 'h4' : 'h3'} sx={{ color: 'error.main', textAlign: 'center' }}>
                  The phone verification code is incorrect. Please try register again.
                </Typography>
              </Stack>
              <Box sx={{ width: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <AnimateButton>
                  <Button
                    color="secondary"
                    fullWidth
                    size="large"
                    variant="contained"
                    onClick={handleClose}
                    sx={authButtonBoldSx}
                  >
                    Close
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
