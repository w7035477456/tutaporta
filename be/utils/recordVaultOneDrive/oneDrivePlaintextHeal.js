import fs from 'fs';
import path from 'path';
import {
  VAULT_META_FILE,
  listVaultDbFileNames,
  resolveVaultDbPath,
  vaultRootOnMount
} from '../recordVaultUsb/vaultPaths.js';
import { readVaultMeta } from '../recordVaultUsb/usbScan.js';
import { openVaultBuffer } from '../recordVaultUsb/vaultCrypto.js';
import {
  isRecordVaultIconEncryptionEnabled,
  vaultMetaUsesPlaintextStorage
} from '../recordVaultIconEncryption.js';
import { initializeVaultOnUsbWithKey } from '../recordVaultUsb/vaultSession.js';
import { uploadOneDriveVaultEssentials } from './oneDriveVaultSync.js';
import { rvCloudLog } from '../recordVaultCloudDebugLog.js';

function isSqliteBuffer(buf) {
  return Buffer.isBuffer(buf) && buf.slice(0, 15).toString('utf8') === 'SQLite format 3';
}

function isReadablePlaintextVaultDb(mountPath) {
  try {
    const dbPath = resolveVaultDbPath(mountPath);
    const raw = fs.readFileSync(dbPath);
    const plain = openVaultBuffer(raw, null);
    return isSqliteBuffer(plain);
  } catch {
    return false;
  }
}

function clearVaultEssentialsOnStaging(mountPath) {
  const root = vaultRootOnMount(mountPath);
  for (const name of [VAULT_META_FILE, ...listVaultDbFileNames()]) {
    const abs = path.join(root, name);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  }
}

/** When icon encryption is off, rewrite bad/old vault files — only for explicit Create/Format, never unlock. */
export async function ensurePlaintextOneDriveVaultStaging(singlesId, mountPath, { upload = false } = {}) {
  if (!isRecordVaultIconEncryptionEnabled()) return false;

  const meta = readVaultMeta(mountPath);
  const needsHeal =
    !meta?.vaultId || !vaultMetaUsesPlaintextStorage(meta) || !isReadablePlaintextVaultDb(mountPath);
  if (!needsHeal) return false;

  rvCloudLog('OneDrive', 'heal — recreating plaintext vault locally', { singlesId, upload });
  clearVaultEssentialsOnStaging(mountPath);
  await initializeVaultOnUsbWithKey(mountPath, null);
  if (upload) {
    await uploadOneDriveVaultEssentials(singlesId, mountPath);
  }
  return true;
}
