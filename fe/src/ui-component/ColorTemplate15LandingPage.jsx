import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import { colorTemplate15LandingPageSx } from 'config/colorTemplate15LandingPage';

/**
 * ColorTemplate15LandingPage — blank landing panel for sidebar menu pages.
 *
 * Wrap page content (MainCard, layouts, etc.) so desktop width fills region 7
 * (sidebar → right edge). Mobile keeps existing full-width behavior.
 *
 * Usage:
 *   <ColorTemplate15LandingPage>
 *     <MainCard>...</MainCard>
 *   </ColorTemplate15LandingPage>
 */
export default function ColorTemplate15LandingPage({ children, sx }) {
  const theme = useTheme();
  const mergedSx = (t) => {
    const base = colorTemplate15LandingPageSx(t);
    const extra = typeof sx === 'function' ? sx(t) : sx || {};
    return { ...base, ...extra };
  };

  return (
    <Box sx={mergedSx} data-color-template="ColorTemplate15LandingPage">
      {children}
    </Box>
  );
}

ColorTemplate15LandingPage.propTypes = {
  children: PropTypes.node,
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.func])
};

ColorTemplate15LandingPage.sx = colorTemplate15LandingPageSx;
