import { useLocation } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { LANDSCAPE_PATHS } from 'hooks/useRouteOrientationLock';

/** Sub-lg vetting routes: bell + profile + orientation live in one fixed top-right cluster */
export default function useVettingMobileTopCluster() {
  const { pathname } = useLocation();
  const theme = useTheme();
  const downLG = useMediaQuery(theme.breakpoints.down('lg'));
  return downLG && LANDSCAPE_PATHS.has(pathname);
}
