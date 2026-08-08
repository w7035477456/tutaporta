import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import ColorTemplate9TableData, { useColorTemplate9AutoFitColumnWidths } from 'ui-component/ColorTemplate9TableData';
import { fetchAdminTables, truncateAdminTable } from 'api/adminToolsFe';
import { themedConfirm } from 'utils/themedDialog';

const TABLES_GRID_MIN_WIDTHS_PX = [180, 88, 120];

const tableNameTextSx = {
  fontWeight: 600,
  whiteSpace: 'nowrap'
};

const rowCountCellSx = {
  justifyContent: 'flex-start',
  whiteSpace: 'nowrap'
};

const actionCellSx = {
  justifyContent: 'center',
  minHeight: 44
};

const truncateButtonPlaceholderSx = {
  minWidth: 108,
  minHeight: 36,
  visibility: 'hidden'
};

function formatRowCount(value) {
  if (value == null) return '—';
  const n = Number(value);
  return Number.isFinite(n) ? String(Math.trunc(n)) : '—';
}

function buildTableColumnTexts(tables, busyKey) {
  return [
    ['Table Name', ...tables.map((row) => String(row.label ?? row.key ?? ''))],
    ['Row count', ...tables.map((row) => formatRowCount(row.row_count))],
    [
      '',
      ...tables.map((row) => {
        if (row.kind === 'photo_folder') return '';
        return busyKey === `${row.key}:truncate` ? 'Truncating…' : 'Truncate';
      })
    ]
  ];
}

function buildTableColumnButtons() {
  return [
    null,
    null,
    {
      labels: ['Truncate', 'Truncating…'],
      variant: 'colorTemplate9',
      minWidthPx: 108
    }
  ];
}

export default function AdminToolsTablesTab({ onError }) {
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState([]);
  const [busyKey, setBusyKey] = useState('');

  const columnTexts = useMemo(() => buildTableColumnTexts(tables, busyKey), [busyKey, tables]);
  const columnButtons = useMemo(() => buildTableColumnButtons(), []);

  const { gridTemplateColumns, minTableWidthPx } = useColorTemplate9AutoFitColumnWidths({
    columnTexts,
    columnButtons,
    minWidthsPx: TABLES_GRID_MIN_WIDTHS_PX,
    enabled: !loading && tables.length > 0
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminTables();
      setTables(Array.isArray(data?.tables) ? data.tables : []);
      onError?.('');
    } catch (err) {
      onError?.(err?.response?.data?.error || err?.message || 'Failed to load tables');
      setTables([]);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateRowCount = (key, rowCount) => {
    setTables((prev) => prev.map((row) => (row.key === key ? { ...row, row_count: rowCount } : row)));
  };

  const handleTruncate = async (row) => {
    if (!row?.key || row.missing || row.truncate_allowed === false) return;
    const label = row.label || row.table;
    if (
      !(await themedConfirm(
        `Truncate all rows in ${label}?\n\nOnly helloworldjunktest.${row.table} — no CASCADE and no other tables are modified. If Postgres blocks it (foreign key), you will see an error instead.`
      ))
    ) {
      return;
    }
    setBusyKey(`${row.key}:truncate`);
    onError?.('');
    try {
      const data = await truncateAdminTable(row.key);
      updateRowCount(row.key, data?.row_count ?? 0);
      await load();
    } catch (err) {
      onError?.(err?.response?.data?.error || err?.message || `Failed to truncate ${label}`);
    } finally {
      setBusyKey('');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ColorTemplate9TableData.Table topHorizontalScrollbar autoFitColumns minTableWidth={minTableWidthPx}>
      <ColorTemplate9TableData.HeaderRow gridTemplateColumns={gridTemplateColumns}>
        <ColorTemplate9TableData.HeaderCell>Table Name</ColorTemplate9TableData.HeaderCell>
        <ColorTemplate9TableData.HeaderCell>Row count</ColorTemplate9TableData.HeaderCell>
        <ColorTemplate9TableData.HeaderCell />
      </ColorTemplate9TableData.HeaderRow>
      {tables.map((row, index) => {
        const isPhotoFolder = row.kind === 'photo_folder';
        const truncateDisabled = row.missing || row.truncate_allowed === false || Boolean(busyKey);
        const truncateBusy = busyKey === `${row.key}:truncate`;
        return (
          <ColorTemplate9TableData.BodyRow key={row.key} rowIndex={index} gridTemplateColumns={gridTemplateColumns}>
            <ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyText sx={tableNameTextSx}>{row.label}</ColorTemplate9TableData.BodyText>
            </ColorTemplate9TableData.BodyCell>
            <ColorTemplate9TableData.BodyCell sx={rowCountCellSx}>
              <ColorTemplate9TableData.BodyText sx={{ whiteSpace: 'nowrap' }}>
                {formatRowCount(row.row_count)}
              </ColorTemplate9TableData.BodyText>
            </ColorTemplate9TableData.BodyCell>
            <ColorTemplate9TableData.BodyCell sx={actionCellSx}>
              {isPhotoFolder || row.truncate_allowed === false ? (
                <Box component="span" sx={truncateButtonPlaceholderSx} aria-hidden />
              ) : (
                <ColorTemplate9TableData.Button
                  type="button"
                  disabled={truncateDisabled}
                  onClick={() => void handleTruncate(row)}
                  sx={{ minWidth: 108, whiteSpace: 'nowrap' }}
                >
                  {truncateBusy ? 'Truncating…' : 'Truncate'}
                </ColorTemplate9TableData.Button>
              )}
            </ColorTemplate9TableData.BodyCell>
          </ColorTemplate9TableData.BodyRow>
        );
      })}
    </ColorTemplate9TableData.Table>
  );
}
