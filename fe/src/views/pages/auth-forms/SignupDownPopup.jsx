import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Stack from '@mui/material/Stack';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import { getApiBaseUrl } from 'config/apiBaseUrl';

/** Shown when ~/.ssh/be/.env SIGNUP_DOWN=true (GET /api/publicConfig.signupDown or 503 from /api/register). */
export const SIGNUP_DOWN_MSG =
  'Our sign up service is awaiting Twilio SMS approval. Please check back in a few days. ' +
  'Meanwhile, log in as "demo" (no password) if you want to check it out in demo mode.';

/** `signupDown` from GET /api/publicConfig; `initial` covers the gap before it answers. */
export function useSignupDown(initial = false) {
  const [signupDown, setSignupDown] = useState(Boolean(initial));
  useEffect(() => {
    let cancelled = false;
    fetch(`${getApiBaseUrl()}/api/publicConfig`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setSignupDown(data.signupDown === true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return [signupDown, setSignupDown];
}

export default function SignupDownPopup({ message, onClose }) {
  return (
    <ColorTemplate7PopupLargeDark
      open={Boolean(message)}
      onClose={onClose}
      closeOnBackdrop
      closeButtonAriaLabel="Close sign up notice"
    >
      <ColorTemplate7PopupLargeDark.Body spacing={2}>
        <ColorTemplate7PopupLargeDark.Title>Sign Up</ColorTemplate7PopupLargeDark.Title>
        <ColorTemplate7PopupLargeDark.BodyText>{message}</ColorTemplate7PopupLargeDark.BodyText>
        <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap" sx={{ width: '100%' }}>
          <ColorTemplate7PopupLargeDark.ActionButton type="button" onClick={onClose}>
            OK
          </ColorTemplate7PopupLargeDark.ActionButton>
        </Stack>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

SignupDownPopup.propTypes = {
  message: PropTypes.string,
  onClose: PropTypes.func.isRequired
};
