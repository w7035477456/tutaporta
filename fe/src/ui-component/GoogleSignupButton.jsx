import PropTypes from 'prop-types';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';

import googleIcon from 'assets/images/icons/google.svg';
import { authButtonBoldSx } from 'views/pages/authentication/authPageLayoutSx';

export default function GoogleSignupButton({ disabled = false, busy = false, onClick }) {
  return (
    <Button
      type="button"
      fullWidth
      disableElevation
      disabled={disabled || busy}
      onClick={onClick}
      sx={{
        ...authButtonBoldSx,
        textTransform: 'none',
        bgcolor: '#ffffff',
        color: '#1f1f1f',
        border: '3px solid #dadce0',
        py: 1.1,
        gap: 1.25,
        '&:hover': {
          bgcolor: '#f8f9fa',
          borderColor: '#dadce0'
        },
        '&.Mui-disabled': {
          bgcolor: '#f1f3f4',
          color: '#9aa0a6',
          borderColor: '#dadce0'
        }
      }}
    >
      <Box component="img" src={googleIcon} alt="" sx={{ width: 40, height: 40, flexShrink: 0 }} />
      {busy ? 'Connecting to Google…' : 'Sign up with Google'}
    </Button>
  );
}

GoogleSignupButton.propTypes = {
  disabled: PropTypes.bool,
  busy: PropTypes.bool,
  onClick: PropTypes.func
};
