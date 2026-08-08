/**
 * fe/.env — all site footers (MainLayout Footer + AuthFooter).
 * MOBILE_FONT_SIZE_TEXT / DESKTOP_FONT_SIZE_TEXT (see desktopFontEnv.js, singlesMemberCardFontEnv.js).
 */
import { getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTextFontSizeVw } from 'config/singlesMemberCardFontEnv';

/** @type {{ xs: string, sm: string }} */
export const siteFooterTextFontSize = {
  xs: getMobileSinglesTextFontSizeVw(),
  sm: getDesktopTextFontSizeVw()
};
