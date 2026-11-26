import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import ColorTemplate9TableData from 'ui-component/ColorTemplate9TableData';
import { themedConfirm } from 'utils/themedDialog';
import { adminStorageTreeFileUrl, fetchAdminStorageDuplicates, removeAdminStorageDuplicates } from 'api/adminToolsFe';

const THUMB_PX = 56;
const ROOT_LABEL = { fast: 'FAST', large: 'LARGE' };
const IMAGE_RE = /\.(jpe?g|png|gif|webp|bmp)(\.enc)?$/i;
const GRID = {
  xs: `${THUMB_PX + 20}px minmax(0, 1fr)`,
  sm: `${THUMB_PX + 20}px minmax(0, 2.6fr) minmax(0, 0.9fr) minmax(0, 1.6fr) minmax(0, 0.9fr)`
};
/** Table body text is nowrap by default; long paths and reasons must wrap inside their own column. */
const WRAP = { whiteSpace: 'normal', overflowWrap: 'anywhere', minWidth: 0 };

function statusOf(file) {
  if (file.keep) return { label: 'Keep', color: 'var(--theme-primary-color)' };
  if (file.removable) return { label: 'Unused — will remove', color: '#e53935' };
  return { label: 'In use — kept', color: 'inherit' };
}

function Thumb({ file }) {
  if (!IMAGE_RE.test(file.treePath)) return <Box sx={{ width: THUMB_PX, height: THUMB_PX }} />;
  return (
    <Box
      component="img"
      src={adminStorageTreeFileUrl(file.rootKey, file.treePath)}
      alt=""
      loading="lazy"
      sx={{ width: THUMB_PX, height: THUMB_PX, objectFit: 'cover', border: '1px solid var(--theme-primary-color)' }}
      onError={(e) => {
        e.currentTarget.style.visibility = 'hidden';
      }}
    />
  );
}
Thumb.propTypes = { file: PropTypes.object.isRequired };

function GroupTable({ group, busy, disabled, onRemove }) {
  return (
    <ColorTemplate9TableData.Panel>
      <ColorTemplate9TableData.GroupTitle>
        Same file ({group.sizeLabel}) — {group.files.length} copies
        {group.removableCount ? ` — ${group.removableCount} unused` : ' — all in use'}
      </ColorTemplate9TableData.GroupTitle>
      <ColorTemplate9TableData.Table minTableWidth={900}>
        <ColorTemplate9TableData.HeaderRow gridTemplateColumns={GRID}>
          <ColorTemplate9TableData.HeaderCell aria-hidden />
          <ColorTemplate9TableData.HeaderCell>
            <ColorTemplate9TableData.Button
              type="button"
              disabled={disabled || !group.removableCount}
              onClick={onRemove}
              sx={{ borderRadius: 999, px: 2, py: 0.5, minHeight: 32 }}
            >
              {busy ? 'Removing…' : group.removableCount ? `Remove ${group.removableCount} unused` : 'Nothing to remove'}
            </ColorTemplate9TableData.Button>
          </ColorTemplate9TableData.HeaderCell>
          <ColorTemplate9TableData.HeaderCell sx={{ display: { xs: 'none', sm: 'flex' } }}>Kind</ColorTemplate9TableData.HeaderCell>
          <ColorTemplate9TableData.HeaderCell sx={{ display: { xs: 'none', sm: 'flex' } }}>Used by</ColorTemplate9TableData.HeaderCell>
          <ColorTemplate9TableData.HeaderCell sx={{ display: { xs: 'none', sm: 'flex' } }}>Status</ColorTemplate9TableData.HeaderCell>
        </ColorTemplate9TableData.HeaderRow>
        {group.files.map((file, i) => {
          const status = statusOf(file);
          return (
            <ColorTemplate9TableData.BodyRow key={`${file.rootKey}:${file.treePath}`} rowIndex={i} gridTemplateColumns={GRID}>
              <ColorTemplate9TableData.BodyCell>
                <Thumb file={file} />
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell sx={{ flexDirection: 'column', alignItems: 'flex-start', overflow: 'hidden' }}>
                <ColorTemplate9TableData.BodyText sx={{ ...WRAP, fontWeight: 600 }}>
                  {ROOT_LABEL[file.rootKey] || file.rootKey}: {file.treePath}
                </ColorTemplate9TableData.BodyText>
                <ColorTemplate9TableData.BodyText sx={{ ...WRAP, display: { xs: 'block', sm: 'none' }, color: status.color }}>
                  {file.kind} · {status.label}
                </ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell sx={{ display: { xs: 'none', sm: 'flex' } }}>
                <ColorTemplate9TableData.BodyText sx={WRAP}>{file.kind}</ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell sx={{ display: { xs: 'none', sm: 'flex' } }}>
                <ColorTemplate9TableData.BodyText sx={WRAP}>{file.usedBy || '—'}</ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell sx={{ display: { xs: 'none', sm: 'flex' } }}>
                <ColorTemplate9TableData.BodyText sx={{ ...WRAP, color: status.color, fontWeight: 700 }}>
                  {status.label}
                </ColorTemplate9TableData.BodyText>
              </ColorTemplate9TableData.BodyCell>
            </ColorTemplate9TableData.BodyRow>
          );
        })}
      </ColorTemplate9TableData.Table>
    </ColorTemplate9TableData.Panel>
  );
}
GroupTable.propTypes = { group: PropTypes.object.isRequired, busy: PropTypes.bool, disabled: PropTypes.bool, onRemove: PropTypes.func };

/**
 * Admin Tools → Duplicate: same size + SHA-256 files under FAST/users and LARGE/users.
 * Default demo notes / demo photo album are excluded by the server. Only unused copies can be
 * removed; one copy of every file always stays.
 */
export default function AdminToolsDuplicateTab({ onError }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setNotice('');
    onError?.('');
    try {
      setData(await fetchAdminStorageDuplicates());
    } catch (err) {
      onError?.(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = useCallback(
    async (groups, key) => {
      const count = groups.reduce((s, g) => s + g.removableCount, 0);
      if (!count) return;
      const what = groups.length === 1 ? `this group (${groups[0].sizeLabel})` : `${groups.length} groups`;
      if (
        !(await themedConfirm(
          `Delete ${count} unused duplicate file(s) from ${what}?\n\nOnly copies that no note, photo album, bill receipt or TutaDates photo uses are deleted. One copy of every file is kept. This cannot be undone.`
        ))
      ) {
        return;
      }
      setBusyKey(key);
      setNotice('');
      onError?.('');
      try {
        const res = await removeAdminStorageDuplicates(key === 'all' ? null : groups.map((g) => g.sha256));
        setData(res);
        const failed = res?.removed?.failed?.length || 0;
        setNotice(
          `Removed ${res?.removed?.count ?? 0} file(s), freed ${res?.removed?.label ?? '0 B'}.${failed ? ` ${failed} skipped (see server log).` : ''}`
        );
      } catch (err) {
        onError?.(err);
      } finally {
        setBusyKey('');
      }
    },
    [onError]
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  const groups = Array.isArray(data?.groups) ? data.groups : [];
  const sum = data?.summary || {};

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {(data?.roots || []).map((r) => (
        <ColorTemplate9TableData.BodyText key={r.rootKey} sx={{ wordBreak: 'break-all' }}>
          {ROOT_LABEL[r.rootKey] || r.rootKey} ({r.envVar}): {r.usersDir || r.error}
        </ColorTemplate9TableData.BodyText>
      ))}
      <ColorTemplate9TableData.BodyText sx={{ opacity: 0.8 }}>
        Same byte size first, then SHA-256 to confirm. Default demo notes and demo photo album are not included
        {sum.demoFilesSkipped ? ` (${sum.demoFilesSkipped} demo file(s) skipped)` : ''}. Files whose owner is not in this database are
        always kept.
      </ColorTemplate9TableData.BodyText>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <ColorTemplate9TableData.Button type="button" disabled={Boolean(busyKey)} onClick={() => void load()}>
          Rescan
        </ColorTemplate9TableData.Button>
        <ColorTemplate9TableData.Button
          type="button"
          disabled={Boolean(busyKey) || !sum.removableCount}
          onClick={() => void remove(groups, 'all')}
        >
          {busyKey === 'all' ? 'Removing…' : `Remove all unused (${sum.removableCount || 0} · ${sum.removableLabel || '0 B'})`}
        </ColorTemplate9TableData.Button>
        <ColorTemplate9TableData.BodyText>
          {sum.scannedFiles ?? 0} files scanned · {sum.groupCount ?? 0} duplicate group(s) · {sum.copyCount ?? 0} copies
        </ColorTemplate9TableData.BodyText>
      </Box>
      {notice ? <Alert severity="success">{notice}</Alert> : null}
      {groups.length === 0 ? (
        <ColorTemplate9TableData.EmptyText>
          No duplicate files found (same byte size and SHA-256 checksum).
        </ColorTemplate9TableData.EmptyText>
      ) : (
        groups.map((g) => (
          <GroupTable
            key={g.sha256}
            group={g}
            busy={busyKey === g.sha256}
            disabled={Boolean(busyKey)}
            onRemove={() => void remove([g], g.sha256)}
          />
        ))
      )}
    </Box>
  );
}

AdminToolsDuplicateTab.propTypes = { onError: PropTypes.func };
