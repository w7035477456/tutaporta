import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import Box from '@mui/material/Box';
import { BUSY_HOURGLASS_OVERLAY_Z_INDEX } from 'config/busyHourglassEnv';
import lockGifSrc from 'assets/images/Lock.gif';

/** One full Lock.gif cycle (parsed GIF delay sum) + small buffer. */
export const LOCK_GIF_CYCLE_MS = 3000 + 200;

export { lockGifSrc };

/**
 * Shows Lock.gif centered over the current TutaNotes workspace while inner
 * encrypt / decrypt runs. Keeps the same screen — no myNoteBackground splash.
 *
 * Stays visible until BOTH crypto finishes and one full GIF cycle completes.
 */
export default function RecordVaultEncryptDecryptVideoOverlay({
  open = false,
  kind = 'encrypt',
  label,
  /** Ignored — lock overlay must not replace the workspace with a splash bg. */
  backdropSx: _backdropSx,
  sx
}) {
  void _backdropSx;
  const openRef = useRef(open);
  const playedThroughRef = useRef(false);
  const sessionIdRef = useRef(0);
  const [visible, setVisible] = useState(false);
  const [sessionId, setSessionId] = useState(0);
  const ariaLabel =
    label || (kind === 'decrypt' ? 'Decrypting note' : 'Encrypting note');

  openRef.current = open;

  const markPlayedThrough = () => {
    if (playedThroughRef.current) return;
    playedThroughRef.current = true;
    if (!openRef.current) {
      setVisible(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    playedThroughRef.current = false;
    sessionIdRef.current += 1;
    setSessionId(sessionIdRef.current);
    setVisible(true);
  }, [open, kind]);

  useEffect(() => {
    if (!visible || !sessionId) return undefined;
    const timerId = window.setTimeout(() => {
      markPlayedThrough();
    }, LOCK_GIF_CYCLE_MS);
    return () => window.clearTimeout(timerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sessionId]);

  useEffect(() => {
    if (open || !visible) return;
    if (playedThroughRef.current) {
      setVisible(false);
    }
  }, [open, visible]);

  if (!visible || typeof document === 'undefined') return null;

  return createPortal(
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: BUSY_HOURGLASS_OVERLAY_Z_INDEX,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Block clicks while crypto runs, but keep TutaNotes UI visible underneath.
        pointerEvents: 'all',
        cursor: 'wait',
        bgcolor: 'transparent',
        ...(sx || null)
      }}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <Box
        component="img"
        key={`${kind}-${sessionId}`}
        src={`${lockGifSrc}?s=${sessionId}`}
        alt=""
        aria-hidden
        sx={{
          width: { xs: 'min(72vw, 18rem)', sm: 'min(50vw, 22rem)' },
          maxHeight: { xs: '45vh', sm: '50vh' },
          height: 'auto',
          objectFit: 'contain',
          display: 'block',
          borderRadius: 2,
          border: '4px solid #000',
          boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
          bgcolor: '#fff',
          pointerEvents: 'none'
        }}
      />
    </Box>,
    document.body
  );
}

RecordVaultEncryptDecryptVideoOverlay.propTypes = {
  open: PropTypes.bool,
  kind: PropTypes.oneOf(['encrypt', 'decrypt']),
  label: PropTypes.string,
  backdropSx: PropTypes.object,
  sx: PropTypes.object
};
