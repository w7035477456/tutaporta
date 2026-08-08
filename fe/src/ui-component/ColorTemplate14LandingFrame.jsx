import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import { colorTemplate14LandingFrameSx } from 'config/colorTemplate14LandingFrame';

/**
 * ColorTemplate14LandingFrame — full-width region-7 frame for admin / tools pages.
 *
 * Wrap page content (MainCard, ColorTemplate9TableData, etc.) so desktop width fills
 * the main column (sidebar → right edge). Mobile keeps existing full-width behavior.
 *
 * Usage (usually via MainLayout outlet wrapper):
 *   <ColorTemplate14LandingFrame>
 *     <MainCard>...</MainCard>
 *   </ColorTemplate14LandingFrame>
 */
export default function ColorTemplate14LandingFrame({ children, sx }) {
  const theme = useTheme();
  const mergedSx = (t) => {
    const base = colorTemplate14LandingFrameSx(t);
    const extra = typeof sx === 'function' ? sx(t) : sx || {};
    return { ...base, ...extra };
  };

  return (
    <Box sx={mergedSx} data-color-template="ColorTemplate14LandingFrame">
      {children}
    </Box>
  );
}

ColorTemplate14LandingFrame.propTypes = {
  children: PropTypes.node,
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.func])
};

ColorTemplate14LandingFrame.sx = colorTemplate14LandingFrameSx;
