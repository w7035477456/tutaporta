import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Stack from '@mui/material/Stack';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';

const EMPTY_NAME_ERROR = 'Please enter a name.';

/**
 * Prompt for a notebook or note name before creating in TutaNotes.
 * @param {'notebook'|'note'} mode
 */
export default function RecordVaultCreateItemDialog({
  open,
  mode,
  busy = false,
  noteNamePlaceholder = 'e.g. MEETING NOTES',
  onClose,
  onConfirmNotebook,
  onConfirmNote
}) {
  const nameInputRef = useRef(null);
  const [nameDraft, setNameDraft] = useState('');
  const [validationError, setValidationError] = useState('');

  const isNotebook = mode === 'notebook';
  const isNote = mode === 'note';

  useEffect(() => {
    if (!open) return;
    setNameDraft('');
    setValidationError('');
    const timer = window.setTimeout(() => nameInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open, mode]);

  const handleClose = () => {
    if (busy) return;
    onClose?.();
  };

  const handleConfirm = () => {
    const trimmedName = String(nameDraft || '').trim();
    if (!trimmedName) {
      setValidationError(EMPTY_NAME_ERROR);
      nameInputRef.current?.focus();
      return;
    }
    setValidationError('');
    if (isNotebook) {
      onConfirmNotebook?.(trimmedName);
      return;
    }
    if (isNote) {
      onConfirmNote?.(trimmedName);
    }
  };

  if (!isNotebook && !isNote) return null;

  const title = isNotebook ? 'Add Notebook' : 'Add Note';
  const nameLabel = isNotebook ? 'Notebook Name' : 'Note Name';
  const namePlaceholder = isNotebook ? 'e.g. MISC' : noteNamePlaceholder;

  return (
    <ColorTemplate16PopupCenterWide
      open={Boolean(open)}
      onClose={handleClose}
      closeOnBackdrop={!busy}
      closeButtonAriaLabel={`Close ${title} dialog`}
    >
      <ColorTemplate16PopupCenterWide.Body spacing={2}>
        <ColorTemplate16PopupCenterWide.Title>{title}</ColorTemplate16PopupCenterWide.Title>
        <ColorTemplate16PopupCenterWide.BodyText>
          {isNotebook
            ? 'Enter a name for the new notebook.'
            : 'Enter a name for the new note.'}
        </ColorTemplate16PopupCenterWide.BodyText>

        <ColorTemplate16PopupCenterWide.FormRows>
          <ColorTemplate16PopupCenterWide.FormRow label={`${nameLabel}:`}>
            <ColorTemplate16PopupCenterWide.Input
              inputRef={nameInputRef}
              fullWidth
              type="text"
              value={nameDraft}
              disabled={busy}
              placeholder={namePlaceholder}
              onChange={(event) => {
                setNameDraft(event.target.value);
                if (validationError) setValidationError('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleConfirm();
                }
              }}
              inputProps={{ maxLength: 120, 'aria-label': nameLabel }}
            />
          </ColorTemplate16PopupCenterWide.FormRow>
        </ColorTemplate16PopupCenterWide.FormRows>

        {validationError ? (
          <ColorTemplate16PopupCenterWide.ErrorBar>{validationError}</ColorTemplate16PopupCenterWide.ErrorBar>
        ) : null}

        <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
          <ColorTemplate16PopupCenterWide.ActionButton onClick={handleClose} disabled={busy}>
            Cancel
          </ColorTemplate16PopupCenterWide.ActionButton>
          <ColorTemplate16PopupCenterWide.ActionButton onClick={handleConfirm} disabled={busy}>
            {busy ? 'Adding…' : 'OK'}
          </ColorTemplate16PopupCenterWide.ActionButton>
        </Stack>
      </ColorTemplate16PopupCenterWide.Body>
    </ColorTemplate16PopupCenterWide>
  );
}

RecordVaultCreateItemDialog.propTypes = {
  open: PropTypes.bool,
  mode: PropTypes.oneOf(['notebook', 'note']),
  busy: PropTypes.bool,
  noteNamePlaceholder: PropTypes.string,
  onClose: PropTypes.func,
  onConfirmNotebook: PropTypes.func,
  onConfirmNote: PropTypes.func
};
