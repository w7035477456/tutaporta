import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import ColorTemplate9TableData from 'ui-component/ColorTemplate9TableData';
import { fetchAdminResticSnapshots } from 'api/adminToolsFe';

/** Same columns as `showrestic` → `restic snapshots`: ID, Time, Host, Tags, Paths, plus added / total size. */
const RESTIC_GRID_COLUMNS = '110px 190px 110px minmax(220px, 1.2fr) minmax(360px, 2fr) 110px 110px 100px 100px 100px';
const RESTIC_MIN_TABLE_WIDTH = 1520;

/** Users at backup time (from `users_*` snapshot tags); `—` for snapshots made before counting existed. */
const RESTIC_USER_COUNT_COLUMNS = [
  ['TutaDates', 'usersDates'],
  ['TutaNotes', 'usersNotes'],
  ['TutaPhoto', 'usersPhotos']
];

/** Bytes → `1.02 MB` / `2.21 GB` (binary units, like restic). */
function formatResticBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(2)} ${units[unit]}`;
}

const monoTextSx = {
  fontFamily: 'monospace',
  fontSize: '0.85rem',
  lineHeight: 1.35,
  wordBreak: 'break-all'
};

const scheduleTextSx = {
  m: 0,
  px: 1,
  py: 1,
  fontFamily: 'monospace',
  fontSize: '0.9rem',
  lineHeight: 1.45,
  color: '#fff',
  whiteSpace: 'pre-wrap'
};

/** Same block as `resticcron` → "1) WHEN IT RUNS". */
function resticScheduleText(schedule) {
  const hours = (schedule.utcHours || []).join(',');
  return [
    'WHEN IT RUNS',
    `Daily at  : ${schedule.dailyAt || '(cannot parse guard hour from crontab)'}`,
    `cron UTC  : minute ${schedule.minute}, hour(s) ${hours}`,
    'Why two   : UTC slots cover EDT+EST so DST never shifts a day;',
    `            the "= ${schedule.guardHour ?? '?'}" guard lets only the matching slot run.`,
    `Log       : ${schedule.log}`,
    'Enclosure : wakes + mounts before backup; spin-down + USB power-off after success',
    ...(schedule.nextRun ? [`Next run  : ${schedule.nextRun}`] : [])
  ].join('\n');
}

export default function AdminToolsResticTab({ onError }) {
  const [snapshots, setSnapshots] = useState([]);
  const [envFile, setEnvFile] = useState('');
  const [configured, setConfigured] = useState(true);
  const [schedule, setSchedule] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    onError?.('');
    try {
      const data = await fetchAdminResticSnapshots();
      setSnapshots(Array.isArray(data?.snapshots) ? data.snapshots : []);
      setEnvFile(String(data?.envFile ?? ''));
      setConfigured(data?.configured !== false);
      setSchedule(data?.schedule ?? null);
    } catch (err) {
      onError?.(err);
      setSnapshots([]);
      setSchedule(err?.response?.data?.schedule ?? null);
    } finally {
      setBusy(false);
      setLoaded(true);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <ColorTemplate9TableData.Button type="button" disabled={busy} onClick={() => void load()}>
          {busy ? 'Loading…' : 'Refresh'}
        </ColorTemplate9TableData.Button>
        {loaded && !busy && configured ? (
          <ColorTemplate9TableData.BodyText sx={{ opacity: 0.85 }}>
            {snapshots.length} snapshot(s){envFile ? ` · ${envFile}` : ''}
          </ColorTemplate9TableData.BodyText>
        ) : null}
      </Box>

      {schedule && !busy ? (
        <Box component="pre" sx={scheduleTextSx}>
          {resticScheduleText(schedule)}
        </Box>
      ) : null}

      {busy ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : loaded && !configured ? (
        <ColorTemplate9TableData.EmptyText>
          Restic backups are not set up on this server (no secrets file at {envFile}). Nightly backups run on the Ubuntu box — open this tab
          there, or set RESTIC_SECRETS_ENV_FILE in the BE .env.
        </ColorTemplate9TableData.EmptyText>
      ) : loaded && snapshots.length === 0 ? (
        <ColorTemplate9TableData.EmptyText>No restic snapshots.</ColorTemplate9TableData.EmptyText>
      ) : snapshots.length ? (
        <ColorTemplate9TableData.Table minTableWidth={RESTIC_MIN_TABLE_WIDTH}>
          <ColorTemplate9TableData.HeaderRow gridTemplateColumns={RESTIC_GRID_COLUMNS}>
            <ColorTemplate9TableData.HeaderCell>ID</ColorTemplate9TableData.HeaderCell>
            <ColorTemplate9TableData.HeaderCell>Time</ColorTemplate9TableData.HeaderCell>
            <ColorTemplate9TableData.HeaderCell>Host</ColorTemplate9TableData.HeaderCell>
            <ColorTemplate9TableData.HeaderCell>Tags</ColorTemplate9TableData.HeaderCell>
            <ColorTemplate9TableData.HeaderCell>Paths</ColorTemplate9TableData.HeaderCell>
            <ColorTemplate9TableData.HeaderCell>Inc Size</ColorTemplate9TableData.HeaderCell>
            <ColorTemplate9TableData.HeaderCell>Total Size</ColorTemplate9TableData.HeaderCell>
            {RESTIC_USER_COUNT_COLUMNS.map(([label]) => (
              <ColorTemplate9TableData.HeaderCell key={label}>{label}</ColorTemplate9TableData.HeaderCell>
            ))}
          </ColorTemplate9TableData.HeaderRow>
          {snapshots.map((snap, index) => (
            <ColorTemplate9TableData.BodyRow key={snap.fullId || snap.id} rowIndex={index} gridTemplateColumns={RESTIC_GRID_COLUMNS}>
              <ColorTemplate9TableData.BodyCell>
                <ColorTemplate9TableData.BodyText title={snap.fullId} sx={monoTextSx}>
                  {snap.id}
                </ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell>
                <ColorTemplate9TableData.BodyText sx={monoTextSx}>{snap.time}</ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell>
                <ColorTemplate9TableData.BodyText sx={monoTextSx}>{snap.host}</ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell>
                <ColorTemplate9TableData.BodyText sx={monoTextSx}>{(snap.tags || []).join(',')}</ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                {(snap.paths || []).map((p) => (
                  <ColorTemplate9TableData.BodyText key={p} sx={monoTextSx}>
                    {p}
                  </ColorTemplate9TableData.BodyText>
                ))}
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell>
                <ColorTemplate9TableData.BodyText sx={monoTextSx}>{formatResticBytes(snap.incBytes)}</ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell>
                <ColorTemplate9TableData.BodyText sx={monoTextSx}>{formatResticBytes(snap.totalBytes)}</ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
              {RESTIC_USER_COUNT_COLUMNS.map(([label, key]) => (
                <ColorTemplate9TableData.BodyCell key={label}>
                  <ColorTemplate9TableData.BodyText sx={monoTextSx}>
                    {Number.isFinite(snap[key]) ? snap[key].toLocaleString() : '—'}
                  </ColorTemplate9TableData.BodyText>
                </ColorTemplate9TableData.BodyCell>
              ))}
            </ColorTemplate9TableData.BodyRow>
          ))}
        </ColorTemplate9TableData.Table>
      ) : null}
    </Box>
  );
}

AdminToolsResticTab.propTypes = {
  onError: PropTypes.func
};
