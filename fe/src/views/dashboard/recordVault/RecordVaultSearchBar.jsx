import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import GlobalStyles from '@mui/material/GlobalStyles';
import TextField from '@mui/material/TextField';
import SliderControlButton, {
  SLIDER_CONTROL_BUTTON_HOVER_SCALE_15
} from 'ui-component/SliderControlButton';

/**
 * Surround behind Search / Clear / Term 1 — always theme secondary.
 * Document-level rule so the daylight (#F0F0F0) panel surface never shows through.
 */
const SEARCH_SURROUND_ATTR = 'data-vault-search-surround';
const SEARCH_SURROUND_VAR = '--vault-search-surround';
const searchSurroundGlobalStyles = {
  [`[${SEARCH_SURROUND_ATTR}], [${SEARCH_SURROUND_ATTR}] > div:not(.MuiFormControl-root)`]: {
    backgroundColor: `var(${SEARCH_SURROUND_VAR}) !important`,
    backgroundImage: 'none !important'
  }
};

/** White typing field only — surround is the secondary-colored flex wrapper. */
const searchInputFieldSx = {
  flex: '0 1 auto',
  width: { xs: '100%', sm: 320 },
  maxWidth: '100%',
  m: 0,
  '& .MuiInputBase-root': {
    bgcolor: '#ffffff !important',
    borderRadius: 1,
    border: '2px solid #000',
    fontSize: { xs: '1.7rem', sm: '1.9rem' }
  },
  '& .MuiInputBase-input': {
    bgcolor: 'transparent !important',
    color: '#000',
    WebkitTextFillColor: '#000',
    py: 1.5
  },
  '& .MuiOutlinedInput-notchedOutline': {
    border: 'none'
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

export default function RecordVaultSearchBar({
  term1,
  onTerm1Change,
  onSubmit,
  onClear,
  searchBusy = false,
  clearDisabled = false,
  bgcolor = 'var(--theme-secondary-color)',
  sx
}) {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onSubmit?.();
    }
  };

  return (
    <>
    <GlobalStyles styles={searchSurroundGlobalStyles} />
    <Box
      {...{ [SEARCH_SURROUND_ATTR]: 'true' }}
      sx={{
        [SEARCH_SURROUND_VAR]: bgcolor,
        flex: 1,
        minWidth: 0,
        alignSelf: 'stretch',
        display: 'flex',
        alignItems: 'stretch',
        gap: { xs: 0.35, sm: 0.5 },
        px: { xs: 0.5, sm: 0.75 },
        py: 0.75,
        bgcolor,
        backgroundColor: bgcolor,
        ...sx
      }}
    >
      <Box
        sx={{
          flex: '0 0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.35,
          alignItems: 'flex-start',
          flexShrink: 0,
          justifyContent: 'center'
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
      <Box
        sx={{
          // Grow to fill the strip, but keep the white field bounded so the
          // theme-secondary surround stays visible to the right of it.
          flex: '1 1 0',
          minWidth: 0,
          alignSelf: 'stretch',
          display: 'flex',
          alignItems: 'center',
          bgcolor,
          backgroundColor: bgcolor
        }}
      >
        <TextField
          size="small"
          placeholder="Term 1"
          value={term1}
          onChange={(e) => onTerm1Change(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={searchInputFieldSx}
          inputProps={{ 'aria-label': 'Search term' }}
        />
      </Box>
    </Box>
    </>
  );
}

RecordVaultSearchBar.propTypes = {
  term1: PropTypes.string,
  onTerm1Change: PropTypes.func,
  onSubmit: PropTypes.func,
  onClear: PropTypes.func,
  searchBusy: PropTypes.bool,
  clearDisabled: PropTypes.bool,
  bgcolor: PropTypes.string,
  sx: PropTypes.object
};
