import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';

const OVERLOAD_EVENT = 'systemOverload503';

export default function SystemOverloadModal() {
  const [open, setOpen] = useState(false);
  const [retrySec, setRetrySec] = useState(15);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onOverload = (event) => {
      const detail = event?.detail || {};
      if (detail.recovered) {
        setOpen(false);
        setFailed(false);
        return;
      }
      if (detail.failed) {
        setFailed(true);
        setOpen(true);
        return;
      }
      setFailed(false);
      const sec = Math.max(1, Math.trunc(Number(detail.retryAfterSeconds) || 15));
      setRetrySec(sec);
      setOpen(true);
    };
    window.addEventListener(OVERLOAD_EVENT, onOverload);
    return () => window.removeEventListener(OVERLOAD_EVENT, onOverload);
  }, []);

  useEffect(() => {
    if (!open || failed) return undefined;
    const id = window.setInterval(() => {
      setRetrySec((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [open, failed]);

  const handleClose = () => {
    setOpen(false);
    setFailed(false);
  };

  return (
    <Dialog open={open} onClose={failed ? handleClose : undefined} maxWidth="sm" fullWidth>
      <DialogContent sx={{ textAlign: 'center', py: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
          {failed ? 'Still busy' : 'Thanks for your patience!'}
        </Typography>
        <Typography sx={{ mb: 2, lineHeight: 1.6 }}>
          {failed
            ? 'The system is still under heavy load. Your request could not complete automatically. Please wait a moment and try again.'
            : 'TutaMall & TutaDates are more popular than ever, and we’re seeing more visitors than expected. We’re adding more servers right now so this won’t happen again. Your request will retry automatically, so there’s no need to click again.'}
        </Typography>
        {!failed ? (
          <Box
            sx={{
              display: 'inline-block',
              bgcolor: '#e3f2fd',
              color: '#1565c0',
              px: 2.5,
              py: 1.5,
              borderRadius: 1,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            Retrying in {retrySec}s…
          </Box>
        ) : null}
        {failed ? (
          <Button variant="contained" onClick={handleClose} sx={{ mt: 2, minWidth: 120 }}>
            OK
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function dispatchSystemOverloadModal(detail = undefined) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OVERLOAD_EVENT, { detail }));
  }
}
