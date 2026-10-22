import Box from '@mui/material/Box';
import raffleStepsImg from 'assets/images/raffleSteps.png';

/** Public /rafflesteps — the raffle steps picture, full width (tap to open the original). */
export default function RaffleStepsPage() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'var(--theme-secondary-color)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        px: { xs: 1, sm: 2 },
        py: { xs: 1, sm: 2 },
        boxSizing: 'border-box'
      }}
    >
      <Box
        component="a"
        href={raffleStepsImg}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ display: 'block', maxWidth: 1100, width: '100%' }}
      >
        <Box component="img" src={raffleStepsImg} alt="Raffle steps" sx={{ display: 'block', width: '100%', height: 'auto' }} />
      </Box>
    </Box>
  );
}
