/**
 * Yellow Backup / Restore buttons on OneDrive MyPhotoAlbums dialogs.
 * Overrides GreenButton green default + hover.
 */
export const photoAlbumsOneDriveBackupRestoreButtonSx = {
  bgcolor: 'var(--theme-yellow-color) !important',
  color: '#000000 !important',
  WebkitTextFillColor: '#000000 !important',
  border: '3px solid #000000 !important',
  '@media (hover: hover)': {
    '&:hover:not(.Mui-disabled)': {
      bgcolor: 'var(--theme-yellow-color) !important',
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
