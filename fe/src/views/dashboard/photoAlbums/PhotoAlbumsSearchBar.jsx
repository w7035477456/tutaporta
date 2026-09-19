import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import GlobalStyles from '@mui/material/GlobalStyles';
import TextField from '@mui/material/TextField';
import SliderControlButton, {
  SLIDER_CONTROL_BUTTON_HOVER_SCALE_15
} from 'ui-component/SliderControlButton';

/**
 * Surround behind Search / Clear / search input — always theme primary.
 * Document-level rule so the daylight (#F0F0F0) panel surface never shows through.
 */
const SEARCH_SURROUND_ATTR = 'data-vault-search-surround';
const searchSurroundGlobalStyles = {
  [`[${SEARCH_SURROUND_ATTR}], [${SEARCH_SURROUND_ATTR}] > div:not(.MuiFormControl-root)`]: {
    backgroundColor: 'var(--theme-primary-color) !important',
    backgroundImage: 'none !important'
  }
};

/** White typing field only — surround is the primary-colored flex wrapper. */
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

const headerFlushSearchInputFieldSx = {
  flex: '0 1 auto',
  width: { xs: '100%', sm: '14rem' },
  maxWidth: '100%',
  m: 0,
  '& .MuiInputBase-root': {
    bgcolor: '#ffffff !important',
    borderRadius: 1,
    border: '2px solid #000',
    fontSize: { xs: '0.9rem', sm: '1rem' }
  },
  '& .MuiInputBase-input': {
    bgcolor: 'transparent !important',
    color: '#000',
    WebkitTextFillColor: '#000',
    py: { xs: 0.85, sm: 1 }
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

export default function PhotoAlbumsSearchBar({
  term1,
  onTerm1Change,
  onSubmit,
  onClear,
  searchBusy = false,
  clearDisabled = false,
  bgcolor = 'var(--theme-primary-color)',
  /** When false, bar sits on the right of the strip instead of filling remaining width. */
  fillWidth = true,
  /** Header row: sit flush against Invite bar (no trailing padding/gap). */
  headerFlush = false,
  placeholder = 'Search text on album pages'
}) {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onSubmit?.();
    }
  };

  const inputWrapSx = headerFlush
    ? {
        flex: '1 1 0',
        minWidth: { xs: '6rem', sm: '8rem' },
        maxWidth: { xs: '100%', md: '14rem' }
      }
    : {
        flex: '1 1 0',
        minWidth: { xs: 72, sm: 120 }
      };

  return (
    <>
    <GlobalStyles styles={searchSurroundGlobalStyles} />
    <Box
      {...{ [SEARCH_SURROUND_ATTR]: 'true' }}
      sx={{
        flex: headerFlush ? '0 1 auto' : fillWidth ? 1 : '0 1 auto',
        minWidth: headerFlush ? { xs: '100%', md: '12rem' } : fillWidth ? 0 : { xs: 200, sm: 280 },
        maxWidth: headerFlush ? { xs: '100%', md: '20rem' } : fillWidth ? 'none' : { xs: '100%', sm: 320, md: 380 },
        alignSelf: 'stretch',
        display: 'flex',
        alignItems: 'stretch',
        gap: headerFlush ? 0 : { xs: 0.35, sm: 0.5 },
        pl: headerFlush ? 0 : { xs: 0.5, sm: 0.75 },
        pr: headerFlush ? 0 : { xs: 0.5, sm: 0.75 },
        py: headerFlush ? 0.25 : fillWidth ? 0.75 : 0.25,
        ml: fillWidth && !headerFlush ? 0 : headerFlush ? 0 : 'auto',
        bgcolor,
        backgroundColor: bgcolor
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
          ...inputWrapSx,
          alignSelf: 'stretch',
          display: 'flex',
          alignItems: 'center',
          bgcolor,
          backgroundColor: bgcolor
        }}
      >
        <TextField
          size="small"
          placeholder={placeholder}
          value={term1}
          onChange={(e) => onTerm1Change(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={headerFlush ? headerFlushSearchInputFieldSx : searchInputFieldSx}
          inputProps={{ 'aria-label': 'Search albums' }}
        />
      </Box>
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
  headerFlush: PropTypes.bool,
  placeholder: PropTypes.string
};
