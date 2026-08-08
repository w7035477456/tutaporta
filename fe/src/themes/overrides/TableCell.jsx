// ==============================|| OVERRIDES - TABLE CELL ||============================== //

import { getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTextFontSizeVw } from 'config/singlesMemberCardFontEnv';

export default function TableCell(theme) {
  const dText = getDesktopTextFontSizeVw();
  const mText = getMobileSinglesTextFontSizeVw();
  return {
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: theme.vars.palette.grey[200],
          fontSize: { xs: mText, sm: dText },

          '&.MuiTableCell-head': {
            fontSize: { xs: mText, sm: dText },
            color: theme.vars.palette.grey[900],
            fontWeight: 500
          }
        }
      }
    }
  };
}
