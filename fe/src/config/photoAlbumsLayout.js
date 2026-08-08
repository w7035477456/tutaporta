import { MY_PHOTO_ALBUMS_LEGACY_PATH, MY_PHOTO_ALBUMS_PATH } from 'constants/myPhotoAlbumsRoute';
import { headerBarMinHeightCss } from 'config/headerProfileChipEnv';
import myPhotoAlbumsHeaderLogoImage from 'assets/images/onlineMallWebsiteLogo.png';
import myPhotoAlbumsBannerImage from 'assets/images/myPhotoAlbums.png';
import myPhotoAlbumsBackgroundImage from 'assets/images/myPhotoAlbumsBackground.png';

export { MY_PHOTO_ALBUMS_PATH };

/** Header logo for /myPhotoAlbums — small OnlineMall.Website mark (left of toolbar). */
export const MY_PHOTO_ALBUMS_HEADER_LOGO_IMAGE = myPhotoAlbumsHeaderLogoImage;

/** Top header strip artwork for /myPhotoAlbums — tiled across full app-bar width. */
export const MY_PHOTO_ALBUMS_BANNER_IMAGE = myPhotoAlbumsBannerImage;

/** Full-page /myPhotoAlbums loading & OneDrive transition backdrop. */
export const MY_PHOTO_ALBUMS_BACKGROUND_IMAGE = myPhotoAlbumsBackgroundImage;

/** Empty tail below note content — scroll room to add text or photos. */
export const PHOTO_ALBUMS_NOTE_SCROLL_TAIL_MIN_HEIGHT = { xs: '50vh', sm: '55vh', md: '60vh' };

/** Compact split-pane (/myPhotoAlbums dual halves) — keep note content near the top. */
export const PHOTO_ALBUMS_NOTE_SCROLL_TAIL_COMPACT_MIN_HEIGHT = { xs: 48, sm: 64, md: 80 };

/** Album / photo slideshow fullscreen shell (PhotoAlbumsNoteEditor, PhotoAlbumsPhotoFullscreenOverlay). */
export const PHOTO_ALBUMS_SLIDESHOW_BASE_Z = 14000;
/** Photo-only fullscreen slideshow overlay (above album editor fullscreen). */
export const PHOTO_ALBUMS_PHOTO_SLIDESHOW_BASE_Z = 15000;
/** Bottom-right Mute / Track bar during slideshow (album editor fullscreen). */
export const PHOTO_ALBUMS_SLIDESHOW_MUSIC_CONTROLS_Z = PHOTO_ALBUMS_SLIDESHOW_BASE_Z + 15;
/** Bottom-right Mute / Track bar during photo slideshow. */
export const PHOTO_ALBUMS_PHOTO_SLIDESHOW_MUSIC_CONTROLS_Z = PHOTO_ALBUMS_PHOTO_SLIDESHOW_BASE_Z + 10;
/** Mini YouTube player offset above slideshow base. */
export const PHOTO_ALBUMS_SLIDESHOW_MINI_PLAYER_Z_OFFSET = 50;
/** Track dialog offset above slideshow base. */
export const PHOTO_ALBUMS_SLIDESHOW_TRACK_DIALOG_Z_OFFSET = 100;

export function photoAlbumsSlideshowMiniPlayerZ(baseZ) {
  return Number(baseZ) + PHOTO_ALBUMS_SLIDESHOW_MINI_PLAYER_Z_OFFSET;
}

export function photoAlbumsSlideshowTrackDialogZ(baseZ) {
  return Number(baseZ) + PHOTO_ALBUMS_SLIDESHOW_TRACK_DIALOG_Z_OFFSET;
}

/** Logo link — full app-bar height, above tiled myPhotoAlbums.png background. */
export const myPhotoAlbumsHeaderLogoWrapSx = {
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
export const myPhotoAlbumsHeaderLogoImgSx = {
  display: 'block',
  height: headerBarMinHeightCss(),
  width: 'auto',
  maxWidth: 'none',
  objectFit: 'contain'
};

/** Left header slot on /myPhotoAlbums — stretches with toolbar, stacks above banner art. */
export const myPhotoAlbumsHeaderLogoSlotSx = {
  display: 'flex',
  alignItems: 'stretch',
  alignSelf: 'stretch',
  position: 'relative',
  zIndex: 2,
  flexShrink: 0,
  minWidth: 0
};

/** Region 1 app bar — repeat myPhotoAlbums.png horizontally across the full header width. */
export const myPhotoAlbumsHeaderBannerSx = {
  backgroundImage: `url(${MY_PHOTO_ALBUMS_BANNER_IMAGE})`,
  backgroundRepeat: 'repeat-x',
  backgroundPosition: 'left center',
  backgroundSize: 'auto 100%'
};

/** Full-width Record Vault — no site sidebar (notebook menu is in-page). */
export function isPhotoAlbumsRoute(pathname) {
  const path = String(pathname ?? '').replace(/\/+$/, '') || '/';
  return path === MY_PHOTO_ALBUMS_PATH || path === MY_PHOTO_ALBUMS_LEGACY_PATH;
}
