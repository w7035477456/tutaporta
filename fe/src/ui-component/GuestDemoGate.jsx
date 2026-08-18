import { useEffect, useState } from 'react';
import { useAuth } from 'contexts/AuthContext';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import { MY_PHOTO_ALBUMS_PATH, MY_PHOTO_ALBUMS_VIEW_PATH } from 'constants/myPhotoAlbumsRoute';
import { RECEIVED_BIO_REQUESTS_PATH } from 'constants/receivedBioRequestsRoute';
import { MY_STORY_PATH } from 'utils/profilePhotoSetup';
import {
  GUEST_DEMO_ALLOW_ATTR,
  GUEST_DEMO_BLOCK_ATTR,
  GUEST_DEMO_LOGIN_MESSAGE,
  guestDemoAllowProps,
  isGuestDemoLogin
} from 'utils/guestDemoLogin';

const INTERACTIVE_SELECTOR = [
  'button',
  'a[href]',
  '[role="button"]',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
  'input[type="image"]',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="file"]',
  'label[for]',
  'select',
  'textarea',
  'summary',
  '[draggable="true"]'
].join(', ');

function isGuestDemoMyStoryPath(pathname) {
  const path = String(pathname || '');
  return (
    path === MY_STORY_PATH ||
    path.startsWith(`${MY_STORY_PATH}/`) ||
    path === '/vsingles/myStory' ||
    path.startsWith('/vsingles/myStory/')
  );
}

/** Pages where most controls work in Demo mode (except data-guest-demo-block + My Album drops). */
function isGuestDemoUnrestrictedPath(pathname) {
  const path = String(pathname || '');
  return (
    path === MY_PHOTO_ALBUMS_PATH ||
    path.startsWith(`${MY_PHOTO_ALBUMS_PATH}/`) ||
    path === MY_PHOTO_ALBUMS_VIEW_PATH ||
    path.startsWith(`${MY_PHOTO_ALBUMS_VIEW_PATH}/`) ||
    isGuestDemoMyStoryPath(path) ||
    path === RECEIVED_BIO_REQUESTS_PATH ||
    path.startsWith(`${RECEIVED_BIO_REQUESTS_PATH}/`)
  );
}

function currentPathname() {
  if (typeof window === 'undefined') return '';
  return String(window.location?.pathname || '');
}

function isAllowedGuestDemoTarget(target) {
  if (!target || typeof target.closest !== 'function') return true;
  if (target.closest(`[${GUEST_DEMO_ALLOW_ATTR}="true"]`)) return true;
  // Demo restriction popup + instruction dialogs use role="dialog".
  if (target.closest('[role="dialog"]')) return true;
  // Profile menu Select (main font) portals Menu / listbox outside the panel.
  if (target.closest('[role="listbox"], .MuiMenu-root, .MuiAutocomplete-popper')) return true;
  return false;
}

function isBlockedGuestDemoTarget(target) {
  if (!target || typeof target.closest !== 'function') return false;
  return Boolean(target.closest(`[${GUEST_DEMO_BLOCK_ATTR}="true"]`));
}

function findBlockedInteractive(target) {
  if (!target || typeof target.closest !== 'function') return null;
  return target.closest(INTERACTIVE_SELECTOR);
}

/**
 * Demo mode (demo/demo or guest/guest): allow sidebar, footer legal links, mute/music,
 * top-right theme menu, orange help / tour buttons, TutaNotes Cloud/USB login panels,
 * TutaNotes notebook/note/shortcut chrome + View/Download on attachments,
 * most of /myPhotoAlbums, /myStory, and /receivedBioRequests (path allow);
 * block marked mutating actions (data-guest-demo-block) even on those pages
 * (Submit Response, Make this Profile);
 * block all photo/file drops on /myStory (album Drop photos here);
 * plus marked controls (data-guest-demo-allow), e.g. vetted-friends "Click to view";
 * always block OS file drag/drop into the page (even over allowlisted regions);
 * block Support and other interactive clicks elsewhere and show ColorTemplate16 popup.
 *
 * Mounted outside RouterProvider in App.jsx — do not use useLocation(); read window.location.
 */
export default function GuestDemoGate() {
  const { user } = useAuth();
  const guestDemo = isGuestDemoLogin(user);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!guestDemo) {
      setOpen(false);
      return undefined;
    }

    const openDemoPopup = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      setOpen(true);
    };

    const blockEvent = (event) => {
      // Explicit mutating actions stay blocked even on unrestricted demo pages.
      if (isBlockedGuestDemoTarget(event.target)) {
        openDemoPopup(event);
        return;
      }
      // Path check at event time (SPA navigations) — GuestDemoGate is outside <Router>.
      if (isGuestDemoUnrestrictedPath(currentPathname())) return;
      const interactive = findBlockedInteractive(event.target);
      if (!interactive) return;
      if (isAllowedGuestDemoTarget(interactive)) return;
      openDemoPopup(event);
    };

    const blockKeyActivate = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      blockEvent(event);
    };

    const blockDragDrop = (event) => {
      const types = event.dataTransfer?.types ? Array.from(event.dataTransfer.types) : [];
      const isOsFileTransfer =
        types.includes('Files') ||
        (event.type === 'drop' && Boolean(event.dataTransfer?.files?.length));
      const myStory = isGuestDemoMyStoryPath(currentPathname());

      // My Album&Posts: dropping photos (OS files or album tiles) shows the demo popup.
      if (myStory && event.type === 'drop') {
        openDemoPopup(event);
        return;
      }
      if (isBlockedGuestDemoTarget(event.target)) {
        openDemoPopup(event);
        return;
      }
      if (isGuestDemoUnrestrictedPath(currentPathname())) return;
      // OS file drops (attach / import into notes) stay blocked even over allowlisted chrome.
      if (isOsFileTransfer) {
        openDemoPopup(event);
        return;
      }
      if (isAllowedGuestDemoTarget(event.target)) return;
      openDemoPopup(event);
    };

    const preventMyStoryFileDragOver = (event) => {
      if (!isGuestDemoMyStoryPath(currentPathname())) return;
      const types = event.dataTransfer?.types ? Array.from(event.dataTransfer.types) : [];
      if (!types.includes('Files')) return;
      event.preventDefault();
      event.stopPropagation();
    };

    const blockSubmit = (event) => {
      if (isBlockedGuestDemoTarget(event.submitter) || isBlockedGuestDemoTarget(event.target)) {
        openDemoPopup(event);
      }
    };

    document.addEventListener('click', blockEvent, true);
    document.addEventListener('auxclick', blockEvent, true);
    document.addEventListener('keydown', blockKeyActivate, true);
    document.addEventListener('submit', blockSubmit, true);
    document.addEventListener('dragstart', blockDragDrop, true);
    document.addEventListener('dragover', preventMyStoryFileDragOver, true);
    document.addEventListener('drop', blockDragDrop, true);

    return () => {
      document.removeEventListener('click', blockEvent, true);
      document.removeEventListener('auxclick', blockEvent, true);
      document.removeEventListener('keydown', blockKeyActivate, true);
      document.removeEventListener('submit', blockSubmit, true);
      document.removeEventListener('dragstart', blockDragDrop, true);
      document.removeEventListener('dragover', preventMyStoryFileDragOver, true);
      document.removeEventListener('drop', blockDragDrop, true);
    };
  }, [guestDemo]);

  if (!guestDemo) return null;

  return (
    <ColorTemplate16PopupCenterWide
      open={open}
      onClose={() => setOpen(false)}
      closeOnBackdrop
      bodyTextAlignLeft={false}
    >
      <ColorTemplate16PopupCenterWide.Body spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
        <ColorTemplate16PopupCenterWide.BodyText
          sx={{ whiteSpace: 'pre-wrap', textAlign: 'center', width: '100%' }}
        >
          {GUEST_DEMO_LOGIN_MESSAGE}
        </ColorTemplate16PopupCenterWide.BodyText>
        <ColorTemplate16PopupCenterWide.ActionButton
          type="button"
          onClick={() => setOpen(false)}
          {...guestDemoAllowProps()}
        >
          OK
        </ColorTemplate16PopupCenterWide.ActionButton>
      </ColorTemplate16PopupCenterWide.Body>
    </ColorTemplate16PopupCenterWide>
  );
}
