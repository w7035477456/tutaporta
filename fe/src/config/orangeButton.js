/**
 * OrangeButton — GreenButton with orange background override (enabled, hover, disabled).
 */
export const ORANGE_BUTTON_ENABLED_BG = '#FF9800';

/** @returns {import('@mui/material').SxProps} Color overrides for GreenButton → orange. */
export function orangeButtonColorSx() {
  const bg = ORANGE_BUTTON_ENABLED_BG;
  return {
    bgcolor: `${bg} !important`,
    '@media (hover: hover)': {
      '&:hover:not(.Mui-disabled)': {
        bgcolor: `${bg} !important`
      }
    },
    '&.Mui-disabled': {
      bgcolor: `${bg} !important`,
      opacity: '0.72 !important'
    }
  };
}
