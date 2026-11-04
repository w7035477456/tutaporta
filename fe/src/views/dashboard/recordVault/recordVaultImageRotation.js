/** Angles the note-header rotate button steps through (clockwise). */
export const IMAGE_ROTATION_STEP = 90;

/** Normalize any angle to one of 0 / 90 / 180 / 270 degrees. */
export function normalizeImageRotation(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return (((Math.round(n / 90) * 90) % 360) + 360) % 360;
}

/** True when the rotation swaps the image's width and height on screen. */
export function isQuarterTurn(rotation) {
  const angle = normalizeImageRotation(rotation);
  return angle === 90 || angle === 270;
}

/** Rotation (deg) from a `style="transform: rotate(90deg)"` string. */
export function parseRotationStyle(style) {
  const match = /rotate\(\s*(-?\d+(?:\.\d+)?)deg\s*\)/i.exec(String(style || ''));
  return match ? normalizeImageRotation(match[1]) : 0;
}

/** Rotation for an HTML element — `data-rotation` first, then the transform style. */
export function parseElementRotation(element) {
  if (!element?.getAttribute) return 0;
  return normalizeImageRotation(element.getAttribute('data-rotation') ?? parseRotationStyle(element.style?.transform));
}

/**
 * Rotation as HTML attributes (empty object at 0°). HTML (not a DOM node) so
 * both TipTap `renderHTML` and the note-body sanitizer can share it.
 */
export function rotationToHtmlAttributes(rotation) {
  const angle = normalizeImageRotation(rotation);
  if (!angle) return {};
  return {
    'data-rotation': String(angle),
    style: `transform: rotate(${angle}deg);`
  };
}

/** Image extensions whose inline preview is a real <img> we can turn. */
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'heic', 'heif']);

/** True when a vault attachment previews as a picture (so rotate applies). */
export function isRotatableAttachmentExtension(extension) {
  return IMAGE_EXTENSIONS.has(
    String(extension || '')
      .trim()
      .toLowerCase()
      .replace(/^\./, '')
  );
}
