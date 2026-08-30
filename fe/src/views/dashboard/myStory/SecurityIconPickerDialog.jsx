import PropTypes from 'prop-types';
import { useCallback, useEffect, useState } from 'react';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import { COLOR_TEMPLATE7_POPUP_ACTION_GREEN } from 'config/colorTemplate7PopupLargeDark';
import { saveSecretIcon, verifySecretIcon } from 'api/saveSecretIconFe';
import RecordVaultIconPickerGrid from 'views/dashboard/recordVault/RecordVaultIconPickerGrid';
import RecordVaultSecurityIconGlyph from 'views/dashboard/recordVault/RecordVaultSecurityIconGlyph';
import BusyHourglassOverlay from 'ui-component/BusyHourglassOverlay';
import { BUSY_HOURGLASS_MODAL_SIZE } from 'config/busyHourglassEnv';

export const SECURITY_ICON_INSTRUCTION =
  "Please choose a security icon. We'll use this to make sure it's really you if you ever need to change your account details in the future";

export const CHANGE_PHONE_SECURITY_ICON_INSTRUCTION =
  'To add extra security in changing your phone number, we like to confirm your identity to this account by ask you click on the one, can you select after registering';

export default function SecurityIconPickerDialog({
  open,
  onSaved,
  onVerified,
  onClose,
  dismissible = false,
  mode = 'save',
  instruction
}) {
  const [selectedIcon, setSelectedIcon] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errorSecondary, setErrorSecondary] = useState('');
  const [maxAttemptsReached, setMaxAttemptsReached] = useState(false);
  const isVerifyMode = mode === 'verify';
  const bodyInstruction = instruction || (isVerifyMode ? CHANGE_PHONE_SECURITY_ICON_INSTRUCTION : SECURITY_ICON_INSTRUCTION);

  useEffect(() => {
    if (!open) return;
    setSelectedIcon('');
    setSaving(false);
    setError('');
    setErrorSecondary('');
    setMaxAttemptsReached(false);
  }, [open]);

  const applyVerifyError = useCallback((responseData, fallbackMessage) => {
    setError(responseData?.error || fallbackMessage);
    setErrorSecondary(
      responseData?.errorSecondary ||
        (responseData?.maxAttemptsReached
          ? ''
          : 'You are allowed up to 3 attempts every 24 hours.')
    );
    setMaxAttemptsReached(Boolean(responseData?.maxAttemptsReached));
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedIcon || maxAttemptsReached) return;
    setSaving(true);
    setError('');
    setErrorSecondary('');
    try {
      if (isVerifyMode) {
        const data = await verifySecretIcon(selectedIcon);
        if (!data?.valid) {
          applyVerifyError(data, 'Security icon does not match. Please try again.');
          return;
        }
        onVerified?.(selectedIcon);
        return;
      }
      const data = await saveSecretIcon(selectedIcon);
      onSaved?.(data?.iconName ?? selectedIcon);
    } catch (err) {
      const responseData = err?.response?.data;
      if (responseData?.sessionInvalid === true) {
        return;
      }
      if (isVerifyMode) {
        applyVerifyError(responseData, 'Security icon does not match. Please try again.');
      } else {
        setError(responseData?.error || err?.message || 'Failed to save security icon.');
      }
    } finally {
      setSaving(false);
    }
  }, [applyVerifyError, isVerifyMode, maxAttemptsReached, onSaved, onVerified, selectedIcon]);

  const hasCloseHandler = typeof onClose === 'function';

  return (
    <>
      <BusyHourglassOverlay open={open && saving} label="Working" fontSize={BUSY_HOURGLASS_MODAL_SIZE} />
      <ColorTemplate7PopupLargeDark
      open={open}
      onClose={hasCloseHandler ? onClose : undefined}
      showCloseButton={hasCloseHandler}
      closeOnBackdrop={dismissible && hasCloseHandler}
    >
      <ColorTemplate7PopupLargeDark.Body>
        <ColorTemplate7PopupLargeDark.Title>Security Icon</ColorTemplate7PopupLargeDark.Title>
        <ColorTemplate7PopupLargeDark.BodyText>{bodyInstruction}</ColorTemplate7PopupLargeDark.BodyText>

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            width: '100%',
            mt: 1,
            mb: 2
          }}
        >
          <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>You selected</Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 88,
              height: 88,
              bgcolor: '#fff',
              borderRadius: 1.5,
              border: '2px solid var(--theme-inverse-daynight-color)',
              color: '#000'
            }}
          >
            {selectedIcon ? <RecordVaultSecurityIconGlyph iconName={selectedIcon} sizePx={52} /> : null}
          </Box>
          <ColorTemplate7PopupLargeDark.ActionButton
            onClick={() => void handleSave()}
            disabled={saving || !selectedIcon || maxAttemptsReached}
            aria-busy={saving}
            sx={{
              bgcolor: `${COLOR_TEMPLATE7_POPUP_ACTION_GREEN} !important`,
              backgroundColor: `${COLOR_TEMPLATE7_POPUP_ACTION_GREEN} !important`,
              color: '#000000 !important',
              WebkitTextFillColor: '#000000 !important',
              ...(saving ? { cursor: 'wait', pointerEvents: 'none' } : null),
              '@media (hover: hover)': {
                '&:hover:not(.Mui-disabled)': {
                  bgcolor: `${COLOR_TEMPLATE7_POPUP_ACTION_GREEN} !important`,
                  backgroundColor: `${COLOR_TEMPLATE7_POPUP_ACTION_GREEN} !important`
                }
              }
            }}
          >
            {saving ? 'Working…' : 'Save'}
          </ColorTemplate7PopupLargeDark.ActionButton>
        </Box>

        {error ? (
          <Box sx={{ width: '100%' }}>
            <ColorTemplate7PopupLargeDark.ErrorBar>{error}</ColorTemplate7PopupLargeDark.ErrorBar>
            {errorSecondary ? (
              <ColorTemplate7PopupLargeDark.BodyText sx={{ mt: 1, textAlign: 'center', fontWeight: 600 }}>
                {errorSecondary}
              </ColorTemplate7PopupLargeDark.BodyText>
            ) : null}
          </Box>
        ) : null}

        <RecordVaultIconPickerGrid
          selectedIcon={selectedIcon}
          onSelectIcon={(iconName) => {
            if (maxAttemptsReached) return;
            setSelectedIcon(iconName);
            setError('');
            setErrorSecondary('');
          }}
          disabled={maxAttemptsReached}
        />
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
    </>
  );
}

SecurityIconPickerDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onSaved: PropTypes.func,
  onVerified: PropTypes.func,
  onClose: PropTypes.func,
  dismissible: PropTypes.bool,
  mode: PropTypes.oneOf(['save', 'verify']),
  instruction: PropTypes.string
};
