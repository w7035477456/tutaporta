import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { COLOR_TEMPLATE13_DISABLED_BG } from 'config/colorTemplate13DisableGreenButton';

const SMS_SLOT_DISABLED_BG = COLOR_TEMPLATE13_DISABLED_BG;
const SMS_SLOT_ENABLED_BG = '#fff';

/** SMS code slots — readOnly (not disabled) so Linux/Ubuntu browsers accept keyboard input. */
export function smsVerificationDigitSlotSx({ enabled, locked = false, hasError = false } = {}) {
  const activeVisual = enabled || locked;
  return {
    boxSizing: 'border-box',
    flex: '0 0 auto',
    width: { xs: 46, sm: 52 },
    height: { xs: 46, sm: 52 },
    minWidth: { xs: 46, sm: 52 },
    maxWidth: { xs: 46, sm: 52 },
    textAlign: 'center',
    fontSize: { xs: '1.25rem', sm: '1.35rem' },
    fontWeight: 700,
    border: '2px solid',
    borderColor: hasError ? 'error.main' : activeVisual ? '#000' : '#bdbdbd',
    borderRadius: 1,
    bgcolor: activeVisual ? `${SMS_SLOT_ENABLED_BG} !important` : SMS_SLOT_DISABLED_BG,
    backgroundColor: activeVisual ? `${SMS_SLOT_ENABLED_BG} !important` : SMS_SLOT_DISABLED_BG,
    color: activeVisual ? '#000 !important' : '#757575',
    WebkitTextFillColor: activeVisual ? '#000 !important' : '#757575',
    opacity: 1,
    cursor: enabled ? 'text' : 'not-allowed',
    WebkitAppearance: 'none',
    MozAppearance: 'textfield',
    pointerEvents: enabled ? 'auto' : 'none',
    '&:focus': enabled
      ? {
          outline: 'none',
          borderColor: hasError ? 'error.main' : 'var(--theme-primary-color)',
          boxShadow: hasError ? 'none' : '0 0 0 2px var(--theme-primary-color)'
        }
      : { outline: 'none' }
  };
}

export default function SmsVerificationDigitRow({
  codeChars,
  enabled,
  locked = false,
  hasError = false,
  slotRefs,
  onSlotChange,
  onSlotKeyDown,
  onPaste
}) {
  const renderSlot = (index) => (
    <Box
      key={index}
      component="input"
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete={index === 0 ? 'one-time-code' : 'off'}
      maxLength={1}
      readOnly={!enabled}
      tabIndex={enabled ? 0 : -1}
      value={codeChars[index] ?? ''}
      onInput={(e) => onSlotChange(index, e)}
      onChange={(e) => onSlotChange(index, e)}
      onKeyDown={(e) => onSlotKeyDown(index, e)}
      ref={(el) => {
        if (slotRefs?.current) slotRefs.current[index] = el;
      }}
      sx={smsVerificationDigitSlotSx({ enabled, locked, hasError })}
      aria-label={`Verification code digit ${index + 1} of 6`}
      aria-readonly={!enabled}
    />
  );

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'nowrap',
        gap: { xs: 0.5, sm: 0.75 },
        width: '100%',
        minWidth: 0,
        py: 0.5
      }}
      onPaste={onPaste}
    >
      {[0, 1, 2].map(renderSlot)}
      <Box sx={{ width: { xs: 10, sm: 14 }, flexShrink: 0 }} aria-hidden />
      {[3, 4, 5].map(renderSlot)}
    </Box>
  );
}

SmsVerificationDigitRow.propTypes = {
  codeChars: PropTypes.arrayOf(PropTypes.string).isRequired,
  enabled: PropTypes.bool.isRequired,
  locked: PropTypes.bool,
  hasError: PropTypes.bool,
  slotRefs: PropTypes.shape({ current: PropTypes.array }),
  onSlotChange: PropTypes.func.isRequired,
  onSlotKeyDown: PropTypes.func.isRequired,
  onPaste: PropTypes.func
};
