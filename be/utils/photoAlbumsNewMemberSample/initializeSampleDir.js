import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** Shared on-disk cache: JPEG variants + converted full files (built once). */
export const INITIALIZE_SAMPLE_VARIANTS_DIR = '.variants';

/**
 * Canonical folder for new-member sample originals.
 * Prefer PHOTO_ALBUMS_INIT_SAMPLE_DIR, then fe/src/assets/images/initializeSample, then be/assets/initializeSample.
 */
export function resolveInitializeSampleDir() {
  const envDir = String(process.env.PHOTO_ALBUMS_INIT_SAMPLE_DIR || '').trim();
  if (envDir && fs.existsSync(envDir)) return path.resolve(envDir);

  const feDir = path.join(REPO_ROOT, 'fe/src/assets/images/initializeSample');
  if (fs.existsSync(feDir)) return feDir;

  const beDir = path.join(REPO_ROOT, 'be/assets/initializeSample');
  return beDir;
}

export function initializeSampleVariantsRoot(sampleDir = resolveInitializeSampleDir()) {
  return path.join(sampleDir, INITIALIZE_SAMPLE_VARIANTS_DIR);
}
