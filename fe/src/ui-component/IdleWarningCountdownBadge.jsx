import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useAuth } from 'contexts/AuthContext';
import { VSINGLES_IDLE_WARNING_EVENT } from 'utils/idleWarningBroadcast';

function formatMainCountdown(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/** Header badge during custom_logout_duration main countdown (hidden during warning popup). */
export default function IdleWarningCountdownBadge() {
  const { user } = useAuth();
  const [warningActive, setWarningActive] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    const onWarning = (event) => {
      const detail = event?.detail ?? {};
      const isMainPhase = detail.phase === 'main' || (detail.active === true && detail.phase !== 'warn');
      setWarningActive(isMainPhase);
      if (typeof detail.remainingSeconds === 'number') {
        setRemainingSeconds(Math.max(0, detail.remainingSeconds));
      } else if (!isMainPhase) {
        setRemainingSeconds(0);
      }
    };
    window.addEventListener(VSINGLES_IDLE_WARNING_EVENT, onWarning);
    return () => window.removeEventListener(VSINGLES_IDLE_WARNING_EVENT, onWarning);
  }, []);

  const label = useMemo(() => formatMainCountdown(remainingSeconds), [remainingSeconds]);

  if (!user || !warningActive) return null;

  return (
    <Box
      aria-live="polite"
      aria-label={`Session logout countdown ${label}`}
      title="Auto logout countdown — activity resets timer"
      sx={{
        mr: 0.8,
        px: 1,
        py: 0.5,
        border: '2px solid #000',
        borderRadius: '6px',
        bgcolor: '#efe7cf',
        minWidth: '4.5ch',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Typography
        component="span"
        sx={{
          fontWeight: 800,
          color: '#000',
          lineHeight: 1,
          fontSize: { xs: '1.75rem', sm: '1.9rem' },
          fontVariantNumeric: 'tabular-nums'
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}
