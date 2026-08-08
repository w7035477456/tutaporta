import sharp from 'sharp';

/** Max width for government ID images before Rekognition / OCR processing. */
export const GOV_ID_PROCESS_MAX_WIDTH_PX = 1000;

/**
 * Resize a government ID image to max width 1000px (aspect ratio preserved).
 * Applies EXIF rotation. Output JPEG for consistent downstream size.
 * @param {Buffer} buffer
 * @returns {Promise<Buffer>}
 */
export async function prepareGovIdImageBytes(buffer) {
  if (!buffer?.length) {
    throw new Error('Missing image');
  }
  return sharp(buffer)
    .rotate()
    .resize({ width: GOV_ID_PROCESS_MAX_WIDTH_PX, withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
}
