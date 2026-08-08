/**
 * Yellow action buttons (Save, Original/Pan/Crop, posting visibility).
 */
import { buttonFontSizeResponsive } from 'config/buttonFontEnv';
import {
  buttonHoverMagnifyFontSx,
  buttonHoverMagnifyTransitionSx,
  buttonSelectedMagnifyFontSx,
  templateButtonMagnifySx
} from 'config/hoverMagnifyEnv';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { SELECTED_UNSELECTED_BUTTON_BORDER_RADIUS } from 'config/selectedUnselectedButtonTemplate';

export const YELLOW_BUTTON_TEMPLATE_BG = '#FBDF1B';
export const YELLOW_BUTTON_TEMPLATE_TEXT = '#000000';
export const YELLOW_BUTTON_TEMPLATE_BORDER = '1px solid #000000';
/** Use env HOVER_MAGNIFY_FACTOR; pass hoverScale={1} to disable. */
export const YELLOW_BUTTON_TEMPLATE_HOVER_SCALE = null;

const menuButtonShadow =
  '0px 3px 1px -2px rgba(0,0,0,0.2), 0px 2px 2px 0px rgba(0,0,0,0.14), 0px 1px 5px 0px rgba(0,0,0,0.12)';

function yellowHoverBlock(bg, text, border, hoverScale) {
  return {
    bgcolor: `${bg} !important`,
    color: `${text} !important`,
    border: `${border} !important`,
    ...buttonHoverMagnifyFontSx({ baseFontSize: buttonFontSizeResponsive, hoverScale }),
    '& .MuiButton-startIcon': { color: `${text} !important` },
    '& svg': { color: `${text} !important` }
  };
}

/** MUI Button sx — yellow template (black text, thin black border, HOVER_MAGNIFY_FACTOR label grow). */
export function yellowButtonTemplateSx({
  hoverScale = YELLOW_BUTTON_TEMPLATE_HOVER_SCALE,
  bg = YELLOW_BUTTON_TEMPLATE_BG,
  text = YELLOW_BUTTON_TEMPLATE_TEXT,
  border = YELLOW_BUTTON_TEMPLATE_BORDER,
  transformOrigin = 'center center'
} = {}) {
  return {
    fontFamily: MAIN_FONT_FAMILY,
    fontSize: buttonFontSizeResponsive,
    fontWeight: 600,
    textTransform: 'none',
    lineHeight: 1.35,
    borderRadius: SELECTED_UNSELECTED_BUTTON_BORDER_RADIUS,
    boxShadow: menuButtonShadow,
    bgcolor: `${bg} !important`,
    color: `${text} !important`,
    WebkitTextFillColor: `${text} !important`,
    border: `${border} !important`,
    ...buttonHoverMagnifyTransitionSx,
    transformOrigin,
    '& .MuiButton-startIcon': { color: `${text} !important` },
    '@media (hover: hover)': {
      '&:hover': yellowHoverBlock(bg, text, border, hoverScale)
    }
  };
}

/** Posting visibility `Select` — same yellow chrome as `YellowButtonTemplate`. */
export function yellowButtonVisibilitySelectSx({ fontSize = buttonFontSizeResponsive, height = 30 } = {}) {
  const selectHeight = Number.isFinite(Number(height)) && Number(height) > 0 ? Number(height) : 30;
  return {
    minWidth: 104,
    height: selectHeight,
    bgcolor: YELLOW_BUTTON_TEMPLATE_BG,
    color: YELLOW_BUTTON_TEMPLATE_TEXT,
    boxShadow: menuButtonShadow,
    fontSize,
    borderRadius: SELECTED_UNSELECTED_BUTTON_BORDER_RADIUS,
    ...templateButtonMagnifySx({
      baseFontSize: typeof fontSize === 'object' ? fontSize : { xs: fontSize, sm: fontSize }
    }),
    '@media (hover: hover)': {
      '&:hover': {
        bgcolor: YELLOW_BUTTON_TEMPLATE_BG,
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: '#000000'
        },
        filter: 'brightness(0.96)',
        boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.2), 0px 4px 5px 0px rgba(0,0,0,0.14), 0px 1px 10px 0px rgba(0,0,0,0.12)'
      }
    },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: '#000000',
      borderWidth: '1px !important'
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: '#000000',
      borderWidth: '1px !important'
    },
    '& .MuiSelect-select': {
      py: 0.45,
      pr: 2.4,
      fontWeight: 600,
      color: YELLOW_BUTTON_TEMPLATE_TEXT,
      fontSize: 'inherit',
      display: 'flex',
      alignItems: 'center',
      ...buttonSelectedMagnifyFontSx({
        baseFontSize: typeof fontSize === 'object' ? fontSize : { xs: fontSize, sm: fontSize }
      })
    },
    '& .MuiSelect-icon': { color: YELLOW_BUTTON_TEMPLATE_TEXT },
    '&.Mui-disabled': {
      opacity: 0.55,
      cursor: 'not-allowed'
    }
  };
}

/** Open menu list for posting visibility `Select` — yellow panel matching the closed control. */
export function yellowButtonVisibilitySelectMenuProps({ fontSize = buttonFontSizeResponsive, height = 30 } = {}) {
  const selectHeight = Number.isFinite(Number(height)) && Number(height) > 0 ? Number(height) : 30;
  const menuItemMinHeight = Math.max(32, Math.round(selectHeight * 1.05));
  return {
    PaperProps: {
      sx: {
        bgcolor: `${YELLOW_BUTTON_TEMPLATE_BG} !important`,
        color: `${YELLOW_BUTTON_TEMPLATE_TEXT} !important`,
        boxShadow: menuButtonShadow,
        border: YELLOW_BUTTON_TEMPLATE_BORDER,
        borderRadius: SELECTED_UNSELECTED_BUTTON_BORDER_RADIUS,
        mt: 0.25,
        '& .MuiList-root': {
          py: 0.25
        },
        '& .MuiMenuItem-root': {
          fontFamily: MAIN_FONT_FAMILY,
          fontSize,
          fontWeight: 600,
          color: `${YELLOW_BUTTON_TEMPLATE_TEXT} !important`,
          WebkitTextFillColor: `${YELLOW_BUTTON_TEMPLATE_TEXT} !important`,
          bgcolor: `${YELLOW_BUTTON_TEMPLATE_BG} !important`,
          minHeight: menuItemMinHeight,
          ...buttonHoverMagnifyTransitionSx,
          '@media (hover: hover)': {
            '&:hover': {
              bgcolor: `${YELLOW_BUTTON_TEMPLATE_BG} !important`,
              filter: 'brightness(0.96)',
              ...buttonHoverMagnifyFontSx({
                baseFontSize: typeof fontSize === 'object' ? fontSize : { xs: fontSize, sm: fontSize }
              })
            }
          },
          '&.Mui-selected': {
            bgcolor: `${YELLOW_BUTTON_TEMPLATE_BG} !important`,
            ...buttonSelectedMagnifyFontSx({
              baseFontSize: typeof fontSize === 'object' ? fontSize : { xs: fontSize, sm: fontSize }
            }),
            '@media (hover: hover)': {
              '&:hover': {
                bgcolor: `${YELLOW_BUTTON_TEMPLATE_BG} !important`,
                filter: 'brightness(0.96)'
              }
            }
          },
          '&.Mui-focusVisible': {
            bgcolor: `${YELLOW_BUTTON_TEMPLATE_BG} !important`
          }
        }
      }
    }
  };
}
