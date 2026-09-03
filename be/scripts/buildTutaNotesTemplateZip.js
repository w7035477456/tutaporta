#!/usr/bin/env node
/**
 * Pack a live TutaNotes vault folder into fe/src/assets/zip/tutaNotes_template.zip.
 * Bump be/utils/recordVaultTutaNotesTemplate/templateManifest.json version after rebuild.
 *
 * Usage (from repo root):
 *   node be/scripts/buildTutaNotesTemplateZip.js \
 *     /Users/a/mac_storage/onlinemallwebsite_largecheapstorage/users/M237112/notes
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ZipArchive } from 'archiver';

import { VAULT_DIR_NAME, vaultRootOnMount } from '../utils/recordVaultUsb/vaultPaths.js';
import {
  loadTutaNotesTemplateManifest,
  repoRootFromHere,
  tutaNotesTemplateZipPath
} from '../utils/recordVaultTutaNotesTemplate/templatePaths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const mountPath = process.argv[2];
  if (!mountPath) {
    console.error('Usage: node be/scripts/buildTutaNotesTemplateZip.js <vault-mount-path>');
    process.exit(1);
  }

  const vaultRoot = vaultRootOnMount(mountPath);
  if (!fs.existsSync(vaultRoot)) {
    console.error(`Missing vault folder: ${vaultRoot}`);
    process.exit(1);
  }

  const manifest = loadTutaNotesTemplateManifest();
  const outDir = path.join(repoRootFromHere(), 'fe/src/assets/zip');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = tutaNotesTemplateZipPath();

  console.log(`Packing ${vaultRoot} → ${outPath}`);

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = new ZipArchive({ zlib: { level: 6 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(vaultRoot, VAULT_DIR_NAME);
    void archive.finalize();
  });

  const st = fs.statSync(outPath);
  console.log(`Wrote ${outPath} (${(st.size / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(`Template version in manifest: ${manifest.version}`);
  console.log('After content changes, bump templateManifest.json version and run migrate.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
