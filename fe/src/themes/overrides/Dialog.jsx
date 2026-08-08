// ==============================|| OVERRIDES - DIALOG ||============================== //

import { getLegalRightLeftMarginVw, getLegalTopMarginVh, getLegalBottomMarginVh } from 'config/legalDialogEnv';

export default function Dialog(theme) {
  const legalRL = getLegalRightLeftMarginVw();
  const legalTop = getLegalTopMarginVh();
  const legalBot = getLegalBottomMarginVh();
  const legalW = Math.max(0, 100 - legalRL * 2);

  return {
    MuiDialog: {
      styleOverrides: {
        container: {
          alignItems: 'center',
          justifyContent: 'center',
          [theme.breakpoints.down('sm')]: {
            alignItems: 'flex-start',
            justifyContent: 'center'
          }
        },
        paper: {
          padding: '12px 0',
          transform: 'scale(var(--app-dialog-scale, 1))',
          transformOrigin: 'center center',
          backgroundColor: 'var(--theme-secondary-color)',
          color: 'var(--theme-primary-color)',
          backgroundImage: 'none',
          '&:not(.MuiDialog-paperFullScreen)': {
            [theme.breakpoints.down('sm')]: {
              /* Strong maxWidth/margins beat MUI paperWidth* + default paper margin; omit width so PaperProps (e.g. filter scale) can set it */
              maxWidth: `${legalW}vw !important`,
              marginLeft: `${legalRL}vw !important`,
              marginRight: `${legalRL}vw !important`,
              marginTop: `${legalTop}vh !important`,
              marginBottom: `${legalBot}vh !important`,
              maxHeight: `calc(100dvh - ${legalTop}vh - ${legalBot}vh)`,
              height: 'auto',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'none'
            }
          }
        }
      }
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          backgroundColor: 'var(--theme-secondary-color)',
          color: 'var(--theme-primary-color)'
        }
      }
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          backgroundColor: 'var(--theme-secondary-color)'
        }
      }
    },
    MuiDialogContentText: {
      styleOverrides: {
        root: {
          color: 'var(--theme-primary-color)',
          opacity: 1
        }
      }
    }
  };
}
