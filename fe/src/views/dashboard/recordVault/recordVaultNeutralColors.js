/**
 * Neutral (black / white / gray) text and background colors in a note body come
 * from the page or app the text was copied from, not from the user's intent, and
 * make text invisible on the opposite theme series (black text on a Dark theme).
 * Dropping them lets the note fall back to --theme-inverse-daynight-color on
 * --theme-daynight-color. Chromatic colors (red, blue, highlights) are kept.
 */

const NEUTRAL_NAMED = new Set([
  'black',
  'white',
  'gray',
  'grey',
  'silver',
  'gainsboro',
  'whitesmoke',
  'snow',
  'dimgray',
  'dimgrey',
  'darkgray',
  'darkgrey',
  'lightgray',
  'lightgrey',
  'windowtext',
  'canvastext',
  'canvas',
  'transparent'
]);

/** Max channel spread (0–255) still counted as gray. */
const NEUTRAL_CHROMA_MAX = 24;

function parseRgb(value) {
  const v = String(value || '').trim().toLowerCase();
  const hex = v.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const alpha = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), alpha];
  }
  const fn = v.match(/^rgba?\(([^)]*)\)$/);
  if (fn) {
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const channel = (p) => (p.endsWith('%') ? (parseFloat(p) / 100) * 255 : parseFloat(p));
    const alphaRaw = parts[3];
    const alpha = alphaRaw == null ? 1 : alphaRaw.endsWith('%') ? parseFloat(alphaRaw) / 100 : parseFloat(alphaRaw);
    const rgb = parts.slice(0, 3).map(channel);
    if (rgb.some((n) => !Number.isFinite(n))) return null;
    return [...rgb, Number.isFinite(alpha) ? alpha : 1];
  }
  return null;
}

export function isNeutralCssColor(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return false;
  if (NEUTRAL_NAMED.has(v)) return true;
  const rgba = parseRgb(v);
  if (!rgba) return false;
  const [r, g, b, a] = rgba;
  if (a === 0) return true;
  return Math.max(r, g, b) - Math.min(r, g, b) <= NEUTRAL_CHROMA_MAX;
}

const COLOR_PROPS = ['color', 'background-color'];

/** Remove neutral color / background-color from inline styles (spans, cells) in note HTML. */
export function stripNeutralColorsFromHtml(html) {
  const raw = String(html || '');
  if (!/(color|background)\s*:/i.test(raw) || typeof DOMParser === 'undefined') return raw;

  const doc = new DOMParser().parseFromString(`<div id="rv-neutral-root">${raw}</div>`, 'text/html');
  const root = doc.getElementById('rv-neutral-root');
  if (!root) return raw;

  let changed = false;
  root.querySelectorAll('span[style], td[style], th[style], p[style], h1[style], h2[style], h3[style], h4[style]').forEach((el) => {
    for (const prop of COLOR_PROPS) {
      const value = el.style.getPropertyValue(prop);
      if (value && isNeutralCssColor(value)) {
        el.style.removeProperty(prop);
        changed = true;
      }
    }
    if (!el.getAttribute('style')?.trim()) el.removeAttribute('style');
  });

  return changed ? root.innerHTML : raw;
}
