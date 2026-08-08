// ==============================|| OVERRIDES - SLIDER ||============================== //

export default function Slider(theme) {
  return {
    MuiSlider: {
      styleOverrides: {
        root: {
          color: 'var(--theme-primary-color)',
          '&.Mui-disabled': {
            color: theme.vars.palette.grey[300]
          }
        },
        thumb: {
          backgroundColor: 'var(--theme-secondary-color)'
        },
        track: {
          backgroundColor: 'var(--theme-secondary-color)'
        },
        rail: {
          backgroundColor: 'var(--theme-secondary-color)'
        },
        mark: {
          backgroundColor: theme.vars.palette.background.paper,
          width: '4px'
        },
        valueLabel: {
          backgroundColor: 'var(--theme-secondary-color)'
        }
      }
    }
  };
}
