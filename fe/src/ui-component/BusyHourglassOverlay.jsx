import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import { useSyncExternalStore } from 'react';
import Box from '@mui/material/Box';
import BusyHourglass from 'ui-component/BusyHourglass';
import OrangeButton from 'ui-component/OrangeButton';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { buttonFontSizeResponsive } from 'config/buttonFontEnv';
import { getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';
import { BUSY_HOURGLASS_SIZE, busyHourglassOverlayRootSx } from 'config/busyHourglassEnv';
import {
  getRecordVaultOverageThrottleActive,
  subscribeRecordVaultOverageThrottle,
  VAULT_OVERAGE_THROTTLE_BUSY_MESSAGE,
  VAULT_OVERAGE_THROTTLE_STATUS_LINE_RE
} from 'utils/recordVaultOverageThrottleUi';
import {
  getPhotoAlbumsOverageThrottleActive,
  subscribePhotoAlbumsOverageThrottle
} from 'utils/photoAlbumsOverageThrottleUi';
import VaultOverageThrottleNotice from 'ui-component/VaultOverageThrottleNotice';

/**
 * Full-viewport centered spinning hourglass — site-wide busy indicator.
 * Renders via portal so it stays centered over modals and page chrome.
 * Optional progressPercent (0–100) shows "% done" plus an optional status label.
 * Optional actionLabel + onAction (e.g. Skip OneDrive) for long waits.
 * When TutaNotes / TutaPhotoAlbums data-limit throttle is active, appends a REFILL notice (once —
 * backend progress labels may already include the same line).
 */
export default function BusyHourglassOverlay({
  open = false,
  label = 'Loading',
  progressPercent = null,
  progressLabel = '',
  actionLabel = '',
  onAction,
  backdropSx,
  fontSize = BUSY_HOURGLASS_SIZE,
  sx
}) {
  const notesOverageThrottled = useSyncExternalStore(
    subscribeRecordVaultOverageThrottle,
    getRecordVaultOverageThrottleActive,
    () => false
  );
  const albumsOverageThrottled = useSyncExternalStore(
    subscribePhotoAlbumsOverageThrottle,
    getPhotoAlbumsOverageThrottleActive,
    () => false
  );
  const overageThrottled = notesOverageThrottled || albumsOverageThrottled;

  if (!open || typeof document === 'undefined') return null;

  const showPercent = progressPercent != null && Number.isFinite(Number(progressPercent));
  const clampedPercent = showPercent
    ? Math.max(0, Math.min(100, Math.round(Number(progressPercent))))
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
  const showSideText = showPercent || Boolean(statusText) || showThrottleNotice;
  const ariaLabel = [
    label,
    showPercent && clampedPercent != null ? `${clampedPercent}% done` : '',
    statusText,
    showThrottleNotice ? VAULT_OVERAGE_THROTTLE_BUSY_MESSAGE : '',
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
    color: '#fff',
    textAlign: 'left',
    textShadow: '0 1px 0 #000',
    maxWidth: { xs: '70vw', sm: '36rem' },
    whiteSpace: 'pre-line'
  };

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
            color: 'var(--theme-yellow-color)',
            textAlign: 'left',
            textShadow: '0 1px 0 #000',
            whiteSpace: 'nowrap'
          }}
        >
          {clampedPercent}% done
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
          sx={{
            ...statusParagraphSx,
            color: 'var(--theme-yellow-color)',
            WebkitTextFillColor: 'var(--theme-yellow-color)',
            fontWeight: 800
          }}
        />
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
          gap: showSideText ? 2 : 1.5
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
  actionLabel: PropTypes.string,
  onAction: PropTypes.func,
  backdropSx: PropTypes.object,
  fontSize: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.object]),
  sx: PropTypes.object
};
