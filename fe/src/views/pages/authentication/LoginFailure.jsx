import { Link, useNavigate, useLocation } from 'react-router-dom';

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

// ================================|| AUTH - LOGIN FAILURE ||================================ //

const DEFAULT_MESSAGE = 'Login or Password fail';

const primaryContainedButtonSx = {
  ...authButtonBoldSx,
  bgcolor: 'var(--theme-primary-color)',
  color: 'var(--theme-white-color)',
  '&:hover': { bgcolor: 'var(--theme-primary-color)', filter: 'brightness(0.95)' }
};

export default function LoginFailure() {
  const navigate = useNavigate();
  const location = useLocation();
  const downMD = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const message = location.state?.message && typeof location.state.message === 'string' ? location.state.message : DEFAULT_MESSAGE;

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
                <Typography variant={downMD ? 'h3' : 'h2'} sx={{ color: 'error.main', textAlign: 'center' }}>
                  {message}
                </Typography>
              </Stack>
              <Box sx={{ width: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <AnimateButton>
                  <Button
                    fullWidth
                    size="large"
                    variant="contained"
                    onClick={() => navigate('/pages/login')}
                    sx={primaryContainedButtonSx}
                  >
                    Try Login Again
                  </Button>
                </AnimateButton>
                <AnimateButton>
                  <Button
                    fullWidth
                    size="large"
                    variant="contained"
                    onClick={() => navigate('/pages/forgotPassword')}
                    sx={primaryContainedButtonSx}
                  >
                    Forgot Password ?
                  </Button>
                </AnimateButton>
                <AnimateButton>
                  <Button
                    fullWidth
                    size="large"
                    variant="contained"
                    onClick={() => navigate('/register')}
                    sx={primaryContainedButtonSx}
                  >
                    Sign Up For Account
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
