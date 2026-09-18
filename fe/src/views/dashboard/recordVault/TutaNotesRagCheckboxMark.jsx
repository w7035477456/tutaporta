import Box from '@mui/material/Box';
import PropTypes from 'prop-types';

/** RAG note checkbox — yellow + ✓ when selected, empty white box when not. */
export default function TutaNotesRagCheckboxMark({ selected = false, disabled = false }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: 20,
        height: 20,
        flexShrink: 0,
        borderRadius: 0.5,
        boxSizing: 'border-box',
        border: '2px solid #000',
        bgcolor: selected ? 'var(--theme-yellow-color)' : '#fff',
        color: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 900,
        fontSize: '0.95rem',
        lineHeight: 1,
        userSelect: 'none',
        opacity: disabled ? 0.55 : 1,
        pointerEvents: 'none'
      }}
    >
      {selected ? '✓' : null}
    </Box>
  );
}

TutaNotesRagCheckboxMark.propTypes = {
  selected: PropTypes.bool,
  disabled: PropTypes.bool
};

export const tutaNotesRagCheckboxButtonSx = {
  position: 'relative',
  flex: '0 0 auto',
  width: 33,
  height: 33,
  p: 0,
  minWidth: 0,
  border: 'none',
  borderRadius: '4px',
  bgcolor: 'transparent !important',
  cursor: 'pointer',
  lineHeight: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  WebkitTapHighlightColor: 'transparent',
  '&:focus': { outline: 'none' },
  '&:focus-visible': {
    outline: '2px solid #000',
    outlineOffset: 1
  },
  '&:disabled': {
    cursor: 'not-allowed',
    opacity: 0.55
  }
};
