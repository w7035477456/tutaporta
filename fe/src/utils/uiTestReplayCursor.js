import { resolveStepClickPoint } from 'utils/uiTestRecording';

const CURSOR_ID = 'ui-test-replay-cursor';
const RIPPLE_CLASS = 'ui-test-replay-click-ripple';
const STYLE_ID = 'ui-test-replay-cursor-styles-10x-v3';
const Z_INDEX = 2147483646;
/** Base pointer was 28px; replay uses 10× for visibility. */
const CURSOR_SIZE_PX = 280;
/** SVG arrow tip in viewBox 0 0 24 24 — path starts near (4, 2). */
const CURSOR_HOTSPOT_X_PX = (4 / 24) * CURSOR_SIZE_PX;
const CURSOR_HOTSPOT_Y_PX = (2 / 24) * CURSOR_SIZE_PX;
const RIPPLE_SIZE_PX = 120;
const RIPPLE_BORDER_PX = 6;

let cursorEl = null;
let active = false;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${CURSOR_ID} {
      position: fixed;
      left: 0;
      top: 0;
      width: ${CURSOR_SIZE_PX}px;
      height: ${CURSOR_SIZE_PX}px;
      margin: 0;
      pointer-events: none;
      z-index: ${Z_INDEX};
      transform: translate(-100px, -100px);
      transition: transform 0.45s ease-out;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.55));
    }
    #${CURSOR_ID} svg {
      display: block;
      width: ${CURSOR_SIZE_PX}px;
      height: ${CURSOR_SIZE_PX}px;
    }
    .${RIPPLE_CLASS} {
      position: fixed;
      width: ${RIPPLE_SIZE_PX}px;
      height: ${RIPPLE_SIZE_PX}px;
      margin: 0;
      border-radius: 50%;
      pointer-events: none;
      z-index: ${Z_INDEX - 1};
      border: ${RIPPLE_BORDER_PX}px solid #ffeb3b;
      background: rgba(255, 235, 59, 0.35);
      transform: translate(-50%, -50%);
      animation: ui-test-replay-ripple 0.55s ease-out forwards;
    }
    @keyframes ui-test-replay-ripple {
      0% { transform: translate(-50%, -50%) scale(0.35); opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

function createCursorElement() {
  const el = document.createElement('div');
  el.id = CURSOR_ID;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path fill="#ffffff" stroke="#c62828" stroke-width="2.5"
        d="M4 2l2 18 4-7 6 1z"/>
    </svg>
  `;
  return el;
}

/** Place arrow tip exactly at viewport (x, y). */
function applyCursorPosition(x, y) {
  if (!cursorEl) return;
  cursorEl.style.transform = `translate(${x - CURSOR_HOTSPOT_X_PX}px, ${y - CURSOR_HOTSPOT_Y_PX}px)`;
}

export function isReplayCursorActive() {
  return active;
}

export function showReplayCursor() {
  if (typeof document === 'undefined') return;
  ensureStyles();
  hideReplayCursor();
  cursorEl = createCursorElement();
  document.body.appendChild(cursorEl);
  active = true;
}

export function hideReplayCursor() {
  active = false;
  if (cursorEl?.parentNode) cursorEl.parentNode.removeChild(cursorEl);
  cursorEl = null;
  document.querySelectorAll(`.${RIPPLE_CLASS}`).forEach((node) => node.remove());
}

export function getStepClickPoint(step) {
  return resolveStepClickPoint(step);
}

export function moveReplayCursor(x, y) {
  if (!cursorEl || !active) return Promise.resolve();
  cursorEl.style.transition = 'none';
  applyCursorPosition(x, y);
  void cursorEl.offsetHeight;
  cursorEl.style.transition = 'transform 0.45s ease-out';
  applyCursorPosition(x, y);
  return new Promise((resolve) => {
    window.setTimeout(resolve, 480);
  });
}

export function pulseReplayClick(x, y) {
  if (!active || typeof document === 'undefined') return;
  const ripple = document.createElement('div');
  ripple.className = RIPPLE_CLASS;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  document.body.appendChild(ripple);
  window.setTimeout(() => {
    ripple.remove();
  }, 600);
}

/** Move ghost cursor to step target, pulse, then return click point. */
export async function animateReplayCursorForStep(step) {
  if (!active) return null;
  const point = getStepClickPoint(step);
  if (!point) return null;
  await moveReplayCursor(point.x, point.y);
  pulseReplayClick(point.x, point.y);
  await new Promise((r) => window.setTimeout(r, 180));
  return point;
}
