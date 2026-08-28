import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const INITIALIZE_SAMPLE_ASSET_ROOT = path.join(__dirname, '../../assets/photoAlbumsNewMemberSample');

let cachedManifest = null;

export function loadInitializeSampleManifest() {
  if (cachedManifest) return cachedManifest;
  const raw = fs.readFileSync(path.join(INITIALIZE_SAMPLE_ASSET_ROOT, 'manifest.json'), 'utf8');
  cachedManifest = JSON.parse(raw);
  return cachedManifest;
}

export function loadSampleAlbumBodyHtml() {
  const manifest = loadInitializeSampleManifest();
  const fileName = manifest.bodyHtmlFile || 'sampleAlbumBody.html';
  return fs.readFileSync(path.join(INITIALIZE_SAMPLE_ASSET_ROOT, fileName), 'utf8');
}
