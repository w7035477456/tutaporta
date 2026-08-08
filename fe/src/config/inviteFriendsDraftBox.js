import { INVERSE_DAYNIGHT_VAR, SECONDARY_VAR } from 'utils/themeConfig';

/** Dotted draft container — Post FB + Refer Email */
export const inviteFriendsDraftBoxSx = {
  width: '100%',
  border: '2px dashed',
  borderColor: 'warning.main',
  borderRadius: 1,
  p: 1.5,
  bgcolor: `var(${SECONDARY_VAR})`,
  color: `var(${INVERSE_DAYNIGHT_VAR})`
};

/** Template + promo footer text inside the dotted container */
export const inviteFriendsDraftTextSx = {
  fontFamily: '"Times New Roman", Times, serif',
  fontStyle: 'italic',
  color: `var(${INVERSE_DAYNIGHT_VAR})`,
  whiteSpace: 'pre-line'
};

/** Applied to MuiOutlinedInput root so ProfilesRecords page theme skips these fields. */
export const INVITE_FRIENDS_WHITE_INPUT_CLASS = 'invite-friends-white-field';

export function inviteFriendsWhiteInputSlotProps(overrides = {}) {
  return {
    input: {
      className: INVITE_FRIENDS_WHITE_INPUT_CLASS,
      ...overrides.input
    },
    htmlInput: {
      style: { color: '#000000', WebkitTextFillColor: '#000000' },
      ...overrides.htmlInput
    }
  };
}

/** Email + optional inputs — always white bg, black text/border (overrides ProfilesRecords page theme). */
export const inviteFriendsWhiteInputFieldSx = {
  '& .MuiInputBase-root': {
    bgcolor: '#ffffff !important',
    backgroundColor: '#ffffff !important',
    color: '#000000 !important'
  },
  '& .MuiOutlinedInput-root': {
    bgcolor: '#ffffff !important',
    backgroundColor: '#ffffff !important',
    color: '#000000 !important',
    '& fieldset': { borderColor: '#000000 !important' },
    '&:hover fieldset': { borderColor: '#000000 !important' },
    '&.Mui-focused fieldset': { borderColor: '#000000 !important' },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#000000 !important' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#000000 !important' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000 !important' },
    '&.Mui-disabled': { bgcolor: '#ffffff !important', backgroundColor: '#ffffff !important', opacity: 0.7 }
  },
  '& .MuiOutlinedInput-input': {
    color: '#000000 !important',
    WebkitTextFillColor: '#000000 !important',
    caretColor: '#000000'
  },
  '& .MuiInputBase-input': {
    color: '#000000 !important',
    WebkitTextFillColor: '#000000 !important',
    caretColor: '#000000'
  },
  '& .MuiInputBase-inputMultiline': {
    color: '#000000 !important',
    WebkitTextFillColor: '#000000 !important',
    caretColor: '#000000'
  },
  '& .MuiInputBase-input::placeholder': {
    color: 'rgba(0,0,0,0.55) !important',
    WebkitTextFillColor: 'rgba(0,0,0,0.55) !important',
    opacity: 1
  },
  '& .MuiInputBase-input:-webkit-autofill': {
    WebkitBoxShadow: '0 0 0 100px #ffffff inset !important',
    WebkitTextFillColor: '#000000 !important',
    caretColor: '#000000'
  }
};
