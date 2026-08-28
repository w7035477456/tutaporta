import PropTypes from 'prop-types';
import Box from '@mui/material/Box';

/** Permanent album photo index — yellow fill, black border, bottom-right. */
export default function PhotoAlbumsSeqBadge({ seq, sx = {} }) {
  const n = Number(seq);
  if (!Number.isFinite(n) || n < 1) return null;
  return (
    <Box
      className="rv-album-photo-seq"
      aria-hidden
      sx={{
        position: 'absolute',
        right: 4,
        bottom: 4,
        zIndex: 8,
        minWidth: 22,
        px: 0.5,
        py: 0.2,
        bgcolor: 'var(--theme-yellow-color, #ffd700)',
        border: '2px solid #000',
        borderRadius: '4px',
        color: '#000',
        fontWeight: 900,
        fontSize: '0.85rem',
        lineHeight: 1.1,
        textAlign: 'center',
        pointerEvents: 'none',
        userSelect: 'none',
        boxShadow: '0 1px 2px rgba(0,0,0,0.35)',
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
