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
 * Centered page-header Video Tutorials control — opens the per-page ENV URL in a theater-style
 * popup (full-window player; YouTube has no public URL to force native Theater Mode).
 * Icon: `assets/images/videoTutorial.png`.
 */
export default function PageVideoTutorialsButton({ pageKey, sx }) {
  const href = getPageVideoTutorialUrl(pageKey);
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
      aria-label="Video Tutorials"
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
        alt="Video Tutorials"
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
  ]).isRequired,
  sx: PropTypes.object
};
