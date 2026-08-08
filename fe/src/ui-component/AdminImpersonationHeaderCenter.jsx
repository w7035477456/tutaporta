import { useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { bsizeFontSizeResponsive } from 'config/bsizeEnv';
import { ADMIN_TOOLS_PATH } from 'constants/adminToolsRoute';
import { useAuth } from 'contexts/AuthContext';
import GreenButton from 'ui-component/GreenButton';

/** Centered admin impersonation line in the fixed app header / top banner. */
export default function AdminImpersonationHeaderCenter({ label }) {
  const { returnToAdmin } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleReturnAdmin = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await returnToAdmin();
      if (typeof window !== 'undefined') {
        window.location.assign(ADMIN_TOOLS_PATH);
        return;
      }
    } catch (err) {
      console.error('[AdminImpersonationHeaderCenter] Return Admin failed', err?.message ?? err);
      setBusy(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.25,
        flexWrap: 'wrap',
        pointerEvents: 'auto',
        maxWidth: '100%'
      }}
    >
      <Typography
        component="div"
        sx={{
          color: '#000000',
          WebkitTextFillColor: '#000000',
          fontWeight: 700,
          fontSize: bsizeFontSizeResponsive,
          lineHeight: 1.2,
          textAlign: 'center',
          whiteSpace: 'nowrap'
        }}
      >
        Admin Mode: You are currently impersonating {label}.
      </Typography>
      <GreenButton
        type="button"
        disabled={busy}
        onClick={() => void handleReturnAdmin()}
        sx={{
          pointerEvents: 'auto',
          flexShrink: 0,
          minHeight: 32,
          py: 0.35,
          px: 1.5,
          borderRadius: '999px',
          fontWeight: 800,
          whiteSpace: 'nowrap'
        }}
      >
        {busy ? 'Returning…' : 'Return Admin'}
      </GreenButton>
    </Box>
  );
}

AdminImpersonationHeaderCenter.propTypes = {
  label: PropTypes.string.isRequired
};
