import cloudTutaNotesLogo from 'assets/images/cloudTutaNotesLogo.png';
import usbTutaNotesLogo from 'assets/images/usbTutaNotesLogo.png';

export const TUTANOTES_CLOUD_LOGO = cloudTutaNotesLogo;
export const TUTANOTES_USB_LOGO = usbTutaNotesLogo;

export const TUTANOTES_CLOUD_TITLE = 'TutaNotes Cloud';
export const TUTANOTES_CLOUD_LOGIN_TITLE = 'TutaNotes Cloud Login';
export const TUTANOTES_CLOUD_DECRYPT_TITLE = 'Icon Decrypt Cloud TutaNotes';

export const TUTANOTES_USB_TITLE = 'TutaNotes USB';
export const TUTANOTES_USB_LOGIN_TITLE = 'TutaNotes USB Login';
export const TUTANOTES_USB_DECRYPT_TITLE = 'Icon Decrypt USB TutaNotes';

/** Tab + expanded workspace chrome (matches MyRecordVault dual-login tabs). */
export const TUTANOTES_ONEDRIVE_STRIP_COLOR = '#9B3DBA';
export const TUTANOTES_USB_STRIP_COLOR = '#6EB5E0';
/** “TutaNotes on USB” tab / pane title text on the light-blue strip. */
export const TUTANOTES_USB_TAB_LABEL_COLOR = '#9B3DBA';

export function tutaNotesStorageStripColor(storageType) {
  return storageType === 'onedrive' ? TUTANOTES_ONEDRIVE_STRIP_COLOR : TUTANOTES_USB_STRIP_COLOR;
}

/** Expanded workspace yellow header — matches storage tab labels. */
export const TUTANOTES_ONEDRIVE_WORKSPACE_TITLE = 'TutaNotes on OneDrive';
export const TUTANOTES_USB_WORKSPACE_TITLE = 'TutaNotes on USB';

/** Volume name only — radio rows append " (vault, 61.9 GB, EXFAT)". */
export function shortUsbVolumeName(label) {
  const raw = String(label || '').trim();
  if (!raw) return '';
  const paren = raw.indexOf(' (');
  if (paren > 0) return raw.slice(0, paren).trim();
  return raw;
}

/** Tab / pane title: `TutaNotes on USB: (TutaUSB-1)` when a drive is selected. */
export function formatUsbWorkspaceTitle(label) {
  const name = shortUsbVolumeName(label);
  if (!name) return TUTANOTES_USB_WORKSPACE_TITLE;
  return `${TUTANOTES_USB_WORKSPACE_TITLE}: (${name})`;
}

export const TUTANOTES_VIDEO_TUTORIAL_LABEL = 'Click here for Tutorial';
export const TUTANOTES_ONEDRIVE_VIDEO_TUTORIAL_LABEL = 'Click here for Tutorial';
export const TUTANOTES_USB_VIDEO_TUTORIAL_LABEL = 'Click here for Tutorial';
/** Fixed short header button text — full detail stays in title/aria for USB + OneDrive. */
export const TUTANOTES_VIDEO_TUTORIAL_BUTTON_LABEL = 'Click here for Tutorial';

/** Login + icon-decrypt popups: each 1/3 viewport width (alone or side-by-side = 2/3 vw). */
export const TUTANOTES_HALF_PANEL_WIDTH = '33.333vw';
export const TUTANOTES_HALF_PANEL_GAP = 16;
export const TUTANOTES_PAIR_ROW_MAX_WIDTH = `calc(${TUTANOTES_HALF_PANEL_WIDTH} * 2 + ${TUTANOTES_HALF_PANEL_GAP}px)`;

export const tutaNotesHalfPanelSx = {
  width: { xs: '100%', md: TUTANOTES_HALF_PANEL_WIDTH },
  maxWidth: { xs: '100%', md: TUTANOTES_HALF_PANEL_WIDTH },
  flex: { xs: '1 1 auto', md: '0 0 auto' },
  minWidth: 0,
  boxSizing: 'border-box'
};

export const TUTANOTES_CLOUD_ICON_UNLOCK_TOOLTIP =
  'All data encrypted at rest for safe, accessible 24/7 including mobile devices, tablets, laptop.';

export const TUTANOTES_USB_ICON_UNLOCK_TOOLTIP =
  'All data encrypted at rest. Pure bit-level access. All Personal & Notes data only stored on your USB only. Never on Cloud. Never accessible from mobile device, intrusion & hack impossible.';

/** Yellow pane header title hover — Cloud workspace. */
export const TUTANOTES_CLOUD_PANE_TOOLTIP =
  'All data encrypted at rest and Accessible 24/7 including mobile online update/upload.';

/** Yellow pane header title hover — USB workspace. */
export const TUTANOTES_USB_PANE_TOOLTIP =
  'USB-MyNote: All data encrypted at rest and Extreme secure: All Notebook & Notes data only stored on your USB only never on Cloud and only accessible after USB mount (read/run autorun)! Never accessible from mobile devices, Browsers & Notebooks movable (drag&drop) between Cloud & USB.';

/** Hover tooltip on the optional per-note inner-encryption padlock icon. */
export const TUTANOTES_INNER_ENCRYPT_ICON_TOOLTIP =
  'Optional Extreme Security: add a 6-digit PIN inner encryption to this note (in addition to the standard .enc outer layer). You can use a unique PIN per note or reuse one. Enter the PIN to unlock (decrypt) the note — it stays unencrypted until you manually click this icon again to re-encrypt. Unlocked notes have no PIN. Warning: there is no way to recover this note if you lose your PIN. If you never click this icon, notes keep the default notebook-level .enc encryption only.';
