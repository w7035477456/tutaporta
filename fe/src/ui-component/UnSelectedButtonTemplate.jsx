import PropTypes from 'prop-types';
import Button from '@mui/material/Button';
import {
  buttonTemplateContrastFlipTextColor,
  buttonTemplateFitLabelOnResizeSx,
  buttonTemplateIconSizeResponsive,
  buttonTemplateIconSx,
  buttonTemplateSingleLineLabelSx,
  SELECTED_UNSELECTED_BUTTON_HOVER_SCALE,
  UNSELECTED_BUTTON_TEMPLATE_BG,
  UNSELECTED_BUTTON_TEMPLATE_BORDER,
  UNSELECTED_BUTTON_TEMPLATE_TEXT,
  baseButtonSx,
  resolveButtonTemplateBorder,
  SELECTED_UNSELECTED_BUTTON_FONT_SIZE,
  buttonTemplateHoverBoxScaleOnHoverSx
} from 'config/selectedUnselectedButtonTemplate';
import useFitButtonLabelOnResize from 'hooks/useFitButtonLabelOnResize';
import ButtonTemplateIcon from 'ui-component/ButtonTemplateIcon';

/** Full Paletes green; Minimal Palete remaps via `--theme-action-green-color`. */
const UNSELECTED_GREEN_GREY_ENABLED_BG = 'var(--theme-action-green-color, #60C447)';
const UNSELECTED_GREEN_GREY_ENABLED_TEXT = '#000000';
const UNSELECTED_GREEN_GREY_ENABLED_BORDER = '1px solid #000000';
const UNSELECTED_GREEN_GREY_DISABLED_BG = '#9e9e9e';
const UNSELECTED_GREEN_GREY_DISABLED_TEXT = '#ffffff';
const UNSELECTED_GREEN_GREY_DISABLED_BORDER = '1px solid #757575';

/** Unselected sidebar-style button — primary bg, daynight text + border. Label: DESKTOP_FONT_SIZE_BUTTON (sm+). */
export function unselectedButtonTemplateSx({
  hoverScale = SELECTED_UNSELECTED_BUTTON_HOVER_SCALE,
  fitLabelWidth = false,
  sizeButtonToLabel = false,
  shrinkLabelToFit = false,
  shrinkLabelMaxFontSize,
  transformOrigin = 'left center',
  thickBlackBorder = false
} = {}) {
  return baseButtonSx(UNSELECTED_BUTTON_TEMPLATE_BG, UNSELECTED_BUTTON_TEMPLATE_TEXT, UNSELECTED_BUTTON_TEMPLATE_BORDER, hoverScale, {
    fitLabelWidth,
    sizeButtonToLabel,
    shrinkLabelToFit,
    shrinkLabelMaxFontSize,
    transformOrigin,
    thickBlackBorder
  });
}

/**
 * Enabled: green bg, 25% hover. Disabled: grey bg, not-allowed, no hover scale.
 * Used when `greenGreyStates` is true on UnSelectedButtonTemplate only.
 */
export function unselectedButtonGreenGreyStatesSx({
  hoverScale = SELECTED_UNSELECTED_BUTTON_HOVER_SCALE,
  fitLabelWidth = false,
  sizeButtonToLabel = false,
  shrinkLabelToFit = false,
  shrinkLabelMaxFontSize,
  transformOrigin = 'left center',
  thickBlackBorder = false
} = {}) {
  const enabledBorder = resolveButtonTemplateBorder(UNSELECTED_GREEN_GREY_ENABLED_BORDER, thickBlackBorder);
  const disabledBorder = resolveButtonTemplateBorder(UNSELECTED_GREEN_GREY_DISABLED_BORDER, thickBlackBorder);
  const enabledText = buttonTemplateContrastFlipTextColor(
    UNSELECTED_GREEN_GREY_ENABLED_BG,
    UNSELECTED_GREEN_GREY_ENABLED_TEXT
  );
  const base = baseButtonSx(
    UNSELECTED_GREEN_GREY_ENABLED_BG,
    UNSELECTED_GREEN_GREY_ENABLED_TEXT,
    UNSELECTED_GREEN_GREY_ENABLED_BORDER,
    hoverScale,
    { fitLabelWidth, sizeButtonToLabel, shrinkLabelToFit, shrinkLabelMaxFontSize, transformOrigin, thickBlackBorder }
  );

  return {
    ...base,
    '@media (hover: hover)': {
      '&:hover:not(.Mui-disabled)': {
        bgcolor: `${UNSELECTED_GREEN_GREY_ENABLED_BG} !important`,
        color: `${enabledText} !important`,
        WebkitTextFillColor: `${enabledText} !important`,
        border: `${enabledBorder} !important`,
        ...buttonTemplateHoverBoxScaleOnHoverSx(hoverScale, transformOrigin),
        '& .MuiButton-startIcon': { color: `${enabledText} !important` },
        '& svg': { color: `${enabledText} !important` }
      }
    },
    '&.Mui-disabled': {
      bgcolor: `${UNSELECTED_GREEN_GREY_DISABLED_BG} !important`,
      color: `${UNSELECTED_GREEN_GREY_DISABLED_TEXT} !important`,
      WebkitTextFillColor: `${UNSELECTED_GREEN_GREY_DISABLED_TEXT} !important`,
      border: `${disabledBorder} !important`,
      opacity: '1 !important',
      cursor: 'not-allowed',
      boxShadow: 'none',
      transform: 'none !important',
      pointerEvents: 'none',
      '& .MuiButton-startIcon': { color: `${UNSELECTED_GREEN_GREY_DISABLED_TEXT} !important` },
      '& svg': { color: `${UNSELECTED_GREEN_GREY_DISABLED_TEXT} !important` }
    }
  };
}

export default function UnSelectedButtonTemplate({
  greenGreyStates = false,
  hoverScale = SELECTED_UNSELECTED_BUTTON_HOVER_SCALE,
  fitLabelWidth = true,
  sizeButtonToLabel = false,
  shrinkLabelToFit = false,
  fitLabelOnResize = false,
  singleLineLabel = false,
  shrinkLabelMaxFontSize,
  /** Ignored — unselected labels stay normal size; pass on tab pairs for a shared API with SelectedButtonTemplate. */
  selectedLabelScale: _selectedLabelScale,
  transformOrigin = 'left center',
  thickBlackBorder = false,
  fullWidth = false,
  sx,
  children,
  ...rest
}) {
  const fitLabelRef = useFitButtonLabelOnResize(fitLabelOnResize, children);
  const effectiveFullWidth = fullWidth && !singleLineLabel;

  const mergedSx = (theme) => {
    const sxFactory = greenGreyStates ? unselectedButtonGreenGreyStatesSx : unselectedButtonTemplateSx;
    const base = sxFactory({
      hoverScale,
      fitLabelWidth:
        fitLabelWidth && !effectiveFullWidth && !singleLineLabel && !shrinkLabelToFit && !sizeButtonToLabel && !fitLabelOnResize,
      sizeButtonToLabel: sizeButtonToLabel && !singleLineLabel,
      shrinkLabelToFit: shrinkLabelToFit && !fitLabelOnResize && !singleLineLabel,
      shrinkLabelMaxFontSize,
      transformOrigin,
      thickBlackBorder
    });
    const extra = typeof sx === 'function' ? sx(theme) : sx || {};
    return {
      ...base,
      ...(fitLabelOnResize ? buttonTemplateFitLabelOnResizeSx() : null),
      ...(singleLineLabel ? buttonTemplateSingleLineLabelSx() : null),
      ...extra
    };
  };

  return (
    <Button fullWidth={effectiveFullWidth} {...rest} ref={fitLabelRef} sx={mergedSx}>
      {children}
    </Button>
  );
}

UnSelectedButtonTemplate.propTypes = {
  greenGreyStates: PropTypes.bool,
  hoverScale: PropTypes.number,
  fitLabelWidth: PropTypes.bool,
  sizeButtonToLabel: PropTypes.bool,
  shrinkLabelToFit: PropTypes.bool,
  fitLabelOnResize: PropTypes.bool,
  singleLineLabel: PropTypes.bool,
  shrinkLabelMaxFontSize: PropTypes.object,
  selectedLabelScale: PropTypes.number,
  transformOrigin: PropTypes.string,
  thickBlackBorder: PropTypes.bool,
  fullWidth: PropTypes.bool,
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  children: PropTypes.node
};

UnSelectedButtonTemplate.sx = unselectedButtonTemplateSx;
UnSelectedButtonTemplate.greenGreyStatesSx = unselectedButtonGreenGreyStatesSx;
UnSelectedButtonTemplate.fontSize = SELECTED_UNSELECTED_BUTTON_FONT_SIZE;
UnSelectedButtonTemplate.contrastFlipTextColor = buttonTemplateContrastFlipTextColor;
UnSelectedButtonTemplate.Icon = ButtonTemplateIcon;
UnSelectedButtonTemplate.iconSize = buttonTemplateIconSizeResponsive;
UnSelectedButtonTemplate.iconSx = buttonTemplateIconSx;
