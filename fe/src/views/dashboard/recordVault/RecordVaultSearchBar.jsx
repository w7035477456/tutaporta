import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import GlobalStyles from '@mui/material/GlobalStyles';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SliderControlButton, { SLIDER_CONTROL_BUTTON_HOVER_SCALE_15 } from 'ui-component/SliderControlButton';

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

/* ---------- Compact variant (note title row: search inside the open note) ---------- */

const compactActionButtonSx = {
  width: 'max-content',
  minWidth: 'max-content',
  flexShrink: 0,
  fontSize: '0.72rem !important',
  lineHeight: 1.05,
  px: '6px',
  py: '2px',
  borderRadius: '6px',
  borderWidth: '2px',
  '& .MuiButton-label': {
    fontSize: '0.72rem !important',
    lineHeight: 1.05
  }
};

const compactInputFieldSx = {
  flex: '0 1 auto',
  width: { xs: 110, sm: 150 },
  minWidth: 0,
  m: 0,
  '& .MuiInputBase-root': {
    bgcolor: '#ffffff !important',
    borderRadius: 0.75,
    border: '2px solid #000',
    fontSize: '0.8rem',
    height: 26
  },
  '& .MuiInputBase-input': {
    bgcolor: 'transparent !important',
    color: '#000',
    WebkitTextFillColor: '#000',
    py: 0.25,
    px: 0.75,
    fontSize: '0.8rem'
  },
  '& .MuiOutlinedInput-notchedOutline': {
    border: 'none'
  }
};

const compactHitNavSx = {
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.25,
  border: '2px solid #000',
  borderRadius: 0.75,
  bgcolor: '#fff',
  px: 0.4,
  py: 0.1
};

const compactNavButtonSx = {
  width: 18,
  height: 18,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  p: 0,
  fontSize: '0.62rem',
  fontWeight: 900,
  lineHeight: 1,
  color: '#000',
  WebkitTextFillColor: '#000',
  bgcolor: 'var(--theme-yellow-color)',
  border: '2px solid #000',
  borderRadius: '4px',
  cursor: 'pointer',
  userSelect: 'none',
  '&:hover:not(:disabled)': { filter: 'brightness(1.05)' },
  '&:disabled': { opacity: 0.35, cursor: 'default' }
};

export default function RecordVaultSearchBar({
  term1,
  onTerm1Change,
  onSubmit,
  onClear,
  searchBusy = false,
  clearDisabled = false,
  bgcolor = 'var(--theme-secondary-color)',
  /** Note-header variant: one compact row, no theme surround (sits on white). */
  compact = false,
  /** Button labels — "Search All" (whole vault) vs "Search Here" (open note). */
  searchLabel = 'Search All',
  clearLabel = 'Clear',
  /** In-note match count + step controls (compact only). */
  hitCount = 0,
  /** True after a Search press, so "no match" can be shown explicitly. */
  searched = false,
  activeHitIndex = -1,
  onPrevHit,
  onNextHit,
  sx
}) {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onSubmit?.();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClear?.();
    }
  };

  if (compact) {
    const hasHits = hitCount > 0;
    return (
      <Box
        aria-label="Search in this note"
        sx={{
          flex: '0 0 auto',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          ...sx
        }}
      >
        <SliderControlButton
          type="button"
          disabled={searchBusy}
          aria-busy={searchBusy}
          hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
          forceBgcolor="#60C446"
          onClick={() => onSubmit?.()}
          sx={compactActionButtonSx}
        >
          {searchLabel}
        </SliderControlButton>
        <SliderControlButton
          type="button"
          disabled={clearDisabled || searchBusy}
          hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
          onClick={() => onClear?.()}
          sx={compactActionButtonSx}
        >
          {clearLabel}
        </SliderControlButton>
        <TextField
          size="small"
          placeholder="In this note"
          value={term1}
          onChange={(e) => onTerm1Change(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={compactInputFieldSx}
          inputProps={{ 'aria-label': 'Search term in this note' }}
        />
        {hasHits ? (
          <Box sx={compactHitNavSx}>
            <Box
              component="button"
              type="button"
              aria-label="Previous match in this note"
              title="Previous match in this note"
              onClick={() => onPrevHit?.()}
              disabled={activeHitIndex <= 0}
              sx={compactNavButtonSx}
            >
              ▲
            </Box>
            <Typography
              component="span"
              sx={{
                fontWeight: 800,
                fontSize: '0.66rem',
                lineHeight: 1,
                color: '#000',
                WebkitTextFillColor: '#000',
                minWidth: 30,
                textAlign: 'center',
                userSelect: 'none'
              }}
            >
              {activeHitIndex >= 0 ? activeHitIndex + 1 : 0}/{hitCount}
            </Typography>
            <Box
              component="button"
              type="button"
              aria-label="Next match in this note"
              title="Next match in this note"
              onClick={() => onNextHit?.()}
              disabled={activeHitIndex >= hitCount - 1}
              sx={compactNavButtonSx}
            >
              ▼
            </Box>
          </Box>
        ) : searched ? (
          <Typography
            component="span"
            sx={{
              flexShrink: 0,
              fontWeight: 800,
              fontSize: '0.66rem',
              lineHeight: 1,
              color: '#c62828',
              WebkitTextFillColor: '#c62828',
              whiteSpace: 'nowrap',
              userSelect: 'none'
            }}
          >
            0/0
          </Typography>
        ) : null}
      </Box>
    );
  }

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
            forceBgcolor="#60C446"
            onClick={() => onSubmit?.()}
            sx={searchActionButtonSx}
          >
            {searchLabel}
          </SliderControlButton>
          <SliderControlButton
            type="button"
            disabled={clearDisabled || searchBusy}
            hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
            onClick={() => onClear?.()}
            sx={searchActionButtonSx}
          >
            {clearLabel}
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
  compact: PropTypes.bool,
  searchLabel: PropTypes.string,
  clearLabel: PropTypes.string,
  hitCount: PropTypes.number,
  searched: PropTypes.bool,
  activeHitIndex: PropTypes.number,
  onPrevHit: PropTypes.func,
  onNextHit: PropTypes.func,
  sx: PropTypes.object
};
