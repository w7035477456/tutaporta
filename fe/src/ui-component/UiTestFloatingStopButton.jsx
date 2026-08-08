import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import { buttonFontSizeResponsive } from 'config/buttonFontEnv';
import { adminToolsPathWithTab, ADMIN_TOOLS_TEST_TAB } from 'constants/adminToolsRoute';
import { useUiTestRecording } from 'contexts/UiTestRecordingContext';

/** Top-center Stop while a UI test replay is running (any route). */
export default function UiTestFloatingStopButton() {
  const navigate = useNavigate();
  const { isRunning, runningTestNumber, finishRun } = useUiTestRecording();
  const [busy, setBusy] = useState(false);

  const handleStop = useCallback(async () => {
    if (!isRunning || busy) return;
    setBusy(true);
    try {
      await finishRun?.();
      navigate(adminToolsPathWithTab(ADMIN_TOOLS_TEST_TAB), { replace: false });
    } catch {
      navigate(adminToolsPathWithTab(ADMIN_TOOLS_TEST_TAB), { replace: false });
    } finally {
      setBusy(false);
    }
  }, [busy, finishRun, isRunning, navigate]);

  if (!isRunning) return null;

  return (
    <Box
      data-ui-test-ignore
      sx={{
        position: 'fixed',
        top: { xs: 52, sm: 56 },
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10050,
        pointerEvents: 'auto'
      }}
    >
      <Box
        component="button"
        type="button"
        disabled={busy}
        aria-label={
          runningTestNumber != null
            ? `Stop UI test replay ${runningTestNumber}`
            : 'Stop UI test replay'
        }
        onClick={() => void handleStop()}
        sx={{
          borderRadius: 999,
          border: '3px solid #000000',
          bgcolor: '#c62828',
          color: '#ffffff',
          fontWeight: 800,
          fontSize: buttonFontSizeResponsive,
          textTransform: 'none',
          px: 3,
          py: 0.75,
          minHeight: 44,
          minWidth: 120,
          cursor: busy ? 'wait' : 'pointer',
          boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
          '&:hover': {
            bgcolor: '#b71c1c',
            color: '#ffffff'
          },
          '&:disabled': {
            bgcolor: '#c62828',
            color: '#ffffff',
            opacity: 0.85
          }
        }}
      >
        Stop{runningTestNumber != null ? ` ${runningTestNumber}` : ''}
      </Box>
    </Box>
  );
}
