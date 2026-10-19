import { useEffect, useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import ColorTemplate13DisableGreenButton from 'ui-component/ColorTemplate13DisableGreenButton';
import {
  clearHomeInstallPrompt,
  getHomeInstallPrompt,
  isIosDevice,
  isStandaloneHomeButton,
  subscribeHomeInstallPrompt
} from 'utils/homeButtonInstall';

const IOS_STEPS = 'On iPhone, tap Share, then Add to Home Screen. That icon opens tutamall.com.';
const WAITING_STEPS =
  'Chrome has not offered install yet. Stay on this page for about half a minute, then tap again. You can also open the Chrome menu and choose Install app or Add to Home screen.';

export default function MobileHomeButtonPage() {
  const [installReady, setInstallReady] = useState(() => Boolean(getHomeInstallPrompt()));
  const [message, setMessage] = useState('');

  useEffect(() => {
    document.title = 'Make Home Button';
    return subscribeHomeInstallPrompt((promptEvent) => {
      setInstallReady(Boolean(promptEvent));
    });
  }, []);

  const onMakeHomeButton = async () => {
    if (isStandaloneHomeButton()) {
      window.location.assign('/');
      return;
    }

    const promptEvent = getHomeInstallPrompt();
    if (!promptEvent) {
      setMessage(isIosDevice() ? IOS_STEPS : WAITING_STEPS);
      return;
    }

    try {
      promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      clearHomeInstallPrompt();
      if (choice?.outcome === 'accepted') {
        setMessage('Home button added. It opens tutamall.com.');
        return;
      }
      setMessage('Home button was not added.');
    } catch {
      clearHomeInstallPrompt();
      setMessage(WAITING_STEPS);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 4,
        bgcolor: '#000000',
        color: '#ffffff'
      }}
    >
      <Stack spacing={3} sx={{ width: '100%', maxWidth: 420, alignItems: 'center', textAlign: 'center' }}>
        <Box
          component="img"
          src="/home-button-icon-192.png"
          alt="TutaMall"
          sx={{ width: 96, height: 96, borderRadius: 2 }}
        />
        <Typography component="h1" sx={{ fontSize: '1.75rem', fontWeight: 700, color: '#ffffff' }}>
          TutaMall
        </Typography>
        <Typography sx={{ color: '#ffffff', fontSize: '1.05rem' }}>
          Adds an icon on this phone. The icon opens tutamall.com.
        </Typography>
        <ColorTemplate13DisableGreenButton
          type="button"
          onClick={onMakeHomeButton}
          aria-describedby="make-home-button-status"
          sx={{ minHeight: 56, px: 3 }}
        >
          Make Home Button
        </ColorTemplate13DisableGreenButton>
        <Typography id="make-home-button-status" role="status" sx={{ color: '#ffffff', minHeight: '3rem', fontSize: '1rem' }}>
          {message || (installReady ? 'Ready. Tap Make Home Button.' : '')}
        </Typography>
      </Stack>
    </Box>
  );
}
