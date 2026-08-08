import PropTypes from 'prop-types';
import Button from '@mui/material/Button';
import { colorTemplate1ButtonSx, colorTemplate1WallColorByTheme } from 'config/colorTemplate1';

/**
 * Reusable Button with menu-identical color template.
 * Usage:
 *   <ColorTemplate1Button selected>...</ColorTemplate1Button>
 */
export default function ColorTemplate1Button({ selected = false, hoverScale = null, wallColor, sx, children, ...rest }) {
  const mergedSx = (theme) => {
    const autoWallColor = colorTemplate1WallColorByTheme(theme);
    const resolvedWallColor = String(wallColor ?? '').trim() || autoWallColor;
    const baseSx = {
      ...colorTemplate1ButtonSx({ selected, hoverScale }),
      '--color-template1-wall-color': resolvedWallColor
    };
    const sxValue = typeof sx === 'function' ? sx(theme) : sx || {};
    return { ...baseSx, ...sxValue };
  };

  return (
    <Button {...rest} sx={mergedSx}>
      {children}
    </Button>
  );
}

ColorTemplate1Button.propTypes = {
  selected: PropTypes.bool,
  hoverScale: PropTypes.number,
  wallColor: PropTypes.string,
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  children: PropTypes.node
};

