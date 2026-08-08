import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import {
  VAULT_OVERAGE_THROTTLE_BUSY_MESSAGE_PARTS,
  vaultOverageThrottleBlinkSx
} from 'utils/recordVaultOverageThrottleUi';

/**
 * Full refill/throttle notice with only "Transfer Speed is being throttled" blinking red.
 */
export default function VaultOverageThrottleNotice({ component = 'span', sx }) {
  const parts = VAULT_OVERAGE_THROTTLE_BUSY_MESSAGE_PARTS;
  return (
    <Box component={component} sx={sx}>
      {parts.before}
      <Box component="span" sx={vaultOverageThrottleBlinkSx}>
        {parts.blink}
      </Box>
      {parts.after}
    </Box>
  );
}

VaultOverageThrottleNotice.propTypes = {
  component: PropTypes.elementType,
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.array])
};

/** Compact usage-bar phrase: blinks red like the full busy-overlay notice. */
export function VaultOverageSpeedThrottledPhrase({ sx }) {
  return (
    <Box component="span" sx={{ ...vaultOverageThrottleBlinkSx, ...(sx || null) }}>
      speed throttled
    </Box>
  );
}

VaultOverageSpeedThrottledPhrase.propTypes = {
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.array])
};
