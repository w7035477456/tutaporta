/**
 * Crop uniform solid-color borders (white, black, or any flat frame) from an image blob.
 * Used by Photo Albums / Notes View windows so letterboxing uses theme chrome, not photo mats.
 */

const DEFAULT_CHANNEL_TOLERANCE = 28;
/** A row/column counts as border if at least this fraction of pixels match the border color. */
const DEFAULT_EDGE_MATCH_RATIO = 0.97;
/** Skip trim if cropped area would shrink below this fraction of original (safety). */
const MIN_REMAINING_AREA_RATIO = 0.05;

function channelClose(a, b, tol) {
  return Math.abs(a - b) <= tol;
}

function sampleBorderColor(data, width, height) {
  // Median of four corners — stable for typical matte frames.
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1]
  ];
  const rs = [];
  const gs = [];
  const bs = [];
  for (const [x, y] of corners) {
    const i = (y * width + x) * 4;
    rs.push(data[i]);
    gs.push(data[i + 1]);
    bs.push(data[i + 2]);
  }
  const mid = (arr) => {
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  return { r: mid(rs), g: mid(gs), b: mid(bs) };
}

function pixelMatchesBorder(data, width, x, y, border, tol) {
  const i = (y * width + x) * 4;
  return (
    channelClose(data[i], border.r, tol) &&
    channelClose(data[i + 1], border.g, tol) &&
    channelClose(data[i + 2], border.b, tol)
  );
}

function rowIsBorder(data, width, y, border, tol, matchRatio) {
  let match = 0;
  for (let x = 0; x < width; x += 1) {
    if (pixelMatchesBorder(data, width, x, y, border, tol)) match += 1;
  }
  return match / width >= matchRatio;
}

function colIsBorder(data, width, height, x, border, tol, matchRatio) {
  let match = 0;
  for (let y = 0; y < height; y += 1) {
    if (pixelMatchesBorder(data, width, x, y, border, tol)) match += 1;
  }
  return match / height >= matchRatio;
}

function findContentBounds(data, width, height, border, tol, matchRatio) {
  let top = 0;
  let bottom = height - 1;
  let left = 0;
  let right = width - 1;

  while (top <= bottom && rowIsBorder(data, width, top, border, tol, matchRatio)) top += 1;
  while (bottom >= top && rowIsBorder(data, width, bottom, border, tol, matchRatio)) bottom -= 1;
  while (left <= right && colIsBorder(data, width, height, left, border, tol, matchRatio)) left += 1;
  while (right >= left && colIsBorder(data, width, height, right, border, tol, matchRatio)) right -= 1;

  return { top, bottom, left, right };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(
      (out) => resolve(out),
      type || 'image/jpeg',
      quality
    );
  });
}

/**
 * @param {Blob} blob
 * @param {{ tolerance?: number, matchRatio?: number }} [options]
 * @returns {Promise<Blob>} trimmed blob, or original if no safe trim
 */
export async function trimSolidImageBorder(blob, options = {}) {
  if (!blob || typeof createImageBitmap !== 'function') return blob;

  const tolerance = Number(options.tolerance);
  const tol = Number.isFinite(tolerance) ? tolerance : DEFAULT_CHANNEL_TOLERANCE;
  const matchRatioRaw = Number(options.matchRatio);
  const matchRatio = Number.isFinite(matchRatioRaw) ? matchRatioRaw : DEFAULT_EDGE_MATCH_RATIO;

  let bitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return blob;
  }

  const width = bitmap.width;
  const height = bitmap.height;
  if (!width || !height || width < 8 || height < 8) {
    bitmap.close?.();
    return blob;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    bitmap.close?.();
    return blob;
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  let imageData;
  try {
    imageData = ctx.getImageData(0, 0, width, height);
  } catch {
    return blob;
  }

  const { data } = imageData;
  const border = sampleBorderColor(data, width, height);
  const { top, bottom, left, right } = findContentBounds(data, width, height, border, tol, matchRatio);

  if (top > bottom || left > right) return blob;
  if (top === 0 && left === 0 && bottom === height - 1 && right === width - 1) return blob;

  const cropW = right - left + 1;
  const cropH = bottom - top + 1;
  if (cropW / width * (cropH / height) < MIN_REMAINING_AREA_RATIO) return blob;

  const out = document.createElement('canvas');
  out.width = cropW;
  out.height = cropH;
  const outCtx = out.getContext('2d');
  if (!outCtx) return blob;
  outCtx.drawImage(canvas, left, top, cropW, cropH, 0, 0, cropW, cropH);

  const mime = String(blob.type || '').trim() || 'image/jpeg';
  const quality = mime.includes('jpeg') || mime.includes('jpg') || mime.includes('webp') ? 0.92 : undefined;
  try {
    const trimmed = await canvasToBlob(out, mime, quality);
    return trimmed || blob;
  } catch {
    return blob;
  }
}
