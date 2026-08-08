import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Button from '@mui/material/Button';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

import AnimateButton from 'ui-component/extended/AnimateButton';
import { authButtonBoldSx } from '../authentication/authPageLayoutSx';
import CustomFormControl from 'ui-component/extended/Form/CustomFormControl';
import enterEmailImg from 'assets/images/enterEmail.png';
import { requestPasswordReset } from 'api/requestPasswordResetFe';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const rowSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  width: '100%'
};

const inputColSx = {
  flex: '1 1 62%',
  minWidth: 0,
  maxWidth: { xs: 'calc(100% - 67px - 16px)', sm: 'calc(100% - 78px - 16px)' }
};

const picSx = {
  flex: '0 0 auto',
  flexShrink: 0,
  width: { xs: 67, sm: 78 },
  height: 'auto',
  maxHeight: { xs: 62, sm: 70 },
  objectFit: 'contain',
  alignSelf: 'center'
};

export default function AuthForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const emailTrimmed = email.trim();
  const valid = EMAIL_PATTERN.test(emailTrimmed);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await requestPasswordReset(emailTrimmed);
      navigate('/pages/passwordResetSent');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Request failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Box sx={rowSx}>
        <Box sx={inputColSx}>
          <CustomFormControl fullWidth>
            <InputLabel htmlFor="forgot-password-email" sx={{ color: 'var(--theme-primary-color)' }}>
              Email Address
            </InputLabel>
            <OutlinedInput
              id="forgot-password-email"
              type="email"
              value={email}
              onChange={(ev) => {
                setEmail(ev.target.value);
                setError('');
              }}
              name="email"
              autoComplete="email"
              required
              sx={{
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--theme-primary-color)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--theme-primary-color)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--theme-primary-color)', borderWidth: 2 }
              }}
            />
          </CustomFormControl>
        </Box>
        <Box component="img" src={enterEmailImg} alt="" sx={picSx} />
      </Box>
      {error && (
        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
          {error}
        </Typography>
      )}
      <Box sx={{ mt: 2 }}>
        <AnimateButton>
          <Button
            fullWidth
            size="large"
            type="submit"
            variant="contained"
            disabled={submitting || !valid}
            sx={{
              ...authButtonBoldSx,
              ...(valid && !submitting
                ? {
                    bgcolor: 'var(--theme-primary-color)',
                    color: 'var(--theme-white-color)',
                    '&:hover': { bgcolor: 'var(--theme-primary-color)', filter: 'brightness(0.95)' }
                  }
                : {
                    bgcolor: 'action.disabledBackground',
                    color: 'action.disabled',
                    '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' }
                  })
            }}
          >
            {submitting ? 'Sending…' : 'Email Password Reset'}
          </Button>
        </AnimateButton>
      </Box>
    </form>
  );
}
