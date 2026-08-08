import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

import onlineFlowersImg from 'assets/images/onlineFlowers.png';

export default function EMarketPlaceLanding() {
  return (
    <Box
      sx={{
        minHeight: '100%',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 4
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 720,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2.5
        }}
      >
        <Typography
          variant="h2"
          sx={{
            textAlign: 'center',
            color: 'var(--theme-primary-color)',
            fontWeight: 700
          }}
        >
          Online MarketPlace
        </Typography>

        <ButtonBase
          component={Link}
          to="/eMarketPlace/flowerShop"
          aria-label="Open Flower Shop"
          sx={{
            width: { xs: 230, sm: 300 },
            borderRadius: 5,
            overflow: 'hidden',
            border: '3px solid var(--theme-primary-color)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            transition: 'transform 0.2s ease',
            '&:hover': { transform: 'scale(1.03)' },
            '&:focus-visible': {
              outline: '3px solid var(--theme-error-color)',
              outlineOffset: '3px'
            }
          }}
        >
          <Box component="img" src={onlineFlowersImg} alt="Flowers" sx={{ width: '100%', height: 'auto', display: 'block' }} />
        </ButtonBase>
      </Box>
    </Box>
  );
}
