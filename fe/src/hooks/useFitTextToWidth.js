import { useCallback, useLayoutEffect, useRef } from 'react';

const MIN_LABEL_PX = 8;
const RESIZE_DEBOUNCE_MS = 120;

function parsePx(value) {
  const n = parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : 14;
}

/** True when single-line label text overflows its box. */
function labelOverflows(el) {
  if (!el) return false;
  return el.scrollWidth > el.clientWidth + 0.5;
}

/** Shrink inline font-size until text fits (no ellipsis). */
function fitTextFontSize(el) {
  if (!el) return;
  el.style.fontSize = '';
  let sizePx = parsePx(getComputedStyle(el).fontSize);
  el.style.fontSize = `${sizePx}px`;

  let guard = 0;
  while (labelOverflows(el) && sizePx > MIN_LABEL_PX && guard < 80) {
    sizePx -= 0.5;
    el.style.fontSize = `${sizePx}px`;
    guard += 1;
  }
}

/**
 * After mount / resize, shrink a text element's font so the full label fits in one line.
 * @param {boolean} enabled
 * @param {string} label — re-run when label text changes
 */
export default function useFitTextToWidth(enabled = false, label = '') {
  const textRef = useRef(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const runFit = useCallback(() => {
    if (!enabledRef.current) return;
    fitTextFontSize(textRef.current);
  }, []);

  useLayoutEffect(() => {
    if (!enabled) {
      if (textRef.current) textRef.current.style.fontSize = '';
      return undefined;
    }

    const scheduleFit = () => {
      runFit();
      window.requestAnimationFrame(() => runFit());
    };

    scheduleFit();

    const el = textRef.current;
    const observers = [];
    if (el && typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(scheduleFit);
      observer.observe(el);
      if (el.parentElement) observer.observe(el.parentElement);
      observers.push(observer);
    }

    let debounceId;
    const onWindowResize = () => {
      clearTimeout(debounceId);
      debounceId = window.setTimeout(scheduleFit, RESIZE_DEBOUNCE_MS);
    };
    window.addEventListener('resize', onWindowResize);

    return () => {
      observers.forEach((observer) => observer.disconnect());
      window.removeEventListener('resize', onWindowResize);
      clearTimeout(debounceId);
      if (textRef.current) textRef.current.style.fontSize = '';
    };
  }, [enabled, label, runFit]);

  return textRef;
}
