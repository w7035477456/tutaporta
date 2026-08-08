import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import ColorTemplate9TableData, { useColorTemplate9AutoFitColumnWidths } from 'ui-component/ColorTemplate9TableData';
import UnSelectedButtonTemplate from 'ui-component/UnSelectedButtonTemplate';
import {
  cascadeDeleteAdminWipeBySinglesIdTable,
  deleteAdminWipeBySinglesIdTable,
  searchAdminWipeBySinglesId
} from 'api/adminToolsFe';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { computeDeleteChainMarks, describeDeleteChainPlan } from 'utils/adminWipeDeleteChain';
import { themedConfirm } from 'utils/themedDialog';
import AdminToolsWipeByIdVideosPopup from './AdminToolsWipeByIdVideosPopup';
import AdminToolsWipeByIdPhotosPopup from './AdminToolsWipeByIdPhotosPopup';

const WIPE_SEARCH_ALL = 'ALL';
const CASCADE_DELETE_LABEL = 'Cascade Delete';
const DELETE_CHAIN_LABEL = 'Delete Chain';
const WIPE_GRID_MIN_WIDTHS_PX = [220, 180, 108, 140, 120];
const lookupBodyTextSx = { whiteSpace: 'nowrap' };

const mediaOpenLinkSx = {
  cursor: 'pointer',
  textDecoration: 'underline',
  '&:hover': { color: '#ffd60a' }
};

const searchInputSx = {
  '& .MuiInputBase-root': {
    bgcolor: '#ffffff',
    color: '#000000 !important',
    borderRadius: 0,
    fontFamily: MAIN_FONT_FAMILY,
    minWidth: 120
  },
  '& .MuiInputBase-input': {
    color: '#000000 !important',
    WebkitTextFillColor: '#000000 !important'
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: '#ffffff'
  }
};

function deleteChainMarkSx(color, interactive) {
  return {
    width: 28,
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid',
    borderColor: color,
    color,
    fontWeight: 700,
    fontSize: '1rem',
    lineHeight: 1,
    userSelect: 'none',
    bgcolor: '#111111',
    cursor: interactive ? 'pointer' : 'default'
  };
}

function DeleteChainMark({ kind, onToggle, disabled, ariaLabel }) {
  if (kind === 'none') {
    return (
      <Box
        component="button"
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={onToggle}
        sx={{
          ...deleteChainMarkSx('#cccccc', !disabled),
          borderStyle: 'dashed',
          bgcolor: 'transparent',
          p: 0
        }}
      />
    );
  }

  const color = kind === 'primary' ? '#ff3b30' : '#ffd60a';
  const interactive = kind === 'primary' && !disabled;

  return (
    <Box
      component={interactive ? 'button' : 'span'}
      type={interactive ? 'button' : undefined}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={interactive ? onToggle : undefined}
      sx={{
        ...deleteChainMarkSx(color, interactive),
        ...(interactive ? { p: 0 } : {})
      }}
    >
      ✕
    </Box>
  );
}

function formatMatchCount(value) {
  if (value == null) return '—';
  const n = Number(value);
  return Number.isFinite(n) ? String(Math.trunc(n)) : '—';
}

function normalizeSinglesIdInput(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  if (value.toUpperCase() === WIPE_SEARCH_ALL) return WIPE_SEARCH_ALL;
  const digits = value.replace(/\D/g, '');
  return digits;
}

function isSearchInputReady(raw) {
  const value = normalizeSinglesIdInput(raw);
  if (!value) return false;
  if (value === WIPE_SEARCH_ALL) return true;
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n >= 1;
}

function buildWipeColumnTexts(rows, singlesIdInput, deleteBusyKey, cascadeDeleteBusyKey, chainPrimaryKeys) {
  const displayId = normalizeSinglesIdInput(singlesIdInput) || WIPE_SEARCH_ALL;
  const visibleKeys = new Set(rows.map((row) => row.key));
  const { primary, child } = computeDeleteChainMarks(chainPrimaryKeys, visibleKeys);

  return [
    ['Table Name', 'singles_id', ...rows.map((row) => String(row.label ?? row.key ?? ''))],
    ['Matching id', displayId, ...rows.map((row) => formatMatchCount(row.match_count))],
    ['', '', ...rows.map((row) => (deleteBusyKey === row.key ? 'Deleting…' : 'Delete'))],
    ['', '', ...rows.map((row) => (cascadeDeleteBusyKey === row.key ? 'Deleting…' : CASCADE_DELETE_LABEL))],
    [
      DELETE_CHAIN_LABEL,
      'Run Chain',
      ...rows.map((row) => {
        if (primary.has(row.key)) return '✕';
        if (child.has(row.key)) return '✕';
        return '';
      })
    ]
  ];
}

function buildWipeColumnButtons() {
  return [
    null,
    {
      labels: ['Search', 'Searching…'],
      variant: 'colorTemplate9'
    },
    {
      labels: ['Delete', 'Deleting…'],
      variant: 'colorTemplate9',
      minWidthPx: 108
    },
    {
      labels: [CASCADE_DELETE_LABEL, 'Deleting…'],
      variant: 'colorTemplate9',
      minWidthPx: 140
    },
    {
      labels: [DELETE_CHAIN_LABEL, 'Run Chain', 'Running…'],
      variant: 'colorTemplate9',
      minWidthPx: 120
    }
  ];
}

export default function AdminToolsWipeByIdTab({ onError }) {
  const [singlesIdInput, setSinglesIdInput] = useState(WIPE_SEARCH_ALL);
  const [tables, setTables] = useState([]);
  const [searchScope, setSearchScope] = useState(null);
  const [searchedSinglesId, setSearchedSinglesId] = useState(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [deleteBusyKey, setDeleteBusyKey] = useState('');
  const [cascadeDeleteBusyKey, setCascadeDeleteBusyKey] = useState('');
  const [deleteChainBusy, setDeleteChainBusy] = useState(false);
  const [chainPrimaryKeys, setChainPrimaryKeys] = useState([]);
  const [videosPopupOpen, setVideosPopupOpen] = useState(false);
  const [photosPopupOpen, setPhotosPopupOpen] = useState(false);
  const initialSearchStartedRef = useRef(false);

  const visibleKeys = useMemo(() => new Set(tables.map((row) => row.key)), [tables]);
  const chainMarks = useMemo(
    () => computeDeleteChainMarks(chainPrimaryKeys, visibleKeys),
    [chainPrimaryKeys, visibleKeys]
  );

  const columnTexts = useMemo(
    () => buildWipeColumnTexts(tables, singlesIdInput, deleteBusyKey, cascadeDeleteBusyKey, chainPrimaryKeys),
    [cascadeDeleteBusyKey, chainPrimaryKeys, deleteBusyKey, singlesIdInput, tables]
  );
  const columnButtons = useMemo(() => buildWipeColumnButtons(), []);

  const { gridTemplateColumns, minTableWidthPx } = useColorTemplate9AutoFitColumnWidths({
    columnTexts,
    columnButtons,
    minWidthsPx: WIPE_GRID_MIN_WIDTHS_PX,
    enabled: true
  });

  const clearChain = useCallback(() => {
    setChainPrimaryKeys([]);
  }, []);

  const runSearch = useCallback(
    async (overrideInput) => {
      const normalized = normalizeSinglesIdInput(overrideInput ?? singlesIdInput);
      if (!isSearchInputReady(normalized)) {
        onError?.('Enter ALL or a valid singles_id.');
        setTables([]);
        setSearchScope(null);
        setSearchedSinglesId(null);
        clearChain();
        return;
      }

      setSearchBusy(true);
      onError?.('');
      clearChain();
      try {
        const payload = normalized === WIPE_SEARCH_ALL ? WIPE_SEARCH_ALL : Math.trunc(Number(normalized));
        const data = await searchAdminWipeBySinglesId(payload);
        const scope = String(data?.scope ?? '').trim() === 'all' ? 'all' : 'singles';
        setSearchScope(scope);
        setSearchedSinglesId(scope === 'all' ? null : Math.trunc(Number(data?.singles_id)));
        setTables(Array.isArray(data?.tables) ? data.tables : []);
        if (normalized === WIPE_SEARCH_ALL) {
          setSinglesIdInput(WIPE_SEARCH_ALL);
        }
      } catch (err) {
        setTables([]);
        setSearchScope(null);
        setSearchedSinglesId(null);
        onError?.(err?.response?.data?.error || err?.message || 'Failed to search wipe-by-id counts');
      } finally {
        setSearchBusy(false);
      }
    },
    [clearChain, onError, singlesIdInput]
  );

  useEffect(() => {
    if (initialSearchStartedRef.current) return;
    initialSearchStartedRef.current = true;
    void runSearch(WIPE_SEARCH_ALL);
  }, [runSearch]);

  const toggleChainPrimary = useCallback((tableKey) => {
    setChainPrimaryKeys((prev) => {
      const next = new Set(prev);
      if (next.has(tableKey)) next.delete(tableKey);
      else next.add(tableKey);
      return [...next];
    });
  }, []);

  const handleDelete = useCallback(
    async (row) => {
      const singlesId = searchedSinglesId;
      const tableKey = String(row?.key ?? '').trim();
      if (searchScope !== 'singles' || !singlesId || !tableKey || deleteBusyKey || cascadeDeleteBusyKey || deleteChainBusy) {
        return;
      }

      const matchCount = Number(row?.match_count ?? 0);
      if (!Number.isFinite(matchCount) || matchCount < 1) return;

      if (
        !(await themedConfirm(
          row.kind === 'photo_folder'
            ? `Delete ${matchCount} on-disk file(s) from ${row.label} for singles_id = ${singlesId}?\n\nPhotos table rows are not removed.`
            : `Delete ${matchCount} row(s) from ${row.label} where singles_id = ${singlesId}?\n\nThis is a direct DELETE (not cascade).`
        ))
      ) {
        return;
      }

      setDeleteBusyKey(tableKey);
      onError?.('');
      try {
        const data = await deleteAdminWipeBySinglesIdTable({ singlesId, tableKey });
        setTables((prev) =>
          prev.map((item) =>
            item.key === tableKey ? { ...item, match_count: data?.match_count ?? 0 } : item
          )
        );
      } catch (err) {
        onError?.(err?.response?.data?.error || err?.message || `Failed to delete from ${row.label}`);
      } finally {
        setDeleteBusyKey('');
      }
    },
    [cascadeDeleteBusyKey, deleteBusyKey, deleteChainBusy, onError, searchScope, searchedSinglesId]
  );

  const handleCascadeDelete = useCallback(
    async (row) => {
      const singlesId = searchedSinglesId;
      const tableKey = String(row?.key ?? '').trim();
      if (searchScope !== 'singles' || !singlesId || !tableKey || deleteBusyKey || cascadeDeleteBusyKey || deleteChainBusy) {
        return;
      }

      const matchCount = Number(row?.match_count ?? 0);
      if (!Number.isFinite(matchCount) || matchCount < 1) return;

      const cascadeNote =
        row.key === 'singles'
          ? '\n\nPostgres ON DELETE CASCADE removes linked child rows.'
          : row.key === 'posting_photos'
            ? '\n\nDeletes postings for this singles_id; Postgres CASCADE removes posting_photos and related rows.'
            : row.key === 'photos' || row.kind === 'photo_folder'
              ? '\n\nRemoves on-disk photo files and photos table rows.'
              : row.key === 'videos'
                ? '\n\nRemoves on-disk video files and videos table rows.'
                : row.key === 'postings'
                ? '\n\nPostgres CASCADE removes posting_photos and posting_comments for those posts.'
                : '';

      if (
        !(await themedConfirm(
          row.kind === 'photo_folder'
            ? `Cascade delete ${matchCount} on-disk file(s) from ${row.label} for singles_id = ${singlesId}?\n\nAlso removes photos table rows for this member.${cascadeNote}`
            : `Cascade delete ${matchCount} row(s) from ${row.label} where singles_id = ${singlesId}?${cascadeNote}`
        ))
      ) {
        return;
      }

      setCascadeDeleteBusyKey(tableKey);
      onError?.('');
      try {
        const data = await cascadeDeleteAdminWipeBySinglesIdTable({ singlesId, tableKey });
        if (Array.isArray(data?.tables) && data.tables.length > 0) {
          setTables(data.tables);
        } else {
          setTables((prev) =>
            prev.map((item) =>
              item.key === tableKey ? { ...item, match_count: data?.match_count ?? 0 } : item
            )
          );
        }
        clearChain();
      } catch (err) {
        onError?.(err?.response?.data?.error || err?.message || `Failed to cascade delete from ${row.label}`);
      } finally {
        setCascadeDeleteBusyKey('');
      }
    },
    [cascadeDeleteBusyKey, clearChain, deleteBusyKey, deleteChainBusy, onError, searchScope, searchedSinglesId]
  );

  const handleRunDeleteChain = useCallback(async () => {
    const singlesId = searchedSinglesId;
    if (searchScope !== 'singles' || !singlesId || chainPrimaryKeys.length === 0 || deleteChainBusy || deleteBusyKey || cascadeDeleteBusyKey) {
      return;
    }

    const plan = describeDeleteChainPlan(tables, chainPrimaryKeys);
    if (plan.executeKeys.length === 0) {
      onError?.('Select at least one Delete Chain table.');
      return;
    }

    const primaryLines = plan.primary.length ? plan.primary.join(', ') : '(none)';
    const childLines = plan.child.length ? plan.child.join(', ') : '(none)';

    if (
      !(await themedConfirm(
        `Run Delete Chain for singles_id = ${singlesId}?\n\nRed X (cascade delete): ${primaryLines}\nYellow X (included by cascade): ${childLines}\n\nParent tables only are deleted; Postgres CASCADE removes yellow-marked children.`
      ))
    ) {
      return;
    }

    setDeleteChainBusy(true);
    onError?.('');
    try {
      let latestTables = tables;
      for (const tableKey of plan.executeKeys) {
        const data = await cascadeDeleteAdminWipeBySinglesIdTable({ singlesId, tableKey });
        if (Array.isArray(data?.tables) && data.tables.length > 0) {
          latestTables = data.tables;
        }
      }
      setTables(latestTables);
      clearChain();
    } catch (err) {
      onError?.(err?.response?.data?.error || err?.message || 'Failed to run Delete Chain.');
    } finally {
      setDeleteChainBusy(false);
    }
  }, [
    cascadeDeleteBusyKey,
    chainPrimaryKeys,
    clearChain,
    deleteBusyKey,
    deleteChainBusy,
    onError,
    searchScope,
    searchedSinglesId,
    tables
  ]);

  const handleInputChange = (event) => {
    const raw = event.target.value;
    if (!raw) {
      setSinglesIdInput('');
      return;
    }
    if (/^\d+$/.test(raw)) {
      setSinglesIdInput(raw);
      return;
    }
    const upper = raw.toUpperCase();
    if (upper === WIPE_SEARCH_ALL || (upper.length <= 3 && WIPE_SEARCH_ALL.startsWith(upper))) {
      setSinglesIdInput(upper);
    }
  };

  const actionBusy = Boolean(deleteBusyKey || cascadeDeleteBusyKey || deleteChainBusy);
  const canRunChain =
    searchScope === 'singles' &&
    searchedSinglesId != null &&
    chainPrimaryKeys.length > 0 &&
    !actionBusy;

  const handleOpenVideosPopup = useCallback(() => {
    if (searchScope !== 'singles' || searchedSinglesId == null) return;
    setVideosPopupOpen(true);
  }, [searchScope, searchedSinglesId]);

  const handleOpenPhotosPopup = useCallback(() => {
    if (searchScope !== 'singles' || searchedSinglesId == null) return;
    setPhotosPopupOpen(true);
  }, [searchScope, searchedSinglesId]);

  const handleVideosCountChanged = useCallback((matchCount) => {
    setTables((prev) =>
      prev.map((item) => (item.key === 'videos' ? { ...item, match_count: matchCount } : item))
    );
  }, []);

  const handlePhotosCountChanged = useCallback((matchCount) => {
    setTables((prev) =>
      prev.map((item) => (item.key === 'photos' ? { ...item, match_count: matchCount } : item))
    );
  }, []);

  return (
    <Box sx={{ width: '100%', minWidth: 0 }}>
      <ColorTemplate9TableData.Table autoFitColumns minTableWidth={minTableWidthPx}>
        <ColorTemplate9TableData.HeaderRow gridTemplateColumns={gridTemplateColumns}>
          <ColorTemplate9TableData.HeaderCell>
            <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>Table Name</ColorTemplate9TableData.BodyText>
          </ColorTemplate9TableData.HeaderCell>
          <ColorTemplate9TableData.HeaderCell>
            <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>Matching id</ColorTemplate9TableData.BodyText>
          </ColorTemplate9TableData.HeaderCell>
          <ColorTemplate9TableData.HeaderCell aria-hidden />
          <ColorTemplate9TableData.HeaderCell aria-hidden />
          <ColorTemplate9TableData.HeaderCell>
            <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>{DELETE_CHAIN_LABEL}</ColorTemplate9TableData.BodyText>
          </ColorTemplate9TableData.HeaderCell>
        </ColorTemplate9TableData.HeaderRow>

        <ColorTemplate9TableData.BodyRow rowIndex={0} gridTemplateColumns={gridTemplateColumns}>
          <ColorTemplate9TableData.BodyCell>
            <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>singles_id</ColorTemplate9TableData.BodyText>
          </ColorTemplate9TableData.BodyCell>
          <ColorTemplate9TableData.BodyCell sx={{ gap: 1, flexWrap: 'nowrap' }}>
            <TextField
              value={singlesIdInput}
              onChange={handleInputChange}
              size="small"
              inputProps={{ 'aria-label': 'singles_id' }}
              sx={searchInputSx}
            />
            <UnSelectedButtonTemplate
              type="button"
              fitLabelWidth
              disabled={searchBusy || !isSearchInputReady(singlesIdInput)}
              onClick={() => void runSearch()}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {searchBusy ? 'Searching…' : 'Search'}
            </UnSelectedButtonTemplate>
          </ColorTemplate9TableData.BodyCell>
          <ColorTemplate9TableData.BodyCell />
          <ColorTemplate9TableData.BodyCell />
          <ColorTemplate9TableData.BodyCell sx={{ justifyContent: 'center' }}>
            <ColorTemplate9TableData.Button
              type="button"
              disabled={!canRunChain}
              onClick={() => void handleRunDeleteChain()}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {deleteChainBusy ? 'Running…' : 'Run Chain'}
            </ColorTemplate9TableData.Button>
          </ColorTemplate9TableData.BodyCell>
        </ColorTemplate9TableData.BodyRow>

        {tables.map((row, index) => {
          const deleteBusy = deleteBusyKey === row.key;
          const cascadeDeleteBusy = cascadeDeleteBusyKey === row.key;
          const matchCount = Number(row.match_count ?? 0);
          const canAct =
            searchScope === 'singles' && searchedSinglesId != null && !row.missing && matchCount > 0 && !actionBusy;
          const chainKind = chainMarks.primary.has(row.key)
            ? 'primary'
            : chainMarks.child.has(row.key)
              ? 'child'
              : 'none';
          const canSelectChain =
            searchScope === 'singles' && searchedSinglesId != null && !row.missing && matchCount > 0 && !actionBusy;
          const canOpenVideosPopup =
            row.key === 'videos' && searchScope === 'singles' && searchedSinglesId != null && matchCount > 0;
          const canOpenPhotosPopup =
            row.key === 'photos' && searchScope === 'singles' && searchedSinglesId != null && matchCount > 0;
          const openMediaPopup = canOpenVideosPopup
            ? handleOpenVideosPopup
            : canOpenPhotosPopup
              ? handleOpenPhotosPopup
              : null;

          return (
            <ColorTemplate9TableData.BodyRow
              key={row.key}
              rowIndex={index + 1}
              gridTemplateColumns={gridTemplateColumns}
            >
              <ColorTemplate9TableData.BodyCell>
                {openMediaPopup ? (
                  <ColorTemplate9TableData.BodyText
                    component="button"
                    type="button"
                    onClick={openMediaPopup}
                    sx={{
                      ...lookupBodyTextSx,
                      ...mediaOpenLinkSx,
                      bgcolor: 'transparent',
                      border: 0,
                      p: 0,
                      font: 'inherit',
                      textAlign: 'left'
                    }}
                  >
                    {row.label}
                  </ColorTemplate9TableData.BodyText>
                ) : (
                  <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>{row.label}</ColorTemplate9TableData.BodyText>
                )}
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell>
                {openMediaPopup ? (
                  <ColorTemplate9TableData.BodyText
                    component="button"
                    type="button"
                    onClick={openMediaPopup}
                    sx={{
                      ...lookupBodyTextSx,
                      ...mediaOpenLinkSx,
                      bgcolor: 'transparent',
                      border: 0,
                      p: 0,
                      font: 'inherit',
                      textAlign: 'left'
                    }}
                  >
                    {formatMatchCount(row.match_count)}
                  </ColorTemplate9TableData.BodyText>
                ) : (
                  <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>
                    {formatMatchCount(row.match_count)}
                  </ColorTemplate9TableData.BodyText>
                )}
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell sx={{ justifyContent: 'center' }}>
                <ColorTemplate9TableData.Button
                  type="button"
                  disabled={!canAct}
                  onClick={() => void handleDelete(row)}
                  sx={{ minWidth: 108, whiteSpace: 'nowrap' }}
                >
                  {deleteBusy ? 'Deleting…' : 'Delete'}
                </ColorTemplate9TableData.Button>
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell sx={{ justifyContent: 'center' }}>
                <ColorTemplate9TableData.Button
                  type="button"
                  disabled={!canAct}
                  onClick={() => void handleCascadeDelete(row)}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  {cascadeDeleteBusy ? 'Deleting…' : CASCADE_DELETE_LABEL}
                </ColorTemplate9TableData.Button>
              </ColorTemplate9TableData.BodyCell>
              <ColorTemplate9TableData.BodyCell sx={{ justifyContent: 'center' }}>
                <DeleteChainMark
                  kind={chainKind}
                  disabled={!canSelectChain || chainKind === 'child'}
                  ariaLabel={
                    chainKind === 'primary'
                      ? `Remove ${row.label} from Delete Chain`
                      : chainKind === 'child'
                        ? `${row.label} included by Delete Chain cascade`
                        : `Add ${row.label} to Delete Chain`
                  }
                  onToggle={() => toggleChainPrimary(row.key)}
                />
              </ColorTemplate9TableData.BodyCell>
            </ColorTemplate9TableData.BodyRow>
          );
        })}
      </ColorTemplate9TableData.Table>

      {searchScope != null && tables.length === 0 && !searchBusy ? (
        <ColorTemplate9TableData.EmptyText>No tables returned for this search.</ColorTemplate9TableData.EmptyText>
      ) : null}

      <AdminToolsWipeByIdVideosPopup
        open={videosPopupOpen}
        singlesId={searchedSinglesId}
        onClose={() => setVideosPopupOpen(false)}
        onVideosChanged={handleVideosCountChanged}
        onError={onError}
      />

      <AdminToolsWipeByIdPhotosPopup
        open={photosPopupOpen}
        singlesId={searchedSinglesId}
        onClose={() => setPhotosPopupOpen(false)}
        onPhotosChanged={handlePhotosCountChanged}
        onError={onError}
      />
    </Box>
  );
}
