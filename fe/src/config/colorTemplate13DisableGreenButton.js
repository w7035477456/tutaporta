/**
 * ColorTemplate13DisableGreenButton — UnSelectedButtonTemplate greenGreyStates + optional primary Clear bg.
 * Enabled: green. Disabled: grey. SMS digit slots share disabled grey.
 */
import { unselectedButtonGreenGreyStatesSx } from 'ui-component/UnSelectedButtonTemplate';
import { PRIMARY_VAR } from 'utils/themeConfig';

/** Disabled grey — matches UnSelectedButtonTemplate greenGreyStates. */
export const COLOR_TEMPLATE13_DISABLED_BG = '#9e9e9e';

const PRIMARY_ENABLED_BG = `var(${PRIMARY_VAR})`;

export function colorTemplate13PrimaryEnabledBgSx() {
  return {
    bgcolor: `${PRIMARY_ENABLED_BG} !important`,
    '@media (hover: hover)': {
      '&:hover:not(.Mui-disabled)': {
        bgcolor: `${PRIMARY_ENABLED_BG} !important`
      }
    }
  };
}

/**
 * @param {{ activeVariant?: 'green' | 'primary', disabled?: boolean, hoverEnlargeFont?: boolean }} [opts]
 * @returns {import('@mui/material').SxProps}
 */
export function colorTemplate13DisableGreenButtonSx({
  activeVariant = 'green',
  disabled = false,
  hoverEnlargeFont = false
} = {}) {
  const hoverScale = hoverEnlargeFont ? undefined : 1;
  const base = unselectedButtonGreenGreyStatesSx({ hoverScale, fitLabelWidth: true });

  if (activeVariant === 'primary' && !disabled) {
    return { ...base, ...colorTemplate13PrimaryEnabledBgSx() };
  }

  return base;
}
