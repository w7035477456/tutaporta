import PropTypes from 'prop-types';
import { FULLNAME_MIDDLE_MAX_LENGTH } from 'utils/fullNameFormat';
import { useEffect, useState } from 'react';

import Stack from '@mui/material/Stack';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import GreenButton from 'ui-component/GreenButton';
import { BIO_FIELD_EDIT_WARNING } from 'utils/bioReviewPerFieldEdit';

export default function BioFieldEditDialog({
  open,
  fieldLabel,
  initialValue = '',
  showVerifiedWarning = false,
  saving = false,
  onClose,
  onSubmit
}) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!open) return;
    setValue(String(initialValue ?? ''));
  }, [open, initialValue]);

  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={saving ? undefined : onClose}
      closeOnBackdrop={!saving}
      showCloseButton={!saving}
      closeButtonAriaLabel={`Close edit ${fieldLabel}`}
    >
      <ColorTemplate7PopupLargeDark.Body spacing={2}>
        <ColorTemplate7PopupLargeDark.Title>Edit {fieldLabel}</ColorTemplate7PopupLargeDark.Title>

        <ColorTemplate7PopupLargeDark.FormRows>
          <ColorTemplate7PopupLargeDark.FormRow label={fieldLabel}>
            <ColorTemplate7PopupLargeDark.Input
              formRow
              autoFocus
              size="small"
              placeholder={fieldLabel}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={saving}
              inputProps={
                fieldLabel === 'Middle Initial' ? { maxLength: FULLNAME_MIDDLE_MAX_LENGTH } : undefined
              }
            />
          </ColorTemplate7PopupLargeDark.FormRow>
        </ColorTemplate7PopupLargeDark.FormRows>

        {showVerifiedWarning ? (
          <ColorTemplate7PopupLargeDark.ErrorBar>{BIO_FIELD_EDIT_WARNING}</ColorTemplate7PopupLargeDark.ErrorBar>
        ) : null}

        <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap">
          <GreenButton disabled={saving} onClick={onClose}>
            Cancel
          </GreenButton>
          <GreenButton disabled={saving} onClick={() => onSubmit?.(value)}>
            {saving ? 'Saving…' : 'Submit'}
          </GreenButton>
        </Stack>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

BioFieldEditDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  fieldLabel: PropTypes.string,
  initialValue: PropTypes.string,
  showVerifiedWarning: PropTypes.bool,
  saving: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func
};
