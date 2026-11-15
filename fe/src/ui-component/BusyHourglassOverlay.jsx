import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import { useEffect, useState, useSyncExternalStore } from 'react';
import Box from '@mui/material/Box';
import BusyHourglass from 'ui-component/BusyHourglass';
import OrangeButton from 'ui-component/OrangeButton';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { buttonFontSizeResponsive } from 'config/buttonFontEnv';
import { useRecordVaultThrottleWaitProgress } from 'utils/recordVaultThrottleWaitProgress';
import {
  BUSY_HOURGLASS_COUNTDOWN_FLOOR,
  BUSY_HOURGLASS_COUNTDOWN_MS,
  BUSY_HOURGLASS_SIZE,
  busyHourglassOverlayRootSx,
  busyHourglassPercentSx
} from 'config/busyHourglassEnv';
import {
  getRecordVaultOverageThrottleActive,
  getRecordVaultOverageThrottleFactor,
  subscribeRecordVaultOverageThrottle,
  vaultOverageThrottleAriaMessage,
  VAULT_OVERAGE_THROTTLE_STATUS_LINE_RE
} from 'utils/recordVaultOverageThrottleUi';
import {
  getPhotoAlbumsOverageThrottleActive,
  getPhotoAlbumsOverageThrottleFactor,
  subscribePhotoAlbumsOverageThrottle
} from 'utils/photoAlbumsOverageThrottleUi';
import VaultOverageThrottleNotice from 'ui-component/VaultOverageThrottleNotice';

function formatElapsed(sec) {
  const n = Math.max(0, Math.floor(Number(sec) || 0));
  if (n < 60) return `${n}s elapsed`;
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}m ${String(s).padStart(2, '0')}s elapsed`;
}

/**
 * Full-viewport centered spinning hourglass — site-wide busy indicator.
 * Always shows remaining % plus verbose status: title (label), optional progressLabel,
 * elapsed time, and a short hint for estimated vs real vs throttled waits.
 */
export default function BusyHourglassOverlay({
  open = false,
  label = 'Loading',
  progressPercent = null,
  progressLabel = '',
  progressDetail = '',
  actionLabel = '',
  onAction,
  backdropSx,
  fontSize = BUSY_HOURGLASS_SIZE,
  yellowPanel = false,
  sx
}) {
  const notesOverageThrottled = useSyncExternalStore(subscribeRecordVaultOverageThrottle, getRecordVaultOverageThrottleActive, () => false);
  const albumsOverageThrottled = useSyncExternalStore(
    subscribePhotoAlbumsOverageThrottle,
    getPhotoAlbumsOverageThrottleActive,
    () => false
  );
  const notesOverageThrottleFactor = useSyncExternalStore(
    subscribeRecordVaultOverageThrottle,
    getRecordVaultOverageThrottleFactor,
    () => 1
  );
  const albumsOverageThrottleFactor = useSyncExternalStore(
    subscribePhotoAlbumsOverageThrottle,
    getPhotoAlbumsOverageThrottleFactor,
    () => 1
  );
  const overageThrottled = notesOverageThrottled || albumsOverageThrottled;
  const overageThrottleFactor = Math.max(1, Number(notesOverageThrottleFactor) || 1, Number(albumsOverageThrottleFactor) || 1);
  const throttleWaitPercent = useRecordVaultThrottleWaitProgress(Boolean(open));

  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (!open) {
      setElapsedSec(0);
      return undefined;
    }
    const startedAt = Date.now();
    setElapsedSec(0);
    const timerId = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timerId);
  }, [open]);

  const callerPercent = progressPercent != null && Number.isFinite(Number(progressPercent)) ? Number(progressPercent) : null;
  const hasRealProgress = callerPercent != null || throttleWaitPercent != null;

  const [indeterminateRemaining, setIndeterminateRemaining] = useState(100);
  useEffect(() => {
    if (!open) {
      setIndeterminateRemaining(100);
      return undefined;
    }
    if (hasRealProgress) return undefined;
    const startedAt = Date.now();
    setIndeterminateRemaining(100);
    const timerId = setInterval(() => {
      const t = Math.max(0, (Date.now() - startedAt) / BUSY_HOURGLASS_COUNTDOWN_MS);
      const remaining = Math.max(BUSY_HOURGLASS_COUNTDOWN_FLOOR, Math.round(100 * Math.exp(-2.2 * t)));
      setIndeterminateRemaining(remaining);
    }, 200);
    return () => clearInterval(timerId);
  }, [open, hasRealProgress]);

  if (!open || typeof document === 'undefined') return null;

  const donePercent = hasRealProgress
    ? Math.max(0, Math.min(100, Math.round(callerPercent != null ? callerPercent : throttleWaitPercent)))
    : null;
  const remainingPercent =
    donePercent != null ? Math.max(0, Math.min(100, 100 - donePercent)) : indeterminateRemaining;
  const clampedPercent = remainingPercent;

  const statusLines = String(progressLabel || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const callerStatusText = statusLines.filter((line) => !VAULT_OVERAGE_THROTTLE_STATUS_LINE_RE.test(line)).join('\n');
  const statusHadThrottle = statusLines.some((line) => VAULT_OVERAGE_THROTTLE_STATUS_LINE_RE.test(line));
  const showThrottleNotice = overageThrottled || statusHadThrottle || throttleWaitPercent != null;

  const titleText = String(label || 'Loading').trim() || 'Loading';
  // Avoid duplicating the title when progressLabel already starts with it.
  const callerLower = callerStatusText.toLowerCase();
  const titleAlreadyInStatus =
    Boolean(callerStatusText) &&
    (callerLower === titleText.toLowerCase() || callerLower.startsWith(`${titleText.toLowerCase()}\n`));
  const showTitle = Boolean(titleText) && !titleAlreadyInStatus;

  const detailText = String(progressDetail || '').trim();

  let modeHint = '';
  if (throttleWaitPercent != null || (overageThrottled && !hasRealProgress)) {
    modeHint =
      'Data transfer refill is empty — this wait is stretched on purpose. REFILL in the usage bar restores full speed.';
  } else if (callerPercent != null) {
    modeHint = `About ${Math.round(donePercent)}% complete — ${remainingPercent}% left.`;
  } else {
    modeHint =
      'Still working… percentage is an estimate of remaining wait (it will not hit 0% until this step finishes).';
  }

  const elapsedText = formatElapsed(elapsedSec);
  const showAction = Boolean(actionLabel) && typeof onAction === 'function';

  const percentText = remainingPercent <= 0 ? '0% — done' : `${remainingPercent}%`;
  const ariaLabel = [
    titleText,
    percentText,
    detailText,
    callerStatusText,
    modeHint,
    elapsedText,
    showThrottleNotice ? vaultOverageThrottleAriaMessage(overageThrottleFactor) : '',
    showAction ? actionLabel : ''
  ]
    .filter(Boolean)
    .join(' — ');

  const statusParagraphSx = {
    m: 0,
    fontFamily: MAIN_FONT_FAMILY,
    fontWeight: 700,
    fontSize: {
      xs: '0.95rem',
      sm: '1.15rem'
    },
    lineHeight: 1.3,
    color: yellowPanel ? '#000' : '#fff',
    WebkitTextFillColor: yellowPanel ? '#000' : undefined,
    textAlign: 'left',
    textShadow: yellowPanel ? 'none' : '0 1px 0 #000',
    maxWidth: { xs: '78vw', sm: '40rem' },
    whiteSpace: 'pre-line'
  };
  const titleSx = {
    ...statusParagraphSx,
    fontWeight: 900,
    fontSize: { xs: '1.05rem', sm: '1.35rem' }
  };
  const hintSx = {
    ...statusParagraphSx,
    fontWeight: 600,
    opacity: 0.95,
    fontSize: { xs: '0.85rem', sm: '1rem' }
  };
  const throttleColor = yellowPanel ? '#b00020' : 'var(--theme-yellow-color)';

  const statusColumn = (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5, minWidth: 0 }}>
      <Box
        component="p"
        sx={{
          ...busyHourglassPercentSx,
          fontFamily: MAIN_FONT_FAMILY
        }}
      >
        {percentText}
      </Box>
      {showTitle ? (
        <Box component="p" sx={titleSx}>
          {titleText}
        </Box>
      ) : null}
      {detailText ? (
        <Box component="p" sx={{ ...statusParagraphSx, fontWeight: 800, whiteSpace: 'nowrap' }}>
          {detailText}
        </Box>
      ) : null}
      {callerStatusText ? (
        <Box component="p" sx={statusParagraphSx}>
          {callerStatusText}
        </Box>
      ) : null}
      <Box component="p" sx={hintSx}>
        {modeHint}
      </Box>
      <Box component="p" sx={{ ...statusParagraphSx, fontWeight: 800, opacity: 0.95 }}>
        {elapsedText}
      </Box>
      {showThrottleNotice ? (
        <VaultOverageThrottleNotice
          component="p"
          factor={overageThrottleFactor}
          sx={{
            ...statusParagraphSx,
            color: throttleColor,
            WebkitTextFillColor: throttleColor,
            fontWeight: 800
          }}
        />
      ) : null}
    </Box>
  );

  const actionButton = showAction ? (
    <OrangeButton
      type="button"
      onClick={(event) => {
        event?.stopPropagation?.();
        onAction();
      }}
      aria-label={actionLabel}
      sx={{
        mt: 0.25,
        cursor: 'pointer',
        pointerEvents: 'auto',
        fontFamily: MAIN_FONT_FAMILY,
        fontWeight: 800,
        fontSize: buttonFontSizeResponsive,
        textTransform: 'none',
        px: 2.5,
        py: 1,
        boxShadow: '0 2px 10px rgba(0,0,0,0.45)'
      }}
    >
      {actionLabel}
    </OrangeButton>
  ) : null;

  return createPortal(
    <Box
      sx={{
        ...busyHourglassOverlayRootSx,
        ...(backdropSx || null),
        ...(sx || null),
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        cursor: showAction ? 'default' : 'wait'
      }}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clampedPercent}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          ...(yellowPanel
            ? {
                bgcolor: '#ffeb3b',
                border: '3px solid #000',
                borderRadius: '28px',
                boxShadow: '0 6px 24px rgba(0, 0, 0, 0.55)',
                px: { xs: 2, sm: 3 },
                py: { xs: 1.5, sm: 2 },
                maxWidth: '94vw',
                boxSizing: 'border-box'
              }
            : null)
        }}
      >
        <BusyHourglass fontSize={fontSize} />
        {statusColumn}
      </Box>
      {actionButton}
    </Box>,
    document.body
  );
}

BusyHourglassOverlay.propTypes = {
  open: PropTypes.bool,
  label: PropTypes.string,
  progressPercent: PropTypes.number,
  progressLabel: PropTypes.string,
  progressDetail: PropTypes.string,
  actionLabel: PropTypes.string,
  onAction: PropTypes.func,
  backdropSx: PropTypes.object,
  fontSize: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.object]),
  yellowPanel: PropTypes.bool,
  sx: PropTypes.object
};
