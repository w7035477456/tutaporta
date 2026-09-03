import cloudTutaPhotoAlbumsLogo from 'assets/images/cloudTutaPhotoAlbumsLogo.png';
import usbTutaPhotoAlbumsLogo from 'assets/images/usbTutaPhotoAlbumsLogo.png';

export const TUTAPHOTOALBUMS_CLOUD_LOGO = cloudTutaPhotoAlbumsLogo;
export const TUTAPHOTOALBUMS_USB_LOGO = usbTutaPhotoAlbumsLogo;

export const TUTAPHOTOALBUMS_CLOUD_TITLE = 'TutaPhotoAlbums Cloud';
export const TUTAPHOTOALBUMS_CLOUD_LOGIN_TITLE = 'TutaPhotoAlbums Cloud Login';
export const TUTAPHOTOALBUMS_CLOUD_DECRYPT_TITLE = 'Icon Decrypt Cloud TutaPhotoAlbums';

export const TUTAPHOTOALBUMS_USB_TITLE = 'TutaPhotoAlbums USB';
export const TUTAPHOTOALBUMS_USB_LOGIN_TITLE = 'TutaPhotoAlbums USB Login';
export const TUTAPHOTOALBUMS_USB_DECRYPT_TITLE = 'Icon Decrypt USB TutaPhotoAlbums';

/** Tab + expanded workspace chrome (matches MyPhotoAlbums dual-login tabs). */
export const TUTAPHOTOALBUMS_ONEDRIVE_STRIP_COLOR = 'var(--theme-secondary-color)';
export const TUTAPHOTOALBUMS_USB_STRIP_COLOR = '#6EB5E0';
/** “TutaPhotoAlbums on USB” tab / pane title text on the light-blue strip. */
export const TUTAPHOTOALBUMS_USB_TAB_LABEL_COLOR = '#9B3DBA';

export function tutaPhotoAlbumsStorageStripColor(storageType) {
  return storageType === 'onedrive' ? TUTAPHOTOALBUMS_ONEDRIVE_STRIP_COLOR : TUTAPHOTOALBUMS_USB_STRIP_COLOR;
}

/** Expanded workspace yellow header — matches storage tab labels. */
export const TUTAPHOTOALBUMS_ONEDRIVE_WORKSPACE_TITLE = 'TutaPhotoAlbums on OneDrive';
export const TUTAPHOTOALBUMS_USB_WORKSPACE_TITLE = 'TutaPhotoAlbums on USB';

/** LEFT_SIDE=TutaDrive — centered cloud gate (matches TutaNotes). */
export const TUTAPHOTOALBUMS_TUTADRIVE_WORKSPACE_TITLE = 'TutaPhotos on TutaCloud';
export const TUTAPHOTOALBUMS_TUTADRIVE_LOGIN_TITLE = 'TutaPhotoAlbums';
export const TUTAPHOTOALBUMS_TUTADRIVE_OPEN_LABEL = 'Open TutaDrive Cloud';
export const TUTAPHOTOALBUMS_TUTADRIVE_STRIP_COLOR = 'var(--theme-secondary-color)';

/** Volume name only — radio rows append " (vault, 61.9 GB, EXFAT)". */
export function shortUsbVolumeName(label) {
  const raw = String(label || '').trim();
  if (!raw) return '';
  const paren = raw.indexOf(' (');
  if (paren > 0) return raw.slice(0, paren).trim();
  return raw;
}

/** Tab / pane title: `TutaPhotoAlbums on USB: (TutaUSB-1)` when a drive is selected. */
export function formatUsbWorkspaceTitle(label) {
  const name = shortUsbVolumeName(label);
  if (!name) return TUTAPHOTOALBUMS_USB_WORKSPACE_TITLE;
  return `${TUTAPHOTOALBUMS_USB_WORKSPACE_TITLE}: (${name})`;
}

export const TUTAPHOTOALBUMS_VIDEO_TUTORIAL_LABEL = 'Click here for video tutorial on TutaPhotoAlbums';
export const TUTAPHOTOALBUMS_ONEDRIVE_VIDEO_TUTORIAL_LABEL = 'Click here for video tutorial on OneDrive';
export const TUTAPHOTOALBUMS_USB_VIDEO_TUTORIAL_LABEL = 'Click here for video tutorial on USB Bridge';
/** Fixed short header button text — full detail stays in title/aria for USB + OneDrive. */
export const TUTAPHOTOALBUMS_VIDEO_TUTORIAL_BUTTON_LABEL = 'Click here for...';

/** Login + icon-decrypt popups: each 1/3 viewport width (alone or side-by-side = 2/3 vw). */
export const TUTAPHOTOALBUMS_HALF_PANEL_WIDTH = '33.333vw';
export const TUTAPHOTOALBUMS_HALF_PANEL_GAP = 16;
export const TUTAPHOTOALBUMS_PAIR_ROW_MAX_WIDTH = `calc(${TUTAPHOTOALBUMS_HALF_PANEL_WIDTH} * 2 + ${TUTAPHOTOALBUMS_HALF_PANEL_GAP}px)`;

export const tutaPhotoAlbumsHalfPanelSx = {
  width: { xs: '100%', md: TUTAPHOTOALBUMS_HALF_PANEL_WIDTH },
  maxWidth: { xs: '100%', md: TUTAPHOTOALBUMS_HALF_PANEL_WIDTH },
  flex: { xs: '1 1 auto', md: '0 0 auto' },
  minWidth: 0,
  boxSizing: 'border-box'
};

export const TUTAPHOTOALBUMS_CLOUD_ICON_UNLOCK_TOOLTIP =
  'All data encrypted at rest for safe, accessible 24/7 including mobile devices, tablets, laptop.';

export const TUTAPHOTOALBUMS_USB_ICON_UNLOCK_TOOLTIP =
  'All data encrypted at rest. Pure bit-level access. All Personal & Notes data only stored on your USB only. Never on Cloud. Never accessible from mobile device, intrusion & hack impossible.';

/** Yellow pane header title hover — Cloud workspace. */
export const TUTAPHOTOALBUMS_CLOUD_PANE_TOOLTIP =
  'All data encrypted at rest and Accessible 24/7 including mobile online update/upload.';

/** Yellow pane header title hover — USB workspace. */
export const TUTAPHOTOALBUMS_USB_PANE_TOOLTIP =
  'USB-MyPhotoAlbums: All data encrypted at rest and Extreme secure: All Notebook & Notes data only stored on your USB only never on Cloud and only accessible after USB mount (read/run autorun)! Never accessible from mobile devices, Browsers & Notebooks movable (drag&drop) between Cloud & USB.';

/** Hover tooltip on the optional per-note inner-encryption padlock icon. */
export const TUTAPHOTOALBUMS_INNER_ENCRYPT_ICON_TOOLTIP =
  'Optional Extreme Security: add a 6-digit PIN inner encryption to this note (in addition to the standard .enc outer layer). You can use a unique PIN per note or reuse one. Enter the PIN to unlock (decrypt) the note — it stays unencrypted until you manually click this icon again to re-encrypt. Unlocked notes have no PIN. Warning: there is no way to recover this note if you lose your PIN. If you never click this icon, notes keep the default notebook-level .enc encryption only.';
