import { useCallback, useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { computeEffectiveLandscape, useMobileOrientationSim } from 'contexts/MobileOrientationSimContext';
import useVettingMobileTopCluster from 'hooks/useVettingMobileTopCluster';
import useInlineNotificationBell from 'hooks/useInlineNotificationBell';
import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';

import NotificationSection from './Header/NotificationSection';
import ProfileSection from './Header/ProfileSection';

import { IconMenu2 } from '@tabler/icons-react';

// ==============================|| ORIENTATION TOGGLE (sub-lg, landscape routes) ||============================== //

function readIsLandscape() {
  if (typeof window === 'undefined') return false;
  const t = window.screen?.orientation?.type;
  if (typeof t === 'string') {
    if (t.includes('landscape')) return true;
    if (t.includes('portrait')) return false;
  }
  return window.matchMedia('(orientation: landscape)').matches;
}

/**
 * @returns {Promise<{ ok: boolean, code?: string }>}
 */
async function tryLockTo(mode) {
  const orient = window.screen?.orientation;
  const lockType = mode === 'landscape' ? 'landscape-primary' : 'portrait-primary';

  if (!orient || typeof orient.lock !== 'function') {
    return { ok: false, code: 'no-api' };
  }

  const lockOnce = () => orient.lock(lockType);

  try {
    await lockOnce();
    return { ok: true };
  } catch {
    //
  }
  try {
    await orient.unlock();
    await lockOnce();
    return { ok: true };
  } catch {
    //
  }

  const el = document.documentElement;
  if (!document.fullscreenEnabled || typeof el.requestFullscreen !== 'function') {
    return { ok: false, code: 'lock-failed' };
  }

  try {
    try {
      await el.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      await el.requestFullscreen();
    }
  } catch {
    return { ok: false, code: 'fullscreen-denied' };
  }

  try {
    await lockOnce();
    return { ok: true };
  } catch {
    return { ok: false, code: 'lock-failed' };
  } finally {
    if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
      try {
        await document.exitFullscreen();
      } catch {
        //
      }
    }
  }
}

export default function LandscapeRecommendFloating() {
  const theme = useTheme();
  const downMD = useMediaQuery(theme.breakpoints.down('md'));
  const vettingMobileTopCluster = useVettingMobileTopCluster();
  const inlineNotificationBell = useInlineNotificationBell();
  const { simulation, setSimulation } = useMobileOrientationSim();
  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster?.isDashboardDrawerOpened;
  const [physLandscape, setPhysLandscape] = useState(readIsLandscape);
  const [snack, setSnack] = useState({ open: false, severity: 'info', message: '', duration: 7000 });

  useEffect(() => {
    if (!vettingMobileTopCluster) {
      setSimulation(null);
    }
  }, [vettingMobileTopCluster, setSimulation]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const sync = () => setPhysLandscape(readIsLandscape());

    const o = window.screen?.orientation;
    sync();
    o?.addEventListener?.('change', sync);

    const mq = window.matchMedia('(orientation: landscape)');
    mq.addEventListener('change', sync);

    return () => {
      o?.removeEventListener?.('change', sync);
      mq.removeEventListener('change', sync);
    };
  }, []);

  const showSnack = useCallback((severity, message, duration = 7000) => {
    setSnack({ open: true, severity, message, duration });
  }, []);

  const toggleOrientation = useCallback(async () => {
    const phys = readIsLandscape();
    const eff = computeEffectiveLandscape(phys, simulation);
    const wantLandscape = !eff;
    const nextMode = wantLandscape ? 'landscape' : 'portrait';

    const result = await tryLockTo(nextMode);

    if (result.ok) {
      setSimulation(null);
      showSnack('success', nextMode === 'landscape' ? 'Landscape lock requested.' : 'Portrait lock requested.', 5000);
      return;
    }

    const wantL = nextMode === 'landscape';
    const physL = readIsLandscape();
    const newSim = wantL === physL ? null : wantL ? 'landscape' : 'portrait';
    setSimulation(newSim);

    if (newSim) {
      showSnack(
        'success',
        nextMode === 'landscape'
          ? 'Landscape layout (preview — rotate the device or use this toggle when the browser cannot lock orientation).'
          : 'Portrait layout (preview — same as above).',
        7000
      );
      return;
    }

    showSnack('success', 'Layout matches your selection using the device orientation (simulation cleared).', 5000);
  }, [simulation, setSimulation, showSnack]);

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        void toggleOrientation();
      }
    },
    [toggleOrientation]
  );

  if (!vettingMobileTopCluster) return null;

  const effectiveLandscape = computeEffectiveLandscape(physLandscape, simulation);
  const label = effectiveLandscape ? 'Portrait Recommend' : 'Landscape Recommend';
  const ariaLabel = effectiveLandscape ? 'Switch to portrait orientation' : 'Switch to landscape orientation';

  return (
    <>
      <Box
        sx={{
          position: 'fixed',
          top: 'calc(6px + env(safe-area-inset-top, 0px))',
          ...(downMD
            ? {
                left: 'calc(6px + env(safe-area-inset-left, 0px))',
                right: 'calc(6px + env(safe-area-inset-right, 0px))'
              }
            : { right: 'calc(6px + env(safe-area-inset-right, 0px))' }),
          zIndex: 1250,
          display: 'flex',
          flexDirection: 'row',
          ...(downMD && { position: 'fixed' }),
          alignItems: 'center',
          justifyContent: downMD ? 'flex-start' : 'flex-end',
          gap: 1,
          maxWidth: downMD ? 'none' : 'calc(100vw - 12px)',
          overflow: 'visible',
          pointerEvents: 'none',
          '& > *': { pointerEvents: 'auto' }
        }}
      >
        <Avatar
          variant="rounded"
          onClick={() => handlerDrawerOpen(!drawerOpen)}
          aria-label="open menu"
          sx={{
            display: { xs: 'inline-flex', md: 'none' },
            width: 48,
            height: 48,
            borderRadius: 1,
            bgcolor: 'var(--theme-primary-color)',
            color: 'var(--theme-white-color)',
            border: '1px solid rgba(0,0,0,0.2)',
            cursor: 'pointer',
            transition: 'filter 0.15s ease, transform 0.12s ease',
            '&:hover': { bgcolor: 'var(--theme-primary-color)', filter: 'brightness(0.92)' },
            '&:active': { transform: 'scale(0.98)' }
          }}
        >
          <IconMenu2 stroke={1.8} size={22} />
        </Avatar>
        {downMD ? (
          <Box
            data-orientation-toggle-control
            role="button"
            tabIndex={0}
            aria-label={ariaLabel}
            onClick={() => void toggleOrientation()}
            onKeyDown={onKeyDown}
            sx={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'inline-flex',
              alignItems: 'center',
              px: 1.25,
              py: 0.5,
              borderRadius: 1,
              bgcolor: '#ffeb3b',
              color: '#111',
              border: '2px solid #111',
              fontWeight: 800,
              fontSize: '1.05rem',
              lineHeight: 1,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent'
            }}
            title={`${label}. Tap to switch landscape or portrait (device lock when supported, otherwise layout preview).`}
          >
            Recommend landscape
          </Box>
        ) : null}
        {!downMD && (
          <Box
            data-orientation-toggle-control
            role="button"
            tabIndex={0}
            aria-label={ariaLabel}
            onClick={() => void toggleOrientation()}
            onKeyDown={onKeyDown}
            sx={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              px: 1.25,
              py: 0.5,
              borderRadius: 1,
              boxShadow: 'none',
              bgcolor: '#ffeb3b',
              color: '#111',
              border: '2px solid #111',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease, transform 0.12s ease',
              userSelect: 'none',
              fontWeight: 800,
              whiteSpace: 'nowrap',
              WebkitTapHighlightColor: 'transparent',
              '&:hover': { bgcolor: '#fdd835', filter: 'none' },
              '&:active': { transform: 'scale(0.98)' },
              '&:focus-visible': {
                outline: '2px solid #111',
                outlineOffset: 2
              }
            }}
            title={`${label}. Tap to switch landscape or portrait (device lock when supported, otherwise layout preview).`}
          >
            {label}
          </Box>
        )}
        <Box sx={{ ml: 'auto', display: 'inline-flex', alignItems: 'center', gap: 1 }}>
          {!inlineNotificationBell ? <NotificationSection clusterTight /> : null}
          <ProfileSection clusterTight />
        </Box>
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={snack.duration}
        onClose={(_, reason) => {
          if (reason === 'clickaway') return;
          setSnack((s) => ({ ...s, open: false }));
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          severity={snack.severity}
          variant="filled"
          sx={{ width: '100%', maxWidth: 'min(92vw, 420px)' }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </>
  );
}
