import PropTypes from 'prop-types';
import Box from '@mui/material/Box';

/** Permanent album photo index — yellow digits, black outline, no background box. */
export default function PhotoAlbumsSeqBadge({ seq, sx = {} }) {
  const n = Number(seq);
  if (!Number.isFinite(n) || n < 1) return null;
  return (
    <Box
      component="span"
      className="rv-album-photo-seq"
      aria-hidden
      sx={{
        position: 'absolute',
        right: 4,
        bottom: 4,
        zIndex: 8,
        display: 'block',
        bgcolor: 'transparent',
        border: 'none',
        borderRadius: 0,
        boxShadow: 'none',
        p: 0,
        m: 0,
        minWidth: 0,
        color: '#FFEB3B',
        WebkitTextFillColor: '#FFEB3B',
        WebkitTextStroke: '2px #000000',
        paintOrder: 'stroke fill',
        textShadow: '0 1px 0 #000, 0 0 3px #000',
        fontWeight: 900,
        fontSize: '1rem',
        lineHeight: 1,
        textAlign: 'right',
        pointerEvents: 'none',
        userSelect: 'none',
        ...sx
      }}
    >
      {n}
    </Box>
  );
}

PhotoAlbumsSeqBadge.propTypes = {
  seq: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  sx: PropTypes.object
};
