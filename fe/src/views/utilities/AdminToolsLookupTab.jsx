import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ColorTemplate9TableData, { useColorTemplate9AutoFitColumnWidths } from 'ui-component/ColorTemplate9TableData';
import SelectedButtonTemplate from 'ui-component/SelectedButtonTemplate';
import { formatMemberCategoryLabel, isAdminMemberCategory } from 'utils/memberCategory';
import { themedConfirm } from 'utils/themedDialog';
import {
  saveAdminSinglesStatus,
  saveAdminSinglesMemberCategory,
  saveAdminSinglesTokenBalance,
  fetchAdminAuditRegistrationLookup,
  fetchAdminSinglesLookupAll,
  resetAdminPasswordAttemptCount,
  cascadeDeleteAdminTableRow,
  fetchAdminVideoObjectUrl
} from 'api/adminToolsFe';
import { invalidateAllSinglesCache } from 'api/allSinglesFe';
import { invalidateMyPicksFeedCache, invalidateMyPicksListCache } from 'api/myPicksFe';
import { invalidateRequestedSinglesCache } from 'api/requestsSentFe';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { useAuth } from 'contexts/AuthContext';
import { isAdminSession } from 'utils/adminSession';
import { formatSinglesStatusLabel, nextSinglesStatus, SINGLES_STATUS_VALUES } from 'utils/singlesStatus';
import { buildProfilePhotoUrl } from 'utils/profilePhotoUrl';
import UserRound from 'assets/images/users/profile.jpeg';

import { MIN_AUDIT_COLUMN_WIDTHS_PX, MIN_SINGLES_COLUMN_WIDTHS_PX } from 'utils/adminToolsLookupTableColumns';
import { truncateColorTemplate9AutoFitText } from 'utils/colorTemplate9AutoFitColumns';
import { formatVideoFileAge, sortSinglesRowsByVideoAge } from 'utils/formatVideoFileAge';

const CASCADE_DELETE_LABEL = 'Cascd Del';
/** Size / display columns from the first N characters of header + cell text. */
const LOOKUP_COLUMN_DISPLAY_CHARS = 30;

const lookupBodyTextSx = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '100%'
};

const lookupCenterColumnCellSx = {
  display: { xs: 'none', sm: 'flex' },
  justifyContent: 'center',
  overflow: 'hidden'
};

const viewVideoButtonSx = {
  bgcolor: '#e53935 !important',
  color: '#ffffff !important',
  WebkitTextFillColor: '#ffffff !important',
  border: '2px solid #000000 !important',
  boxShadow: 'none !important',
  fontWeight: 700,
  fontSize: '0.72rem',
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  textAlign: 'center',
  minHeight: 32,
  py: 0.5,
  px: 0.75,
  maxWidth: '100%',
  '&:hover': {
    bgcolor: '#c62828 !important',
    boxShadow: 'none !important'
  }
};

const viewVideoCellSx = {
  display: { xs: 'none', sm: 'flex' },
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: 0.5,
  justifyContent: 'flex-start',
  overflow: 'hidden',
  minWidth: 0
};

function truncateLookupDisplay(value) {
  const text = String(value ?? '').trim();
  if (!text) return '—';
  return truncateColorTemplate9AutoFitText(text, LOOKUP_COLUMN_DISPLAY_CHARS);
}

function isAdminSinglesLookupRow(row) {
  const alias = String(row?.alias ?? '').trim().toLowerCase();
  return isAdminMemberCategory(row?.memberCategory) || alias === 'admin';
}

/** Same impersonate action as All Singles; yellow table button label "Impersonate". */
function LookupImpersonateButton({ targetSinglesId }) {
  const { user, impersonateMember } = useAuth();
  const [impersonateBusy, setImpersonateBusy] = useState(false);
  const targetId = Number(targetSinglesId);
  const currentSinglesId = Number(user?.singles_id);
  const isSameMember =
    Number.isFinite(currentSinglesId) && currentSinglesId >= 1 && currentSinglesId === targetId;
  const canImpersonate =
    isAdminSession(user) && Number.isFinite(targetId) && targetId >= 1 && !isSameMember;

  const handleImpersonateClick = useCallback(async () => {
    if (!canImpersonate || impersonateBusy) return;
    setImpersonateBusy(true);
    try {
      await impersonateMember({ targetSinglesId: targetId });
      if (typeof window !== 'undefined') {
        window.location.assign('/mall');
      }
    } catch (err) {
      console.error('[AdminToolsLookupTab] Impersonation failed', err?.message ?? err);
    } finally {
      setImpersonateBusy(false);
    }
  }, [canImpersonate, impersonateBusy, impersonateMember, targetId]);

  if (!canImpersonate) return null;

  return (
    <SelectedButtonTemplate
      type="button"
      disabled={impersonateBusy}
      onClick={() => void handleImpersonateClick()}
      sx={{ whiteSpace: 'nowrap', width: '100%', maxWidth: '100%' }}
    >
      {impersonateBusy ? 'Impersonating…' : 'Impersonate'}
    </SelectedButtonTemplate>
  );
}

function LookupProfilePhoto({ singlesId, profileImageFk, alias }) {
  const src = buildProfilePhotoUrl(singlesId, profileImageFk);
  return (
    <Avatar
      src={src && src !== 'profile.jpeg' ? src : UserRound}
      alt={alias ? String(alias) : `singles ${singlesId}`}
      sx={lookupPhotoAvatarSx}
      imgProps={{
        onError: (e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = UserRound;
        }
      }}
    />
  );
}

const labelSx = {
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 700,
  fontSize: { xs: '1rem', sm: '1.15rem' },
  lineHeight: 1.25,
  color: 'var(--theme-inverse-daynight-color)',
  flexShrink: 0
};

const bigOrSx = {
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 800,
  fontSize: { xs: '1.35rem', sm: '1.85rem' },
  lineHeight: 1,
  color: 'var(--theme-inverse-daynight-color)',
  px: { xs: 0.25, sm: 0.75 },
  flexShrink: 0,
  alignSelf: 'center'
};

const lookupPanelSx = {
  width: '100%',
  border: '1px solid var(--theme-primary-color)',
  borderRadius: 1,
  p: { xs: 1.25, sm: 1.75 },
  boxSizing: 'border-box'
};

const inputFieldSx = {
  '& .MuiInputBase-root': {
    bgcolor: '#ffffff',
    color: '#000000 !important',
    borderRadius: 0,
    fontFamily: MAIN_FONT_FAMILY
  },
  '& .MuiInputBase-input': {
    color: '#000000 !important',
    WebkitTextFillColor: '#000000 !important'
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: '#ffffff'
  }
};

const tokenBalanceFieldSx = {
  ...inputFieldSx,
  width: '100%',
  minWidth: 0,
  '& .MuiInputBase-input': {
    ...inputFieldSx['& .MuiInputBase-input'],
    textAlign: 'center',
    fontWeight: 700,
    py: 0.5,
    px: 0.5
  }
};

const lookupTableRowSx = (minWidthPx) => ({
  width: '100%',
  minWidth: minWidthPx,
  boxSizing: 'border-box'
});

const lookupScrollHeaderCellSx = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  minWidth: 0,
  '& .MuiTypography-root': {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%'
  }
};

const lookupAgeSortHeaderSx = {
  ...lookupScrollHeaderCellSx,
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: '0.15em',
  userSelect: 'none',
  '@media (hover: hover)': {
    '&:hover': { opacity: 0.85 }
  }
};

const lookupPhotoAvatarSx = {
  width: 40,
  height: 40,
  border: '2px solid #000',
  bgcolor: '#fff',
  flexShrink: 0
};

const SINGLES_COL = {
  PHOTO: 0,
  ALIAS: 1,
  SINGLES_ID: 2,
  MEMBER_ID: 3,
  EMAIL: 4,
  IMPERSONATE: 5,
  STATUS: 6,
  TOKEN_BALANCE: 7,
  PHONE: 8,
  CASCADE_DELETE: 9,
  PWD_RETRY: 10,
  MY_REFER_CODE: 11,
  REFER_BY: 12,
  VIEW_VIDEO: 13,
  VIDEO_AGE: 14
};

const AUDIT_COL = {
  SPACER: 0,
  SINGLES_ID: 1,
  STATUS: 2,
  DATE: 3,
  EMAIL: 4,
  PHONE: 5
};

const sectionTitleSx = {
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 700,
  fontSize: { xs: '1rem', sm: '1.1rem' },
  color: 'var(--theme-inverse-daynight-color)',
  mb: 0.75
};

function hasLookupInput({ singlesIdInput, emailInput, aliasInput, memberIdInput, phoneInput }) {
  if (String(singlesIdInput ?? '').trim()) return true;
  if (String(emailInput ?? '').trim()) return true;
  if (String(aliasInput ?? '').trim()) return true;
  if (String(memberIdInput ?? '').trim()) return true;
  if (String(phoneInput ?? '').trim()) return true;
  return false;
}

function populateFieldsFromSinglesRow(row, setters) {
  if (!row) return;
  if (row.singlesId != null) setters.setSinglesIdInput(String(row.singlesId));
  setters.setEmailInput(String(row.email ?? ''));
  setters.setAliasInput(String(row.alias ?? ''));
  if (row.memberId != null) setters.setMemberIdInput(String(row.memberId));
  else setters.setMemberIdInput('');
  setters.setPhoneInput(String(row.phone ?? ''));
}

function formatReferByDisplay(row) {
  const code = String(row?.referByCode ?? '').trim();
  if (!code) return '—';
  const ownerId = row?.referBySinglesId;
  if (ownerId != null && Number.isFinite(Number(ownerId))) {
    return `${code}, ${ownerId}`;
  }
  return code;
}

function formatAuditDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function normalizeTokenBalanceInput(raw) {
  return String(raw ?? '').replace(/\D/g, '');
}

function parseTokenBalanceValue(raw) {
  const digits = normalizeTokenBalanceInput(raw);
  if (digits === '') return 0;
  const n = Math.trunc(Number(digits));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function formatTokenBalanceDisplay(raw) {
  return String(parseTokenBalanceValue(raw));
}

function buildSinglesLookupColumnButtons(rows) {
  const statusLabels = SINGLES_STATUS_VALUES.map((value) => formatSinglesStatusLabel(value));
  return [
    null,
    null,
    null,
    null,
    null,
    {
      labels: ['Impersonate', 'Impersonating…'],
      variant: 'selected'
    },
    {
      labels: statusLabels,
      variant: 'selected'
    },
    null,
    null,
    {
      labels: [CASCADE_DELETE_LABEL, 'Deleting…'],
      variant: 'selected'
    },
    {
      labels: ['Reset', '…'],
      variant: 'selected',
      companionTexts: rows.map((row) => String(Number(row.passwordAttemptCount ?? 0))),
      companionGapPx: 6
    },
    null,
    null,
    null,
    null
  ];
}

function buildSinglesLookupVideoAgeColumnTexts(rows) {
  return [
    'Age ↑',
    ...rows.map((row) => {
      const videos = Array.isArray(row.videos) ? row.videos : [];
      if (!videos.length) return '—';
      return truncateLookupDisplay(videos.map((video) => formatVideoFileAge(video.createdAt)).join(' '));
    })
  ];
}

function buildSinglesLookupViewVideoColumnTexts(rows) {
  return [
    'View Video',
    ...rows.map((row) => {
      const videos = Array.isArray(row.videos) ? row.videos : [];
      if (!videos.length) return '—';
      return truncateLookupDisplay(
        videos.map((video) => String(video.videoFileName || `video_${video.videoId}`)).join(' ')
      );
    })
  ];
}

function buildSinglesLookupColumnTexts(rows) {
  const statusLabels = SINGLES_STATUS_VALUES.map((value) => formatSinglesStatusLabel(value));
  return [
    ['Photo', ...rows.map(() => 'Photo')],
    ['Alias', ...rows.map((row) => truncateLookupDisplay(row.alias || '—'))],
    ['singles_id', ...rows.map((row) => truncateLookupDisplay(row.singlesId ?? '—'))],
    ['member_id', ...rows.map((row) => truncateLookupDisplay(row.memberId ?? '—'))],
    ['Email', ...rows.map((row) => truncateLookupDisplay(row.email || '—'))],
    ['Impersonate', ...rows.map(() => 'Impersonate')],
    [
      'status',
      ...statusLabels.map((label) => truncateLookupDisplay(label)),
      ...rows.map((row) => truncateLookupDisplay(formatSinglesStatusLabel(row.status)))
    ],
    ['Tokens', ...rows.map((row) => truncateLookupDisplay(formatTokenBalanceDisplay(row.accountBalanceToken)))],
    ['Phone', ...rows.map((row) => truncateLookupDisplay(row.phone || '—'))],
    [
      CASCADE_DELETE_LABEL,
      ...rows.map((row) => (isAdminSinglesLookupRow(row) ? '' : CASCADE_DELETE_LABEL))
    ],
    [
      'Pwd Retry',
      ...rows.map((row) => truncateLookupDisplay(`${Number(row.passwordAttemptCount ?? 0)} Reset`))
    ],
    ['My Refer Code', ...rows.map((row) => truncateLookupDisplay(row.myReferCode || '—'))],
    ['I refer by', ...rows.map((row) => truncateLookupDisplay(formatReferByDisplay(row)))],
    buildSinglesLookupViewVideoColumnTexts(rows),
    buildSinglesLookupVideoAgeColumnTexts(rows)
  ];
}

function buildAuditLookupColumnTexts(rows) {
  return [
    [''],
    ['singles_id', ...rows.map((row) => truncateLookupDisplay(row.singlesId ?? '—'))],
    ['Status', ...rows.map((row) => truncateLookupDisplay(row.status || '—'))],
    ['Date', ...rows.map((row) => truncateLookupDisplay(formatAuditDate(row.dateUpdate)))],
    ['Email', ...rows.map((row) => truncateLookupDisplay(row.email || '—'))],
    ['Phone', ...rows.map((row) => truncateLookupDisplay(row.phone || '—'))]
  ];
}

function LookupField({ label, value, onChange, inputMode, pattern }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: '1 1 160px', minWidth: 0 }}>
      <Typography sx={labelSx}>{label}</Typography>
      <TextField
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputProps={inputMode ? { inputMode, pattern } : undefined}
        size="small"
        fullWidth
        autoComplete="off"
        sx={inputFieldSx}
      />
    </Box>
  );
}

export default function AdminToolsLookupTab({ onError }) {
  const [singlesIdInput, setSinglesIdInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [aliasInput, setAliasInput] = useState('');
  const [memberIdInput, setMemberIdInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [singlesRows, setSinglesRows] = useState([]);
  const [savedStatusById, setSavedStatusById] = useState({});
  const [savedMemberCategoryById, setSavedMemberCategoryById] = useState({});
  const [savedAccountBalanceTokenById, setSavedAccountBalanceTokenById] = useState({});
  const [auditRows, setAuditRows] = useState([]);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupAllBusy, setLookupAllBusy] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [lastLookupWasAll, setLastLookupWasAll] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveResultPopup, setSaveResultPopup] = useState(null);
  const [pwdRetryResetBusyById, setPwdRetryResetBusyById] = useState({});
  const [cascadeDeleteBusyById, setCascadeDeleteBusyById] = useState({});
  const [playerVideoUrl, setPlayerVideoUrl] = useState('');
  const [playerVideoLabel, setPlayerVideoLabel] = useState('');
  const [playerVideoLoading, setPlayerVideoLoading] = useState(false);
  const [playerVideoError, setPlayerVideoError] = useState('');
  const [videoAgeSortDir, setVideoAgeSortDir] = useState('asc');
  const playerVideoBlobRef = useRef('');

  const revokePlayerVideoBlob = useCallback(() => {
    if (playerVideoBlobRef.current) {
      URL.revokeObjectURL(playerVideoBlobRef.current);
      playerVideoBlobRef.current = '';
    }
  }, []);

  useEffect(() => () => revokePlayerVideoBlob(), [revokePlayerVideoBlob]);

  const handleOpenAdminVideo = useCallback(
    async (video) => {
      const videoId = Number(video?.videoId);
      revokePlayerVideoBlob();
      setPlayerVideoUrl('');
      setPlayerVideoError('');
      setPlayerVideoLabel(String(video?.videoFileName || `video_${videoId}`));
      setPlayerVideoLoading(true);

      try {
        const blobUrl = await fetchAdminVideoObjectUrl(videoId);
        playerVideoBlobRef.current = blobUrl;
        setPlayerVideoUrl(blobUrl);
      } catch (err) {
        setPlayerVideoError(err?.response?.data?.error || err?.message || 'Failed to load video');
      } finally {
        setPlayerVideoLoading(false);
      }
    },
    [revokePlayerVideoBlob]
  );

  const singlesColumnTexts = useMemo(() => buildSinglesLookupColumnTexts(singlesRows), [singlesRows]);
  const singlesColumnButtons = useMemo(() => buildSinglesLookupColumnButtons(singlesRows), [singlesRows]);
  const displaySinglesRows = useMemo(
    () => sortSinglesRowsByVideoAge(singlesRows, videoAgeSortDir),
    [singlesRows, videoAgeSortDir]
  );
  const auditColumnTexts = useMemo(() => buildAuditLookupColumnTexts(auditRows), [auditRows]);

  const handleToggleVideoAgeSort = useCallback(() => {
    setVideoAgeSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }, []);

  const { gridTemplateColumns: singlesTableGridSx, minTableWidthPx: singlesTableMinWidthPx } =
    useColorTemplate9AutoFitColumnWidths({
      columnTexts: singlesColumnTexts,
      columnButtons: singlesColumnButtons,
      minWidthsPx: MIN_SINGLES_COLUMN_WIDTHS_PX,
      maxMeasureChars: LOOKUP_COLUMN_DISPLAY_CHARS,
      enabled: singlesRows.length > 0
    });

  const { gridTemplateColumns: auditTableGridSx, minTableWidthPx: auditTableMinWidthPx } =
    useColorTemplate9AutoFitColumnWidths({
      columnTexts: auditColumnTexts,
      minWidthsPx: MIN_AUDIT_COLUMN_WIDTHS_PX,
      maxMeasureChars: LOOKUP_COLUMN_DISPLAY_CHARS,
      enabled: auditRows.length > 0
    });

  const syncSavedFields = useCallback((rows) => {
    const savedStatus = {};
    const savedMemberCategory = {};
    const savedAccountBalanceToken = {};
    for (const row of rows) {
      if (row?.singlesId != null) {
        savedStatus[row.singlesId] = String(row.status ?? 'blank');
        savedMemberCategory[row.singlesId] = String(row.memberCategory ?? 'PUBLIC');
        savedAccountBalanceToken[row.singlesId] = parseTokenBalanceValue(row.accountBalanceToken);
      }
    }
    setSavedStatusById(savedStatus);
    setSavedMemberCategoryById(savedMemberCategory);
    setSavedAccountBalanceTokenById(savedAccountBalanceToken);
  }, []);

  const lookupPayload = useCallback(
    () => ({
      singlesId: String(singlesIdInput ?? '').trim() || undefined,
      email: String(emailInput ?? '').trim() || undefined,
      alias: String(aliasInput ?? '').trim() || undefined,
      memberId: String(memberIdInput ?? '').trim() || undefined,
      phone: String(phoneInput ?? '').trim() || undefined
    }),
    [aliasInput, emailInput, memberIdInput, phoneInput, singlesIdInput]
  );

  const applySinglesLookupResult = useCallback((rows) => {
    setSinglesRows(rows);
    syncSavedFields(rows);
    if (rows[0]) {
      populateFieldsFromSinglesRow(rows[0], {
        setSinglesIdInput,
        setEmailInput,
        setAliasInput,
        setMemberIdInput,
        setPhoneInput
      });
    }
  }, [syncSavedFields]);

  const runLookup = useCallback(async () => {
    const data = await fetchAdminAuditRegistrationLookup(lookupPayload());
    const rows = Array.isArray(data?.singlesRows) ? data.singlesRows : [];
    applySinglesLookupResult(rows);
    setAuditRows(Array.isArray(data?.rows) ? data.rows : []);
    onError?.('');
  }, [applySinglesLookupResult, lookupPayload, onError]);

  const runLookupAll = useCallback(async () => {
    const data = await fetchAdminSinglesLookupAll();
    const rows = Array.isArray(data?.singlesRows) ? data.singlesRows : [];
    applySinglesLookupResult(rows);
    setAuditRows([]);
    onError?.('');
  }, [applySinglesLookupResult, onError]);

  const handleLookupClick = useCallback(async () => {
    if (!hasLookupInput({ singlesIdInput, emailInput, aliasInput, memberIdInput, phoneInput })) {
      setHasSearched(false);
      setSinglesRows([]);
      setSavedStatusById({});
      setSavedMemberCategoryById({});
      setSavedAccountBalanceTokenById({});
      setAuditRows([]);
      onError?.('');
      return;
    }

    setHasSearched(true);
    setLookupBusy(true);
    onError?.('');
    try {
      setLastLookupWasAll(false);
      await runLookup();
    } catch (err) {
      setSinglesRows([]);
      setSavedStatusById({});
      setSavedMemberCategoryById({});
      setSavedAccountBalanceTokenById({});
      setAuditRows([]);
      onError?.(err?.response?.data?.error || err?.message || 'Failed to lookup registrations');
    } finally {
      setLookupBusy(false);
    }
  }, [aliasInput, emailInput, memberIdInput, onError, phoneInput, runLookup, singlesIdInput]);

  const handleLookupAllClick = useCallback(async () => {
    setHasSearched(true);
    setLookupAllBusy(true);
    onError?.('');
    try {
      setLastLookupWasAll(true);
      await runLookupAll();
    } catch (err) {
      setSinglesRows([]);
      setSavedStatusById({});
      setSavedMemberCategoryById({});
      setSavedAccountBalanceTokenById({});
      setAuditRows([]);
      onError?.(err?.response?.data?.error || err?.message || 'Failed to lookup all singles');
    } finally {
      setLookupAllBusy(false);
    }
  }, [onError, runLookupAll]);

  const handleClearClick = useCallback(() => {
    setSinglesIdInput('');
    setEmailInput('');
    setAliasInput('');
    setMemberIdInput('');
    setPhoneInput('');
    setSinglesRows([]);
    setSavedStatusById({});
    setSavedMemberCategoryById({});
    setSavedAccountBalanceTokenById({});
    setAuditRows([]);
    setHasSearched(false);
    setLastLookupWasAll(false);
    setPwdRetryResetBusyById({});
    onError?.('');
  }, [onError]);

  const listBusy = lookupBusy || lookupAllBusy;

  const handleCycleStatus = useCallback((singlesId) => {
    const id = Number(singlesId);
    if (!Number.isFinite(id) || id < 1 || saveBusy) return;

    setSinglesRows((prev) =>
      prev.map((row) => {
        if (row.singlesId !== id || isAdminSinglesLookupRow(row)) return row;
        return { ...row, status: nextSinglesStatus(row.status) };
      })
    );
  }, [saveBusy]);

  const handleTokenBalanceChange = useCallback((singlesId, nextRaw) => {
    const id = Number(singlesId);
    if (!Number.isFinite(id) || id < 1 || saveBusy) return;
    const nextDigits = normalizeTokenBalanceInput(nextRaw);

    setSinglesRows((prev) =>
      prev.map((row) => {
        if (row.singlesId !== id || isAdminSinglesLookupRow(row)) return row;
        return { ...row, accountBalanceToken: nextDigits === '' ? '' : parseTokenBalanceValue(nextDigits) };
      })
    );
  }, [saveBusy]);

  const rowHasUnsavedChanges = useCallback(
    (row) => {
      if (isAdminSinglesLookupRow(row) || row.singlesId == null) return false;
      const id = row.singlesId;
      return (
        String(row.status ?? 'blank') !== String(savedStatusById[id] ?? 'blank') ||
        String(row.memberCategory ?? 'PUBLIC') !== String(savedMemberCategoryById[id] ?? 'PUBLIC') ||
        parseTokenBalanceValue(row.accountBalanceToken) !==
          parseTokenBalanceValue(savedAccountBalanceTokenById[id] ?? 0)
      );
    },
    [savedAccountBalanceTokenById, savedMemberCategoryById, savedStatusById]
  );

  const hasUnsavedStatusChanges = singlesRows.some((row) => rowHasUnsavedChanges(row));

  const handleSaveStatus = useCallback(async () => {
    const changedRows = singlesRows.filter((row) => rowHasUnsavedChanges(row));
    if (!changedRows.length) return;

    setSaveBusy(true);
    onError?.('');
    try {
      for (const row of changedRows) {
        if (String(row.status ?? 'blank') !== String(savedStatusById[row.singlesId] ?? 'blank')) {
          await saveAdminSinglesStatus({ singlesId: row.singlesId, status: row.status });
        }
        if (
          String(row.memberCategory ?? 'PUBLIC') !== String(savedMemberCategoryById[row.singlesId] ?? 'PUBLIC')
        ) {
          await saveAdminSinglesMemberCategory({
            singlesId: row.singlesId,
            memberCategory: row.memberCategory
          });
        }
        if (
          parseTokenBalanceValue(row.accountBalanceToken) !==
          parseTokenBalanceValue(savedAccountBalanceTokenById[row.singlesId] ?? 0)
        ) {
          await saveAdminSinglesTokenBalance({
            singlesId: row.singlesId,
            accountBalanceToken: parseTokenBalanceValue(row.accountBalanceToken)
          });
        }
      }
      await (lastLookupWasAll ? runLookupAll() : runLookup());
      await Promise.all([
        invalidateAllSinglesCache(),
        invalidateMyPicksListCache(),
        invalidateMyPicksFeedCache(),
        invalidateRequestedSinglesCache()
      ]);
      setSaveResultPopup({ kind: 'success', message: 'Save Success' });
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to save singles changes';
      onError?.(message);
      setSaveResultPopup({ kind: 'error', message });
    } finally {
      setSaveBusy(false);
    }
  }, [
    lastLookupWasAll,
    onError,
    rowHasUnsavedChanges,
    runLookup,
    runLookupAll,
    savedAccountBalanceTokenById,
    savedMemberCategoryById,
    savedStatusById,
    singlesRows
  ]);

  const handleResetPwdRetry = useCallback(
    async (singlesId) => {
      const id = Number(singlesId);
      if (!Number.isFinite(id) || id < 1 || pwdRetryResetBusyById[id]) return;

      setPwdRetryResetBusyById((prev) => ({ ...prev, [id]: true }));
      onError?.('');
      try {
        const result = await resetAdminPasswordAttemptCount({ singlesId: id });
        const nextCount = Number(result?.passwordAttemptCount ?? 0);
        setSinglesRows((prev) =>
          prev.map((row) => (row.singlesId === id ? { ...row, passwordAttemptCount: nextCount } : row))
        );
      } catch (err) {
        onError?.(err?.response?.data?.error || err?.message || 'Failed to reset password attempt count');
      } finally {
        setPwdRetryResetBusyById((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [onError, pwdRetryResetBusyById]
  );

  const handleCascadeDeleteSingles = useCallback(
    async (row) => {
      if (isAdminSinglesLookupRow(row)) return;
      const id = Number(row?.singlesId);
      if (!Number.isFinite(id) || id < 1 || cascadeDeleteBusyById[id] || saveBusy || listBusy) return;

      const parts = [`singles_id ${id}`];
      if (row?.alias) parts.push(`alias ${row.alias}`);
      if (row?.email) parts.push(`email ${row.email}`);

      if (
        !(await themedConfirm(
          `Cascade delete ${parts.join(', ')}?\n\nThis removes the singles row and dependent rows where Postgres ON DELETE CASCADE applies.`
        ))
      ) {
        return;
      }

      setCascadeDeleteBusyById((prev) => ({ ...prev, [id]: true }));
      onError?.('');
      try {
        await cascadeDeleteAdminTableRow('singles', id);
        await runLookup();
      } catch (err) {
        onError?.(err?.response?.data?.error || err?.message || 'Failed to cascade delete singles row');
      } finally {
        setCascadeDeleteBusyById((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [cascadeDeleteBusyById, listBusy, onError, runLookup, saveBusy]
  );

  const hasInput = hasLookupInput({ singlesIdInput, emailInput, aliasInput, memberIdInput, phoneInput });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'stretch', width: '100%' }}>
      <Box sx={lookupPanelSx}>
        <Box sx={{ display: 'flex', justifyContent: 'center', pb: 1.25 }}>
          <SelectedButtonTemplate
            type="button"
            disabled={listBusy}
            onClick={() => void handleLookupAllClick()}
          >
            {lookupAllBusy ? 'Loading all…' : 'Lookup All'}
          </SelectedButtonTemplate>
        </Box>

        {!listBusy && !hasSearched ? (
          <ColorTemplate9TableData.EmptyText sx={{ pb: 1.25 }}>
            Enter Single Id, Email, Alias, Member Id, or Phone, then press Lookup. Use * as a wildcard (e.g. a*@b.com, Wacky*, 100*, 1703*).
          </ColorTemplate9TableData.EmptyText>
        ) : null}

        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: { xs: 'flex-start', md: 'flex-start' },
            gap: { xs: 1, sm: 1.25, md: 1.5 }
          }}
        >
          <LookupField
            label="Single Id:"
            value={singlesIdInput}
            onChange={(value) => setSinglesIdInput(value.replace(/[^\d*]/g, ''))}
            inputMode="numeric"
            pattern="[0-9]*"
          />

          <Typography sx={bigOrSx} aria-hidden>
            OR
          </Typography>

          <LookupField label="Email:" value={emailInput} onChange={setEmailInput} />

          <Typography sx={bigOrSx} aria-hidden>
            OR
          </Typography>

          <LookupField label="Alias:" value={aliasInput} onChange={setAliasInput} />

          <Typography sx={bigOrSx} aria-hidden>
            OR
          </Typography>

          <LookupField label="Member Id:" value={memberIdInput} onChange={setMemberIdInput} />

          <Typography sx={bigOrSx} aria-hidden>
            OR
          </Typography>

          <LookupField label="Phone:" value={phoneInput} onChange={setPhoneInput} />
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, flexWrap: 'wrap', pt: 1.5 }}>
          <SelectedButtonTemplate type="button" disabled={listBusy} onClick={handleClearClick}>
            Clear
          </SelectedButtonTemplate>
          <SelectedButtonTemplate
            type="button"
            disabled={listBusy || !hasInput}
            onClick={() => void handleLookupClick()}
          >
            {lookupBusy ? 'Searching…' : 'Lookup'}
          </SelectedButtonTemplate>
        </Box>
      </Box>

      {!listBusy && hasSearched ? (
        <>
          <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, overflow: 'visible' }}>
            <Typography sx={sectionTitleSx}>All from singles table</Typography>
            {singlesRows.length === 0 ? (
              <ColorTemplate9TableData.EmptyText>No matching singles rows found.</ColorTemplate9TableData.EmptyText>
            ) : (
              <ColorTemplate9TableData.Table
                topHorizontalScrollbar
                autoFitColumns
                minTableWidth={singlesTableMinWidthPx}
              >
                <ColorTemplate9TableData.HeaderRow
                  gridTemplateColumns={singlesTableGridSx}
                  sx={lookupTableRowSx(singlesTableMinWidthPx)}
                >
                  <ColorTemplate9TableData.HeaderCell
                    columnIndex={SINGLES_COL.PHOTO}
                    sx={{ justifyContent: 'center', ...lookupScrollHeaderCellSx }}
                  >
                    Photo
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell
                    columnIndex={SINGLES_COL.ALIAS}
                    sx={{ display: { xs: 'none', sm: 'flex' }, ...lookupScrollHeaderCellSx }}
                  >
                    Alias
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell
                    columnIndex={SINGLES_COL.SINGLES_ID}
                    sx={{ ...lookupCenterColumnCellSx, ...lookupScrollHeaderCellSx }}
                  >
                    singles_id
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell
                    columnIndex={SINGLES_COL.MEMBER_ID}
                    sx={{ display: { xs: 'none', sm: 'flex' }, ...lookupScrollHeaderCellSx }}
                  >
                    member_id
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell
                    columnIndex={SINGLES_COL.EMAIL}
                    sx={lookupScrollHeaderCellSx}
                  >
                    Email
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell
                    columnIndex={SINGLES_COL.IMPERSONATE}
                    sx={{ display: { xs: 'none', sm: 'flex' }, justifyContent: 'center', ...lookupScrollHeaderCellSx }}
                  >
                    Impersonate
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell
                    columnIndex={SINGLES_COL.STATUS}
                    sx={{ display: { xs: 'none', sm: 'flex' }, ...lookupScrollHeaderCellSx }}
                  >
                    status
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell
                    columnIndex={SINGLES_COL.TOKEN_BALANCE}
                    sx={{ display: { xs: 'none', sm: 'flex' }, justifyContent: 'center', ...lookupScrollHeaderCellSx }}
                    title="payment.account_balance_token"
                  >
                    Tokens
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell
                    columnIndex={SINGLES_COL.PHONE}
                    sx={{ display: { xs: 'none', sm: 'flex' }, ...lookupScrollHeaderCellSx }}
                  >
                    Phone
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell sx={{ justifyContent: 'center', ...lookupScrollHeaderCellSx }}>
                    {CASCADE_DELETE_LABEL}
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell sx={{ display: { xs: 'none', sm: 'flex' }, ...lookupScrollHeaderCellSx }}>
                    Pwd Retry
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell sx={{ display: { xs: 'none', sm: 'flex' }, ...lookupScrollHeaderCellSx }}>
                    My Refer Code
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell sx={{ display: { xs: 'none', sm: 'flex' }, ...lookupScrollHeaderCellSx }}>
                    I refer by
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell sx={{ display: { xs: 'none', sm: 'flex' }, ...lookupScrollHeaderCellSx }}>
                    View Video
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell
                    sx={{ display: { xs: 'none', sm: 'flex' }, ...lookupAgeSortHeaderSx }}
                    onClick={handleToggleVideoAgeSort}
                    role="columnheader"
                    aria-sort={videoAgeSortDir === 'asc' ? 'ascending' : 'descending'}
                  >
                    Age {videoAgeSortDir === 'asc' ? '↑' : '↓'}
                  </ColorTemplate9TableData.HeaderCell>
                </ColorTemplate9TableData.HeaderRow>

                {displaySinglesRows.map((row, index) => {
                  const pwdRetryBusy = Boolean(pwdRetryResetBusyById[row.singlesId]);
                  const cascadeDeleteBusy = Boolean(cascadeDeleteBusyById[row.singlesId]);
                  const pwdRetryCount = Number(row.passwordAttemptCount ?? 0);
                  return (
                  <ColorTemplate9TableData.BodyRow
                    key={`singles-${row.singlesId}-${index}`}
                    rowIndex={index}
                    gridTemplateColumns={singlesTableGridSx}
                    sx={lookupTableRowSx(singlesTableMinWidthPx)}
                  >
                    <ColorTemplate9TableData.BodyCell
                      columnIndex={SINGLES_COL.PHOTO}
                      sx={{ justifyContent: 'center', py: 0.5 }}
                    >
                      <LookupProfilePhoto
                        singlesId={row.singlesId}
                        profileImageFk={row.profileImageFk}
                        alias={row.alias}
                      />
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell
                      columnIndex={SINGLES_COL.ALIAS}
                      sx={{ display: { xs: 'none', sm: 'flex' } }}
                    >
                      <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>
                        {truncateLookupDisplay(row.alias || '—')}
                      </ColorTemplate9TableData.BodyText>
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell columnIndex={SINGLES_COL.SINGLES_ID} sx={lookupCenterColumnCellSx}>
                      <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>
                        {row.singlesId ?? '—'}
                      </ColorTemplate9TableData.BodyText>
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell
                      columnIndex={SINGLES_COL.MEMBER_ID}
                      sx={{ display: { xs: 'none', sm: 'flex' } }}
                    >
                      <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>
                        {row.memberId ?? '—'}
                      </ColorTemplate9TableData.BodyText>
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell columnIndex={SINGLES_COL.EMAIL}>
                      <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx} title={row.email || undefined}>
                        {truncateLookupDisplay(row.email || '—')}
                      </ColorTemplate9TableData.BodyText>
                      <ColorTemplate9TableData.BodyText sx={{ display: { xs: 'block', sm: 'none' }, opacity: 0.85 }}>
                        {row.singlesId != null ? `singles_id ${row.singlesId}` : 'singles_id —'}
                        {row.memberId != null ? ` · member_id ${row.memberId}` : ''}
                        {row.memberCategory ? ` · ${formatMemberCategoryLabel(row.memberCategory)}` : ''}
                        {row.status ? ` · ${formatSinglesStatusLabel(row.status)}` : ''}
                        {row.over18Verified === true ? ' · 18+' : row.over18Verified === false ? ' · under18' : ''}
                        {` · tokens ${formatTokenBalanceDisplay(row.accountBalanceToken)}`}
                        {row.phone ? ` · ${row.phone}` : ''}
                        {row.alias ? ` · ${row.alias}` : ''}
                        {` · pwd retry ${pwdRetryCount}`}
                        {row.myReferCode ? ` · my refer ${row.myReferCode}` : ''}
                        {row.referByCode ? ` · refer by ${formatReferByDisplay(row)}` : ''}
                      </ColorTemplate9TableData.BodyText>
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell
                      columnIndex={SINGLES_COL.IMPERSONATE}
                      sx={{ display: { xs: 'none', sm: 'flex' }, justifyContent: 'center' }}
                    >
                      {isAdminSinglesLookupRow(row) ? null : (
                        <LookupImpersonateButton targetSinglesId={row.singlesId} />
                      )}
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell
                      columnIndex={SINGLES_COL.STATUS}
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}
                    >
                      {isAdminSinglesLookupRow(row) ? (
                        <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>
                          {formatSinglesStatusLabel(row.status)}
                          {row.over18Verified === true ? ' · 18+' : ''}
                        </ColorTemplate9TableData.BodyText>
                      ) : (
                        <>
                          <SelectedButtonTemplate
                            type="button"
                            disabled={saveBusy}
                            onClick={() => handleCycleStatus(row.singlesId)}
                          >
                            {formatSinglesStatusLabel(row.status)}
                          </SelectedButtonTemplate>
                          {row.over18Verified === true ? (
                            <ColorTemplate9TableData.BodyText sx={{ ...lookupBodyTextSx, fontWeight: 700, mb: 0 }}>
                              18+
                            </ColorTemplate9TableData.BodyText>
                          ) : null}
                        </>
                      )}
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell
                      columnIndex={SINGLES_COL.TOKEN_BALANCE}
                      sx={{ display: { xs: 'none', sm: 'flex' }, justifyContent: 'center' }}
                    >
                      {isAdminSinglesLookupRow(row) ? (
                        <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>
                          {formatTokenBalanceDisplay(row.accountBalanceToken)}
                        </ColorTemplate9TableData.BodyText>
                      ) : (
                        <TextField
                          size="small"
                          value={
                            row.accountBalanceToken === '' || row.accountBalanceToken == null
                              ? ''
                              : formatTokenBalanceDisplay(row.accountBalanceToken)
                          }
                          onChange={(event) => handleTokenBalanceChange(row.singlesId, event.target.value)}
                          disabled={saveBusy || listBusy}
                          inputProps={{
                            inputMode: 'numeric',
                            'aria-label': `Token balance for singles_id ${row.singlesId}`
                          }}
                          sx={tokenBalanceFieldSx}
                        />
                      )}
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell
                      columnIndex={SINGLES_COL.PHONE}
                      sx={{ display: { xs: 'none', sm: 'flex' } }}
                    >
                      <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx} title={row.phone || undefined}>
                        {truncateLookupDisplay(row.phone || '—')}
                      </ColorTemplate9TableData.BodyText>
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell sx={{ justifyContent: 'center' }}>
                      {isAdminSinglesLookupRow(row) ? null : (
                        <SelectedButtonTemplate
                          type="button"
                          disabled={cascadeDeleteBusy || saveBusy || listBusy}
                          onClick={() => void handleCascadeDeleteSingles(row)}
                          sx={{ whiteSpace: 'nowrap' }}
                        >
                          {cascadeDeleteBusy ? 'Deleting…' : CASCADE_DELETE_LABEL}
                        </SelectedButtonTemplate>
                      )}
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell sx={{ display: { xs: 'none', sm: 'flex' }, gap: 0.75, alignItems: 'center' }}>
                      <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>{pwdRetryCount}</ColorTemplate9TableData.BodyText>
                      <SelectedButtonTemplate
                        type="button"
                        disabled={pwdRetryBusy || saveBusy}
                        onClick={() => void handleResetPwdRetry(row.singlesId)}
                      >
                        {pwdRetryBusy ? '…' : 'Reset'}
                      </SelectedButtonTemplate>
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell sx={{ display: { xs: 'none', sm: 'flex' } }}>
                      <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx} title={row.myReferCode || undefined}>
                        {truncateLookupDisplay(row.myReferCode || '—')}
                      </ColorTemplate9TableData.BodyText>
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell sx={{ display: { xs: 'none', sm: 'flex' } }}>
                      <ColorTemplate9TableData.BodyText
                        sx={lookupBodyTextSx}
                        title={formatReferByDisplay(row) !== '—' ? formatReferByDisplay(row) : undefined}
                      >
                        {truncateLookupDisplay(formatReferByDisplay(row))}
                      </ColorTemplate9TableData.BodyText>
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell sx={viewVideoCellSx}>
                      {Array.isArray(row.videos) && row.videos.length ? (
                        row.videos.map((video) => {
                          const fullName = String(video.videoFileName || `video_${video.videoId}`);
                          return (
                            <SelectedButtonTemplate
                              key={`video-${row.singlesId}-${video.videoId}`}
                              type="button"
                              sx={viewVideoButtonSx}
                              title={fullName}
                              onClick={() => void handleOpenAdminVideo(video)}
                            >
                              {truncateLookupDisplay(fullName)}
                            </SelectedButtonTemplate>
                          );
                        })
                      ) : (
                        <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>—</ColorTemplate9TableData.BodyText>
                      )}
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell sx={viewVideoCellSx}>
                      {Array.isArray(row.videos) && row.videos.length ? (
                        row.videos.map((video) => (
                          <ColorTemplate9TableData.BodyText
                            key={`video-age-${row.singlesId}-${video.videoId}`}
                            sx={lookupBodyTextSx}
                            title={formatVideoFileAge(video.createdAt)}
                          >
                            {truncateLookupDisplay(formatVideoFileAge(video.createdAt))}
                          </ColorTemplate9TableData.BodyText>
                        ))
                      ) : (
                        <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>—</ColorTemplate9TableData.BodyText>
                      )}
                    </ColorTemplate9TableData.BodyCell>
                  </ColorTemplate9TableData.BodyRow>
                  );
                })}
              </ColorTemplate9TableData.Table>
            )}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5, mb: 2, pb: 2 }}>
            <SelectedButtonTemplate
              type="button"
              disabled={!hasUnsavedStatusChanges || saveBusy || listBusy}
              onClick={() => void handleSaveStatus()}
            >
              {saveBusy ? 'Saving…' : 'Save'}
            </SelectedButtonTemplate>
          </Box>

          <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, overflow: 'visible' }}>
            <Typography sx={sectionTitleSx}>All from audit_registrations</Typography>
            {auditRows.length === 0 ? (
              <ColorTemplate9TableData.EmptyText>No matching audit registration rows found.</ColorTemplate9TableData.EmptyText>
            ) : (
              <ColorTemplate9TableData.Table
                topHorizontalScrollbar
                autoFitColumns
                minTableWidth={auditTableMinWidthPx}
              >
                <ColorTemplate9TableData.HeaderRow
                  gridTemplateColumns={auditTableGridSx}
                  sx={lookupTableRowSx(auditTableMinWidthPx)}
                >
                  <ColorTemplate9TableData.HeaderCell aria-hidden />
                  <ColorTemplate9TableData.HeaderCell sx={{ display: { xs: 'none', sm: 'flex' } }}>
                    singles_id
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell sx={{ display: { xs: 'none', sm: 'flex' } }}>
                    Status
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell sx={{ display: { xs: 'none', sm: 'flex' } }}>
                    Date
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell>Email</ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell sx={{ display: { xs: 'none', sm: 'flex' } }}>
                    Phone
                  </ColorTemplate9TableData.HeaderCell>
                </ColorTemplate9TableData.HeaderRow>

                {auditRows.map((row, index) => (
                  <ColorTemplate9TableData.BodyRow
                    key={`audit-${row.auditRegistrationId}-${index}`}
                    rowIndex={index}
                    gridTemplateColumns={auditTableGridSx}
                    sx={lookupTableRowSx(auditTableMinWidthPx)}
                  >
                    <ColorTemplate9TableData.BodyCell aria-hidden />
                    <ColorTemplate9TableData.BodyCell sx={{ display: { xs: 'none', sm: 'flex' } }}>
                      <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>
                        {row.singlesId ?? '—'}
                      </ColorTemplate9TableData.BodyText>
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell sx={{ display: { xs: 'none', sm: 'flex' } }}>
                      <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>
                        {row.status || '—'}
                      </ColorTemplate9TableData.BodyText>
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell sx={{ display: { xs: 'none', sm: 'flex' } }}>
                      <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>
                        {formatAuditDate(row.dateUpdate)}
                      </ColorTemplate9TableData.BodyText>
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell>
                      <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>
                        {row.email || '—'}
                      </ColorTemplate9TableData.BodyText>
                      <ColorTemplate9TableData.BodyText sx={{ display: { xs: 'block', sm: 'none' }, opacity: 0.85 }}>
                        {row.singlesId != null ? `singles_id ${row.singlesId}` : 'singles_id —'}
                        {row.status ? ` · ${row.status}` : ''}
                        {row.dateUpdate ? ` · ${formatAuditDate(row.dateUpdate)}` : ''}
                        {row.phone ? ` · ${row.phone}` : ''}
                      </ColorTemplate9TableData.BodyText>
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell sx={{ display: { xs: 'none', sm: 'flex' } }}>
                      <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>
                        {row.phone || '—'}
                      </ColorTemplate9TableData.BodyText>
                    </ColorTemplate9TableData.BodyCell>
                  </ColorTemplate9TableData.BodyRow>
                ))}
              </ColorTemplate9TableData.Table>
            )}
          </Box>
        </>
      ) : null}

      <ColorTemplate7PopupLargeDark
        open={Boolean(saveResultPopup)}
        onClose={() => setSaveResultPopup(null)}
        closeOnBackdrop
        closeButtonAriaLabel="Close save result"
      >
        <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
          {saveResultPopup?.kind === 'success' ? (
            <ColorTemplate7PopupLargeDark.Title>Save Success</ColorTemplate7PopupLargeDark.Title>
          ) : (
            <>
              <ColorTemplate7PopupLargeDark.Title>Save failed</ColorTemplate7PopupLargeDark.Title>
              <ColorTemplate7PopupLargeDark.ErrorBar>
                {saveResultPopup?.message || 'Failed to save singles changes'}
              </ColorTemplate7PopupLargeDark.ErrorBar>
            </>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <ColorTemplate7PopupLargeDark.ActionButton type="button" onClick={() => setSaveResultPopup(null)}>
              OK
            </ColorTemplate7PopupLargeDark.ActionButton>
          </Box>
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>

      <ColorTemplate7PopupLargeDark
        open={Boolean(playerVideoLabel || playerVideoLoading || playerVideoUrl || playerVideoError)}
        onClose={() => {
          revokePlayerVideoBlob();
          setPlayerVideoUrl('');
          setPlayerVideoLabel('');
          setPlayerVideoError('');
          setPlayerVideoLoading(false);
        }}
        closeOnBackdrop
        closeButtonAriaLabel="Close video player"
      >
        <ColorTemplate7PopupLargeDark.Body spacing={1}>
          {playerVideoLabel ? (
            <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center', fontWeight: 700 }}>
              {playerVideoLabel}
            </ColorTemplate7PopupLargeDark.BodyText>
          ) : null}
          {playerVideoLoading ? (
            <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center' }}>Loading video…</ColorTemplate7PopupLargeDark.BodyText>
          ) : null}
          {playerVideoError ? (
            <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center', color: '#ffb4a9' }}>
              {playerVideoError}
            </ColorTemplate7PopupLargeDark.BodyText>
          ) : null}
          {playerVideoUrl ? (
            <Box
              component="video"
              src={playerVideoUrl}
              controls
              autoPlay
              playsInline
              sx={{ width: '100%', maxHeight: '70vh' }}
            />
          ) : null}
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>
    </Box>
  );
}
