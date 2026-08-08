import { useState } from 'react';
import PropTypes from 'prop-types';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import { colorTemplate16FormControlSx, colorTemplate16InputSx } from 'config/colorTemplate16InputTemplate';

/**
 * Outlined input — daynight surface, thick inverse-daynight border.
 * Empty + unfocused: label inside at button font size. Focused or filled: label on top border at half size.
 */
export default function ColorTemplate16InputTemplate({
  id,
  label,
  value,
  onChange,
  name,
  type = 'text',
  autoComplete,
  required = false,
  fullWidth = true,
  endAdornment,
  inputProps,
  sx,
  formControlSx
}) {
  const [focused, setFocused] = useState(false);
  const hasValue = String(value ?? '').length > 0;
  const shrinkLabel = focused || hasValue;

  const mergedFormSx = (theme) => {
    const base = colorTemplate16FormControlSx();
    const extra = typeof formControlSx === 'function' ? formControlSx(theme) : formControlSx || {};
    return { ...base, ...extra };
  };

  const mergedInputSx = (theme) => {
    const base = colorTemplate16InputSx();
    const extra = typeof sx === 'function' ? sx(theme) : sx || {};
    return { ...base, ...extra };
  };

  return (
    <FormControl fullWidth={fullWidth} variant="outlined" sx={mergedFormSx}>
      <InputLabel htmlFor={id} shrink={shrinkLabel}>
        {label}
      </InputLabel>
      <OutlinedInput
        id={id}
        label={label}
        value={value}
        onChange={onChange}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        notched={shrinkLabel}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        endAdornment={endAdornment}
        inputProps={inputProps}
        sx={mergedInputSx}
      />
    </FormControl>
  );
}

ColorTemplate16InputTemplate.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  name: PropTypes.string,
  type: PropTypes.string,
  autoComplete: PropTypes.string,
  required: PropTypes.bool,
  fullWidth: PropTypes.bool,
  endAdornment: PropTypes.node,
  inputProps: PropTypes.object,
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  formControlSx: PropTypes.oneOfType([PropTypes.object, PropTypes.func])
};

ColorTemplate16InputTemplate.sx = colorTemplate16InputSx;
ColorTemplate16InputTemplate.formControlSx = colorTemplate16FormControlSx;
