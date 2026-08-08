import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';

import tooManyRequestErrorImg from 'assets/images/tooManyRequestError.png';
import RateLimit429Countdown from 'ui-component/RateLimit429Countdown';
import { useAuth } from 'contexts/AuthContext';
import { isAdminSession } from 'utils/adminSession';
import { getClientApiCooldownRemainingSeconds } from 'utils/clientApiCooldown';

const RATE_LIMIT_EVENT = 'rateLimit429';

// ================================|| TOO MANY REQUESTS MODAL ||================================ //

export default function TooManyRequestsModal() {
  const { user } = useAuth();
  const adminBypass = isAdminSession(user);
  const [open, setOpen] = useState(false);
  const [clientCooldownUntil, setClientCooldownUntil] = useState(null);
  const [clientDisplaySec, setClientDisplaySec] = useState(0);

  useEffect(() => {
    if (adminBypass) {
      setOpen(false);
      setClientCooldownUntil(null);
    }
  }, [adminBypass]);

  useEffect(() => {
    const handleRateLimit = (event) => {
      if (isAdminSession(user)) return;
      const cooldownUntil = Number(event?.detail?.cooldownUntil);
      setClientCooldownUntil(Number.isFinite(cooldownUntil) && cooldownUntil > Date.now() ? cooldownUntil : null);
      setOpen(true);
    };
    window.addEventListener(RATE_LIMIT_EVENT, handleRateLimit);
    return () => window.removeEventListener(RATE_LIMIT_EVENT, handleRateLimit);
  }, [user]);

  useEffect(() => {
    if (!clientCooldownUntil) return undefined;
    const update = () => setClientDisplaySec(getClientApiCooldownRemainingSeconds(clientCooldownUntil));
    update();
    const id = window.setInterval(update, 500);
    return () => window.clearInterval(id);
  }, [clientCooldownUntil]);

  useEffect(() => {
    if (!open || !clientCooldownUntil) return;
    if (clientDisplaySec > 0) return;
    setOpen(false);
    setClientCooldownUntil(null);
  }, [open, clientCooldownUntil, clientDisplaySec]);

  const handleClose = () => {
    setOpen(false);
    setClientCooldownUntil(null);
  };

  const clientCooldownBox = (
    <Box
      sx={{
        bgcolor: '#ffeb3b',
        color: '#1565c0',
        px: 2.5,
        py: 2,
        borderRadius: 1,
        textAlign: 'center',
        boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
        border: '2px solid #c62828'
      }}
    >
      <Box sx={{ fontWeight: 800, mb: 0.75, letterSpacing: 0.3 }}>Browser cooldown activated</Box>
      <Box sx={{ fontWeight: 600 }}>
        You may continue in{' '}
        <Box component="span" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#c62828' }}>
          {clientDisplaySec}
        </Box>{' '}
        seconds
      </Box>
    </Box>
  );

  if (clientCooldownUntil && !adminBypass) {
    return (
      <Dialog
        open={open}
        maxWidth={false}
        disableEscapeKeyDown
        slotProps={{
          backdrop: { sx: { backgroundColor: 'transparent' } }
        }}
        PaperProps={{
          sx: {
            m: 0,
            width: 'min(92vw, 420px)',
            maxWidth: '92vw',
            bgcolor: 'transparent',
            boxShadow: 'none',
            overflow: 'visible'
          }
        }}
      >
        <DialogContent sx={{ p: 0, overflow: 'visible' }}>{clientCooldownBox}</DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: 'min(90vw, 900px)',
          maxWidth: '90vw',
          maxHeight: '82vh',
          borderRadius: 2,
          overflow: 'visible'
        }
      }}
      slotProps={{
        backdrop: { sx: { backgroundColor: 'rgba(0,0,0,0.7)' } }
      }}
    >
      <DialogContent
        sx={{
          p: 0,
          overflow: 'visible',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            px: { xs: 1.5, sm: 2.5 }
          }}
        >
          <Box
            component="img"
            src={tooManyRequestErrorImg}
            alt="Too many requests"
            sx={{
              width: '100%',
              maxWidth: '100%',
              maxHeight: '62vh',
              height: 'auto',
              objectFit: 'contain',
              display: 'block'
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              left: '50%',
              top: '44%',
              transform: 'translate(-50%, -50%)',
              zIndex: 2,
              width: 'min(92vw, 420px)',
              pointerEvents: 'auto'
            }}
          >
            <RateLimit429Countdown />
          </Box>
        </Box>
        <Button variant="contained" color="primary" onClick={handleClose} sx={{ m: 2, minWidth: 120, zIndex: 3 }}>
          OK
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function dispatchTooManyRequestsModal(detail = undefined) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RATE_LIMIT_EVENT, { detail }));
  }
}
