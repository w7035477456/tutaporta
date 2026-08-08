import PropTypes from 'prop-types';
import { useLocation } from 'react-router-dom';
import BackgroundMusicFooterControls from 'ui-component/BackgroundMusicFooterControls';

export default function MusicTrack({ variant = 'footer', overlayZIndex, centerInWindow = false }) {
  const { pathname } = useLocation();
  const musicSuppressedPath = /^\/pages\/login(?:\/|$)/.test(String(pathname ?? ''));
  const canShowMusicControls = !musicSuppressedPath;

  if (!canShowMusicControls) return null;
  return (
    <BackgroundMusicFooterControls
      variant={variant}
      overlayZIndex={overlayZIndex}
      centerInWindow={centerInWindow}
    />
  );
}

MusicTrack.propTypes = {
  variant: PropTypes.oneOf(['footer', 'fixed', 'sidebar']),
  overlayZIndex: PropTypes.number,
  centerInWindow: PropTypes.bool
};
