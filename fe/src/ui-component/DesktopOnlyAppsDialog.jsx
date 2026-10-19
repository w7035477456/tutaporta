import { useCallback, useEffect, useState } from 'react';
import Typography from '@mui/material/Typography';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import GreenButton from 'ui-component/GreenButton';
import { DESKTOP_ONLY_APPS_EVENT } from 'utils/desktopOnlyApps';

const DESKTOP_ONLY_MESSAGE =
  'TutaDates, TutaNotes, and TutaPhoto currently only support a desktop computer. Their screens are too complex and rich to use on a phone. Please open them on a desktop.';

/**
 * Blocks TutaDates, TutaNotes, and TutaPhoto on a phone.
 * Registration, ID initialization, and raffle stay available.
 */
export default function DesktopOnlyAppsDialog() {
  const [open, setOpen] = useState(false);
  const [appName, setAppName] = useState('');

  useEffect(() => {
    const onRequest = (event) => {
      setAppName(String(event?.detail?.appName || '').trim());
      setOpen(true);
    };
    window.addEventListener(DESKTOP_ONLY_APPS_EVENT, onRequest);
    return () => window.removeEventListener(DESKTOP_ONLY_APPS_EVENT, onRequest);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={close}
      closeOnBackdrop
      closeButtonAriaLabel="Close desktop-only notice"
      maxWidth="min(96vw, 440px)"
      centerInWindow
    >
      <ColorTemplate7PopupLargeDark.Title>
        {appName ? `${appName} needs a desktop` : 'Desktop only'}
      </ColorTemplate7PopupLargeDark.Title>
      <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
        <Typography variant="body1" sx={{ textAlign: 'center', lineHeight: 1.45 }}>
          {DESKTOP_ONLY_MESSAGE}
        </Typography>
        <GreenButton type="button" onClick={close} sx={{ width: '100%', mt: 1 }}>
          OK
        </GreenButton>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}
