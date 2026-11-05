import { SLIDER_CONTROL_TRUE_YELLOW } from 'ui-component/SliderControlButton';
import { LIGHT_SURFACE_CLASS } from 'utils/themeContrast';

/** Shared chrome for note-title row icon buttons (attach, rotate, …). */
export function recordVaultNoteHeaderIconButtonSx(isDisabled) {
  return {
    flexShrink: 0,
    p: 0,
    m: 0,
    width: 32,
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #000 !important',
    borderRadius: 0.5,
    bgcolor: `${SLIDER_CONTROL_TRUE_YELLOW} !important`,
    backgroundImage: 'none !important',
    color: '#000 !important',
    WebkitTextFillColor: '#000 !important',
    lineHeight: 1,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.45 : 1,
    '&:hover': isDisabled ? undefined : { filter: 'brightness(1.06)' },
    '&:active': isDisabled ? undefined : { transform: 'scale(0.96)' }
  };
}

export const RECORD_VAULT_NOTE_HEADER_ICON_BUTTON_CLASS = LIGHT_SURFACE_CLASS;
