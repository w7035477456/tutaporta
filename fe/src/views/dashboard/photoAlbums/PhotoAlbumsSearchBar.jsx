import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import SliderControlButton, {
  SLIDER_CONTROL_BUTTON_HOVER_SCALE_15
} from 'ui-component/SliderControlButton';

const searchFieldSx = {
  flex: '1 1 0',
  minWidth: { xs: 72, sm: 120 },
  '& .MuiInputBase-root': {
    bgcolor: '#fff',
    borderRadius: 1,
    fontSize: { xs: '1.7rem', sm: '1.9rem' }
  },
  '& .MuiInputBase-input': {
    color: '#000',
    WebkitTextFillColor: '#000',
    py: 1.5
  }
};

const searchActionButtonSx = {
  width: 'max-content',
  minWidth: 'max-content',
  maxWidth: '100%',
  lineHeight: 1.1,
  px: { xs: 0.55, sm: 0.7 },
  py: { xs: 0.28, sm: 0.34 },
  whiteSpace: 'nowrap'
};

export default function PhotoAlbumsSearchBar({
  term1,
  onTerm1Change,
  onSubmit,
  onClear,
  searchBusy = false,
  clearDisabled = false,
  bgcolor = '#0d0d0d',
  /** When false, bar sits on the right of the strip instead of filling remaining width. */
  fillWidth = true,
  placeholder = 'Search text on album pages'
}) {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onSubmit?.();
    }
  };

  return (
    <Box
      sx={{
        flex: fillWidth ? 1 : '0 1 auto',
        minWidth: fillWidth ? 0 : { xs: 200, sm: 280 },
        maxWidth: fillWidth ? 'none' : { xs: '100%', sm: 320, md: 380 },
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 0.35, sm: 0.5 },
        px: { xs: 0.5, sm: 0.75 },
        py: fillWidth ? 0.75 : 0.25,
        bgcolor,
        ml: fillWidth ? 0 : 'auto'
      }}
    >
      <Box
        sx={{
          flex: '0 0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.35,
          alignItems: 'flex-start',
          flexShrink: 0
        }}
      >
        <SliderControlButton
          type="button"
          disabled={searchBusy}
          aria-busy={searchBusy}
          hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
          onClick={() => onSubmit?.()}
          sx={searchActionButtonSx}
        >
          Search
        </SliderControlButton>
        <SliderControlButton
          type="button"
          disabled={clearDisabled || searchBusy}
          hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
          onClick={() => onClear?.()}
          sx={searchActionButtonSx}
        >
          Clear
        </SliderControlButton>
      </Box>
      <TextField
        size="small"
        placeholder={placeholder}
        value={term1}
        onChange={(e) => onTerm1Change(e.target.value)}
        onKeyDown={handleKeyDown}
        sx={searchFieldSx}
        inputProps={{ 'aria-label': 'Search albums' }}
      />
    </Box>
  );
}

PhotoAlbumsSearchBar.propTypes = {
  term1: PropTypes.string,
  onTerm1Change: PropTypes.func,
  onSubmit: PropTypes.func,
  onClear: PropTypes.func,
  searchBusy: PropTypes.bool,
  clearDisabled: PropTypes.bool,
  bgcolor: PropTypes.string,
  fillWidth: PropTypes.bool,
  placeholder: PropTypes.string
};
