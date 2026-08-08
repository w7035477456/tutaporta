import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { bsizeFontSizeResponsive } from 'config/bsizeEnv';
import { useAuth } from 'contexts/AuthContext';
import { isDemoUserCategory } from 'utils/memberCategory';

/** Yellow center-top badge when logged in as DemoUser — shown on all MainLayout pages. */
export default function DemoOnlyModeBanner() {
  const { user } = useAuth();
  if (!isDemoUserCategory(user?.member_category)) return null;

  return (
    <Box
      role="status"
      aria-label="Demo Only Mode"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#ffff00',
        border: '2px solid #000000',
        borderRadius: '4px',
        px: 1.5,
        py: 0.35,
        pointerEvents: 'none',
        maxWidth: '100%'
      }}
    >
      <Typography
        component="span"
        sx={{
          color: '#ff0000',
          WebkitTextFillColor: '#ff0000',
          fontWeight: 800,
          fontSize: bsizeFontSizeResponsive,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          letterSpacing: '0.02em',
          // Black outline on red text (mockup)
          WebkitTextStroke: '0.6px #000000',
          textShadow:
            '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 1px #000'
        }}
      >
        Demo Only Mode
      </Typography>
    </Box>
  );
}
