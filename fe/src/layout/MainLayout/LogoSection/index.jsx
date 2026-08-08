import { Link as RouterLink, useLocation } from 'react-router-dom';

// material-ui
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project imports
import { DASHBOARD_PATH } from 'config';
import Logo from 'ui-component/Logo';

// ==============================|| MAIN LOGO ||============================== //

export default function LogoSection() {
  const { pathname } = useLocation();

  const isUnderConstructionMallSection =
    pathname === '/onlineProfessionals' ||
    pathname === '/eClassifieds' ||
    pathname === '/eServices';

  const isMallLanding = pathname === '/' || pathname === '/landing' || pathname === '/mall';

  if (isUnderConstructionMallSection) {
    return (
      <Link component={RouterLink} to={DASHBOARD_PATH} aria-label="under-construction-logo" underline="none">
        <Box
          sx={{
            px: 1,
            py: 0.5
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'secondary.main', whiteSpace: 'nowrap' }}>
            Under Construction
          </Typography>
        </Box>
      </Link>
    );
  }

  if (isMallLanding) {
    return (
      <Box
        sx={{
          px: 1,
          py: 0.5
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'secondary.main', whiteSpace: 'nowrap' }}>
          OnlineMall.website
        </Typography>
      </Box>
    );
  }

  return (
    <Link component={RouterLink} to={DASHBOARD_PATH} aria-label="theme-logo">
      <Logo width={120} />
    </Link>
  );
}
