import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import GreenButton from 'ui-component/GreenButton';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { getDesktopTextFontSizeVw, getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';
import { isValidInnerEncryptPin } from 'utils/recordVaultNoteInnerCrypto';
import {
  getRecordVaultOverageThrottleActive,
  subscribeRecordVaultOverageThrottle,
  VAULT_OVERAGE_THROTTLE_BUSY_MESSAGE,
  VAULT_OVERAGE_THROTTLE_STATUS_LINE_RE
} from 'utils/recordVaultOverageThrottleUi';
import VaultOverageThrottleNotice from 'ui-component/VaultOverageThrottleNotice';
import { lockGifSrc } from './RecordVaultEncryptDecryptVideoOverlay';
import RecordVaultZeroKnowledgeNotice, {
  RECORD_VAULT_ZERO_KNOWLEDGE_BODY
} from './RecordVaultZeroKnowledgeNotice';

const pinRowSx = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 0.75,
  flexWrap: 'wrap',
  py: 0.5
};

const pinBoxSx = {
  width: 56,
  '& .MuiOutlinedInput-root': {
    bgcolor: '#e60000',
    borderRadius: '4px',
    '& fieldset': {
      borderColor: '#000',
      borderWidth: '2px'
    },
    '&:hover fieldset': {
      borderColor: '#000'
    },
    '&.Mui-focused fieldset': {
      borderColor: '#000',
      borderWidth: '2px'
    },
    '&.Mui-disabled': {
      bgcolor: '#e60000',
      opacity: 0.65
    }
  },
  '& .MuiInputBase-input': {
    textAlign: 'center',
    fontFamily: MAIN_FONT_FAMILY,
    fontWeight: 800,
    fontSize: '2.03rem',
    letterSpacing: '0.08em',
    color: 'var(--theme-yellow-color)',
    WebkitTextFillColor: 'var(--theme-yellow-color)',
    p: '10px 4px',
    caretColor: 'var(--theme-yellow-color)'
  }
};

const eyeButtonSx = {
  color: '#000',
  bgcolor: 'var(--theme-yellow-color)',
  border: '2px solid #000',
  borderRadius: '8px',
  width: 44,
  height: 44,
  ml: 0.5,
  '&:hover': {
    bgcolor: 'var(--theme-yellow-color)',
    filter: 'brightness(1.05)'
  },
  '&.Mui-disabled': {
    bgcolor: 'var(--theme-yellow-color)',
    opacity: 0.55
  }
};

const innerEncryptDialogPanelSx = {
  border: '8px solid var(--theme-error-color) !important',
  boxSizing: 'border-box'
};

export function PinDigitInputs({ value, onChange, disabled, autoFocus, pinVisible, onToggleVisible }) {
  const refs = useRef([]);
  const digits = String(value || '')
    .padEnd(6, ' ')
    .slice(0, 6)
    .split('')
    .map((ch) => (/\d/.test(ch) ? ch : ''));

  const setDigit = (index, digit) => {
    if (!/^\d?$/.test(digit)) return;
    const next = [...digits];
    next[index] = digit;
    const joined = next.join('').replace(/\s/g, '');
    onChange(joined.slice(0, 6));
    if (digit && index < 5) {
      refs.current[index + 1]?.focus?.();
    }
  };

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus?.();
  }, [autoFocus]);

  return (
    <Box sx={pinRowSx}>
      {digits.map((digit, index) => (
        <TextField
          key={index}
          inputRef={(el) => {
            refs.current[index] = el;
          }}
          type={pinVisible ? 'text' : 'password'}
          value={digit}
          disabled={disabled}
          inputProps={{
            maxLength: 1,
            inputMode: 'numeric',
            pattern: '[0-9]*',
            autoComplete: 'one-time-code',
            'aria-label': `PIN digit ${index + 1}`
          }}
          onChange={(event) => setDigit(index, event.target.value.replace(/\D/g, '').slice(-1))}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !digit && index > 0) {
              refs.current[index - 1]?.focus?.();
            }
            if (event.key === 'Enter' && isValidInnerEncryptPin(value)) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit?.();
            }
          }}
          onPaste={(event) => {
            event.preventDefault();
            const pasted = (event.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
            if (pasted) onChange(pasted);
          }}
          sx={pinBoxSx}
        />
      ))}
      <IconButton
        type="button"
        aria-label={pinVisible ? 'Hide PIN' : 'Show PIN'}
        title={pinVisible ? 'Hide PIN' : 'Show PIN'}
        onClick={() => onToggleVisible?.()}
        disabled={disabled}
        sx={eyeButtonSx}
      >
        <FontAwesomeIcon icon={pinVisible ? faEyeSlash : faEye} />
      </IconButton>
    </Box>
  );
}

PinDigitInputs.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  autoFocus: PropTypes.bool,
  pinVisible: PropTypes.bool,
  onToggleVisible: PropTypes.func
};

/** @deprecated Prefer RECORD_VAULT_ZERO_KNOWLEDGE_BODY from RecordVaultZeroKnowledgeNotice. */
export const INNER_ENCRYPT_PIN_SECURITY_NOTICE = RECORD_VAULT_ZERO_KNOWLEDGE_BODY;

/** Black box + red border — secondary PIN layer explanation (lock + unlock screens). */
export function InnerEncryptPinSecurityNotice({ sx }) {
  return (
    <RecordVaultZeroKnowledgeNotice
      sx={{
        mt: 1.5,
        mx: 'auto',
        maxWidth: 940,
        width: '100%',
        px: { xs: 2, sm: 3 },
        py: { xs: 2, sm: 2.5 },
        boxSizing: 'border-box',
        border: '3px solid #e60000',
        fontSize: { xs: '1.02rem', sm: '1.2rem' },
        lineHeight: 1.5,
        ...(sx || null)
      }}
    />
  );
}

InnerEncryptPinSecurityNotice.propTypes = {
  sx: PropTypes.object
};

/**
 * @param {'enable'|'unlock'|'delete'|'lock'} mode
 * @param {string} noteName
 * @param {'note'|'notebook'} [scope='note'] — notebook scope when user locked/selected via notebook
 */
export function getInnerEncryptPinPanelCopy(mode = 'enable', noteName = '', scope = 'note') {
  const lockingUp = mode === 'enable' || mode === 'lock';
  const isNotebook = scope === 'notebook';
  const entity = isNotebook ? 'Notebook' : 'Note';
  const entityLower = isNotebook ? 'notebook' : 'note';

  const title =
    mode === 'unlock'
      ? `Unlocking ${entity} with 6 digit pin`
      : mode === 'delete'
        ? `Enter PIN to delete ${entityLower}`
        : `Locking ${entity} with 6 digit pin`;

  const description =
    lockingUp
      ? isNotebook
        ? 'This PIN locks every note in the notebook. To provide maximum security, we can not recover lost pin'
        : 'To provide maximum security, we can not recover lost pin'
      : mode === 'unlock'
        ? isNotebook
          ? 'Enter 6 digit pin to unlock this notebook. Notes stay unencrypted until you lock the notebook again.'
          : 'Enter 6 digit pin to unlock. Note stays unencrypted until you lock it again.'
        : mode === 'delete'
          ? `Enter the 6-digit PIN for “${noteName || `this ${entityLower}`}”.`
          : `Enter the 6-digit PIN for this ${entityLower}.`;

  const warning =
    mode === 'unlock' ? '5 minute pause between unlock attempts' : '';

  const submitLabel =
    mode === 'unlock'
      ? 'Unlock now'
      : mode === 'delete'
        ? 'Confirm delete'
        : mode === 'lock'
          ? isNotebook
            ? 'Re-encrypt notebook'
            : 'Re-encrypt now'
          : isNotebook
            ? 'Lock notebook'
            : 'Enable inner encryption';

  return { title, description, warning, submitLabel };
}

export default function RecordVaultNoteInnerEncryptDialog({
  open,
  mode = 'enable',
  noteName = '',
  scope = 'note',
  busy = false,
  /** 0–100 from note count (Cloud sync is a separate label at 100%). */
  progressPercent = 0,
  progressLabel = '',
  error = '',
  onSubmit,
  onClose
}) {
  const [pin, setPin] = useState('');
  const [pinVisible, setPinVisible] = useState(false);

  useEffect(() => {
    if (!open) {
      setPin('');
      setPinVisible(false);
    }
  }, [open]);

  const { title, description, warning, submitLabel } = getInnerEncryptPinPanelCopy(
    mode,
    noteName,
    scope
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    if (busy || !isValidInnerEncryptPin(pin)) return;
    void onSubmit?.(pin);
  };

  const videoKind = mode === 'unlock' || mode === 'delete' ? 'decrypt' : 'encrypt';
  const busyVerb = videoKind === 'decrypt' ? 'Decrypting' : 'Encrypting';
  const clampedPercent = Math.max(0, Math.min(100, Math.round(Number(progressPercent) || 0)));
  const overageThrottled = useSyncExternalStore(
    subscribeRecordVaultOverageThrottle,
    getRecordVaultOverageThrottleActive,
    () => false
  );
  const rawStatus = String(progressLabel || '').trim();
  const statusLines = rawStatus
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const uploadStatusLine =
    statusLines.find((line) => !VAULT_OVERAGE_THROTTLE_STATUS_LINE_RE.test(line)) ||
    statusLines[0] ||
    `${busyVerb}…`;
  const showThrottleLine =
    overageThrottled || statusLines.some((line) => VAULT_OVERAGE_THROTTLE_STATUS_LINE_RE.test(line));
  const busyAriaLabel = [
    uploadStatusLine,
    showThrottleLine ? VAULT_OVERAGE_THROTTLE_BUSY_MESSAGE : '',
    `${clampedPercent}% done`
  ]
    .filter(Boolean)
    .join(' — ');

  return (
    <>
      <ColorTemplate16PopupCenterWide
        open={open}
        onClose={busy ? undefined : onClose}
        closeOnBackdrop={!busy}
        bodyTextAlignLeft={false}
        panelShellSx={innerEncryptDialogPanelSx}
      >
        <ColorTemplate16PopupCenterWide.Title>{title}</ColorTemplate16PopupCenterWide.Title>
        <ColorTemplate16PopupCenterWide.Body spacing={2}>
          {busy ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                gap: 1.5,
                py: 1
              }}
              role="status"
              aria-live="polite"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={clampedPercent}
              aria-label={busyAriaLabel}
            >
              <Box
                component="img"
                src={`${lockGifSrc}?dlg=${videoKind}`}
                alt=""
                aria-hidden
                sx={{
                  width: { xs: 'min(70vw, 14rem)', sm: '16rem' },
                  maxHeight: '36vh',
                  height: 'auto',
                  objectFit: 'contain',
                  display: 'block',
                  bgcolor: '#fff',
                  borderRadius: 1,
                  border: '3px solid #000'
                }}
              />
              <Box
                component="p"
                sx={{
                  m: 0,
                  fontFamily: MAIN_FONT_FAMILY,
                  fontWeight: 800,
                  fontSize: {
                    xs: '1.35rem',
                    sm: getDesktopTitleFontSizeVw()
                  },
                  lineHeight: 1.2,
                  color: 'var(--theme-yellow-color)',
                  textAlign: 'center',
                  textShadow: '0 1px 0 #000'
                }}
              >
                {clampedPercent}% done
              </Box>
              <Box
                component="p"
                sx={{
                  m: 0,
                  px: 1,
                  maxWidth: '100%',
                  fontFamily: MAIN_FONT_FAMILY,
                  fontWeight: 700,
                  fontSize: {
                    xs: '0.95rem',
                    sm: getDesktopTextFontSizeVw()
                  },
                  color: '#000',
                  textAlign: 'center',
                  wordBreak: 'break-word',
                  lineHeight: 1.35
                }}
              >
                {uploadStatusLine}
              </Box>
              {showThrottleLine ? (
                <VaultOverageThrottleNotice
                  component="p"
                  sx={{
                    m: 0,
                    px: 1,
                    maxWidth: '100%',
                    fontFamily: MAIN_FONT_FAMILY,
                    fontWeight: 800,
                    fontSize: {
                      xs: '0.9rem',
                      sm: getDesktopTextFontSizeVw()
                    },
                    color: '#000',
                    textAlign: 'center',
                    wordBreak: 'break-word',
                    lineHeight: 1.35
                  }}
                />
              ) : null}
            </Box>
          ) : (
            <>
          <ColorTemplate16PopupCenterWide.SectionDescription
            sx={{
              mb: 0,
              width: '100%',
              textAlign: 'center !important'
            }}
          >
            {description}
          </ColorTemplate16PopupCenterWide.SectionDescription>
          {warning ? (
            <ColorTemplate16PopupCenterWide.SectionDescription
              sx={{
                mb: 0,
                width: '100%',
                textAlign: 'center !important',
                color: 'var(--theme-yellow-color)',
                fontWeight: 700
              }}
            >
              {warning}
            </ColorTemplate16PopupCenterWide.SectionDescription>
          ) : null}
          <Box component="form" onSubmit={handleSubmit}>
            <PinDigitInputs
              value={pin}
              onChange={setPin}
              disabled={busy}
              autoFocus={open}
              pinVisible={pinVisible}
              onToggleVisible={() => setPinVisible((v) => !v)}
            />
            {error ? <ColorTemplate16PopupCenterWide.ErrorBar>{error}</ColorTemplate16PopupCenterWide.ErrorBar> : null}
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, pt: 1, flexWrap: 'wrap' }}>
              <GreenButton type="submit" disabled={busy || !isValidInnerEncryptPin(pin)}>
                {submitLabel}
              </GreenButton>
              <GreenButton type="button" disabled={busy} onClick={() => onClose?.()}>
                Cancel
              </GreenButton>
            </Box>
            {mode === 'enable' || mode === 'lock' || mode === 'unlock' ? (
              <InnerEncryptPinSecurityNotice sx={{ mt: 2 }} />
            ) : null}
          </Box>
            </>
          )}
        </ColorTemplate16PopupCenterWide.Body>
      </ColorTemplate16PopupCenterWide>
    </>
  );
}

RecordVaultNoteInnerEncryptDialog.propTypes = {
  open: PropTypes.bool,
  mode: PropTypes.oneOf(['enable', 'unlock', 'delete', 'lock']),
  noteName: PropTypes.string,
  scope: PropTypes.oneOf(['note', 'notebook']),
  busy: PropTypes.bool,
  progressPercent: PropTypes.number,
  progressLabel: PropTypes.string,
  error: PropTypes.string,
  onSubmit: PropTypes.func,
  onClose: PropTypes.func
};
