import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { DATING_TOP_BANNER_HEIGHT } from 'config/datingTopBanner';
import { getPageVideoTutorialUrl } from 'config/pageVideoTutorialEnv';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';
import { openYoutubeTutorialWindow } from 'utils/openYoutubeTutorialWindow';
import videoTutorialImg from 'assets/images/videoTutorial.png';

/** 2× the dating top-banner strip height — used for all menu VIDEO TUTORIALS icons. */
const VIDEO_TUTORIALS_ICON_HEIGHT = {
  xs: DATING_TOP_BANNER_HEIGHT.xs * 2,
  sm: DATING_TOP_BANNER_HEIGHT.sm * 2
};

/**
 * Centered page-header Video Tutorials control — opens the per-page ENV URL (or an explicit
 * `href`) in a theater-style popup (full-window player).
 * Icon: `assets/images/videoTutorial.png`.
 */
export default function PageVideoTutorialsButton({ pageKey, href: hrefProp, sx }) {
  const hrefFromEnv = pageKey ? getPageVideoTutorialUrl(pageKey) : '';
  const href = String(hrefProp ?? '').trim() || hrefFromEnv;
  const disabled = !href;

  const handleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!href) return;
    openYoutubeTutorialWindow(href);
  };

  return (
    <Box
      component="a"
      href={href || undefined}
      role="link"
      tabIndex={0}
      aria-label="Watch Tutorials"
      aria-disabled={disabled}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          handleClick(event);
        }
      }}
      {...guestDemoAllowProps()}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        lineHeight: 0,
        textDecoration: 'none',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        userSelect: 'none',
        height: VIDEO_TUTORIALS_ICON_HEIGHT,
        ...sx
      }}
    >
      <Box
        component="img"
        src={videoTutorialImg}
        alt="Watch Tutorials"
        draggable={false}
        sx={{
          display: 'block',
          height: '100%',
          width: 'auto',
          maxWidth: { xs: '92vw', sm: 560 },
          objectFit: 'contain',
          pointerEvents: 'none'
        }}
      />
    </Box>
  );
}

PageVideoTutorialsButton.propTypes = {
  pageKey: PropTypes.oneOf([
    'topRight',
    'allSingles',
    'picksPosts',
    'acquaintBuddies',
    'myAlbum',
    'mySelfReportBio',
    'receivedBioRequest',
    'profileRecords'
  ]),
  /** Explicit YouTube (or other) URL — used when set; otherwise `pageKey` ENV URL. */
  href: PropTypes.string,
  sx: PropTypes.object
};
