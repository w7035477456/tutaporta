// ==============================|| OVERRIDES - INPUT BASE ||============================== //

import { getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTextFontSizeVw } from 'config/singlesMemberCardFontEnv';

export default function InputBase(theme) {
  const dText = getDesktopTextFontSizeVw();
  const mText = getMobileSinglesTextFontSizeVw();
  return {
    MuiInputBase: {
      styleOverrides: {
        input: {
          color: theme.vars.palette.text.dark,
          fontSize: { xs: mText, sm: dText },
          '&::placeholder': {
            color: theme.vars.palette.text.secondary,
            fontSize: { xs: mText, sm: dText }
          }
        }
      }
    },
    MuiFormLabel: {
      styleOverrides: {
        root: {
          fontSize: { xs: mText, sm: dText }
        }
      }
    }
  };
}
