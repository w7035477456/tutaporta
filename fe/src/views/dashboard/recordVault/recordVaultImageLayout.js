import { useEffect, useState } from 'react';
import { isQuarterTurn, normalizeImageRotation } from './recordVaultImageRotation';

/**
 * Layout for a picture turned 0 / 90 / 180 / 270 degrees inside a note.
 *
 * A CSS `rotate()` paints the image at an angle but leaves its **layout box**
 * untouched, so a sideways scan turned upright would keep a tall box and spill
 * over the note column. This computes the turned footprint and, when that
 * footprint is wider than the column, scales the picture down until it fits.
 *
 * Sizes come from the image's intrinsic aspect ratio and the container width —
 * never from measuring the <img> being styled — so layout can't feed back into
 * the measurement.
 */
export function computeRotatedImageBox({ rotation, availableWidth, preferredWidth, maxHeight, aspect }) {
  const angle = normalizeImageRotation(rotation);
  const quarterTurn = isQuarterTurn(angle);
  const ratio = Number(aspect);
  const columnWidth = Number(availableWidth) > 0 ? Number(availableWidth) : 0;
  const preferred = Number(preferredWidth) > 0 ? Number(preferredWidth) : 0;

  // Not enough information yet (image not loaded / container not measured).
  if (!Number.isFinite(ratio) || ratio <= 0 || !columnWidth) {
    return {
      angle,
      quarterTurn,
      box: null,
      imgWidth: preferred || undefined
    };
  }

  // 1) Size the picture the way the note would show it unrotated.
  let width = preferred || columnWidth;
  let height = width / ratio;
  const heightCap = Number(maxHeight) > 0 ? Number(maxHeight) : 0;
  if (heightCap && height > heightCap) {
    height = heightCap;
    width = height * ratio;
  }
  if (width > columnWidth) {
    width = columnWidth;
    height = width / ratio;
  }

  if (!quarterTurn) {
    return { angle, quarterTurn, box: null, imgWidth: Math.round(width) };
  }

  // 2) Sideways the footprint is height × width — shrink it to fit the column.
  let footprintWidth = height;
  let footprintHeight = width;
  if (footprintWidth > columnWidth) {
    const scale = columnWidth / footprintWidth;
    footprintWidth *= scale;
    footprintHeight *= scale;
    width *= scale;
    height *= scale;
  }

  return {
    angle,
    quarterTurn,
    box: { width: Math.round(footprintWidth), height: Math.round(footprintHeight) },
    imgWidth: Math.round(width)
  };
}

/**
 * React wrapper around `computeRotatedImageBox`.
 *
 * @param {object} options
 * @param {object} options.imageRef      Ref to the <img> whose aspect ratio applies.
 * @param {object} options.containerRef  Ref to the element that defines available width.
 * @param {number|string} options.rotation
 * @param {number} [options.preferredWidth] User-set width (image node `width` attr).
 * @param {number} [options.maxHeight]   Optional height cap applied before rotation.
 */
export function useRotatedImageBox({ imageRef, containerRef, rotation, preferredWidth, maxHeight }) {
  const [availableWidth, setAvailableWidth] = useState(0);
  const [aspect, setAspect] = useState(0);

  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return undefined;
    const update = () => {
      // Measure the *parent*: the rotated wrapper resizes itself, so measuring
      // the wrapper would feed its own output back into the next calculation.
      const width = container.parentElement?.clientWidth || container.clientWidth || 0;
      setAvailableWidth(Math.round(width));
    };
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const target = container.parentElement || container;
    const observer = new ResizeObserver(update);
    observer.observe(target);
    return () => observer.disconnect();
  }, [containerRef]);

  useEffect(() => {
    const img = imageRef?.current;
    if (!img) return undefined;
    const read = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w > 0 && h > 0) setAspect(w / h);
    };
    read();
    img.addEventListener('load', read);
    return () => img.removeEventListener('load', read);
  }, [imageRef]);

  return computeRotatedImageBox({ rotation, availableWidth, preferredWidth, maxHeight, aspect });
}

export default useRotatedImageBox;
