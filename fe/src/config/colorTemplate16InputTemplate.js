/**
 * ColorTemplate16InputTemplate — outlined auth-style input.
 * Unfocused empty: label inside at DESKTOP_FONT_SIZE_BUTTON, thick inverse-daynight border.
 * Focused or filled: label on top border at 1/2 DESKTOP_FONT_SIZE_BUTTON.
 * Input text: DESKTOP_FONT_SIZE_BUTTON on theme-daynight-color.
 */
import { buttonFontSizeHalfResponsive, buttonFontSizeResponsive } from 'config/buttonFontEnv';
import { DAYNIGHT_VAR, INVERSE_DAYNIGHT_VAR } from 'utils/themeConfig';

export const COLOR_TEMPLATE16_SURFACE_BG = `var(${DAYNIGHT_VAR})`;
export const COLOR_TEMPLATE16_TEXT = `var(${INVERSE_DAYNIGHT_VAR})`;
export const COLOR_TEMPLATE16_BORDER = `var(${INVERSE_DAYNIGHT_VAR})`;
export const COLOR_TEMPLATE16_BORDER_WIDTH = 2;

const colorTemplate16InputPadding = {
  xs: '2.2vh 3vw 1vh',
  sm: '2.4vh 1.2vw 1vh'
};

const colorTemplate16LabelInset = {
  xs: '3vw',
  sm: '1.2vw'
};

const colorTemplate16FullLabelFontSx = {
  fontSize: `${buttonFontSizeResponsive.xs} !important`,
  '@media (min-width: 600px)': {
    fontSize: `${buttonFontSizeResponsive.sm} !important`
  }
};

const colorTemplate16HalfLabelFontSx = {
  fontSize: `${buttonFontSizeHalfResponsive.xs} !important`,
  '@media (min-width: 600px)': {
    fontSize: `${buttonFontSizeHalfResponsive.sm} !important`
  }
};

const colorTemplate16InputFontSx = {
  fontSize: `${buttonFontSizeResponsive.xs} !important`,
  '@media (min-width: 600px)': {
    fontSize: `${buttonFontSizeResponsive.sm} !important`
  }
};

const colorTemplate16BorderSx = {
  borderColor: COLOR_TEMPLATE16_BORDER,
  borderWidth: `${COLOR_TEMPLATE16_BORDER_WIDTH}px`
};

/** FormControl + label inside (full button font) or on top border (half button font). */
export function colorTemplate16FormControlSx(overrides = {}) {
  return {
    marginTop: 0,
    marginBottom: 0,
    '& > label': {
      color: COLOR_TEMPLATE16_TEXT,
      WebkitTextFillColor: COLOR_TEMPLATE16_TEXT,
      '&.Mui-focused': {
        color: COLOR_TEMPLATE16_TEXT
      },
      '&:not(.MuiInputLabel-shrink)': {
        ...colorTemplate16FullLabelFontSx,
        top: '50%',
        left: colorTemplate16LabelInset,
        transform: {
          xs: 'translate(0, -50%) scale(1)',
          sm: 'translate(0, -50%) scale(1)'
        }
      },
      '&.MuiInputLabel-shrink': {
        ...colorTemplate16HalfLabelFontSx,
        bgcolor: COLOR_TEMPLATE16_SURFACE_BG,
        px: 0.5,
        left: colorTemplate16LabelInset,
        transform: {
          xs: 'translate(0, -0.65vh) scale(1)',
          sm: 'translate(0, -0.65vh) scale(1)'
        }
      }
    },
    ...overrides
  };
}

/** OutlinedInput surface — thick inverse-daynight border in all states. */
export function colorTemplate16InputSx(overrides = {}) {
  return {
    bgcolor: COLOR_TEMPLATE16_SURFACE_BG,
    ...colorTemplate16InputFontSx,
    '& .MuiOutlinedInput-notchedOutline': colorTemplate16BorderSx,
    '&:hover .MuiOutlinedInput-notchedOutline': colorTemplate16BorderSx,
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': colorTemplate16BorderSx,
    '& .MuiInputBase-input': {
      padding: colorTemplate16InputPadding,
      ...colorTemplate16InputFontSx,
      color: COLOR_TEMPLATE16_TEXT,
      WebkitTextFillColor: COLOR_TEMPLATE16_TEXT,
      bgcolor: COLOR_TEMPLATE16_SURFACE_BG
    },
    '& .MuiInputBase-input:-webkit-autofill': {
      ...colorTemplate16InputFontSx,
      WebkitTextFillColor: `${COLOR_TEMPLATE16_TEXT} !important`,
      WebkitBoxShadow: `0 0 0 1000px ${COLOR_TEMPLATE16_SURFACE_BG} inset !important`,
      caretColor: COLOR_TEMPLATE16_TEXT,
      transition: 'background-color 5000s ease-in-out 0s'
    },
    ...overrides
  };
}
