import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import welcomeMall from 'assets/images/welcomeMall.png';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';

// ==============================|| SERVICE NOTICE MODAL ||============================== //

const defaultMessage = (
  <>
    <strong>Service Notice:</strong> We apologize for the inconvenience, but our servers are currently
    offline. Our technical team is actively working to restore service. Please try accessing the servers
    again shortly. (E3)
  </>
);

export default function ServiceNoticeModal({ onExit, errorCode, message }) {
  const handleExit = () => {
    if (typeof onExit === 'function') {
      onExit();
    } else {
      window.close();
    }
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'grey.100',
        zIndex: 9999
      }}
    >
      <Box
        sx={{
          maxWidth: 840,
          width: 'min(92vw, 840px)',
          backgroundColor: 'background.paper',
          borderRadius: 2,
          boxShadow: 2,
          p: { xs: 6, sm: 8 }
        }}
      >
        <Stack alignItems="center" spacing={5}>
          <Box sx={{ mb: 1, width: '100%', maxWidth: '100%' }}>
            <Box
              component="img"
              src={welcomeMall}
              alt="Welcome to our Shopping Mall"
              sx={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </Box>
          {/* <Typography variant="h4" sx={{ color: 'secondary.main', fontWeight: 700 }}>
            Hi, Welcome Back
          </Typography> */}
          <Typography
            sx={{
              fontSize: { xs: '1.25rem', sm: '2rem' },
              lineHeight: 1.6,
              color: 'secondary.dark',
              fontFamily: MAIN_FONT_FAMILY,
              textAlign: 'center'
            }}
          >
            {message || defaultMessage}
          </Typography>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleExit}
            sx={{
              mt: 2,
              px: { xs: 5, sm: 8 },
              py: { xs: 2, sm: 3 },
              fontWeight: 700,
              textTransform: 'uppercase',
              fontSize: { xs: '1.1rem', sm: '2rem' }
            }}
          >
            Exit
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
