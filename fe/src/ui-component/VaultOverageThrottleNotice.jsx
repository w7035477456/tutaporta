import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { useSyncExternalStore } from 'react';
import {
  VAULT_OVERAGE_THROTTLE_BUSY_MESSAGE_PARTS,
  getRecordVaultOverageThrottleFactor,
  subscribeRecordVaultOverageThrottle,
  vaultOverageThrottleBlinkSx
} from 'utils/recordVaultOverageThrottleUi';

/** Live slowdown multiple published by the usage bar (1 = full speed). */
function useThrottleFactor() {
  return useSyncExternalStore(
    subscribeRecordVaultOverageThrottle,
    getRecordVaultOverageThrottleFactor,
    () => 1
  );
}

/**
 * Full refill/throttle notice with only "Transfer Speed is being throttled 10x"
 * blinking red (the multiple comes from the live throttle factor).
 */
export default function VaultOverageThrottleNotice({ component = 'span', sx, factor = null }) {
  const liveFactor = useThrottleFactor();
  const multiple = Number(factor) > 1 ? Number(factor) : liveFactor;
  const parts = VAULT_OVERAGE_THROTTLE_BUSY_MESSAGE_PARTS;
  return (
    <Box component={component} sx={sx}>
      {parts.before}
      <Box component="span" sx={vaultOverageThrottleBlinkSx}>
        {multiple > 1 ? `${parts.blink} ${multiple}x` : parts.blink}
      </Box>
      {parts.after}
    </Box>
  );
}

VaultOverageThrottleNotice.propTypes = {
  component: PropTypes.elementType,
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  /** Explicit multiple; omit to use the live throttle factor. */
  factor: PropTypes.number
};

/**
 * Compact usage-bar phrase: "speed throttled 10x", blinking red like the full
 * busy-overlay notice. Shows just "speed throttled" when the multiple is
 * unknown / 1×.
 */
export function VaultOverageSpeedThrottledPhrase({ sx, factor = null }) {
  const liveFactor = useThrottleFactor();
  const multiple = Number(factor) > 1 ? Number(factor) : liveFactor;
  return (
    <Box component="span" sx={{ ...vaultOverageThrottleBlinkSx, ...(sx || null) }}>
      {multiple > 1 ? `speed throttled ${multiple}x` : 'speed throttled'}
    </Box>
  );
}

VaultOverageSpeedThrottledPhrase.propTypes = {
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  /** Explicit multiple; omit to use the live throttle factor. */
  factor: PropTypes.number
};
