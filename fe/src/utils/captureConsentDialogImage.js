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

const LEGAL_RECORD_TEXT_SELECTOR =
  '.MuiTypography-root, .MuiFormControlLabel-label, .MuiLink-root, .MuiInputBase-input, .ct7-popup-title, .consent-surface-text';

const CONSENT_CAPTURE_PANEL_TEXT = '#FFFFFF';
const CONSENT_CAPTURE_LINK_TEXT = '#FFEB3B';

/** Nodes that keep their yellow/white control surfaces (black text) in the PNG. */
function isConsentControlSurfaceNode(node) {
  return Boolean(
    node?.closest?.(
      '.MuiInputBase-root, .consent-surface-button, .consent-signature-capture-surface, .consent-checkbox-capture-surface, .color-template7-popup-action'
    )
  );
}

function readThemeCssVar(name) {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Match the live consent popup panel — secondary, then primary theme color. */
function resolveConsentPanelBackground(element) {
  const dialog = element?.closest?.('[role="dialog"]');
  if (dialog) {
    const dialogBg = getComputedStyle(dialog).backgroundColor;
    if (dialogBg && dialogBg !== 'rgba(0, 0, 0, 0)' && dialogBg !== 'transparent') {
      return dialogBg;
    }
  }

  const secondary = readThemeCssVar('--theme-secondary-color');
  if (secondary) return secondary;

  const primary = readThemeCssVar('--theme-primary-color');
  if (primary) return primary;

  return '#5c0011';
}

/**
 * Popup copy uses theme CSS vars that html-to-image often drops — inline the same
 * panel background + white copy the member saw when signing (controls stay yellow/white).
 */
function applyLegalRecordThemeStyles(element) {
  const restores = [];
  if (!element) {
    return { panelBg: '#ffffff', restore: () => {} };
  }

  const panelBg = resolveConsentPanelBackground(element);

  restores.push({
    node: element,
    backgroundColor: element.style.backgroundColor
  });
  element.style.backgroundColor = panelBg;

  element.querySelectorAll(LEGAL_RECORD_TEXT_SELECTOR).forEach((node) => {
    if (isConsentControlSurfaceNode(node)) return;

    const textColor = node.matches('.MuiLink-root') ? CONSENT_CAPTURE_LINK_TEXT : CONSENT_CAPTURE_PANEL_TEXT;
    restores.push({
      node,
      color: node.style.color,
      webkitTextFillColor: node.style.webkitTextFillColor
    });
    node.style.color = textColor;
    node.style.webkitTextFillColor = textColor;
  });

  return {
    panelBg,
    restore: () => {
      restores.forEach(({ node, backgroundColor, color, webkitTextFillColor }) => {
        if (backgroundColor !== undefined) {
          node.style.backgroundColor = backgroundColor;
        }
        if (color !== undefined) {
          node.style.color = color;
          node.style.webkitTextFillColor = webkitTextFillColor;
        }
      });
    }
  };
}

function stageAncestorScrollContainers(element) {
  const restores = [];

  let node = element.parentElement;
  while (node && node !== document.body) {
    const computed = window.getComputedStyle(node);
    const scrollable =
      computed.overflowY === 'auto' ||
      computed.overflowY === 'scroll' ||
      computed.overflow === 'auto' ||
      computed.overflow === 'scroll';
    const heightCapped = computed.maxHeight && computed.maxHeight !== 'none';

    if (scrollable || heightCapped) {
      restores.push({
        node,
        overflow: node.style.overflow,
        overflowY: node.style.overflowY,
        maxHeight: node.style.maxHeight,
        scrollTop: node.scrollTop
      });
      node.style.overflow = 'visible';
      node.style.overflowY = 'visible';
      node.style.maxHeight = 'none';
      node.scrollTop = 0;
    }

    node = node.parentElement;
  }

  return () => {
    restores.forEach(({ node, overflow, overflowY, maxHeight, scrollTop }) => {
      node.style.overflow = overflow;
      node.style.overflowY = overflowY;
      node.style.maxHeight = maxHeight;
      node.scrollTop = scrollTop;
    });
  };
}

async function waitForPaint() {
  await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function waitForFontsReady() {
  if (typeof document === 'undefined' || !document.fonts?.ready) return;
  try {
    await document.fonts.ready;
  } catch {
    // ignore font load errors — capture with fallbacks
  }
}

function waitForImageElement(img) {
  if (img.complete && img.naturalWidth > 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const done = () => {
      img.removeEventListener('load', done);
      img.removeEventListener('error', done);
      resolve();
    };
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  });
}

async function waitForImagesInElement(element) {
  const images = element.querySelectorAll('img');
  await Promise.all([...images].map((img) => waitForImageElement(img)));
}

/**
 * html-to-image skips <canvas> nodes; flatten each to an <img> so ink (e.g. mouse
 * signature) is included in consent PNG legal records.
 */
function flattenCanvasesInElement(element) {
  const restores = [];
  const canvases = element.querySelectorAll('canvas');

  canvases.forEach((canvas) => {
    const parent = canvas.parentElement;
    if (!parent) return;

    let dataUrl = '';
    try {
      dataUrl = canvas.toDataURL('image/png');
    } catch {
      return;
    }
    if (!dataUrl || dataUrl === 'data:,') return;

    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = canvas.getAttribute('aria-label') || 'Signature';
    img.setAttribute('data-consent-canvas-flat', 'true');

    const computed = window.getComputedStyle(canvas);
    img.style.width = computed.width;
    img.style.height = computed.height;
    img.style.display = computed.display === 'inline' ? 'inline-block' : computed.display;
    img.style.maxWidth = computed.maxWidth;
    img.style.verticalAlign = computed.verticalAlign;

    const previousDisplay = canvas.style.display;
    parent.insertBefore(img, canvas.nextSibling);
    canvas.style.display = 'none';

    restores.push(() => {
      canvas.style.display = previousDisplay;
      img.remove();
    });
  });

  return () => {
    restores.forEach((restore) => restore());
  };
}

function estimateDataUrlBytes(dataUrl) {
  const base64 = String(dataUrl ?? '').split(',')[1] || '';
  return Math.floor((base64.length * 3) / 4);
}

function assertNonEmptyCapture(dataUrl, label = 'Screen') {
  const bytes = estimateDataUrlBytes(dataUrl);
  if (bytes < 4000) {
    throw new Error(`${label} capture was empty. Please try again.`);
  }
}

/**
 * Capture a scrollable DOM element as PNG data URL.
 * Off-screen elements are temporarily moved into the viewport so html-to-image can paint them.
 */
export async function captureElementAsPng(
  element,
  {
    backgroundColor = '#ffffff',
    filter: filterExtra,
    forceViewportStaging = false,
    legalRecordThemeColors = false,
    /** @deprecated use legalRecordThemeColors */
    legalRecordReadableColors = false,
    validateNonEmpty = false,
    validateLabel = 'Screen'
  } = {}
) {
  if (!element) {
    throw new Error('Missing capture element');
  }

  if (element.scrollWidth < 8 || element.scrollHeight < 8) {
    throw new Error('Capture target has no visible size');
  }

  element.scrollIntoView?.({ block: 'start', inline: 'nearest' });

  const stagedStyles = stageElementStyles(element);
  const restoreCanvases = flattenCanvasesInElement(element);
  const restoreAncestors = stageAncestorScrollContainers(element);

  if (forceViewportStaging || elementNeedsViewportStaging(element)) {
    moveElementIntoViewportForCapture(element);
  }

  element.style.maxHeight = 'none';
  element.style.height = 'auto';
  element.style.overflow = 'visible';
  element.style.overflowY = 'visible';
  element.style.width = `${Math.max(element.scrollWidth, element.getBoundingClientRect().width)}px`;

  const useLegalRecordTheme = legalRecordThemeColors || legalRecordReadableColors;
  let captureBackground = backgroundColor;
  let restoreLegalRecordTheme = () => {};
  if (useLegalRecordTheme) {
    const themed = applyLegalRecordThemeStyles(element);
    captureBackground = themed.panelBg;
    restoreLegalRecordTheme = themed.restore;
  }

  const defaultFilter = (node) => {
    if (node instanceof HTMLVideoElement) return false;
    if (node instanceof HTMLCanvasElement) return false;
    if (node instanceof HTMLElement && node.dataset?.idvCaptureSkip === 'true') return false;
    if (typeof filterExtra === 'function' && filterExtra(node) === false) return false;
    return true;
  };

  try {
    await waitForFontsReady();
    await waitForImagesInElement(element);
    await waitForPaint();

    const dataUrl = await toPng(element, {
      cacheBust: true,
      pixelRatio: 1.5,
      backgroundColor: captureBackground,
      width: element.scrollWidth,
      height: element.scrollHeight,
      fontEmbedCSS: true,
      includeQueryParams: true,
      filter: defaultFilter
    });

    if (validateNonEmpty) {
      assertNonEmptyCapture(dataUrl, validateLabel);
    }

    return dataUrl;
  } finally {
    restoreLegalRecordTheme();
    restoreCanvases();
    restoreAncestors();
    restoreElementStyles(element, stagedStyles);
  }
}

/** @deprecated use captureElementAsPng */
export async function captureConsentDialogImage(element, options = {}) {
  return captureElementAsPng(element, {
    forceViewportStaging: true,
    legalRecordThemeColors: true,
    validateNonEmpty: true,
    validateLabel: 'Consent',
    ...options
  });
}
