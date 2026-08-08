// ==============================|| OVERRIDES - DIALOG TITLE ||============================== //

import { getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';

export default function DialogTitle() {
  const dTitle = getDesktopTitleFontSizeVw();
  return {
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: { xs: '1.25rem', sm: dTitle },
          backgroundColor: 'var(--theme-secondary-color)',
          color: 'var(--theme-primary-color)'
        }
      }
    }
  };
}
