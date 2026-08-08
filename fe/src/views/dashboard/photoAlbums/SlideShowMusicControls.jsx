import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import MusicTrack from 'ui-component/MusicTrack';
import { useSlideshowMusicUiElevation } from 'hooks/useSlideshowMusicUiElevation';
import {
  PHOTO_ALBUMS_SLIDESHOW_BASE_Z,
  PHOTO_ALBUMS_SLIDESHOW_MUSIC_CONTROLS_Z,
  photoAlbumsSlideshowTrackDialogZ
} from 'config/photoAlbumsLayout';

/**
 * Bottom-right Mute / volume / Track bar for album or photo slideshows.
 * Reuses the same MusicTrack footer controls as the main app frame.
 */
export default function SlideShowMusicControls({
  zIndex = PHOTO_ALBUMS_SLIDESHOW_MUSIC_CONTROLS_Z,
  slideshowBaseZ = PHOTO_ALBUMS_SLIDESHOW_BASE_Z
}) {
  useSlideshowMusicUiElevation(true, slideshowBaseZ);

  return (
    <Box
      data-no-click-sound
      sx={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex,
        maxWidth: { xs: 'min(100vw - 20px, 420px)', sm: 520 },
        bgcolor: 'var(--theme-daynight-color)',
        border: '1px solid var(--theme-primary-color)',
        borderRadius: 1,
        p: 1,
        pointerEvents: 'auto'
      }}
    >
      <MusicTrack
        variant="footer"
        overlayZIndex={photoAlbumsSlideshowTrackDialogZ(slideshowBaseZ)}
        centerInWindow
      />
    </Box>
  );
}

SlideShowMusicControls.propTypes = {
  zIndex: PropTypes.number,
  slideshowBaseZ: PropTypes.number
};
