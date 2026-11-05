import { execFileSync } from 'child_process';
import fs from 'fs';

/** @typedef {'active' | 'spun_down' | 'offline' | 'not_configured'} TerramasterEnclosureStatus */

export const TERRAMASTER_MOUNT_DEFAULT = '/mnt/terramaster';

/**
 * Classify external TerraMaster restic enclosure (nightly backup cron).
 * - active: disk spun up (mounted or motor active/idle) — full power
 * - spun_down: block device visible but drive in standby/sleep — low power, still on USB
 * - offline: no block device (typical after terramaster_spin_down_and_power_off) — minimal host USB draw
 * - not_configured: non-Linux or no fstab entry for the mount
 *
 * @param {{ mounted: boolean, blockDevice: string | null, driveState: string | null }} input
 * @returns {TerramasterEnclosureStatus}
 */
export function classifyTerramasterEnclosureStatus({ mounted, blockDevice, driveState }) {
  if (mounted) return 'active';
  if (!blockDevice) return 'offline';

  const state = String(driveState ?? '')
    .trim()
    .toLowerCase();
  if (state === 'standby' || state === 'sleeping') return 'spun_down';
  return 'active';
}

/**
 * Parse `hdparm -C /dev/sdX` (drive state is: active|idle|standby|sleeping|unknown).
 * @param {string} hdparmOutput
 * @returns {string | null}
 */
export function parseHdparmDriveState(hdparmOutput) {
  const match = String(hdparmOutput ?? '').match(/drive state is:\s*(\S+)/i);
  return match ? match[1].toLowerCase() : null;
}

function readFstabUuidForMount(mountPoint, readFile = (p) => fs.readFileSync(p, 'utf8')) {
  const mnt = String(mountPoint ?? '').trim();
  if (!mnt) return null;
  try {
    const fstab = readFile('/etc/fstab');
    for (const line of fstab.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const cols = trimmed.split(/\s+/);
      if (cols.length < 2 || cols[1] !== mnt) continue;
      const fsSpec = cols[0];
      if (fsSpec.startsWith('UUID=')) return fsSpec.slice(5);
      return fsSpec.replace(/^UUID=/, '');
    }
  } catch {
    return null;
  }
  return null;
}

function execQuiet(cmd, args, execFile = execFileSync) {
  try {
    return execFile(cmd, args, {
      encoding: 'utf8',
      timeout: 8000,
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
}

function isMountedAt(mountPoint, execFile = execFileSync) {
  const mnt = String(mountPoint ?? '').trim();
  if (!mnt) return false;
  const source = execQuiet('findmnt', ['-no', 'SOURCE', '-T', mnt], execFile);
  if (!source) return false;
  const rootSource = execQuiet('findmnt', ['-no', 'SOURCE', '-T', '/'], execFile);
  return Boolean(source && source !== rootSource);
}

function blockDeviceForUuid(uuid, execFile = execFileSync) {
  const id = String(uuid ?? '').trim();
  if (!id) return null;

  const byUuid = `/dev/disk/by-uuid/${id}`;
  try {
    if (fs.existsSync(byUuid)) {
      return fs.realpathSync(byUuid);
    }
  } catch {
    // fall through
  }

  const dev = execQuiet('blkid', ['-U', id, '-o', 'device'], execFile);
  if (!dev) return null;
  try {
    if (fs.existsSync(dev) && fs.statSync(dev).isBlockDevice()) {
      return fs.realpathSync(dev);
    }
  } catch {
    return null;
  }
  return null;
}

function readHdparmDriveState(blockDevice, execFile = execFileSync) {
  const dev = String(blockDevice ?? '').trim();
  if (!dev) return null;
  const out = execQuiet('hdparm', ['-C', dev], execFile);
  return out ? parseHdparmDriveState(out) : null;
}

function terraMasterUsbVisible(readDir = fs.readdirSync, readFile = (p) => fs.readFileSync(p, 'utf8')) {
  const base = '/sys/bus/usb/devices';
  let entries;
  try {
    entries = readDir(base);
  } catch {
    return false;
  }
  for (const name of entries) {
    const productPath = `${base}/${name}/product`;
    try {
      const product = readFile(productPath, 'utf8');
      if (/terra|tdas/i.test(product)) return true;
    } catch {
      // skip
    }
  }
  return false;
}

/**
 * Best-effort TerraMaster external enclosure status for nightly restic backup (Ubuntu Primary).
 *
 * @param {{
 *   mountPoint?: string,
 *   platform?: NodeJS.Platform,
 *   execFile?: typeof execFileSync,
 *   readFile?: (path: string, encoding?: string) => string,
 *   readDir?: typeof fs.readdirSync,
 * }} [opts]
 * @returns {{
 *   status: TerramasterEnclosureStatus,
 *   mountPoint: string,
 *   mounted: boolean,
 *   blockDevice: string | null,
 *   uuid: string | null,
 *   driveState: string | null,
 *   terraUsbVisible: boolean,
 *   spinUpTakingPower: boolean,
 *   label: string,
 * }}
 */
export function getTerramasterEnclosureStatus(opts = {}) {
  const mountPoint = String(opts.mountPoint ?? process.env.TERRAMASTER_MOUNT ?? TERRAMASTER_MOUNT_DEFAULT).trim();
  const platform = opts.platform ?? process.platform;
  const execFile = opts.execFile ?? execFileSync;
  const readFile = opts.readFile ?? ((p, enc) => fs.readFileSync(p, enc ?? 'utf8'));
  const readDir = opts.readDir ?? fs.readdirSync;

  const empty = (status, extra = {}) => ({
    status,
    mountPoint,
    mounted: false,
    blockDevice: null,
    uuid: null,
    driveState: null,
    terraUsbVisible: false,
    spinUpTakingPower: false,
    label: terramasterEnclosureStatusLabel(status),
    ...extra
  });

  if (platform !== 'linux') {
    return empty('not_configured');
  }

  const uuid = readFstabUuidForMount(mountPoint, readFile);
  if (!uuid) {
    return empty('not_configured');
  }

  const mounted = isMountedAt(mountPoint, execFile);
  const blockDevice = blockDeviceForUuid(uuid, execFile);
  const driveState = blockDevice ? readHdparmDriveState(blockDevice, execFile) : null;
  const terraUsb = terraMasterUsbVisible(readDir, readFile);
  const status = classifyTerramasterEnclosureStatus({ mounted, blockDevice, driveState });

  return {
    status,
    mountPoint,
    mounted,
    blockDevice,
    uuid,
    driveState,
    terraUsbVisible: terraUsb,
    spinUpTakingPower: status === 'active',
    label: terramasterEnclosureStatusLabel(status)
  };
}

/** @param {TerramasterEnclosureStatus} status */
export function terramasterEnclosureStatusLabel(status) {
  switch (status) {
    case 'active':
      return 'Active — disk spun up (using power)';
    case 'spun_down':
      return 'Spun down — on USB, motor parked';
    case 'offline':
      return 'Offline — no block device (USB powered off)';
    case 'not_configured':
      return 'Not configured on this host';
    default:
      return String(status);
  }
}
