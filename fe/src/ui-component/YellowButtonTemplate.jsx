import PropTypes from 'prop-types';
import Button from '@mui/material/Button';
import {
  YELLOW_BUTTON_TEMPLATE_HOVER_SCALE,
  yellowButtonTemplateSx
} from 'config/yellowButtonTemplate';

/**
 * Yellow action button (#FBDF1B bg, black text, thin black border).
 * Hover: label text magnifies per fe/.env HOVER_MAGNIFY_FACTOR (button box unchanged).
 *
 * Usage:
 *   <YellowButtonTemplate onClick={...}>Save</YellowButtonTemplate>
 */
export default function YellowButtonTemplate({
  hoverScale = YELLOW_BUTTON_TEMPLATE_HOVER_SCALE,
  templateBg,
  templateText,
  templateBorder,
  sx,
  children,
  ...rest
}) {
  const mergedSx = (theme) => {
    const base = yellowButtonTemplateSx({
      hoverScale,
      ...(templateBg != null ? { bg: templateBg } : null),
      ...(templateText != null ? { text: templateText } : null),
      ...(templateBorder != null ? { border: templateBorder } : null)
    });
    const extra = typeof sx === 'function' ? sx(theme) : sx || {};
    return { ...base, ...extra };
  };

  return (
    <Button {...rest} sx={mergedSx}>
      {children}
    </Button>
  );
}

YellowButtonTemplate.propTypes = {
  hoverScale: PropTypes.number,
  templateBg: PropTypes.string,
  templateText: PropTypes.string,
  templateBorder: PropTypes.string,
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  children: PropTypes.node
};

YellowButtonTemplate.sx = yellowButtonTemplateSx;
