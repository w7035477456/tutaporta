/**
 * Seal a plaintext vault tree in place (TutaNotes + TutaPhotoAlbums): every regular file becomes
 * `<name>.enc` and the plaintext copy is removed. Symlinks under `files/` are removed too (the
 * link only, never its target) — encrypted vaults read samples from the shared store, and a link
 * would leave plaintext bytes reachable from the vault folder.
 */
import fs from 'fs';
import path from 'path';

/**
 * @param {{ dir: string, removeSymlinks?: boolean }[]} roots
 * @param {{ key: Buffer, sealVaultBuffer: Function, atomicWriteFileSync: Function, logPrefix: string }} opts
 */
export function sealPlaintextVaultTree(roots, { key, sealVaultBuffer, atomicWriteFileSync, logPrefix }) {
  const counts = { sealed: 0, skipped: 0, unlinked: 0 };

  function sealFile(absPath) {
    const base = path.basename(absPath);
    // Temp names that may appear mid-write.
    if (base.startsWith('.') || base.includes('.tmp-')) return;
    if (absPath.endsWith('.enc')) return;
    let plain;
    try {
      plain = fs.readFileSync(absPath);
    } catch (err) {
      console.warn(`${logPrefix} read failed`, absPath, err?.message || err);
      counts.skipped += 1;
      return;
    }
    if (!plain?.length) {
      counts.skipped += 1;
      return;
    }
    const dest = `${absPath}.enc`;
    try {
      // A sealed twin already exists (plaintext left behind by an earlier pass) — keep the sealed copy.
      if (!fs.existsSync(dest)) atomicWriteFileSync(dest, sealVaultBuffer(plain, key));
      fs.unlinkSync(absPath);
      counts.sealed += 1;
    } catch (err) {
      console.warn(`${logPrefix} seal failed`, absPath, err?.message || err);
      counts.skipped += 1;
    }
  }

  function walk(dir, removeSymlinks) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        if (removeSymlinks) {
          try {
            fs.unlinkSync(abs);
            counts.unlinked += 1;
          } catch (err) {
            console.warn(`${logPrefix} could not remove symlink`, abs, err?.message || err);
          }
        }
        continue;
      }
      if (entry.isDirectory()) walk(abs, removeSymlinks);
      else if (entry.isFile()) sealFile(abs);
    }
  }

  for (const { dir, removeSymlinks = false } of roots) {
    if (dir && fs.existsSync(dir)) walk(dir, removeSymlinks);
  }
  return counts;
}

/** First sealed `.enc` file (≤ maxBytes) under `dir`, or null — proves an unlock key opens the vault. */
export function findSealedVaultSampleFile(dir, { maxBytes = 8 * 1024 * 1024, maxDirs = 500 } = {}) {
  const stack = [dir];
  let visited = 0;
  while (stack.length && visited < maxDirs) {
    const current = stack.pop();
    visited += 1;
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
      } else if (entry.isFile() && entry.name.endsWith('.enc')) {
        try {
          if (fs.statSync(abs).size <= maxBytes) return abs;
        } catch {
          // vanished
        }
      }
    }
  }
  return null;
}
