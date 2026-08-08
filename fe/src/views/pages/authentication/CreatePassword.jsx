import { Link } from 'react-router-dom';

import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';

// project imports
import AuthWrapper1 from './AuthWrapper1';
import AuthCardWrapper from './AuthCardWrapper';
import AuthStandardDialogFrame from './AuthStandardDialogFrame';

import Logo from 'ui-component/Logo';
import AuthFooter from 'ui-component/cards/AuthFooter';
import AuthCreatePassword from '../auth-forms/AuthCreatePassword';
import { authShellStackSx, authFixedFooterContentPaddingBottom } from './authPageLayoutSx';

// ================================|| AUTH - CREATE PASSWORD ||================================ //

export default function CreatePassword() {
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
              <Box sx={{ width: 1 }}>
                <AuthCreatePassword />
              </Box>
            </Stack>
          </AuthCardWrapper>
        </AuthStandardDialogFrame>
        <AuthFooter />
      </Stack>
    </AuthWrapper1>
  );
}
