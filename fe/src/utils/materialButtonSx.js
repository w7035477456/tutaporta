/** Shared 3D / material-style shadows for theme-aligned controls. */

import { buttonHoverMagnifyFontSx, buttonHoverMagnifyTransitionSx } from 'config/hoverMagnifyEnv';

const hoverFontSx = buttonHoverMagnifyFontSx();

export const materialThemeButtonSx = {
  textTransform: 'none',
  fontWeight: 700,
  lineHeight: 1.2,
  borderRadius: 2,
  bgcolor: 'var(--theme-secondary-color)',
  color: 'var(--theme-primary-color)',
  border: '2px solid var(--theme-primary-color)',
  boxShadow:
    '0 4px 0 color-mix(in srgb, var(--theme-primary-color) 40%, transparent), 0 6px 14px rgba(0, 0, 0, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.45)',
  ...buttonHoverMagnifyTransitionSx,
  '&:hover': {
    bgcolor: 'var(--theme-secondary-color)',
    filter: 'brightness(0.98)',
    boxShadow:
      '0 3px 0 color-mix(in srgb, var(--theme-primary-color) 40%, transparent), 0 4px 10px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.45)',
    ...hoverFontSx
  },
  '&:active': {
    transform: 'translateY(3px)',
    boxShadow: '0 1px 0 color-mix(in srgb, var(--theme-primary-color) 40%, transparent), inset 0 2px 5px rgba(0, 0, 0, 0.16)'
  },
  '&.Mui-disabled': {
    bgcolor: 'var(--theme-secondary-color)',
    color: 'var(--theme-primary-color)',
    opacity: 0.55,
    border: '2px solid var(--theme-primary-color)',
    boxShadow: 'none',
    transform: 'none'
  }
};

export const materialDeleteIconButtonSx = {
  borderRadius: '50%',
  color: '#fff',
  bgcolor: '#c62828',
  border: '2px solid #7f0000',
  boxShadow: '0 3px 0 #7f0000, 0 4px 10px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
  ...buttonHoverMagnifyTransitionSx,
  '&:hover': {
    bgcolor: '#b71c1c',
    filter: 'brightness(0.98)',
    boxShadow: '0 2px 0 #7f0000, 0 3px 8px rgba(0, 0, 0, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
    ...hoverFontSx
  },
  '&:active': {
    transform: 'translateY(2px)',
    boxShadow: '0 1px 0 #7f0000, inset 0 2px 4px rgba(0, 0, 0, 0.2)'
  },
  '&.Mui-disabled': {
    bgcolor: 'rgba(198, 40, 40, 0.45)',
    color: '#fff',
    border: '2px solid #7f0000',
    opacity: 0.85,
    boxShadow: 'none',
    transform: 'none'
  },
  '& svg': { width: '62%', height: '62%' }
};

export const materialPanelSx = {
  boxShadow: '0 4px 0 rgba(0, 0, 0, 0.22), 0 6px 14px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.42)'
};

export const materialAvatarSx = {
  boxShadow:
    '0 3px 0 color-mix(in srgb, var(--theme-primary-color) 35%, transparent), 0 5px 12px rgba(0, 0, 0, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.5)'
};

const materialPressableBase = {
  ...buttonHoverMagnifyTransitionSx,
  '&:hover:not(.Mui-disabled)': {
    ...hoverFontSx,
    filter: 'brightness(0.99)'
  },
  '&:active:not(.Mui-disabled)': {
    transform: 'translateY(2px)'
  }
};

/** Apply raised 3D shadow on top of existing bio-button color sx. */
export function withMaterialBioButtonSx(baseSx, edgeColor) {
  const edge = edgeColor || 'rgba(0, 0, 0, 0.28)';
  return {
    ...baseSx,
    ...materialPressableBase,
    boxShadow: `0 3px 0 ${edge}, 0 4px 10px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.38)`,
    '&:hover:not(.Mui-disabled)': {
      ...(baseSx['&:hover:not(.Mui-disabled)'] ?? {}),
      ...hoverFontSx,
      boxShadow: `0 2px 0 ${edge}, 0 3px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.38)`,
      filter: 'brightness(0.99)'
    },
    '&:active:not(.Mui-disabled)': {
      transform: 'translateY(2px)',
      boxShadow: `0 1px 0 ${edge}, inset 0 2px 4px rgba(0, 0, 0, 0.14)`
    },
    '&.Mui-disabled': {
      ...(baseSx['&.Mui-disabled'] ?? {}),
      boxShadow: `0 2px 0 ${edge}, inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
      transform: 'none'
    }
  };
}
