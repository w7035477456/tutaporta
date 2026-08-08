import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import { useAuth } from 'contexts/AuthContext';
import { isImpersonationSession, isToolsOnlyAdminSession } from 'utils/adminSession';

/** Tools-only admin sticky notice. Impersonation uses red header banner instead. */
export default function AdminImpersonationBanner() {
  const { user } = useAuth();

  if (isImpersonationSession(user)) return null;

  if (isToolsOnlyAdminSession(user)) {
    return (
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1200,
          px: { xs: 1, sm: 2 },
          pt: 1,
          pb: 0.5
        }}
      >
        <Alert severity="warning" variant="filled" sx={{ fontWeight: 600 }}>
          Admin Mode: Tools access only.
        </Alert>
      </Box>
    );
  }

  return null;
}
