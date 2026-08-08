import datingBackgroundTop from 'assets/images/topBannerNewBlur.png';

/** Same strip used on the vsingles app header (All Singles, etc.). */
export const DATING_TOP_BANNER_IMAGE = datingBackgroundTop;

export const DATING_TOP_BANNER_HEIGHT = { xs: 52, sm: 64 };

/**
 * Background slice of the dating header banner.
 * App header uses `center`; in-page mirrors use `left` / `right` for the opposite side.
 */
export function datingTopBannerBackgroundSx(align = 'center') {
  const backgroundPosition =
    align === 'left' ? 'left center' : align === 'right' ? 'right center' : 'center center';

  return {
    backgroundImage: `url(${DATING_TOP_BANNER_IMAGE})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition,
    backgroundSize: 'cover'
  };
}

/** Full-width strip shell for an in-page mirror of the dating header banner. */
export function datingTopBannerStripSx() {
  return {
    position: 'relative',
    width: '100%',
    height: DATING_TOP_BANNER_HEIGHT,
    overflow: 'hidden',
    bgcolor: 'transparent',
    borderBottom: '1px solid rgba(0,0,0,0.12)'
  };
}
