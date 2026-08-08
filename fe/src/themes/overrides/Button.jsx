// ==============================|| OVERRIDES - BUTTON ||============================== //

import { buttonFontSizeResponsive } from 'config/buttonFontEnv';

export default function Button(theme) {
  return {
    MuiButton: {
      styleOverrides: {
        root: {
          fontWeight: '700 !important',
          fontSize: buttonFontSizeResponsive,
          '& .MuiTypography-root': {
            fontWeight: '700 !important',
            fontSize: 'inherit',
            lineHeight: 'inherit'
          }
        }
      }
    },
    MuiFab: {
      styleOverrides: {
        root: {
          fontWeight: '700 !important',
          fontSize: buttonFontSizeResponsive,
          '& .MuiTypography-root': {
            fontWeight: '700 !important',
            fontSize: 'inherit'
          }
        }
      }
    },
    MuiLink: {
      styleOverrides: {
        root: {
          '&[type="button"]': {
            fontWeight: '700 !important'
          }
        }
      }
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          '&.Mui-disabled': {
            color: theme.vars.palette.grey[300]
          }
        },
        mark: {
          backgroundColor: theme.vars.palette.background.paper,
          width: '4px'
        },
        valueLabel: {
          color: theme.vars.palette.primary.light
        }
      }
    }
  };
}
