import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Stack from '@mui/material/Stack';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';

const EMPTY_NAME_ERROR = 'Please enter a name.';

/**
 * Prompt for a new album-set name, or album name + date, before creating in the vault.
 * @param {'album-set'|'album'} mode
 */
export default function PhotoAlbumsCreateItemDialog({
  open,
  mode,
  busy = false,
  onClose,
  onConfirmAlbumSet,
  onConfirmAlbum
}) {
  const nameInputRef = useRef(null);
  const [nameDraft, setNameDraft] = useState('');
  const [dateDraft, setDateDraft] = useState('');
  const [validationError, setValidationError] = useState('');

  const isAlbumSet = mode === 'album-set';
  const isAlbum = mode === 'album';

  useEffect(() => {
    if (!open) return;
    setNameDraft('');
    setDateDraft('');
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
    if (isAlbumSet) {
      onConfirmAlbumSet?.(trimmedName);
      return;
    }
    if (isAlbum) {
      onConfirmAlbum?.(trimmedName, String(dateDraft || '').trim());
    }
  };

  if (!isAlbumSet && !isAlbum) return null;

  const title = isAlbumSet ? 'Add Album-Set' : 'Add Album';
  const nameLabel = isAlbumSet ? 'Album-Set Name' : 'Album Name';
  const namePlaceholder = isAlbumSet ? 'e.g. FAMILYALBUM' : 'e.g. BOATHOUSE';
  const datePlaceholder = 'e.g. 8/10-8/12 2018 or MAY 2021';

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
          {isAlbumSet
            ? 'Enter a name for the new album-set.'
            : 'Enter an album name and date. The date appears on the second line in the sidebar.'}
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

          {isAlbum ? (
            <ColorTemplate16PopupCenterWide.FormRow label="Date:">
              <ColorTemplate16PopupCenterWide.Input
                fullWidth
                type="text"
                value={dateDraft}
                disabled={busy}
                placeholder={datePlaceholder}
                onChange={(event) => setDateDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleConfirm();
                  }
                }}
                inputProps={{ maxLength: 80, 'aria-label': 'Album date' }}
              />
            </ColorTemplate16PopupCenterWide.FormRow>
          ) : null}
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

PhotoAlbumsCreateItemDialog.propTypes = {
  open: PropTypes.bool,
  mode: PropTypes.oneOf(['album-set', 'album']),
  busy: PropTypes.bool,
  onClose: PropTypes.func,
  onConfirmAlbumSet: PropTypes.func,
  onConfirmAlbum: PropTypes.func
};
