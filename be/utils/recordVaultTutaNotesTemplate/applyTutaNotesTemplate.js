import fs from 'fs';
import path from 'path';
import { restorePlainVaultZipToMount } from '../recordVaultUsb/vaultPlainZipRestore.js';
import { vaultMetaPath, vaultRootOnMount } from '../recordVaultUsb/vaultPaths.js';
import { readVaultMeta } from '../recordVaultUsb/usbScan.js';
import {
  bundledTutaNotesTemplateVersion,
  tutaNotesTemplateZipAvailable,
  tutaNotesTemplateZipPath
} from './templatePaths.js';

export const TUTA_NOTES_TEMPLATE_META_KEY = 'tutaNotesTemplateVersion';

function readStoredTemplateVersion(mountPath) {
  try {
    const meta = readVaultMeta(mountPath);
    return String(meta?.[TUTA_NOTES_TEMPLATE_META_KEY] || '').trim();
  } catch {
    return '';
  }
}

function vaultHasStarterContent(mountPath) {
  const vaultRoot = vaultRootOnMount(mountPath);
  const metaPath = path.join(vaultRoot, 'vault.meta.json');
  const dbPlain = path.join(vaultRoot, 'vault.db');
  const dbEnc = path.join(vaultRoot, 'vault.db.enc');
  return fs.existsSync(metaPath) && (fs.existsSync(dbPlain) || fs.existsSync(dbEnc));
}

/**
 * Whether this mount should receive the bundled template zip.
 * @param {object} [options]
 * @param {boolean} [options.force] - migration: always re-apply when zip exists
 */
export function shouldApplyTutaNotesTemplate(mountPath, options = {}) {
  if (!tutaNotesTemplateZipAvailable()) return false;
  const bundled = bundledTutaNotesTemplateVersion();
  if (!bundled) return false;
  if (options.force) return true;
  if (!vaultHasStarterContent(mountPath)) return true;
  const stored = readStoredTemplateVersion(mountPath);
  // Legacy vaults (no stamp) are migrated offline — do not wipe on unlock.
  if (!stored) return false;
  return stored !== bundled;
}

function stampTemplateVersionOnMeta(mountPath, version) {
  const metaPath = vaultMetaPath(mountPath);
  let meta = {};
  try {
    meta = readVaultMeta(mountPath) || {};
  } catch {
    meta = {};
  }
  meta[TUTA_NOTES_TEMPLATE_META_KEY] = version;
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

/**
 * Unzip tutaNotes_template.zip into mountPath (full vault restore).
 * @returns {Promise<{ applied: boolean, reason?: string, restoredFiles?: number }>}
 */
export async function applyTutaNotesTemplate(mountPath, options = {}) {
  if (!shouldApplyTutaNotesTemplate(mountPath, options)) {
    return { applied: false, reason: 'not_needed' };
  }
  const zipPath = tutaNotesTemplateZipPath();
  if (!fs.existsSync(zipPath)) {
    return { applied: false, reason: 'zip_missing' };
  }

  const result = await restorePlainVaultZipToMount(mountPath, zipPath);
  stampTemplateVersionOnMeta(mountPath, bundledTutaNotesTemplateVersion());
  return { applied: true, ...result };
}
