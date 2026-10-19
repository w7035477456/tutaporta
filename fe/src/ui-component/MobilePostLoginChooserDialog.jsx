import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import GreenButton from 'ui-component/GreenButton';
import { useCompactLoginViewport } from 'config/compactLoginViewport';
import { useAuth } from 'contexts/AuthContext';
import { DEMO_MOBILE_LOGIN_BLOCKED_MESSAGE, isGuestDemoLogin } from 'utils/guestDemoLogin';
import {
  clearMobilePostLoginChooserPending,
  MOBILE_POST_LOGIN_CHOOSER_EVENT,
  peekMobilePostLoginChooserPending
} from 'utils/mobilePostLoginChoice';
import { requestDesktopOnlyAppsNotice } from 'utils/desktopOnlyApps';

const DESKTOP_RECOMMEND_MESSAGE =
  'We currently development mobile verison of TutaDates/TutaNotes/TutaPhotos.  Until it is available, we recommend you use our desktop version, which is much easier and better experience because larger screensize';

const choiceButtonSx = {
  width: '100%',
  maxWidth: '100%',
  minWidth: '0 !important',
  whiteSpace: 'normal',
  lineHeight: 1.25,
  py: 1.25,
  px: 1.5,
  textAlign: 'center'
};

/** Long label — smaller than BSIZE so the full line fits on narrow phones. */
const useAppsButtonSx = {
  ...choiceButtonSx,
  fontSize: { xs: '3.4vw !important', sm: '1.35vw !important' },
  '&.MuiButton-root': {
    fontSize: { xs: '3.4vw !important', sm: '1.35vw !important' }
  },
  '& .MuiButton-label': {
    fontSize: { xs: '3.4vw !important', sm: '1.35vw !important' },
    whiteSpace: 'normal',
    lineHeight: 1.2
  }
};

/**
 * After mobile/compact login: pick upload destination or see desktop recommendation.
 * Mall taps on Tuta Dates / Albums / Notes reopen this chooser on compact viewports.
 * Guest demo ("demo" / guest) never gets mobile upload — desktop-only notice instead.
 */
export default function MobilePostLoginChooserDialog() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isCompact = useCompactLoginViewport();
  const guestDemo = isGuestDemoLogin(user);
  const [open, setOpen] = useState(false);
  const [desktopRecommendOpen, setDesktopRecommendOpen] = useState(false);
  const [demoMobileBlockedOpen, setDemoMobileBlockedOpen] = useState(false);

  const tryOpenChooser = useCallback(() => {
    if (!user || !isCompact) return;
    if (!peekMobilePostLoginChooserPending()) return;
    clearMobilePostLoginChooserPending();
    setOpen(false);
    if (guestDemo) {
      setDemoMobileBlockedOpen(true);
      return;
    }
    requestDesktopOnlyAppsNotice();
  }, [user, isCompact, guestDemo]);

  useEffect(() => {
    tryOpenChooser();
    if (typeof window === 'undefined') return undefined;
    const onRequest = () => tryOpenChooser();
    window.addEventListener(MOBILE_POST_LOGIN_CHOOSER_EVENT, onRequest);
    return () => window.removeEventListener(MOBILE_POST_LOGIN_CHOOSER_EVENT, onRequest);
  }, [tryOpenChooser]);

  const closeChooser = useCallback(() => {
    clearMobilePostLoginChooserPending();
    setOpen(false);
  }, []);

  const blockDesktopApp = useCallback(
    (appName) => {
      if (guestDemo) {
        closeChooser();
        setDemoMobileBlockedOpen(true);
        return;
      }
      closeChooser();
      requestDesktopOnlyAppsNotice(appName);
      navigate('/mall', { replace: true });
    },
    [closeChooser, guestDemo, navigate]
  );

  const closeDesktopRecommend = useCallback(() => {
    setDesktopRecommendOpen(false);
    navigate('/mall', { replace: true });
  }, [navigate]);

  const closeDemoMobileBlocked = useCallback(() => {
    setDemoMobileBlockedOpen(false);
    navigate('/mall', { replace: true });
  }, [navigate]);

  if (!user) return null;

  return (
    <>
      <ColorTemplate7PopupLargeDark
        open={open}
        onClose={closeChooser}
        closeOnBackdrop={false}
        closeButtonAriaLabel="Close mobile choices"
        maxWidth="min(96vw, 420px)"
        centerInWindow
      >
        <ColorTemplate7PopupLargeDark.Title>Mobile upload</ColorTemplate7PopupLargeDark.Title>
        <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
          <Typography variant="body2" sx={{ textAlign: 'center', mb: 0.5 }}>
            Choose where to upload a photo, or continue to the apps.
          </Typography>
          <Stack spacing={1.25} sx={{ width: '100%' }}>
            <GreenButton type="button" onClick={() => blockDesktopApp('TutaNotes')} singleLineLabel={false} sx={choiceButtonSx}>
              TutaNotes
            </GreenButton>
            <GreenButton type="button" onClick={() => blockDesktopApp('TutaPhoto')} singleLineLabel={false} sx={choiceButtonSx}>
              TutaPhoto
            </GreenButton>
            <GreenButton type="button" onClick={() => blockDesktopApp('TutaDates')} singleLineLabel={false} sx={choiceButtonSx}>
              TutaDates
            </GreenButton>
            <GreenButton type="button" onClick={() => blockDesktopApp('')} singleLineLabel={false} sx={useAppsButtonSx}>
              Use TutaDates/TutaNotes/TutaPhotos
            </GreenButton>
          </Stack>
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>

      <ColorTemplate7PopupLargeDark
        open={desktopRecommendOpen}
        onClose={closeDesktopRecommend}
        closeOnBackdrop
        closeButtonAriaLabel="Close desktop recommendation"
        maxWidth="min(96vw, 420px)"
        centerInWindow
      >
        <ColorTemplate7PopupLargeDark.Title>Desktop recommended</ColorTemplate7PopupLargeDark.Title>
        <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', textAlign: 'center' }}>
            {DESKTOP_RECOMMEND_MESSAGE}
          </Typography>
          <GreenButton type="button" onClick={closeDesktopRecommend} sx={{ ...choiceButtonSx, mt: 1 }}>
            OK
          </GreenButton>
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>

      <ColorTemplate7PopupLargeDark
        open={demoMobileBlockedOpen}
        onClose={closeDemoMobileBlocked}
        closeOnBackdrop
        closeButtonAriaLabel="Close demo mobile notice"
        maxWidth="min(96vw, 420px)"
        centerInWindow
      >
        <ColorTemplate7PopupLargeDark.Title>Demo mode</ColorTemplate7PopupLargeDark.Title>
        <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', textAlign: 'center' }}>
            {DEMO_MOBILE_LOGIN_BLOCKED_MESSAGE}
          </Typography>
          <GreenButton type="button" onClick={closeDemoMobileBlocked} sx={{ ...choiceButtonSx, mt: 1 }}>
            OK
          </GreenButton>
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>
    </>
  );
}
