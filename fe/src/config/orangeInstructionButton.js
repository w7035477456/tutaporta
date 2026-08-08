import { buttonFontSizeHalfResponsive, buttonTemplateHalfFontSizeSx } from 'config/buttonFontEnv';
import { buttonHoverMagnifyFontSx, buttonHoverMagnifyTransitionSx } from 'config/hoverMagnifyEnv';

/** Orange instruction / tour / support buttons (#F75B0B). */
export const ORANGE_INSTRUCTION_BUTTON_BG = '#F75B0B';

/** Use env HOVER_MAGNIFY_FACTOR; pass hoverScale={1} to disable. */
export const ORANGE_INSTRUCTION_BUTTON_HOVER_SCALE = null;

/** Pair with orange instruction buttons — base template hover/selected magnify off; orange sx handles hover. */
export const ORANGE_INSTRUCTION_BUTTON_TEMPLATE_PROPS = {
  hoverScale: 1,
  selectedLabelScale: 1
};

/** UnSelectedButtonTemplate sx — orange bg + half DESKTOP_FONT_SIZE_BUTTON label size. */
export function orangeUnSelectedInstructionButtonSx({
  transformOrigin = 'center center',
  hoverScale = ORANGE_INSTRUCTION_BUTTON_HOVER_SCALE,
  ...overrides
} = {}) {
  const orange = ORANGE_INSTRUCTION_BUTTON_BG;
  return {
    ...buttonTemplateHalfFontSizeSx(),
    bgcolor: `${orange} !important`,
    transformOrigin,
    ...buttonHoverMagnifyTransitionSx,
    '@media (hover: hover)': {
      '&:hover:not(.Mui-disabled)': {
        bgcolor: `${orange} !important`,
        transform: 'none !important',
        ...buttonHoverMagnifyFontSx({ baseFontSize: buttonFontSizeHalfResponsive, hoverScale })
      }
    },
    ...overrides
  };
}

/** SelectedButtonTemplate sx — orange bg + half DESKTOP_FONT_SIZE_BUTTON label size. */
export function orangeSelectedInstructionButtonSx(options = {}) {
  return orangeUnSelectedInstructionButtonSx(options);
}

/** Hover grow for orange instruction buttons (pointer devices only). */
export function orangeInstructionButtonHoverSx({
  hoverScale = ORANGE_INSTRUCTION_BUTTON_HOVER_SCALE,
  transformOrigin = 'center',
  onHover = {}
} = {}) {
  return {
    ...buttonHoverMagnifyTransitionSx,
    transformOrigin,
    '@media (hover: hover)': {
      '&:hover:not(.Mui-disabled)': {
        transform: 'none !important',
        ...buttonHoverMagnifyFontSx({ baseFontSize: buttonFontSizeHalfResponsive, hoverScale }),
        ...onHover
      }
    }
  };
}
