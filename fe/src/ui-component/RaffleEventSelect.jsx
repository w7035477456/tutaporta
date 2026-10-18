import PropTypes from 'prop-types';
import Autocomplete from '@mui/material/Autocomplete';
import Popper from '@mui/material/Popper';
import TextField from '@mui/material/TextField';

const LIST_BG = '#000';
const LIST_SELECTED = '#1e88e5';
const EMPTY_FIELD_BG = '#6b747c';

/** Always opens below the field (no flip up); as wide as the longest title (never narrower than the field). */
function DropDownPopper(props) {
  const { style, anchorEl, ...rest } = props;
  const fieldWidth = anchorEl?.clientWidth || style?.width;
  return (
    <Popper
      {...rest}
      anchorEl={anchorEl}
      style={{ ...style, width: 'max-content', minWidth: fieldWidth, maxWidth: '96vw' }}
      placement="bottom-start"
      modifiers={[
        { name: 'flip', enabled: false },
        { name: 'preventOverflow', options: { altAxis: true, padding: 8 } }
      ]}
    />
  );
}

DropDownPopper.propTypes = { style: PropTypes.object, anchorEl: PropTypes.any };

/**
 * Raffle event picker for the /mall raffle panel — dark drop-down list (white text, blue selection,
 * one row per event, scroll bar), always below. `options` = [{ value, label }], `value` = selected value or ''.
 */
export default function RaffleEventSelect({ options, value, onChange, placeholder, disabled = false, title }) {
  const selected = options.find((o) => o.value === value) || null;
  return (
    <Autocomplete
      options={options}
      value={selected}
      onChange={(_e, opt) => onChange(opt ? opt.value : '')}
      isOptionEqualToValue={(a, b) => a.value === b.value}
      getOptionLabel={(opt) => opt.label}
      disabled={disabled}
      title={title}
      size="small"
      fullWidth
      openOnFocus
      autoHighlight
      noOptionsText="No events"
      PopperComponent={DropDownPopper}
      slotProps={{
        paper: {
          sx: {
            bgcolor: LIST_BG,
            color: '#fff',
            border: '1px solid #555',
            borderRadius: 0,
            mt: 0.25,
            '& .MuiAutocomplete-noOptions': { color: '#ccc' }
          }
        },
        listbox: {
          sx: {
            maxHeight: 260,
            py: 0.5,
            '& .MuiAutocomplete-option': {
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'block',
              lineHeight: 1.3,
              fontSize: 15,
              minHeight: 0,
              py: 1.25,
              px: 1.5,
              color: '#fff',
              '&.Mui-focused': { bgcolor: 'rgba(30,136,229,0.45)' },
              '&[aria-selected="true"]': { bgcolor: `${LIST_SELECTED} !important`, color: '#fff' }
            },
            '&::-webkit-scrollbar': { width: 10 },
            '&::-webkit-scrollbar-thumb': { bgcolor: '#bbb', borderRadius: 5 },
            '&::-webkit-scrollbar-track': { bgcolor: '#222' }
          }
        }
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={placeholder}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: selected ? LIST_BG : EMPTY_FIELD_BG,
              color: '#fff',
              borderRadius: 1,
              fontSize: 15,
              minHeight: 36,
              py: '2px !important'
            },
            '& .MuiOutlinedInput-input': { color: '#fff', WebkitTextFillColor: '#fff' },
            '& .MuiOutlinedInput-input::placeholder': { color: '#ddd', opacity: 1 },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#888' },
            '& .MuiAutocomplete-endAdornment .MuiSvgIcon-root': { color: '#fff' }
          }}
        />
      )}
    />
  );
}

RaffleEventSelect.propTypes = {
  options: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.string, label: PropTypes.string })).isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  title: PropTypes.string
};
