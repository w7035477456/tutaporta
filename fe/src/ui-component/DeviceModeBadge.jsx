import useMediaQuery from '@mui/material/useMediaQuery';
import Typography from '@mui/material/Typography';

const DEVICE_BADGE_BREAKPOINT = 700;

export default function DeviceModeBadge() {
  const isMobile = useMediaQuery(`(max-width:${DEVICE_BADGE_BREAKPOINT - 1}px)`);

  return (
    <Typography
      aria-label={isMobile ? 'Mobile mode badge' : 'Browser mode badge'}
      sx={{
        position: 'fixed',
        left: 12,
        bottom: 8,
        zIndex: 1600,
        fontSize: '1.25rem',
        fontWeight: 900,
        lineHeight: 1,
        color: '#ffe600',
        textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
        userSelect: 'none',
        pointerEvents: 'none'
      }}
    >
      {isMobile ? 'M' : 'B'}
    </Typography>
  );
}
