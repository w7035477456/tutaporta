import { useRef } from 'react';
import PropTypes from 'prop-types';
import { QRCodeCanvas } from 'qrcode.react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import YellowButtonTemplate from 'ui-component/YellowButtonTemplate';

const PUBLIC_ORIGIN = 'https://tutamall.com';

/** Local dev hosts point the QR at production so a phone can actually open it. */
export function mobileInstallUrl() {
  const { hostname, origin } = window.location;
  const isLocal = hostname === 'localhost' || hostname === '[::1]' || /^127\./.test(hostname) || /^192\.168\./.test(hostname);
  return `${isLocal ? PUBLIC_ORIGIN : origin}/mobile`;
}

/** QR code that sends a phone to /mobile (Make Home Button). Used by /install and the login page. */
export default function InstallQrCard({ compact = false }) {
  const qrWrapRef = useRef(null);
  const url = mobileInstallUrl();
  const qrPx = compact ? 140 : 320;

  const onDownload = () => {
    const canvas = qrWrapRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'tutamall-install-qr.png';
    link.click();
  };

  return (
    <Stack spacing={compact ? 1 : 3} sx={{ width: '100%', alignItems: 'center', textAlign: 'center', color: '#ffffff' }}>
      <Typography
        component={compact ? 'h2' : 'h1'}
        sx={{ fontSize: compact ? '1rem' : '2rem', fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }}
      >
        Get TutaMall Shortcut onto your phone Home Screen
      </Typography>
      <Typography sx={{ color: '#ffffff', fontSize: compact ? '0.72rem' : '1.1rem', lineHeight: 1.35 }}>
        Point your phone camera at this code, open the link, then tap Make Home Button.
      </Typography>
      <Box ref={qrWrapRef} sx={{ bgcolor: '#ffffff', p: compact ? 1 : 2, borderRadius: 2, lineHeight: 0 }}>
        <QRCodeCanvas
          value={url}
          size={1024}
          level="M"
          marginSize={4}
          style={{ width: qrPx, height: qrPx }}
          aria-label="QR code to install TutaMall on your phone"
        />
      </Box>
      <Typography sx={{ color: '#ffffff', fontSize: compact ? '0.65rem' : '1rem', wordBreak: 'break-all' }}>{url}</Typography>
      <YellowButtonTemplate
        type="button"
        onClick={onDownload}
        sx={
          compact
            ? {
                minHeight: 32,
                px: 1.5,
                py: 0.5,
                whiteSpace: 'nowrap',
                '&&.MuiButton-root': { fontSize: '0.85rem !important' }
              }
            : { minHeight: 48, px: 3 }
        }
      >
        Download QR Image
      </YellowButtonTemplate>
    </Stack>
  );
}

InstallQrCard.propTypes = {
  compact: PropTypes.bool
};
