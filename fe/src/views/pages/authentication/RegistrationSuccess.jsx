import { useNavigate, useLocation } from 'react-router-dom';

import useMediaQuery from '@mui/material/useMediaQuery';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

import AuthWrapper1 from './AuthWrapper1';
import AuthCardWrapper from './AuthCardWrapper';
import AuthStandardDialogFrame from './AuthStandardDialogFrame';

import Logo from 'ui-component/Logo';
import AuthFooter from 'ui-component/cards/AuthFooter';
import SelectedButtonTemplate from 'ui-component/SelectedButtonTemplate';
import { authShellStackSx, authFixedFooterContentPaddingBottom } from './authPageLayoutSx';

// ================================|| REGISTRATION EMAIL SENT — FULL PAGE ||================================ //

export default function RegistrationSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const downMD = useMediaQuery((theme) => theme.breakpoints.down('md'));

  const email = typeof location.state?.email === 'string' ? location.state.email.trim() : '';

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
                Please open email {email ? <strong>{email}</strong> : 'your inbox'} and click on link in email to continue
              </Typography>
              <Box sx={{ width: 1, maxWidth: 400, mt: 1 }}>
                <SelectedButtonTemplate fullWidth fitLabelWidth={false} onClick={handleOk}>
                  Ok
                </SelectedButtonTemplate>
              </Box>
            </Stack>
          </AuthCardWrapper>
        </AuthStandardDialogFrame>
        <AuthFooter />
      </Stack>
    </AuthWrapper1>
  );
}
