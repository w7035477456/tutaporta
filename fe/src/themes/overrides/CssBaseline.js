// ==============================|| OVERRIDES - CSS BASELINE ||============================== //

import { getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { DARK_SURFACE_CLASS, LIGHT_SURFACE_CLASS, TEXT_ON_LIGHT_BG_CSS } from 'utils/themeContrast';

/** When day/night background is black — copy and titles render white via CssBaseline (light themes unchanged). */
const darkSurfaceTypography = {
  color: '#ffffff !important'
};

/** Dark theme + white / light panel: always black copy (no runtime toggling). */
const textOnLightBackground = {
  color: `${TEXT_ON_LIGHT_BG_CSS} !important`
};

const darkTheme = 'html[data-theme-surface="dark"]';

const lightSurfaceDescendants = [
  `${darkTheme} .${LIGHT_SURFACE_CLASS} .MuiTypography-root`,
  `${darkTheme} .${LIGHT_SURFACE_CLASS} .MuiTableCell-root`,
  `${darkTheme} .${LIGHT_SURFACE_CLASS} .MuiListItemText-primary`,
  `${darkTheme} .${LIGHT_SURFACE_CLASS} .MuiListItemText-secondary`,
  `${darkTheme} .${LIGHT_SURFACE_CLASS} .MuiFormLabel-root`,
  `${darkTheme} .${LIGHT_SURFACE_CLASS} .MuiInputLabel-root`,
  `${darkTheme} .${LIGHT_SURFACE_CLASS} .MuiCardHeader-root`,
  `${darkTheme} .MuiPaper-root .MuiTableCell-root:not(.${DARK_SURFACE_CLASS})`,
  `${darkTheme} .MuiPaper-root .MuiTableCell-root:not(.${DARK_SURFACE_CLASS}) .MuiTypography-root`
].join(', ');

const darkSurfaceDescendants = [
  `${darkTheme} .${DARK_SURFACE_CLASS}`,
  `${darkTheme} .${DARK_SURFACE_CLASS} .MuiTypography-root`,
  `${darkTheme} .MuiPaper-root .${DARK_SURFACE_CLASS}`,
  `${darkTheme} .MuiPaper-root .${DARK_SURFACE_CLASS} .MuiTypography-root`
].join(', ');

export default function CssBaseline(theme) {
  const dText = getDesktopTextFontSizeVw();
  return {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          backgroundColor: 'var(--theme-daynight-color)',
          fontFamily: MAIN_FONT_FAMILY
        },
        body: {
          fontFamily: MAIN_FONT_FAMILY,
          backgroundColor: 'var(--theme-daynight-color)',
          [theme.breakpoints.up('sm')]: {
            fontSize: dText
          }
        },
        /** Dark themes only (see themeConfig `data-theme-surface`): page titles and body copy in main app. */
        [`${darkTheme} .MuiTypography-root`]: darkSurfaceTypography,
        [`${darkTheme} .MuiCardHeader-root`]: darkSurfaceTypography,
        [`${darkTheme} .MuiTableCell-root`]: darkSurfaceTypography,
        [`${darkTheme} .MuiListItemText-primary`]: darkSurfaceTypography,
        [`${darkTheme} .MuiListItemText-secondary`]: darkSurfaceTypography,
        [`${darkTheme} .MuiBreadcrumbs-root`]: { color: '#ffffff' },
        [`${darkTheme} .MuiBreadcrumbs-li`]: { color: '#ffffff' },
        [`${darkTheme} .MuiTab-root`]: { color: '#ffffff' },
        [`${darkTheme} .MuiFormLabel-root`]: darkSurfaceTypography,
        [`${darkTheme} .MuiInputLabel-root`]: darkSurfaceTypography,
        [lightSurfaceDescendants]: textOnLightBackground,
        [darkSurfaceDescendants]: darkSurfaceTypography,
        /** Override white copy rule for explicit theme error / legal emphasis (e.g. 3rd-Party privacy note). */
        [`${darkTheme} .MuiTypography-root.theme-red-emphasis`]: {
          color: 'var(--theme-error-color) !important'
        },
        [`${darkTheme} .theme-red-emphasis:not(.MuiTypography-root)`]: {
          color: 'var(--theme-error-color) !important'
        }
      }
    }
  };
}
