import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isToolsOnlyAdminSession } from '../utils/adminSession';
import { isToolsOnlyAdminAllowedPath } from '../utils/toolsNavSession';
import { ADMIN_TOOLS_PATH, adminToolsPathWithTab, ADMIN_TOOLS_ALL_SINGLES_TAB } from '../constants/adminToolsRoute';
import { fetchRafflePendingPrize, RAFFLE_PRIZE_SUBMITTED_EVENT } from '../api/raffleFe';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';

/** Pages where the raffle panel (with Claim My Raffle Prize) is shown. */
const RAFFLE_PRIZE_HOME_PATHS = new Set(['/mall', '/landing']);

/** Winner with an unclaimed prize → true; re-checked on every page change so it stops once payout is submitted. */
function useRafflePrizePending(enabled, pathname) {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setPending(false);
      return undefined;
    }
    let cancelled = false;
    fetchRafflePendingPrize()
      .then((r) => !cancelled && setPending(r.pending))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled, pathname]);
  useEffect(() => {
    const clear = () => setPending(false);
    window.addEventListener(RAFFLE_PRIZE_SUBMITTED_EVENT, clear);
    return () => window.removeEventListener(RAFFLE_PRIZE_SUBMITTED_EVENT, clear);
  }, []);
  return pending;
}

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const toolsOnlyAdmin = Boolean(user) && isToolsOnlyAdminSession(user);
  const rafflePrizePending = useRafflePrizePending(Boolean(user) && !loading && !toolsOnlyAdmin, location.pathname);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // MainLayout routes (mall, landing, dashboard, …) require a valid session / JWT cookie.
  if (!user) {
    return <Navigate to="/pages/login" state={{ from: location }} replace />;
  }

  if (toolsOnlyAdmin) {
    if (location.pathname === '/allSingles' || location.pathname.startsWith('/allSingles/')) {
      return <Navigate to={adminToolsPathWithTab(ADMIN_TOOLS_ALL_SINGLES_TAB)} replace />;
    }
    if (!isToolsOnlyAdminAllowedPath(location.pathname)) {
      return <Navigate to={ADMIN_TOOLS_PATH} replace />;
    }
  }

  if (rafflePrizePending && !RAFFLE_PRIZE_HOME_PATHS.has(location.pathname)) {
    return <Navigate to="/mall" replace />;
  }

  return children;
};

export default ProtectedRoute;
