import PropTypes from 'prop-types';
import Typography from '@mui/material/Typography';

export const photoAlbumsTrayCountLabelSx = {
  fontWeight: 800,
  fontSize: { xs: '0.72rem', sm: '0.82rem' },
  color: '#000 !important',
  WebkitTextFillColor: '#000 !important',
  lineHeight: 1.2,
  userSelect: 'none',
  whiteSpace: 'nowrap'
};

/** `Count=N` — file/image count for staging tray, page filmstrip, or folder panel. */
export default function PhotoAlbumsTrayCountLabel({ count = 0, component = 'span', sx }) {
  const n = Math.max(0, Math.round(Number(count) || 0));
  return (
    <Typography component={component} sx={{ ...photoAlbumsTrayCountLabelSx, ...sx }}>
      Count={n}
    </Typography>
  );
}

PhotoAlbumsTrayCountLabel.propTypes = {
  count: PropTypes.number,
  component: PropTypes.elementType,
  sx: PropTypes.object
};
