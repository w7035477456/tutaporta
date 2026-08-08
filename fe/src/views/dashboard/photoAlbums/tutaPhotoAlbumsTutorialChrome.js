/**
 * Cross-tree chrome for the TutaPhotoAlbums video-tutorial button in the site header
 * (/myPhotoAlbums AppBar). MyPhotoAlbums publishes; HeaderRight subscribes.
 * Button stays fixed in HeaderRight (orange) — never relocate into the usage bar.
 */

import {
  TUTAPHOTOALBUMS_ONEDRIVE_VIDEO_TUTORIAL_LABEL,
  TUTAPHOTOALBUMS_USB_VIDEO_TUTORIAL_LABEL,
  TUTAPHOTOALBUMS_VIDEO_TUTORIAL_BUTTON_LABEL,
  TUTAPHOTOALBUMS_VIDEO_TUTORIAL_LABEL
} from './tutaPhotoAlbumsBranding';

const listeners = new Set();

let chromeState = {
  active: false,
  url: '',
  label: TUTAPHOTOALBUMS_VIDEO_TUTORIAL_BUTTON_LABEL,
  detailLabel: TUTAPHOTOALBUMS_ONEDRIVE_VIDEO_TUTORIAL_LABEL
};

export function getTutaPhotoAlbumsTutorialChrome() {
  return chromeState;
}

export function setTutaPhotoAlbumsTutorialChrome(partial) {
  chromeState = {
    ...chromeState,
    ...(partial && typeof partial === 'object' ? partial : null)
  };
  listeners.forEach((listener) => {
    try {
      listener(chromeState);
    } catch {
      /* ignore subscriber errors */
    }
  });
}

/** Clear when leaving /myPhotoAlbums so other routes do not keep a stale button. */
export function clearTutaPhotoAlbumsTutorialChrome() {
  setTutaPhotoAlbumsTutorialChrome({
    active: false,
    url: '',
    label: TUTAPHOTOALBUMS_VIDEO_TUTORIAL_BUTTON_LABEL,
    detailLabel: TUTAPHOTOALBUMS_ONEDRIVE_VIDEO_TUTORIAL_LABEL
  });
}

export function subscribeTutaPhotoAlbumsTutorialChrome(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  listener(chromeState);
  return () => {
    listeners.delete(listener);
  };
}

/** Full tooltip / aria for the current USB or OneDrive pane. */
export function tutorialLabelForPaneFocus(paneFocus) {
  if (paneFocus === 'usb') return TUTAPHOTOALBUMS_USB_VIDEO_TUTORIAL_LABEL;
  if (paneFocus === 'compare') return TUTAPHOTOALBUMS_VIDEO_TUTORIAL_LABEL;
  return TUTAPHOTOALBUMS_ONEDRIVE_VIDEO_TUTORIAL_LABEL;
}
