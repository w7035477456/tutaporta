import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import router from 'routes';
import { RAFFLE_HOST_PATH, RAFFLE_PATH } from 'constants/raffleRoute';

/** Fixed on every theme: red label, white button, blue box. */
const PANEL_BLUE = '#1e88e5';
const BUTTON_WHITE = '#ffffff';
const LABEL_RED = '#d50000';
const HIDDEN_PATHS = [RAFFLE_PATH, RAFFLE_HOST_PATH];

/**
 * Floating top-center "Get My Raffle Ticket" (red label, white button, blue box) on every screen.
 * Opens the TutaMall Meetup Raffle quick guide. Mounted outside RouterProvider, so it uses `router` directly.
 */
export default function GetMyRaffleTicketFloatingButton() {
  const [pathname, setPathname] = useState(() => router.state.location.pathname);

  useEffect(() => router.subscribe((state) => setPathname(state.location.pathname)), []);

  if (HIDDEN_PATHS.some((p) => pathname.toLowerCase() === p.toLowerCase())) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 6,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1250,
        bgcolor: PANEL_BLUE,
        border: '3px solid #111',
        borderRadius: 2,
        px: 1,
        py: 0.5,
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)'
      }}
    >
      <Box
        component="button"
        type="button"
        data-guest-demo-allow="true"
        onClick={() => void router.navigate(RAFFLE_PATH)}
        sx={{
          '&&&': {
            display: 'block',
            m: 0,
            px: 2,
            py: 0.5,
            whiteSpace: 'nowrap',
            fontFamily: 'inherit',
            fontWeight: 800,
            fontSize: { xs: '0.95rem', sm: '1.05rem' },
            lineHeight: 1.4,
            cursor: 'pointer',
            backgroundColor: `${BUTTON_WHITE} !important`,
            backgroundImage: 'none !important',
            color: `${LABEL_RED} !important`,
            WebkitTextFillColor: `${LABEL_RED} !important`,
            border: '1px solid #000 !important',
            borderRadius: '8px',
            transition: 'transform 120ms ease'
          },
          '&&&:hover': {
            backgroundColor: `${BUTTON_WHITE} !important`,
            color: `${LABEL_RED} !important`,
            transform: 'scale(1.08)'
          }
        }}
      >
        Get My Raffle Ticket
      </Box>
    </Box>
  );
}
