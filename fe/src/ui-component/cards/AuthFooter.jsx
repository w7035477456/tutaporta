// material-ui
import { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';

import { getAuthFooterHeightVh } from 'config/authFooterEnv';
import { siteFooterTextFontSize } from 'config/footerFontEnv';
import { SITE_FOOTER_DEFAULT_BG } from 'config/siteFooterEnv';
import SiteFooterCopyright from 'ui-component/SiteFooterCopyright';

// ==============================|| FOOTER - AUTHENTICATION 2 & 3 ||============================== //

const footerHeightVh = getAuthFooterHeightVh();

export default function AuthFooter() {
  const [internalIp, setInternalIp] = useState('');

  const linkSx = {
    fontSize: siteFooterTextFontSize,
    color: 'var(--theme-white-color)',
    textDecoration: 'none',
    '&:hover': { textDecoration: 'underline' }
  };

  useEffect(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (!origin) return;
    fetch(`${origin}/api/serverInfo`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        if (data?.internalIp) setInternalIp(data.internalIp);
      })
      .catch(() => {});
  }, []);

  return (
    <Box
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1200,
        width: '100%',
        height: `${footerHeightVh}vh`,
        minHeight: `${footerHeightVh}vh`,
        maxHeight: `${footerHeightVh}vh`,
        boxSizing: 'border-box',
        overflowX: 'hidden',
        overflowY: 'auto',
        bgcolor: SITE_FOOTER_DEFAULT_BG,
        color: 'var(--theme-white-color)',
        px: { xs: 1, sm: 2 },
        py: 0.5,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}
    >
      <Stack spacing={0.5} sx={{ alignItems: 'center', textAlign: 'center', flexShrink: 0 }}>
        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center" flexWrap="wrap" useFlexGap>
          <Typography component={RouterLink} to="/pages/aboutUs" variant="subtitle2" sx={linkSx}>
            About us
          </Typography>
          <Typography variant="subtitle2" sx={{ fontSize: siteFooterTextFontSize, color: 'var(--theme-white-color)' }}>
            |
          </Typography>
          <Typography component={RouterLink} to="/pages/termsAndConditions" variant="subtitle2" sx={linkSx}>
            Terms &amp; Conditions
          </Typography>
          <Typography variant="subtitle2" sx={{ fontSize: siteFooterTextFontSize, color: 'var(--theme-white-color)' }}>
            |
          </Typography>
          <Typography component={RouterLink} to="/pages/privacyPolicy" variant="subtitle2" sx={linkSx}>
            Privacy Policy
          </Typography>
        </Stack>
        <SiteFooterCopyright version="v1" />
        {internalIp && (
          <Box sx={{ alignSelf: 'flex-start', mt: 0.5 }}>
            <Typography variant="caption" sx={{ fontSize: siteFooterTextFontSize, color: 'var(--theme-white-color)' }}>
              {internalIp}
            </Typography>
          </Box>
        )}
      </Stack>
    </Box>
  );
}
