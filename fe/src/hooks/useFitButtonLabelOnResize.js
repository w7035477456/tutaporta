import { useCallback, useLayoutEffect, useRef } from 'react';

const MIN_LABEL_PX = 8;
const RESIZE_DEBOUNCE_MS = 120;

function parsePx(value) {
  const n = parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : 14;
}

function horizontalPadding(style) {
  return (
    parsePx(style.paddingLeft) +
    parsePx(style.paddingRight) +
    parsePx(style.borderLeftWidth) +
    parsePx(style.borderRightWidth)
  );
}

function labelContentWidth(buttonEl) {
  const range = document.createRange();
  range.selectNodeContents(buttonEl);
  return range.getBoundingClientRect().width;
}

function labelOverflows(buttonEl) {
  const style = getComputedStyle(buttonEl);
  const available = buttonEl.clientWidth - horizontalPadding(style);
  if (available <= 0) return false;
  return labelContentWidth(buttonEl) > available + 0.5;
}

/** Shrink inline font-size until label fits inside button width (no clip). */
function fitButtonLabelFontSize(buttonEl) {
  if (!buttonEl) return;

  buttonEl.style.fontSize = '';
  let sizePx = parsePx(getComputedStyle(buttonEl).fontSize);
  buttonEl.style.fontSize = `${sizePx}px`;

  let guard = 0;
  while (labelOverflows(buttonEl) && sizePx > MIN_LABEL_PX && guard < 80) {
    sizePx -= 0.5;
    buttonEl.style.fontSize = `${sizePx}px`;
    guard += 1;
  }
}

function observeElementResize(el, handler) {
  if (!el || typeof ResizeObserver === 'undefined') return null;
  const observer = new ResizeObserver(handler);
  observer.observe(el);
  return observer;
}

/**
 * After mount / element or panel resize / window resize (debounced), shrink button label font to fit width.
 * Keeps template CSS as the starting size (DESKTOP_FONT_SIZE_BUTTON on sm+).
 */
export default function useFitButtonLabelOnResize(enabled = false, label = '') {
  const buttonRef = useRef(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const runFit = useCallback(() => {
    if (!enabledRef.current) return;
    fitButtonLabelFontSize(buttonRef.current);
  }, []);

  useLayoutEffect(() => {
    if (!enabled) {
      if (buttonRef.current) buttonRef.current.style.fontSize = '';
      return undefined;
    }

    const scheduleFit = () => {
      runFit();
      window.requestAnimationFrame(() => runFit());
    };

    scheduleFit();

    const el = buttonRef.current;
    const observers = [];
    observers.push(observeElementResize(el, scheduleFit));

    let parent = el?.parentElement;
    while (parent) {
      observers.push(observeElementResize(parent, scheduleFit));
      if (parent.classList?.contains('MuiPopper-root')) break;
      parent = parent.parentElement;
    }

    let debounceId;
    const onWindowResize = () => {
      clearTimeout(debounceId);
      debounceId = window.setTimeout(scheduleFit, RESIZE_DEBOUNCE_MS);
    };
    window.addEventListener('resize', onWindowResize);

    return () => {
      observers.forEach((observer) => observer?.disconnect());
      window.removeEventListener('resize', onWindowResize);
      clearTimeout(debounceId);
      if (buttonRef.current) buttonRef.current.style.fontSize = '';
    };
  }, [enabled, label, runFit]);

  return buttonRef;
}
