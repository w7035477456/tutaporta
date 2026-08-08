import { useEffect, useRef } from 'react';

import { useSiteAudio } from 'contexts/SiteAudioContext';
import { playUiClickSound } from 'utils/uiClickSound';

/**
 * Selectors for elements that should get a click sound (buttons, links, common MUI controls).
 * Plain text inputs are excluded — only interactive chrome.
 */
const CLICK_SOUND_SELECTOR = [
  'button',
  'a[href]',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="file"]',
  'select',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="tab"]',
  '.MuiButtonBase-root',
  /** Header menu + notification bell use Avatar + onClick (not IconButton). */
  '.MuiAvatar-root',
  '.MuiListItemButton-root',
  '.MuiChip-root',
  '.MuiTab-root',
  '.MuiSlider-root',
  '.MuiAccordionSummary-root'
].join(', ');

function clickTargetElement(target) {
  if (!target) return null;
  if (target.nodeType === Node.ELEMENT_NODE) return target;
  if (target.parentElement) return target.parentElement;
  return null;
}

function shouldPlayClickSound(event) {
  if (typeof window === 'undefined' || event.button !== 0) return false;
  const el = clickTargetElement(event.target);
  if (!el || typeof el.closest !== 'function') return false;
  if (el.closest('[data-no-click-sound]')) return false;

  const hit = el.closest(CLICK_SOUND_SELECTOR);
  if (!hit) return false;

  if (hit.closest('[data-no-click-sound]')) return false;
  if (hit.hasAttribute('disabled')) return false;
  if (hit.getAttribute('aria-disabled') === 'true') return false;

  return true;
}

/** Document capture listener: play UI click for buttons/links when site audio is not muted. */
export default function GlobalClickSound() {
  const { mediaVolume } = useSiteAudio();
  const mediaVolumeRef = useRef(mediaVolume);
  mediaVolumeRef.current = mediaVolume;

  useEffect(() => {
    const onClickCapture = (event) => {
      const vol = mediaVolumeRef.current;
      if (vol <= 0) return;
      if (!shouldPlayClickSound(event)) return;
      playUiClickSound(vol);
    };

    document.addEventListener('click', onClickCapture, true);
    return () => document.removeEventListener('click', onClickCapture, true);
  }, []);

  return null;
}
