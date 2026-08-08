#!/usr/bin/env node
/**
 * Initialize a Record Vault USB at a mount path.
 * Usage: node be/scripts/initRecordVaultUsb.js /Volumes/MyVault anchor
 */
import { initializeVaultOnUsb } from '../utils/recordVaultUsb/vaultSession.js';

const mountPath = process.argv[2];
const iconName = process.argv[3];

if (!mountPath || !iconName) {
  console.error('Usage: node be/scripts/initRecordVaultUsb.js <mountPath> <icon-name>');
  process.exit(1);
}

try {
  const meta = await initializeVaultOnUsb(mountPath, iconName);
  console.log('Record Vault USB initialized.');
  console.log('vaultId:', meta.vaultId);
  console.log('path:', mountPath);
} catch (err) {
  console.error('Failed:', err?.message || err);
  process.exit(1);
}
