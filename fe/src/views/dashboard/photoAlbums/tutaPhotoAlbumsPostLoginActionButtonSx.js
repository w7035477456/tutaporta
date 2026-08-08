import { buttonFontSizeResponsive } from 'config/buttonFontEnv';
import { bsizeInputHeightResponsive } from 'config/bsizeEnv';
import { ORANGE_BUTTON_ENABLED_BG } from 'config/orangeButton';
import { GREEN_BUTTON_DISABLED_BG, GREEN_BUTTON_TEXT } from 'config/greenButton';
import { photoAlbumsOneDriveBackupRestoreButtonSx } from './photoAlbumsOneDriveBackupRestoreButtonSx';

function scaleResponsiveSize(responsive, factor) {
  return {
    xs: `calc(${responsive.xs} * ${factor})`,
    sm: `calc(${responsive.sm} * ${factor})`
  };
}

const actionButtonHeight = scaleResponsiveSize(bsizeInputHeightResponsive, 1.25);

/** Fixed green — must stay green when clickable (Minimal remaps --theme-action-green-color). */
const OPEN_ACTION_GREEN_BG = '#60C446';

export const tutaPhotoAlbumsPostLoginButtonRowSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
  gap: 1.5,
  width: '100%'
};

/** Open TutaPhotoAlbums Cloud / USB — green when enabled, grey when disabled. */
export const tutaPhotoAlbumsPostLoginActionButtonSx = {
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
  },
  bgcolor: `${OPEN_ACTION_GREEN_BG} !important`,
  color: `${GREEN_BUTTON_TEXT} !important`,
  WebkitTextFillColor: `${GREEN_BUTTON_TEXT} !important`,
  border: '1px solid #000000 !important',
  '@media (hover: hover)': {
    '&:hover:not(.Mui-disabled)': {
      bgcolor: `${OPEN_ACTION_GREEN_BG} !important`,
      color: `${GREEN_BUTTON_TEXT} !important`,
      WebkitTextFillColor: `${GREEN_BUTTON_TEXT} !important`,
      border: '1px solid #000000 !important'
    }
  },
  '&.Mui-disabled': {
    bgcolor: `${GREEN_BUTTON_DISABLED_BG} !important`,
    color: `${GREEN_BUTTON_TEXT} !important`,
    WebkitTextFillColor: `${GREEN_BUTTON_TEXT} !important`,
    border: '1px solid #000000 !important',
    opacity: '1 !important'
  }
};

/** Yellow — View OneDrive Cloud / View USB */
export const tutaPhotoAlbumsYellowPostLoginButtonSx = {
  ...tutaPhotoAlbumsPostLoginActionButtonSx,
  ...photoAlbumsOneDriveBackupRestoreButtonSx
};

/** Orange — Backup & Restore Cloud / USB */
export const tutaPhotoAlbumsOrangePostLoginButtonSx = {
  ...tutaPhotoAlbumsPostLoginActionButtonSx,
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

/** Red — Format TutaPhotoAlbums Cloud / USB */
export const tutaPhotoAlbumsFormatPostLoginButtonSx = {
  ...tutaPhotoAlbumsPostLoginActionButtonSx,
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

/** Neutral gray — More Choices (Cloud login compact row). */
export const tutaPhotoAlbumsMoreChoicesButtonSx = {
  ...tutaPhotoAlbumsPostLoginActionButtonSx,
  bgcolor: '#9e9e9e !important',
  color: '#000000 !important',
  WebkitTextFillColor: '#000000 !important',
  border: '1px solid #000000 !important',
  '@media (hover: hover)': {
    '&:hover:not(.Mui-disabled)': {
      bgcolor: '#8e8e8e !important',
      color: '#000000 !important',
      WebkitTextFillColor: '#000000 !important',
      border: '1px solid #000000 !important'
    }
  },
  '&.Mui-disabled': {
    bgcolor: '#bdbdbd !important',
    color: 'rgba(0, 0, 0, 0.45) !important',
    WebkitTextFillColor: 'rgba(0, 0, 0, 0.45) !important',
    border: '1px solid rgba(0, 0, 0, 0.35) !important',
    opacity: '1 !important'
  }
};

/** Light blue — More Choices (USB login compact row). */
export const tutaPhotoAlbumsUsbMoreChoicesButtonSx = {
  ...tutaPhotoAlbumsMoreChoicesButtonSx,
  bgcolor: '#90caf9 !important',
  '@media (hover: hover)': {
    '&:hover:not(.Mui-disabled)': {
      bgcolor: '#64b5f6 !important',
      color: '#000000 !important',
      WebkitTextFillColor: '#000000 !important',
      border: '1px solid #000000 !important'
    }
  }
};
