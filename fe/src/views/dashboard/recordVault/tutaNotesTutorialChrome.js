/**
 * Cross-tree chrome for the TutaNotes video-tutorial button in the site header
 * (/myNote AppBar). MyRecordVault publishes; HeaderRight subscribes.
 * Button stays fixed in HeaderRight (orange) — never relocate into the usage bar.
 */

import {
  TUTANOTES_ONEDRIVE_VIDEO_TUTORIAL_LABEL,
  TUTANOTES_USB_VIDEO_TUTORIAL_LABEL,
  TUTANOTES_VIDEO_TUTORIAL_BUTTON_LABEL,
  TUTANOTES_VIDEO_TUTORIAL_LABEL
} from './tutaNotesBranding';

const listeners = new Set();

let chromeState = {
  active: false,
  url: '',
  label: TUTANOTES_VIDEO_TUTORIAL_BUTTON_LABEL,
  detailLabel: TUTANOTES_ONEDRIVE_VIDEO_TUTORIAL_LABEL
};

export function getTutaNotesTutorialChrome() {
  return chromeState;
}

export function setTutaNotesTutorialChrome(partial) {
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

/** Clear when leaving /myNote so other routes do not keep a stale button. */
export function clearTutaNotesTutorialChrome() {
  setTutaNotesTutorialChrome({
    active: false,
    url: '',
    label: TUTANOTES_VIDEO_TUTORIAL_BUTTON_LABEL,
    detailLabel: TUTANOTES_ONEDRIVE_VIDEO_TUTORIAL_LABEL
  });
}

export function subscribeTutaNotesTutorialChrome(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  listener(chromeState);
  return () => {
    listeners.delete(listener);
  };
}

/** Full tooltip / aria for the current USB or OneDrive pane. */
export function tutorialLabelForPaneFocus(paneFocus) {
  if (paneFocus === 'usb') return TUTANOTES_USB_VIDEO_TUTORIAL_LABEL;
  if (paneFocus === 'compare') return TUTANOTES_VIDEO_TUTORIAL_LABEL;
  return TUTANOTES_ONEDRIVE_VIDEO_TUTORIAL_LABEL;
}
