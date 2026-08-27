import PropTypes from 'prop-types';
import Box from '@mui/material/Box';

/** Four-way arrows + yellow "Click & Drag" hint for Pan Zoom mode in Add Text preview. */
export default function PlaceTextPanDragOverlay({ sx = null }) {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.75,
        pointerEvents: 'none',
        px: 1,
        ...sx
      }}
    >
      <Box
        component="svg"
        viewBox="0 0 100 100"
        sx={{ width: { xs: 64, sm: 88 }, height: 'auto', opacity: 0.95 }}
      >
        <g fill="#FFEB3B" stroke="#000000" strokeWidth={2}>
          <path d="M 50 6 L 64 30 L 36 30 Z" />
          <path d="M 50 94 L 36 70 L 64 70 Z" />
          <path d="M 6 50 L 30 36 L 30 64 Z" />
          <path d="M 94 50 L 70 36 L 70 64 Z" />
        </g>
      </Box>
      <Box
        component="span"
        sx={{
          fontFamily: 'Algerian, fantasy',
          fontWeight: 900,
          fontSize: { xs: '1.15rem', sm: '1.45rem' },
          lineHeight: 1.15,
          color: '#FFEB3B !important',
          WebkitTextFillColor: '#FFEB3B !important',
          WebkitTextStroke: '2px #000000',
          paintOrder: 'stroke fill',
          textShadow: '0 0 2px #000, 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
          textAlign: 'center',
          userSelect: 'none'
        }}
      >
        Click & Drag
      </Box>
    </Box>
  );
}

PlaceTextPanDragOverlay.propTypes = {
  sx: PropTypes.object
};
