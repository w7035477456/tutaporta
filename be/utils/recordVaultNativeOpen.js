import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';

const NATIVE_OPEN_EXTENSIONS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);

export function isRecordVaultNativeOpenSupported() {
  return process.platform === 'darwin';
}

export function canNativeOpenRecordVaultExtension(ext) {
  const normalized = String(ext || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
  return NATIVE_OPEN_EXTENSIONS.has(normalized);
}

function sanitizeFileName(fileName, ext) {
  const raw = String(fileName || '').trim() || `file.${ext || 'bin'}`;
  const base = path.basename(raw).replace(/[^\w.\- ()[\]]+/g, '_');
  if (!base || base === '.' || base === '..') return `file.${ext || 'bin'}`;
  return base;
}

/** Write vault attachment bytes to a temp file and open with the Mac default app (Word, Excel, etc.). */
export async function openBufferInMacNativeApp(buffer, fileName, ext) {
  if (!isRecordVaultNativeOpenSupported()) {
    const err = new Error('Native app open is only available on Mac');
    err.code = 'NATIVE_OPEN_UNSUPPORTED';
    throw err;
  }
  if (!buffer?.length) {
    throw new Error('Attachment file is empty');
  }

  const cleanExt = String(ext || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
  const tempDir = path.join(os.tmpdir(), 'recordvault-open', randomUUID());
  fs.mkdirSync(tempDir, { recursive: true });
  const tempPath = path.join(tempDir, sanitizeFileName(fileName, cleanExt));
  fs.writeFileSync(tempPath, buffer);

  await new Promise((resolve, reject) => {
    const child = spawn('open', [tempPath], { stdio: 'ignore' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`macOS could not open the file (exit ${code})`));
    });
  });

  return { opened: true, path: tempPath };
}
