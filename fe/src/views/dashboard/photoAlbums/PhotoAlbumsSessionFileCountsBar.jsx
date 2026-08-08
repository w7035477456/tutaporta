import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { fetchPhotoAlbumsSessionFileCounts } from 'api/photoAlbumsFe';

const barFontSx = {
  fontFamily: MAIN_FONT_FAMILY,
  fontSize: { xs: '0.72rem !important', sm: '0.82rem !important', md: '0.9rem !important' },
  lineHeight: 1.35,
  fontWeight: 700,
  color: '#fff',
  WebkitTextFillColor: '#fff',
  whiteSpace: 'nowrap'
};

/**
 * Last vault-session Usb/ui tx/rx counts (Postgres) — shown on Cloud/USB login gates
 * after logoff until the next unlock starts a fresh session.
 */
export default function PhotoAlbumsSessionFileCountsBar({ refreshToken = 0 }) {
  const [usbTxRx, setUsbTxRx] = useState(0);
  const [uiTxRx, setUiTxRx] = useState(0);

  const load = useCallback(async () => {
    try {
      const counts = await fetchPhotoAlbumsSessionFileCounts();
      setUsbTxRx(Math.max(0, Math.trunc(Number(counts?.usbTxRx) || 0)));
      setUiTxRx(Math.max(0, Math.trunc(Number(counts?.uiTxRx) || 0)));
    } catch {
      // Keep last known values on transient errors.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  return (
    <Box
      sx={{
        flexShrink: 0,
        width: '100%',
        bgcolor: '#000',
        borderTop: '2px solid #000',
        px: { xs: 1, md: 1.5 },
        py: 0.55,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 1,
        minWidth: 0
      }}
    >
      <Typography
        component="span"
        sx={barFontSx}
        title="Last session file transfer counts (kept after logoff; reset when you open Cloud or USB again)"
      >
        Usb tx/rx={usbTxRx}, ui tx/rx={uiTxRx}
      </Typography>
    </Box>
  );
}

PhotoAlbumsSessionFileCountsBar.propTypes = {
  refreshToken: PropTypes.number
};
