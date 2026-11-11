import { afterEach, describe, expect, it } from 'vitest';
import {
  describeNextResticRun,
  formatResticSnapshotTime,
  listResticSnapshots,
  parseResticCronLine,
  parseResticSnapshotsJson,
  resolveResticSecretsEnvFile
} from './resticSnapshots.js';

describe('formatResticSnapshotTime', () => {
  it('keeps the host-local date and time like `restic snapshots`', () => {
    expect(formatResticSnapshotTime('2026-11-05T13:22:20.123456789-05:00')).toBe('2026-11-05 13:22:20');
  });

  it('returns unknown formats unchanged', () => {
    expect(formatResticSnapshotTime('yesterday')).toBe('yesterday');
    expect(formatResticSnapshotTime(null)).toBe('');
  });
});

describe('parseResticSnapshotsJson', () => {
  it('maps restic JSON to ID / Time / Host / Tags / Paths rows', () => {
    const rows = parseResticSnapshotsJson(
      JSON.stringify([
        {
          id: '583663f8aaaabbbbccccdddd',
          short_id: '583663f8',
          time: '2026-11-05T13:22:20.5-05:00',
          hostname: 'xbox2',
          tags: ['nightly', 'db'],
          paths: ['/home/lawsen0/code/main', '/home/lawsen0/ubuntu_storage']
        },
        { id: '4fe1b19d00001111', time: '2026-11-05T13:38:20-05:00', hostname: 'xbox2' }
      ])
    );
    expect(rows).toEqual([
      {
        id: '583663f8',
        fullId: '583663f8aaaabbbbccccdddd',
        time: '2026-11-05 13:22:20',
        host: 'xbox2',
        tags: ['nightly', 'db'],
        paths: ['/home/lawsen0/code/main', '/home/lawsen0/ubuntu_storage']
      },
      { id: '4fe1b19d', fullId: '4fe1b19d00001111', time: '2026-11-05 13:38:20', host: 'xbox2', tags: [], paths: [] }
    ]);
  });

  it('treats empty output as no snapshots', () => {
    expect(parseResticSnapshotsJson('')).toEqual([]);
    expect(parseResticSnapshotsJson('null')).toEqual([]);
  });
});

describe('resolveResticSecretsEnvFile', () => {
  it('prefers RESTIC_SECRETS_ENV_FILE', () => {
    expect(resolveResticSecretsEnvFile({ RESTIC_SECRETS_ENV_FILE: '/x/secrets.env' }, 'linux', '/home/u')).toBe('/x/secrets.env');
  });

  it('defaults to the showrestic secrets file per host', () => {
    expect(resolveResticSecretsEnvFile({}, 'linux', '/home/u')).toBe('/home/u/backups/.backup-secrets-ubuntu.env');
    expect(resolveResticSecretsEnvFile({}, 'darwin', '/Users/a')).toBe('/Users/a/backups/.backup-secrets-mac.env');
  });
});

const CRON_LINE =
  '0 17,18 * * * [ "$(TZ=America/New_York date +\\%H)" = 13 ] && /home/lawsen0/backups/scripts/backup-nightly.sh ' +
  '/home/lawsen0/backups/.backup-secrets-ubuntu.env >> /home/lawsen0/backups/backup-ubuntu.log 2>&1';

describe('parseResticCronLine', () => {
  it('reads minute, UTC hours, guard hour and log like resticcron', () => {
    expect(parseResticCronLine(CRON_LINE)).toEqual({
      minute: 0,
      utcHours: [17, 18],
      guardHour: 13,
      timeZone: 'America/New_York',
      dailyAt: '1:00 PM America/New_York',
      log: '/home/lawsen0/backups/backup-ubuntu.log'
    });
  });

  it('accepts the unescaped legacy %H form and rejects junk', () => {
    expect(parseResticCronLine(CRON_LINE.replace('\\%H', '%H')).guardHour).toBe(13);
    expect(parseResticCronLine('')).toBeNull();
  });
});

describe('describeNextResticRun', () => {
  it('picks the UTC slot that matches the guard hour (EST → 18:00 UTC)', () => {
    const schedule = parseResticCronLine(CRON_LINE);
    expect(describeNextResticRun(schedule, new Date('2026-11-11T18:55:00Z'))).toBe('Thu Nov 12 1:00 PM EST (in 23h 05m)');
    expect(describeNextResticRun(schedule, new Date('2026-11-11T17:30:00Z'))).toBe('Wed Nov 11 1:00 PM EST (in 0h 30m)');
  });

  it('uses the EDT slot in summer (17:00 UTC)', () => {
    const schedule = parseResticCronLine(CRON_LINE);
    expect(describeNextResticRun(schedule, new Date('2026-07-01T12:00:00Z'))).toBe('Wed Jul 1 1:00 PM EDT (in 5h 00m)');
  });
});

describe('listResticSnapshots', () => {
  const saved = process.env.RESTIC_SECRETS_ENV_FILE;
  afterEach(() => {
    if (saved === undefined) delete process.env.RESTIC_SECRETS_ENV_FILE;
    else process.env.RESTIC_SECRETS_ENV_FILE = saved;
  });

  it('reports not configured instead of failing when the secrets file is missing', async () => {
    process.env.RESTIC_SECRETS_ENV_FILE = '/nonexistent/.backup-secrets-test.env';
    await expect(listResticSnapshots()).resolves.toEqual({
      configured: false,
      envFile: '/nonexistent/.backup-secrets-test.env',
      schedule: null,
      snapshots: []
    });
  });
});
