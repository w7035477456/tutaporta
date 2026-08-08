import { MY_RECORD_VAULT_LEGACY_PATH, MY_RECORD_VAULT_PATH } from 'constants/myRecordVaultRoute';
import { headerBarMinHeightCss } from 'config/headerProfileChipEnv';
import myNoteHeaderLogoImage from 'assets/images/onlineMallWebsiteLogo.png';
import myNoteBannerImage from 'assets/images/myNote.png';
import myNoteBackgroundImage from 'assets/images/myNoteBackground.png';

export { MY_RECORD_VAULT_PATH };

/** Header logo for /myNote — small OnlineMall.Website mark (left of toolbar). */
export const MY_NOTE_HEADER_LOGO_IMAGE = myNoteHeaderLogoImage;

/** Top header strip artwork for /myNote — tiled across full app-bar width. */
export const MY_NOTE_BANNER_IMAGE = myNoteBannerImage;

/** Full-page /myNote loading & OneDrive transition backdrop. */
export const MY_NOTE_BACKGROUND_IMAGE = myNoteBackgroundImage;

/** Empty tail below note content — scroll room to add text or photos. */
export const RECORD_VAULT_NOTE_SCROLL_TAIL_MIN_HEIGHT = { xs: '50vh', sm: '55vh', md: '60vh' };

/** Compact split-pane (/myNote dual halves) — keep note content near the top. */
export const RECORD_VAULT_NOTE_SCROLL_TAIL_COMPACT_MIN_HEIGHT = { xs: 48, sm: 64, md: 80 };

/** Logo link — full app-bar height, above tiled myNote.png background. */
export const myNoteHeaderLogoWrapSx = {
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'stretch',
  my: -2,
  ml: -2,
  position: 'relative',
  zIndex: 2,
  lineHeight: 0,
  textDecoration: 'none'
};

/** Logo image — fill banner height, keep aspect ratio. */
export const myNoteHeaderLogoImgSx = {
  display: 'block',
  height: headerBarMinHeightCss(),
  width: 'auto',
  maxWidth: 'none',
  objectFit: 'contain'
};

/** Left header slot on /myNote — stretches with toolbar, stacks above banner art. */
export const myNoteHeaderLogoSlotSx = {
  display: 'flex',
  alignItems: 'stretch',
  alignSelf: 'stretch',
  position: 'relative',
  zIndex: 2,
  flexShrink: 0,
  minWidth: 0
};

/** Region 1 app bar — repeat myNote.png horizontally across the full header width. */
export const myNoteHeaderBannerSx = {
  backgroundImage: `url(${MY_NOTE_BANNER_IMAGE})`,
  backgroundRepeat: 'repeat-x',
  backgroundPosition: 'left center',
  backgroundSize: 'auto 100%'
};

/** Full-width Record Vault — no site sidebar (notebook menu is in-page). */
export function isRecordVaultRoute(pathname) {
  const path = String(pathname ?? '').replace(/\/+$/, '') || '/';
  return path === MY_RECORD_VAULT_PATH || path === MY_RECORD_VAULT_LEGACY_PATH;
}
