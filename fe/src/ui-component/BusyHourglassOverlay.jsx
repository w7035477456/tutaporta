import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import { useEffect, useState, useSyncExternalStore } from 'react';
import Box from '@mui/material/Box';
import BusyHourglass from 'ui-component/BusyHourglass';
import OrangeButton from 'ui-component/OrangeButton';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { buttonFontSizeResponsive } from 'config/buttonFontEnv';
import { getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';
import { useRecordVaultThrottleWaitProgress } from 'utils/recordVaultThrottleWaitProgress';
import { BUSY_HOURGLASS_SIZE, busyHourglassOverlayRootSx } from 'config/busyHourglassEnv';
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

/**
 * Full-viewport centered spinning hourglass — site-wide busy indicator.
 * Renders via portal so it stays centered over modals and page chrome.
 * Optional progressPercent (0–100) shows "% done" plus an optional status label.
 * Optional progressDetail (e.g. "310mb of 1055mb done") renders directly under the percent.
 * Optional actionLabel + onAction (e.g. Skip OneDrive) for long waits.
 * When TutaNotes / TutaPhotoAlbums data-limit throttle is active, appends a REFILL notice (once —
 * backend progress labels may already include the same line).
 * yellowPanel: hourglass + % + status sit on a rounded yellow panel with dark text.
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
  // While the backend is stretching this request (refill depleted) it publishes how
  // far through that sleep it is — show it even when the caller passed no percent,
  // so a throttled upload reads "37% done" instead of a blank spinner.
  const throttleWaitPercent = useRecordVaultThrottleWaitProgress(Boolean(open));

  // Throttled requests have no byte-level total to report, so also count how long
  // the user has been waiting — it keeps ticking even if a progress report is missed.
  const throttledOpen = Boolean(open) && overageThrottled;
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (!throttledOpen) {
      setElapsedSec(0);
      return undefined;
    }
    const startedAt = Date.now();
    setElapsedSec(0);
    const timerId = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timerId);
  }, [throttledOpen]);

  if (!open || typeof document === 'undefined') return null;

  const callerPercent = progressPercent != null && Number.isFinite(Number(progressPercent)) ? Number(progressPercent) : null;
  const showPercent = callerPercent != null || throttleWaitPercent != null;
  const clampedPercent = showPercent
    ? Math.max(0, Math.min(100, Math.round(callerPercent != null ? callerPercent : throttleWaitPercent)))
    : null;
  // Backend may embed the REFILL line in progressLabel; keep only the upload/status
  // lines here so the yellow throttleNotice below is not duplicated.
  const statusLines = String(progressLabel || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const statusText = statusLines.filter((line) => !VAULT_OVERAGE_THROTTLE_STATUS_LINE_RE.test(line)).join('\n');
  const statusHadThrottle = statusLines.some((line) => VAULT_OVERAGE_THROTTLE_STATUS_LINE_RE.test(line));
  const showThrottleNotice = overageThrottled || statusHadThrottle;
  const showAction = Boolean(actionLabel) && typeof onAction === 'function';
  // A live throttle percent is the most useful number; otherwise, when we know the
  // request is being throttled, at least show how long it has been waiting.
  const waitingText =
    throttledOpen && !showPercent && elapsedSec > 0
      ? `${elapsedSec}s waiting`
      : throttledOpen && showPercent && elapsedSec > 0
        ? `${elapsedSec}s elapsed`
        : throttledOpen && elapsedSec === 0
          ? 'Transfer in progress…'
          : '';
  const detailText = showPercent ? String(progressDetail || '').trim() : '';
  const showSideText = showPercent || Boolean(statusText) || showThrottleNotice || Boolean(waitingText);
  const percentText =
    clampedPercent == null
      ? ''
      : callerPercent == null
        ? `${clampedPercent}% of throttled wait`
        : `${clampedPercent}% done`;
  const ariaLabel = [
    label,
    percentText,
    detailText,
    statusText,
    showThrottleNotice ? vaultOverageThrottleAriaMessage(overageThrottleFactor) : '',
    waitingText,
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
    lineHeight: 1.25,
    color: yellowPanel ? '#000' : '#fff',
    WebkitTextFillColor: yellowPanel ? '#000' : undefined,
    textAlign: 'left',
    textShadow: yellowPanel ? 'none' : '0 1px 0 #000',
    maxWidth: { xs: '70vw', sm: '36rem' },
    whiteSpace: 'pre-line'
  };
  const percentColor = yellowPanel ? '#000' : 'var(--theme-yellow-color)';
  const throttleColor = yellowPanel ? '#b00020' : 'var(--theme-yellow-color)';

  const statusColumn = showSideText ? (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5, minWidth: 0 }}>
      {showPercent ? (
        <Box
          component="p"
          sx={{
            m: 0,
            fontFamily: MAIN_FONT_FAMILY,
            fontWeight: 800,
            fontSize: {
              xs: '1.35rem',
              sm: getDesktopTitleFontSizeVw()
            },
            lineHeight: 1.2,
            color: percentColor,
            WebkitTextFillColor: percentColor,
            textAlign: 'left',
            textShadow: yellowPanel ? 'none' : '0 1px 0 #000',
            whiteSpace: 'nowrap'
          }}
        >
          {percentText}
        </Box>
      ) : null}
      {detailText ? (
        <Box component="p" sx={{ ...statusParagraphSx, fontWeight: 800, whiteSpace: 'nowrap' }}>
          {detailText}
        </Box>
      ) : null}
      {statusText ? (
        <Box component="p" sx={statusParagraphSx}>
          {statusText}
        </Box>
      ) : null}
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
      {waitingText ? (
        <Box component="p" sx={{ ...statusParagraphSx, fontWeight: 800, opacity: 0.9 }}>
          {waitingText}
        </Box>
      ) : null}
    </Box>
  ) : null;

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
      {...(showPercent
        ? {
            'aria-valuemin': 0,
            'aria-valuemax': 100,
            'aria-valuenow': clampedPercent
          }
        : null)}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: showSideText ? 'row' : 'column',
          alignItems: 'center',
          gap: showSideText ? 2 : 1.5,
          ...(yellowPanel
            ? {
                bgcolor: '#ffeb3b',
                border: '3px solid #000',
                borderRadius: '28px',
                boxShadow: '0 6px 24px rgba(0, 0, 0, 0.55)',
                px: { xs: 2, sm: 3 },
                py: { xs: 1.5, sm: 2 },
                maxWidth: '92vw',
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
