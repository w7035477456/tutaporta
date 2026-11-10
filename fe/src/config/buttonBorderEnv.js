/**
 * Site-wide button border — fe/.env
 *   BUTTON_BORDER_THICKNESS=1      (px; "1", "2", "3", "1.5" or "2px" all work; 0 hides borders)
 *   BUTTON_BORDER_COLOR="#000000"  (QUOTE it — unquoted # starts a .env comment; or 000000, rgb(), named)
 *
 * installButtonBorderStyles() injects one global <style> that overrides border-width + border-color
 * on every button (<button>, MUI ButtonBase, [role="button"], input buttons). Border *style* is left
 * alone, so buttons with no border (border: none / 0) stay borderless and dashed stays dashed.
 *
 * Opt a single element out with the attribute data-keep-border (e.g. <Button data-keep-border>).
 */

const DEFAULT_THICKNESS_PX = 1;
const MAX_THICKNESS_PX = 20;
const DEFAULT_COLOR = '#000000';

export const BUTTON_BORDER_WIDTH_CSS_VAR = '--button-border-width';
export const BUTTON_BORDER_COLOR_CSS_VAR = '--button-border-color';

function readThicknessPx(raw) {
  const n = Number(
    String(raw ?? '')
      .trim()
      .replace(/px$/i, '')
  );
  if (!Number.isFinite(n) || n < 0) return DEFAULT_THICKNESS_PX;
  return Math.min(n, MAX_THICKNESS_PX);
}

export function readEnvCssColor(raw, fallback = DEFAULT_COLOR) {
  const value = String(raw ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '');
  if (!value) return fallback;
  // Bare hex (000000) — unquoted "#000000" in .env is parsed as a comment, so allow dropping the #.
  if (/^[0-9a-f]{3,8}$/i.test(value)) return `#${value}`;
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && !CSS.supports('color', value)) {
    return fallback;
  }
  return value;
}

export const ENV_BUTTON_BORDER_THICKNESS_PX = readThicknessPx(import.meta.env.BUTTON_BORDER_THICKNESS);
export const ENV_BUTTON_BORDER_COLOR = readEnvCssColor(import.meta.env.BUTTON_BORDER_COLOR);

/** For new code: use these instead of hardcoding '1px solid #000'. */
export const BUTTON_BORDER_WIDTH = `var(${BUTTON_BORDER_WIDTH_CSS_VAR}, ${ENV_BUTTON_BORDER_THICKNESS_PX}px)`;
export const BUTTON_BORDER_COLOR = `var(${BUTTON_BORDER_COLOR_CSS_VAR}, ${ENV_BUTTON_BORDER_COLOR})`;
export const BUTTON_BORDER = `${BUTTON_BORDER_WIDTH} solid ${BUTTON_BORDER_COLOR}`;

const BUTTON_SELECTORS = [
  'button',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
  '[role="button"]',
  '.MuiButtonBase-root'
].join(', ');

/*
 * :root:root:root raises specificity to (0,5,1) so this wins over component sx rules that also use
 * !important (incl. nested '&:hover' / '& .MuiButton-root' selectors) without editing each file.
 */
function buildCss() {
  const scope = `:root:root:root body :is(${BUTTON_SELECTORS}):not([data-keep-border])`;
  return `
:root {
  ${BUTTON_BORDER_WIDTH_CSS_VAR}: ${ENV_BUTTON_BORDER_THICKNESS_PX}px;
  ${BUTTON_BORDER_COLOR_CSS_VAR}: ${ENV_BUTTON_BORDER_COLOR};
}
${scope},
${scope}:hover,
${scope}:focus,
${scope}:active,
${scope}:disabled,
${scope}.Mui-disabled,
${scope}.Mui-selected {
  border-width: var(${BUTTON_BORDER_WIDTH_CSS_VAR}) !important;
  border-color: var(${BUTTON_BORDER_COLOR_CSS_VAR}) !important;
}
`;
}

const STYLE_ELEMENT_ID = 'tuta-button-border-env';

export function installButtonBorderStyles() {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(STYLE_ELEMENT_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ELEMENT_ID;
    document.head.appendChild(el);
  }
  el.textContent = buildCss();
}
