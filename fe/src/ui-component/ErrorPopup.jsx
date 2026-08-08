import { useState, useEffect } from 'react';
import Stack from '@mui/material/Stack';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';

import { isGlobalErrorPopupEnabled } from 'config/globalErrorPopupEnv';

const ERROR_POPUP_EVENT = 'appConsoleError';
const ERROR_POPUP_CLOSE_EVENT = 'appConsoleErrorClose';

/** Handled inside Full Disk Encryption — do not open a second ERROR/OK dialog. */
function isVaultAccessHandledError(message) {
  const text = String(message ?? '');
  return (
    /incorrect encrypt password/i.test(text) ||
    /encrypt password try \d+ of \d+/i.test(text) ||
    /retry cooldown/i.test(text) ||
    /five consecutive fails will cause format/i.test(text) ||
    /vault was formatted after five incorrect/i.test(text)
  );
}

// ================================|| ERROR POPUP (console.error) ||================================ //

export default function ErrorPopup() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleError = (e) => {
      const msg = typeof e.detail === 'string' ? e.detail : (e.detail?.message ?? JSON.stringify(e.detail ?? 'Unknown error'));
      if (isVaultAccessHandledError(msg)) {
        setOpen(false);
        return;
      }
      setMessage(msg);
      setOpen(true);
    };
    const handleClose = () => setOpen(false);
    window.addEventListener(ERROR_POPUP_EVENT, handleError);
    window.addEventListener(ERROR_POPUP_CLOSE_EVENT, handleClose);
    return () => {
      window.removeEventListener(ERROR_POPUP_EVENT, handleError);
      window.removeEventListener(ERROR_POPUP_CLOSE_EVENT, handleClose);
    };
  }, []);

  const handleClose = () => setOpen(false);

  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={handleClose}
      closeOnBackdrop
      closeButtonAriaLabel="Close error popup"
    >
      <ColorTemplate7PopupLargeDark.Body spacing={2}>
        <ColorTemplate7PopupLargeDark.Title>ERROR:</ColorTemplate7PopupLargeDark.Title>
        <ColorTemplate7PopupLargeDark.ErrorBar
          sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', maxHeight: '50vh', overflow: 'auto' }}
        >
          {message}
        </ColorTemplate7PopupLargeDark.ErrorBar>
        <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap" sx={{ width: '100%' }}>
          <ColorTemplate7PopupLargeDark.ActionButton onClick={handleClose}>OK</ColorTemplate7PopupLargeDark.ActionButton>
        </Stack>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

export function dispatchErrorPopup(detail) {
  if (!isGlobalErrorPopupEnabled() || typeof window === 'undefined') return;
  if (isVaultAccessHandledError(detail)) return;
  window.dispatchEvent(new CustomEvent(ERROR_POPUP_EVENT, { detail }));
}

export function closeErrorPopup() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ERROR_POPUP_CLOSE_EVENT));
}
