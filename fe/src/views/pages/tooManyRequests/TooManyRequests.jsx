import Box from '@mui/material/Box';

import tooManyRequestErrorImg from 'assets/images/tooManyRequestError.png';
import RateLimit429Countdown from 'ui-component/RateLimit429Countdown';

// ================================|| TOO MANY REQUESTS PAGE ||================================ //

export default function TooManyRequests() {
  return (
    <Box
      sx={{
        width: '100vw',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.paper',
        p: 0,
        m: 0,
        overflow: 'auto',
        position: 'relative'
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <Box
          component="img"
          src={tooManyRequestErrorImg}
          alt="Too many requests"
          sx={{
            maxWidth: '100%',
            maxHeight: '100vh',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain'
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            top: '44%',
            transform: 'translate(-50%, -50%)',
            zIndex: 2,
            width: 'min(92vw, 420px)'
          }}
        >
          <RateLimit429Countdown />
        </Box>
      </Box>
    </Box>
  );
}
