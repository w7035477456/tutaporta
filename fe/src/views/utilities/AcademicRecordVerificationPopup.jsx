import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import { PARCHMENT_ORDER_STATUS_URL } from 'constants/parchmentOrderUrl';
import sampleTranscriptOrder from 'assets/images/sampleTranscriptOrder.png';
import PopupBlockedAllowHelp from 'ui-component/PopupBlockedAllowHelp';

const PARCHMENT_WINDOW_NAME = 'parchmentOrderStatus';
const PARCHMENT_POLL_MS = 500;

function openParchmentWindow() {
  const width = Math.min(1100, Math.max(800, Math.floor(window.outerWidth * 0.8)));
  const height = Math.min(900, Math.max(600, Math.floor(window.outerHeight * 0.85)));
  const left = Math.max(0, window.screenX + Math.floor((window.outerWidth - width) / 2));
  const top = Math.max(0, window.screenY + Math.floor((window.outerHeight - height) / 2));
  return window.open(
    PARCHMENT_ORDER_STATUS_URL,
    PARCHMENT_WINDOW_NAME,
    `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
}

export default function AcademicRecordVerificationPopup({ open, onClose }) {
  const [popupBlocked, setPopupBlocked] = useState(false);
  const parchmentWindowRef = useRef(null);
  const pollTimerRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current != null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const closeParchmentWindow = useCallback(() => {
    stopPolling();
    try {
      if (parchmentWindowRef.current && !parchmentWindowRef.current.closed) {
        parchmentWindowRef.current.close();
      }
    } catch {
      // ignore
    }
    parchmentWindowRef.current = null;
  }, [stopPolling]);

  const handleOpenParchment = useCallback(() => {
    setPopupBlocked(false);
    const win = openParchmentWindow();
    if (!win) {
      setPopupBlocked(true);
      return;
    }
    parchmentWindowRef.current = win;
    try {
      win.focus();
    } catch {
      // ignore
    }
    stopPolling();
    pollTimerRef.current = window.setInterval(() => {
      if (!parchmentWindowRef.current || parchmentWindowRef.current.closed) {
        stopPolling();
        parchmentWindowRef.current = null;
      }
    }, PARCHMENT_POLL_MS);
  }, [stopPolling]);

  // Close the Parchment popup when this dialog closes (do not auto-open Parchment on open).
  useEffect(() => {
    if (!open) {
      closeParchmentWindow();
      setPopupBlocked(false);
    }
    return undefined;
  }, [open, closeParchmentWindow]);

  useEffect(() => () => closeParchmentWindow(), [closeParchmentWindow]);

  const handleClose = useCallback(() => {
    closeParchmentWindow();
    onClose?.();
  }, [closeParchmentWindow, onClose]);

  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={handleClose}
      closeButtonAriaLabel="Close Academic Record Search"
    >
      <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
        <ColorTemplate7PopupLargeDark.Title>Academic Record Search</ColorTemplate7PopupLargeDark.Title>



        <ColorTemplate7PopupLargeDark.BodyText>
        <Box component="div" sx={{ fontWeight: 700, color: 'var(--theme-primary-color)' }}>
          Double your attractiveness with a Verified Badge
        </Box>
          Statistically, verified graduates get more than twice the attention.
        </ColorTemplate7PopupLargeDark.BodyText>

        <Box component="ol" sx={{ pl: 3, m: 0, color: 'var(--theme-primary-color)', '& li': { mb: 0.75 } }}>
          <Box component="li">
            Order your transcript via Parchment <Box component="em">(one-time $11 fee)</Box>
          </Box>
          <Box component="li">
            Have it sent to{' '}
            <Box component="span" sx={{ fontWeight: 700 }}>
              transcript@tutamall.com
            </Box>
          </Box>
          <Box component="li">We verify and display only your major &amp; graduation year—for life!</Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
          <ColorTemplate7PopupLargeDark.ActionButton onClick={handleOpenParchment}>
            Click to Order transcript from Parchment.com
          </ColorTemplate7PopupLargeDark.ActionButton>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
          <Box
            component="img"
            src={sampleTranscriptOrder}
            alt="Sample Transcript order pages"
            sx={{
              display: 'block',
              width: '100%',
              maxWidth: '100%',
              height: 'auto',
              border: '1px solid var(--theme-primary-color)',
              borderRadius: 1
            }}
          />
        </Box>

        {popupBlocked ? (
          <>
            <PopupBlockedAllowHelp />
            <ColorTemplate7PopupLargeDark.ErrorBar>
              Your browser blocked the Parchment popup. Allow popups for this site, or{' '}
              <Link
                href={PARCHMENT_ORDER_STATUS_URL}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: '#90caf9', fontWeight: 700 }}
              >
                open Parchment in a new tab ↗
              </Link>
              .
            </ColorTemplate7PopupLargeDark.ErrorBar>
          </>
        ) : null}
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

AcademicRecordVerificationPopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};
