import sharp from 'sharp';
import { detectSingleFace } from '../lib/rekognitionClient.js';

function pickLargestFace(faces) {
  if (!Array.isArray(faces) || !faces.length) return null;
  let bestFace = null;
  let bestArea = 0;
  for (const face of faces) {
    const box = face?.BoundingBox;
    if (!box) continue;
    const area = Number(box.Width) * Number(box.Height);
    if (area > bestArea) {
      bestArea = area;
      bestFace = face;
    }
  }
  return bestFace;
}

/**
 * Crop the largest face from a government ID image using Rekognition DetectFaces bounding box.
 * @returns {Promise<Buffer|null>} JPEG bytes for face-only thumbnail, or null when no face found.
 */
export async function cropIdFaceFromImage(bytes, { paddingRatio = 0.18 } = {}) {
  if (!bytes?.length) return null;

  const { faceCount, faces } = await detectSingleFace(bytes);
  if (faceCount < 1) return null;

  const face = pickLargestFace(faces);
  const box = face?.BoundingBox;
  if (!box) return null;

  const image = sharp(bytes).rotate();
  const meta = await image.metadata();
  const imageWidth = meta.width || 1;
  const imageHeight = meta.height || 1;

  const faceLeft = Math.max(0, Math.floor(Number(box.Left) * imageWidth));
  const faceTop = Math.max(0, Math.floor(Number(box.Top) * imageHeight));
  const faceWidth = Math.max(1, Math.floor(Number(box.Width) * imageWidth));
  const faceHeight = Math.max(1, Math.floor(Number(box.Height) * imageHeight));

  const padX = Math.floor(faceWidth * paddingRatio);
  const padY = Math.floor(faceHeight * paddingRatio);
  const left = Math.max(0, faceLeft - padX);
  const top = Math.max(0, faceTop - padY);
  const width = Math.min(imageWidth - left, faceWidth + padX * 2);
  const height = Math.min(imageHeight - top, faceHeight + padY * 2);

  return image
    .extract({ left, top, width, height })
    .resize({ width: 400, height: 400, fit: 'cover' })
    .jpeg({ quality: 90 })
    .toBuffer();
}
