import { useEffect, useRef, useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';
import { useAuth } from 'contexts/AuthContext';
import api from 'api/axios';
import { storeIdleLogoutNotice } from 'utils/sessionEndNotice';
import { dispatchIdleWarningState } from 'utils/idleWarningBroadcast';

const LOGOUT_BLOCK_BACK_KEY = 'logoutBlockBack';
const POPUP_TEXT_BLACK = '#000';

const popupTextSx = {
  color: POPUP_TEXT_BLACK,
  WebkitTextFillColor: POPUP_TEXT_BLACK
};

const popupContainerSx = {
  color: POPUP_TEXT_BLACK,
  '& .MuiTypography-root': popupTextSx,
  '& .MuiDialogContent-root': popupTextSx
};

function formatWarnPopupCountdown(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')} sec`;
}

function formatWarnDurationLabel(seconds) {
  const safe = Math.max(1, Number(seconds) || 10);
  if (safe >= 60 && safe % 60 === 0) {
    const mins = safe / 60;
    return mins === 1 ? '1 min' : `${mins} min`;
  }
  return `${safe} sec`;
}

// ================================|| SESSION TIMEOUT WARNING MODAL ||================================ //

export default function SessionTimeoutWarning() {
  const { user, logout } = useAuth();
  const [config, setConfig] = useState({
    sessionTimeoutEnabled: false,
    logoutAfterMinutes: null,
    logoutMainSeconds: null,
    logoutWarnSeconds: null
  });
  const [showModal, setShowModal] = useState(false);
  const [warnSecondsRemaining, setWarnSecondsRemaining] = useState(0);
  const countdownIntervalRef = useRef(null);
  const signOutRef = useRef(null);
  const configRef = useRef(config);

  configRef.current = config;

  const clearCountdownTimers = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    clearCountdownTimers();
    setShowModal(false);
    setWarnSecondsRemaining(0);
    dispatchIdleWarningState({ active: false, phase: 'idle' });
    storeIdleLogoutNotice(config.logoutAfterMinutes);
    try {
      // Auth logout flushes Cloud/USB vault sessions before clearing the cookie.
      await logout();
    } catch (err) {
      console.error('Logout error', err);
    }
    sessionStorage.setItem(LOGOUT_BLOCK_BACK_KEY, '1');
    window.location.replace('/pages/login');
  }, [logout, config.logoutAfterMinutes, clearCountdownTimers]);

  signOutRef.current = handleSignOut;

  const startWarnPhase = useCallback(() => {
    clearCountdownTimers();
    const { logoutWarnSeconds } = configRef.current;
    const warnSec = Math.max(1, Number(logoutWarnSeconds) || 10);
    let remaining = warnSec;
    setWarnSecondsRemaining(remaining);
    setShowModal(true);
    dispatchIdleWarningState({ active: false, phase: 'warn' });

    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setWarnSecondsRemaining(remaining);
      if (remaining <= 0) {
        clearCountdownTimers();
        signOutRef.current?.();
      }
    }, 1000);
  }, [clearCountdownTimers]);

  const startMainPhase = useCallback(() => {
    clearCountdownTimers();
    const { logoutAfterMinutes, logoutMainSeconds } = configRef.current;
    const mainSec = Math.max(
      60,
      Number(logoutMainSeconds) || Math.trunc(Number(logoutAfterMinutes) || 60) * 60
    );
    let remaining = mainSec;
    setShowModal(false);
    setWarnSecondsRemaining(0);
    dispatchIdleWarningState({ active: true, phase: 'main', remainingSeconds: remaining });

    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        dispatchIdleWarningState({ active: true, phase: 'main', remainingSeconds: remaining });
        return;
      }
      clearCountdownTimers();
      startWarnPhase();
    }, 1000);
  }, [clearCountdownTimers, startWarnPhase]);

  const resetIdleTimer = useCallback(() => {
    clearCountdownTimers();
    setShowModal(false);
    setWarnSecondsRemaining(0);
    dispatchIdleWarningState({ active: false, phase: 'idle' });

    const { sessionTimeoutEnabled } = configRef.current;
    if (!user || !sessionTimeoutEnabled) return;

    startMainPhase();
  }, [user, clearCountdownTimers, startMainPhase]);

  useEffect(() => {
    if (!user) return;
    const fetchConfig = async () => {
      try {
        const res = await api.get('/api/sessionConfig');
        setConfig({
          sessionTimeoutEnabled: res.data.sessionTimeoutEnabled === true,
          logoutAfterMinutes: res.data.logoutAfterMinutes ?? null,
          logoutMainSeconds: res.data.logoutMainSeconds ?? null,
          logoutWarnSeconds: res.data.logoutWarnSeconds ?? null
        });
      } catch {
        setConfig({
          sessionTimeoutEnabled: false,
          logoutAfterMinutes: null,
          logoutMainSeconds: null,
          logoutWarnSeconds: null
        });
      }
    };
    void fetchConfig();

    const onReload = () => {
      void fetchConfig();
    };
    window.addEventListener('vsingles-session-config-reload', onReload);
    return () => {
      window.removeEventListener('vsingles-session-config-reload', onReload);
    };
  }, [user]);

  useEffect(() => {
    if (!user || !config.sessionTimeoutEnabled) return;
    const events = ['mousedown', 'mousemove', 'click', 'keydown', 'keyup', 'keypress', 'wheel', 'scroll', 'touchstart', 'touchmove'];
    const onActivity = () => {
      resetIdleTimer();
    };
    resetIdleTimer();
    events.forEach((e) => {
      window.addEventListener(e, onActivity);
      document.addEventListener(e, onActivity);
    });
    return () => {
      events.forEach((e) => {
        window.removeEventListener(e, onActivity);
        document.removeEventListener(e, onActivity);
      });
      clearCountdownTimers();
      dispatchIdleWarningState({ active: false, phase: 'idle' });
    };
  }, [
    user,
    config.sessionTimeoutEnabled,
    config.logoutAfterMinutes,
    config.logoutMainSeconds,
    config.logoutWarnSeconds,
    resetIdleTimer,
    clearCountdownTimers
  ]);

  useEffect(() => {
    if (!user) dispatchIdleWarningState({ active: false, phase: 'idle' });
  }, [user]);

  if (!user || !config.sessionTimeoutEnabled) return null;

  const warnDurationLabel = formatWarnDurationLabel(config.logoutWarnSeconds);

  return (
    <Dialog
      open={showModal}
      disableEscapeKeyDown
      maxWidth={false}
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
          overflow: 'hidden',
          maxWidth: { xs: 'min(92vw, 520px)', sm: 520 },
          bgcolor: '#f4d03f',
          border: '3px solid #000',
          ...popupContainerSx
        }
      }}
      slotProps={{
        backdrop: { sx: { backgroundColor: 'rgba(0,0,0,0.55)' } }
      }}
    >
      <DialogContent sx={{ p: { xs: 2.5, sm: 3.5 }, textAlign: 'center', ...popupContainerSx }}>
        <Typography
          sx={{
            ...popupTextSx,
            fontWeight: 800,
            fontSize: { xs: '1.35rem', sm: '1.55rem' },
            lineHeight: 1.35,
            mb: 1.5
          }}
        >
          Warning, you will be logoff in {warnDurationLabel}
        </Typography>
        <Typography sx={{ ...popupTextSx, fontWeight: 700, fontSize: { xs: '1rem', sm: '1.1rem' }, mb: 2.5 }}>
          Unless a mouse or keyboard activity is detected
        </Typography>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            flexWrap: 'wrap',
            ...popupTextSx
          }}
        >
          <Typography sx={{ ...popupTextSx, fontWeight: 800, fontSize: { xs: '1.25rem', sm: '1.4rem' } }}>
            Log off
          </Typography>
          <Box
            sx={{
              px: 2,
              py: 1,
              border: '3px solid #000',
              borderRadius: 1,
              bgcolor: '#fff',
              minWidth: '7ch',
              ...popupTextSx
            }}
          >
            <Typography
              aria-live="polite"
              sx={{
                ...popupTextSx,
                fontWeight: 800,
                fontSize: { xs: '1.5rem', sm: '1.75rem' },
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1
              }}
            >
              {formatWarnPopupCountdown(warnSecondsRemaining)}
            </Typography>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
