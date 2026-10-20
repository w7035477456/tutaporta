import { useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import ColorTemplate13DisableGreenButton from 'ui-component/ColorTemplate13DisableGreenButton';
import { isIosDevice } from 'utils/homeButtonInstall';

const PUBLIC_ORIGIN = 'https://tutamall.com';

function mobileInstallUrl() {
  const { hostname, origin } = window.location;
  const isLocal = hostname === 'localhost' || hostname === '[::1]' || /^127\./.test(hostname) || /^192\.168\./.test(hostname);
  return `${isLocal ? PUBLIC_ORIGIN : origin}/mobile`;
}

function isPhone() {
  return isIosDevice() || /android/i.test(navigator.userAgent || '');
}

export default function InstallQrPage() {
  const qrWrapRef = useRef(null);
  const url = mobileInstallUrl();

  useEffect(() => {
    document.title = 'Install TutaMall';
    if (isPhone()) window.location.replace('/mobile');
  }, []);

  const onDownload = () => {
    const canvas = qrWrapRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'tutamall-install-qr.png';
    link.click();
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
      <Stack spacing={3} sx={{ width: '100%', maxWidth: 520, alignItems: 'center', textAlign: 'center' }}>
        <Typography component="h1" sx={{ fontSize: '2rem', fontWeight: 700, color: '#ffffff' }}>
          Get TutaMall on your phone
        </Typography>
        <Typography sx={{ color: '#ffffff', fontSize: '1.1rem' }}>
          Point your phone camera at this code, open the link, then tap Make Home Button.
        </Typography>
        <Box ref={qrWrapRef} sx={{ bgcolor: '#ffffff', p: 2, borderRadius: 2, lineHeight: 0 }}>
          <QRCodeCanvas
            value={url}
            size={1024}
            level="M"
            marginSize={4}
            style={{ width: 320, height: 320 }}
            aria-label="QR code to install TutaMall on your phone"
          />
        </Box>
        <Typography sx={{ color: '#ffffff', fontSize: '1rem', wordBreak: 'break-all' }}>{url}</Typography>
        <ColorTemplate13DisableGreenButton type="button" onClick={onDownload} sx={{ minHeight: 48, px: 3 }}>
          Download QR Image
        </ColorTemplate13DisableGreenButton>
      </Stack>
    </Box>
  );
}
