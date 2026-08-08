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

function LogicToggle({ value, onChange, ariaLabel }) {
  const isAnd = value === 'and';
  return (
    <SliderControlButton
      type="button"
      variant="yellow"
      hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
      aria-label={ariaLabel}
      aria-pressed={isAnd}
      onClick={() => onChange(isAnd ? 'or' : 'and')}
      sx={{
        flex: '0 0 auto',
        width: 'auto',
        minWidth: 0,
        height: 'auto',
        flexDirection: 'column',
        lineHeight: 0.9,
        px: { xs: 0.2, sm: 0.3 },
        py: { xs: 0.08, sm: 0.12 }
      }}
    >
      <Box component="span" sx={{ opacity: isAnd ? 1 : 0.4 }}>
        And
      </Box>
      <Box component="span" sx={{ opacity: isAnd ? 0.4 : 1 }}>
        Or
      </Box>
    </SliderControlButton>
  );
}

const searchActionButtonSx = {
  width: 'max-content',
  minWidth: 'max-content',
  maxWidth: '100%',
  lineHeight: 1.1,
  px: { xs: 0.55, sm: 0.7 },
  py: { xs: 0.28, sm: 0.34 },
  whiteSpace: 'nowrap'
};

LogicToggle.propTypes = {
  value: PropTypes.oneOf(['and', 'or']).isRequired,
  onChange: PropTypes.func.isRequired,
  ariaLabel: PropTypes.string
};

export default function RecordVaultSearchBar({
  term1,
  term2,
  op1,
  onTerm1Change,
  onTerm2Change,
  onOp1Change,
  onSubmit,
  onClear,
  searchBusy = false,
  clearDisabled = false,
  bgcolor = '#0d0d0d'
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
        flex: 1,
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 0.35, sm: 0.5 },
        px: { xs: 0.5, sm: 0.75 },
        py: 0.75,
        bgcolor
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
        placeholder="Term 1"
        value={term1}
        onChange={(e) => onTerm1Change(e.target.value)}
        onKeyDown={handleKeyDown}
        sx={searchFieldSx}
        inputProps={{ 'aria-label': 'Search term 1' }}
      />
      <LogicToggle value={op1} onChange={onOp1Change} ariaLabel="Toggle And or Or between term 1 and term 2" />
      <TextField
        size="small"
        placeholder="Term 2"
        value={term2}
        onChange={(e) => onTerm2Change(e.target.value)}
        onKeyDown={handleKeyDown}
        sx={searchFieldSx}
        inputProps={{ 'aria-label': 'Search term 2' }}
      />
    </Box>
  );
}

RecordVaultSearchBar.propTypes = {
  term1: PropTypes.string,
  term2: PropTypes.string,
  op1: PropTypes.oneOf(['and', 'or']),
  onTerm1Change: PropTypes.func,
  onTerm2Change: PropTypes.func,
  onOp1Change: PropTypes.func,
  onSubmit: PropTypes.func,
  onClear: PropTypes.func,
  searchBusy: PropTypes.bool,
  clearDisabled: PropTypes.bool,
  bgcolor: PropTypes.string
};
