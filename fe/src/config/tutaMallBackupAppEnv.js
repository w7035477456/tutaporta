/** Which TutaMall app backup/restore is active from the current route. */
export const TUTA_MALL_BACKUP_APPS = ['tutadates', 'tutanotes', 'tutaphoto'];

/**
 * @param {string} pathname
 * @returns {'tutadates'|'tutanotes'|'tutaphoto'|null}
 */
export function tutaMallBackupAppFromPathname(pathname) {
  const p = String(pathname || '/')
    .replace(/\/+$/, '') || '/';
  if (p === '/myStory' || p.startsWith('/myStory/')) return 'tutadates';
  if (p === '/myNote' || p.startsWith('/myNote/')) return 'tutanotes';
  if (p === '/myPhotoAlbums' || p.startsWith('/myPhotoAlbums/')) return 'tutaphoto';
  return null;
}

/** UI copy per app (profile menu Backup / Restore). */
export const TUTA_MALL_BACKUP_APP_UI = {
  tutadates: {
    backupLabel: 'Backup my TutaDates Photos/Videos',
    restorePrefix: 'Restore TutaDates',
    confirmWarning:
      'Warning: Restore will remove/delete/clearout all existing photos/videos, and replace with photos from Backup, do you want to proceed (Y/n) ?',
    backupBusyLabel: 'TutaDates backup',
    restoreBusyLabel: 'TutaDates restore'
  },
  tutanotes: {
    backupLabel: 'Backup my TutaNotes Notes/Photos/Videos',
    restorePrefix: 'Restore TutaNotes',
    confirmWarning:
      'Warning: Restore will remove/delete/clearout all existing photos/videos/Notes, and replace with Photos/videos/Notes from Backup, do you want to proceed (Y/n) ?',
    backupBusyLabel: 'TutaNotes backup',
    restoreBusyLabel: 'TutaNotes restore'
  },
  tutaphoto: {
    backupLabel: 'Backup my TutaPhotos Albums/Photos/Videos',
    restorePrefix: 'Restore TutaPhotos',
    confirmWarning:
      'Warning: Restore will remove/delete/clearout all existing photos/videos/Albums, and replace with Photos/videos/Albums from Backup, do you want to proceed (Y/n) ?',
    backupBusyLabel: 'TutaPhotos backup',
    restoreBusyLabel: 'TutaPhotos restore'
  }
};

export const TUTA_MALL_RESTORE_REFRESH_HINT =
  'Important: Refresh page to see restore files/photos/videoes';
