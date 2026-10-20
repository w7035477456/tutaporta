import { useEffect } from 'react';

import Box from '@mui/material/Box';

import InstallQrCard from 'ui-component/InstallQrCard';
import { isIosDevice } from 'utils/homeButtonInstall';

function isPhone() {
  return isIosDevice() || /android/i.test(navigator.userAgent || '');
}

export default function InstallQrPage() {
  useEffect(() => {
    document.title = 'Install TutaMall';
    if (isPhone()) window.location.replace('/mobile');
  }, []);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 4,
        bgcolor: '#000000'
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 520 }}>
        <InstallQrCard />
      </Box>
    </Box>
  );
}
