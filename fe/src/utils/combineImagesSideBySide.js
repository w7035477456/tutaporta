function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image for combine'));
    image.src = dataUrl;
  });
}

/**
 * Stitch two PNG data URLs into one image, left then right (top-aligned).
 */
export async function combineImagesSideBySide(leftDataUrl, rightDataUrl, { backgroundColor = '#ffffff', gap = 0 } = {}) {
  if (!leftDataUrl || !rightDataUrl) {
    throw new Error('Both images are required to combine');
  }

  const [leftImage, rightImage] = await Promise.all([loadImage(leftDataUrl), loadImage(rightDataUrl)]);

  const leftWidth = leftImage.naturalWidth || leftImage.width;
  const leftHeight = leftImage.naturalHeight || leftImage.height;
  const rightWidth = rightImage.naturalWidth || rightImage.width;
  const rightHeight = rightImage.naturalHeight || rightImage.height;

  const canvasWidth = leftWidth + gap + rightWidth;
  const canvasHeight = Math.max(leftHeight, rightHeight);

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to create canvas context');
  }

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.drawImage(leftImage, 0, 0, leftWidth, leftHeight);
  ctx.drawImage(rightImage, leftWidth + gap, 0, rightWidth, rightHeight);

  return canvas.toDataURL('image/png');
}
