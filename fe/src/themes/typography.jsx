import { getDesktopButtonFontSizeVw, getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesButtonFontSizeVw, getMobileSinglesTextFontSizeVw } from 'config/singlesMemberCardFontEnv';

import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';

export default function Typography() {
  const dText = getDesktopTextFontSizeVw();
  const mText = getMobileSinglesTextFontSizeVw();
  const dBtn = getDesktopButtonFontSizeVw();
  const mBtn = getMobileSinglesButtonFontSizeVw();

  return {
    fontFamily: MAIN_FONT_FAMILY,
    h6: {
      fontWeight: 500,
      fontSize: { xs: mText, sm: dText }
    },
    h5: {
      fontSize: { xs: mText, sm: dText },
      fontWeight: 500
    },
    h4: {
      fontSize: { xs: mText, sm: dText },
      fontWeight: 600
    },
    h3: {
      fontSize: { xs: mText, sm: dText },
      fontWeight: 600
    },
    h2: {
      fontSize: { xs: mText, sm: dText },
      fontWeight: 700
    },
    h1: {
      fontSize: { xs: mText, sm: dText },
      fontWeight: 700
    },
    subtitle1: {
      fontSize: { xs: mText, sm: dText },
      fontWeight: 500
    },
    subtitle2: {
      fontSize: { xs: mText, sm: dText },
      fontWeight: 400
    },
    caption: {
      fontSize: { xs: mText, sm: dText },
      fontWeight: 400
    },
    body1: {
      fontSize: { xs: mText, sm: dText },
      fontWeight: 400,
      lineHeight: '1.334em'
    },
    body2: {
      letterSpacing: '0em',
      fontWeight: 400,
      lineHeight: '1.5em',
      fontSize: { xs: mText, sm: dText }
    },
    button: {
      textTransform: 'capitalize',
      fontWeight: 700,
      fontSize: { xs: mBtn, sm: dBtn }
    },
    commonAvatar: {
      cursor: 'pointer',
      borderRadius: '8px'
    },
    smallAvatar: {
      width: '22px',
      height: '22px',
      fontSize: '1rem'
    },
    mediumAvatar: {
      width: '34px',
      height: '34px',
      fontSize: '1.2rem'
    },
    largeAvatar: {
      width: '44px',
      height: '44px',
      fontSize: '1.5rem'
    }
  };
}
