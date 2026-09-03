import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let cachedManifest = null;

export function repoRootFromHere() {
  return path.resolve(__dirname, '../../..');
}

export function loadTutaNotesTemplateManifest() {
  if (cachedManifest) return cachedManifest;
  const raw = fs.readFileSync(path.join(__dirname, 'templateManifest.json'), 'utf8');
  cachedManifest = JSON.parse(raw);
  return cachedManifest;
}

/** User-facing path: fe/src/assets/zip/tutaNotes_template.zip (deployed with repo). */
export function tutaNotesTemplateZipPath() {
  const manifest = loadTutaNotesTemplateManifest();
  const zipName = String(manifest.zipFile || 'tutaNotes_template.zip').trim() || 'tutaNotes_template.zip';
  const fePath = path.join(repoRootFromHere(), 'fe/src/assets/zip', zipName);
  if (fs.existsSync(fePath)) return fePath;
  const bePath = path.join(__dirname, zipName);
  if (fs.existsSync(bePath)) return bePath;
  return fePath;
}

export function tutaNotesTemplateZipAvailable() {
  try {
    const abs = tutaNotesTemplateZipPath();
    return fs.existsSync(abs) && fs.statSync(abs).isFile();
  } catch {
    return false;
  }
}

export function bundledTutaNotesTemplateVersion() {
  return String(loadTutaNotesTemplateManifest().version || '').trim();
}
