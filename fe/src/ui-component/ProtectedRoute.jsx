import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isToolsOnlyAdminSession } from '../utils/adminSession';
import { isToolsOnlyAdminAllowedPath } from '../utils/toolsNavSession';
import { ADMIN_TOOLS_PATH } from '../constants/adminToolsRoute';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

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

  if (isToolsOnlyAdminSession(user) && !isToolsOnlyAdminAllowedPath(location.pathname)) {
    return <Navigate to={ADMIN_TOOLS_PATH} replace />;
  }

  return children;
};

export default ProtectedRoute;
