import { useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import Button from '@mui/material/Button';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { buttonTemplateSingleLineLabelSx } from 'config/selectedUnselectedButtonTemplate';
import { DAYLIGHT_VAR, INVERSE_DAYNIGHT_VAR } from 'utils/themeConfig';
import { useRecordVaultSliderControlButtonFontRem } from 'views/dashboard/recordVault/RecordVaultSliderControlButtonContext';
import { usePhotoAlbumsSliderControlButtonFontRem } from 'views/dashboard/photoAlbums/PhotoAlbumsSliderControlButtonContext';
import { isPhotoAlbumsRoute } from 'config/photoAlbumsLayout';

/** Whole-button hover scale — 25% larger (default). Pass hoverScale for a different factor. */
export const SLIDER_CONTROL_BUTTON_HOVER_SCALE = 1.25;

/** TutaNotes header rail / search / View USB — +15%. */
export const SLIDER_CONTROL_BUTTON_HOVER_SCALE_15 = 1.15;

/** TutaNotes sidebar lock / delete icons — +50%. */
export const SLIDER_CONTROL_BUTTON_HOVER_SCALE_50 = 1.5;

const BLOCK_BORDER = '4px solid #000000';
/** Full Paletes green; Minimal Palete remaps via `--theme-action-green-color`. */
const GREEN_ENABLED_BG = 'var(--theme-action-green-color, #60C446)';
const RED_ENABLED_BG = '#c62828';
const GREEN_DISABLED_BG = '#737373';

/** Selected / pressed controls lift up 10% on Y. */
export const SLIDER_CONTROL_SELECTED_TRANSLATE_Y = '-20%';

function selectedTransform(extra = '') {
  const lift = `translateY(${SLIDER_CONTROL_SELECTED_TRANSLATE_Y})`;
  return extra ? `${lift} ${extra}` : lift;
}

function resolveVariantSx(variant, selected) {
  if (selected === true) {
    return {
      bgcolor: 'var(--theme-secondary-color) !important',
      color: `var(${INVERSE_DAYNIGHT_VAR}) !important`,
      WebkitTextFillColor: `var(${INVERSE_DAYNIGHT_VAR}) !important`,
      border: `4px solid var(${INVERSE_DAYNIGHT_VAR}) !important`
    };
  }
  if (selected === false) {
    return {
      bgcolor: 'var(--theme-primary-color) !important',
      color: `var(${DAYLIGHT_VAR}) !important`,
      WebkitTextFillColor: `var(${DAYLIGHT_VAR}) !important`,
      border: `4px solid var(${DAYLIGHT_VAR}) !important`
    };
  }

  switch (variant) {
    case 'yellow':
      return {
        bgcolor: 'var(--theme-yellow-color) !important',
        color: '#000000 !important',
        WebkitTextFillColor: '#000000 !important',
        border: BLOCK_BORDER
      };
    case 'logoff':
      return {
        bgcolor: 'var(--theme-yellow-color) !important',
        color: '#000000 !important',
        WebkitTextFillColor: '#000000 !important',
        border: BLOCK_BORDER
      };
    case 'red':
      return {
        bgcolor: `${RED_ENABLED_BG} !important`,
        color: '#ffffff !important',
        WebkitTextFillColor: '#ffffff !important',
        border: BLOCK_BORDER
      };
    case 'green':
    default:
      return {
        bgcolor: `${GREEN_ENABLED_BG} !important`,
        color: '#000000 !important',
        WebkitTextFillColor: '#000000 !important',
        border: BLOCK_BORDER
      };
  }
}

function hoverSx(variant, disableHoverScale, isLifted = false, hoverScale = SLIDER_CONTROL_BUTTON_HOVER_SCALE) {
  if (disableHoverScale) {
    return {
      '@media (hover: hover)': {
        '&:hover:not(.Mui-disabled)': {
          transform: isLifted ? selectedTransform() : 'none !important',
          zIndex: 'auto !important'
        }
      }
    };
  }

  const factor = Number(hoverScale);
  const safeFactor =
    Number.isFinite(factor) && factor > 1 ? factor : SLIDER_CONTROL_BUTTON_HOVER_SCALE;
  const scale = `scale(${safeFactor})`;
  const hoverTransform = isLifted ? selectedTransform(scale) : scale;
  if (variant === 'logoff') {
    return {
      '@media (hover: hover)': {
        '&:hover:not(.Mui-disabled)': {
          bgcolor: 'var(--theme-error-color) !important',
          color: '#ffffff !important',
          WebkitTextFillColor: '#ffffff !important',
          borderColor: 'var(--theme-error-color) !important',
          transform: hoverTransform,
          position: 'relative',
          zIndex: 1
        }
      }
    };
  }

  return {
    '@media (hover: hover)': {
      '&:hover:not(.Mui-disabled)': {
        transform: hoverTransform,
        position: 'relative',
        zIndex: 1
      }
    }
  };
}

/**
 * myNote unified button — font size from slider (user_customization.mynote_font_size / env default).
 * Block (bold) label, block (thick) border, green unless variant/selected overrides, 25% hover scale.
 * `singleLineLabel` — same width-fits-label base as GreenButton (grows wider so text never clips).
 */
export default function SliderControlButton({
  variant = 'green',
  selected,
  disableHoverScale = false,
  disableSelectedTranslate = false,
  hoverScale = SLIDER_CONTROL_BUTTON_HOVER_SCALE,
  singleLineLabel = false,
  fullWidth = false,
  sx,
  children,
  'aria-pressed': ariaPressed,
  ...rest
}) {
  const location = useLocation();
  const notesFontRem = useRecordVaultSliderControlButtonFontRem();
  const albumsFontRem = usePhotoAlbumsSliderControlButtonFontRem();
  const fontRem = isPhotoAlbumsRoute(location.pathname) ? albumsFontRem : notesFontRem;
  const fontSize = `${fontRem}rem !important`;
  const variantStyles = resolveVariantSx(variant, selected);
  const isSelected = selected === true || ariaPressed === true || ariaPressed === 'true';
  // Notebook/note list rows keep selected colors but stay in place (no translateY lift).
  const isLifted = isSelected && !disableSelectedTranslate;
  // GreenButton base: single-line label wins over fullWidth stretch so text stays visible.
  const effectiveFullWidth = fullWidth && !singleLineLabel;

  const mergedSx = (theme) => {
    const extra = typeof sx === 'function' ? sx(theme) : sx || {};
    const baseTransform = isLifted ? selectedTransform() : 'scale(1)';
    return {
      fontFamily: MAIN_FONT_FAMILY,
      fontSize,
      fontWeight: 900,
      textTransform: 'none',
      lineHeight: 1.15,
      borderRadius: '12px',
      boxShadow: 'none',
      transform: baseTransform,
      transformOrigin: 'center center',
      transition: 'transform 0.15s ease',
      px: { xs: 0.55, sm: 0.75 },
      py: { xs: 0.35, sm: 0.45 },
      minWidth: 0,
      ...variantStyles,
      '& .MuiButton-label': {
        fontSize,
        fontWeight: 900,
        lineHeight: 1.15
      },
      '&.Mui-disabled': {
        bgcolor: `${GREEN_DISABLED_BG} !important`,
        color: '#000000 !important',
        WebkitTextFillColor: '#000000 !important',
        border: BLOCK_BORDER,
        opacity: 1,
        transform: 'none !important'
      },
      ...hoverSx(variant, disableHoverScale, isLifted, hoverScale),
      '@media (min-width: 600px)': {
        fontSize,
        '& .MuiButton-label': { fontSize, fontWeight: 900 }
      },
      ...(singleLineLabel ? buttonTemplateSingleLineLabelSx() : null),
      ...extra
    };
  };

  return (
    <Button sx={mergedSx} fullWidth={effectiveFullWidth} aria-pressed={ariaPressed} {...rest}>
      {children}
    </Button>
  );
}

SliderControlButton.propTypes = {
  variant: PropTypes.oneOf(['green', 'yellow', 'red', 'logoff']),
  selected: PropTypes.bool,
  disableHoverScale: PropTypes.bool,
  disableSelectedTranslate: PropTypes.bool,
  hoverScale: PropTypes.number,
  singleLineLabel: PropTypes.bool,
  fullWidth: PropTypes.bool,
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  children: PropTypes.node
};
