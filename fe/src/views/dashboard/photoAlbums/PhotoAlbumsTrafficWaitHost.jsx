import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import {
  dismissPhotoAlbumsTrafficWait,
  registerPhotoAlbumsTrafficWaitDismisser,
  registerPhotoAlbumsTrafficWaitOpener
} from 'utils/photoAlbumsTrafficWaitGate';
import {
  getPhotoAlbumsOverageThrottleActive,
  subscribePhotoAlbumsOverageThrottle
} from 'utils/photoAlbumsOverageThrottleUi';
import {
  isPhotoAlbumsDataPlanDialogOpen,
  requestOpenPhotoAlbumsDataPlan,
  setPhotoAlbumsDataPlanDialogOpen
} from 'utils/photoAlbumsDataPlanGate';
import PhotoAlbumsDataPlanDialog from './PhotoAlbumsDataPlanDialog';

/**
 * Non-dismissible free-tier traffic wait (data remaining ≤ 0).
 * No close X; blocks Esc / outside click / most keyboard+mouse until queue hits 0.
 * “click here” opens Data Plans (VIP refill) — the only interactive control during the wait.
 * Queue starts at 30–60, drops by 0–3 every 1–3s (random each tick).
 * Skipped immediately when Data Remain becomes positive after a refill purchase.
 */
export default function PhotoAlbumsTrafficWaitHost() {
  const [session, setSession] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [fallbackDataPlanOpen, setFallbackDataPlanOpen] = useState(false);
  const onDoneRef = useRef(null);
  const remainingRef = useRef(0);
  const sessionRef = useRef(null);
  const finishSessionRef = useRef(() => {});

  finishSessionRef.current = () => {
    if (!sessionRef.current && !onDoneRef.current) return;
    sessionRef.current = null;
    remainingRef.current = 0;
    const done = onDoneRef.current;
    onDoneRef.current = null;
    setRemaining(0);
    setSession(null);
    done?.();
  };

  useEffect(() => {
    return registerPhotoAlbumsTrafficWaitOpener((delaySec, onDone) => {
      const sec = Math.max(30, Math.min(60, Math.round(Number(delaySec) || 45)));
      onDoneRef.current = typeof onDone === 'function' ? onDone : null;
      remainingRef.current = sec;
      const next = { delaySec: sec };
      sessionRef.current = next;
      setRemaining(sec);
      setSession(next);
    });
  }, []);

  useEffect(() => {
    return registerPhotoAlbumsTrafficWaitDismisser(() => {
      finishSessionRef.current();
    });
  }, []);

  // After VIP refill clears overage, drop the queue popup without waiting out the countdown.
  useEffect(() => {
    return subscribePhotoAlbumsOverageThrottle(() => {
      if (!sessionRef.current) return;
      if (!getPhotoAlbumsOverageThrottleActive()) {
        dismissPhotoAlbumsTrafficWait();
      }
    });
  }, []);

  useEffect(() => {
    if (!session) return undefined;
    let cancelled = false;
    let timer = null;

    const scheduleTick = () => {
      // Next update in 1–3 seconds.
      const delayMs = (1 + Math.floor(Math.random() * 3)) * 1000;
      timer = window.setTimeout(() => {
        if (cancelled) return;
        // Drop queue position by 0–3 each tick.
        const step = Math.floor(Math.random() * 4);
        const next = Math.max(0, remainingRef.current - step);
        remainingRef.current = next;
        setRemaining(next);
        if (next <= 0) {
          finishSessionRef.current();
          return;
        }
        scheduleTick();
      }, delayMs);
    };

    scheduleTick();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [session]);

  useEffect(() => {
    if (!fallbackDataPlanOpen) return undefined;
    setPhotoAlbumsDataPlanDialogOpen(true);
    return () => setPhotoAlbumsDataPlanDialogOpen(false);
  }, [fallbackDataPlanOpen]);

  // Block Esc / keys while open (Data Plans + VIP link still work).
  useEffect(() => {
    if (!session) return undefined;
    const block = (event) => {
      if (isPhotoAlbumsDataPlanDialogOpen()) return;
      const t = event.target;
      if (t instanceof HTMLElement && t.closest?.('[data-pa-traffic-vip-link="1"]')) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('keydown', block, true);
    window.addEventListener('keyup', block, true);
    window.addEventListener('keypress', block, true);
    return () => {
      window.removeEventListener('keydown', block, true);
      window.removeEventListener('keyup', block, true);
      window.removeEventListener('keypress', block, true);
    };
  }, [session]);

  const open = Boolean(session);

  const openDataPlans = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!requestOpenPhotoAlbumsDataPlan()) {
      setFallbackDataPlanOpen(true);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={() => {}}
        disableEscapeKeyDown
        hideBackdrop={false}
        fullWidth
        maxWidth="sm"
        slotProps={{
          backdrop: {
            sx: {
              bgcolor: 'rgba(0,0,0,0.72)',
              pointerEvents: 'auto'
            },
            // Swallow clicks on the dimmer — no dismiss.
            onClick: (e) => {
              e.preventDefault();
              e.stopPropagation();
            }
          }
        }}
        PaperProps={{
          sx: {
            borderRadius: 2,
            border: '3px solid #000',
            bgcolor: '#1a1a1a',
            color: '#fff',
            p: { xs: 2, sm: 2.5 },
            fontFamily: MAIN_FONT_FAMILY,
            pointerEvents: 'auto'
          },
          onMouseDown: (e) => e.stopPropagation()
        }}
        sx={{ zIndex: 20000 }}
      >
        <Typography
          sx={{
            fontFamily: MAIN_FONT_FAMILY,
            fontWeight: 800,
            fontSize: { xs: '1.05rem', sm: '1.2rem' },
            lineHeight: 1.45,
            color: '#fff',
            WebkitTextFillColor: '#fff'
          }}
        >
          We are currently experiencing high traffic in free tier. For VIP no wait queue, please{' '}
          <Box
            component="button"
            type="button"
            data-pa-traffic-vip-link="1"
            onClick={openDataPlans}
            sx={{
              display: 'inline',
              p: 0,
              m: 0,
              border: 'none',
              background: 'none',
              font: 'inherit',
              color: 'var(--theme-yellow-color, #ffd700)',
              WebkitTextFillColor: 'var(--theme-yellow-color, #ffd700)',
              fontWeight: 900,
              textDecoration: 'underline',
              cursor: 'pointer'
            }}
          >
            click here
          </Box>
          .{' '}
          <Box
            component="span"
            sx={{
              color: 'var(--theme-yellow-color, #ffd700)',
              WebkitTextFillColor: 'var(--theme-yellow-color, #ffd700)',
              fontWeight: 900
            }}
          >
            (Your position in queue: {remaining})
          </Box>
        </Typography>
      </Dialog>
      <PhotoAlbumsDataPlanDialog
        open={fallbackDataPlanOpen}
        usage={null}
        onClose={() => setFallbackDataPlanOpen(false)}
      />
    </>
  );
}

PhotoAlbumsTrafficWaitHost.propTypes = {};
