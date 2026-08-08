import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { getApiBaseUrl } from 'config/apiBaseUrl';

const API = getApiBaseUrl();

const RED_COUNTDOWN_TEXT = '#c62828';
const BLUE_POPUP_TEXT = '#1565c0';

/**
 * Yellow banner with countdown from one-shot GET /api/rateLimitStatus (no 3s / 500ms polling).
 */
export default function RateLimit429Countdown({ sx = {} }) {
  const [displaySec, setDisplaySec] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API}/api/rateLimitStatus`, { credentials: 'include' });
        const j = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!j.enabled) {
          setDisplaySec(null);
          return;
        }
        if (j.ttlSeconds != null && j.ttlSeconds >= 0) {
          setDisplaySec(Math.max(0, Math.ceil(Number(j.ttlSeconds))));
        } else if (j.windowMinutes != null) {
          setDisplaySec(Math.max(0, Math.ceil(Math.max(1, Number(j.windowMinutes) || 1) * 60)));
        } else {
          setDisplaySec(0);
        }
      } catch {
        if (!cancelled) setDisplaySec(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const secText = loading ? '…' : displaySec != null ? String(displaySec) : '0';

  return (
    <Box
      sx={{
        bgcolor: '#ffeb3b',
        color: BLUE_POPUP_TEXT,
        px: 2.5,
        py: 2,
        borderRadius: 1,
        maxWidth: 'min(92vw, 420px)',
        textAlign: 'center',
        boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
        border: `2px solid ${RED_COUNTDOWN_TEXT}`,
        position: 'relative',
        zIndex: 1,
        ...sx
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.75, letterSpacing: 0.3, color: BLUE_POPUP_TEXT }}>
        For website security, rate limit activated
      </Typography>
      <Typography variant="body1" component="p" sx={{ fontWeight: 600, color: BLUE_POPUP_TEXT, m: 0 }}>
        You may continue in{' '}
        <Box component="span" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: RED_COUNTDOWN_TEXT }}>
          {secText}
        </Box>
        {' '}
        seconds
      </Typography>
    </Box>
  );
}
