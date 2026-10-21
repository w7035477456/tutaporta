import { useRef } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

const DIGIT_COUNT = 4;
const CLEAR_GREEN = '#5cc84a';
const CLEAR_YELLOW = '#FFD600';

const digitBoxSx = {
  width: { xs: 38, sm: 42 },
  height: { xs: 42, sm: 46 },
  textAlign: 'center',
  fontSize: '1.4rem',
  fontWeight: 700,
  border: '2px solid var(--theme-primary-color)',
  borderRadius: 1,
  bgcolor: '#fff',
  color: '#000',
  outline: 'none',
  p: 0,
  '&:focus': { borderColor: CLEAR_GREEN, boxShadow: `0 0 0 2px ${CLEAR_GREEN}` }
};

const prefixBoxSx = {
  ...digitBoxSx,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  bgcolor: '#e8e8e8',
  mr: 0.75,
  userSelect: 'none'
};

/**
 * Refer code entry — fixed letter box (e.g. R / A) + 4 single-digit boxes + Clear.
 * `value` is the 0–4 typed digits only (no letter); parents add `prefix` when sending.
 */
export default function ReferCodeInput({ label, prefix, value, onChange, disabled = false }) {
  const inputsRef = useRef([]);
  const digits = Array.from({ length: DIGIT_COUNT }, (_, i) => value[i] || '');

  const focusAt = (index) => inputsRef.current[Math.max(0, Math.min(DIGIT_COUNT - 1, index))]?.focus();

  const setDigits = (next) => onChange(next.join('').replace(/\D/g, '').slice(0, DIGIT_COUNT));

  const handleChange = (index) => (e) => {
    const typed = e.target.value.replace(/\D/g, '');
    if (!typed) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }
    const next = [...digits];
    typed
      .slice(0, DIGIT_COUNT - index)
      .split('')
      .forEach((d, offset) => {
        next[index + offset] = d;
      });
    setDigits(next);
    focusAt(index + typed.length);
  };

  const handleKeyDown = (index) => (e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      focusAt(index - 1);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      focusAt(index - 1);
    } else if (e.key === 'ArrowRight') {
      focusAt(index + 1);
    }
  };

  return (
    <Box sx={{ mt: 2, width: '100%' }}>
      <Typography sx={{ color: 'var(--theme-primary-color)', fontWeight: 600, fontSize: { xs: '1.05rem', sm: '1.2rem' } }}>
        {label}{' '}
        <Box component="span" sx={{ fontWeight: 400, fontSize: '0.9em' }}>
          (If applicable, optional)
        </Box>
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.75 }}>
        <Box aria-hidden sx={prefixBoxSx}>
          {prefix}
        </Box>
        {digits.map((digit, index) => (
          <Box
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            component="input"
            ref={(el) => {
              inputsRef.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={DIGIT_COUNT}
            aria-label={`${label} digit ${index + 1} (after ${prefix})`}
            value={digit}
            disabled={disabled}
            onChange={handleChange(index)}
            onKeyDown={handleKeyDown(index)}
            onFocus={(e) => e.target.select()}
            sx={digitBoxSx}
          />
        ))}
        <Box
          component="button"
          type="button"
          onClick={() => {
            onChange('');
            focusAt(0);
          }}
          disabled={disabled || !value}
          sx={{
            ml: 1.5,
            px: 3,
            height: { xs: 38, sm: 40 },
            border: 0,
            borderRadius: 1.5,
            bgcolor: CLEAR_YELLOW,
            color: '#000',
            fontSize: '1.15rem',
            fontWeight: 600,
            cursor: 'pointer',
            '&:disabled': { color: '#757575', cursor: 'default' }
          }}
        >
          Clear
        </Box>
      </Box>
    </Box>
  );
}

ReferCodeInput.propTypes = {
  label: PropTypes.string.isRequired,
  prefix: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool
};
