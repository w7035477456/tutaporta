import { useNavigate } from 'react-router-dom';

import useMediaQuery from '@mui/material/useMediaQuery';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';

import AuthWrapper1 from './AuthWrapper1';
import AuthCardWrapper from './AuthCardWrapper';
import AuthStandardDialogFrame from './AuthStandardDialogFrame';

import Logo from 'ui-component/Logo';
import AuthFooter from 'ui-component/cards/AuthFooter';
import AnimateButton from 'ui-component/extended/AnimateButton';
import { authShellStackSx, authFixedFooterContentPaddingBottom, authButtonBoldSx } from './authPageLayoutSx';

const MESSAGE =
  'If an account exists for this email, you will receive password reset instructions.';

export default function PasswordResetSent() {
  const navigate = useNavigate();
  const downMD = useMediaQuery((theme) => theme.breakpoints.down('md'));

  const handleOk = () => {
    try {
      window.close();
    } catch (_) {
      /* ignore */
    }
    setTimeout(() => {
      if (!document.hidden) {
        navigate('/pages/login');
      }
    }, 100);
  };

  return (
    <AuthWrapper1>
      <Stack sx={{ ...authShellStackSx, ...authFixedFooterContentPaddingBottom }}>
        <AuthStandardDialogFrame>
          <AuthCardWrapper fullWidth>
            <Stack sx={{ alignItems: 'center', justifyContent: 'center', gap: 3, px: { xs: 0, sm: 1 } }}>
              <Box sx={{ mb: 1 }}>
                <Logo authBranding />
              </Box>
              <Typography
                variant={downMD ? 'h5' : 'h4'}
                sx={{
                  color: 'var(--theme-primary-color)',
                  textAlign: 'center',
                  fontWeight: 600,
                  lineHeight: 1.35,
                  maxWidth: 520
                }}
              >
                {MESSAGE}
              </Typography>
              <Box sx={{ width: 1, maxWidth: 400, mt: 1 }}>
                <AnimateButton>
                  <Button
                    fullWidth
                    size="large"
                    variant="contained"
                    onClick={handleOk}
                    sx={{
                      ...authButtonBoldSx,
                      bgcolor: 'var(--theme-primary-color)',
                      color: 'var(--theme-white-color)',
                      py: 1.5,
                      '&:hover': { bgcolor: 'var(--theme-primary-color)', filter: 'brightness(0.95)' }
                    }}
                  >
                    Ok
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
