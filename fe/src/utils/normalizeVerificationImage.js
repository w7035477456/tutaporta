/** Max width for ID / profile images before Rekognition processing (matches BE prepareGovIdImageBytes). */
export const VERIFICATION_IMAGE_MAX_WIDTH_PX = 1000;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Resize image data URL to max width 1000px (aspect ratio preserved). Output JPEG.
 * @param {string} dataUrl
 * @param {number} [maxWidth]
 * @returns {Promise<string>}
 */
export function normalizeVerificationImageDataUrl(dataUrl, maxWidth = VERIFICATION_IMAGE_MAX_WIDTH_PX) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to prepare image'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

/** Fetch a bundled or remote image URL and return a normalized JPEG data URL. */
export async function normalizeVerificationImageFromUrl(url, maxWidth = VERIFICATION_IMAGE_MAX_WIDTH_PX) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to load image');
  }
  const blob = await response.blob();
  const dataUrl = await readFileAsDataUrl(blob);
  return normalizeVerificationImageDataUrl(dataUrl, maxWidth);
}

/** Read an uploaded file and return a normalized JPEG data URL. */
export async function normalizeVerificationImageFile(file, maxWidth = VERIFICATION_IMAGE_MAX_WIDTH_PX) {
  if (!file) throw new Error('No file selected');
  const dataUrl = await readFileAsDataUrl(file);
  return normalizeVerificationImageDataUrl(dataUrl, maxWidth);
}
