import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
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

/** Tray heading: `Green Tray Count=N` / `Blue Tray Count=N`. */
export function PhotoAlbumsTrayHeading({ title, count = 0, sx }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.75, minWidth: 0, ...sx }}>
      <Typography
        component="span"
        sx={{
          fontWeight: 700,
          fontSize: { xs: '0.95rem', sm: '1.1rem' },
          color: '#000 !important',
          WebkitTextFillColor: '#000 !important',
          lineHeight: 1.2,
          userSelect: 'none',
          whiteSpace: 'nowrap'
        }}
      >
        {title}
      </Typography>
      <PhotoAlbumsTrayCountLabel count={count} />
    </Box>
  );
}

PhotoAlbumsTrayHeading.propTypes = {
  title: PropTypes.string.isRequired,
  count: PropTypes.number,
  sx: PropTypes.object
};
