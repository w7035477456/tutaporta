import { useState } from 'react';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

import {
  clearHomeInstallPrompt,
  getHomeInstallPrompt,
  isIosDevice,
  isStandaloneHomeButton
} from 'utils/homeButtonInstall';

const IOS_STEPS = 'On iPhone, tap Share, then "Add to Home Screen".';
const ANDROID_STEPS = 'Open the Chrome menu (⋮) and choose "Add to Home screen".';

const buttonSx = {
  bgcolor: '#FFD600',
  color: '#000000',
  border: '2px solid #000000',
  borderRadius: '8px',
  px: 2,
  py: 0.5,
  fontWeight: 700,
  fontSize: '0.9rem',
  lineHeight: 1.15,
  textAlign: 'center',
  whiteSpace: 'pre-line',
  '&:hover': { bgcolor: '#FFE449' }
};

/** Mobile-only "Add to Home Screen" shortcut button; hidden on desktop and inside the installed app. */
export default function CreateHomeShortcutButton() {
  const [standalone] = useState(() => isStandaloneHomeButton());
  const [message, setMessage] = useState('');

  if (standalone) return null;

  const onClick = async () => {
    const promptEvent = getHomeInstallPrompt();
    if (!promptEvent) {
      setMessage(isIosDevice() ? IOS_STEPS : ANDROID_STEPS);
      return;
    }
    try {
      promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      clearHomeInstallPrompt();
      setMessage(choice?.outcome === 'accepted' ? 'Shortcut added to your Home Screen.' : '');
    } catch {
      clearHomeInstallPrompt();
      setMessage(ANDROID_STEPS);
    }
  };

  return (
    <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
      <ButtonBase type="button" onClick={onClick} sx={buttonSx}>
        {'Create Home\nShort Cut'}
      </ButtonBase>
      {message ? (
        <Typography role="status" sx={{ color: '#FFFF00', fontSize: '0.85rem', textAlign: 'center', px: 1 }}>
          {message}
        </Typography>
      ) : null}
    </Box>
  );
}
