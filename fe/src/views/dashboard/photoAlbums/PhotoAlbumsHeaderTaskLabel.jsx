import PropTypes from 'prop-types';
import Box from '@mui/material/Box';

/** Red dashed section label for TutaPhotoAlbums header tasks. */
export default function PhotoAlbumsHeaderTaskLabel({ children, sx = null }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        fontWeight: 900,
        fontSize: { xs: '0.72rem', sm: '0.82rem' },
        color: '#c62828',
        border: '2px dashed #c62828',
        borderRadius: 0.5,
        px: 0.75,
        py: 0.15,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        flex: '0 0 auto',
        ...sx
      }}
    >
      {children}
    </Box>
  );
}

PhotoAlbumsHeaderTaskLabel.propTypes = {
  children: PropTypes.node.isRequired,
  sx: PropTypes.object
};
