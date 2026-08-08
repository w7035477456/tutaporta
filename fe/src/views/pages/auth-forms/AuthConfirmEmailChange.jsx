import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

import AnimateButton from 'ui-component/extended/AnimateButton';
import { authButtonBoldSx } from '../authentication/authPageLayoutSx';
import { completeEmailChange, verifyEmailChangeLink } from 'api/settingsAccountFe';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthConfirmEmailChange() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(() => searchParams.get('email') || '');
  const [code, setCode] = useState(() =>
    (searchParams.get('code') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()
  );
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
      if (!em || !cd) setError('This confirmation link is incomplete.');
      else setError('Invalid email in this link.');
      return;
    }

    let cancelled = false;
    setLinkStatus('loading');
    verifyEmailChangeLink(em.trim().toLowerCase(), cd)
      .then((data) => {
        if (cancelled) return;
        setLinkStatus(data.valid ? 'valid' : 'invalid');
        if (!data.valid) setError('This confirmation link is invalid or expired. Please request a new email change.');
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

  const handleConfirm = async () => {
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      const data = await completeEmailChange({
        email: email.trim().toLowerCase(),
        code: code.trim().toUpperCase()
      });
      setSuccess(data?.message || 'Your email address has been updated.');
      setLinkStatus('done');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to confirm email change.');
    } finally {
      setSubmitting(false);
    }
  };

  if (linkStatus === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4" sx={{ textAlign: 'center' }}>
        Confirm new email
      </Typography>
      {linkStatus === 'invalid' ? (
        <Typography color="error" sx={{ textAlign: 'center' }}>
          {error || 'This confirmation link is invalid or expired.'}
        </Typography>
      ) : null}
      {linkStatus === 'valid' || linkStatus === 'done' ? (
        <>
          <Typography sx={{ textAlign: 'center' }}>New email: {email.trim().toLowerCase()}</Typography>
          {success ? (
            <Typography color="success.main" sx={{ textAlign: 'center' }}>
              {success}
            </Typography>
          ) : null}
          {error ? (
            <Typography color="error" sx={{ textAlign: 'center' }}>
              {error}
            </Typography>
          ) : null}
          {linkStatus === 'valid' ? (
            <AnimateButton>
              <Button fullWidth size="large" variant="contained" sx={authButtonBoldSx} disabled={submitting} onClick={handleConfirm}>
                {submitting ? 'Confirming…' : 'Confirm new email'}
              </Button>
            </AnimateButton>
          ) : (
            <AnimateButton>
              <Button fullWidth size="large" variant="contained" component={Link} to="/pages/login" sx={authButtonBoldSx}>
                Go to login
              </Button>
            </AnimateButton>
          )}
        </>
      ) : (
        <AnimateButton>
          <Button fullWidth size="large" variant="contained" component={Link} to="/profilesRecords" sx={authButtonBoldSx}>
            Back to Profile & Records
          </Button>
        </AnimateButton>
      )}
    </Stack>
  );
}
