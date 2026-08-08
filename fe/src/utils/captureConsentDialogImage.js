import { toPng } from 'html-to-image';

function stageElementStyles(element) {
  return {
    position: element.style.position,
    left: element.style.left,
    top: element.style.top,
    right: element.style.right,
    bottom: element.style.bottom,
    zIndex: element.style.zIndex,
    transform: element.style.transform,
    opacity: element.style.opacity,
    visibility: element.style.visibility,
    pointerEvents: element.style.pointerEvents,
    maxHeight: element.style.maxHeight,
    height: element.style.height,
    overflow: element.style.overflow,
    overflowY: element.style.overflowY,
    width: element.style.width
  };
}

function restoreElementStyles(element, saved) {
  Object.entries(saved).forEach(([key, value]) => {
    element.style[key] = value;
  });
}

function elementNeedsViewportStaging(element) {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return true;
  if (rect.right < 0 || rect.bottom < 0) return true;
  if (rect.left > window.innerWidth || rect.top > window.innerHeight) return true;

  const style = window.getComputedStyle(element);
  if (style.visibility === 'hidden' || style.display === 'none') return true;
  if (Number(style.opacity) === 0) return true;
  return false;
}
function moveElementIntoViewportForCapture(element) {
  element.style.position = 'fixed';
  element.style.left = '0';
  element.style.top = '0';
  element.style.right = 'auto';
  element.style.bottom = 'auto';
  element.style.zIndex = '-1';
  element.style.transform = 'none';
  element.style.opacity = '1';
  element.style.visibility = 'visible';
  element.style.pointerEvents = 'none';
}

async function waitForPaint() {
  await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Capture a scrollable DOM element as PNG data URL.
 * Off-screen elements are temporarily moved into the viewport so html-to-image can paint them.
 */
export async function captureElementAsPng(element, { backgroundColor = '#ffffff', filter: filterExtra } = {}) {
  if (!element) {
    throw new Error('Missing capture element');
  }

  const stagedStyles = stageElementStyles(element);

  if (elementNeedsViewportStaging(element)) {
    moveElementIntoViewportForCapture(element);
  }

  element.style.maxHeight = 'none';
  element.style.height = 'auto';
  element.style.overflow = 'visible';
  element.style.overflowY = 'visible';

  const defaultFilter = (node) => {
    if (node instanceof HTMLVideoElement || node instanceof HTMLCanvasElement) return false;
    if (node instanceof HTMLElement && node.dataset?.idvCaptureSkip === 'true') return false;
    if (typeof filterExtra === 'function' && filterExtra(node) === false) return false;
    return true;
  };

  try {
    await waitForPaint();
    return await toPng(element, {
      cacheBust: true,
      pixelRatio: 1.5,
      backgroundColor,
      width: element.scrollWidth,
      height: element.scrollHeight,
      filter: defaultFilter
    });
  } finally {
    restoreElementStyles(element, stagedStyles);
  }
}

/** @deprecated use captureElementAsPng */
export async function captureConsentDialogImage(element) {
  return captureElementAsPng(element);
}
