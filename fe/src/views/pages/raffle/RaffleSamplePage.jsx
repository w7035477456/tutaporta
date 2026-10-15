import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { RAFFLE_PATH } from 'constants/raffleRoute';

export const RAFFLE_SAMPLE_IMAGE_SRC = '/raffleimage.jpg';

/** Public sample of a Get My Raffle screenshot (what to bring to the Meetup). */
export default function RaffleSamplePage() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'var(--theme-secondary-color)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        px: 2,
        py: 3,
        boxSizing: 'border-box'
      }}
    >
      <Typography variant="h3" sx={{ fontWeight: 800, color: 'var(--theme-primary-color)', textAlign: 'center' }}>
        Sample Raffle Screenshot
      </Typography>
      <Typography sx={{ textAlign: 'center', fontWeight: 600, maxWidth: 720 }}>
        Your screenshot should show the raffle number, verification code, event and QR code like this.{' '}
        <Box component={Link} to={RAFFLE_PATH} sx={{ color: 'var(--theme-primary-color)', fontWeight: 800 }}>
          How to enter the raffle
        </Box>
      </Typography>
      <Box
        component="a"
        href={RAFFLE_SAMPLE_IMAGE_SRC}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ display: 'block', maxWidth: 1100, width: '100%' }}
      >
        <Box
          component="img"
          src={RAFFLE_SAMPLE_IMAGE_SRC}
          alt="Sample Get My Raffle screenshot"
          sx={{ display: 'block', width: '100%', height: 'auto', border: '3px solid var(--theme-primary-color)', borderRadius: 2 }}
        />
      </Box>
    </Box>
  );
}
