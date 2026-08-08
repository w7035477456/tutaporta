import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import { registerThemedDialogHandler } from 'utils/themedDialog';

/**
 * App-wide host for themedAlert / themedConfirm / themedPrompt
 * (ColorTemplate16PopupCenterWide — replaces native window.alert/confirm/prompt).
 */
export default function ThemedDialogHost() {
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    return registerThemedDialogHandler((req) => {
      return new Promise((resolve) => {
        setDialog({
          type: req.type || 'alert',
          title: req.title || 'Notice',
          message: String(req.message ?? ''),
          defaultValue: req.defaultValue == null ? '' : String(req.defaultValue),
          okLabel: req.okLabel || 'OK',
          cancelLabel: req.cancelLabel || 'Cancel',
          inputValue: req.defaultValue == null ? '' : String(req.defaultValue),
          resolve
        });
      });
    });
  }, []);

  const closeWith = (value) => {
    const resolve = dialog?.resolve;
    setDialog(null);
    if (typeof resolve === 'function') resolve(value);
  };

  const open = Boolean(dialog);
  const isConfirm = dialog?.type === 'confirm';
  const isPrompt = dialog?.type === 'prompt';

  return (
    <ColorTemplate16PopupCenterWide
      open={open}
      onClose={() => closeWith(isConfirm ? false : isPrompt ? null : undefined)}
      closeOnBackdrop={false}
      bodyTextAlignLeft={false}
      centeredLeadLines={0}
      overlaySx={{ zIndex: 40000 }}
      closeButtonAriaLabel="Close dialog"
    >
      {dialog ? (
        <>
          <ColorTemplate16PopupCenterWide.Title>{dialog.title}</ColorTemplate16PopupCenterWide.Title>
          <ColorTemplate16PopupCenterWide.Body spacing={1.5} sx={{ textAlign: 'left' }}>
            <ColorTemplate16PopupCenterWide.BodyText sx={{ whiteSpace: 'pre-wrap', fontWeight: 700 }}>
              {dialog.message}
            </ColorTemplate16PopupCenterWide.BodyText>
            {isPrompt ? (
              <ColorTemplate16PopupCenterWide.Input
                fullWidth
                autoFocus
                value={dialog.inputValue}
                onChange={(e) =>
                  setDialog((prev) => (prev ? { ...prev, inputValue: e.target.value } : prev))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    closeWith(dialog.inputValue);
                  }
                }}
              />
            ) : null}
            <Stack
              direction="row"
              spacing={1.5}
              justifyContent="flex-start"
              flexWrap="wrap"
              sx={{ width: '100%', pt: 0.5 }}
            >
              {isConfirm || isPrompt ? (
                <ColorTemplate16PopupCenterWide.ActionButton
                  type="button"
                  onClick={() => closeWith(isConfirm ? false : null)}
                >
                  {dialog.cancelLabel}
                </ColorTemplate16PopupCenterWide.ActionButton>
              ) : null}
              <ColorTemplate16PopupCenterWide.ActionButton
                type="button"
                onClick={() => {
                  if (isConfirm) closeWith(true);
                  else if (isPrompt) closeWith(dialog.inputValue);
                  else closeWith(undefined);
                }}
              >
                {dialog.okLabel}
              </ColorTemplate16PopupCenterWide.ActionButton>
            </Stack>
          </ColorTemplate16PopupCenterWide.Body>
        </>
      ) : (
        <Box />
      )}
    </ColorTemplate16PopupCenterWide>
  );
}
