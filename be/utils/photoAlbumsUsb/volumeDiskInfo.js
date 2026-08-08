import { execFileSync } from 'child_process';
import fs from 'fs';

function parseGbFromBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round((value / (1024 * 1024 * 1024)) * 10) / 10;
}

function parseLeadingGb(text) {
  const match = String(text ?? '').match(/([\d.]+)\s*GB/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 10) / 10 : null;
}

function normalizeFileSystem(raw) {
  const value = String(raw ?? '')
    .trim()
    .replace(/\s*\(.*$/, '')
    .toUpperCase();
  if (!value) return null;
  if (value.includes('APFS')) return 'APFS';
  if (value.includes('EXFAT')) return 'EXFAT';
  if (value.includes('MS-DOS') || value.includes('FAT32')) return 'FAT32';
  if (value.includes('NTFS')) return 'NTFS';
  if (value.includes('HFS')) return 'HFS+';
  if (value.includes('EXT4')) return 'EXT4';
  if (value.includes('EXT3')) return 'EXT3';
  if (value.includes('EXT2')) return 'EXT2';
  return value.split(/\s+/)[0] || null;
}

function withFreePercent(sizeGb, availGb) {
  if (sizeGb == null || availGb == null || sizeGb <= 0) {
    return { sizeGb, availGb, freePercent: null };
  }
  const freePercent = Math.max(0, Math.min(100, Math.round((availGb / sizeGb) * 100)));
  return { sizeGb, availGb, freePercent };
}

function readDarwinVolumeDiskInfo(mountPath) {
  try {
    const out = execFileSync('diskutil', ['info', mountPath], {
      encoding: 'utf8',
      timeout: 8000,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const fsMatch =
      out.match(/File System Personality:\s+(.+)/i) ||
      out.match(/Type \(Bundle\):\s+(.+)/i) ||
      out.match(/Content \(IOContent\):\s+(.+)/i);
    const sizeMatch =
      out.match(/Volume Total Space:\s+([\d.]+\s*GB[^(\n]*)/i) ||
      out.match(/Disk Size:\s+([\d.]+\s*GB[^(\n]*)/i);
    const freeMatch =
      out.match(/Volume Free Space:\s+([\d.]+\s*GB[^(\n]*)/i) ||
      out.match(/Container Free Space:\s+([\d.]+\s*GB[^(\n]*)/i);
    const sizeGb = sizeMatch ? parseLeadingGb(sizeMatch[1]) : null;
    const availGb = freeMatch ? parseLeadingGb(freeMatch[1]) : null;
    const free = withFreePercent(sizeGb, availGb);
    return {
      sizeGb: free.sizeGb,
      availGb: free.availGb,
      freePercent: free.freePercent,
      fileSystem: fsMatch ? normalizeFileSystem(fsMatch[1]) : null
    };
  } catch {
    return readDfVolumeDiskInfo(mountPath);
  }
}

function readDfVolumeDiskInfo(mountPath) {
  try {
    const out = execFileSync('df', ['-Pk', mountPath], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const lines = out.trim().split('\n');
    if (lines.length < 2) {
      return { sizeGb: null, availGb: null, freePercent: null, fileSystem: null };
    }
    const cols = lines[1].trim().split(/\s+/);
    const sizeKb = Number(cols[1]);
    const availKb = Number(cols[3]);
    const sizeGb = Number.isFinite(sizeKb) ? parseGbFromBytes(sizeKb * 1024) : null;
    const availGb = Number.isFinite(availKb) ? parseGbFromBytes(availKb * 1024) : null;
    const free = withFreePercent(sizeGb, availGb);
    return {
      sizeGb: free.sizeGb,
      availGb: free.availGb,
      freePercent: free.freePercent,
      fileSystem: null
    };
  } catch {
    return { sizeGb: null, availGb: null, freePercent: null, fileSystem: null };
  }
}

function readLinuxVolumeDiskInfo(mountPath) {
  try {
    const out = execFileSync('findmnt', ['-n', '-o', 'FSTYPE,SIZE', mountPath], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const parts = out.trim().split(/\s+/);
    const fileSystem = normalizeFileSystem(parts[0]);
    const sizeToken = parts.slice(1).join(' ');
    const sizeGb = /gb/i.test(sizeToken)
      ? parseLeadingGb(sizeToken)
      : /^\d+$/.test(sizeToken)
        ? parseGbFromBytes(Number(sizeToken))
        : null;
    if (sizeGb != null || fileSystem) {
      const df = readDfVolumeDiskInfo(mountPath);
      const free = withFreePercent(sizeGb ?? df.sizeGb, df.availGb);
      return {
        sizeGb: free.sizeGb,
        availGb: free.availGb,
        freePercent: free.freePercent,
        fileSystem
      };
    }
  } catch {
    // fall through
  }
  const df = readDfVolumeDiskInfo(mountPath);
  try {
    const out = execFileSync('findmnt', ['-n', '-o', 'FSTYPE', mountPath], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return { ...df, fileSystem: normalizeFileSystem(out.trim()) || df.fileSystem };
  } catch {
    return df;
  }
}

function readWindowsVolumeDiskInfo(mountPath) {
  const letter = String(mountPath ?? '')
    .trim()
    .replace(/:\\$/, '')
    .toUpperCase();
  if (!letter) return { sizeGb: null, availGb: null, freePercent: null, fileSystem: null };
  try {
    const out = execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `$v = Get-Volume -DriveLetter '${letter}' -ErrorAction SilentlyContinue; if ($v) { Write-Output ($v.FileSystem + '|' + $v.Size + '|' + $v.SizeRemaining) }`
      ],
      { encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const line = out.trim().split('\n').pop() || '';
    const [fileSystemRaw, sizeRaw, availRaw] = line.split('|');
    const sizeGb = parseGbFromBytes(sizeRaw);
    const availGb = parseGbFromBytes(availRaw);
    const free = withFreePercent(sizeGb, availGb);
    return {
      fileSystem: normalizeFileSystem(fileSystemRaw),
      sizeGb: free.sizeGb,
      availGb: free.availGb,
      freePercent: free.freePercent
    };
  } catch {
    return { sizeGb: null, availGb: null, freePercent: null, fileSystem: null };
  }
}

/** Best-effort volume size (GB), free space, and filesystem label for a mount path. */
export function readVolumeDiskInfo(mountPath, platform = process.platform) {
  const normalized = String(mountPath ?? '').trim();
  if (!normalized) {
    return { sizeGb: null, availGb: null, freePercent: null, fileSystem: null };
  }
  try {
    if (!fs.existsSync(normalized)) {
      return { sizeGb: null, availGb: null, freePercent: null, fileSystem: null };
    }
  } catch {
    return { sizeGb: null, availGb: null, freePercent: null, fileSystem: null };
  }

  if (platform === 'darwin') return readDarwinVolumeDiskInfo(normalized);
  if (platform === 'win32') return readWindowsVolumeDiskInfo(normalized);
  if (platform === 'linux') return readLinuxVolumeDiskInfo(normalized);
  return readDfVolumeDiskInfo(normalized);
}

export function formatVolumeDiskInfoLabel(sizeGb, fileSystem) {
  const parts = [];
  if (sizeGb != null) parts.push(`${sizeGb} GB`);
  if (fileSystem) parts.push(fileSystem);
  return parts.join(', ');
}
