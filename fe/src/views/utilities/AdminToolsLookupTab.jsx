import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import ColorTemplate9TableData, { useColorTemplate9AutoFitColumnWidths } from 'ui-component/ColorTemplate9TableData';
import SelectedButtonTemplate from 'ui-component/SelectedButtonTemplate';
import { formatMemberCategoryLabel, isAdminMemberCategory, MEMBER_CATEGORY_VALUES } from 'utils/memberCategory';
import { themedConfirm } from 'utils/themedDialog';
import {
  saveAdminSinglesStatus,
  saveAdminSinglesMemberCategory,
  saveAdminSinglesTokenBalance,
  saveAdminSinglesFields,
  fetchAdminAuditRegistrationLookup,
  fetchAdminSinglesLookupAll,
  softResetAdminMemberAccount,
  hardResetAdminMemberAccount,
  resetAdminPasswordAttemptCount,
  cascadeDeleteAdminTableRow,
  clearAdminLockTutaNotes,
  clearAdminLockTutaPhotos,
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
import {
  buildColorTemplate9AutoFitGridTemplateColumns,
  sumColorTemplate9AutoFitColumnWidths,
  truncateColorTemplate9AutoFitText
} from 'utils/colorTemplate9AutoFitColumns';
import { formatVideoFileAge, sortSinglesRowsByVideoAge } from 'utils/formatVideoFileAge';

const CASCADE_DELETE_LABEL = 'Cascd Del';
const SOFT_RESET_LABEL = 'Default Reset';
const HARD_RESET_LABEL = 'Factory Reset';
const LOGIN_RESET_LABEL = 'Login # Reset';
const PROTECTED_ACCOUNT_TITLE = 'Protected account (PROTECT_ACCOUNTS) — disabled';
const LOOKUP_BUTTON_ZOOM = 0.5;
const lookupHalfButtonSx = { whiteSpace: 'nowrap', zoom: LOOKUP_BUTTON_ZOOM };
const protectedAccountButtonSx = {
  ...lookupHalfButtonSx,
  '&.Mui-disabled': { opacity: 0.35, filter: 'grayscale(1)', cursor: 'not-allowed', pointerEvents: 'auto' }
};
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
      sx={{ ...lookupHalfButtonSx, px: 0, minWidth: 0, maxWidth: '100%' }}
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

const lookupHalfHeaderCellSx = {
  ...lookupScrollHeaderCellSx,
  '& .MuiTypography-root': { ...lookupScrollHeaderCellSx['& .MuiTypography-root'], zoom: LOOKUP_BUTTON_ZOOM }
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

/** Alias / singles_id / member_id / Email — same clickable header treatment as Age. */
const lookupColumnSortHeaderSx = lookupAgeSortHeaderSx;

const DEFAULT_SINGLES_TABLE_SORT = { key: 'createdAt', dir: 'desc' };

function compareNullableNumber(aVal, bVal, directionMul) {
  const aOk = Number.isFinite(aVal);
  const bOk = Number.isFinite(bVal);
  if (!aOk && !bOk) return 0;
  if (!aOk) return 1;
  if (!bOk) return -1;
  return directionMul * (aVal - bVal);
}

function compareNullableDateMs(aMs, bMs, directionMul, tieBreak) {
  const aOk = Number.isFinite(aMs);
  const bOk = Number.isFinite(bMs);
  if (!aOk && !bOk) return tieBreak();
  if (!aOk) return 1;
  if (!bOk) return -1;
  const diff = directionMul * (aMs - bMs);
  return diff !== 0 ? diff : tieBreak();
}

/** Client sort for Admin Tools singles grid (column headers + Age + created_at default). */
function sortSinglesLookupRows(rows, sort) {
  if (!Array.isArray(rows) || !rows.length) return rows;
  const key = sort?.key ?? DEFAULT_SINGLES_TABLE_SORT.key;
  const dir = sort?.dir ?? DEFAULT_SINGLES_TABLE_SORT.dir;
  if (key === 'videoAge') return sortSinglesRowsByVideoAge(rows, dir);

  const directionMul = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === 'createdAt') {
      const aMs = a?.createdAt != null ? new Date(a.createdAt).getTime() : NaN;
      const bMs = b?.createdAt != null ? new Date(b.createdAt).getTime() : NaN;
      return compareNullableDateMs(aMs, bMs, directionMul, () =>
        compareNullableNumber(Number(b?.singlesId), Number(a?.singlesId), 1)
      );
    }
    if (key === 'singlesId') {
      return compareNullableNumber(Number(a?.singlesId), Number(b?.singlesId), directionMul);
    }
    if (key === 'memberId') {
      return compareNullableNumber(Number(a?.memberId), Number(b?.memberId), directionMul);
    }
    const field = key === 'alias' ? 'alias' : 'email';
    const aS = String(a?.[field] ?? '').toLowerCase();
    const bS = String(b?.[field] ?? '').toLowerCase();
    const cmp = aS.localeCompare(bS);
    if (cmp !== 0) return directionMul * cmp;
    return compareNullableNumber(Number(b?.singlesId), Number(a?.singlesId), 1);
  });
}

function columnSortAria(sort, key) {
  if (sort?.key !== key) return 'none';
  return sort.dir === 'asc' ? 'ascending' : 'descending';
}

function columnSortHeaderLabel(label, sort, key) {
  if (sort?.key !== key) return label;
  return `${label} ${sort.dir === 'asc' ? '↑' : '↓'}`;
}

const lookupPhotoAvatarSx = {
  width: 40,
  height: 40,
  border: '2px solid #000',
  bgcolor: '#fff',
  flexShrink: 0
};

const SINGLES_COL = {
  PHOTO: 0,
  CATEGORY: 1,
  ALIAS: 2,
  EMAIL: 3,
  SINGLES_ID: 4,
  MEMBER_ID: 5,
  CASCADE_DELETE: 6,
  IMPERSONATE: 7,
  TOKEN_BALANCE: 8,
  PHONE: 9,
  STATUS: 10,
  RESET: 11,
  HARD_RESET: 12,
  LOGIN_RESET: 13,
  MY_REFER_CODE: 14,
  REFER_BY: 15,
  VIEW_VIDEO: 16,
  VIDEO_AGE: 17
};

/** Photo, Category, Alias, Email stay pinned left while the rest of the grid scrolls horizontally. */
const SINGLES_FROZEN_COLUMN_COUNT = 4;

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

function hasLookupInput({ singlesIdInput, emailInput, aliasInput, memberIdInput, phoneInput, memberCategoryInput }) {
  if (String(memberCategoryInput ?? '').trim()) return true;
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

function buildSinglesLookupColumnButtons() {
  const statusLabels = SINGLES_STATUS_VALUES.map((value) => formatSinglesStatusLabel(value));
  return [
    null,
    null,
    null,
    null,
    null,
    null,
    {
      labels: [CASCADE_DELETE_LABEL, 'Deleting…'],
      variant: 'selected',
      scale: LOOKUP_BUTTON_ZOOM
    },
    {
      labels: ['Impersonate', 'Impersonating…'],
      variant: 'selected',
      chromePx: 12,
      scale: LOOKUP_BUTTON_ZOOM
    },
    null,
    null,
    {
      labels: statusLabels,
      variant: 'selected',
      companionTexts: ['18+'],
      companionGapPx: 12,
      scale: LOOKUP_BUTTON_ZOOM
    },
    {
      labels: [SOFT_RESET_LABEL, '…'],
      variant: 'selected',
      scale: LOOKUP_BUTTON_ZOOM
    },
    {
      labels: [HARD_RESET_LABEL, '…'],
      variant: 'selected',
      scale: LOOKUP_BUTTON_ZOOM
    },
    {
      labels: [LOGIN_RESET_LABEL, '…'],
      variant: 'selected',
      scale: LOOKUP_BUTTON_ZOOM
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
    ['Category', ...rows.map((row) => truncateLookupDisplay(formatMemberCategoryLabel(row.memberCategory)))],
    ['Alias', ...rows.map((row) => truncateLookupDisplay(row.alias || '—'))],
    ['Email', ...rows.map((row) => truncateLookupDisplay(row.email || '—'))],
    ['singles_id', ...rows.map((row) => truncateLookupDisplay(row.singlesId ?? '—'))],
    ['member_id', ...rows.map((row) => truncateLookupDisplay(row.memberId ?? '—'))],
    [
      CASCADE_DELETE_LABEL,
      ...rows.map((row) => (isAdminSinglesLookupRow(row) ? '' : CASCADE_DELETE_LABEL))
    ],
    ['Impersonate', ...rows.map(() => 'Impersonate')],
    ['Tokens', ...rows.map((row) => truncateLookupDisplay(formatTokenBalanceDisplay(row.accountBalanceToken)))],
    ['Phone', ...rows.map((row) => truncateLookupDisplay(row.phone || '—'))],
    [
      'status',
      ...statusLabels.map((label) => truncateLookupDisplay(label)),
      ...rows.map((row) => truncateLookupDisplay(formatSinglesStatusLabel(row.status)))
    ],
    [
      SOFT_RESET_LABEL,
      ...rows.map((row) => (isAdminSinglesLookupRow(row) ? '' : SOFT_RESET_LABEL))
    ],
    [
      HARD_RESET_LABEL,
      ...rows.map((row) => (isAdminSinglesLookupRow(row) ? '' : HARD_RESET_LABEL))
    ],
    [
      LOGIN_RESET_LABEL,
      ...rows.map((row) => (isAdminSinglesLookupRow(row) ? '' : LOGIN_RESET_LABEL))
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

const FROZEN_EDGE_STORAGE_KEY = 'adminToolsLookupFrozenEdgeDeltaPx_v1';
const FROZEN_EDGE_MIN_COLUMN_PX = 60;
const FROZEN_EDGE_MAX_DELTA_PX = 1200;

function readStoredFrozenEdgeDeltaPx() {
  if (typeof window === 'undefined') return 0;
  const n = Math.trunc(Number(window.localStorage.getItem(FROZEN_EDGE_STORAGE_KEY)));
  return Number.isFinite(n) ? n : 0;
}

const FROZEN_EDGE_COLOR = 'var(--theme-yellow-color, #FFEB3B)';

/** Drag handle on the right edge of the last frozen column (Email): yellow double line, ↔ arrow in header; double-click resets. */
function FrozenEdgeDragHandle({ onPointerDown, onReset, showArrow = false }) {
  return (
    <Box
      role="separator"
      aria-orientation="vertical"
      title="Drag left / right to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onReset();
      }}
      onClick={(e) => e.stopPropagation()}
      sx={{
        display: { xs: 'none', sm: 'flex' },
        alignItems: 'center',
        justifyContent: 'flex-end',
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        width: showArrow ? 26 : 10,
        cursor: 'col-resize',
        touchAction: 'none',
        zIndex: 20,
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 1,
          width: 5,
          borderLeft: `1.5px solid ${FROZEN_EDGE_COLOR}`,
          borderRight: `1.5px solid ${FROZEN_EDGE_COLOR}`,
          boxSizing: 'border-box',
          opacity: 0.85
        },
        '&:hover::after': { opacity: 1, bgcolor: 'rgba(255,235,59,0.35)' }
      }}
    >
      {showArrow ? (
        <SwapHorizIcon sx={{ color: FROZEN_EDGE_COLOR, fontSize: 20, mr: '7px', pointerEvents: 'none' }} />
      ) : null}
    </Box>
  );
}

/** Text columns admins can double-click to edit (row key → set-fields body key). */
const INLINE_EDIT_FIELDS = ['alias', 'email', 'phone', 'memberId', 'myReferCode', 'referByCode'];

function savedInlineFieldsFromRow(row) {
  return {
    alias: String(row.alias ?? ''),
    email: String(row.email ?? ''),
    phone: String(row.phone ?? ''),
    memberId: row.memberId != null ? String(row.memberId) : '',
    myReferCode: String(row.myReferCode ?? ''),
    referByCode: String(row.referByCode ?? '')
  };
}

const inlineEditFieldSx = {
  ...inputFieldSx,
  width: '100%',
  minWidth: 0,
  '& .MuiInputBase-input': {
    ...inputFieldSx['& .MuiInputBase-input'],
    py: 0.5,
    px: 0.75
  }
};

const inlineEditedTextSx = { color: 'var(--theme-yellow-color, #FFEB3B)', fontStyle: 'italic', fontWeight: 700 };

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
  const theme = useTheme();
  const isSmUp = useMediaQuery(theme.breakpoints.up('sm'));
  const [singlesIdInput, setSinglesIdInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [aliasInput, setAliasInput] = useState('');
  const [memberIdInput, setMemberIdInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [memberCategoryInput, setMemberCategoryInput] = useState('');
  const [singlesRows, setSinglesRows] = useState([]);
  const [savedStatusById, setSavedStatusById] = useState({});
  const [savedMemberCategoryById, setSavedMemberCategoryById] = useState({});
  const [savedAccountBalanceTokenById, setSavedAccountBalanceTokenById] = useState({});
  const [savedInlineFieldsById, setSavedInlineFieldsById] = useState({});
  /** { id, field } of the cell currently in edit mode (double-click). */
  const [editingCell, setEditingCell] = useState(null);
  const [auditRows, setAuditRows] = useState([]);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupAllBusy, setLookupAllBusy] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [lastLookupWasAll, setLastLookupWasAll] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveResultPopup, setSaveResultPopup] = useState(null);
  const [softResetBusyById, setSoftResetBusyById] = useState({});
  const [hardResetBusyById, setHardResetBusyById] = useState({});
  const [pwdRetryResetBusyById, setPwdRetryResetBusyById] = useState({});
  const [cascadeDeleteBusyById, setCascadeDeleteBusyById] = useState({});
  const [lockTutaNotesBusyById, setLockTutaNotesBusyById] = useState({});
  const [lockTutaPhotosBusyById, setLockTutaPhotosBusyById] = useState({});
  const [playerVideoUrl, setPlayerVideoUrl] = useState('');
  const [playerVideoLabel, setPlayerVideoLabel] = useState('');
  const [playerVideoLoading, setPlayerVideoLoading] = useState(false);
  const [playerVideoError, setPlayerVideoError] = useState('');
  const [tableSort, setTableSort] = useState(DEFAULT_SINGLES_TABLE_SORT);
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
  const singlesColumnButtons = useMemo(() => buildSinglesLookupColumnButtons(), []);
  const displaySinglesRows = useMemo(
    () => sortSinglesLookupRows(singlesRows, tableSort),
    [singlesRows, tableSort]
  );
  const auditColumnTexts = useMemo(() => buildAuditLookupColumnTexts(auditRows), [auditRows]);

  /** Alias / singles_id / member_id / Email: asc → desc → created_at default. */
  const handleCycleColumnSort = useCallback((key) => {
    setTableSort((prev) => {
      if (prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return DEFAULT_SINGLES_TABLE_SORT;
    });
  }, []);

  const handleToggleVideoAgeSort = useCallback(() => {
    setTableSort((prev) => {
      if (prev.key !== 'videoAge') return { key: 'videoAge', dir: 'asc' };
      return { key: 'videoAge', dir: prev.dir === 'asc' ? 'desc' : 'asc' };
    });
  }, []);

  const {
    columnWidthsPx: singlesAutoColumnWidthsPx
  } = useColorTemplate9AutoFitColumnWidths({
      columnTexts: singlesColumnTexts,
      columnButtons: singlesColumnButtons,
      minWidthsPx: MIN_SINGLES_COLUMN_WIDTHS_PX,
      maxMeasureChars: LOOKUP_COLUMN_DISPLAY_CHARS,
      enabled: singlesRows.length > 0
    });

  const [frozenEdgeDeltaPx, setFrozenEdgeDeltaPx] = useState(readStoredFrozenEdgeDeltaPx);
  const frozenEdgeAutoWidthPx = Number(singlesAutoColumnWidthsPx[SINGLES_FROZEN_COLUMN_COUNT - 1]) || 0;
  const singlesTableColumnWidthsPx = useMemo(() => {
    const widths = [...singlesAutoColumnWidthsPx];
    const index = SINGLES_FROZEN_COLUMN_COUNT - 1;
    widths[index] = Math.max(FROZEN_EDGE_MIN_COLUMN_PX, Math.trunc(frozenEdgeAutoWidthPx + frozenEdgeDeltaPx));
    return widths;
  }, [frozenEdgeAutoWidthPx, frozenEdgeDeltaPx, singlesAutoColumnWidthsPx]);
  const singlesTableGridSx = useMemo(
    () => buildColorTemplate9AutoFitGridTemplateColumns(singlesTableColumnWidthsPx),
    [singlesTableColumnWidthsPx]
  );
  const singlesTableMinWidthPx = useMemo(
    () => sumColorTemplate9AutoFitColumnWidths(singlesTableColumnWidthsPx),
    [singlesTableColumnWidthsPx]
  );

  const handleFrozenEdgePointerDown = useCallback(
    (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startDelta = frozenEdgeDeltaPx;
      const minDelta = FROZEN_EDGE_MIN_COLUMN_PX - frozenEdgeAutoWidthPx;
      let latest = startDelta;
      const prevCursor = document.body.style.cursor;
      const prevUserSelect = document.body.style.userSelect;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      const onMove = (moveEvent) => {
        latest = Math.min(FROZEN_EDGE_MAX_DELTA_PX, Math.max(minDelta, Math.trunc(startDelta + moveEvent.clientX - startX)));
        setFrozenEdgeDeltaPx(latest);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = prevUserSelect;
        try {
          window.localStorage.setItem(FROZEN_EDGE_STORAGE_KEY, String(latest));
        } catch {
          // ignore quota / private mode
        }
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [frozenEdgeAutoWidthPx, frozenEdgeDeltaPx]
  );

  const handleFrozenEdgeReset = useCallback(() => {
    setFrozenEdgeDeltaPx(0);
    try {
      window.localStorage.removeItem(FROZEN_EDGE_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

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
    const savedInlineFields = {};
    for (const row of rows) {
      if (row?.singlesId != null) {
        savedInlineFields[row.singlesId] = savedInlineFieldsFromRow(row);
        savedStatus[row.singlesId] = String(row.status ?? 'blank');
        savedMemberCategory[row.singlesId] = String(row.memberCategory ?? 'PUBLIC');
        savedAccountBalanceToken[row.singlesId] = parseTokenBalanceValue(row.accountBalanceToken);
      }
    }
    setSavedStatusById(savedStatus);
    setSavedMemberCategoryById(savedMemberCategory);
    setSavedAccountBalanceTokenById(savedAccountBalanceToken);
    setSavedInlineFieldsById(savedInlineFields);
    setEditingCell(null);
  }, []);

  const lookupPayload = useCallback(
    () => ({
      singlesId: String(singlesIdInput ?? '').trim() || undefined,
      email: String(emailInput ?? '').trim() || undefined,
      alias: String(aliasInput ?? '').trim() || undefined,
      memberId: String(memberIdInput ?? '').trim() || undefined,
      phone: String(phoneInput ?? '').trim() || undefined,
      memberCategory: memberCategoryInput || undefined
    }),
    [aliasInput, emailInput, memberCategoryInput, memberIdInput, phoneInput, singlesIdInput]
  );

  const applySinglesLookupResult = useCallback((rows, { populateFields = true } = {}) => {
    setSinglesRows(rows);
    syncSavedFields(rows);
    if (populateFields && rows[0]) {
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
    const payload = lookupPayload();
    const data = await fetchAdminAuditRegistrationLookup(payload);
    const rows = Array.isArray(data?.singlesRows) ? data.singlesRows : [];
    const categoryOnly =
      Boolean(payload.memberCategory) && !payload.singlesId && !payload.email && !payload.alias && !payload.memberId && !payload.phone;
    applySinglesLookupResult(rows, { populateFields: !categoryOnly });
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
    if (!hasLookupInput({ singlesIdInput, emailInput, aliasInput, memberIdInput, phoneInput, memberCategoryInput })) {
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
  }, [aliasInput, emailInput, memberCategoryInput, memberIdInput, onError, phoneInput, runLookup, singlesIdInput]);

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
    setMemberCategoryInput('');
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

  const handleClearLockTutaNotes = useCallback(
    async (row) => {
      const id = Number(row?.singlesId);
      if (!Number.isFinite(id) || id < 1 || isAdminSinglesLookupRow(row) || lockTutaNotesBusyById[id]) {
        return;
      }
      const ok = await themedConfirm(
        `Clear TutaNotes lock for singles_id ${id} (${row.alias || row.email || 'member'})?\n\nThey can try Encrypt Password again.`
      );
      if (!ok) return;
      setLockTutaNotesBusyById((prev) => ({ ...prev, [id]: true }));
      onError?.('');
      try {
        await clearAdminLockTutaNotes({ singlesId: id });
        setSinglesRows((prev) =>
          prev.map((entry) => (entry.singlesId === id ? { ...entry, lockTutaNotes: false } : entry))
        );
      } catch (err) {
        onError?.(err?.response?.data?.error || err?.message || 'Failed to clear TutaNotes lock.');
      } finally {
        setLockTutaNotesBusyById((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [lockTutaNotesBusyById, onError]
  );

  const handleClearLockTutaPhotos = useCallback(
    async (row) => {
      const id = Number(row?.singlesId);
      if (!Number.isFinite(id) || id < 1 || isAdminSinglesLookupRow(row) || lockTutaPhotosBusyById[id]) {
        return;
      }
      const ok = await themedConfirm(
        `Clear TutaPhotos lock for singles_id ${id} (${row.alias || row.email || 'member'})?\n\nThey can try Encrypt Password again.`
      );
      if (!ok) return;
      setLockTutaPhotosBusyById((prev) => ({ ...prev, [id]: true }));
      onError?.('');
      try {
        await clearAdminLockTutaPhotos({ singlesId: id });
        setSinglesRows((prev) =>
          prev.map((entry) => (entry.singlesId === id ? { ...entry, lockTutaPhotos: false } : entry))
        );
      } catch (err) {
        onError?.(err?.response?.data?.error || err?.message || 'Failed to clear TutaPhotos lock.');
      } finally {
        setLockTutaPhotosBusyById((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [lockTutaPhotosBusyById, onError]
  );

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
          parseTokenBalanceValue(savedAccountBalanceTokenById[id] ?? 0) ||
        INLINE_EDIT_FIELDS.some(
          (field) => String(row[field] ?? '') !== String(savedInlineFieldsById[id]?.[field] ?? '')
        )
      );
    },
    [savedAccountBalanceTokenById, savedInlineFieldsById, savedMemberCategoryById, savedStatusById]
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
        const changedFields = {};
        for (const field of INLINE_EDIT_FIELDS) {
          const next = String(row[field] ?? '');
          if (next !== String(savedInlineFieldsById[row.singlesId]?.[field] ?? '')) changedFields[field] = next.trim();
        }
        if (Object.keys(changedFields).length) {
          try {
            await saveAdminSinglesFields({ singlesId: row.singlesId, ...changedFields });
          } catch (err) {
            const reason = err?.response?.data?.error || err?.message || 'Failed to save';
            throw new Error(`${row.alias || row.email || `singles_id ${row.singlesId}`}: ${reason}`);
          }
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
    savedInlineFieldsById,
    savedMemberCategoryById,
    savedStatusById,
    singlesRows
  ]);

  const startCellEdit = useCallback(
    (row, field) => {
      if (isAdminSinglesLookupRow(row) || row?.singlesId == null || saveBusy || listBusy) return;
      setEditingCell({ id: row.singlesId, field });
    },
    [listBusy, saveBusy]
  );

  const setRowField = useCallback((id, field, value) => {
    setSinglesRows((prev) => prev.map((entry) => (entry.singlesId === id ? { ...entry, [field]: value } : entry)));
  }, []);

  const revertCellEdit = useCallback(
    (id, field) => {
      const saved =
        field === 'memberCategory'
          ? String(savedMemberCategoryById[id] ?? 'PUBLIC')
          : String(savedInlineFieldsById[id]?.[field] ?? '');
      setRowField(id, field, saved);
      setEditingCell(null);
    },
    [savedInlineFieldsById, savedMemberCategoryById, setRowField]
  );

  /** Display text, or an input / Category select while that cell is in edit mode. */
  const renderEditableCellContent = (row, field, displayText, textProps = {}) => {
    const id = row.singlesId;
    const editing = editingCell?.id === id && editingCell?.field === field;
    if (editing && field === 'memberCategory') {
      return (
        <TextField
          select
          size="small"
          autoFocus
          value={String(row.memberCategory ?? 'PUBLIC')}
          onChange={(e) => {
            setRowField(id, 'memberCategory', e.target.value);
            setEditingCell(null);
          }}
          SelectProps={{ defaultOpen: true, onClose: () => setEditingCell(null) }}
          sx={inlineEditFieldSx}
        >
          {MEMBER_CATEGORY_VALUES.map((value) => (
            <MenuItem key={value} value={value}>
              {value}
            </MenuItem>
          ))}
        </TextField>
      );
    }
    if (editing) {
      return (
        <TextField
          size="small"
          autoFocus
          value={String(row[field] ?? '')}
          onChange={(e) => setRowField(id, field, e.target.value)}
          onBlur={() => setEditingCell(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setEditingCell(null);
            if (e.key === 'Escape') revertCellEdit(id, field);
          }}
          onFocus={(e) => e.target.select()}
          inputProps={{ 'aria-label': `Edit ${field} for singles_id ${id}` }}
          sx={inlineEditFieldSx}
        />
      );
    }
    const changed =
      field === 'memberCategory'
        ? String(row.memberCategory ?? 'PUBLIC') !== String(savedMemberCategoryById[id] ?? 'PUBLIC')
        : String(row[field] ?? '') !== String(savedInlineFieldsById[id]?.[field] ?? '');
    const editable = !isAdminSinglesLookupRow(row);
    return (
      <ColorTemplate9TableData.BodyText
        {...textProps}
        sx={{ ...lookupBodyTextSx, ...(changed ? inlineEditedTextSx : null), ...(editable ? { cursor: 'text' } : null) }}
        title={editable ? `${textProps.title ? `${textProps.title} · ` : ''}Double-click to edit` : textProps.title}
      >
        {displayText}
      </ColorTemplate9TableData.BodyText>
    );
  };

  /** Rendered above and below the singles table so long lists can be saved without scrolling. */
  const singlesSaveButton = (
    <SelectedButtonTemplate
      type="button"
      disabled={!hasUnsavedStatusChanges || saveBusy || listBusy}
      onClick={() => void handleSaveStatus()}
    >
      {saveBusy ? 'Saving…' : 'Save'}
    </SelectedButtonTemplate>
  );

  const handleSoftResetMember = useCallback(
    async (row) => {
      if (isAdminSinglesLookupRow(row)) return;
      const id = Number(row?.singlesId);
      if (!Number.isFinite(id) || id < 1 || softResetBusyById[id] || hardResetBusyById[id] || saveBusy || listBusy) {
        return;
      }

      const parts = [`singles_id ${id}`];
      if (row?.alias) parts.push(`alias ${row.alias}`);
      if (row?.email) parts.push(`email ${row.email}`);

      if (
        !(await themedConfirm(
          `Default Reset ${parts.join(', ')}?\n\nRe-applies new-member defaults (demo buddies/requests).\nReplaces Monthly/Yearly bill schedule with SAMPLE defaults (existing bill rows for this member are deleted first).\nDoes NOT delete user photos, postings, bios, custom albums, or custom notes.`
        ))
      ) {
        return;
      }

      setSoftResetBusyById((prev) => ({ ...prev, [id]: true }));
      onError?.('');
      try {
        await softResetAdminMemberAccount({ singlesId: id });
        setSaveResultPopup({
          kind: 'ok',
          message: `Default Reset complete for singles_id ${id}. Defaults re-applied; user content kept.`
        });
      } catch (err) {
        const message = err?.response?.data?.error || err?.message || 'Failed to soft-reset member account';
        onError?.(message);
        setSaveResultPopup({ kind: 'error', message });
      } finally {
        setSoftResetBusyById((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [hardResetBusyById, listBusy, onError, saveBusy, softResetBusyById]
  );

  const handleHardResetMember = useCallback(
    async (row) => {
      if (isAdminSinglesLookupRow(row)) return;
      const id = Number(row?.singlesId);
      if (!Number.isFinite(id) || id < 1 || hardResetBusyById[id] || softResetBusyById[id] || saveBusy || listBusy) {
        return;
      }

      const parts = [`singles_id ${id}`];
      if (row?.alias) parts.push(`alias ${row.alias}`);
      if (row?.email) parts.push(`email ${row.email}`);

      if (
        !(await themedConfirm(
          `Factory Reset ${parts.join(', ')}?\n\nDeletes user photos, postings, bios, bill rows, and requests, then re-applies new-member defaults.\nAlso removes this member's mobile uploads from storage: mobile_upload, Tuta Dates photos/videos, OneDrive staging, notes, and that member's TutaNotes / TutaPhotoAlbums folders.`
        ))
      ) {
        return;
      }

      setHardResetBusyById((prev) => ({ ...prev, [id]: true }));
      onError?.('');
      try {
        await hardResetAdminMemberAccount({ singlesId: id });
        setSaveResultPopup({
          kind: 'ok',
          message: `Factory Reset complete for singles_id ${id}. User content wiped and defaults re-applied.`
        });
        await runLookup();
      } catch (err) {
        const message = err?.response?.data?.error || err?.message || 'Failed to hard-reset member account';
        onError?.(message);
        setSaveResultPopup({ kind: 'error', message });
      } finally {
        setHardResetBusyById((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [hardResetBusyById, listBusy, onError, runLookup, saveBusy, softResetBusyById]
  );

  const handleResetLoginAttempts = useCallback(
    async (row) => {
      if (isAdminSinglesLookupRow(row)) return;
      const id = Number(row?.singlesId);
      if (!Number.isFinite(id) || id < 1 || pwdRetryResetBusyById[id] || saveBusy || listBusy) return;

      const parts = [`singles_id ${id}`];
      if (row?.alias) parts.push(`alias ${row.alias}`);
      if (row?.email) parts.push(`email ${row.email}`);
      const currentCount = Number(row?.passwordAttemptCount ?? 0);

      if (
        !(await themedConfirm(
          `Login # Reset ${parts.join(', ')}?\n\nCurrent login attempt count: ${currentCount}.\nResets it to 0 so the member can try logging in again (max 3 attempts per 24 hours).`
        ))
      ) {
        return;
      }

      setPwdRetryResetBusyById((prev) => ({ ...prev, [id]: true }));
      onError?.('');
      try {
        const result = await resetAdminPasswordAttemptCount({ singlesId: id });
        const nextCount = Number(result?.passwordAttemptCount ?? 0);
        setSinglesRows((prev) =>
          prev.map((entry) => (entry.singlesId === id ? { ...entry, passwordAttemptCount: nextCount } : entry))
        );
        setSaveResultPopup({
          kind: 'ok',
          message: `Login # Reset complete for singles_id ${id}. Login attempt count is now ${nextCount}.`
        });
      } catch (err) {
        const message = err?.response?.data?.error || err?.message || 'Failed to reset login attempt count';
        onError?.(message);
        setSaveResultPopup({ kind: 'error', message });
      } finally {
        setPwdRetryResetBusyById((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [listBusy, onError, pwdRetryResetBusyById, saveBusy]
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

  const hasInput = hasLookupInput({ singlesIdInput, emailInput, aliasInput, memberIdInput, phoneInput, memberCategoryInput });

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

          <Typography sx={bigOrSx} aria-hidden>
            OR
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: '1 1 160px', minWidth: 0 }}>
            <Typography sx={labelSx}>Category:</Typography>
            <TextField
              select
              value={memberCategoryInput}
              onChange={(e) => setMemberCategoryInput(e.target.value)}
              size="small"
              fullWidth
              sx={inputFieldSx}
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">
                <em>Any</em>
              </MenuItem>
              {MEMBER_CATEGORY_VALUES.map((value) => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              ))}
            </TextField>
          </Box>
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
            {singlesRows.length > 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5, mb: 1 }}>{singlesSaveButton}</Box>
            ) : null}
            {singlesRows.length === 0 ? (
              <ColorTemplate9TableData.EmptyText>No matching singles rows found.</ColorTemplate9TableData.EmptyText>
            ) : (
              <ColorTemplate9TableData.Table
                topHorizontalScrollbar
                autoFitColumns
                minTableWidth={singlesTableMinWidthPx}
                frozenColumnCount={isSmUp ? SINGLES_FROZEN_COLUMN_COUNT : 0}
                frozenColumnWidthsPx={singlesTableColumnWidthsPx}
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
                    columnIndex={SINGLES_COL.CATEGORY}
                    sx={{ display: { xs: 'none', sm: 'flex' }, ...lookupScrollHeaderCellSx }}
                    title="singles.member_category"
                  >
                    Category
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell
                    columnIndex={SINGLES_COL.ALIAS}
                    sx={{ display: { xs: 'none', sm: 'flex' }, ...lookupColumnSortHeaderSx }}
                    onClick={() => handleCycleColumnSort('alias')}
                    role="columnheader"
                    aria-sort={columnSortAria(tableSort, 'alias')}
                  >
                    {columnSortHeaderLabel('Alias', tableSort, 'alias')}
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell
                    columnIndex={SINGLES_COL.EMAIL}
                    sx={lookupColumnSortHeaderSx}
                    onClick={() => handleCycleColumnSort('email')}
                    role="columnheader"
                    aria-sort={columnSortAria(tableSort, 'email')}
                  >
                    {columnSortHeaderLabel('Email', tableSort, 'email')}
                    <FrozenEdgeDragHandle showArrow onPointerDown={handleFrozenEdgePointerDown} onReset={handleFrozenEdgeReset} />
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell
                    columnIndex={SINGLES_COL.SINGLES_ID}
                    sx={{ ...lookupCenterColumnCellSx, ...lookupColumnSortHeaderSx }}
                    onClick={() => handleCycleColumnSort('singlesId')}
                    role="columnheader"
                    aria-sort={columnSortAria(tableSort, 'singlesId')}
                  >
                    {columnSortHeaderLabel('singles_id', tableSort, 'singlesId')}
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell
                    columnIndex={SINGLES_COL.MEMBER_ID}
                    sx={{ display: { xs: 'none', sm: 'flex' }, ...lookupColumnSortHeaderSx }}
                    onClick={() => handleCycleColumnSort('memberId')}
                    role="columnheader"
                    aria-sort={columnSortAria(tableSort, 'memberId')}
                  >
                    {columnSortHeaderLabel('member_id', tableSort, 'memberId')}
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell
                    columnIndex={SINGLES_COL.CASCADE_DELETE}
                    sx={{ justifyContent: 'center', ...lookupHalfHeaderCellSx }}
                  >
                    {CASCADE_DELETE_LABEL}
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell
                    columnIndex={SINGLES_COL.IMPERSONATE}
                    sx={{ display: { xs: 'none', sm: 'flex' }, justifyContent: 'center', ...lookupHalfHeaderCellSx }}
                  >
                    Impersonate
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
                  <ColorTemplate9TableData.HeaderCell
                    columnIndex={SINGLES_COL.STATUS}
                    sx={{ display: { xs: 'none', sm: 'flex' }, ...lookupHalfHeaderCellSx }}
                  >
                    status
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell
                    columnIndex={SINGLES_COL.RESET}
                    sx={{ display: { xs: 'none', sm: 'flex' }, justifyContent: 'center', ...lookupHalfHeaderCellSx }}
                    title="Re-apply new-member defaults without deleting user content"
                  >
                    {SOFT_RESET_LABEL}
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell
                    columnIndex={SINGLES_COL.HARD_RESET}
                    sx={{ display: { xs: 'none', sm: 'flex' }, justifyContent: 'center', ...lookupHalfHeaderCellSx }}
                    title="Cascade-delete user content, then re-apply new-member defaults"
                  >
                    {HARD_RESET_LABEL}
                  </ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.HeaderCell
                    columnIndex={SINGLES_COL.LOGIN_RESET}
                    sx={{ display: { xs: 'none', sm: 'flex' }, justifyContent: 'center', ...lookupHalfHeaderCellSx }}
                    title="Reset login attempt count to 0 (max 3 per 24 hours)"
                  >
                    {LOGIN_RESET_LABEL}
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
                    aria-sort={columnSortAria(tableSort, 'videoAge')}
                  >
                    {tableSort.key === 'videoAge'
                      ? `Age ${tableSort.dir === 'asc' ? '↑' : '↓'}`
                      : 'Age'}
                  </ColorTemplate9TableData.HeaderCell>
                </ColorTemplate9TableData.HeaderRow>

                {displaySinglesRows.map((row, index) => {
                  const softResetBusy = Boolean(softResetBusyById[row.singlesId]);
                  const hardResetBusy = Boolean(hardResetBusyById[row.singlesId]);
                  const cascadeDeleteBusy = Boolean(cascadeDeleteBusyById[row.singlesId]);
                  const lockTutaNotesBusy = Boolean(lockTutaNotesBusyById[row.singlesId]);
                  const lockTutaPhotosBusy = Boolean(lockTutaPhotosBusyById[row.singlesId]);
                  const pwdRetryCount = Number(row.passwordAttemptCount ?? 0);
                  const pwdRetryResetBusy = Boolean(pwdRetryResetBusyById[row.singlesId]);
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
                      columnIndex={SINGLES_COL.CATEGORY}
                      sx={{ display: { xs: 'none', sm: 'flex' } }}
                      onDoubleClick={() => startCellEdit(row, 'memberCategory')}
                    >
                      {renderEditableCellContent(
                        row,
                        'memberCategory',
                        truncateLookupDisplay(formatMemberCategoryLabel(row.memberCategory))
                      )}
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell
                      columnIndex={SINGLES_COL.ALIAS}
                      sx={{ display: { xs: 'none', sm: 'flex' } }}
                      onDoubleClick={() => startCellEdit(row, 'alias')}
                    >
                      {renderEditableCellContent(row, 'alias', truncateLookupDisplay(row.alias || '—'))}
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell
                      columnIndex={SINGLES_COL.EMAIL}
                      onDoubleClick={() => startCellEdit(row, 'email')}
                    >
                      <FrozenEdgeDragHandle onPointerDown={handleFrozenEdgePointerDown} onReset={handleFrozenEdgeReset} />
                      {renderEditableCellContent(row, 'email', truncateLookupDisplay(row.email || '—'), {
                        title: row.email || undefined
                      })}
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
                        {row.lockTutaNotes ? ' · TutaNotes LOCKED' : ''}
                        {row.lockTutaPhotos ? ' · TutaPhotos LOCKED' : ''}
                        {row.myReferCode ? ` · my refer ${row.myReferCode}` : ''}
                        {row.referByCode ? ` · refer by ${formatReferByDisplay(row)}` : ''}
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
                      onDoubleClick={() => startCellEdit(row, 'memberId')}
                    >
                      {renderEditableCellContent(row, 'memberId', row.memberId === '' || row.memberId == null ? '—' : row.memberId)}
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell sx={{ justifyContent: 'center' }}>
                      {isAdminSinglesLookupRow(row) ? null : (
                        <SelectedButtonTemplate
                          type="button"
                          disabled={row.protectedAccount || cascadeDeleteBusy || softResetBusy || hardResetBusy || saveBusy || listBusy}
                          title={row.protectedAccount ? PROTECTED_ACCOUNT_TITLE : undefined}
                          onClick={() => void handleCascadeDeleteSingles(row)}
                          sx={protectedAccountButtonSx}
                        >
                          {cascadeDeleteBusy ? 'Deleting…' : CASCADE_DELETE_LABEL}
                        </SelectedButtonTemplate>
                      )}
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
                      onDoubleClick={() => startCellEdit(row, 'phone')}
                    >
                      {renderEditableCellContent(row, 'phone', truncateLookupDisplay(row.phone || '—'), {
                        title: row.phone || undefined
                      })}
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell
                      columnIndex={SINGLES_COL.STATUS}
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}
                    >
                      {isAdminSinglesLookupRow(row) ? (
                        <ColorTemplate9TableData.BodyText sx={{ ...lookupBodyTextSx, zoom: LOOKUP_BUTTON_ZOOM }}>
                          {formatSinglesStatusLabel(row.status)}
                          {row.over18Verified === true ? ' · 18+' : ''}
                        </ColorTemplate9TableData.BodyText>
                      ) : (
                        <>
                          {row.lockTutaNotes ? (
                            <SelectedButtonTemplate
                              type="button"
                              disabled={lockTutaNotesBusy || saveBusy || listBusy}
                              onClick={() => void handleClearLockTutaNotes(row)}
                              sx={{ ...lookupHalfButtonSx, width: '100%' }}
                            >
                              {lockTutaNotesBusy ? 'Unlocking…' : 'Unlock TutaNotes'}
                            </SelectedButtonTemplate>
                          ) : null}
                          {row.lockTutaPhotos ? (
                            <SelectedButtonTemplate
                              type="button"
                              disabled={lockTutaPhotosBusy || saveBusy || listBusy}
                              onClick={() => void handleClearLockTutaPhotos(row)}
                              sx={{ ...lookupHalfButtonSx, width: '100%' }}
                            >
                              {lockTutaPhotosBusy ? 'Unlocking…' : 'Unlock TutaPhotos'}
                            </SelectedButtonTemplate>
                          ) : null}
                          <SelectedButtonTemplate
                            type="button"
                            disabled={saveBusy}
                            onClick={() => handleCycleStatus(row.singlesId)}
                            sx={lookupHalfButtonSx}
                          >
                            {formatSinglesStatusLabel(row.status)}
                          </SelectedButtonTemplate>
                          {row.over18Verified === true ? (
                            <ColorTemplate9TableData.BodyText sx={{ ...lookupBodyTextSx, fontWeight: 700, mb: 0, zoom: LOOKUP_BUTTON_ZOOM }}>
                              18+
                            </ColorTemplate9TableData.BodyText>
                          ) : null}
                        </>
                      )}
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell
                      columnIndex={SINGLES_COL.RESET}
                      sx={{ display: { xs: 'none', sm: 'flex' }, justifyContent: 'center' }}
                    >
                      {isAdminSinglesLookupRow(row) ? null : (
                        <SelectedButtonTemplate
                          type="button"
                          disabled={row.protectedAccount || softResetBusy || hardResetBusy || cascadeDeleteBusy || saveBusy || listBusy}
                          title={row.protectedAccount ? PROTECTED_ACCOUNT_TITLE : undefined}
                          onClick={() => void handleSoftResetMember(row)}
                          sx={protectedAccountButtonSx}
                        >
                          {softResetBusy ? '…' : SOFT_RESET_LABEL}
                        </SelectedButtonTemplate>
                      )}
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell
                      columnIndex={SINGLES_COL.HARD_RESET}
                      sx={{ display: { xs: 'none', sm: 'flex' }, justifyContent: 'center' }}
                    >
                      {isAdminSinglesLookupRow(row) ? null : (
                        <SelectedButtonTemplate
                          type="button"
                          disabled={row.protectedAccount || hardResetBusy || softResetBusy || cascadeDeleteBusy || saveBusy || listBusy}
                          title={row.protectedAccount ? PROTECTED_ACCOUNT_TITLE : undefined}
                          onClick={() => void handleHardResetMember(row)}
                          sx={protectedAccountButtonSx}
                        >
                          {hardResetBusy ? '…' : HARD_RESET_LABEL}
                        </SelectedButtonTemplate>
                      )}
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell
                      columnIndex={SINGLES_COL.LOGIN_RESET}
                      sx={{ display: { xs: 'none', sm: 'flex' }, justifyContent: 'center' }}
                    >
                      {isAdminSinglesLookupRow(row) ? null : (
                        <SelectedButtonTemplate
                          type="button"
                          disabled={row.protectedAccount || pwdRetryResetBusy || hardResetBusy || cascadeDeleteBusy || saveBusy || listBusy}
                          onClick={() => void handleResetLoginAttempts(row)}
                          title={row.protectedAccount ? PROTECTED_ACCOUNT_TITLE : `Current login attempt count: ${pwdRetryCount}`}
                          sx={protectedAccountButtonSx}
                        >
                          {pwdRetryResetBusy ? '…' : LOGIN_RESET_LABEL}
                        </SelectedButtonTemplate>
                      )}
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell
                      sx={{ display: { xs: 'none', sm: 'flex' } }}
                      onDoubleClick={() => startCellEdit(row, 'myReferCode')}
                    >
                      {renderEditableCellContent(row, 'myReferCode', truncateLookupDisplay(row.myReferCode || '—'), {
                        title: row.myReferCode || undefined
                      })}
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell
                      sx={{ display: { xs: 'none', sm: 'flex' } }}
                      onDoubleClick={() => startCellEdit(row, 'referByCode')}
                    >
                      {renderEditableCellContent(row, 'referByCode', truncateLookupDisplay(formatReferByDisplay(row)), {
                        title: formatReferByDisplay(row) !== '—' ? formatReferByDisplay(row) : undefined
                      })}
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

          <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5, mb: 2, pb: 2 }}>{singlesSaveButton}</Box>

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
