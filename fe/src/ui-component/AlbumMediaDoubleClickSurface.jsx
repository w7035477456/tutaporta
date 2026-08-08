import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { usePhotoDoubleClickOpen } from 'utils/photoDoubleClickOpen';

export default function AlbumMediaDoubleClickSurface({ mediaUrl, onOpenFullscreen, sx, children, ...rest }) {
  const openFullscreen = () => onOpenFullscreen?.(mediaUrl);
  const { handleClick, handleDoubleClick, doubleClickSx } = usePhotoDoubleClickOpen(openFullscreen);

  return (
    <Box
      sx={{ ...doubleClickSx, ...(sx || {}) }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      {...rest}
    >
      {children}
    </Box>
  );
}

AlbumMediaDoubleClickSurface.propTypes = {
  mediaUrl: PropTypes.string.isRequired,
  onOpenFullscreen: PropTypes.func,
  sx: PropTypes.object,
  children: PropTypes.node
};
