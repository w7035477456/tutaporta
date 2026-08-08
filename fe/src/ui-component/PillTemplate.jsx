import PropTypes from 'prop-types';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import {
  pillTemplateIconSx,
  pillTemplateSx,
  PILL_TEMPLATE_HOVER_SCALE
} from 'config/pillTemplate';

/**
 * Pill-shaped button — same proportions as footer Support (half button font, 2.75em icon).
 * Default colors: primary text/border, secondary background; 1.25× hover scale.
 *
 *   <PillTemplate templateBg="#F75B0B" onClick={...}>
 *     <PillTemplate.Icon src={icon} alt="" />
 *     <PillTemplate.Label>Support</PillTemplate.Label>
 *   </PillTemplate>
 */
export function pillTemplateLabelSx(overrides = {}) {
  return {
    fontWeight: 600,
    lineHeight: 1.1,
    ...overrides
  };
}

export default function PillTemplate({
  hoverScale = PILL_TEMPLATE_HOVER_SCALE,
  templateBg,
  templateText,
  templateBorder,
  fullWidth = false,
  sx,
  children,
  ...rest
}) {
  const mergedSx = (theme) => {
    const base = pillTemplateSx({
      hoverScale,
      fullWidth,
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

function PillTemplateIcon({ sx, ...rest }) {
  return <Box component="img" sx={{ ...pillTemplateIconSx(), ...(sx || {}) }} {...rest} />;
}

function PillTemplateLabel({ sx, children, ...rest }) {
  return (
    <Typography component="span" sx={{ ...pillTemplateLabelSx(), ...(sx || {}) }} {...rest}>
      {children}
    </Typography>
  );
}

PillTemplate.Icon = PillTemplateIcon;
PillTemplate.Label = PillTemplateLabel;
PillTemplate.sx = pillTemplateSx;
PillTemplate.iconSx = pillTemplateIconSx;

export { pillTemplateSx, pillTemplateIconSx } from 'config/pillTemplate';
export { PILL_TEMPLATE_SEND_FLOWER_ORANGE_BG } from 'config/pillTemplate';

PillTemplate.propTypes = {
  hoverScale: PropTypes.number,
  templateBg: PropTypes.string,
  templateText: PropTypes.string,
  templateBorder: PropTypes.string,
  fullWidth: PropTypes.bool,
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  children: PropTypes.node
};

PillTemplateIcon.propTypes = {
  sx: PropTypes.object,
  src: PropTypes.string,
  alt: PropTypes.string
};

PillTemplateLabel.propTypes = {
  sx: PropTypes.object,
  children: PropTypes.node
};
