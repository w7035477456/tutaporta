/**
 * Raffle buttons (floating "Get My Raffle Ticket", mall "Get My Raffle", "Generate My Raffle", payout Submit)
 * are always green with black text on every theme — themed button templates remap green on some palettes.
 */
export const RAFFLE_BUTTON_GREEN = '#60C446';
export const RAFFLE_BUTTON_TEXT = '#000000';

/** Merge into a button's sx; disabled buttons keep their own grey. */
export const raffleButtonColorSx = {
  '&&&:not(:disabled):not(.Mui-disabled), &&&:not(:disabled):not(.Mui-disabled):hover': {
    backgroundColor: `${RAFFLE_BUTTON_GREEN} !important`,
    backgroundImage: 'none !important',
    color: `${RAFFLE_BUTTON_TEXT} !important`,
    WebkitTextFillColor: `${RAFFLE_BUTTON_TEXT} !important`,
    borderColor: '#000 !important'
  }
};
