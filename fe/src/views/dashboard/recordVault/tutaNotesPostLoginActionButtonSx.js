import { buttonFontSizeResponsive } from 'config/buttonFontEnv';
import { bsizeInputHeightResponsive } from 'config/bsizeEnv';
import { ORANGE_BUTTON_ENABLED_BG } from 'config/orangeButton';
import { recordVaultOneDriveBackupRestoreButtonSx } from './recordVaultOneDriveBackupRestoreButtonSx';

function scaleResponsiveSize(responsive, factor) {
  return {
    xs: `calc(${responsive.xs} * ${factor})`,
    sm: `calc(${responsive.sm} * ${factor})`
  };
}

const actionButtonHeight = scaleResponsiveSize(bsizeInputHeightResponsive, 1.25);

export const tutaNotesPostLoginButtonRowSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
  gap: 1.5,
  width: '100%'
};

export const tutaNotesPostLoginActionButtonSx = {
  width: '100%',
  minWidth: 0,
  maxWidth: '100%',
  minHeight: actionButtonHeight,
  px: 1.5,
  py: 0.75,
  whiteSpace: 'normal',
  textAlign: 'center',
  lineHeight: 1.2,
  fontSize: buttonFontSizeResponsive.xs,
  '@media (min-width: 600px)': {
    fontSize: buttonFontSizeResponsive.sm
  }
};

/** Yellow — View OneDrive Cloud / View USB */
export const tutaNotesYellowPostLoginButtonSx = {
  ...tutaNotesPostLoginActionButtonSx,
  ...recordVaultOneDriveBackupRestoreButtonSx
};

/** Orange — Backup & Restore Cloud / USB */
export const tutaNotesOrangePostLoginButtonSx = {
  ...tutaNotesPostLoginActionButtonSx,
  bgcolor: `${ORANGE_BUTTON_ENABLED_BG} !important`,
  color: '#000000 !important',
  WebkitTextFillColor: '#000000 !important',
  border: '3px solid #000000 !important',
  '@media (hover: hover)': {
    '&:hover:not(.Mui-disabled)': {
      bgcolor: `${ORANGE_BUTTON_ENABLED_BG} !important`,
      color: '#000000 !important',
      WebkitTextFillColor: '#000000 !important',
      border: '3px solid #000000 !important'
    }
  },
  '&.Mui-disabled': {
    bgcolor: '#9e9e9e !important',
    color: 'rgba(0, 0, 0, 0.45) !important',
    WebkitTextFillColor: 'rgba(0, 0, 0, 0.45) !important',
    border: '3px solid rgba(0, 0, 0, 0.35) !important',
    opacity: '1 !important'
  }
};

/** Red — Format TutaNotes Cloud / USB */
export const tutaNotesFormatPostLoginButtonSx = {
  ...tutaNotesPostLoginActionButtonSx,
  bgcolor: '#c62828 !important',
  color: '#ffffff !important',
  WebkitTextFillColor: '#ffffff !important',
  border: '3px solid #000000 !important',
  '&:hover:not(.Mui-disabled)': {
    bgcolor: '#b71c1c !important'
  },
  '&.Mui-disabled': {
    bgcolor: '#9e9e9e !important',
    color: 'rgba(0, 0, 0, 0.45) !important',
    WebkitTextFillColor: 'rgba(0, 0, 0, 0.45) !important',
    border: '3px solid rgba(0, 0, 0, 0.35) !important'
  }
};
