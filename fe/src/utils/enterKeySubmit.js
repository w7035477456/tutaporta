/**
 * App-wide: Enter in a single-line input clicks the nearest Search / Submit-style button,
 * unless the input already handles keys itself (React onKeyDown/onKeyPress/onKeyUp),
 * sits in a <form> (native submit), or opts out with `data-no-enter-submit`.
 * A button can opt in explicitly with `data-enter-submit`.
 */

const TEXT_INPUT_TYPES = new Set(['', 'text', 'search', 'email', 'tel', 'number', 'password', 'url']);
const MAX_ANCESTOR_LEVELS = 6;
const BUTTON_SELECTOR = 'button, [role="button"], input[type="submit"], input[type="button"]';

/** Earlier entries win when several buttons are equally close. */
const PRIMARY_ACTION_PATTERNS = [
  /^search\b/i,
  /^submit\b/i,
  /^look ?up\b/i,
  /^find\b/i,
  /^(log ?in|sign ?in)\b/i,
  /^(sign ?up|register)\b/i,
  /^(verify|confirm)\b/i,
  /^(send|post|reply)\b/i,
  /^(save|update|apply)\b/i,
  /^(go|ok|enter|continue|next|join|redeem|claim|unlock)\b/i,
  /^add\b/i
];
const NEVER_PATTERN = /^(clear|cancel|close|delete|remove|reset|back|x|×)\b/i;

function reactPropsOf(el) {
  if (!el) return null;
  const key = Object.keys(el).find((k) => k.startsWith('__reactProps$'));
  return key ? el[key] : null;
}

/** Input (or its MUI wrappers) already listens for keys → that component owns Enter. */
function hasOwnKeyHandler(input) {
  let el = input;
  for (let i = 0; el && i < 4; i += 1, el = el.parentElement) {
    const props = reactPropsOf(el);
    if (props && (props.onKeyDown || props.onKeyPress || props.onKeyUp)) return true;
  }
  return false;
}

function isUsableButton(btn) {
  if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return false;
  if (btn.closest('[data-no-enter-submit]')) return false;
  return btn.getClientRects().length > 0;
}

function buttonLabel(btn) {
  return String(btn.getAttribute('aria-label') || btn.value || btn.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickPrimaryButton(container) {
  const buttons = Array.from(container.querySelectorAll(BUTTON_SELECTOR)).filter(isUsableButton);
  const explicit = buttons.find((btn) => btn.hasAttribute('data-enter-submit'));
  if (explicit) return explicit;
  for (const pattern of PRIMARY_ACTION_PATTERNS) {
    const match = buttons.find((btn) => {
      const label = buttonLabel(btn);
      return label && label.length <= 40 && !NEVER_PATTERN.test(label) && pattern.test(label);
    });
    if (match) return match;
  }
  return null;
}

function findEnterTargetButton(input) {
  let el = input.parentElement;
  for (let level = 0; el && el !== document.body && level < MAX_ANCESTOR_LEVELS; level += 1) {
    const btn = pickPrimaryButton(el);
    if (btn) return btn;
    if (el.getAttribute('role') === 'dialog') break;
    el = el.parentElement;
  }
  return null;
}

function handleEnterKeyDown(event) {
  if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing) return;
  if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  if (!TEXT_INPUT_TYPES.has(String(input.type || '').toLowerCase())) return;
  if (input.readOnly || input.disabled || input.form) return;
  if (input.closest('[data-no-enter-submit]')) return;
  if (input.getAttribute('aria-expanded') === 'true') return;
  if (hasOwnKeyHandler(input)) return;

  const button = findEnterTargetButton(input);
  if (!button) return;
  event.preventDefault();
  button.click();
}

/** @returns {() => void} uninstall */
export function installEnterKeySubmit() {
  if (typeof document === 'undefined') return () => {};
  document.addEventListener('keydown', handleEnterKeyDown);
  return () => document.removeEventListener('keydown', handleEnterKeyDown);
}
