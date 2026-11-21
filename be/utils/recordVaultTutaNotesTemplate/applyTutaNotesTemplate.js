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
  if (!fs.existsSync(metaPath)) return false;
  const filesDir = path.join(vaultRoot, 'files');
  try {
    if (fs.existsSync(filesDir) && fs.readdirSync(filesDir).length > 0) return true;
  } catch {
    // ignore
  }
  return false;
}

/** Bundled asset must be a plain zip; TNBAK* sealed backups cannot be applied server-side. */
function isPlainZipTemplate(zipPath) {
  try {
    const fd = fs.openSync(zipPath, 'r');
    try {
      const buf = Buffer.alloc(8);
      const n = fs.readSync(fd, buf, 0, 8, 0);
      if (n < 4) return false;
      const head = buf.slice(0, 6).toString('utf8');
      if (head.startsWith('TNBAK')) return false;
      // Local file header / empty zip / spanned zip
      return buf[0] === 0x50 && buf[1] === 0x4b;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return false;
  }
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
export async function applyTutaNotesTemplate(mountPath, options = {}, { singlesId = null } = {}) {
  if (!shouldApplyTutaNotesTemplate(mountPath, options)) {
    return { applied: false, reason: 'not_needed' };
  }
  const zipPath = tutaNotesTemplateZipPath();
  if (!fs.existsSync(zipPath)) {
    return { applied: false, reason: 'zip_missing' };
  }
  if (!isPlainZipTemplate(zipPath)) {
    return { applied: false, reason: 'zip_not_plain' };
  }

  const result = await restorePlainVaultZipToMount(mountPath, zipPath, { singlesId });
  stampTemplateVersionOnMeta(mountPath, bundledTutaNotesTemplateVersion());
  return { applied: true, ...result };
}
