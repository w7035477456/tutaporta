import { useEffect, useState } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

// material-ui
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import {
  forceStaleModuleRecovery,
  isFailedDynamicImportError,
  tryHardReloadOnFailedDynamicImport
} from 'utils/hardReloadOnStaleModule';

// ==============================|| ELEMENT ERROR - COMMON ||============================== //

export default function ErrorBoundary() {
  const error = useRouteError();
  const staleModule = isFailedDynamicImportError(error);
  const [reloadSkipped, setReloadSkipped] = useState(false);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!staleModule) return undefined;
    const started = tryHardReloadOnFailedDynamicImport(error);
    if (!started) setReloadSkipped(true);
    return undefined;
  }, [error, staleModule]);

  if (staleModule && !reloadSkipped) {
    return null;
  }

  if (staleModule) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" sx={{ mb: 1.5 }}>
          This page failed to load after a code update. Click Reload below (clears cached modules).
        </Alert>
        <Button
          variant="contained"
          disabled={recovering}
          onClick={() => {
            setRecovering(true);
            void forceStaleModuleRecovery();
          }}
        >
          {recovering ? 'Reloading…' : 'Reload page'}
        </Button>
      </Box>
    );
  }

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return <Alert severity="error">Error 404 - This page doesn't exist!</Alert>;
    }

    if (error.status === 401) {
      return <Alert severity="error">Error 401 - You aren't authorized to see this</Alert>;
    }

    if (error.status === 503) {
      return <Alert severity="error">Error 503 - Looks like our API is down</Alert>;
    }

    if (error.status === 418) {
      return <Alert severity="error">Error 418 - Contact administrator</Alert>;
    }
  }

  return <Alert severity="error">Under Maintenance</Alert>;
}
