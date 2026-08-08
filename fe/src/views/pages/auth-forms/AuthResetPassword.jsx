import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

import AnimateButton from 'ui-component/extended/AnimateButton';
import { authButtonBoldSx } from '../authentication/authPageLayoutSx';
import CustomFormControl from 'ui-component/extended/Form/CustomFormControl';
import { verifyPasswordResetLink } from 'api/verifyPasswordResetLinkFe';
import { completePasswordReset } from 'api/completePasswordResetFe';
import enterPasswordImg from 'assets/images/enterPassword.png';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import CheckCircle from '@mui/icons-material/CheckCircle';
import RadioButtonUnchecked from '@mui/icons-material/RadioButtonUnchecked';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const headerSx = {
  bgcolor: 'var(--theme-primary-color)',
  color: 'var(--theme-white-color)',
  px: 2,
  py: 1.5,
  borderRadius: 1,
  mb: 2,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center'
};

export default function AuthResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(() => searchParams.get('email') || '');
  const [code, setCode] = useState(() =>
    (searchParams.get('code') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [linkStatus, setLinkStatus] = useState(() => {
    const em = searchParams.get('email') || '';
    const cd = (searchParams.get('code') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
    return em && cd ? 'loading' : 'invalid';
  });

  useEffect(() => {
    const em = searchParams.get('email') || '';
    const cd = (searchParams.get('code') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
    setEmail(em);
    setCode(cd);
  }, [searchParams]);

  useEffect(() => {
    const em = searchParams.get('email') || '';
    const cd = (searchParams.get('code') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
    if (!em || !cd || !EMAIL_PATTERN.test(em.trim())) {
      setLinkStatus('invalid');
      if (!em || !cd) setError('This reset link is incomplete.');
      else setError('Invalid email in this link.');
      return;
    }
    let cancelled = false;
    setLinkStatus('loading');
    verifyPasswordResetLink(em.trim().toLowerCase(), cd)
      .then((data) => {
        if (cancelled) return;
        setLinkStatus(data.valid ? 'valid' : 'invalid');
        if (!data.valid) setError('This reset link is invalid or expired. Please request a new password reset.');
      })
      .catch(() => {
        if (!cancelled) {
          setLinkStatus('invalid');
          setError('Could not verify this link. Please try again.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const pw8 = password.length >= 8;
  const pwSmall = /[a-z]/.test(password);
  const pwCap = /[A-Z]/.test(password);
  const pwNumSym = /[0-9]/.test(password) || /[^a-zA-Z0-9]/.test(password);
  const passwordOk = pw8 && pwSmall && pwCap && pwNumSym;
  const match = password.length > 0 && password === confirmPassword;
  const canSubmit = linkStatus === 'valid' && passwordOk && match && code.length === 6;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setSubmitting(true);
    try {
      await completePasswordReset({
        email: email.trim().toLowerCase(),
        code,
        password
      });
      navigate('/pages/login', { state: { email: email.trim() } });
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  if (linkStatus === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (linkStatus === 'invalid') {
    return (
      <Stack spacing={2} alignItems="center">
        <Typography variant="subtitle1" color="error" textAlign="center">
          {error || 'This reset link is missing, invalid, or expired.'}
        </Typography>
        <Button
          component={Link}
          to="/pages/forgotPassword"
          variant="contained"
          sx={{ ...authButtonBoldSx, bgcolor: 'var(--theme-primary-color)', color: '#fff' }}
        >
          Request new reset email
        </Button>
        <Typography component={Link} to="/pages/login" variant="body2" sx={{ color: 'var(--theme-primary-color)' }}>
          Back to sign in
        </Typography>
      </Stack>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Box sx={headerSx}>
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, fontSize: '1.875rem' }}>
          Set new password
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.92)', mt: 0.5 }}>
          Enter a new password for {email}
        </Typography>
      </Box>

      {error && (
        <Typography variant="body2" color="error" sx={{ mb: 2, textAlign: 'center' }}>
          {error}
        </Typography>
      )}

      <CustomFormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel htmlFor="reset-pw">Password</InputLabel>
        <OutlinedInput
          id="reset-pw"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(ev) => setPassword(ev.target.value)}
          endAdornment={
            <InputAdornment position="end">
              <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="large">
                {showPassword ? <Visibility /> : <VisibilityOff />}
              </IconButton>
            </InputAdornment>
          }
          label="Password"
          sx={{
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--theme-primary-color)' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--theme-primary-color)' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--theme-primary-color)', borderWidth: 2 }
          }}
        />
        <Typography variant="caption" sx={{ mt: 0.5, color: 'text.secondary' }}>
          Strength: {Math.round(([pw8, pwSmall, pwCap, pwNumSym].filter(Boolean).length / 4) * 100)}%
        </Typography>
      </CustomFormControl>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2, alignItems: 'flex-start' }}>
        <Stack component="ul" sx={{ listStyle: 'none', pl: 0, m: 0, gap: 0.5, flex: '1 1 200px', minWidth: 0 }}>
          <Stack component="li" direction="row" alignItems="center" gap={1}>
            {pw8 ? <CheckCircle color="success" sx={{ fontSize: 20 }} /> : <RadioButtonUnchecked sx={{ color: 'text.secondary', fontSize: 20 }} />}
            <Typography variant="body2">At least 8 characters</Typography>
          </Stack>
          <Stack component="li" direction="row" alignItems="center" gap={1}>
            {pwSmall ? <CheckCircle color="success" sx={{ fontSize: 20 }} /> : <RadioButtonUnchecked sx={{ color: 'text.secondary', fontSize: 20 }} />}
            <Typography variant="body2">At least one small letter</Typography>
          </Stack>
          <Stack component="li" direction="row" alignItems="center" gap={1}>
            {pwCap ? <CheckCircle color="success" sx={{ fontSize: 20 }} /> : <RadioButtonUnchecked sx={{ color: 'text.secondary', fontSize: 20 }} />}
            <Typography variant="body2">At least one capital letter</Typography>
          </Stack>
          <Stack component="li" direction="row" alignItems="center" gap={1}>
            {pwNumSym ? <CheckCircle color="success" sx={{ fontSize: 20 }} /> : <RadioButtonUnchecked sx={{ color: 'text.secondary', fontSize: 20 }} />}
            <Typography variant="body2">At least one number or symbol</Typography>
          </Stack>
        </Stack>
        <Box component="img" src={enterPasswordImg} alt="" sx={{ width: { xs: 100, sm: 120 }, height: 'auto', flexShrink: 0 }} />
      </Box>

      <CustomFormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel htmlFor="reset-pw2">Confirm Password</InputLabel>
        <OutlinedInput
          id="reset-pw2"
          type={showConfirmPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(ev) => setConfirmPassword(ev.target.value)}
          endAdornment={
            <InputAdornment position="end">
              <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end" size="large">
                {showConfirmPassword ? <Visibility /> : <VisibilityOff />}
              </IconButton>
            </InputAdornment>
          }
          label="Confirm Password"
          sx={{
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--theme-primary-color)' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--theme-primary-color)' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--theme-primary-color)', borderWidth: 2 }
          }}
        />
      </CustomFormControl>

      <AnimateButton>
        <Button
          fullWidth
          size="large"
          type="submit"
          variant="contained"
          disabled={submitting || !canSubmit}
          sx={{
            ...authButtonBoldSx,
            bgcolor: canSubmit && !submitting ? 'var(--theme-primary-color)' : 'action.disabledBackground',
            color: canSubmit && !submitting ? 'var(--theme-white-color)' : 'action.disabled'
          }}
        >
          {submitting ? 'Saving…' : 'Update password'}
        </Button>
      </AnimateButton>
    </form>
  );
}
