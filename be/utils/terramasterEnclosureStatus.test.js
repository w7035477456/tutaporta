import { describe, expect, it } from 'vitest';
import {
  classifyTerramasterEnclosureStatus,
  parseHdparmDriveState,
  terramasterEnclosureStatusLabel
} from './terramasterEnclosureStatus.js';

describe('classifyTerramasterEnclosureStatus', () => {
  it('treats mounted volume as active regardless of drive state', () => {
    expect(
      classifyTerramasterEnclosureStatus({
        mounted: true,
        blockDevice: '/dev/sdb',
        driveState: 'standby'
      })
    ).toBe('active');
  });

  it('offline when no block device', () => {
    expect(
      classifyTerramasterEnclosureStatus({
        mounted: false,
        blockDevice: null,
        driveState: null
      })
    ).toBe('offline');
  });

  it('spun_down when block present and hdparm reports standby or sleeping', () => {
    expect(
      classifyTerramasterEnclosureStatus({
        mounted: false,
        blockDevice: '/dev/sdb',
        driveState: 'standby'
      })
    ).toBe('spun_down');
    expect(
      classifyTerramasterEnclosureStatus({
        mounted: false,
        blockDevice: '/dev/sdb',
        driveState: 'sleeping'
      })
    ).toBe('spun_down');
  });

  it('active when block present and drive active or idle', () => {
    expect(
      classifyTerramasterEnclosureStatus({
        mounted: false,
        blockDevice: '/dev/sdb',
        driveState: 'active'
      })
    ).toBe('active');
    expect(
      classifyTerramasterEnclosureStatus({
        mounted: false,
        blockDevice: '/dev/sdb',
        driveState: 'unknown'
      })
    ).toBe('active');
  });
});

describe('parseHdparmDriveState', () => {
  it('parses hdparm -C output', () => {
    expect(parseHdparmDriveState(' setting standby to 0\n drive state is:  standby')).toBe('standby');
    expect(parseHdparmDriveState(' drive state is:  active')).toBe('active');
  });
});

describe('terramasterEnclosureStatusLabel', () => {
  it('includes power hint for active', () => {
    expect(terramasterEnclosureStatusLabel('active')).toMatch(/power/i);
    expect(terramasterEnclosureStatusLabel('offline')).toMatch(/powered off/i);
  });
});
