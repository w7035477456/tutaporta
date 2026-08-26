import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SliderControlButton, {
  SLIDER_CONTROL_BUTTON_HOVER_SCALE_15,
  SLIDER_CONTROL_BUTTON_HOVER_SCALE_50
} from 'ui-component/SliderControlButton';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import {
  isRecordVaultUsbRequiredError,
  fetchRecordVaultStorageConfig,
  fetchRecordVaultOneDriveConfig,
  fetchRecordVaultUsbStatus,
  fetchRecordVaultUsbLocations,
  fetchRecordVaultOneDriveStatus,
  rememberRecordVaultOneDriveEmail,
  probeRecordVaultBridge,
  setRecordVaultBridgeSinglesId,
  setRecordVaultBridgeStorageType,
  readRecordVaultApiError,
  readFileAsDataUrl,
  createRecordVaultPaneApi
} from 'api/recordVaultFe';
import { useAuth } from 'contexts/AuthContext';
import { themedConfirm } from 'utils/themedDialog';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';
import { fetchUploadLimits } from 'api/myPhotosFe';
import {
  isAllowedRecordVaultFile,
  recordVaultUploadFileName
} from 'utils/recordVaultFileFormats';
import RecordVaultSearchBar from './RecordVaultSearchBar';
import {
  recordVaultMenuButtonFontRemFromTenths,
} from 'config/recordVaultMenuButtonFontEnv';
import { getVaultDefaultButtonFontSizeRem } from 'config/vaultDefaultButtonFontSizeEnv';
import { fetchUserCustomization, saveUserCustomization } from 'api/userCustomizationFe';
import { RecordVaultSliderControlButtonProvider } from './RecordVaultSliderControlButtonContext';
import { useRecordVaultPaneStorageType } from './RecordVaultPaneContext';
import BusyHourglassOverlay from 'ui-component/BusyHourglassOverlay';
import { BUSY_HOURGLASS_MY_NOTE_SIZE } from 'config/busyHourglassEnv';
import RecordVaultViewVaultDialog from './RecordVaultViewVaultDialog';
import RecordVaultOneDriveBackupDialog from './RecordVaultOneDriveBackupDialog';
import RecordVaultUsbBackupDialog from './RecordVaultUsbBackupDialog';
import RecordVaultStorageFilesPanel from './RecordVaultStorageFilesPanel';
import RecordVaultNoteEditor from './RecordVaultNoteEditor';
import BillScheduleMonthlyPanel from './BillScheduleMonthlyPanel';
import BillScheduleYearlyPanel from './BillScheduleYearlyPanel';
import {
  BILL_SCHEDULE_NOTEBOOK_ID,
  billScheduleCrossPaneKind,
  buildBillScheduleNotebook,
  isBillMonthlyNoteId,
  isBillScheduleCrossPaneKind,
  isBillScheduleNotebookId,
  isBillScheduleSystemId,
  isBillYearlyNoteId,
  isSelectableNoteId
} from './billScheduleConstants';
import RecordVaultNoteContentZoomBar, {
  NOTE_CONTENT_ZOOM_DEFAULT
} from './RecordVaultNoteContentZoomBar';
import RecordVaultFileMenu, {
  prepareImportedHtml,
  stripYamlFrontMatter,
  pdfArrayBufferToHtml,
  buildHtmlDocument,
  sanitizeRecordVaultExportFileName
} from './RecordVaultFileMenu';
import ProfilesRecordsPage from 'views/utilities/ProfilesRecordsPage';
import { PROFILES_RECORDS_PAYMENT_TABS } from 'constants/profilesRecordsRoute';
import RecordVaultMobileUploadDialog from './RecordVaultMobileUploadDialog';
import RecordVaultCrossPaneTransferDialog from './RecordVaultCrossPaneTransferDialog';
import api from 'api/axios';
import {
  clearActiveCrossPaneDrag,
  DRAG_CROSS_PANE,
  getActiveCrossPaneDrag,
  isForeignCrossPaneDrag,
  markCrossPaneDropConsumed,
  notifyRecordVaultTreeReload,
  RECORD_VAULT_TREE_RELOAD_EVENT,
  readCrossPaneDragFromEvent,
  serializeCrossPaneDrag,
  setActiveCrossPaneDrag,
  takeCrossPaneDropConsumed
} from './recordVaultCrossPaneDrag';
import { transferRecordVaultItem } from './recordVaultCrossPaneTransfer';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import VaultWorkspaceErrorPopup from 'ui-component/VaultWorkspaceErrorPopup';
import RecordVaultUsageBar from './RecordVaultUsageBar';
import { MY_NOTE_BACKGROUND_IMAGE } from 'config/recordVaultLayout';
import {
  RECORD_VAULT_DEFAULT_CONTENT_BG_INDEX,
  RECORD_VAULT_DEFAULT_FONT_SIZE_PT,
  RECORD_VAULT_DEFAULT_FONT_STYLE_INDEX,
  RECORD_VAULT_DEFAULT_MENU_BUTTON_FONT_SIZE_TENTHS,
  RECORD_VAULT_DEFAULT_TEXT_HIGHLIGHT_INDEX,
  RECORD_VAULT_FONT_STYLE_COUNT,
  normalizeRecordVaultFontSizePt,
} from './recordVaultNoteFontTokens';
import {
  getIndexedNoteText,
  indexNoteSearchText,
  removeNoteSearchIndex,
  searchIndexedNotes
} from './recordVaultSearchIndex';
import innerEncryptOnImg from 'assets/images/innerEncryptON.png';
import redLockImg from 'assets/images/redlock.png';
import greenUnlockImg from 'assets/images/unlockIcon.png';
import RecordVaultNoteInnerEncryptDialog from './RecordVaultNoteInnerEncryptDialog';
import RecordVaultCreateItemDialog from './RecordVaultCreateItemDialog';
import { LOCK_GIF_CYCLE_MS } from './RecordVaultEncryptDecryptVideoOverlay';
import {
  decryptRecordVaultNoteInnerBody,
  encryptRecordVaultNoteInnerBody,
  isRecordVaultInnerEncryptedBody,
  isValidInnerEncryptPin
} from 'utils/recordVaultNoteInnerCrypto';
import {
  INNER_UNLOCK_LOCKOUT_MS,
  clearPersistedInnerUnlockLockout,
  formatInnerUnlockLockoutLabel,
  persistInnerUnlockLockoutMs,
  remainingInnerUnlockLockoutSeconds,
  resolveInnerUnlockLockedUntilMs,
  wipeAllPersistedInnerUnlockPins
} from 'utils/recordVaultNoteInnerUnlockStorage';
import { tutaNotesStorageStripColor } from './tutaNotesBranding';
import {
  cleanRecordVaultNoteBodyHtml,
  recordVaultRichTextHasContent,
  stripRecordVaultHtml,
} from 'utils/recordVaultRichText';
import ThumbnailDeleteXButton from 'ui-component/ThumbnailDeleteXButton';
import {
  recordVaultNoteSidebarLabel,
  recordVaultNoteMenuLabel,
  recordVaultShortcutMenuLabel,
  recordVaultSearchResultTabLabel,
  resolveRecordVaultNoteTitle,
  formatDefaultRecordVaultNoteTitle,
  notebookNumberFromList,
  isDefaultStyleRecordVaultNoteTitle,
  isLegacyShortRecordVaultNoteName
} from 'utils/recordVaultNoteTitle';

const LAYOUT_LS_KEY = 'recordVaultMenuLayout_v2';
const NOTE_FONT_STYLE_LS_KEY = 'recordVaultNoteFontStyle_v1';
const NOTE_FONT_SIZE_PT_LS_KEY = 'recordVaultNoteFontSizePt_v1';
const DEFAULT_SIDEBAR_WIDTH = 380;
const DEFAULT_NOTEBOOK_COL_WIDTH = 168;
const DEFAULT_RIGHT_SIDEBAR_WIDTH = 200;
const MIN_SIDEBAR_WIDTH = 160;
/** No hard max — drag resize may use nearly the full viewport (leave a thin editor strip). */
const MAX_SIDEBAR_WIDTH = 100000;
const MIN_RIGHT_SIDEBAR_WIDTH = 96;
const MAX_RIGHT_SIDEBAR_WIDTH = 100000;
const MIN_MENU_COL_WIDTH = 96;
const MIN_EDITOR_STRIP_PX = 120;
const COLUMN_RESIZE_HANDLE_PX = 8;
const DEFAULT_SHORTCUT_PANE_PERCENT = 42;
const MIN_SHORTCUT_PANE_PERCENT = 15;
const MAX_SHORTCUT_PANE_PERCENT = 75;

function noteTitlePlainText(value) {
  return stripRecordVaultHtml(value).trim();
}

function resolveOpenNoteTitlePlain(note, notebooks, notesInNotebook) {
  return (
    noteTitlePlainText(resolveRecordVaultNoteTitle(note, notebooks, notesInNotebook)) ||
    recordVaultNoteSidebarLabel(note, notesInNotebook, notebooks)
  );
}

const DRAG_NOTEBOOK = 'application/x-record-vault-notebook-id';
const DRAG_NOTE = 'application/x-record-vault-note-id';
/** JSON array of note ids when Shift+multi-select drag moves/exports several notes. */
const DRAG_NOTE_IDS = 'application/x-record-vault-note-ids';
const DRAG_SHORTCUT = 'application/x-record-vault-shortcut-id';

function isHtmlImportFileName(name) {
  const n = String(name || '').toLowerCase();
  return n.endsWith('.html') || n.endsWith('.htm');
}

/** Read all entries from a DirectoryReader (Chrome batches them). */
function readAllDirectoryEntries(reader) {
  return new Promise((resolve, reject) => {
    const out = [];
    const pump = () => {
      reader.readEntries(
        (batch) => {
          if (!batch?.length) {
            resolve(out);
            return;
          }
          out.push(...batch);
          pump();
        },
        (err) => reject(err || new Error('Failed to read folder'))
      );
    };
    pump();
  });
}

function fileFromFileEntry(fileEntry) {
  return new Promise((resolve, reject) => {
    fileEntry.file(resolve, reject);
  });
}

/**
 * Collect top-level .html/.htm files inside a dropped directory entry
 * (matches notebook export layout: NotebookName/*.html).
 */
async function collectTopLevelHtmlFilesFromDirectoryEntry(dirEntry) {
  const reader = dirEntry.createReader();
  const entries = await readAllDirectoryEntries(reader);
  const files = [];
  for (const entry of entries) {
    if (!entry?.isFile || !isHtmlImportFileName(entry.name)) continue;
    // eslint-disable-next-line no-await-in-loop
    files.push(await fileFromFileEntry(entry));
  }
  return files;
}

/**
 * Parse OS folder drop(s) into { folderName, files: File[], sourceLabel }[].
 * Prefers webkitGetAsEntry directories; falls back to webkitRelativePath.
 */
async function parseFolderHtmlImportsFromDataTransfer(dataTransfer) {
  const items = dataTransfer?.items ? Array.from(dataTransfer.items) : [];
  const dirEntries = [];
  for (const item of items) {
    if (item.kind !== 'file') continue;
    const entry = item.webkitGetAsEntry?.();
    if (entry?.isDirectory) dirEntries.push(entry);
  }

  if (dirEntries.length) {
    const out = [];
    for (const dir of dirEntries) {
      // eslint-disable-next-line no-await-in-loop
      const files = await collectTopLevelHtmlFilesFromDirectoryEntry(dir);
      if (!files.length) continue;
      const folderName = String(dir.name || 'IMPORTED').trim() || 'IMPORTED';
      out.push({ folderName, files, sourceLabel: folderName });
    }
    return out;
  }

  // Fallback when the browser only exposes flattened files + relative paths.
  const fileList = Array.from(dataTransfer?.files || []);
  const grouped = new Map();
  for (const file of fileList) {
    const rel = String(file.webkitRelativePath || '');
    if (!rel.includes('/')) continue;
    if (!isHtmlImportFileName(file.name)) continue;
    const parts = rel.split('/').filter(Boolean);
    // Only NotebookName/file.html (not nested deeper).
    if (parts.length !== 2) continue;
    const folderName = parts[0];
    if (!grouped.has(folderName)) grouped.set(folderName, []);
    grouped.get(folderName).push(file);
  }
  return Array.from(grouped.entries()).map(([folderName, files]) => ({
    folderName,
    files,
    sourceLabel: folderName
  }));
}

/** True when the drag looks like an OS folder (directory entry or relative paths). */
function dataTransferLooksLikeFolderDrop(dataTransfer) {
  const items = dataTransfer?.items ? Array.from(dataTransfer.items) : [];
  for (const item of items) {
    if (item.kind !== 'file') continue;
    const entry = item.webkitGetAsEntry?.();
    if (entry?.isDirectory) return true;
  }
  const files = Array.from(dataTransfer?.files || []);
  return files.some((f) => String(f.webkitRelativePath || '').includes('/'));
}

/**
 * Names (notebook or note) must be unique across the ENTIRE vault, case-insensitive.
 * Every notebook name and note name is stored upper-cased, so any two names that
 * differ only by case collide.
 */
const DUPLICATE_NAME_MESSAGE = 'Name already exist, please select a different name (case insensitive)';

const myNoteBackgroundPanelSx = {
  backgroundImage: `url(${MY_NOTE_BACKGROUND_IMAGE})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  bgcolor: 'var(--theme-daynight-color)'
};

/** Slight dim so the colorful hourglass reads clearly over myNoteBackground.png. */
const myNoteLoadingBackdropSx = {
  ...myNoteBackgroundPanelSx,
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: 0,
    bgcolor: 'rgba(0,0,0,0.22)',
    pointerEvents: 'none'
  }
};

/** Log off Cloud/USB — solid dim so hourglass + % done are the focus (no cartoon splash). */
const vaultLeavingBackdropSx = {
  bgcolor: 'rgba(0, 0, 0, 0.72)',
  backgroundImage: 'none'
};

const headerToggleButtonSx = {
  width: 'max-content',
  minWidth: 'max-content',
  maxWidth: '100%',
  flexShrink: 0,
  whiteSpace: 'nowrap',
  px: { xs: 0.3, sm: 0.45 },
  py: { xs: 0.35, sm: 0.45 }
};

const headerFullWidthButtonSx = {
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'nowrap',
  px: { xs: 0.3, sm: 0.45 },
  py: { xs: 0.35, sm: 0.45 }
};

/** Keep sidebar lane action buttons inside the column border (compact single-line labels). */
const laneContainedButtonSx = {
  width: '100% !important',
  maxWidth: '100% !important',
  minWidth: '0 !important',
  alignSelf: 'stretch',
  boxSizing: 'border-box',
  flexShrink: 1,
  flexGrow: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  px: { xs: 0.25, sm: 0.35 },
  py: { xs: 0.25, sm: 0.3 },
  minHeight: 0,
  '& .MuiButton-label': {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'clip'
  },
  '@media (hover: hover)': {
    '&:hover:not(.Mui-disabled)': {
      transform: 'none !important',
      zIndex: 'auto !important'
    }
  }
};

/**
 * Narrow notebook/note columns — single-line Add Notebook / Add Note.
 * Hover scale (+25%) comes from SliderControlButton default (do not pass disableHoverScale).
 */
const laneContainedButtonOneLineSx = {
  width: '100% !important',
  maxWidth: '100% !important',
  minWidth: '0 !important',
  alignSelf: 'stretch',
  boxSizing: 'border-box',
  flexShrink: 0,
  flexGrow: 0,
  whiteSpace: 'nowrap !important',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  textAlign: 'center',
  justifyContent: 'center',
  alignItems: 'center',
  px: { xs: 0.25, sm: 0.35 },
  py: { xs: 0.35, sm: 0.4 },
  height: { xs: 36, sm: 40 },
  minHeight: { xs: 36, sm: 40 },
  maxHeight: { xs: 36, sm: 40 },
  lineHeight: '1.15 !important',
  transformOrigin: 'center center'
};

/** Lets Add Notebook / Add Note scale 25% on hover without clipping in the column shell. */
const laneAddButtonWrapSx = {
  position: 'relative',
  zIndex: 2,
  flexShrink: 0,
  mb: 1,
  overflow: 'visible',
  width: '100%'
};

const menuButtonSx = {
  fontFamily: MAIN_FONT_FAMILY,
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  justifyContent: 'flex-start',
  textAlign: 'left',
  mb: 0,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  '& .MuiButton-label': {
    display: 'block',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    textAlign: 'left'
  }
};

/** Blue used to mark the active search-result note (chip + matching sidebar row). */
const RECORD_VAULT_SEARCH_HIT_BLUE = '#1e88e5';

/**
 * Split a note title around the active search terms so matching substrings can
 * blink (same yellow `.rv-search-hit` treatment used for body matches). Returns
 * plain text when there is nothing to highlight, or an array of React nodes with
 * matches wrapped in a blinking <mark>.
 */
function renderTitleWithSearchHighlight(title, terms) {
  const text = String(title ?? '');
  if (!text) return text;
  const escaped = (Array.isArray(terms) ? terms : [])
    .map((t) => String(t ?? '').trim())
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!escaped.length) return text;
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(re);
  if (parts.length <= 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      // eslint-disable-next-line react/no-array-index-key
      <mark key={i} className="rv-search-hit">
        {part}
      </mark>
    ) : (
      // eslint-disable-next-line react/no-array-index-key
      <span key={i}>{part}</span>
    )
  );
}

/** True when any active search term appears (case-insensitive) in the title. */
function titleMatchesSearchTerms(title, terms) {
  const text = String(title ?? '').toLowerCase();
  if (!text) return false;
  return (Array.isArray(terms) ? terms : []).some((t) => {
    const needle = String(t ?? '').trim().toLowerCase();
    return needle && text.includes(needle);
  });
}

/** Sidebar / shortcut row while optional per-note inner encryption is locked (needs PIN). */
const RECORD_VAULT_INNER_LOCKED_LABEL = '*****';
const RECORD_VAULT_INNER_LOCKED_BG = '#000000';
const recordVaultInnerLockedMenuSx = {
  bgcolor: `${RECORD_VAULT_INNER_LOCKED_BG} !important`,
  color: '#ffffff !important',
  WebkitTextFillColor: '#ffffff !important',
  border: '4px solid #ffffff !important',
  '&:hover': {
    bgcolor: `${RECORD_VAULT_INNER_LOCKED_BG} !important`,
    color: '#ffffff !important',
    WebkitTextFillColor: '#ffffff !important'
  },
  '& *': {
    color: '#ffffff !important',
    WebkitTextFillColor: '#ffffff !important'
  }
};

const menuRowIconHoverScaleSx = {
  transform: 'scale(1)',
  transformOrigin: 'center center',
  transition: 'transform 0.15s ease',
  '@media (hover: hover)': {
    '&:hover:not(:disabled):not(.Mui-disabled)': {
      transform: `scale(${SLIDER_CONTROL_BUTTON_HOVER_SCALE_50})`,
      zIndex: 4
    }
  }
};

const menuRowLockButtonSx = {
  position: 'relative',
  flex: '0 0 auto',
  width: 33,
  height: 33,
  p: 0,
  minWidth: 0,
  border: 'none',
  borderRadius: '4px',
  bgcolor: 'transparent',
  cursor: 'pointer',
  lineHeight: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  ...menuRowIconHoverScaleSx,
  '&.Mui-disabled, &:disabled': { opacity: 0.5, cursor: 'default', transform: 'none' }
};

const menuColumnShellSx = {
  minWidth: 0,
  maxWidth: '100%',
  display: 'flex',
  flexDirection: 'column',
  border: '2px solid var(--theme-primary-color)',
  borderRadius: 1,
  p: 1,
  bgcolor: 'var(--theme-secondary-color)',
  minHeight: 320,
  // visible so Add Notebook / Add Note +25% hover scale is not clipped
  overflow: 'visible',
  boxSizing: 'border-box',
  containerType: 'inline-size'
};

const menuColumnShellCompactSx = {
  ...menuColumnShellSx,
  minHeight: 0,
  p: 0.75
};

const columnResizeHandleSx = {
  flex: '0 0 auto',
  width: 8,
  cursor: 'col-resize',
  touchAction: 'none',
  alignSelf: 'stretch',
  bgcolor: 'transparent',
  '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' }
};

const rowResizeHandleSx = {
  flex: '0 0 auto',
  height: 8,
  cursor: 'ns-resize',
  touchAction: 'none',
  alignSelf: 'stretch',
  bgcolor: 'var(--theme-primary-color)',
  opacity: 0.35,
  '&:hover': { opacity: 0.65, bgcolor: 'rgba(255,255,255,0.35)' }
};


function loadStoredNoteFontStyleIndex() {
  try {
    const raw = localStorage.getItem(NOTE_FONT_STYLE_LS_KEY);
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed % RECORD_VAULT_FONT_STYLE_COUNT;
    }
  } catch {
    // ignore
  }
  return RECORD_VAULT_DEFAULT_FONT_STYLE_INDEX;
}

function loadStoredNoteFontSizePt() {
  try {
    const raw = localStorage.getItem(NOTE_FONT_SIZE_PT_LS_KEY);
    return normalizeRecordVaultFontSizePt(raw);
  } catch {
    // ignore
  }
  return RECORD_VAULT_DEFAULT_FONT_SIZE_PT;
}









const recordVaultContentScrollSx = {
  flex: 1,
  minHeight: 0,
  overflowY: 'scroll',
  scrollbarWidth: 'thin',
  scrollbarColor: 'var(--theme-yellow-color) rgba(0,0,0,0.4)',
  '&::-webkit-scrollbar': {
    width: 14
  },
  '&::-webkit-scrollbar-track': {
    bgcolor: 'rgba(0,0,0,0.4)'
  },
  '&::-webkit-scrollbar-thumb': {
    bgcolor: 'var(--theme-yellow-color)',
    borderRadius: 7,
    border: '2px solid #000'
  },
  '&::-webkit-scrollbar-thumb:hover': {
    filter: 'brightness(1.08)'
  }
};

/** Notebook / Note / Shortcut list panels — always show a vertical scrollbar (OneDrive + USB). */
const recordVaultMenuListScrollSx = {
  ...recordVaultContentScrollSx,
  pr: 0.25
};



/** One text row between title↔photo and photo↔photo (grows if the user types more). */

function loadStoredLayout() {
  try {
    const raw = localStorage.getItem(LAYOUT_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      sidebarWidth: Number(parsed?.sidebarWidth),
      notebookColWidth: Number(parsed?.notebookColWidth),
      rightSidebarWidth: Number(parsed?.rightSidebarWidth),
      shortcutPanePercent: Number(parsed?.shortcutPanePercent)
    };
  } catch {
    return null;
  }
}

function writeStoredLayout(layout) {
  try {
    localStorage.setItem(LAYOUT_LS_KEY, JSON.stringify(layout));
  } catch {
    // ignore
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function readMenuButtonFontSizePx(rem = getVaultDefaultButtonFontSizeRem()) {
  if (typeof window === 'undefined') return rem * 16;
  const rootPx = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  const safeRem = Number.isFinite(rem) && rem > 0 ? rem : getVaultDefaultButtonFontSizeRem();
  return safeRem * rootPx;
}

function measureMenuLabelWidth(label, rem = getVaultDefaultButtonFontSizeRem()) {
  if (typeof document === 'undefined') return String(label || '').length * 9;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return String(label || '').length * 9;
  const fontSizePx = readMenuButtonFontSizePx(rem);
  ctx.font = `600 ${fontSizePx}px ${MAIN_FONT_FAMILY}`;
  return ctx.measureText(String(label || '')).width;
}

/** Notebook column width so each notebook label fits on one line. */
function computeNotebookColFitWidth(notebooks, rem = getVaultDefaultButtonFontSizeRem()) {
  if (!notebooks?.length) return DEFAULT_NOTEBOOK_COL_WIDTH;
  let maxLabel = 0;
  for (const nb of notebooks) {
    maxLabel = Math.max(maxLabel, measureMenuLabelWidth(nb.notebook_name || 'Untitled', rem));
  }
  const chromePx = 64;
  return Math.max(MIN_MENU_COL_WIDTH, Math.ceil(maxLabel + chromePx));
}



function reorderById(items, fromId, toId, idKey) {
  const fromIdx = items.findIndex((item) => Number(item[idKey]) === Number(fromId));
  const toIdx = items.findIndex((item) => Number(item[idKey]) === Number(toId));
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return items;
  const next = [...items];
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next;
}

function ColumnResizeHandle({ onMouseDown, sx }) {
  return (
    <Box
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize column"
      onMouseDown={onMouseDown}
      sx={{ ...columnResizeHandleSx, ...sx }}
    />
  );
}

function RowResizeHandle({ onMouseDown, sx, label = 'Resize panels' }) {
  return (
    <Box
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      onMouseDown={onMouseDown}
      sx={{ ...rowResizeHandleSx, ...sx }}
    />
  );
}

function isLeftSidebarDragEvent(event) {
  const types = event.dataTransfer?.types ? Array.from(event.dataTransfer.types) : [];
  return types.includes(DRAG_NOTEBOOK) || types.includes(DRAG_NOTE);
}










function stripNoteHeavyFields(note) {
  if (!note) return note;
  return {
    ...note,
    body_text: undefined,
    keywords: undefined,
    attachments: undefined,
    extra_images: undefined,
    content_loaded: false
  };
}

/**
 * A note is worth inner-encrypting when its HTML body has text OR any embedded
 * media (images/video/iframe/data URIs). `recordVaultRichTextHasContent` only
 * counts text, so image-only notes must be detected here too.
 */
function recordVaultHtmlHasProtectableContent(html) {
  const raw = String(html ?? '');
  if (recordVaultRichTextHasContent(raw)) return true;
  return /<img\b|<iframe\b|<video\b|<audio\b|data:(?:image|video|audio|application)\//i.test(raw);
}












const searchNavButtonSx = {
  width: 26,
  height: 26,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  p: 0,
  fontSize: '0.85rem',
  fontWeight: 900,
  lineHeight: 1,
  color: '#000',
  WebkitTextFillColor: '#000',
  bgcolor: 'var(--theme-yellow-color)',
  border: '2px solid #000',
  borderRadius: '6px',
  cursor: 'pointer',
  userSelect: 'none',
  '&:hover:not(:disabled)': { filter: 'brightness(1.05)' },
  '&:disabled': { opacity: 0.35, cursor: 'default' }
};

const menuRowDeleteButtonSx = {
  position: 'relative',
  top: 'auto',
  right: 'auto',
  flex: '0 0 auto',
  width: 22,
  height: 22,
  borderRadius: '50%',
  overflow: 'visible',
  ...menuRowIconHoverScaleSx
};

const menuRowEditFieldSx = {
  mb: 0.5,
  bgcolor: '#ffffff',
  borderRadius: '12px',
  border: '4px double #000000',
  px: 0.75,
  py: 0.25,
  boxSizing: 'border-box',
  '& .MuiInputBase-root': {
    fontFamily: MAIN_FONT_FAMILY,
    color: '#000000',
    WebkitTextFillColor: '#000000'
  },
  '& .MuiInputBase-input': {
    color: '#000000 !important',
    WebkitTextFillColor: '#000000 !important',
    caretColor: '#000000'
  },
  '& .MuiInputBase-root::before, & .MuiInputBase-root::after': {
    borderBottomColor: 'transparent !important'
  }
};

/** Content-header rename field — match selected notebook/note: white + double border. */

function MenuRowWithDelete({
  onDelete,
  deleteLabel,
  disabled,
  children,
  onToggleLock,
  lockTitle,
  lockDisabled = false,
  locked = false
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        mb: 0.5,
        minWidth: 0,
        width: '100%',
        overflow: 'visible'
      }}
    >
      {onToggleLock ? (
        <Box
          component="button"
          type="button"
          aria-label={lockTitle || 'Lock / unlock'}
          title={lockTitle || 'Lock / unlock'}
          disabled={disabled || lockDisabled}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleLock();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          sx={menuRowLockButtonSx}
        >
          <Box
            component="img"
            src={locked ? redLockImg : greenUnlockImg}
            alt=""
            sx={{ width: 27, height: 27, display: 'block' }}
          />
        </Box>
      ) : null}
      <Box sx={{ flex: '1 1 0', minWidth: 0, overflow: 'visible' }}>{children}</Box>
      {onDelete ? (
        <ThumbnailDeleteXButton
          aria-label={deleteLabel}
          title={deleteLabel}
          disabled={disabled}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          sx={menuRowDeleteButtonSx}
        />
      ) : null}
    </Box>
  );
}

function MenuRowButton({
  selected,
  selectedBlue = false,
  locked = false,
  multiSelected = false,
  children,
  onClick,
  sx,
  draggable,
  onKeyDown,
  ...rest
}) {
  const useDivDragSurface = Boolean(draggable);
  const lookSelected = selected || multiSelected;
  return (
    <SliderControlButton
      selected={lookSelected}
      hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
      disableSelectedTranslate
      {...(useDivDragSurface ? { component: 'div', role: 'button', tabIndex: 0 } : { type: 'button' })}
      onClick={onClick}
      onKeyDown={(event) => {
        if (useDivDragSurface && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick?.(event);
          return;
        }
        onKeyDown?.(event);
      }}
      draggable={draggable}
      sx={{
        ...menuButtonSx,
        justifyContent: 'flex-start',
        ...(lookSelected && !locked
          ? selectedBlue && selected
            ? {
                bgcolor: `${RECORD_VAULT_SEARCH_HIT_BLUE} !important`,
                color: '#ffffff !important',
                WebkitTextFillColor: '#ffffff !important',
                border: '4px double #ffffff !important'
              }
            : {
                bgcolor: '#ffffff !important',
                color: '#000000 !important',
                WebkitTextFillColor: '#000000 !important',
                border: multiSelected && !selected ? '3px solid #000000 !important' : '4px double #000000 !important'
              }
          : null),
        ...(locked ? recordVaultInnerLockedMenuSx : null),
        ...(useDivDragSurface ? { cursor: 'grab', userSelect: 'none' } : null),
        ...sx
      }}
      {...rest}
    >
      {children}
    </SliderControlButton>
  );
}

function ShortcutMenuRow({
  shortcut,
  label,
  selected,
  locked = false,
  draggingId,
  dropTargetId,
  onSelect,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onDropFromLeft,
  onDelete,
  deleteLabel,
  disabled,
  onToggleLock,
  lockTitle
}) {
  const id = shortcut.shortcut_id;
  const isDropTarget = draggingId != null && dropTargetId === id && draggingId !== id;

  return (
    <MenuRowWithDelete
      onDelete={onDelete}
      deleteLabel={deleteLabel}
      disabled={disabled}
      onToggleLock={onToggleLock}
      lockTitle={lockTitle}
      locked={locked}
    >
      <MenuRowButton
        selected={selected}
        locked={locked}
        draggable={!disabled}
        title={locked ? 'Locked — enter PIN to open' : 'Drag to reorder; click to open'}
        onClick={onSelect}
        onDragStart={(e) => {
          if (disabled) {
            e.preventDefault();
            return;
          }
          onDragStart(e, id);
        }}
        onDragEnd={onDragEnd}
        onDragOver={(e) => {
          const fromLeft = isLeftSidebarDragEvent(e);
          if (draggingId != null || fromLeft) {
            e.preventDefault();
            e.dataTransfer.dropEffect = draggingId != null ? 'move' : 'copy';
            if (draggingId != null) onDragOver(id);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const shortcutRaw = e.dataTransfer.getData(DRAG_SHORTCUT);
          const notebookRaw = e.dataTransfer.getData(DRAG_NOTEBOOK);
          const noteRaw = e.dataTransfer.getData(DRAG_NOTE);
          if (shortcutRaw) onDrop(e, id);
          else if (notebookRaw || noteRaw) onDropFromLeft(e);
        }}
        sx={
          isDropTarget
            ? {
                outline: '2px dashed var(--theme-primary-color)',
                outlineOffset: 2
              }
            : undefined
        }
      >
        {label ?? shortcut.label}
      </MenuRowButton>
    </MenuRowWithDelete>
  );
}

function RenamableDraggableMenuRow({
  id,
  label,
  selected,
  selectedBlue = false,
  locked = false,
  multiSelected = false,
  editing,
  editValue,
  onEditValueChange,
  onSelect,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  dragMime,
  draggingId,
  dropTargetId,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  /** OS file drops (md/html/pdf import) — takes priority over note reorder. */
  onFileDrop,
  disabled,
  dragNotebookId,
  onDelete,
  deleteLabel,
  domId,
  alternateDraggingId,
  dragTitle,
  buttonTitle,
  noteImageDropActive = false,
  acceptForeignDrop = false,
  onToggleLock,
  lockTitle,
  /** Optional warm-up before drag (e.g. fetch note body for Finder HTML export). */
  onPrefetchDrag
}) {
  const inputRef = useRef(null);
  const pointerDownRef = useRef(null);
  const suppressClickAfterDragRef = useRef(false);

  useEffect(() => {
    if (!editing) return undefined;
    const timerId = window.setTimeout(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.select?.();
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [editing]);

  const acceptsDrop =
    draggingId != null || alternateDraggingId != null || noteImageDropActive || acceptForeignDrop;
  const isDropTarget =
    acceptsDrop &&
    dropTargetId === id &&
    (noteImageDropActive || acceptForeignDrop || (draggingId !== id && alternateDraggingId !== id));

  const handleRenameBlur = (event) => {
    const next = event.relatedTarget;
    if (next?.closest?.('[data-record-vault-rename-row]')) return;
    void onCommitEdit();
  };

  const handleRowPointerDown = (event) => {
    if (event.button !== 0) return;
    pointerDownRef.current = { x: event.clientX, y: event.clientY };
    suppressClickAfterDragRef.current = false;
    try {
      onPrefetchDrag?.(id);
    } catch {
      // ignore prefetch errors
    }
  };

  const handleRowPointerUp = (event) => {
    if (disabled || event.button !== 0) return;
    const start = pointerDownRef.current;
    pointerDownRef.current = null;
    if (suppressClickAfterDragRef.current) {
      suppressClickAfterDragRef.current = false;
      return;
    }
    if (!start) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
    // Shift+click multi-select — never enter rename mode.
    if (event.shiftKey) {
      onSelect?.(event);
      return;
    }
    if (selected && !locked) onStartEdit();
    else onSelect?.(event);
  };

  if (editing) {
    return (
      <MenuRowWithDelete
        onDelete={onDelete}
        deleteLabel={deleteLabel}
        disabled={disabled}
        onToggleLock={onToggleLock}
        lockTitle={lockTitle}
        locked={locked}
      >
        <Box data-record-vault-rename-row onMouseDown={(e) => e.stopPropagation()}>
          <TextField
            inputRef={inputRef}
            variant="standard"
            size="small"
            value={editValue}
            disabled={disabled}
            onChange={(e) => onEditValueChange(e.target.value)}
            onBlur={handleRenameBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void onCommitEdit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onCancelEdit();
              }
            }}
            fullWidth
            sx={menuRowEditFieldSx}
          />
        </Box>
      </MenuRowWithDelete>
    );
  }

  return (
    <MenuRowWithDelete
      onDelete={onDelete}
      deleteLabel={deleteLabel}
      disabled={disabled}
      onToggleLock={onToggleLock}
      lockTitle={lockTitle}
      locked={locked}
    >
      <Box id={domId || undefined} sx={{ width: '100%' }}>
        <MenuRowButton
          selected={selected}
          selectedBlue={selectedBlue}
          multiSelected={multiSelected}
          locked={locked}
          draggable={!disabled}
          title={
            locked
              ? 'Locked — enter PIN to view'
              : buttonTitle || dragTitle || 'Drag to reorder; click selected to rename'
          }
          onPointerDown={handleRowPointerDown}
          onPointerUp={handleRowPointerUp}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!locked) onStartEdit();
          }}
          onDragStart={(e) => {
            if (disabled) {
              e.preventDefault();
              return;
            }
            suppressClickAfterDragRef.current = true;
            onDragStart(e, id, dragMime, dragNotebookId);
          }}
          onDragEnd={onDragEnd}
          onDragOver={(e) => {
            const types = e.dataTransfer?.types ? Array.from(e.dataTransfer.types) : [];
            const isInternalVaultDrag =
              types.includes(DRAG_NOTEBOOK) ||
              types.includes(DRAG_NOTE) ||
              types.includes(DRAG_SHORTCUT) ||
              types.includes(DRAG_CROSS_PANE);
            const isOsFile = types.includes('Files') && !isInternalVaultDrag;
            if (isOsFile && onFileDrop) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              return;
            }
            // OS files without a row handler: let the event bubble to the column drop zone.
            if (isOsFile) return;
            if (!acceptsDrop) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = acceptForeignDrop ? 'copy' : 'move';
            onDragOver(id);
          }}
          onDrop={(e) => {
            const types = e.dataTransfer?.types ? Array.from(e.dataTransfer.types) : [];
            const isInternalVaultDrag =
              types.includes(DRAG_NOTEBOOK) ||
              types.includes(DRAG_NOTE) ||
              types.includes(DRAG_SHORTCUT) ||
              types.includes(DRAG_CROSS_PANE);
            const isOsFile =
              !isInternalVaultDrag && e.dataTransfer?.files && e.dataTransfer.files.length > 0;
            if (isOsFile && onFileDrop) {
              e.preventDefault();
              e.stopPropagation();
              onFileDrop(e);
              return;
            }
            // OS folder/file drop without row handler — bubble to column.
            if (isOsFile) return;
            e.preventDefault();
            e.stopPropagation();
            onDrop(e, id, dragMime);
          }}
          sx={
            isDropTarget
              ? {
                  outline: '2px dashed var(--theme-primary-color)',
                  outlineOffset: 2
                }
              : null
          }
        >
          {locked ? (
            RECORD_VAULT_INNER_LOCKED_LABEL
          ) : (
            <Box
              component="span"
              sx={{
                display: 'block',
                minWidth: 0,
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {label}
            </Box>
          )}
        </MenuRowButton>
      </Box>
    </MenuRowWithDelete>
  );
}

/** Content-pane copy of menu notebook/note buttons — click to rename; stays in sync with the menu. */









/** Splits v2 / legacy notes into title↔photo / photo↔photo text segments. */

export default function RecordVaultWorkspacePane({
  unlocked = false,
  compact = false,
  compareMode = false,
  paneLabel = '',
  canEnterCompare = false,
  onEnterCompare,
  onReturnFromCompare,
  onSessionEnded
}) {
  const navigate = useNavigate();
  const paneStorageType = useRecordVaultPaneStorageType();
  const vaultApi = useMemo(() => createRecordVaultPaneApi(paneStorageType), [paneStorageType]);
  const { user } = useAuth();
  const storedLayout = useMemo(() => loadStoredLayout(), []);
  const [loading, setLoading] = useState(true);
  const [vaultUiReady, setVaultUiReady] = useState(false);
  const [busy, setBusy] = useState(false);
  /** When set with busy, shows site BusyHourglassOverlay (e.g. notebook/note delete). */
  const [busyLabel, setBusyLabel] = useState('');
  const [batchUploadProgress] = useState(null);
  const [vaultLeaving, setVaultLeaving] = useState(false);
  /** Honest 0–100% while Log off Cloud syncs dirty vault files to OneDrive. */
  const [vaultLeavingProgressPercent, setVaultLeavingProgressPercent] = useState(0);
  const [vaultLeavingProgressLabel, setVaultLeavingProgressLabel] = useState('');

  const [vaultUsage, setVaultUsage] = useState(null);
  const [videoTutorialUrl, setVideoTutorialUrl] = useState('');
  const [oneDriveOffered, setOneDriveOffered] = useState(false);
  const [, setLocalUsbOffered] = useState(false);
  const [, setStorageConfigLoaded] = useState(false);
  const [] = useState(false);
  const [viewVaultOpen, setViewVaultOpen] = useState(false);
  const [viewVaultStorageType, setViewVaultStorageType] = useState('onedrive');
  const [oneDriveBackupOpen, setOneDriveBackupOpen] = useState(false);
  const [usbBackupOpen, setUsbBackupOpen] = useState(false);
  const [oneDriveVaultFolderName, setOneDriveVaultFolderName] = useState('onlinemallwebsitevault');
  const [usbVaultFolderLabel] = useState('USB');
  const [usbBridgeHealthy, setUsbBridgeHealthy] = useState(false);
  const [crossPaneDropActive, setCrossPaneDropActive] = useState(false);
  const [crossPaneTransfer, setCrossPaneTransfer] = useState(null);
  const [crossPaneBusy, setCrossPaneBusy] = useState(false);
  const [crossPaneProgressPercent, setCrossPaneProgressPercent] = useState(0);
  const [crossPaneProgressLabel, setCrossPaneProgressLabel] = useState('');
  const [crossPaneDuplicateError, setCrossPaneDuplicateError] = useState('');
  const [duplicateNamePopup, setDuplicateNamePopup] = useState('');
  const [renameSavedPopup, setRenameSavedPopup] = useState('');
  /** 'notebook' | 'note' — name prompt before creating a new item. */
  const [createItemDialog, setCreateItemDialog] = useState(null);
  /** Auto-dismiss success toasts after notes-list import/export (queued; work continues in parallel). */
  const [importSuccessPopup, setImportSuccessPopup] = useState('');
  /** After multi-note drag to Finder: offer folder picker to write separate .html files. */
  const [multiHtmlExportOffer, setMultiHtmlExportOffer] = useState(null);
  const [multiHtmlExportBusy, setMultiHtmlExportBusy] = useState(false);
  /** After notebook drag to Finder: offer parent-folder picker → notebook subfolder + HTML notes. */
  const [notebookHtmlExportOffer, setNotebookHtmlExportOffer] = useState(null);
  const [notebookExportBusy, setNotebookExportBusy] = useState(false);
  const [notebookExportProgressPercent, setNotebookExportProgressPercent] = useState(0);
  const [notebookExportProgressLabel, setNotebookExportProgressLabel] = useState('');
  /** Persistent success after notebook HTML folder export (manual X to close). */
  const [notebookExportSuccess, setNotebookExportSuccess] = useState(null);
  /** Highlight notebook column while dragging an OS folder over it. */
  const [notebookLaneFolderDragActive, setNotebookLaneFolderDragActive] = useState(false);
  const [folderImportBusy, setFolderImportBusy] = useState(false);
  const [folderImportProgressPercent, setFolderImportProgressPercent] = useState(0);
  const [folderImportProgressLabel, setFolderImportProgressLabel] = useState('');
  /** Persistent success after folder → notebook HTML import (manual X to close). */
  const [folderImportSuccess, setFolderImportSuccess] = useState(null);
  const [multiHtmlExportProgressPercent, setMultiHtmlExportProgressPercent] = useState(0);
  const [multiHtmlExportProgressLabel, setMultiHtmlExportProgressLabel] = useState('');
  const [noteFileImportProgress, setNoteFileImportProgress] = useState(null);
  const importSuccessWaitRef = useRef(null);
  const importSuccessQueueRef = useRef([]);
  const importSuccessPumpRunningRef = useRef(false);
  useEffect(
    () => () => {
      if (importSuccessWaitRef.current) window.clearTimeout(importSuccessWaitRef.current);
      importSuccessQueueRef.current = [];
      importSuccessPumpRunningRef.current = false;
    },
    []
  );

  /**
   * Queue a success popup without blocking the caller.
   * @param {string} message
   * @param {number} [durationMs=3000]
   */
  const enqueueImportSuccessPopup = useCallback((message, durationMs = 3000) => {
    const text = String(message || '').trim();
    if (!text) return;
    const ms = Math.max(500, Number(durationMs) || 3000);
    importSuccessQueueRef.current.push({ text, durationMs: ms });
    if (importSuccessPumpRunningRef.current) return;
    importSuccessPumpRunningRef.current = true;
    void (async () => {
      while (importSuccessQueueRef.current.length) {
        const next = importSuccessQueueRef.current.shift();
        setImportSuccessPopup(next.text);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => {
          if (importSuccessWaitRef.current) window.clearTimeout(importSuccessWaitRef.current);
          importSuccessWaitRef.current = window.setTimeout(() => {
            importSuccessWaitRef.current = null;
            resolve();
          }, next.durationMs);
        });
        setImportSuccessPopup('');
      }
      importSuccessPumpRunningRef.current = false;
    })();
  }, []);
  const [error, setError] = useState('');
  const [leftMenuOpen, setLeftMenuOpen] = useState(true);
  const [rightMenuOpen, setRightMenuOpen] = useState(true);
  /** When menus are open: full labels vs first-letter compact (C / L / M). */
  const [menuLabelsExpanded, setMenuLabelsExpanded] = useState(true);
  const [noteFontStyleIndex, setNoteFontStyleIndex] = useState(loadStoredNoteFontStyleIndex);
  const [noteFontSizePt, setNoteFontSizePt] = useState(loadStoredNoteFontSizePt);
  const [noteContentBgIndex, setNoteContentBgIndex] = useState(RECORD_VAULT_DEFAULT_CONTENT_BG_INDEX);
  const [noteTextBgIndex, setNoteTextBgIndex] = useState(RECORD_VAULT_DEFAULT_TEXT_HIGHLIGHT_INDEX);
  const [] = useState(false);
  const [notebooks, setNotebooks] = useState([]);
  const [shortcuts, setShortcuts] = useState([]);
  const [selectedNotebookId, setSelectedNotebookId] = useState(null);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  /** Shift+click multi-select in the notes list (HTML export drag can include all). */
  const [multiSelectedNoteIds, setMultiSelectedNoteIds] = useState([]);
  const multiSelectedNoteIdsRef = useRef([]);
  const noteMultiSelectAnchorIdRef = useRef(null);
  const [openNoteTitlePlain, setOpenNoteTitlePlain] = useState('');
  const [noteContentZoom, setNoteContentZoom] = useState(NOTE_CONTENT_ZOOM_DEFAULT);
  // While searching, the title shows blinking highlights (read-only) until the
  // user clicks it to edit; flips back to highlight view on blur / note swap.
  const [titleEditing, setTitleEditing] = useState(false);
  const [searchTerm1, setSearchTerm1] = useState('');
  const [searchTerm2, setSearchTerm2] = useState('');
  const [searchOp1, setSearchOp1] = useState('and');
  /** Non-null only after the user presses Search (or Clear resets to null). */
  const [searchResults, setSearchResults] = useState(null);
  /** Terms from the last Search press — highlights/Found bar ignore typing until then. */
  const [appliedSearchTerms, setAppliedSearchTerms] = useState([]);
  const [searchMessage, setSearchMessage] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  // Search-hit navigation within the open note (up/down steps through matches).
  const [searchHitCount, setSearchHitCount] = useState(0);
  const [activeHitIndex, setActiveHitIndex] = useState(-1);
  const [noteContentLoading, setNoteContentLoading] = useState(false);
  const innerUnlockRef = useRef({});
  const [innerUnlockVersion, setInnerUnlockVersion] = useState(0);
  /** Inline PIN panel for unlock / re-encrypt / first-time enable. */
  const [inlineInnerPinMode, setInlineInnerPinMode] = useState(null);
  const [innerEncryptBusy, setInnerEncryptBusy] = useState(false);
  /** Honest 0–100% for PIN encrypt/decrypt based on note count (not Cloud sync). */
  const [innerEncryptProgressPercent, setInnerEncryptProgressPercent] = useState(0);
  const [innerEncryptProgressLabel, setInnerEncryptProgressLabel] = useState('');
  const [innerEncryptError, setInnerEncryptError] = useState('');
  /** Shared PIN dialog state: { open, mode: 'enable'|'unlock'|'lock', scope, noteId, notebookId }. */
  const [innerEncryptDialog, setInnerEncryptDialog] = useState({
    open: false,
    mode: 'enable',
    scope: 'note',
    noteId: null,
    notebookId: null
  });
  /** Imperative handle to the TipTap editor (get/set HTML, toggle editable). */
  const noteEditorApiRef = useRef(null);
  const [mobileUploadOpen, setMobileUploadOpen] = useState(false);
  /** Highlight the notes-list column while dragging an importable file over it. */
  const [noteLaneFileDragActive, setNoteLaneFileDragActive] = useState(false);
  /** Bumped when the TipTap instance is created, so hydration effects can run. */
  const [editorReadyTick, setEditorReadyTick] = useState(0);
  const handleEditorReady = useCallback(() => setEditorReadyTick((t) => t + 1), []);
  /** Tracks which note/lock-state the editor currently displays (avoids re-clobbering edits). */
  const editorHydratedRef = useRef({ key: '' });
  /**
   * 'notebook' when the user selected a notebook (or locked via notebook focus);
   * 'note' when they selected a note row. Drives PIN panel copy + lock-all scope.
   */
  const [innerEncryptUiScope, setInnerEncryptUiScope] = useState('note');
  /** Set when user clicks a notebook (or notebook shortcut); consumed by auto note-select. */
  const notebookScopePendingRef = useRef(false);
  const [, setInlineUnlockPin] = useState('');
  const [, setInlineUnlockPinVisible] = useState(false);
  const [, setInnerUnlockCooldownSec] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    clamp(storedLayout?.sidebarWidth || DEFAULT_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH)
  );
  const [notebookColWidth, setNotebookColWidth] = useState(() =>
    Math.max(MIN_MENU_COL_WIDTH, storedLayout?.notebookColWidth || DEFAULT_NOTEBOOK_COL_WIDTH)
  );
  const [rightSidebarWidth, setRightSidebarWidth] = useState(() =>
    clamp(storedLayout?.rightSidebarWidth || DEFAULT_RIGHT_SIDEBAR_WIDTH, MIN_RIGHT_SIDEBAR_WIDTH, MAX_RIGHT_SIDEBAR_WIDTH)
  );
  const [shortcutPanePercent, setShortcutPanePercent] = useState(() =>
    clamp(
      Number.isFinite(storedLayout?.shortcutPanePercent)
        ? storedLayout.shortcutPanePercent
        : DEFAULT_SHORTCUT_PANE_PERCENT,
      MIN_SHORTCUT_PANE_PERCENT,
      MAX_SHORTCUT_PANE_PERCENT
    )
  );
  // Editor pane height when the Vault files panel is shown. `null` = auto: the
  // editor now fills the whole content pane; dropped files live inline in the body.
  const noteContentPaneRef = useRef(null);
  const editorBoxRef = useRef(null);
  const [] = useState(true);
  const [notebookColAutoFit, setNotebookColAutoFit] = useState(false);
  const defaultMenuButtonFontRem = getVaultDefaultButtonFontSizeRem();
  const [menuButtonFontRem, setMenuButtonFontRem] = useState(defaultMenuButtonFontRem);
  const menuButtonFontSaveTimerRef = useRef(null);
  const [] = useState(null);
  const [] = useState(false);
  const [] = useState(null);
  const [maxUploadMb, setMaxUploadMb] = useState(20);
  /** File → Payment swaps the editor body for the shared /profileRecords component. */
  const [fileWorkspaceView, setFileWorkspaceView] = useState('notes');
  const [profilesRecordsInitialTab, setProfilesRecordsInitialTab] = useState('profiles');
  const [profilesRecordsInitialTokens, setProfilesRecordsInitialTokens] = useState(null);
  const [vaultFileTooLargeOpen, setVaultFileTooLargeOpen] = useState(false);
  const [vaultFileTooLargeName] = useState('');
  const [vaultFileTooLargeActualMb] = useState('');
  const [vaultFileTooLargeMaxMb] = useState(20);
  const [vaultUploadErrorOpen, setVaultUploadErrorOpen] = useState(false);
  const [vaultUploadErrorTitle] = useState('Upload failed');
  const [vaultUploadErrorMessage] = useState('');
  const [vaultUploadErrorDetail] = useState('');
  const [editingNotebookId, setEditingNotebookId] = useState(null);
  const [editingNoteId, setEditingNoteId] = useState(null);
  /** Only one rename TextField at a time — menu and header used to both mount and blur-cancel each other. */
  const [renameUiSurface, setRenameUiSurface] = useState(null); // 'menu' | 'header'
  const [editNameDraft, setEditNameDraft] = useState('');
  const [draggingNotebookId, setDraggingNotebookId] = useState(null);
  const [dropTargetNotebookId, setDropTargetNotebookId] = useState(null);
  const [draggingNoteId, setDraggingNoteId] = useState(null);
  const [dropTargetNoteId, setDropTargetNoteId] = useState(null);
  const [draggingShortcutId, setDraggingShortcutId] = useState(null);
  const [dropTargetShortcutId, setDropTargetShortcutId] = useState(null);
  const refreshVaultUsageRef = useRef(() => {});
  const bumpVaultUsageTimerRef = useRef(null);
  const saveTimerRef = useRef(null);
  const mynotePrefsSaveTimerRef = useRef(null);
  const contentScrollRef = useRef(null);
  const pendingMynoteRestoreRef = useRef({ applied: false });
  const noteContentBgIndexRef = useRef(RECORD_VAULT_DEFAULT_CONTENT_BG_INDEX);
  const noteFontStyleIndexRef = useRef(RECORD_VAULT_DEFAULT_FONT_STYLE_INDEX);
  const noteTextBgIndexRef = useRef(RECORD_VAULT_DEFAULT_TEXT_HIGHLIGHT_INDEX);
  const noteFontSizePtRef = useRef(RECORD_VAULT_DEFAULT_FONT_SIZE_PT);
  const skipSaveRef = useRef(false);
  const loadedDraftKeyRef = useRef('');
  const loadedTitleKeyRef = useRef('');
  const hydratedDraftKeyRef = useRef('');
  const selectedNotebookIdRef = useRef(null);
  const selectedNoteIdRef = useRef(null);
  const loadedNoteIdRef = useRef(null);
  const persistNoteRef = useRef(null);
  const persistNoteInFlightRef = useRef(false);
  const draftRef = useRef({ openNoteTitlePlain: '' });
  // Snapshot of the note title when the editor title box gains focus, so a
  // duplicate name entered there can be reverted to the last good value.
  const noteTitleBoxSnapshotRef = useRef('');
  const activeDragRef = useRef({ kind: null, id: null, notebookId: null });
  /** Blob URLs + success messages prepared on note drag-start for Finder HTML export. */
  const pendingHtmlExportRef = useRef({ urls: [], messages: [], separateFiles: [] });
  /** Notebook drag-out export (folder + all notes as HTML) — armed on dragstart. */
  const pendingNotebookExportRef = useRef(null);
  /** noteId → { title, bodyHtml } warmed on pointer-down so list-drag export has body. */
  const noteHtmlExportCacheRef = useRef(new Map());
  const shortcutDropInFlightRef = useRef(false);
  /** Late-bound folder→notebook import (defined after vaultNameExists). */
  const importFoldersAsNotebooksRef = useRef(null);

  // Append undeletable Bill Schedule last; list UI also flushes it to the column bottom (mt: auto).
  const displayNotebooks = useMemo(() => [...notebooks, buildBillScheduleNotebook()], [notebooks]);

  const selectedNotebook = useMemo(() => {
    return (
      displayNotebooks.find((nb) => Number(nb.notebook_id) === Number(selectedNotebookId)) ?? null
    );
  }, [displayNotebooks, selectedNotebookId]);

  const selectedNote = useMemo(() => {
    if (!selectedNotebook) return null;
    return (selectedNotebook.notes || []).find((n) => Number(n.note_id) === Number(selectedNoteId)) ?? null;
  }, [selectedNotebook, selectedNoteId]);

  const isBillScheduleView = isBillScheduleNotebookId(selectedNotebookId);
  const isBillMonthlyView = isBillMonthlyNoteId(selectedNoteId);
  const isBillYearlyView = isBillYearlyNoteId(selectedNoteId);

  useEffect(() => {
    selectedNotebookIdRef.current = selectedNotebookId;
  }, [selectedNotebookId]);

  useEffect(() => {
    selectedNoteIdRef.current = selectedNoteId;
  }, [selectedNoteId]);

  useEffect(() => {
    multiSelectedNoteIdsRef.current = multiSelectedNoteIds.map((id) => Number(id));
  }, [multiSelectedNoteIds]);

  /** Keep the ref in sync immediately (dragstart can run before the effect). */
  const replaceMultiSelectedNoteIds = useCallback((ids) => {
    const cleaned = (Array.isArray(ids) ? ids : [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id >= 1);
    multiSelectedNoteIdsRef.current = cleaned;
    setMultiSelectedNoteIds(cleaned);
  }, []);

  // Changing notebooks clears Shift+click multi-select.
  useEffect(() => {
    replaceMultiSelectedNoteIds([]);
    noteMultiSelectAnchorIdRef.current = selectedNoteIdRef.current;
  }, [selectedNotebookId, replaceMultiSelectedNoteIds]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (!multiSelectedNoteIdsRef.current.length) return;
      replaceMultiSelectedNoteIds([]);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [replaceMultiSelectedNoteIds]);

  /**
   * Note ids carried by the current drag. When 2+ notes are Shift-selected, the
   * whole selection moves/exports together — even if the pointer grabbed a row
   * outside that set (user intent: "these white rows go to the destination").
   */
  const resolveDraggedNoteIds = useCallback(
    (draggedId) => {
      const grabbed = Number(draggedId);
      const multi = (multiSelectedNoteIdsRef.current || [])
        .map(Number)
        .filter((nid) => Number.isFinite(nid) && nid >= 1);
      if (multi.length > 1) {
        const notes = selectedNotebook?.notes || [];
        const ordered = notes
          .map((n) => Number(n.note_id))
          .filter((nid) => multi.includes(nid));
        return ordered.length ? ordered : multi;
      }
      if (Number.isFinite(grabbed) && grabbed >= 1) return [grabbed];
      return [];
    },
    [selectedNotebook]
  );

  useEffect(() => {
    noteContentBgIndexRef.current = noteContentBgIndex;
  }, [noteContentBgIndex]);

  useEffect(() => {
    noteFontStyleIndexRef.current = noteFontStyleIndex;
  }, [noteFontStyleIndex]);

  useEffect(() => {
    noteTextBgIndexRef.current = noteTextBgIndex;
  }, [noteTextBgIndex]);

  useEffect(() => {
    noteFontSizePtRef.current = noteFontSizePt;
  }, [noteFontSizePt]);

  const scheduleSaveMynotePrefs = useCallback(
    (partial = {}) => {
      if (mynotePrefsSaveTimerRef.current) {
        window.clearTimeout(mynotePrefsSaveTimerRef.current);
      }
      const mergedPartial = { ...partial };
      mynotePrefsSaveTimerRef.current = window.setTimeout(() => {
        mynotePrefsSaveTimerRef.current = null;
        const patch = {
          mynoteLastNotebookId: selectedNotebookIdRef.current,
          mynoteLastNoteId: selectedNoteIdRef.current,
          mynoteContentBgIndex: noteContentBgIndexRef.current,
          mynoteFontColorIndex: noteFontStyleIndexRef.current,
          mynoteTextHighlightIndex: noteTextBgIndexRef.current,
          mynoteEditorFontSizePt: noteFontSizePtRef.current,
          mynoteNoteScrollTop: contentScrollRef.current?.scrollTop ?? 0,
          mynoteEditorCaretPos: null,
          ...mergedPartial
        };
        void saveUserCustomization(patch).catch(() => {
          // ignore — local UI already updated
        });
      }, 400);
    },
    []
  );


  // Search UI (Found chips, in-note highlights) stays off until Search is pressed.
  const searchActive = searchResults !== null;

  // Terms to highlight inside the open note — from the last Search press only.
  const activeSearchTerms = appliedSearchTerms;

  // Search never prunes the tree: every notebook (and every note) stays visible on
  // the left. A match is shown purely by selection styling — the containing
  // notebook goes white (selected) and the matched note goes blue (selectedBlue) —
  // so the user keeps their full notebook list while jumping between hits.
  // (displayNotebooks includes Bill Schedule — defined above with selectedNotebook.)

  const loadNoteContent = useCallback(async (noteId) => {
    const id = Number(noteId);
    if (!Number.isFinite(id) || id < 1) return;
    if (isBillScheduleSystemId(id)) return;
    const note = await vaultApi.fetchRecordVaultNote(id);
    if (!note) throw new Error('Note not found');
    setNotebooks((prev) =>
      prev.map((nb) => ({
        ...nb,
        notes: (nb.notes || []).map((row) => {
          if (Number(row.note_id) === id) return { ...row, ...note, content_loaded: true };
          return stripNoteHeavyFields(row);
        })
      }))
    );
  }, [vaultApi]);

  const noteHasInnerEncryption = useCallback((note) => {
    if (!note) return false;
    return Boolean(note.inner_encrypt_enabled) || isRecordVaultInnerEncryptedBody(note.body_text);
  }, []);

  /** Note still needs a PIN before content can be read/edited. */
  const noteRequiresInnerPinToView = useCallback(
    (note) => {
      if (!note) return false;
      const bodyEncrypted = isRecordVaultInnerEncryptedBody(note.body_text);
      const flagOn = Boolean(note.inner_encrypt_enabled);
      if (!flagOn && !bodyEncrypted) return false;
      // Stale flag: body already plaintext on disk — do not show locked chrome.
      if (note.content_loaded && note.body_text != null && !bodyEncrypted) return false;
      return flagOn || bodyEncrypted;
    },
    []
  );

  const isInnerNoteUnlocked = useCallback((noteId) => {
    const id = Number(noteId);
    // Transient only while encrypt/decrypt GIF runs — unlock permanently clears encryption on disk.
    return innerUnlockRef.current[id]?.plainBody != null;
  }, []);

  /** Sidebar / shortcut rows — same transient unlock marker as the open note. */
  const isInnerNoteUnlockedForDisplay = useCallback((noteId) => {
    const id = Number(noteId);
    if (!Number.isFinite(id) || id < 1) return false;
    return innerUnlockRef.current[id]?.plainBody != null;
  }, []);

  /**
   * Notebook shows red ***** (like locked notes) when every inner-encrypted note
   * still requires a PIN — i.e. the notebook was locked and nothing has been unlocked yet.
   */
  const notebookInnerLockedForDisplay = useCallback(
    (notebookNotes) => {
      const notes = Array.isArray(notebookNotes) ? notebookNotes : [];
      // A notebook is "fully locked" (red *****, names hidden) ONLY when every note
      // still needs a PIN. Locking a single note must not gate the whole notebook —
      // the other notes stay visible and only the locked note shows as *****.
      if (!notes.length) return false;
      return notes.every(
        (n) => noteRequiresInnerPinToView(n) && !isInnerNoteUnlockedForDisplay(n.note_id, n)
      );
    },
    [isInnerNoteUnlockedForDisplay, noteRequiresInnerPinToView]
  );

  const bumpInnerUnlock = useCallback(() => setInnerUnlockVersion((v) => v + 1), []);



  const clearInnerUnlockForNote = useCallback(
    (noteId) => {
      const id = Number(noteId);
      if (!Number.isFinite(id) || id < 1) return;
      delete innerUnlockRef.current[id];
      bumpInnerUnlock();
    },
    [bumpInnerUnlock]
  );


  /** Patch a single note row anywhere in the notebook tree. */
  const patchNoteRowInTree = useCallback((noteId, patch) => {
    const id = Number(noteId);
    if (!Number.isFinite(id) || id < 1) return;
    setNotebooks((prev) =>
      prev.map((nb) => ({
        ...nb,
        notes: (nb.notes || []).map((row) =>
          Number(row.note_id) === id ? { ...row, ...patch } : row
        )
      }))
    );
  }, []);

  /** Current TipTap HTML for the open note (or best-known plaintext body). */
  const getCurrentNoteHtml = useCallback(() => {
    if (!selectedNote) return '';
    const id = Number(selectedNote.note_id);
    const locked = noteRequiresInnerPinToView(selectedNote) && !isInnerNoteUnlocked(id);
    const api = noteEditorApiRef.current;
    if (!locked && api) return api.getHTML();
    const unlockPlain = innerUnlockRef.current[id]?.plainBody;
    if (unlockPlain != null) return unlockPlain;
    const stored = String(selectedNote.body_text ?? '');
    return isRecordVaultInnerEncryptedBody(stored) ? '' : stored;
  }, [selectedNote, noteRequiresInnerPinToView, isInnerNoteUnlocked]);

  /** Encrypt one note's HTML body with the PIN and persist it (inner layer on). */
  const encryptOneNoteWithPin = useCallback(
    async (noteRow, pin, plainHtmlOverride = null, { force = false } = {}) => {
      const id = Number(noteRow?.note_id);
      if (!Number.isFinite(id) || id < 1) return null;
      let plainHtml = plainHtmlOverride;
      if (plainHtml == null) {
        const unlockPlain = innerUnlockRef.current[id]?.plainBody;
        if (unlockPlain != null) {
          plainHtml = unlockPlain;
        } else {
          let body = noteRow.body_text;
          if (!noteRow.content_loaded || body == null) {
            const fresh = await vaultApi.fetchRecordVaultNote(id);
            body = fresh?.body_text ?? '';
          }
          if (isRecordVaultInnerEncryptedBody(body)) return id; // already locked
          plainHtml = body ?? '';
        }
      }
      // Notebook-scope lock (force) hides every note name, so even empty notes
      // get locked. Note-scope lock still requires real content to protect —
      // either body text/media OR at least one dropped file attachment (which the
      // locked view hides behind the PIN too).
      const hasAttachments =
        Array.isArray(noteRow?.attachments) && noteRow.attachments.length > 0;
      if (!force && !hasAttachments && !recordVaultHtmlHasProtectableContent(plainHtml)) {
        return null;
      }
      // PIN stays in the browser only — body blob holds salt + wrapped DEK + ciphertext.
      const { bodyText, innerPinSalt } = await encryptRecordVaultNoteInnerBody(plainHtml, pin);
      await vaultApi.updateRecordVaultNote(id, {
        body_text: bodyText,
        inner_encrypt_enabled: true,
        // v2 embeds salt in bodyText; clear any legacy separate salt column.
        inner_pin_salt: innerPinSalt,
        inner_unlock_locked_until: null
      });
      removeNoteSearchIndex(id);
      clearInnerUnlockForNote(id);
      patchNoteRowInTree(id, {
        body_text: bodyText,
        inner_encrypt_enabled: true,
        inner_pin_salt: innerPinSalt,
        inner_unlock_locked_until: null,
        content_loaded: true
      });
      return id;
    },
    [vaultApi, clearInnerUnlockForNote, patchNoteRowInTree]
  );

  /** Decrypt one note permanently with the PIN (inner layer off, plaintext on disk). */
  const unlockInnerEncryptedNote = useCallback(
    async (noteId, pin, noteRow) => {
      const id = Number(noteId);
      let body = noteRow?.body_text;
      let salt = noteRow?.inner_pin_salt;
      let freshNote = null;
      if (!noteRow?.content_loaded || body == null || !isRecordVaultInnerEncryptedBody(body)) {
        freshNote = await vaultApi.fetchRecordVaultNote(id);
        body = freshNote?.body_text ?? body;
        salt = freshNote?.inner_pin_salt ?? salt;
      }
      // File attachments / extra images live in their own tables, not in body_text.
      // A note unlocked straight from the sidebar was only loaded as metadata, so
      // carry the freshly-fetched lists into the tree — otherwise decrypting drops
      // every attached file from view even though it still exists on disk.
      const attachmentsForRow = Array.isArray(freshNote?.attachments)
        ? freshNote.attachments
        : Array.isArray(noteRow?.attachments)
          ? noteRow.attachments
          : undefined;
      const extraImagesForRow = Array.isArray(freshNote?.extra_images)
        ? freshNote.extra_images
        : Array.isArray(noteRow?.extra_images)
          ? noteRow.extra_images
          : undefined;
      const attachmentPatch = {
        ...(attachmentsForRow ? { attachments: attachmentsForRow } : null),
        ...(extraImagesForRow ? { extra_images: extraImagesForRow } : null)
      };
      if (!isRecordVaultInnerEncryptedBody(body)) {
        patchNoteRowInTree(id, {
          inner_encrypt_enabled: false,
          inner_pin_salt: null,
          content_loaded: true,
          ...attachmentPatch
        });
        return body ?? '';
      }
      let plainHtml;
      try {
        plainHtml = await decryptRecordVaultNoteInnerBody(body, pin, salt);
      } catch (err) {
        const until = Date.now() + INNER_UNLOCK_LOCKOUT_MS;
        persistInnerUnlockLockoutMs(paneStorageType, user?.singles_id, id, until);
        try {
          await vaultApi.updateRecordVaultNote(id, {
            inner_unlock_locked_until: new Date(until).toISOString()
          });
        } catch {
          // Local lockout still applies even if the server write fails.
        }
        throw err;
      }
      clearPersistedInnerUnlockLockout(paneStorageType, user?.singles_id, id);
      await vaultApi.updateRecordVaultNote(id, {
        body_text: plainHtml,
        inner_encrypt_enabled: false,
        inner_pin_salt: null,
        inner_unlock_locked_until: null
      });
      indexNoteSearchText(id, stripRecordVaultHtml(plainHtml), '');
      clearInnerUnlockForNote(id);
      patchNoteRowInTree(id, {
        body_text: plainHtml,
        inner_encrypt_enabled: false,
        inner_pin_salt: null,
        inner_unlock_locked_until: null,
        content_loaded: true,
        ...attachmentPatch
      });
      return plainHtml;
    },
    [vaultApi, paneStorageType, user?.singles_id, clearInnerUnlockForNote, patchNoteRowInTree]
  );

  /** Locate a note row (and its notebook) anywhere in the tree. */
  const findNoteRowById = useCallback(
    (noteId) => {
      const id = Number(noteId);
      for (const nb of notebooks) {
        const note = (nb.notes || []).find((n) => Number(n.note_id) === id);
        if (note) return { note, notebook: nb };
      }
      return { note: null, notebook: null };
    },
    [notebooks]
  );

  const openInnerEncryptDialog = useCallback(
    (mode, scope, { noteId = null, notebookId = null } = {}) => {
      setInnerEncryptError('');
      setInnerEncryptDialog({
        open: true,
        mode,
        scope,
        noteId: Number(noteId) || null,
        notebookId: Number(notebookId) || null
      });
    },
    []
  );

  const closeInnerEncryptDialog = useCallback(() => {
    if (innerEncryptBusy) return;
    setInnerEncryptDialog((d) => ({ ...d, open: false }));
    setInnerEncryptError('');
  }, [innerEncryptBusy]);

  /**
   * Local PIN encrypt/decrypt maps into 0…localMaxPercent.
   * On OneDrive, reserve the top of the bar for Cloud sync so we never sit at 100% while still uploading.
   */
  const reportInnerEncryptProgress = useCallback(async (done, total, label = '', { maxPercent = 100 } = {}) => {
    const safeTotal = Math.max(1, Number(total) || 1);
    const safeDone = Math.max(0, Math.min(safeTotal, Number(done) || 0));
    const cap = Math.max(1, Math.min(100, Math.round(Number(maxPercent) || 100)));
    const percent = Math.min(cap, Math.round((safeDone / safeTotal) * cap));
    setInnerEncryptProgressPercent(percent);
    setInnerEncryptProgressLabel(String(label || ''));
    // Yield so React can paint before the next Argon2 / network call blocks the tab.
    await new Promise((resolve) => {
      window.setTimeout(resolve, 0);
    });
  }, []);

  /**
   * OneDrive vault.db flush after PIN work. Uses 85→99% while uploading; 100% only when finished.
   * Must not block the busy dialog forever — axios has no default timeout and Cloud upload can hang.
   * Notes are already on disk; background upload + logoff still retry.
   */
  const flushOneDriveAfterInnerPin = useCallback(
    async ({ showErrorOnFail = false, startPercent = 85 } = {}) => {
      if (paneStorageType !== 'onedrive') return { ok: true, timedOut: false };
      const floor = Math.max(0, Math.min(98, Math.round(Number(startPercent) || 85)));
      const mapCloudPercent = (p) => {
        const cloud = Math.max(0, Math.min(100, Math.round(Number(p) || 0)));
        return Math.min(99, floor + Math.round((cloud / 100) * (99 - floor)));
      };
      setInnerEncryptProgressPercent(floor);
      setInnerEncryptProgressLabel('Saving to Cloud…');
      await new Promise((resolve) => {
        window.setTimeout(resolve, 0);
      });
      const SYNC_TIMEOUT_MS = 45000;
      let timerId = 0;
      try {
        await Promise.race([
          vaultApi.syncRecordVaultStorage({
            onProgress: ({ percent, label } = {}) => {
              setInnerEncryptProgressPercent(mapCloudPercent(percent));
              if (label != null && String(label).trim()) {
                setInnerEncryptProgressLabel(String(label).trim());
              }
            }
          }),
          new Promise((_, reject) => {
            timerId = window.setTimeout(() => {
              reject(new Error('Cloud sync is taking too long'));
            }, SYNC_TIMEOUT_MS);
          })
        ]);
        setInnerEncryptProgressPercent(100);
        setInnerEncryptProgressLabel('Done');
        return { ok: true, timedOut: false };
      } catch (syncErr) {
        const timedOut = /taking too long/i.test(String(syncErr?.message || ''));
        if (showErrorOnFail && !timedOut) {
          setInnerEncryptError(
            readRecordVaultApiError(
              syncErr,
              'Note locked locally, but Cloud sync failed. Click Log off Cloud to save, then reopen.'
            )
          );
          return { ok: false, timedOut: false };
        }
        // Timeout / soft fail: local PIN work already persisted; do not leave the dialog stuck.
        setInnerEncryptProgressPercent(100);
        setInnerEncryptProgressLabel(timedOut ? 'Saved locally — Cloud sync continues…' : 'Done');
        return { ok: true, timedOut };
      } finally {
        if (timerId) window.clearTimeout(timerId);
      }
    },
    [paneStorageType, vaultApi]
  );

  /** Run the enable/lock (encrypt) or unlock (decrypt) flow for note or notebook scope. */
  const submitInnerPinForMode = useCallback(
    async (mode, noteId, pin) => {
      if (!isValidInnerEncryptPin(pin)) {
        setInnerEncryptError('PIN must be exactly 6 digits');
        return false;
      }
      const id = Number(noteId);
      const notebookScope = innerEncryptDialog.scope === 'notebook';
      const scopeNotebook = notebookScope
        ? notebooks.find((nb) => Number(nb.notebook_id) === Number(innerEncryptDialog.notebookId)) ||
          findNoteRowById(id).notebook
        : null;
      const siblingNotes = notebookScope ? scopeNotebook?.notes || [] : [];
      const busyVerb = mode === 'unlock' ? 'Decrypting' : 'Encrypting';
      const noteProgressName = (row, fallbackId) => {
        const name = noteTitlePlainText(row?.note_name);
        if (name) return name;
        const idNum = Number(fallbackId ?? row?.note_id);
        return Number.isFinite(idNum) && idNum >= 1 ? `Note ${idNum}` : 'note';
      };
      // OneDrive: keep 0–85% for local PIN work; Cloud sync owns 85–100%.
      const localMaxPercent = paneStorageType === 'onedrive' ? 85 : 100;
      const progressOpts = { maxPercent: localMaxPercent };
      setInnerEncryptError('');
      setInnerEncryptBusy(true);
      setInnerEncryptProgressPercent(0);
      setInnerEncryptProgressLabel('');
      const startedAt = Date.now();
      let ok = false;
      try {
        if (mode === 'enable' || mode === 'lock') {
          if (notebookScope) {
            const lockTargets = siblingNotes.filter((row) => {
              const rid = Number(row.note_id);
              return !(noteHasInnerEncryption(row) && !isInnerNoteUnlocked(rid));
            });
            const totalNotes = Math.max(1, lockTargets.length);
            let lockedAny = false;
            for (let i = 0; i < lockTargets.length; i += 1) {
              const row = lockTargets[i];
              const rid = Number(row.note_id);
              const progressLabel = `${busyVerb} note ${i + 1} of ${lockTargets.length}: ${noteProgressName(row, rid)}`;
              // Paint "note N of M: name" at the previous % before Argon2 blocks the main thread.
              await reportInnerEncryptProgress(i, totalNotes, progressLabel, progressOpts);
              const override =
                rid === Number(selectedNote?.note_id) ? getCurrentNoteHtml() : null;
              // force: lock every note in the notebook (even empty ones) so all
              // note names are hidden and the whole notebook gates as one unit.
              const res = await encryptOneNoteWithPin(row, pin, override, { force: true });
              if (res != null) lockedAny = true;
              await reportInnerEncryptProgress(i + 1, totalNotes, progressLabel, progressOpts);
            }
            if (!lockedAny) {
              setInnerEncryptError(
                'Notebook has no notes to protect. Add a note first, then try again.'
              );
              return false;
            }
            const syncResult = await flushOneDriveAfterInnerPin({
              showErrorOnFail: true,
              startPercent: localMaxPercent
            });
            if (!syncResult.ok) {
              ok = true;
              return false;
            }
          } else {
            const targetNote = findNoteRowById(id).note || selectedNote;
            const singleLabel = `${busyVerb}: ${noteProgressName(targetNote, id)}`;
            await reportInnerEncryptProgress(0, 1, singleLabel, progressOpts);
            const override =
              Number(targetNote?.note_id) === Number(selectedNote?.note_id)
                ? getCurrentNoteHtml()
                : null;
            const res = await encryptOneNoteWithPin(targetNote, pin, override);
            if (res == null) {
              setInnerEncryptError(
                'Note has nothing to protect. Add text, a photo, or a file first, then try again.'
              );
              return false;
            }
            await reportInnerEncryptProgress(1, 1, singleLabel, progressOpts);
            const syncResult = await flushOneDriveAfterInnerPin({
              showErrorOnFail: true,
              startPercent: localMaxPercent
            });
            if (!syncResult.ok) {
              ok = true;
              return false;
            }
          }
          ok = true;
          return true;
        }

        if (mode === 'unlock') {
          const targetRow =
            (notebookScope
              ? siblingNotes.find((n) => Number(n.note_id) === id)
              : findNoteRowById(id).note) ||
            selectedNote;
          const until = resolveInnerUnlockLockedUntilMs({
            storageType: paneStorageType,
            singlesId: user?.singles_id,
            noteId: id,
            vaultLockedUntil: targetRow?.inner_unlock_locked_until
          });
          const waitSec = remainingInnerUnlockLockoutSeconds(until);
          if (waitSec > 0) {
            setInnerUnlockCooldownSec(waitSec);
            setInnerEncryptError(
              `Wait ${formatInnerUnlockLockoutLabel(waitSec)} before trying again.`
            );
            return false;
          }
          if (notebookScope) {
            const siblingUnlockRows = siblingNotes.filter((row) => {
              const rid = Number(row.note_id);
              if (rid === id) return false;
              return noteRequiresInnerPinToView(row) && !isInnerNoteUnlocked(rid);
            });
            const totalNotes = Math.max(1, 1 + siblingUnlockRows.length);
            const firstLabel = `${busyVerb} note 1 of ${totalNotes}: ${noteProgressName(targetRow, id)}`;
            await reportInnerEncryptProgress(0, totalNotes, firstLabel, progressOpts);
            await unlockInnerEncryptedNote(id, pin, targetRow);
            await reportInnerEncryptProgress(1, totalNotes, firstLabel, progressOpts);
            for (let i = 0; i < siblingUnlockRows.length; i += 1) {
              const row = siblingUnlockRows[i];
              const noteOrdinal = i + 2;
              const progressLabel = `${busyVerb} note ${noteOrdinal} of ${totalNotes}: ${noteProgressName(row)}`;
              await reportInnerEncryptProgress(1 + i, totalNotes, progressLabel, progressOpts);
              try {
                await unlockInnerEncryptedNote(Number(row.note_id), pin, row);
              } catch {
                // Sibling notes may use a different PIN — leave them locked.
              }
              await reportInnerEncryptProgress(2 + i, totalNotes, progressLabel, progressOpts);
            }
            await flushOneDriveAfterInnerPin({
              showErrorOnFail: false,
              startPercent: localMaxPercent
            });
          } else {
            const singleLabel = `${busyVerb}: ${noteProgressName(targetRow, id)}`;
            await reportInnerEncryptProgress(0, 1, singleLabel, progressOpts);
            await unlockInnerEncryptedNote(id, pin, targetRow);
            await reportInnerEncryptProgress(1, 1, singleLabel, progressOpts);
            await flushOneDriveAfterInnerPin({
              showErrorOnFail: false,
              startPercent: localMaxPercent
            });
          }
          ok = true;
          return true;
        }
        return false;
      } catch (err) {
        setInnerEncryptError(err?.message || 'Inner encryption failed');
        return false;
      } finally {
        if (ok) {
          setInnerEncryptProgressPercent(100);
          setInnerEncryptProgressLabel('Done');
          const elapsed = Date.now() - startedAt;
          const waitMs = Math.max(0, LOCK_GIF_CYCLE_MS - elapsed);
          if (waitMs > 0) {
            await new Promise((resolve) => {
              window.setTimeout(resolve, waitMs);
            });
          }
        }
        setInnerEncryptBusy(false);
        setInnerEncryptProgressPercent(0);
        setInnerEncryptProgressLabel('');
      }
    },
    [
      innerEncryptDialog.scope,
      innerEncryptDialog.notebookId,
      notebooks,
      findNoteRowById,
      selectedNote,
      noteHasInnerEncryption,
      isInnerNoteUnlocked,
      getCurrentNoteHtml,
      encryptOneNoteWithPin,
      paneStorageType,
      user?.singles_id,
      unlockInnerEncryptedNote,
      noteRequiresInnerPinToView,
      reportInnerEncryptProgress,
      flushOneDriveAfterInnerPin
    ]
  );

  const handleInnerEncryptSubmit = useCallback(
    async (pin) => {
      const { mode, noteId } = innerEncryptDialog;
      const success = await submitInnerPinForMode(mode, noteId, pin);
      if (success) setInnerEncryptDialog((d) => ({ ...d, open: false }));
    },
    [innerEncryptDialog, submitInnerPinForMode]
  );

  /** Red lock icon on a note row: lock (encrypt) if open/plain, else unlock (decrypt). */
  const handleToggleNoteLock = useCallback(
    (noteRow) => {
      if (busy || innerEncryptBusy || !noteRow) return;
      const id = Number(noteRow.note_id);
      const locked = noteRequiresInnerPinToView(noteRow) && !isInnerNoteUnlocked(id);
      openInnerEncryptDialog(locked ? 'unlock' : 'enable', 'note', { noteId: id });
    },
    [busy, innerEncryptBusy, noteRequiresInnerPinToView, isInnerNoteUnlocked, openInnerEncryptDialog]
  );

  /** Red lock icon on a notebook row: lock/unlock every note in the notebook. */
  const handleToggleNotebookLock = useCallback(
    (notebook) => {
      if (busy || innerEncryptBusy || !notebook) return;
      const notes = notebook.notes || [];
      const nbId = Number(notebook.notebook_id);
      if (notebookInnerLockedForDisplay(notes)) {
        const target = notes.find(
          (n) => noteRequiresInnerPinToView(n) && !isInnerNoteUnlocked(n.note_id)
        );
        openInnerEncryptDialog('unlock', 'notebook', {
          noteId: target?.note_id,
          notebookId: nbId
        });
      } else {
        openInnerEncryptDialog('enable', 'notebook', {
          noteId: notes[0]?.note_id,
          notebookId: nbId
        });
      }
    },
    [
      busy,
      innerEncryptBusy,
      notebookInnerLockedForDisplay,
      noteRequiresInnerPinToView,
      isInnerNoteUnlocked,
      openInnerEncryptDialog
    ]
  );

  /** Red lock icon on a shortcut row: delegate to its note or notebook target. */
  const handleToggleShortcutLock = useCallback(
    (shortcut) => {
      if (!shortcut) return;
      const nb = notebooks.find(
        (n) => Number(n.notebook_id) === Number(shortcut.notebook_id)
      );
      if (shortcut.target_type === 'notebook') {
        if (nb) handleToggleNotebookLock(nb);
        return;
      }
      const note = (nb?.notes || []).find(
        (n) => Number(n.note_id) === Number(shortcut.note_id)
      );
      if (note) handleToggleNoteLock(note);
    },
    [notebooks, handleToggleNotebookLock, handleToggleNoteLock]
  );


  const selectNoteId = useCallback((noteId, { fromNotebook = false } = {}) => {
    const next = Number(noteId);
    if (!isSelectableNoteId(next)) return;
    replaceMultiSelectedNoteIds([]);
    noteMultiSelectAnchorIdRef.current = next;
    if (Number(selectedNoteIdRef.current) === next) {
      if (!fromNotebook) setInnerEncryptUiScope('note');
      setNoteContentLoading(false);
      return;
    }
    // Bill Schedule notes are local panels — no vault body fetch.
    if (isBillScheduleSystemId(next)) {
      void (async () => {
        const prevNoteId = selectedNoteIdRef.current;
        if (prevNoteId && !isBillScheduleSystemId(prevNoteId)) {
          if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
          }
          try {
            skipSaveRef.current = false;
            await persistNoteRef.current?.();
          } catch {
            // allow switch even if save failed
          }
        }
        loadedNoteIdRef.current = next;
        loadedDraftKeyRef.current = '';
        loadedTitleKeyRef.current = '';
        hydratedDraftKeyRef.current = '';
        setEditingNoteId(null);
        setEditingNotebookId(null);
        setInnerEncryptUiScope(fromNotebook ? 'notebook' : 'note');
        setRenameUiSurface(null);
        setOpenNoteTitlePlain('');
        draftRef.current = { openNoteTitlePlain: '' };
        setNoteContentLoading(false);
        setSelectedNoteId(next);
      })();
      return;
    }
    // OneDrive/USB note body fetch can take seconds — show hourglass on click, not after await.
    setNoteContentLoading(true);
    void (async () => {
      const prevNoteId = selectedNoteIdRef.current;
      // Flush debounced body edits before leaving the note (typing → click PPP →
      // back must keep what was typed). Clear the timer so a late debounce cannot
      // PATCH after hydration refs are cleared / the next note is selected.
      if (prevNoteId) {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        try {
          skipSaveRef.current = false;
          await persistNoteRef.current?.();
        } catch {
          // allow switch even if save failed
        }
      }
      loadedNoteIdRef.current = null;
      loadedDraftKeyRef.current = '';
      loadedTitleKeyRef.current = '';
      hydratedDraftKeyRef.current = '';
      setEditingNoteId(null);
      setEditingNotebookId(null);
      setInnerEncryptUiScope(fromNotebook ? 'notebook' : 'note');
      setRenameUiSurface(null);
      setOpenNoteTitlePlain('');
      draftRef.current = { openNoteTitlePlain: '' };
      setSelectedNoteId(next);
    })();
  }, [replaceMultiSelectedNoteIds]);

  /** Shift+click range select in the current notebook's notes list (does not change the open note). */
  const handleNoteShiftSelect = useCallback(
    (noteId) => {
      const clicked = Number(noteId);
      if (!Number.isFinite(clicked) || clicked < 1) return;
      const notes = selectedNotebook?.notes || [];
      const orderedIds = notes
        .map((n) => Number(n.note_id))
        .filter((id) => Number.isFinite(id) && id > 0);

      if (!orderedIds.length) return;

      let anchor = Number(noteMultiSelectAnchorIdRef.current);
      if (!Number.isFinite(anchor) || anchor < 1) {
        anchor = Number(selectedNoteIdRef.current);
      }
      if (!Number.isFinite(anchor) || anchor < 1 || !orderedIds.includes(anchor)) {
        anchor = clicked;
      }
      noteMultiSelectAnchorIdRef.current = anchor;

      const a = orderedIds.indexOf(anchor);
      const b = orderedIds.indexOf(clicked);
      if (a < 0 || b < 0) {
        replaceMultiSelectedNoteIds([clicked]);
        return;
      }
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      replaceMultiSelectedNoteIds(orderedIds.slice(lo, hi + 1));
    },
    [selectedNotebook, replaceMultiSelectedNoteIds]
  );








  const isNoteHiddenFromSearch = useCallback(
    (note, notebookNotes) => {
      if (!note) return true;
      // Fully PIN-locked notebook (red *****) — hide every note name from search.
      if (notebookInnerLockedForDisplay(notebookNotes)) return true;
      // Individually locked note — hide until unlocked/decrypted.
      if (noteRequiresInnerPinToView(note) && !isInnerNoteUnlocked(note.note_id)) return true;
      return false;
    },
    [isInnerNoteUnlocked, notebookInnerLockedForDisplay, noteRequiresInnerPinToView]
  );

  const runSearch = useCallback(async () => {
    const t1 = searchTerm1.trim();
    const t2 = searchTerm2.trim();
    if (!t1 && !t2) {
      setAppliedSearchTerms([]);
      setSearchResults(null);
      setSearchMessage('');
      return;
    }
    setAppliedSearchTerms([t1, t2].filter(Boolean));
    setSearchBusy(true);
    setError('');
    try {
      const results = await vaultApi.searchRecordVaultNotes({
        q1: t1,
        q2: t2,
        q3: '',
        op1: searchOp1,
        op2: 'and'
      });
      const noteById = new Map();
      for (const notebook of notebooks) {
        for (const note of notebook.notes || []) {
          noteById.set(Number(note.note_id), { note, notebook });
        }
      }
      const excludeLockedIds = new Set();
      for (const [noteId, { note, notebook }] of noteById) {
        if (isNoteHiddenFromSearch(note, notebook.notes || [])) {
          excludeLockedIds.add(noteId);
          removeNoteSearchIndex(noteId);
        }
      }

      // Full-text search needs every note's decrypted body in the local index, but
      // that index only holds notes that have been opened. Encrypted bodies can't
      // be read by the backend, so notes never opened would be missed. Load + index
      // any searchable (non-PIN-locked) note that isn't cached yet before matching.
      const notesToIndex = [];
      for (const [noteId, { note }] of noteById) {
        if (excludeLockedIds.has(noteId)) continue;
        if (noteHasInnerEncryption(note) && !isInnerNoteUnlocked(noteId)) continue;
        if (getIndexedNoteText(noteId)) continue;
        notesToIndex.push(noteId);
      }
      if (notesToIndex.length) {
        const CONCURRENCY = 5;
        let cursor = 0;
        const indexWorker = async () => {
          while (cursor < notesToIndex.length) {
            const noteId = notesToIndex[cursor];
            cursor += 1;
            try {
              const fresh = await vaultApi.fetchRecordVaultNote(noteId);
              const body = fresh?.body_text;
              if (body == null || isRecordVaultInnerEncryptedBody(body)) continue;
              const meta = noteById.get(noteId);
              indexNoteSearchText(noteId, stripRecordVaultHtml(body), meta?.note?.note_name || '');
            } catch {
              // Skip notes that fail to load; they just stay unindexed this pass.
            }
          }
        };
        await Promise.all(
          Array.from({ length: Math.min(CONCURRENCY, notesToIndex.length) }, indexWorker)
        );
      }

      const ids = new Set();
      const merged = [];
      for (const row of results) {
        const noteId = Number(row.note_id);
        if (excludeLockedIds.has(noteId)) continue;
        const found = noteById.get(noteId);
        if (found && isNoteHiddenFromSearch(found.note, found.notebook.notes || [])) continue;
        ids.add(noteId);
        merged.push(row);
      }
      for (const query of [t1, t2].filter(Boolean)) {
        for (const hit of searchIndexedNotes(query, { excludeNoteIds: excludeLockedIds })) {
          if (ids.has(hit.noteId)) continue;
          const found = noteById.get(hit.noteId);
          if (!found) continue;
          if (isNoteHiddenFromSearch(found.note, found.notebook.notes || [])) continue;
          ids.add(hit.noteId);
          merged.push({
            note_id: hit.noteId,
            notebook_id: found.notebook.notebook_id,
            note_name: found.note.note_name || hit.title
          });
        }
      }
      setSearchResults(merged);
      setSearchMessage(merged.length ? `${merged.length} note(s) found` : 'No notes match your search');
      if (merged.length > 0) {
        // Keep the note the user has navigated to when it's still a match. This
        // effect re-runs whenever `notebooks` changes (e.g. saving the previous
        // note on a doc switch), and blindly re-selecting merged[0] would snap
        // navigation back to the first result on every ◀/▶ jump.
        const currentNoteId = Number(selectedNoteIdRef.current);
        const stillMatches = merged.some((row) => Number(row.note_id) === currentNoteId);
        if (!stillMatches) {
          setSelectedNotebookId(merged[0].notebook_id);
          selectNoteId(merged[0].note_id);
        }
        setLeftMenuOpen(true);
        setRightMenuOpen(true);
      }
    } catch (err) {
      setSearchResults([]);
      setSearchMessage('');
      setError(readRecordVaultApiError(err, 'Search failed'));
    } finally {
      setSearchBusy(false);
    }
  }, [
    isNoteHiddenFromSearch,
    noteHasInnerEncryption,
    isInnerNoteUnlocked,
    notebooks,
    searchOp1,
    searchTerm1,
    searchTerm2,
    selectNoteId,
    vaultApi
  ]);

  const handleClearSearch = useCallback(() => {
    setSearchTerm1('');
    setSearchTerm2('');
    setSearchOp1('and');
    setAppliedSearchTerms([]);
    setSearchResults(null);
    setSearchMessage('');
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchUserCustomization()
      .then((prefs) => {
        if (cancelled) return;
        setMenuButtonFontRem(
          recordVaultMenuButtonFontRemFromTenths(
            prefs.mynoteFontSize ?? RECORD_VAULT_DEFAULT_MENU_BUTTON_FONT_SIZE_TENTHS,
            defaultMenuButtonFontRem
          )
        );
        setNoteFontSizePt(
          normalizeRecordVaultFontSizePt(
            prefs.mynoteEditorFontSizePt ?? RECORD_VAULT_DEFAULT_FONT_SIZE_PT
          )
        );
        setNoteFontStyleIndex(
          prefs.mynoteFontColorIndex ?? RECORD_VAULT_DEFAULT_FONT_STYLE_INDEX
        );
        setNoteContentBgIndex(
          prefs.mynoteContentBgIndex ?? RECORD_VAULT_DEFAULT_CONTENT_BG_INDEX
        );
        // Legacy default was white (1) — that painted a white “input box” around note text.
        const loadedHighlight = prefs.mynoteTextHighlightIndex;
        const nextHighlight =
          loadedHighlight == null || Number(loadedHighlight) === 1
            ? null
            : loadedHighlight;
        setNoteTextBgIndex(nextHighlight ?? RECORD_VAULT_DEFAULT_TEXT_HIGHLIGHT_INDEX);
        if (Number(loadedHighlight) === 1) {
          scheduleSaveMynotePrefs({ mynoteTextHighlightIndex: null });
        }
        pendingMynoteRestoreRef.current = {
          applied: false,
          notebookId: prefs.mynoteLastNotebookId,
          noteId: prefs.mynoteLastNoteId,
          scrollTop: prefs.mynoteNoteScrollTop,
          caretPos: prefs.mynoteEditorCaretPos
        };
      })
      .catch(() => {
        // keep env default
      });
    return () => {
      cancelled = true;
      if (menuButtonFontSaveTimerRef.current) {
        window.clearTimeout(menuButtonFontSaveTimerRef.current);
      }
      if (mynotePrefsSaveTimerRef.current) {
        window.clearTimeout(mynotePrefsSaveTimerRef.current);
      }
    };
  }, [defaultMenuButtonFontRem, scheduleSaveMynotePrefs]);










  const loadTree = useCallback(async ({ preferNotebookId, preferNoteId, silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    if (!silent) loadedNoteIdRef.current = null;
    try {
      const { notebooks: tree, shortcuts: loadedShortcuts } = await vaultApi.fetchRecordVaultTree();
      setNotebooks(tree);
      setShortcuts(loadedShortcuts);

      const currentNotebookId = selectedNotebookIdRef.current;
      const currentNoteId = selectedNoteIdRef.current;
      const notebookId =
        preferNotebookId ??
        (tree.some((nb) => Number(nb.notebook_id) === Number(currentNotebookId))
          ? currentNotebookId
          : tree[0]?.notebook_id ?? null);
      const notebook = tree.find((nb) => Number(nb.notebook_id) === Number(notebookId)) ?? tree[0] ?? null;
      setSelectedNotebookId(notebook?.notebook_id ?? null);

      const notes = notebook?.notes || [];
      const noteId =
        preferNoteId ??
        (notes.some((n) => Number(n.note_id) === Number(currentNoteId)) ? currentNoteId : notes[0]?.note_id ?? null);
      setSelectedNoteId(noteId);
      // Refresh status-bar Usb/ui tx/rx counts after tree open / mutations.
      window.setTimeout(() => {
        void refreshVaultUsageRef.current?.();
      }, 400);
    } catch (err) {
      if (isRecordVaultUsbRequiredError(err)) {
        // Session gone (restart, bridge drop, etc.) — leave workspace and show USB/Cloud login.
        setError('');
        setRecordVaultBridgeStorageType(null);
        onSessionEnded?.();
        return;
      }
      setError(readRecordVaultApiError(err, 'Failed to load Record Vault'));
    } finally {
      if (!silent) {
        setLoading(false);
        setVaultUiReady(true);
      }
    }
  }, [vaultApi, onSessionEnded]);

  useEffect(() => {
    const onReload = (event) => {
      const st = String(event?.detail?.storageType || '').toLowerCase();
      if (st && st !== paneStorageType) return;
      void loadTree({
        preferNotebookId: selectedNotebookIdRef.current,
        preferNoteId: selectedNoteIdRef.current,
        silent: true
      });
    };
    window.addEventListener(RECORD_VAULT_TREE_RELOAD_EVENT, onReload);
    return () => window.removeEventListener(RECORD_VAULT_TREE_RELOAD_EVENT, onReload);
  }, [loadTree, paneStorageType]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await fetchRecordVaultStorageConfig();
        if (cancelled) return;
        setOneDriveOffered(Boolean(cfg.oneDrive?.visible && cfg.oneDrive?.enabled));
        setLocalUsbOffered(Boolean(cfg.localUsb?.visible && cfg.localUsb?.enabled));
        setVideoTutorialUrl(String(cfg?.videoTutorialTutanotes || '').trim());
        if (cfg.oneDrive?.visible && cfg.oneDrive?.enabled) {
          try {
            const oneDriveCfg = await fetchRecordVaultOneDriveConfig();
            if (!cancelled && oneDriveCfg?.folderName) {
              setOneDriveVaultFolderName(String(oneDriveCfg.folderName));
            }
          } catch {
            // keep default folder name
          }
        }
      } catch (err) {
        if (cancelled) return;
        const status = Number(err?.response?.status);
        if (status === 404) {
          setOneDriveOffered(true);
          setLocalUsbOffered(true);
          return;
        }
        setOneDriveOffered(false);
      } finally {
        if (!cancelled) setStorageConfigLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setRecordVaultBridgeSinglesId(user?.singles_id ?? null);
  }, [user?.singles_id]);

  useEffect(() => {
    void probeRecordVaultBridge();
    const timerId = window.setInterval(() => {
      void probeRecordVaultBridge();
    }, 5000);
    return () => window.clearInterval(timerId);
  }, []);

  /** View USB: green when local bridge is up and the unlocked USB mount is still reachable. */
  useEffect(() => {
    if (!unlocked || paneStorageType !== 'usb') {
      setUsbBridgeHealthy(false);
      return undefined;
    }
    let cancelled = false;
    const refreshUsbBridgeHealth = async () => {
      const probe = await probeRecordVaultBridge();
      if (cancelled) return;
      if (!probe.ok) {
        setUsbBridgeHealthy(false);
        return;
      }
      try {
        const [status, locations] = await Promise.all([
          fetchRecordVaultUsbStatus(),
          fetchRecordVaultUsbLocations()
        ]);
        if (cancelled) return;
        const unlockedSession = Boolean(status?.session?.unlocked);
        if (!unlockedSession) {
          setUsbBridgeHealthy(false);
          setRecordVaultBridgeStorageType(null);
          onSessionEnded?.();
          return;
        }
        const mountPath = String(status?.session?.mountPath || '').trim();
        const mountStillPresent =
          !mountPath ||
          (Array.isArray(locations) &&
            locations.some((loc) => String(loc?.mountPath || '').trim() === mountPath));
        setUsbBridgeHealthy(unlockedSession && mountStillPresent);
      } catch {
        if (!cancelled) setUsbBridgeHealthy(false);
      }
    };
    void refreshUsbBridgeHealth();
    const timerId = window.setInterval(() => {
      void refreshUsbBridgeHealth();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timerId);
    };
  }, [unlocked, paneStorageType, onSessionEnded]);

  useEffect(() => {
    if (!unlocked) {
      setLoading(false);
      setVaultUiReady(true);
      return undefined;
    }
    setRecordVaultBridgeStorageType(paneStorageType);
    const pending = pendingMynoteRestoreRef.current;
    void loadTree({
      preferNotebookId: pending?.notebookId ?? undefined,
      preferNoteId: pending?.noteId ?? undefined
    });
  }, [unlocked, paneStorageType, loadTree]);

  useEffect(() => {
    if (!unlocked || !selectedNoteId) {
      setNoteContentLoading(false);
      return undefined;
    }
    const id = Number(selectedNoteId);
    if (isBillScheduleSystemId(id)) {
      setNoteContentLoading(false);
      loadedNoteIdRef.current = id;
      return undefined;
    }
    if (selectedNote?.content_loaded && selectedNote.body_text != null) {
      loadedNoteIdRef.current = id;
      setNoteContentLoading(false);
      return undefined;
    }
    let cancelled = false;
    void (async () => {
      setNoteContentLoading(true);
      setError('');
      try {
        await loadNoteContent(id);
        if (!cancelled) loadedNoteIdRef.current = id;
      } catch (err) {
        if (!cancelled) {
          setError(readRecordVaultApiError(err, 'Failed to load note'));
        }
      } finally {
        if (!cancelled) setNoteContentLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unlocked, selectedNoteId, selectedNote, loadNoteContent]);

  // Push the resolved note body into the TipTap editor once per note/lock-state.
  // Guarded by a hydration key so autosave (which updates body_text in the tree)
  // never re-clobbers the caret while the user is typing.
  useEffect(() => {
    const api = noteEditorApiRef.current;
    if (!api) return;
    if (!selectedNote) {
      if (editorHydratedRef.current.key !== 'none') {
        editorHydratedRef.current.key = 'none';
        hydratedDraftKeyRef.current = '';
        api.setContent('<p></p>', false);
      }
      return;
    }
    const id = Number(selectedNote.note_id);
    const locked = noteRequiresInnerPinToView(selectedNote) && !isInnerNoteUnlocked(id);
    if (!locked && !selectedNote.content_loaded) return;
    // Bump clean-vN when title-strip rules change so already-open notes rehydrate.
    const key = `${id}:${locked ? 'locked' : 'open'}:clean-v3`;
    if (editorHydratedRef.current.key === key) return;
    editorHydratedRef.current.key = key;
    // Track which note the editor holds so switch/flush paths know a draft is live.
    hydratedDraftKeyRef.current = locked
      ? ''
      : `${Number(selectedNotebookIdRef.current) || 0}:${id}`;
    if (locked) {
      api.setContent('<p></p>', false);
    } else {
      const notesInNotebook = selectedNotebook?.notes || [];
      const titlePlain =
        noteTitlePlainText(resolveRecordVaultNoteTitle(selectedNote, notebooks, notesInNotebook)) ||
        noteTitlePlainText(selectedNote.note_name) ||
        String(draftRef.current?.openNoteTitlePlain || openNoteTitlePlain || '').trim();
      const rawBody = String(selectedNote.body_text ?? '');
      // Drop title-matching body rows (ignore [n]/[#]); leave title intact.
      const cleanedBody = cleanRecordVaultNoteBodyHtml(rawBody, titlePlain);
      api.setContent(cleanedBody || '<p></p>', true);
      if (cleanedBody !== rawBody) {
        patchNoteRowInTree(id, { body_text: cleanedBody, content_loaded: true });
        void vaultApi.updateRecordVaultNote(id, { body_text: cleanedBody }).catch(() => {
          // Keep the cleaned editor view even if persist fails; next save retries.
        });
      }
    }
  }, [
    selectedNote,
    selectedNotebook,
    notebooks,
    editorReadyTick,
    innerUnlockVersion,
    noteRequiresInnerPinToView,
    isInnerNoteUnlocked,
    patchNoteRowInTree,
    vaultApi
  ]);

  // Highlight (and scroll to) the active search terms inside the open note body.
  // Runs after the hydration effect above so decorations land on real content.
  useEffect(() => {
    const api = noteEditorApiRef.current;
    if (!api?.applySearchHighlight) return;
    const count = api.applySearchHighlight(activeSearchTerms) || 0;
    setSearchHitCount(count);
    setActiveHitIndex(count > 0 ? 0 : -1);
  }, [activeSearchTerms, selectedNote, editorReadyTick, innerUnlockVersion]);

  // Reopen the title in blinking-highlight (read-only) mode whenever the note
  // changes or a new search begins, so title matches are visible immediately.
  useEffect(() => {
    setTitleEditing(false);
  }, [selectedNoteId, searchActive]);

  useEffect(() => {
    const noteId = Number(selectedNoteId);
    setInlineUnlockPin('');
    setInlineUnlockPinVisible(false);
    setInlineInnerPinMode(null);
    setInnerEncryptError('');
    setInnerUnlockCooldownSec(0);
    // Drop transient encrypt/decrypt GIF markers for other notes.
    Object.keys(innerUnlockRef.current).forEach((key) => {
      const id = Number(key);
      if (Number.isFinite(noteId) && noteId > 0 && id === noteId) return;
      delete innerUnlockRef.current[id];
    });
    bumpInnerUnlock();
  }, [selectedNoteId, bumpInnerUnlock]);

  // Wipe any legacy localStorage PIN leftovers — unencrypted notes never store a PIN.
  useEffect(() => {
    wipeAllPersistedInnerUnlockPins();
  }, []);

  // After tree load / remount: refresh menu locked/unlocked markers.
  useEffect(() => {
    if (!unlocked || !notebooks.length) return;
    bumpInnerUnlock();
  }, [unlocked, notebooks, bumpInnerUnlock]);
  useEffect(() => {
    if (!selectedNoteId || !selectedNotebookId) return undefined;
    scheduleSaveMynotePrefs();
    return undefined;
  }, [selectedNoteId, selectedNotebookId, scheduleSaveMynotePrefs]);

  useEffect(() => {
    if (!selectedNote) return undefined;
    const pending = pendingMynoteRestoreRef.current;
    if (pending.applied) return undefined;
    if (
      pending.notebookId != null &&
      Number(pending.notebookId) !== Number(selectedNotebookId)
    ) {
      return undefined;
    }
    if (pending.noteId != null && Number(pending.noteId) !== Number(selectedNoteId)) {
      return undefined;
    }
    const timerId = window.setTimeout(() => {
      if (contentScrollRef.current && pending.scrollTop != null) {
        contentScrollRef.current.scrollTop = pending.scrollTop;
      }
      pendingMynoteRestoreRef.current = { ...pending, applied: true };
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [selectedNote, selectedNotebookId, selectedNoteId]);

  useEffect(() => {
    if (!unlocked) {
      setVaultUsage(null);
      return undefined;
    }
    let cancelled = false;
    const loadUsage = async () => {
      try {
        const usage = await vaultApi.fetchRecordVaultUsage();
        if (!cancelled) setVaultUsage(usage);
        const email = String(usage?.onedriveEmail || '').trim();
        if (!cancelled && usage?.storageType === 'onedrive' && email) {
          try {
            await rememberRecordVaultOneDriveEmail(email);
          } catch {
            // ignore history save errors on main screen load
          }
        }
      } catch {
        if (!cancelled) setVaultUsage(null);
      }
    };
    refreshVaultUsageRef.current = loadUsage;
    void loadUsage();
    const timer = setInterval(() => void loadUsage(), 45000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [unlocked]);

  const bumpVaultUsage = useCallback(() => {
    if (bumpVaultUsageTimerRef.current) {
      window.clearTimeout(bumpVaultUsageTimerRef.current);
    }
    bumpVaultUsageTimerRef.current = window.setTimeout(() => {
      bumpVaultUsageTimerRef.current = null;
      void refreshVaultUsageRef.current?.();
    }, 2500);
  }, []);






  const reportVaultLeavingProgress = useCallback(async ({ percent, label } = {}) => {
    const next = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    // Never jump backward while logoff is running (stale poll can still return 0).
    setVaultLeavingProgressPercent((prev) => (next >= 100 ? 100 : Math.max(prev, next)));
    if (label != null && String(label).trim()) {
      setVaultLeavingProgressLabel(String(label).trim());
    }
    await new Promise((resolve) => {
      window.setTimeout(resolve, 0);
    });
  }, []);

  const performVaultStorageLogoff = useCallback(async () => {
    setVaultLeavingProgressPercent(1);
    setVaultLeavingProgressLabel(
      paneStorageType === 'onedrive' ? 'Saving notes to OneDrive…' : 'Logging off USB…'
    );
    await vaultApi.logoffRecordVaultStorage({
      onProgress: (progress) => {
        void reportVaultLeavingProgress(progress);
      }
    });
    setVaultLeavingProgressPercent(100);
    setVaultLeavingProgressLabel('Done');
    setRecordVaultBridgeStorageType(null);
    setNotebooks([]);
    setShortcuts([]);
    setSelectedNotebookId(null);
    setSelectedNoteId(null);
    onSessionEnded?.();
  }, [onSessionEnded, vaultApi, reportVaultLeavingProgress, paneStorageType]);

  const handleOneDriveVaultRestored = useCallback(async () => {
    await performVaultStorageLogoff();
  }, [performVaultStorageLogoff]);

  const handleUsbVaultRestoredOrFormatted = useCallback(async () => {
    await performVaultStorageLogoff();
  }, [performVaultStorageLogoff]);

  const handleLogOffPane = useCallback(async () => {
    if (busy || !unlocked) return;
    setBusy(true);
    setVaultLeaving(true);
    setVaultLeavingProgressPercent(1);
    setVaultLeavingProgressLabel(
      paneStorageType === 'onedrive' ? 'Saving notes to OneDrive…' : 'Logging off USB…'
    );
    setError('');
    try {
      await performVaultStorageLogoff();
    } catch (err) {
      setError(readRecordVaultApiError(err, 'Logoff failed'));
      setBusy(false);
      setVaultLeaving(false);
      setVaultLeavingProgressPercent(0);
      setVaultLeavingProgressLabel('');
      return;
    }
    setBusy(false);
    setVaultLeaving(false);
    setVaultLeavingProgressPercent(0);
    setVaultLeavingProgressLabel('');
  }, [busy, unlocked, performVaultStorageLogoff, paneStorageType]);

  const handleExitToMall = useCallback(async () => {
    if (busy) return;
    if (unlocked) {
      setBusy(true);
      setVaultLeaving(true);
      setVaultLeavingProgressPercent(1);
      setVaultLeavingProgressLabel(
        paneStorageType === 'onedrive' ? 'Saving notes to OneDrive…' : 'Logging off USB…'
      );
      setError('');
      try {
        await performVaultStorageLogoff();
      } catch (err) {
        setError(readRecordVaultApiError(err, 'Logoff failed'));
        setBusy(false);
        setVaultLeaving(false);
        setVaultLeavingProgressPercent(0);
        setVaultLeavingProgressLabel('');
        return;
      }
      setBusy(false);
      setVaultLeaving(false);
      setVaultLeavingProgressPercent(0);
      setVaultLeavingProgressLabel('');
    }
    navigate('/mall');
  }, [busy, unlocked, navigate, performVaultStorageLogoff, paneStorageType]);

  const logOffPaneLabel = paneStorageType === 'onedrive' ? 'Log off Cloud' : 'Log off USB';
  const usePaneLogOff = typeof onSessionEnded === 'function';

  useEffect(() => {
    let cancelled = false;
    void fetchUploadLimits()
      .then((limits) => {
        if (!cancelled && limits?.maxUploadMb) setMaxUploadMb(limits.maxUploadMb);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedNotebook) {
      setSelectedNoteId(null);
      setNoteContentLoading(false);
      return;
    }
    const notes = selectedNotebook.notes || [];
    if (!notes.length) {
      setSelectedNoteId(null);
      setNoteContentLoading(false);
      return;
    }
    if (!notes.some((n) => Number(n.note_id) === Number(selectedNoteId))) {
      const fromNotebook = notebookScopePendingRef.current;
      notebookScopePendingRef.current = false;
      // Prefer a still-locked note so notebook ***** unlock has a PIN target.
      const preferred =
        notes.find(
          (n) =>
            noteRequiresInnerPinToView(n) && !isInnerNoteUnlockedForDisplay(n.note_id)
        ) || notes[0];
      selectNoteId(preferred.note_id, { fromNotebook });
    } else if (notebookScopePendingRef.current) {
      notebookScopePendingRef.current = false;
      setInnerEncryptUiScope('notebook');
      // Notebook click kept the same open note — no OneDrive body fetch.
      setNoteContentLoading(false);
    }
  }, [
    selectedNotebook,
    selectedNoteId,
    selectNoteId,
    noteRequiresInnerPinToView,
    isInnerNoteUnlockedForDisplay
  ]);

  useEffect(() => {
    if (!selectedNote) {
      loadedTitleKeyRef.current = '';
      setOpenNoteTitlePlain('');
      return;
    }
    const titleKey = `${Number(selectedNotebookId) || 0}:${Number(selectedNote.note_id)}`;
    if (loadedTitleKeyRef.current === titleKey) return;
    loadedTitleKeyRef.current = titleKey;
    const notesInNotebook = selectedNotebook?.notes || [];
    setOpenNoteTitlePlain(resolveOpenNoteTitlePlain(selectedNote, notebooks, notesInNotebook));
  }, [selectedNote, selectedNotebookId, selectedNotebook, notebooks]);

  // Content editor removed: keep only the persisted note title in draftRef.
  // No body drafts are hydrated or written (note bodies on disk are left untouched).
  useEffect(() => {
    draftRef.current = { ...draftRef.current, openNoteTitlePlain };
  }, [openNoteTitlePlain]);

  const patchNoteTitleInTree = useCallback((noteId, plainTitle) => {
    const id = Number(noteId);
    if (!Number.isFinite(id) || id < 1) return;
    const plain = String(plainTitle ?? '').trim();
    setNotebooks((prev) =>
      prev.map((nb) => ({
        ...nb,
        notes: (nb.notes || []).map((n) =>
          Number(n.note_id) === id ? { ...n, note_name: plain } : n
        )
      }))
    );
    setSearchResults((prev) =>
      Array.isArray(prev)
        ? prev.map((r) => (Number(r.note_id) === id ? { ...r, note_name: plain } : r))
        : prev
    );
  }, []);

  // Debounced autosave for the note BODY only. The note name is handled separately
  // by the rename commit paths (see comment below). Guarded so it can never write an
  // empty/un-hydrated editor over real content.
  const persistNote = useCallback(async () => {
    if (!selectedNote || persistNoteInFlightRef.current) return;
    const noteId = Number(selectedNote.note_id);
    // The note NAME is deliberately NOT written here. Names are saved only by the
    // explicit, uniqueness-checked commit paths (title box blur/Enter and sidebar
    // rename). Writing the name from this debounced body autosave used the shared
    // `openNoteTitlePlain` state, which can lag behind the selected note during
    // quick navigation (several setSelectedNoteId call sites don't reset it) — so
    // one note's title got copied onto another, and it skipped the duplicate-name
    // check. Body-only autosave removes that whole class of "same title" bugs.
    const noteName = String(selectedNote.note_name ?? '');
    // Never overwrite an encrypted body while it is locked (would destroy ciphertext).
    const locked = noteHasInnerEncryption(selectedNote) && !isInnerNoteUnlocked(noteId);
    // CRITICAL: only save the body when the editor is actually showing THIS note's
    // loaded content. An un-hydrated editor returns an empty "<p></p>" from getHTML(),
    // so saving that would wipe real text — e.g. a debounced autosave firing during a
    // rename before the body finished loading. The hydration key is the single source
    // of truth for "the editor currently holds note N's loaded body".
    // Key format is `${noteId}:open:clean-vN` (see editor hydrate effect) — accept any
    // clean-v* suffix so bumping the hydrate version does not silently disable autosave.
    const hydratedKey = String(editorHydratedRef.current.key || '');
    const editorHoldsThisNote =
      loadedNoteIdRef.current === noteId &&
      (hydratedKey === `${noteId}:open` || hydratedKey.startsWith(`${noteId}:open:`));
    const html = !locked && editorHoldsThisNote ? noteEditorApiRef.current?.getHTML() ?? null : null;
    if (html == null) return;
    // Background autosave must not flip `busy` — that disables rename/menu clicks.
    persistNoteInFlightRef.current = true;
    setError('');
    try {
      await vaultApi.updateRecordVaultNote(noteId, { body_text: html });
      patchNoteRowInTree(noteId, { body_text: html, content_loaded: true });
      indexNoteSearchText(noteId, stripRecordVaultHtml(html), noteName);
    } catch (err) {
      setError(readRecordVaultApiError(err, 'Failed to save note'));
    } finally {
      persistNoteInFlightRef.current = false;
      bumpVaultUsage();
    }
  }, [
    selectedNote,
    noteHasInnerEncryption,
    isInnerNoteUnlocked,
    patchNoteRowInTree,
    bumpVaultUsage,
    vaultApi
  ]);

  persistNoteRef.current = persistNote;

  /**
   * Upload one dropped file to the selected note and embed it inline in the note
   * body at the drop location (instead of a separate list). The file bytes live
   * server-side keyed by the returned attachment id; the note body only keeps a
   * lightweight reference node.
   */
  const uploadNoteVaultFile = useCallback(
    async (file, coords) => {
      if (!selectedNote || !file || busy) return;
      const noteId = Number(selectedNote.note_id);
      if (!isAllowedRecordVaultFile(file)) {
        setError(`Unsupported vault file type: ${file.name || 'file'}`);
        return;
      }
      const maxBytes = (maxUploadMb || 20) * 1024 * 1024;
      if (file.size > maxBytes) {
        setError(`${file.name || 'File'} is over the ${maxUploadMb || 20} MB upload limit.`);
        return;
      }
      setBusy(true);
      setError('');
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const attachment = await vaultApi.uploadRecordVaultNoteAttachment(noteId, {
          file: dataUrl,
          file_name: recordVaultUploadFileName(file)
        });
        if (attachment) {
          setNotebooks((prev) =>
            prev.map((nb) => ({
              ...nb,
              notes: (nb.notes || []).map((note) =>
                Number(note.note_id) === noteId
                  ? { ...note, attachments: [...(note.attachments || []), attachment] }
                  : note
              )
            }))
          );
          noteEditorApiRef.current?.insertAttachmentAtCoords?.(
            {
              attachmentId: Number(attachment.attachment_id),
              fileName: attachment.file_name || '',
              fileExtension: attachment.file_extension || '',
              fileSizeBytes: attachment.file_size_bytes ?? null
            },
            coords
          );
        }
      } catch (err) {
        setError(readRecordVaultApiError(err, `Failed to upload ${file.name || 'file'}`));
      } finally {
        setBusy(false);
        bumpVaultUsage();
      }
    },
    [selectedNote, busy, maxUploadMb, vaultApi, bumpVaultUsage]
  );

  /**
   * Remove a vault attachment (server-side file) for the selected note. Returns
   * true on success so the inline node view can then delete itself from the body.
   */
  const handleDeleteVaultAttachment = useCallback(
    async (attachmentId) => {
      if (!selectedNote || busy) return false;
      const noteId = Number(selectedNote.note_id);
      const id = Number(attachmentId);
      if (!Number.isFinite(id) || id < 1) return false;
      setBusy(true);
      setError('');
      try {
        await vaultApi.deleteRecordVaultNoteAttachment(noteId, id);
        setNotebooks((prev) =>
          prev.map((nb) => ({
            ...nb,
            notes: (nb.notes || []).map((note) =>
              Number(note.note_id) === noteId
                ? {
                    ...note,
                    attachments: (note.attachments || []).filter(
                      (entry) => Number(entry.attachment_id) !== id
                    )
                  }
                : note
            )
          }))
        );
        return true;
      } catch (err) {
        setError(readRecordVaultApiError(err, 'Failed to remove vault file'));
        return false;
      } finally {
        setBusy(false);
        bumpVaultUsage();
      }
    },
    [busy, selectedNote, vaultApi, bumpVaultUsage]
  );

  const handleContentDragOver = useCallback((event) => {
    const types = event.dataTransfer?.types ? Array.from(event.dataTransfer.types) : [];
    // Outgoing note HTML export also carries Files — do not treat as OS import.
    if (
      types.includes(DRAG_NOTE) ||
      types.includes(DRAG_NOTEBOOK) ||
      types.includes(DRAG_SHORTCUT) ||
      types.includes(DRAG_CROSS_PANE)
    ) {
      return;
    }
    if (types.includes('Files')) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  /** Phone QR upload → fetch album photo → insert into open note body. */
  const handleMobilePhoneUploadComplete = useCallback(
    async (photosId) => {
      const id = Number(photosId);
      if (!selectedNote || !Number.isFinite(id) || id < 1) return;
      if (noteHasInnerEncryption(selectedNote) && !isInnerNoteUnlocked(selectedNote.note_id)) {
        setError('Unlock this note before adding a phone photo');
        return;
      }
      setBusy(true);
      setError('');
      try {
        const res = await api.get(`/api/photo/${id}`, { responseType: 'blob' });
        const image = await readFileAsDataUrl(res.data);
        noteEditorApiRef.current?.insertImage?.(image);
        setMobileUploadOpen(false);
      } catch (err) {
        setError(readRecordVaultApiError(err, 'Failed to add phone upload to note'));
      } finally {
        setBusy(false);
        bumpVaultUsage();
      }
    },
    [selectedNote, noteHasInnerEncryption, isInnerNoteUnlocked, bumpVaultUsage]
  );

  const scheduleSave = useCallback(() => {
    if (skipSaveRef.current || !selectedNote || noteContentLoading) return;
    if (noteHasInnerEncryption(selectedNote) && !isInnerNoteUnlocked(selectedNote.note_id)) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persistNote();
    }, 700);
  }, [persistNote, selectedNote, noteContentLoading, noteHasInnerEncryption, isInnerNoteUnlocked]);

  /** Flush debounced autosave before unmounting the editor (File → Payment). */
  const flushPendingNoteSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    try {
      skipSaveRef.current = false;
      await persistNoteRef.current?.();
    } catch {
      // Still switch views; persist errors already surface in the pane.
    }
  }, []);

  const openPaymentWorkspace = useCallback(() => {
    void (async () => {
      await flushPendingNoteSave();
      setProfilesRecordsInitialTab('profiles');
      setProfilesRecordsInitialTokens(null);
      setFileWorkspaceView('payment');
    })();
  }, [flushPendingNoteSave]);

  const openPaymentTokenCheckout = useCallback(
    (tokensBuying = 1) => {
      void (async () => {
        await flushPendingNoteSave();
        setProfilesRecordsInitialTab('buyTokens');
        setProfilesRecordsInitialTokens(Math.max(1, Math.trunc(Number(tokensBuying) || 1)));
        setFileWorkspaceView('payment');
      })();
    },
    [flushPendingNoteSave]
  );

  // Keep the inline attachment node views pointed at the open note so their
  // Launch/View/Download/Remove controls act on the right note + storage.
  useEffect(() => {
    const api = noteEditorApiRef.current;
    if (!api?.setAttachmentContext) return;
    api.setAttachmentContext({
      noteId: selectedNote ? Number(selectedNote.note_id) : null,
      storageType: paneStorageType,
      busy,
      onServerDelete: handleDeleteVaultAttachment
    });
  }, [selectedNote, paneStorageType, busy, handleDeleteVaultAttachment, editorReadyTick]);

  // Legacy vault files were stored only in a separate list. Now that files live
  // inline in the note body, append any file not yet referenced by an inline node
  // to the end of the body once per note load (nothing gets lost when the old
  // bottom list is gone). New drops already insert their node at the drop point.
  const attachmentBackfillRef = useRef({});
  useEffect(() => {
    const api = noteEditorApiRef.current;
    if (!api?.getAttachmentIds || !api?.appendAttachments) return;
    if (!selectedNote) return;
    const id = Number(selectedNote.note_id);
    const locked = noteRequiresInnerPinToView(selectedNote) && !isInnerNoteUnlocked(id);
    if (locked || !selectedNote.content_loaded) return;
    if (attachmentBackfillRef.current[id]) return;
    const atts = Array.isArray(selectedNote.attachments) ? selectedNote.attachments : [];
    attachmentBackfillRef.current[id] = true;
    if (!atts.length) return;
    const present = new Set(api.getAttachmentIds());
    const missing = atts.filter((a) => !present.has(String(a.attachment_id)));
    if (!missing.length) return;
    api.appendAttachments(
      missing.map((a) => ({
        attachmentId: Number(a.attachment_id),
        fileName: a.file_name || '',
        fileExtension: a.file_extension || '',
        fileSizeBytes: a.file_size_bytes ?? null
      }))
    );
    scheduleSave();
  }, [
    selectedNote,
    editorReadyTick,
    innerUnlockVersion,
    noteRequiresInnerPinToView,
    isInnerNoteUnlocked,
    scheduleSave
  ]);

  // ── File menu (Import / Export) ────────────────────────────────────────────
  // Read the open note's body straight from the TipTap editor. markdown uses the
  // tiptap-markdown extension serializer.
  const getEditorHtml = useCallback(() => noteEditorApiRef.current?.getHTML() ?? '', []);
  const getEditorMarkdown = useCallback(() => noteEditorApiRef.current?.getMarkdown() ?? '', []);

  // Replace the open note's body from an imported file, then autosave. setContent /
  // setMarkdown are applied with emitUpdate:false, so we trigger scheduleSave here.
  const handleImportHtml = useCallback(
    (html) => {
      const api = noteEditorApiRef.current;
      if (!api) return;
      const titlePlain =
        String(draftRef.current?.openNoteTitlePlain || openNoteTitlePlain || '').trim() ||
        noteTitlePlainText(selectedNote?.note_name);
      const cleaned = cleanRecordVaultNoteBodyHtml(html || '<p></p>', titlePlain);
      api.setContent(cleaned || '<p></p>');
      scheduleSave();
    },
    [scheduleSave, openNoteTitlePlain, selectedNote]
  );

  const updateOpenNoteTitle = useCallback(
    (nextPlain, { schedulePersist = true } = {}) => {
      if (!selectedNoteId) return;
      const plain = String(nextPlain ?? '').trim();
      setOpenNoteTitlePlain(plain);
      draftRef.current = { ...draftRef.current, openNoteTitlePlain: plain };
      patchNoteTitleInTree(selectedNoteId, plain);
      if (schedulePersist) scheduleSave();
    },
    [selectedNoteId, patchNoteTitleInTree, scheduleSave]
  );

  const handleImportMarkdown = useCallback(
    (markdown, meta = {}) => {
      const api = noteEditorApiRef.current;
      if (!api) return;
      api.setMarkdown(markdown || '');
      const importedTitle = String(meta?.title || '')
        .trim()
        .toUpperCase();
      if (importedTitle && selectedNoteId) {
        updateOpenNoteTitle(importedTitle, { schedulePersist: false });
        const noteId = Number(selectedNoteId);
        void vaultApi.updateRecordVaultNote(noteId, { note_name: importedTitle }).catch(() => {
          // Body import still succeeded; title can be fixed manually if rename fails.
        });
      }
      const titleForStrip =
        importedTitle ||
        String(draftRef.current?.openNoteTitlePlain || openNoteTitlePlain || '').trim() ||
        noteTitlePlainText(selectedNote?.note_name);
      const afterMd = api.getHTML?.() || '';
      const cleaned = cleanRecordVaultNoteBodyHtml(afterMd, titleForStrip);
      if (cleaned !== afterMd) {
        api.setContent(cleaned || '<p></p>');
      }
      scheduleSave();
    },
    [
      scheduleSave,
      updateOpenNoteTitle,
      selectedNoteId,
      vaultApi,
      openNoteTitlePlain,
      selectedNote
    ]
  );

  /** Classify a dropped OS file as a File→Import kind (md / html / pdf) or null. */
  const classifyNoteImportDropFile = useCallback((file) => {
    const name = String(file?.name || '').toLowerCase();
    const mime = String(file?.type || '').toLowerCase();
    if (
      name.endsWith('.html') ||
      name.endsWith('.htm') ||
      mime === 'text/html' ||
      mime === 'application/xhtml+xml'
    ) {
      return 'html';
    }
    if (
      name.endsWith('.md') ||
      name.endsWith('.markdown') ||
      mime === 'text/markdown' ||
      mime === 'text/x-markdown'
    ) {
      return 'md';
    }
    if (name.endsWith('.pdf') || mime === 'application/pdf') {
      return 'pdf';
    }
    return null;
  }, []);

  /** Build a unique uppercase note title from a file name / front-matter title. */
  const uniqueImportedNoteTitle = useCallback(
    (rawTitle, extraTaken = null) => {
      const base =
        String(rawTitle || 'IMPORTED NOTE')
          .trim()
          .toUpperCase()
          .slice(0, 120) || 'IMPORTED NOTE';
      const existing = new Set();
      notebooks.forEach((nb) => {
        (nb.notes || []).forEach((note) => {
          const name = String(note?.note_name || '')
            .trim()
            .toUpperCase();
          if (name) existing.add(name);
        });
      });
      if (extraTaken) {
        extraTaken.forEach((name) => {
          const n = String(name || '')
            .trim()
            .toUpperCase();
          if (n) existing.add(n);
        });
      }
      if (!existing.has(base)) return base;
      for (let i = 2; i < 1000; i += 1) {
        const candidate = `${base.slice(0, 110)} [${i}]`.trim().slice(0, 120);
        if (!existing.has(candidate)) return candidate;
      }
      return `${base.slice(0, 100)} ${Date.now()}`.slice(0, 120);
    },
    [notebooks]
  );

  /**
   * Notes-list column drop: create one NEW note per dropped .md / .html / .pdf.
   * Imports run one after another without waiting on popups. Each success enqueues
   * a 3s popup that includes the file name (popups play sequentially in parallel
   * with the remaining imports). Does not modify the previously open note's body.
   */
  const createNotesFromDroppedImportFiles = useCallback(
    async (files) => {
      const importFiles = (Array.isArray(files) ? files : []).filter((file) =>
        classifyNoteImportDropFile(file)
      );
      if (!importFiles.length) return false;
      if (!selectedNotebookId) {
        setError('Select a notebook before importing a file.');
        return true;
      }
      if (busy) {
        setError('Vault is busy — try again in a moment.');
        return true;
      }
      const targetNotebook = notebooks.find(
        (nb) => Number(nb.notebook_id) === Number(selectedNotebookId)
      );
      const siblingNotes = targetNotebook?.notes || [];
      if (notebookInnerLockedForDisplay(siblingNotes)) {
        setError('Unlock this notebook before importing.');
        return true;
      }

      setBusy(true);
      setNoteFileImportProgress({ percent: 0, label: 'Preparing note import…' });
      setError('');
      const claimedTitles = new Set();
      let lastCreatedId = null;
      let createdCount = 0;
      const failures = [];
      const totalSteps = Math.max(1, importFiles.length);

      try {
        // Sequential creates (ordered writes / unique titles). Success popups are
        // queued and do not block the next file import.
        for (let i = 0; i < importFiles.length; i += 1) {
          const file = importFiles[i];
          const kind = classifyNoteImportDropFile(file);
          const fileLabel = String(file?.name || 'file').trim() || 'file';
          setNoteFileImportProgress({
            percent: Math.max(1, Math.round(((i + 1) / totalSteps) * 100)),
            label: `Importing ${fileLabel}…`
          });
          try {
            let bodyHtml = '<p></p>';
            let preferredTitle = String(file?.name || '')
              .replace(/\.[^.]+$/, '')
              .trim();

            if (kind === 'html') {
              const text = await file.text();
              bodyHtml = prepareImportedHtml(text);
            } else if (kind === 'md') {
              const text = await file.text();
              const { body, title } = stripYamlFrontMatter(text);
              if (title) preferredTitle = title;
              const MarkdownIt = (await import('markdown-it')).default;
              const mdIt = new MarkdownIt({ html: true, linkify: true, breaks: false });
              bodyHtml = prepareImportedHtml(mdIt.render(String(body || '')) || '<p></p>');
            } else {
              const buffer = await file.arrayBuffer();
              bodyHtml = prepareImportedHtml(await pdfArrayBufferToHtml(buffer));
            }

            const noteName = uniqueImportedNoteTitle(preferredTitle, claimedTitles);
            claimedTitles.add(noteName);
            // Import files often repeat the title / duplicate body rows — clean those.
            bodyHtml = cleanRecordVaultNoteBodyHtml(bodyHtml || '<p></p>', noteName);
            const created = await vaultApi.createRecordVaultNote(selectedNotebookId, {
              note_name: noteName,
              body_text: bodyHtml || '<p></p>'
            });
            if (!created?.note_id) throw new Error('Failed to create note');

            const createdRow = {
              ...created,
              note_name: created.note_name || noteName,
              body_text: created.body_text != null ? created.body_text : bodyHtml,
              notebook_id: Number(created.notebook_id ?? selectedNotebookId),
              content_loaded: true
            };
            setNotebooks((prev) =>
              prev.map((nb) =>
                Number(nb.notebook_id) === Number(selectedNotebookId)
                  ? { ...nb, notes: [...(nb.notes || []), createdRow] }
                  : nb
              )
            );
            lastCreatedId = created.note_id;
            createdCount += 1;
            selectNoteId(created.note_id);
            enqueueImportSuccessPopup(`Success Import ${fileLabel} into Note`);
          } catch (err) {
            failures.push(
              `${fileLabel}: ${readRecordVaultApiError(err, 'import failed')}`
            );
          }
        }

        if (lastCreatedId != null) selectNoteId(lastCreatedId);
        bumpVaultUsage();
        if (failures.length && createdCount === 0) {
          setError(failures[0]);
        } else if (failures.length) {
          setError(
            `Created ${createdCount} note(s); ${failures.length} file(s) failed. ${failures[0]}`
          );
        }
      } finally {
        setBusy(false);
        setNoteFileImportProgress(null);
      }
      return true;
    },
    [
      classifyNoteImportDropFile,
      selectedNotebookId,
      busy,
      notebooks,
      notebookInnerLockedForDisplay,
      uniqueImportedNoteTitle,
      vaultApi,
      selectNoteId,
      bumpVaultUsage,
      enqueueImportSuccessPopup
    ]
  );

  /**
   * Drag files onto the editor content pane → vault attachments (View / Download /
   * Remove). Import (.md / .html / .pdf → new notes) is Notes-lane only.
   * Paste still inserts inline images via TipTap FileHandler.
   */
  const handleContentFileDrop = useCallback(
    async (event) => {
      if (!selectedNote) return;
      const types = event.dataTransfer?.types ? Array.from(event.dataTransfer.types) : [];
      if (
        types.includes(DRAG_NOTE) ||
        types.includes(DRAG_NOTEBOOK) ||
        types.includes(DRAG_SHORTCUT) ||
        types.includes(DRAG_CROSS_PANE)
      ) {
        return;
      }
      const isFileDrag = types.includes('Files');
      if (!isFileDrag) return;
      event.preventDefault();
      event.stopPropagation();
      if (noteHasInnerEncryption(selectedNote) && !isInnerNoteUnlocked(selectedNote.note_id)) {
        return;
      }
      if (busy) {
        setError('Vault is busy — try dropping again in a moment.');
        return;
      }
      const files = Array.from(event.dataTransfer?.files || []);
      if (!files.length) return;

      const attachFiles = files.filter((file) => isAllowedRecordVaultFile(file));
      const markdownOnly = files.filter((file) => classifyNoteImportDropFile(file) === 'md');
      const coords = { x: event.clientX, y: event.clientY };

      if (!attachFiles.length) {
        if (markdownOnly.length) {
          setError('Drop Markdown onto the Notes list to import as a new note (or use File → Import).');
        } else {
          setError(`Unsupported vault file type: ${files[0]?.name || 'file'}`);
        }
        return;
      }

      for (const file of attachFiles) {
        // eslint-disable-next-line no-await-in-loop
        await uploadNoteVaultFile(file, coords);
      }

      if (markdownOnly.length) {
        setError('Attached supported files. Drop Markdown onto the Notes list to import as a new note.');
      }
    },
    [
      selectedNote,
      busy,
      uploadNoteVaultFile,
      noteHasInnerEncryption,
      isInnerNoteUnlocked,
      classifyNoteImportDropFile
    ]
  );

  /** Notes-list column: each md/html/pdf → its own NEW note (leave other notes alone). */
  const handleNoteListFileDragOver = useCallback((event) => {
    const types = event.dataTransfer?.types ? Array.from(event.dataTransfer.types) : [];
    if (
      types.includes(DRAG_NOTE) ||
      types.includes(DRAG_NOTEBOOK) ||
      types.includes(DRAG_SHORTCUT) ||
      types.includes(DRAG_CROSS_PANE)
    ) {
      return;
    }
    if (!types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setNoteLaneFileDragActive(true);
  }, []);

  const handleNoteListFileDragLeave = useCallback((event) => {
    const related = event.relatedTarget;
    if (related && event.currentTarget?.contains?.(related)) return;
    setNoteLaneFileDragActive(false);
  }, []);

  const handleNoteListFileDrop = useCallback(
    async (event) => {
      setNoteLaneFileDragActive(false);
      const types = event.dataTransfer?.types ? Array.from(event.dataTransfer.types) : [];
      if (
        types.includes(DRAG_NOTE) ||
        types.includes(DRAG_NOTEBOOK) ||
        types.includes(DRAG_SHORTCUT) ||
        types.includes(DRAG_CROSS_PANE)
      ) {
        return;
      }
      const isFileDrag = types.includes('Files');
      if (!isFileDrag) return;
      // Folder drops belong on the Notebooks column (folder → new notebook).
      if (dataTransferLooksLikeFolderDrop(event.dataTransfer)) {
        event.preventDefault();
        event.stopPropagation();
        await importFoldersAsNotebooksRef.current?.(event.dataTransfer);
        return;
      }
      const files = Array.from(event.dataTransfer?.files || []);
      const importFiles = files.filter((file) => classifyNoteImportDropFile(file));
      if (!importFiles.length) return;
      event.preventDefault();
      event.stopPropagation();
      await createNotesFromDroppedImportFiles(importFiles);
    },
    [classifyNoteImportDropFile, createNotesFromDroppedImportFiles]
  );

  const handleNotebookLaneFolderDragOver = useCallback((event) => {
    const types = event.dataTransfer?.types ? Array.from(event.dataTransfer.types) : [];
    if (
      types.includes(DRAG_NOTE) ||
      types.includes(DRAG_NOTEBOOK) ||
      types.includes(DRAG_SHORTCUT) ||
      types.includes(DRAG_CROSS_PANE)
    ) {
      return;
    }
    if (!types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setNotebookLaneFolderDragActive(true);
  }, []);

  const handleNotebookLaneFolderDragLeave = useCallback((event) => {
    const related = event.relatedTarget;
    if (related && event.currentTarget?.contains?.(related)) return;
    setNotebookLaneFolderDragActive(false);
  }, []);

  const handleNotebookLaneFolderDrop = useCallback(async (event) => {
    setNotebookLaneFolderDragActive(false);
    const types = event.dataTransfer?.types ? Array.from(event.dataTransfer.types) : [];
    if (
      types.includes(DRAG_NOTE) ||
      types.includes(DRAG_NOTEBOOK) ||
      types.includes(DRAG_SHORTCUT) ||
      types.includes(DRAG_CROSS_PANE)
    ) {
      return;
    }
    if (!types.includes('Files')) return;
    if (!dataTransferLooksLikeFolderDrop(event.dataTransfer)) {
      setError('Drop a folder of .html notes here to import as a new notebook.');
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    await importFoldersAsNotebooksRef.current?.(event.dataTransfer);
  }, []);

  // Live edits from the Title box: keep the raw value (so spaces can be typed)
  // and mirror it to the sidebar note name + shortcut label. Trimming happens on
  // save. Title, sidebar note name, and shortcut all stay in sync via this state.
  const handleNoteTitleBoxChange = useCallback(
    (rawValue) => {
      if (!selectedNoteId) return;
      const value = String(rawValue ?? '').replace(/[\r\n]+/g, ' ');
      setOpenNoteTitlePlain(value);
      draftRef.current = { ...draftRef.current, openNoteTitlePlain: value };
      patchNoteTitleInTree(selectedNoteId, value.trim());
      // Title edits never touch the body — persistence happens in commitNoteTitleBox.
      // Do NOT schedule a body autosave here (it could race an un-hydrated editor).
    },
    [selectedNoteId, patchNoteTitleInTree]
  );



  const handleNoteListTitleEditChange = useCallback(
    (next) => {
      setEditNameDraft(next);
      // While renaming from the content header, keep keystrokes only in that field.
      // Live-syncing openNoteTitlePlain made it look like typing was going into the sidebar.
      if (
        Number(editingNoteId) === Number(selectedNoteId) &&
        renameUiSurface !== 'header'
      ) {
        updateOpenNoteTitle(next, { schedulePersist: false });
      }
    },
    [updateOpenNoteTitle, editingNoteId, selectedNoteId, renameUiSurface]
  );




  const startColumnResize = useCallback((mode, event) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startSidebar = sidebarWidth;
    const startNotebookCol = notebookColWidth;
    const startRightSidebar = rightSidebarWidth;
    const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1280;

    const onMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      if (mode === 'sidebar') {
        // Widen/narrow notebook+notes lane freely; keep a thin editor + right pane strip.
        const maxSidebar = Math.max(
          MIN_SIDEBAR_WIDTH,
          viewportW - rightSidebarWidth - MIN_EDITOR_STRIP_PX - COLUMN_RESIZE_HANDLE_PX * 2
        );
        setSidebarWidth(clamp(startSidebar + delta, MIN_SIDEBAR_WIDTH, maxSidebar));
      } else if (mode === 'notebookCol') {
        setNotebookColAutoFit(false);
        // Split freely inside the left lane (no character/title-length ceiling).
        const maxCol = Math.max(
          MIN_MENU_COL_WIDTH,
          sidebarWidth - MIN_MENU_COL_WIDTH - COLUMN_RESIZE_HANDLE_PX
        );
        setNotebookColWidth(clamp(startNotebookCol + delta, MIN_MENU_COL_WIDTH, maxCol));
      } else {
        const maxRight = Math.max(
          MIN_RIGHT_SIDEBAR_WIDTH,
          viewportW - sidebarWidth - MIN_EDITOR_STRIP_PX - COLUMN_RESIZE_HANDLE_PX * 2
        );
        setRightSidebarWidth(clamp(startRightSidebar - delta, MIN_RIGHT_SIDEBAR_WIDTH, maxRight));
      }
    };

    const onUp = () => {
      document.body.style.removeProperty('user-select');
      document.body.style.removeProperty('cursor');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setSidebarWidth((w) => {
        setNotebookColWidth((col) => {
          setRightSidebarWidth((right) => {
            setShortcutPanePercent((shortcutPercent) => {
              writeStoredLayout({
                sidebarWidth: w,
                notebookColWidth: col,
                rightSidebarWidth: right,
                shortcutPanePercent: shortcutPercent
              });
              return shortcutPercent;
            });
            return right;
          });
          return col;
        });
        return w;
      });
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [notebookColWidth, rightSidebarWidth, sidebarWidth]);

  const rightSidebarSplitRef = useRef(null);

  const startShortcutPaneResize = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    const container = rightSidebarSplitRef.current;
    if (!container) return;

    const onMove = (moveEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.height <= 0) return;
      const next = ((moveEvent.clientY - rect.top) / rect.height) * 100;
      setShortcutPanePercent(clamp(next, MIN_SHORTCUT_PANE_PERCENT, MAX_SHORTCUT_PANE_PERCENT));
    };

    const onUp = () => {
      document.body.style.removeProperty('user-select');
      document.body.style.removeProperty('cursor');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setSidebarWidth((w) => {
        setNotebookColWidth((col) => {
          setRightSidebarWidth((right) => {
            setShortcutPanePercent((shortcutPercent) => {
              writeStoredLayout({
                sidebarWidth: w,
                notebookColWidth: col,
                rightSidebarWidth: right,
                shortcutPanePercent: shortcutPercent
              });
              return shortcutPercent;
            });
            return right;
          });
          return col;
        });
        return w;
      });
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);


  useEffect(() => {
    if (!notebookColAutoFit) return undefined;
    const fitWidth = computeNotebookColFitWidth(displayNotebooks, menuButtonFontRem);
    setNotebookColWidth(fitWidth);
    setSidebarWidth((sidebar) => {
      setRightSidebarWidth((right) => {
        setShortcutPanePercent((shortcutPercent) => {
          writeStoredLayout({
            sidebarWidth: sidebar,
            notebookColWidth: fitWidth,
            rightSidebarWidth: right,
            shortcutPanePercent: shortcutPercent
          });
          return shortcutPercent;
        });
        return right;
      });
      return sidebar;
    });
    return undefined;
  }, [displayNotebooks, notebookColAutoFit, menuButtonFontRem]);

  /**
   * Attach Chromium drag-out payloads so note(s) save as .html in Finder/Explorer.
   * One note → DownloadURL (lands in the drop folder).
   * Multiple notes → do NOT put Finder-facing text/File payloads (those become
   * macOS .textClipping). Separate .html files are written via folder picker
   * during dragstart (user gesture) in handleDragStart.
   */
  const attachHtmlExportToDataTransfer = useCallback(
    (event, exportNotes) => {
      const list = (Array.isArray(exportNotes) ? exportNotes : []).filter(Boolean);
      if (!list.length || !event?.dataTransfer) return { mode: 'none', files: [] };

      (pendingHtmlExportRef.current.urls || []).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      });

      const htmlFiles = list.map((entry) => {
        const title = String(entry.title || 'note').trim() || 'note';
        const bodyHtml = String(entry.bodyHtml ?? '<p></p>');
        const fileName = `${sanitizeRecordVaultExportFileName(title)}.html`;
        const htmlDoc = buildHtmlDocument(title, bodyHtml);
        const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        return { title, fileName, htmlDoc, blob, url };
      });

      pendingHtmlExportRef.current = {
        urls: htmlFiles.map((f) => f.url),
        messages: [],
        separateFiles: htmlFiles.map((f) => ({
          title: f.title,
          fileName: f.fileName,
          blob: f.blob,
          url: f.url
        }))
      };

      if (htmlFiles.length === 1) {
        const only = htmlFiles[0];
        pendingHtmlExportRef.current.messages.push(
          `Success export NOTE "${only.title}" as ${only.fileName}`
        );
        try {
          event.dataTransfer.setData(
            'DownloadURL',
            `text/html:${only.fileName.replace(/:/g, '-')}:${only.url}`
          );
        } catch {
          // ignore
        }
        try {
          event.dataTransfer.items?.add?.(
            new File([only.blob], only.fileName, { type: 'text/html' })
          );
        } catch {
          // ignore
        }
        return { mode: 'single', files: htmlFiles };
      }

      // Multi: never ZIP, never text/File drag-out (Finder turns that into one
      // .html.textClipping). Caller writes separate .html via folder picker.
      pendingHtmlExportRef.current.messages.push(
        `Success export ${htmlFiles.length} notes as separate HTML files`
      );
      return { mode: 'multi', files: htmlFiles };
    },
    []
  );

  const downloadHtmlFilesSeparately = useCallback(async (files, { onProgress } = {}) => {
    const list = (Array.isArray(files) ? files : []).filter(Boolean);
    if (!list.length) return false;
    const report = typeof onProgress === 'function' ? onProgress : null;
    const totalSteps = Math.max(1, list.length);

    // Folder picker requires a user gesture — call from a button click, not dragend.
    if (typeof window.showDirectoryPicker === 'function') {
      try {
        const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
        const usedNames = new Set();
        for (let i = 0; i < list.length; i += 1) {
          const f = list[i];
          let name = f.fileName;
          // Avoid overwrite if two notes sanitize to the same file name.
          if (usedNames.has(name.toLowerCase())) {
            const dot = name.lastIndexOf('.');
            const base = dot > 0 ? name.slice(0, dot) : name;
            const ext = dot > 0 ? name.slice(dot) : '';
            let n = 2;
            while (usedNames.has(`${base} (${n})${ext}`.toLowerCase())) n += 1;
            name = `${base} (${n})${ext}`;
          }
          usedNames.add(name.toLowerCase());
          if (report) {
            report({
              percent: Math.max(1, Math.round(((i + 1) / totalSteps) * 100)),
              label: `Saving ${name}…`
            });
          }
          // eslint-disable-next-line no-await-in-loop
          const handle = await dir.getFileHandle(name, { create: true });
          // eslint-disable-next-line no-await-in-loop
          const writable = await handle.createWritable();
          // eslint-disable-next-line no-await-in-loop
          await writable.write(f.blob);
          // eslint-disable-next-line no-await-in-loop
          await writable.close();
        }
        if (report) report({ percent: 100, label: 'Done' });
        return true;
      } catch (err) {
        if (err?.name === 'AbortError') return false;
        // Permission / gesture failures fall through to <a download>.
      }
    }

    list.forEach((f, index) => {
      window.setTimeout(() => {
        try {
          const a = document.createElement('a');
          a.href = f.url;
          a.download = f.fileName;
          a.rel = 'noopener';
          document.body.appendChild(a);
          a.click();
          a.remove();
        } catch {
          // ignore
        }
      }, index * 250);
    });
    return true;
  }, []);

  /**
   * Export one notebook: user picks a parent folder, we create/open a subfolder
   * named after the notebook and write every readable note as its own .html file.
   */
  const exportNotebookHtmlFolder = useCallback(
    async (notebookId) => {
      const id = Number(notebookId);
      const nb = notebooks.find((row) => Number(row.notebook_id) === id);
      if (!nb) return null;
      if (typeof window.showDirectoryPicker !== 'function') {
        setError('This browser cannot choose an export folder. Use Chrome or Edge.');
        return null;
      }

      let parentDir;
      try {
        parentDir = await window.showDirectoryPicker({ mode: 'readwrite' });
      } catch (err) {
        if (err?.name === 'AbortError') return null;
        setError(err?.message || 'Could not open folder picker');
        return null;
      }

      const notebookName = String(nb.notebook_name || 'Notebook').trim() || 'Notebook';
      const folderName = sanitizeRecordVaultExportFileName(notebookName) || 'Notebook';
      let noteDir;
      try {
        noteDir = await parentDir.getDirectoryHandle(folderName, { create: true });
      } catch (err) {
        setError(err?.message || `Could not create folder “${folderName}”`);
        return null;
      }

      const notes = Array.isArray(nb.notes) ? nb.notes : [];
      const exportedNames = [];
      const skippedLocked = [];
      const usedNames = new Set();

      setNotebookExportBusy(true);
      setNotebookExportProgressPercent(0);
      setNotebookExportProgressLabel('Preparing export…');
      setError('');
      try {
        const exportable = notes.filter((note) => {
          const noteId = Number(note?.note_id);
          return Number.isFinite(noteId) && noteId >= 1;
        });
        const totalSteps = Math.max(1, exportable.length);
        let doneSteps = 0;

        for (const note of notes) {
          const noteId = Number(note?.note_id);
          if (!Number.isFinite(noteId) || noteId < 1) continue;
          if (noteRequiresInnerPinToView(note) && !isInnerNoteUnlocked(noteId)) {
            skippedLocked.push(
              recordVaultNoteSidebarLabel(note, notes, notebooks) || `Note ${noteId}`
            );
            doneSteps += 1;
            setNotebookExportProgressPercent(Math.max(1, Math.round((doneSteps / totalSteps) * 100)));
            continue;
          }

          let title =
            Number(selectedNoteId) === noteId
              ? String(openNoteTitlePlain || '').trim() ||
                recordVaultNoteSidebarLabel(note, notes, notebooks)
              : recordVaultNoteSidebarLabel(note, notes, notebooks);
          let bodyHtml = '<p></p>';
          if (Number(selectedNoteId) === noteId) {
            bodyHtml = noteEditorApiRef.current?.getHTML?.() ?? note.body_text ?? '<p></p>';
          } else if (note.content_loaded && note.body_text != null) {
            bodyHtml = String(note.body_text);
          } else {
            const cached = noteHtmlExportCacheRef.current.get(noteId);
            if (cached?.bodyHtml != null) {
              bodyHtml = String(cached.bodyHtml);
              if (cached.title) title = cached.title;
            } else {
              try {
                // eslint-disable-next-line no-await-in-loop
                const fresh = await vaultApi.fetchRecordVaultNote(noteId);
                bodyHtml = String(fresh?.body_text ?? '<p></p>');
                if (fresh?.note_name) {
                  title = String(fresh.note_name).trim() || title;
                }
                noteHtmlExportCacheRef.current.set(noteId, {
                  title: title || 'note',
                  bodyHtml
                });
              } catch {
                bodyHtml = String(note.body_text ?? '<p></p>');
              }
            }
          }

          title = String(title || 'note').trim() || 'note';
          setNotebookExportProgressLabel(`Exporting “${title}”…`);
          let fileName = `${sanitizeRecordVaultExportFileName(title)}.html`;
          if (usedNames.has(fileName.toLowerCase())) {
            const dot = fileName.lastIndexOf('.');
            const base = dot > 0 ? fileName.slice(0, dot) : fileName;
            const ext = dot > 0 ? fileName.slice(dot) : '';
            let n = 2;
            while (usedNames.has(`${base} (${n})${ext}`.toLowerCase())) n += 1;
            fileName = `${base} (${n})${ext}`;
          }
          usedNames.add(fileName.toLowerCase());

          const htmlDoc = buildHtmlDocument(title, bodyHtml);
          const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
          // eslint-disable-next-line no-await-in-loop
          const handle = await noteDir.getFileHandle(fileName, { create: true });
          // eslint-disable-next-line no-await-in-loop
          const writable = await handle.createWritable();
          // eslint-disable-next-line no-await-in-loop
          await writable.write(blob);
          // eslint-disable-next-line no-await-in-loop
          await writable.close();
          exportedNames.push(title);
          doneSteps += 1;
          setNotebookExportProgressPercent(Math.max(1, Math.round((doneSteps / totalSteps) * 100)));
        }
        setNotebookExportProgressPercent(100);
        setNotebookExportProgressLabel('Done');
      } finally {
        setNotebookExportBusy(false);
        setNotebookExportProgressPercent(0);
        setNotebookExportProgressLabel('');
      }

      const folderPath = `${parentDir.name}/${folderName}`;
      return {
        notebookName,
        folderPath,
        noteNames: exportedNames,
        skippedLocked
      };
    },
    [
      notebooks,
      noteRequiresInnerPinToView,
      isInnerNoteUnlocked,
      selectedNoteId,
      openNoteTitlePlain,
      vaultApi
    ]
  );

  const resolveNoteHtmlExportPayload = useCallback(
    (noteId) => {
      const id = Number(noteId);
      if (!Number.isFinite(id) || id < 1) return null;
      const { note, notebook } = findNoteRowById(id);
      if (!note) return null;
      if (noteRequiresInnerPinToView(note) && !isInnerNoteUnlocked(id)) return null;
      const siblingNotes = notebook?.notes || [];
      const cached = noteHtmlExportCacheRef.current.get(id);
      const title =
        Number(selectedNoteId) === id
          ? String(openNoteTitlePlain || '').trim() ||
            recordVaultNoteSidebarLabel(note, siblingNotes, notebooks)
          : recordVaultNoteSidebarLabel(note, siblingNotes, notebooks);
      let bodyHtml = '<p></p>';
      if (Number(selectedNoteId) === id) {
        bodyHtml = noteEditorApiRef.current?.getHTML?.() ?? note.body_text ?? '<p></p>';
      } else if (note.content_loaded && note.body_text != null) {
        bodyHtml = String(note.body_text);
      } else if (cached?.bodyHtml != null) {
        bodyHtml = String(cached.bodyHtml);
      } else if (note.body_text != null) {
        bodyHtml = String(note.body_text);
      }
      return { title: title || cached?.title || 'note', bodyHtml, noteId: id };
    },
    [
      findNoteRowById,
      noteRequiresInnerPinToView,
      isInnerNoteUnlocked,
      selectedNoteId,
      openNoteTitlePlain,
      notebooks
    ]
  );

  const prefetchNoteHtmlExport = useCallback(
    (noteId) => {
      const warmOne = (rawId) => {
        const id = Number(rawId);
        if (!Number.isFinite(id) || id < 1) return;
        const { note } = findNoteRowById(id);
        if (!note) return;
        if (noteRequiresInnerPinToView(note) && !isInnerNoteUnlocked(id)) return;
        if (Number(selectedNoteId) === id) {
          const bodyHtml = noteEditorApiRef.current?.getHTML?.() ?? note.body_text ?? '<p></p>';
          noteHtmlExportCacheRef.current.set(id, {
            title: String(openNoteTitlePlain || note.note_name || 'note'),
            bodyHtml: String(bodyHtml)
          });
          return;
        }
        if (note.content_loaded && note.body_text != null) {
          noteHtmlExportCacheRef.current.set(id, {
            title: String(note.note_name || 'note'),
            bodyHtml: String(note.body_text)
          });
          return;
        }
        if (noteHtmlExportCacheRef.current.has(id)) return;
        void vaultApi
          .fetchRecordVaultNote(id)
          .then((fresh) => {
            if (!fresh) return;
            noteHtmlExportCacheRef.current.set(id, {
              title: String(fresh.note_name || note.note_name || 'note'),
              bodyHtml: String(fresh.body_text ?? '<p></p>')
            });
          })
          .catch(() => {
            // Drag may still proceed with empty body if fetch is slow/fails.
          });
      };

      const id = Number(noteId);
      const multi = multiSelectedNoteIdsRef.current || [];
      // Warm every Shift-selected note so a multi drag/export has bodies ready.
      if (multi.length > 1) {
        multi.forEach(warmOne);
        return;
      }
      warmOne(id);
    },
    [
      findNoteRowById,
      noteRequiresInnerPinToView,
      isInnerNoteUnlocked,
      selectedNoteId,
      openNoteTitlePlain,
      vaultApi
    ]
  );

  const handleDragStart = useCallback(
    (event, id, mime, notebookIdForNote) => {
      const draggedNoteIds =
        mime === DRAG_NOTE ? resolveDraggedNoteIds(id) : [];
      const multiDrag = mime === DRAG_NOTE && draggedNoteIds.length > 1;

      // Drag ghost: for multi-note drag show a count badge so it's obvious all
      // Shift-selected notes are moving — not only the row under the pointer.
      const rowEl = event.currentTarget;
      if (rowEl && typeof event.dataTransfer.setDragImage === 'function') {
        try {
          if (multiDrag) {
            const ghost = document.createElement('div');
            ghost.style.cssText = [
              'position:fixed',
              'top:-10000px',
              'left:-10000px',
              'margin:0',
              'padding:10px 14px',
              'background:#fff',
              'color:#000',
              'border:3px solid #000',
              'border-radius:8px',
              'font:700 14px/1.3 system-ui,sans-serif',
              'box-shadow:0 4px 14px rgba(0,0,0,0.35)',
              'pointer-events:none',
              'max-width:280px',
              'z-index:99999'
            ].join(';');
            const labels = draggedNoteIds
              .map((nid) => {
                const { note, notebook } = findNoteRowById(nid);
                if (!note) return '';
                return recordVaultNoteSidebarLabel(note, notebook?.notes || [], notebooks);
              })
              .filter(Boolean);
            const preview = labels.slice(0, 3).join(', ');
            const more = labels.length > 3 ? ` +${labels.length - 3} more` : '';
            ghost.textContent = `${draggedNoteIds.length} notes: ${preview}${more}`;
            document.body.appendChild(ghost);
            event.dataTransfer.setDragImage(ghost, 24, 16);
            window.setTimeout(() => ghost.remove(), 0);
          } else {
            const rect = rowEl.getBoundingClientRect();
            const clone = rowEl.cloneNode(true);
            clone.style.position = 'fixed';
            clone.style.top = '-10000px';
            clone.style.left = '-10000px';
            clone.style.margin = '0';
            clone.style.transform = 'none';
            clone.style.width = `${rect.width}px`;
            clone.style.height = `${rect.height}px`;
            clone.style.pointerEvents = 'none';
            clone.style.opacity = '1';
            document.body.appendChild(clone);
            const offsetX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
            const offsetY = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
            event.dataTransfer.setDragImage(clone, offsetX, offsetY);
            window.setTimeout(() => clone.remove(), 0);
          }
        } catch {
          // Fall back to the default drag image if cloning fails.
        }
      }

      event.dataTransfer.setData(mime, String(id));
      // text/plain → macOS Finder .textClipping when dropped outside the app.
      // Multi-note and notebook HTML exports omit it; in-app drops use custom MIME.
      const omitPlainText =
        (mime === DRAG_NOTE && multiDrag) || mime === DRAG_NOTEBOOK;
      if (!omitPlainText) {
        event.dataTransfer.setData('text/plain', String(id));
      }
      event.dataTransfer.effectAllowed = 'copyMove';
      activeDragRef.current = {
        kind: mime,
        id: Number(id),
        notebookId: notebookIdForNote != null ? Number(notebookIdForNote) : null,
        noteIds: draggedNoteIds.length ? draggedNoteIds : null
      };
      pendingNotebookExportRef.current = null;
      if (mime === DRAG_NOTEBOOK) {
        setDraggingNotebookId(id);
        if (!billScheduleCrossPaneKind(id)) {
          const nb = notebooks.find((row) => Number(row.notebook_id) === Number(id));
          const noteCount = Array.isArray(nb?.notes) ? nb.notes.length : 0;
          pendingNotebookExportRef.current = {
            notebookId: Number(id),
            notebookName: String(nb?.notebook_name || '').trim() || 'Notebook',
            noteCount
          };
          // Prefetch note bodies so Choose-folder export is fast.
          (nb?.notes || []).forEach((n) => {
            try {
              prefetchNoteHtmlExport(n.note_id);
            } catch {
              // ignore
            }
          });
        } else {
          pendingNotebookExportRef.current = null;
        }
      } else if (mime === DRAG_NOTE) {
        setDraggingNoteId(id);
        if (billScheduleCrossPaneKind(id)) {
          pendingHtmlExportRef.current = null;
        } else {
        if (notebookIdForNote != null) {
          event.dataTransfer.setData(DRAG_NOTEBOOK, String(notebookIdForNote));
        }
        try {
          event.dataTransfer.setData(DRAG_NOTE_IDS, JSON.stringify(draggedNoteIds));
        } catch {
          // ignore custom MIME failures
        }
        const payloads = draggedNoteIds
          .map((nid) => resolveNoteHtmlExportPayload(nid))
          .filter(Boolean);
        if (payloads.length) attachHtmlExportToDataTransfer(event, payloads);
        // Multi export is completed via a "Choose folder" dialog on dragend
        // (needs a real click gesture). Do not put File/text payloads on the drag.
        }
      } else if (mime === DRAG_SHORTCUT) setDraggingShortcutId(id);

      if (mime === DRAG_NOTEBOOK || mime === DRAG_NOTE) {
        let name = '';
        let notebookId = notebookIdForNote != null ? Number(notebookIdForNote) : null;
        const billKind = billScheduleCrossPaneKind(id);
        if (billKind === 'bill_schedule') {
          name = 'Bill Schedule';
          notebookId = BILL_SCHEDULE_NOTEBOOK_ID;
        } else if (billKind === 'bill_monthly') {
          name = 'Monthly';
          notebookId = BILL_SCHEDULE_NOTEBOOK_ID;
        } else if (billKind === 'bill_yearly') {
          name = 'Yearly';
          notebookId = BILL_SCHEDULE_NOTEBOOK_ID;
        } else if (mime === DRAG_NOTEBOOK) {
          const nb = notebooks.find((row) => Number(row.notebook_id) === Number(id));
          name = String(nb?.notebook_name || '').trim();
        } else {
          const sourceNb =
            notebooks.find((row) => Number(row.notebook_id) === Number(notebookId)) ||
            notebooks.find((row) => Number(row.notebook_id) === Number(selectedNotebookId));
          notebookId = Number(sourceNb?.notebook_id) || notebookId;
          if (multiDrag) {
            name = `${draggedNoteIds.length} notes`;
          } else {
            const note = (sourceNb?.notes || []).find((row) => Number(row.note_id) === Number(id));
            name = String(note?.note_name || '').trim();
          }
        }
        const payload = {
          kind: billKind || (mime === DRAG_NOTEBOOK ? 'notebook' : 'note'),
          id: Number(id),
          storageType: paneStorageType === 'onedrive' ? 'onedrive' : 'usb',
          name,
          notebookId: Number.isFinite(notebookId) ? notebookId : null,
          noteIds: mime === DRAG_NOTE && draggedNoteIds.length > 1 ? draggedNoteIds : undefined
        };
        // Bill Schedule: no Finder HTML export
        if (isBillScheduleCrossPaneKind(payload.kind)) {
          pendingNotebookExportRef.current = null;
          pendingHtmlExportRef.current = null;
        }
        setActiveCrossPaneDrag(payload);
        try {
          event.dataTransfer.setData(DRAG_CROSS_PANE, serializeCrossPaneDrag(payload));
        } catch {
          // Some browsers reject custom MIME mid-drag; module payload still works.
        }
      }
    },
    [
      notebooks,
      paneStorageType,
      selectedNotebookId,
      resolveDraggedNoteIds,
      findNoteRowById,
      resolveNoteHtmlExportPayload,
      attachHtmlExportToDataTransfer,
      prefetchNoteHtmlExport
    ]
  );

  const handleDragEnd = useCallback(
    (event) => {
      const dropEffect = event?.dataTransfer?.dropEffect;
      const pending = pendingHtmlExportRef.current || {};
      const pendingMessages = [...(pending.messages || [])];
      const pendingUrls = [...(pending.urls || [])];
      const separateFiles = [...(pending.separateFiles || [])];
      const pendingNotebook = pendingNotebookExportRef.current;
      pendingHtmlExportRef.current = { urls: [], messages: [], separateFiles: [] };
      pendingNotebookExportRef.current = null;

      const revokeLater = () => {
        window.setTimeout(() => {
          pendingUrls.forEach((url) => {
            try {
              URL.revokeObjectURL(url);
            } catch {
              // ignore
            }
          });
        }, 120_000);
      };

      const finishUi = () => {
        activeDragRef.current = { kind: null, id: null, notebookId: null, noteIds: null };
        clearActiveCrossPaneDrag();
        setCrossPaneDropActive(false);
        setDraggingNotebookId(null);
        setDropTargetNotebookId(null);
        setDraggingNoteId(null);
        setDropTargetNoteId(null);
        setDraggingShortcutId(null);
        setDropTargetShortcutId(null);
      };

      // Cloud↔USB drop already opened the transfer dialog on the other pane.
      if (takeCrossPaneDropConsumed()) {
        revokeLater();
        finishUi();
        return;
      }

      // Internal reorder / in-app move — do not export HTML.
      if (dropEffect === 'move') {
        revokeLater();
        finishUi();
        return;
      }

      const cursorOutsideWindow = (() => {
        try {
          const x = event?.screenX;
          const y = event?.screenY;
          if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
          return (
            x < window.screenX ||
            y < window.screenY ||
            x > window.screenX + window.outerWidth ||
            y > window.screenY + window.outerHeight
          );
        } catch {
          return false;
        }
      })();

      const offerExport = dropEffect === 'copy' || cursorOutsideWindow;

      // Notebook → parent folder / NotebookName / note.html files
      if (pendingNotebook?.notebookId && offerExport) {
        setNotebookHtmlExportOffer(pendingNotebook);
        revokeLater();
        finishUi();
        return;
      }

      // Multi notes: Choose-folder dialog for separate .html files.
      if (separateFiles.length > 1 && offerExport) {
        setMultiHtmlExportOffer({
          files: separateFiles,
          messages: pendingMessages,
          count: separateFiles.length
        });
        revokeLater();
        finishUi();
        return;
      }

      if (dropEffect === 'copy' && pendingMessages.length) {
        pendingMessages.forEach((msg) => {
          enqueueImportSuccessPopup(msg, 2000);
        });
      }

      revokeLater();
      finishUi();
    },
    [enqueueImportSuccessPopup]
  );

  /** Drag the open note's content pane out to Finder → HTML export. */
  const handleContentPaneHtmlExportDragStart = useCallback(
    (event) => {
      if (!selectedNoteId) {
        event.preventDefault();
        return;
      }
      // Keep TipTap editing usable: don't steal toolbar/inputs/image moves or text selection.
      const t = event.target;
      if (
        t?.closest?.(
          'input, textarea, button, a, img, label, .MuiInputBase-root, [role="toolbar"]'
        )
      ) {
        event.preventDefault();
        return;
      }
      const sel = window.getSelection?.();
      if (sel && !sel.isCollapsed && event.currentTarget?.contains?.(sel.anchorNode)) {
        event.preventDefault();
        return;
      }
      const exportPayload = resolveNoteHtmlExportPayload(selectedNoteId);
      if (!exportPayload) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = 'copyMove';
      event.dataTransfer.setData(DRAG_NOTE, String(selectedNoteId));
      event.dataTransfer.setData('text/plain', String(selectedNoteId));
      if (selectedNotebookId != null) {
        event.dataTransfer.setData(DRAG_NOTEBOOK, String(selectedNotebookId));
      }
      attachHtmlExportToDataTransfer(event, [exportPayload]);
      activeDragRef.current = {
        kind: DRAG_NOTE,
        id: Number(selectedNoteId),
        notebookId: selectedNotebookId != null ? Number(selectedNotebookId) : null
      };
      setDraggingNoteId(selectedNoteId);
    },
    [
      selectedNoteId,
      selectedNotebookId,
      resolveNoteHtmlExportPayload,
      attachHtmlExportToDataTransfer
    ]
  );

  const openCrossPaneTransfer = useCallback(
    (item, targetNotebookId = null) => {
      if (!item || busy || crossPaneBusy) return;
      const destNb =
        targetNotebookId != null
          ? notebooks.find((nb) => Number(nb.notebook_id) === Number(targetNotebookId))
          : null;
      setCrossPaneDuplicateError('');
      setCrossPaneTransfer({
        item,
        targetNotebookId: targetNotebookId != null ? Number(targetNotebookId) : null,
        targetNotebookName: String(destNb?.notebook_name || '').trim()
      });
    },
    [busy, crossPaneBusy, notebooks]
  );

  const tryHandleForeignCrossPaneDrop = useCallback(
    (event, { targetNotebookId = null } = {}) => {
      const foreign = readCrossPaneDragFromEvent(event);
      if (!foreign) return false;
      const pane = paneStorageType === 'onedrive' ? 'onedrive' : 'usb';
      if (foreign.storageType === pane) return false;
      event.preventDefault();
      event.stopPropagation();
      // Source pane dragend must skip Finder HTML export — do not clear this here.
      markCrossPaneDropConsumed();
      setCrossPaneDropActive(false);
      if (isBillScheduleCrossPaneKind(foreign.kind)) {
        openCrossPaneTransfer(foreign, BILL_SCHEDULE_NOTEBOOK_ID);
        return true;
      }
      if (foreign.kind === 'note') {
        const destId = targetNotebookId != null ? Number(targetNotebookId) : Number(selectedNotebookId);
        if (!Number.isFinite(destId) || destId < 1) {
          setError('Select or drop onto a destination notebook first');
          return true;
        }
        openCrossPaneTransfer(foreign, destId);
      } else {
        openCrossPaneTransfer(foreign, null);
      }
      return true;
    },
    [openCrossPaneTransfer, paneStorageType, selectedNotebookId]
  );

  const runCrossPaneTransfer = useCallback(
    async (mode) => {
      if (!crossPaneTransfer?.item || crossPaneBusy) return;
      setCrossPaneBusy(true);
      setCrossPaneProgressPercent(0);
      setCrossPaneProgressLabel(mode === 'move' ? 'Starting move…' : 'Starting copy…');
      setCrossPaneDuplicateError('');
      setError('');
      try {
        await transferRecordVaultItem({
          mode,
          item: crossPaneTransfer.item,
          targetStorageType: paneStorageType,
          targetNotebookId: crossPaneTransfer.targetNotebookId,
          targetNotebooks: notebooks,
          singlesId: user?.singles_id,
          onProgress: ({ percent, label }) => {
            const next = Math.round(Number(percent) || 0);
            setCrossPaneProgressPercent(Math.max(0, Math.min(100, next)));
            if (label) setCrossPaneProgressLabel(String(label));
          }
        });
        setCrossPaneProgressPercent(100);
        setCrossPaneProgressLabel('Done');
        setCrossPaneTransfer(null);
        notifyRecordVaultTreeReload(null);
        await loadTree({
          preferNotebookId: selectedNotebookIdRef.current,
          preferNoteId: selectedNoteIdRef.current,
          silent: true
        });
      } catch (err) {
        if (err?.code === 'DUPLICATE_NAME') {
          setCrossPaneDuplicateError(err.message || 'Duplicate name. Rename and try again');
        } else {
          setError(readRecordVaultApiError(err, 'Transfer failed'));
          setCrossPaneTransfer(null);
        }
      } finally {
        setCrossPaneBusy(false);
        setCrossPaneProgressPercent(0);
        setCrossPaneProgressLabel('');
      }
    },
    [crossPaneBusy, crossPaneTransfer, loadTree, notebooks, paneStorageType, user?.singles_id]
  );

  const handleDropReorder = useCallback(
    async (event, toId, mime, list, idKey, persistReorder) => {
      if (tryHandleForeignCrossPaneDrop(event, { targetNotebookId: selectedNotebookId })) {
        return;
      }
      const raw = event.dataTransfer.getData(mime) || event.dataTransfer.getData('text/plain');
      const fromId = Number(raw);
      if (!Number.isFinite(fromId) || fromId === toId || busy) {
        handleDragEnd();
        return;
      }
      const reordered = reorderById(list, fromId, toId, idKey);
      if (reordered === list) {
        handleDragEnd();
        return;
      }

      if (mime === DRAG_NOTEBOOK) {
        setNotebooks(reordered);
      } else if (selectedNotebookId) {
        setNotebooks((prev) =>
          prev.map((nb) =>
            Number(nb.notebook_id) === Number(selectedNotebookId) ? { ...nb, notes: reordered } : nb
          )
        );
      }

      setBusy(true);
      setError('');
      try {
        await persistReorder(reordered.map((item) => item[idKey]));
      } catch (err) {
        setError(readRecordVaultApiError(err, 'Failed to reorder'));
        await loadTree({ preferNotebookId: selectedNotebookId, preferNoteId: selectedNoteId, silent: true });
      } finally {
        setBusy(false);
        handleDragEnd();
      }
    },
    [busy, handleDragEnd, loadTree, selectedNotebookId, selectedNoteId, tryHandleForeignCrossPaneDrop]
  );

  const handleMoveNoteToNotebook = useCallback(
    async (event, targetNotebookId) => {
      if (tryHandleForeignCrossPaneDrop(event, { targetNotebookId })) {
        return;
      }
      event.preventDefault();
      let noteRaw = event.dataTransfer.getData(DRAG_NOTE);
      let sourceNotebookRaw = event.dataTransfer.getData(DRAG_NOTEBOOK);
      let noteIdsRaw = '';
      try {
        noteIdsRaw = event.dataTransfer.getData(DRAG_NOTE_IDS) || '';
      } catch {
        noteIdsRaw = '';
      }
      if (!noteRaw) {
        const active = activeDragRef.current;
        if (active.kind === DRAG_NOTE) {
          noteRaw = String(active.id ?? '');
          sourceNotebookRaw = String(active.notebookId ?? selectedNotebookId ?? '');
          if (!noteIdsRaw && Array.isArray(active.noteIds) && active.noteIds.length) {
            noteIdsRaw = JSON.stringify(active.noteIds);
          }
        }
      }

      let noteIds = [];
      try {
        const parsed = noteIdsRaw ? JSON.parse(noteIdsRaw) : null;
        if (Array.isArray(parsed)) {
          noteIds = parsed.map(Number).filter((nid) => Number.isFinite(nid) && nid >= 1);
        }
      } catch {
        noteIds = [];
      }
      const primaryId = Number(noteRaw);
      if (!noteIds.length && Number.isFinite(primaryId) && primaryId >= 1) {
        noteIds = [primaryId];
      }

      const targetId = Number(targetNotebookId);
      const sourceNotebookId = Number(sourceNotebookRaw);
      if (!noteIds.length || !Number.isFinite(targetId) || busy) {
        handleDragEnd();
        return;
      }
      if (sourceNotebookId === targetId) {
        handleDragEnd();
        return;
      }

      const targetNotebook = notebooks.find((nb) => Number(nb.notebook_id) === targetId);
      for (const noteId of noteIds) {
        const movedNote = findNoteRowById(noteId).note;
        const movedNameLc = String(movedNote?.note_name ?? '').trim().toLowerCase();
        if (movedNameLc && targetNotebook) {
          const clash = (targetNotebook.notes || []).some(
            (n) =>
              !noteIds.includes(Number(n.note_id)) &&
              String(n.note_name ?? '').trim().toLowerCase() === movedNameLc
          );
          if (clash) {
            setError(
              `A note named “${movedNote.note_name}” already exists in “${targetNotebook.notebook_name}”. Rename one first, then move it.`
            );
            handleDragEnd();
            return;
          }
        }
      }

      setBusy(true);
      setError('');
      try {
        for (const noteId of noteIds) {
          await vaultApi.moveRecordVaultNote(noteId, targetId);
        }
        const focusId = noteIds[noteIds.length - 1];
        setSelectedNotebookId(targetId);
        setSelectedNoteId(focusId);
        replaceMultiSelectedNoteIds([]);
        await loadTree({ preferNotebookId: targetId, preferNoteId: focusId, silent: true });
      } catch (err) {
        setError(readRecordVaultApiError(err, 'Failed to move note'));
        await loadTree({ preferNotebookId: selectedNotebookId, preferNoteId: selectedNoteId, silent: true });
      } finally {
        setBusy(false);
        handleDragEnd();
      }
    },
    [
      busy,
      findNoteRowById,
      handleDragEnd,
      loadTree,
      notebooks,
      replaceMultiSelectedNoteIds,
      selectedNotebookId,
      selectedNoteId,
      tryHandleForeignCrossPaneDrop,
      vaultApi
    ]
  );

  const handleNotebookRowDrop = useCallback(
    (event, toId, mime) => {
      if (tryHandleForeignCrossPaneDrop(event, { targetNotebookId: toId })) {
        return;
      }
      const types = event.dataTransfer?.types ? Array.from(event.dataTransfer.types) : [];
      if (draggingNoteId != null || types.includes(DRAG_NOTE)) {
        void handleMoveNoteToNotebook(event, toId);
        return;
      }
      void handleDropReorder(event, toId, mime, notebooks, 'notebook_id', (ids) =>
        vaultApi.reorderRecordVaultNotebooks(ids)
      );
    },
    [draggingNoteId, handleDropReorder, handleMoveNoteToNotebook, notebooks, tryHandleForeignCrossPaneDrop, vaultApi]
  );

  const handleShortcutDropFromLeft = useCallback(
    async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (shortcutDropInFlightRef.current) {
        return;
      }
      let notebookRaw = event.dataTransfer.getData(DRAG_NOTEBOOK);
      let noteRaw = event.dataTransfer.getData(DRAG_NOTE);
      if (!notebookRaw && !noteRaw) {
        const active = activeDragRef.current;
        if (active.kind === DRAG_NOTE) {
          noteRaw = String(active.id ?? '');
          notebookRaw = String(active.notebookId ?? selectedNotebookId ?? '');
        } else if (active.kind === DRAG_NOTEBOOK) {
          notebookRaw = String(active.id ?? '');
        }
      }
      if (busy) {
        handleDragEnd();
        return;
      }
      if (!notebookRaw && !noteRaw) {
        handleDragEnd();
        return;
      }

      const targetType = noteRaw ? 'note' : 'notebook';
      const notebookId = Number(notebookRaw || selectedNotebookId);
      const noteId = noteRaw ? Number(noteRaw) : null;
      if (!Number.isFinite(notebookId) || notebookId < 1) {
        handleDragEnd();
        return;
      }
      if (targetType === 'note' && (!Number.isFinite(noteId) || noteId < 1)) {
        handleDragEnd();
        return;
      }

      // Refuse a shortcut whose name collides (case-insensitive) with an existing
      // shortcut for a different target. Same-target drops just refresh in place.
      const newLabel =
        targetType === 'note'
          ? String(findNoteRowById(noteId).note?.note_name ?? '').trim()
          : String(
              notebooks.find((nb) => Number(nb.notebook_id) === notebookId)?.notebook_name ?? ''
            ).trim();
      const newLabelLc = newLabel.toLowerCase();
      if (newLabelLc) {
        const clash = shortcuts.some((sc) => {
          const sameTarget =
            sc.target_type === targetType &&
            Number(sc.notebook_id) === notebookId &&
            (targetType === 'notebook' || Number(sc.note_id) === noteId);
          if (sameTarget) return false;
          return String(sc.label ?? '').trim().toLowerCase() === newLabelLc;
        });
        if (clash) {
          setError(
            `A shortcut named “${newLabel}” already exists. Rename the ${targetType} first, then add the shortcut.`
          );
          handleDragEnd();
          return;
        }
      }

      shortcutDropInFlightRef.current = true;
      setBusy(true);
      setError('');
      try {
        const created = await vaultApi.createRecordVaultShortcut({
          target_type: targetType,
          notebook_id: notebookId,
          ...(targetType === 'note' ? { note_id: noteId } : {})
        });
        if (created) {
          setShortcuts((prev) => {
            const duplicate = prev.find(
              (sc) =>
                sc.target_type === created.target_type &&
                Number(sc.notebook_id) === Number(created.notebook_id) &&
                (created.target_type === 'notebook' ||
                  Number(sc.note_id) === Number(created.note_id))
            );
            if (duplicate) {
              return prev.map((sc) =>
                Number(sc.shortcut_id) === Number(duplicate.shortcut_id) ? { ...sc, ...created } : sc
              );
            }
            return [...prev, created];
          });
        }
        if (targetType === 'note') {
          setSelectedNotebookId(notebookId);
          selectNoteId(noteId);
        }
      } catch (err) {
        setError(readRecordVaultApiError(err, 'Failed to add shortcut'));
      } finally {
        shortcutDropInFlightRef.current = false;
        setBusy(false);
        handleDragEnd();
      }
    },
    [busy, findNoteRowById, handleDragEnd, notebooks, selectedNotebookId, selectNoteId, shortcuts]
  );

  const handleShortcutReorderDrop = useCallback(
    async (event, toId) => {
      const raw = event.dataTransfer.getData(DRAG_SHORTCUT) || event.dataTransfer.getData('text/plain');
      const fromId = Number(raw);
      if (!Number.isFinite(fromId) || fromId === toId || busy) {
        handleDragEnd();
        return;
      }
      const reordered = reorderById(shortcuts, fromId, toId, 'shortcut_id');
      if (reordered === shortcuts) {
        handleDragEnd();
        return;
      }
      setShortcuts(reordered);
      setBusy(true);
      setError('');
      try {
        await vaultApi.reorderRecordVaultShortcuts(reordered.map((sc) => sc.shortcut_id));
      } catch (err) {
        setError(readRecordVaultApiError(err, 'Failed to reorder shortcuts'));
        const { shortcuts: loadedShortcuts } = await vaultApi.fetchRecordVaultTree();
        setShortcuts(loadedShortcuts);
      } finally {
        setBusy(false);
        handleDragEnd();
      }
    },
    [busy, handleDragEnd, shortcuts]
  );

  const handleShortcutClick = useCallback((shortcut) => {
    if (shortcut.target_type === 'notebook') {
      notebookScopePendingRef.current = true;
      setInnerEncryptUiScope('notebook');
      setSelectedNotebookId(shortcut.notebook_id);
      return;
    }
    notebookScopePendingRef.current = false;
    setInnerEncryptUiScope('note');
    setSelectedNotebookId(shortcut.notebook_id);
    selectNoteId(shortcut.note_id);
  }, [selectNoteId]);

  const isShortcutSelected = useCallback(
    (shortcut) => {
      if (shortcut.target_type === 'notebook') {
        return Number(shortcut.notebook_id) === Number(selectedNotebookId);
      }
      return (
        Number(shortcut.notebook_id) === Number(selectedNotebookId) &&
        Number(shortcut.note_id) === Number(selectedNoteId)
      );
    },
    [selectedNotebookId, selectedNoteId]
  );

  const clearRenameState = useCallback(() => {
    setEditingNotebookId(null);
    setEditingNoteId(null);
    setRenameUiSurface(null);
  }, []);

  /**
   * Scan the ENTIRE vault (every notebook name + every note name) for a
   * case-insensitive match of `candidate`. Returns true when the name is
   * already taken. `excludeNotebookId` / `excludeNoteId` skip the row being
   * renamed so it never clashes with itself.
   */
  const vaultNameExists = useCallback(
    (candidate, { excludeNotebookId = null, excludeNoteId = null } = {}) => {
      const target = String(candidate ?? '').trim().toLowerCase();
      if (!target) return false;
      for (const nb of notebooks) {
        if (Number(nb.notebook_id) !== Number(excludeNotebookId)) {
          if (String(nb.notebook_name ?? '').trim().toLowerCase() === target) return true;
        }
        const notes = nb.notes || [];
        for (const n of notes) {
          if (Number(n.note_id) === Number(excludeNoteId)) continue;
          if (recordVaultNoteSidebarLabel(n, notes, notebooks).trim().toLowerCase() === target) {
            return true;
          }
        }
      }
      return false;
    },
    [notebooks]
  );

  const uniqueNotebookNameFromFolder = useCallback(
    (folderName) => {
      const base =
        String(folderName || 'IMPORTED')
          .trim()
          .toUpperCase()
          .replace(/[\\/:*?"<>|]+/g, '-')
          .slice(0, 120) || 'IMPORTED';
      if (!vaultNameExists(base)) return base;
      for (let i = 2; i < 1000; i += 1) {
        const candidate = `${base.slice(0, 110)} [${i}]`.trim().slice(0, 120);
        if (!vaultNameExists(candidate)) return candidate;
      }
      return `${base.slice(0, 100)} ${Date.now()}`.slice(0, 120);
    },
    [vaultNameExists]
  );

  /**
   * OS folder drop → new notebook named after the folder, one note per top-level .html.
   */
  const importFoldersAsNotebooksFromDataTransfer = useCallback(
    async (dataTransfer) => {
      if (busy || folderImportBusy || crossPaneBusy) {
        setError('Vault is busy — try again in a moment.');
        return false;
      }
      let folders;
      try {
        folders = await parseFolderHtmlImportsFromDataTransfer(dataTransfer);
      } catch (err) {
        setError(err?.message || 'Failed to read dropped folder');
        return false;
      }
      if (!folders.length) {
        setError('No .html notes found in the dropped folder.');
        return false;
      }

      setFolderImportBusy(true);
      setFolderImportProgressPercent(0);
      setFolderImportProgressLabel('Preparing folder import…');
      setError('');
      const successResults = [];
      const totalFiles = folders.reduce((sum, folder) => sum + (folder.files?.length || 0), 0);
      const totalSteps = Math.max(1, folders.length + totalFiles);
      let doneSteps = 0;
      const reportImportProgress = (label) => {
        doneSteps = Math.min(totalSteps, doneSteps + 1);
        setFolderImportProgressPercent(Math.max(1, Math.round((doneSteps / totalSteps) * 100)));
        if (label) setFolderImportProgressLabel(label);
      };
      try {
        for (const folder of folders) {
          const notebookName = uniqueNotebookNameFromFolder(folder.folderName);
          setFolderImportProgressLabel(`Creating notebook “${notebookName}”…`);
          // eslint-disable-next-line no-await-in-loop
          const createdNb = await vaultApi.createRecordVaultNotebook(notebookName);
          const notebookId = Number(createdNb?.notebook_id);
          if (!Number.isFinite(notebookId) || notebookId < 1) {
            throw new Error(`Failed to create notebook “${notebookName}”`);
          }
          reportImportProgress(`Created notebook “${notebookName}”`);

          const claimedTitles = new Set();
          const importedNoteNames = [];
          const createdNoteRows = [];
          let lastNoteId = null;

          for (const file of folder.files) {
            const fileLabel = String(file?.name || 'file').trim() || 'file';
            setFolderImportProgressLabel(`Importing ${fileLabel}…`);
            try {
              // eslint-disable-next-line no-await-in-loop
              const text = await file.text();
              let bodyHtml = prepareImportedHtml(text);
              const preferredTitle = String(file?.name || '')
                .replace(/\.[^.]+$/, '')
                .trim();
              const noteName = uniqueImportedNoteTitle(preferredTitle, claimedTitles);
              claimedTitles.add(noteName);
              bodyHtml = cleanRecordVaultNoteBodyHtml(bodyHtml || '<p></p>', noteName);
              // eslint-disable-next-line no-await-in-loop
              const created = await vaultApi.createRecordVaultNote(notebookId, {
                note_name: noteName,
                body_text: bodyHtml || '<p></p>'
              });
              if (!created?.note_id) throw new Error('Failed to create note');
              createdNoteRows.push({
                ...created,
                note_name: created.note_name || noteName,
                body_text: created.body_text != null ? created.body_text : bodyHtml,
                notebook_id: notebookId,
                content_loaded: true
              });
              importedNoteNames.push(fileLabel);
              lastNoteId = created.note_id;
            } catch (err) {
              setError(
                `${fileLabel}: ${readRecordVaultApiError(err, 'import failed')}`
              );
            }
            reportImportProgress(`Imported ${fileLabel}`);
          }

          setNotebooks((prev) => {
            const exists = prev.some((nb) => Number(nb.notebook_id) === notebookId);
            if (exists) {
              return prev.map((nb) =>
                Number(nb.notebook_id) === notebookId
                  ? { ...nb, notes: [...(nb.notes || []), ...createdNoteRows] }
                  : nb
              );
            }
            return [
              {
                ...createdNb,
                notebook_id: notebookId,
                notebook_name: createdNb.notebook_name || notebookName,
                notes: createdNoteRows
              },
              ...prev
            ];
          });

          setSelectedNotebookId(notebookId);
          if (lastNoteId != null) selectNoteId(lastNoteId);

          successResults.push({
            folderName: folder.folderName,
            notebookName: createdNb.notebook_name || notebookName,
            notebookPathLabel: createdNb.notebook_name || notebookName,
            notebookId,
            noteId: lastNoteId,
            noteNames: importedNoteNames
          });
        }

        setFolderImportProgressPercent(100);
        setFolderImportProgressLabel('Finishing…');
        bumpVaultUsage();
        const last = successResults[successResults.length - 1];
        if (last?.notebookId) {
          await loadTree({
            preferNotebookId: last.notebookId,
            preferNoteId: last.noteId || undefined,
            silent: true
          }).catch(() => {});
        }

        if (successResults.length === 1) {
          setFolderImportSuccess(successResults[0]);
        } else if (successResults.length > 1) {
          setFolderImportSuccess({
            folderName: successResults.map((r) => r.folderName).join(', '),
            notebookName: successResults.map((r) => r.notebookName).join(', '),
            notebookPathLabel: successResults.map((r) => r.notebookPathLabel).join(', '),
            noteNames: successResults.flatMap((r) => r.noteNames)
          });
        }
      } catch (err) {
        setError(readRecordVaultApiError(err, 'Folder import failed'));
        await loadTree({ silent: true }).catch(() => {});
      } finally {
        setFolderImportBusy(false);
        setFolderImportProgressPercent(0);
        setFolderImportProgressLabel('');
      }
      return true;
    },
    [
      busy,
      folderImportBusy,
      crossPaneBusy,
      uniqueNotebookNameFromFolder,
      uniqueImportedNoteTitle,
      vaultApi,
      selectNoteId,
      bumpVaultUsage,
      loadTree
    ]
  );

  importFoldersAsNotebooksRef.current = importFoldersAsNotebooksFromDataTransfer;

  const commitNotebookRename = async () => {
    const notebookId = editingNotebookId;
    const trimmed = String(editNameDraft ?? '').trim().toUpperCase();
    if (!notebookId) {
      clearRenameState();
      return;
    }

    const existing = notebooks.find((nb) => Number(nb.notebook_id) === Number(notebookId));
    if (!existing || !trimmed || existing.notebook_name === trimmed) {
      clearRenameState();
      return;
    }

    if (vaultNameExists(trimmed, { excludeNotebookId: notebookId })) {
      clearRenameState();
      setDuplicateNamePopup(DUPLICATE_NAME_MESSAGE);
      return;
    }

    clearRenameState();
    setBusy(true);
    setError('');
    try {
      await vaultApi.updateRecordVaultNotebook(notebookId, trimmed);
      setNotebooks((prev) =>
        prev.map((nb) => (Number(nb.notebook_id) === Number(notebookId) ? { ...nb, notebook_name: trimmed } : nb))
      );
      setShortcuts((prev) =>
        prev.map((sc) =>
          sc.target_type === 'notebook' && Number(sc.notebook_id) === Number(notebookId) ? { ...sc, label: trimmed } : sc
        )
      );
      setRenameSavedPopup(`Rename “${trimmed}” saved`);
    } catch (err) {
      setError(readRecordVaultApiError(err, 'Failed to rename notebook'));
    } finally {
      setBusy(false);
    }
  };

  const commitNoteRename = async () => {
    const noteId = editingNoteId;
    const trimmed = String(editNameDraft ?? '').trim().toUpperCase();
    if (!noteId) {
      clearRenameState();
      return;
    }

    // In search mode the edited note can live in a notebook other than the selected
    // one, so resolve its real owner for the sibling/clash checks.
    const ownerNotebook =
      notebooks.find((nb) => (nb.notes || []).some((n) => Number(n.note_id) === Number(noteId))) ||
      selectedNotebook;
    const siblingNotes = ownerNotebook?.notes || [];
    const isSelected = Number(noteId) === Number(selectedNoteId);

    if (trimmed && vaultNameExists(trimmed, { excludeNoteId: noteId })) {
      clearRenameState();
      setDuplicateNamePopup(DUPLICATE_NAME_MESSAGE);
      return;
    }

    const existing = siblingNotes.find((n) => Number(n.note_id) === Number(noteId));
    const currentLabel = existing
      ? recordVaultNoteSidebarLabel(existing, siblingNotes, notebooks)
      : '';

    // Empty or unchanged name: keep the stored name and just leave edit mode.
    if (!trimmed || currentLabel === trimmed) {
      clearRenameState();
      if (isSelected && existing) {
        updateOpenNoteTitle(currentLabel, { schedulePersist: false });
      }
      return;
    }

    clearRenameState();
    // Persist the name directly rather than through the debounced body autosave:
    // that path is skipped for inner-encrypted notes, so the rename would never
    // reach the backend and would revert on the next tree sync.
    if (isSelected) {
      updateOpenNoteTitle(trimmed, { schedulePersist: false });
    } else {
      setBusy(true);
    }
    setError('');
    try {
      await vaultApi.updateRecordVaultNote(noteId, { note_name: trimmed });
      patchNoteTitleInTree(noteId, trimmed);
      setRenameSavedPopup(`Rename “${trimmed}” saved`);
    } catch (err) {
      setError(readRecordVaultApiError(err, 'Failed to rename note'));
    } finally {
      if (!isSelected) setBusy(false);
    }
  };

  /**
   * Blur/commit for the note title box in the editor header. Upper-cases the
   * entered title and rejects (with a popup + revert) any name that already
   * exists anywhere in the vault, case-insensitive.
   */
  const commitNoteTitleBox = async () => {
    setTitleEditing(false);
    if (!selectedNoteId) return;
    const noteId = Number(selectedNoteId);
    const snapshot = String(noteTitleBoxSnapshotRef.current ?? '');
    const upper = String(draftRef.current.openNoteTitlePlain ?? '').trim().toUpperCase();

    const revertToSnapshot = () => {
      setOpenNoteTitlePlain(snapshot);
      draftRef.current = { ...draftRef.current, openNoteTitlePlain: snapshot };
      patchNoteTitleInTree(noteId, snapshot.trim());
    };

    // Reject a name that already exists anywhere in the vault (case-insensitive).
    if (upper && vaultNameExists(upper, { excludeNoteId: noteId })) {
      revertToSnapshot();
      setDuplicateNamePopup(DUPLICATE_NAME_MESSAGE);
      return;
    }

    // Empty or a computed "NB x, Note y" style placeholder: never freeze a
    // positional label as the real name — keep the previous title.
    const isPlaceholder =
      !upper ||
      isDefaultStyleRecordVaultNoteTitle(upper) ||
      isLegacyShortRecordVaultNoteName(upper);
    if (isPlaceholder) {
      revertToSnapshot();
      return;
    }

    // Unchanged: nothing to persist, just normalize the displayed value.
    if (upper === snapshot.trim().toUpperCase()) {
      setOpenNoteTitlePlain(upper);
      draftRef.current = { ...draftRef.current, openNoteTitlePlain: upper };
      return;
    }

    setOpenNoteTitlePlain(upper);
    draftRef.current = { ...draftRef.current, openNoteTitlePlain: upper };
    patchNoteTitleInTree(noteId, upper);
    setError('');
    try {
      await vaultApi.updateRecordVaultNote(noteId, { note_name: upper });
      setRenameSavedPopup(`Rename “${upper}” saved`);
    } catch (err) {
      setError(readRecordVaultApiError(err, 'Failed to rename note'));
    }
  };

  const handleAddNotebook = () => {
    if (busy) return;
    setCreateItemDialog('notebook');
  };

  const handleAddNote = () => {
    if (busy || !selectedNotebookId || notebookGateLocked) return;
    if (isBillScheduleNotebookId(selectedNotebookId)) return;
    setCreateItemDialog('note');
  };

  const confirmCreateNotebook = async (rawName) => {
    const desiredName = String(rawName || '').trim().toUpperCase();
    if (!desiredName) return;
    if (vaultNameExists(desiredName)) {
      setCreateItemDialog(null);
      setDuplicateNamePopup(DUPLICATE_NAME_MESSAGE);
      return;
    }
    setCreateItemDialog(null);
    setBusy(true);
    setError('');
    try {
      const created = await vaultApi.createRecordVaultNotebook(desiredName);
      await loadTree({ preferNotebookId: created?.notebook_id, silent: true });
    } catch (err) {
      setError(readRecordVaultApiError(err, 'Failed to add notebook'));
    } finally {
      setBusy(false);
    }
  };

  const confirmCreateNote = async (rawName) => {
    if (!selectedNotebookId) return;
    const desiredName = String(rawName || '').trim().toUpperCase();
    if (!desiredName) return;
    if (vaultNameExists(desiredName)) {
      setCreateItemDialog(null);
      setDuplicateNamePopup(DUPLICATE_NAME_MESSAGE);
      return;
    }
    setCreateItemDialog(null);
    setBusy(true);
    setError('');
    try {
      const created = await vaultApi.createRecordVaultNote(selectedNotebookId, { note_name: desiredName });
      if (!created?.note_id) throw new Error('Failed to create note');
      const createdRow = {
        ...created,
        note_name: created.note_name || desiredName,
        notebook_id: Number(created.notebook_id ?? selectedNotebookId),
        content_loaded: created.body_text != null
      };
      setNotebooks((prev) =>
        prev.map((nb) =>
          Number(nb.notebook_id) === Number(selectedNotebookId)
            ? { ...nb, notes: [...(nb.notes || []), createdRow] }
            : nb
        )
      );
      selectNoteId(created.note_id);
    } catch (err) {
      setError(readRecordVaultApiError(err, 'Failed to add note'));
    } finally {
      setBusy(false);
    }
  };















  const handleDeleteNotebook = async (notebookId, notebookName) => {
    if (isBillScheduleNotebookId(notebookId)) return;
    if (busy || !notebookId) return;
    const label = String(notebookName ?? 'this notebook').trim() || 'this notebook';
    if (!(await themedConfirm(`Delete "${label}" and all its notes? You can restore within 7 days (undelete coming later).`))) return;
    setBusyLabel('Deleting notebook');
    setBusy(true);
    setError('');
    try {
      await vaultApi.deleteRecordVaultNotebook(notebookId);
      await loadTree({ silent: true });
    } catch (err) {
      setError(readRecordVaultApiError(err, 'Failed to delete notebook'));
    } finally {
      setBusy(false);
      setBusyLabel('');
    }
  };

  const handleDeleteNote = async (noteId, noteLabel) => {
    if (isBillScheduleSystemId(noteId)) return;
    if (busy || innerEncryptBusy || !noteId) return;
    const label = String(noteLabel ?? 'this note').trim() || 'this note';
    const note =
      Number(selectedNote?.note_id) === Number(noteId)
        ? selectedNote
        : notebooks.flatMap((nb) => nb.notes || []).find((n) => Number(n.note_id) === Number(noteId));
    const encrypted = noteHasInnerEncryption(note);
    const confirmed = encrypted
      ? await themedConfirm('Are you sure you want to delete this file (encrypted)?')
      : await themedConfirm(`Delete "${label}"? You can restore within 7 days (undelete coming later).`);
    if (!confirmed) return;
    setBusyLabel('Deleting note');
    setBusy(true);
    setError('');
    try {
      await vaultApi.deleteRecordVaultNote(noteId);
      clearInnerUnlockForNote(noteId);
      const notebookId = Number(selectedNotebookId);
      const remainingNotes = (selectedNotebook?.notes || []).filter(
        (n) => Number(n.note_id) !== Number(noteId)
      );
      setNotebooks((prev) =>
        prev.map((nb) =>
          Number(nb.notebook_id) === notebookId ? { ...nb, notes: remainingNotes } : nb
        )
      );
      setShortcuts((prev) =>
        prev.filter(
          (sc) => !(sc.target_type === 'note' && Number(sc.note_id) === Number(noteId))
        )
      );
      if (Number(selectedNoteId) === Number(noteId)) {
        const nextNoteId = remainingNotes[0]?.note_id ?? null;
        if (nextNoteId) selectNoteId(nextNoteId);
        else setSelectedNoteId(null);
      }
    } catch (err) {
      setError(readRecordVaultApiError(err, 'Failed to delete note'));
    } finally {
      setBusy(false);
      setBusyLabel('');
    }
  };

  const handleRemoveShortcut = async (shortcutId, shortcutLabel) => {
    if (busy || !shortcutId) return;
    const label = String(shortcutLabel ?? 'this shortcut').trim() || 'this shortcut';
    if (!(await themedConfirm(`Remove "${label}" from shortcuts?`))) return;
    setBusyLabel('Removing shortcut');
    setBusy(true);
    setError('');
    try {
      await vaultApi.deleteRecordVaultShortcut(shortcutId);
      setShortcuts((prev) => prev.filter((sc) => Number(sc.shortcut_id) !== Number(shortcutId)));
    } catch (err) {
      setError(readRecordVaultApiError(err, 'Failed to remove shortcut'));
    } finally {
      setBusy(false);
      setBusyLabel('');
    }
  };

  // innerUnlockVersion keeps this in sync when PIN unlock succeeds (unlock state lives in a ref).
  const innerNoteLocked = Boolean(
    selectedNote &&
      noteHasInnerEncryption(selectedNote) &&
      !isInnerNoteUnlocked(selectedNote.note_id) &&
      !noteContentLoading &&
      innerUnlockVersion >= 0
  );
  // Fully PIN-locked notebook (red *****) — hide all note names/content until notebook unlock.
  const selectedNotebookInnerLocked = notebookInnerLockedForDisplay(selectedNotebook?.notes || []);
  const notebookGateLocked = Boolean(selectedNotebookInnerLocked);
  // Hold the PIN / Lock.gif panel while crypto runs — especially unlock: content must
  // stay hidden until Lock.gif finishes (even if decrypt already succeeded).
  // Notebook gate also forces the panel so sibling-unlocked plaintext cannot leak.

  useEffect(() => {
    if (!selectedNote || !innerNoteLocked) {
      return undefined;
    }
    const noteId = Number(selectedNote.note_id);
    const refresh = () => {
      const until = resolveInnerUnlockLockedUntilMs({
        storageType: paneStorageType,
        singlesId: user?.singles_id,
        noteId,
        vaultLockedUntil: selectedNote.inner_unlock_locked_until
      });
      setInnerUnlockCooldownSec(remainingInnerUnlockLockoutSeconds(until));
    };
    refresh();
    const timerId = window.setInterval(refresh, 1000);
    return () => window.clearInterval(timerId);
  }, [
    selectedNote,
    selectedNote?.note_id,
    selectedNote?.inner_unlock_locked_until,
    innerNoteLocked,
    paneStorageType,
    user?.singles_id,
    innerUnlockVersion
  ]);




  const notes = useMemo(() => {
    const source = displayNotebooks;
    const nb =
      source.find((item) => Number(item.notebook_id) === Number(selectedNotebookId)) ??
      source[0] ??
      selectedNotebook;
    return nb?.notes || [];
  }, [displayNotebooks, selectedNotebookId, selectedNotebook]);

  const searchResultTabs = useMemo(() => {
    if (!searchActive || !Array.isArray(searchResults)) return [];
    const tabs = searchResults.map((result) => {
      const notebookIndex = notebooks.findIndex(
        (nb) => Number(nb.notebook_id) === Number(result.notebook_id)
      );
      const notebook =
        notebookIndex >= 0
          ? notebooks[notebookIndex]
          : { notebook_id: result.notebook_id, notebook_name: result.notebook_name };
      const notesInNotebook = notebook?.notes || [];
      const noteIndex = notesInNotebook.findIndex(
        (item) => Number(item.note_id) === Number(result.note_id)
      );
      const note =
        noteIndex >= 0
          ? notesInNotebook[noteIndex]
          : {
              note_id: result.note_id,
              notebook_id: result.notebook_id,
              note_name: result.note_name
            };
      return {
        note_id: Number(result.note_id),
        notebook_id: Number(result.notebook_id),
        // Fixed position in the vault tree (notebook order, then note order) so the
        // found-note tabs never reshuffle as the backend/index returns matches in a
        // different order — the ◀/▶ arrows then move predictably left/right.
        notebookIndex: notebookIndex < 0 ? Number.MAX_SAFE_INTEGER : notebookIndex,
        noteIndex: noteIndex < 0 ? Number.MAX_SAFE_INTEGER : noteIndex,
        label:
          Number(result.note_id) === Number(selectedNoteId)
            ? openNoteTitlePlain ||
              recordVaultSearchResultTabLabel(note, notebook, notebooks, notesInNotebook)
            : recordVaultSearchResultTabLabel(note, notebook, notebooks, notesInNotebook)
      };
    });
    tabs.sort((a, b) => {
      if (a.notebookIndex !== b.notebookIndex) return a.notebookIndex - b.notebookIndex;
      if (a.noteIndex !== b.noteIndex) return a.noteIndex - b.noteIndex;
      return a.note_id - b.note_id;
    });
    return tabs;
  }, [searchActive, searchResults, notebooks, selectedNoteId, openNoteTitlePlain]);

  const handleSearchResultSelect = useCallback((notebookId, noteId) => {
    setSelectedNotebookId(notebookId);
    selectNoteId(noteId);
    setLeftMenuOpen(true);
    setRightMenuOpen(true);
  }, [selectNoteId]);

  // Index of the open note within the search-result tabs (for left/right doc nav).
  const currentSearchDocIndex = useMemo(
    () =>
      searchResultTabs.findIndex(
        (t) =>
          Number(t.notebook_id) === Number(selectedNotebookId) &&
          Number(t.note_id) === Number(selectedNoteId)
      ),
    [searchResultTabs, selectedNotebookId, selectedNoteId]
  );

  /** Up/Down: step through the highlighted matches inside the open note. */
  const goToSearchHit = useCallback(
    (delta) => {
      const api = noteEditorApiRef.current;
      if (!api?.setActiveSearchHit || searchHitCount <= 0) return;
      const base = activeHitIndex < 0 ? 0 : activeHitIndex;
      const next = Math.max(0, Math.min(searchHitCount - 1, base + delta));
      if (next === activeHitIndex) return;
      setActiveHitIndex(next);
      api.setActiveSearchHit(next);
    },
    [searchHitCount, activeHitIndex]
  );

  /** Left/Right: jump to the previous/next found note (doc) in the results. */
  const goToSearchDoc = useCallback(
    (delta) => {
      if (!searchResultTabs.length) return;
      const base = currentSearchDocIndex < 0 ? 0 : currentSearchDocIndex;
      const next = Math.max(0, Math.min(searchResultTabs.length - 1, base + delta));
      const tab = searchResultTabs[next];
      if (tab) handleSearchResultSelect(tab.notebook_id, tab.note_id);
    },
    [searchResultTabs, currentSearchDocIndex, handleSearchResultSelect]
  );

  const menusOpen = leftMenuOpen || rightMenuOpen;
  const menuLabelsCompact = menusOpen && !menuLabelsExpanded;

  /** Open left+right notebook menus, or collapse them so the editor goes full width.
   *  Top action bar stays put — only the sidebar columns toggle. */
  const handleMenuLabelsToggle = useCallback(() => {
    if (!menusOpen) {
      setLeftMenuOpen(true);
      setRightMenuOpen(true);
      setMenuLabelsExpanded(true);
      return;
    }
    setLeftMenuOpen(false);
    setRightMenuOpen(false);
  }, [menusOpen]);

  useEffect(() => {
    if (!compareMode) return;
    setLeftMenuOpen(true);
    setRightMenuOpen(true);
  }, [compareMode]);

  useEffect(() => {
    if (!searchActive || !selectedNoteId) return undefined;
    const timerId = window.setTimeout(() => {
      document
        .getElementById(`record-vault-note-${selectedNoteId}`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      document
        .getElementById(`record-vault-notebook-${selectedNotebookId}`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [searchActive, selectedNoteId, selectedNotebookId]);

  const menuRailButtonCellSx = {
    flex: '0 0 auto',
    p: 1,
    bgcolor: 'transparent',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center'
  };

  const paneStripColor = tutaNotesStorageStripColor(paneStorageType);

  return (
    <RecordVaultSliderControlButtonProvider fontRem={menuButtonFontRem}>
    <Box
      data-record-vault-pane
      data-record-vault-storage={paneStorageType}
      onDragEnter={(event) => {
        if (isForeignCrossPaneDrag(event, paneStorageType)) {
          setCrossPaneDropActive(true);
        }
      }}
      onDragOver={(event) => {
        if (!isForeignCrossPaneDrag(event, paneStorageType)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        setCrossPaneDropActive(true);
      }}
      onDragLeave={(event) => {
        const related = event.relatedTarget;
        if (related && event.currentTarget.contains(related)) return;
        setCrossPaneDropActive(false);
      }}
      onDrop={(event) => {
        if (tryHandleForeignCrossPaneDrop(event, { targetNotebookId: selectedNotebookId })) {
          setCrossPaneDropActive(false);
        }
      }}
      sx={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        width: '100%',
        height: compact ? '100%' : '100%',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: MAIN_FONT_FAMILY,
        bgcolor: 'var(--theme-daynight-color)',
        overflow: 'hidden'
      }}
    >
      
      <BusyHourglassOverlay
        open={Boolean(batchUploadProgress)}
        label={batchUploadProgress?.label || 'Uploading files'}
        backdropSx={vaultLeavingBackdropSx}
        fontSize={BUSY_HOURGLASS_MY_NOTE_SIZE}
      />
      <BusyHourglassOverlay
        open={Boolean(busy && busyLabel)}
        label={busyLabel || 'Working'}
        backdropSx={vaultLeavingBackdropSx}
        fontSize={BUSY_HOURGLASS_MY_NOTE_SIZE}
      />
      <BusyHourglassOverlay
        open={crossPaneBusy}
        label={
          crossPaneTransfer?.item?.storageType === 'onedrive'
            ? paneStorageType === 'usb'
              ? 'Copying from Cloud to USB'
              : 'Transferring Cloud item'
            : paneStorageType === 'onedrive'
              ? 'Copying from USB to Cloud'
              : 'Transferring USB item'
        }
        progressPercent={crossPaneProgressPercent}
        progressLabel={crossPaneProgressLabel}
        backdropSx={vaultLeavingBackdropSx}
        fontSize={BUSY_HOURGLASS_MY_NOTE_SIZE}
      />
      <BusyHourglassOverlay
        open={false}
        label="Loading OneDrive sign-in"
        backdropSx={vaultLeavingBackdropSx}
        fontSize={BUSY_HOURGLASS_MY_NOTE_SIZE}
      />
      <BusyHourglassOverlay
        open={vaultLeaving}
        label={paneStorageType === 'onedrive' ? 'Saving to Cloud' : 'Logging off USB'}
        progressPercent={vaultLeavingProgressPercent}
        progressLabel={vaultLeavingProgressLabel}
        backdropSx={vaultLeavingBackdropSx}
        fontSize={BUSY_HOURGLASS_MY_NOTE_SIZE}
      />

      <RecordVaultMobileUploadDialog
        open={mobileUploadOpen}
        onClose={() => setMobileUploadOpen(false)}
        disabled={busy || !selectedNote}
        onPhoneUploadComplete={(photosId) => void handleMobilePhoneUploadComplete(photosId)}
      />

      <RecordVaultCrossPaneTransferDialog
        open={Boolean(crossPaneTransfer) || Boolean(crossPaneDuplicateError)}
        item={crossPaneTransfer?.item || null}
        targetStorageType={paneStorageType === 'onedrive' ? 'onedrive' : 'usb'}
        targetNotebookName={crossPaneTransfer?.targetNotebookName || ''}
        busy={crossPaneBusy}
        duplicateError={crossPaneDuplicateError}
        onCopy={() => void runCrossPaneTransfer('copy')}
        onMove={() => void runCrossPaneTransfer('move')}
        onClose={() => {
          if (crossPaneBusy) return;
          setCrossPaneTransfer(null);
          setCrossPaneDuplicateError('');
        }}
        onDismissDuplicate={() => {
          setCrossPaneDuplicateError('');
          setCrossPaneTransfer(null);
        }}
      />
      <BusyHourglassOverlay
        open={notebookExportBusy}
        label={
          notebookHtmlExportOffer?.notebookName
            ? `Exporting notebook “${notebookHtmlExportOffer.notebookName}”`
            : 'Exporting notebook'
        }
        progressPercent={notebookExportProgressPercent}
        progressLabel={notebookExportProgressLabel}
        backdropSx={vaultLeavingBackdropSx}
        fontSize={BUSY_HOURGLASS_MY_NOTE_SIZE}
      />
      <BusyHourglassOverlay
        open={folderImportBusy}
        label="Importing folder as notebook"
        progressPercent={folderImportProgressPercent}
        progressLabel={folderImportProgressLabel}
        backdropSx={vaultLeavingBackdropSx}
        fontSize={BUSY_HOURGLASS_MY_NOTE_SIZE}
      />
      <BusyHourglassOverlay
        open={multiHtmlExportBusy}
        label="Exporting notes as HTML"
        progressPercent={multiHtmlExportProgressPercent}
        progressLabel={multiHtmlExportProgressLabel}
        backdropSx={vaultLeavingBackdropSx}
        fontSize={BUSY_HOURGLASS_MY_NOTE_SIZE}
      />
      <BusyHourglassOverlay
        open={Boolean(noteFileImportProgress)}
        label="Importing notes"
        progressPercent={noteFileImportProgress?.percent ?? 0}
        progressLabel={noteFileImportProgress?.label || ''}
        backdropSx={vaultLeavingBackdropSx}
        fontSize={BUSY_HOURGLASS_MY_NOTE_SIZE}
      />
      <ColorTemplate16PopupCenterWide
        open={Boolean(folderImportSuccess)}
        onClose={() => setFolderImportSuccess(null)}
        closeOnBackdrop={false}
        closeButtonAriaLabel="Close folder import success"
      >
        <ColorTemplate16PopupCenterWide.Body spacing={2}>
          <ColorTemplate16PopupCenterWide.Title>Folder import complete</ColorTemplate16PopupCenterWide.Title>
          <ColorTemplate16PopupCenterWide.BodyText>
            {folderImportSuccess
              ? `Success: Folder ${folderImportSuccess.folderName} been IMPORT to new Notebook ${folderImportSuccess.notebookPathLabel} along with these import Notes: ${(folderImportSuccess.noteNames || []).join(', ') || '(none)'}.`
              : ''}
          </ColorTemplate16PopupCenterWide.BodyText>
          <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
            <ColorTemplate16PopupCenterWide.ActionButton onClick={() => setFolderImportSuccess(null)}>
              Close
            </ColorTemplate16PopupCenterWide.ActionButton>
          </Stack>
        </ColorTemplate16PopupCenterWide.Body>
      </ColorTemplate16PopupCenterWide>
      <ColorTemplate16PopupCenterWide
        open={Boolean(multiHtmlExportOffer)}
        onClose={() => {
          if (multiHtmlExportBusy) return;
          setMultiHtmlExportOffer(null);
        }}
        closeOnBackdrop={!multiHtmlExportBusy}
        closeButtonAriaLabel="Close export HTML dialog"
      >
        <ColorTemplate16PopupCenterWide.Body spacing={2}>
          <ColorTemplate16PopupCenterWide.Title>
            Export {multiHtmlExportOffer?.count || 0} notes as HTML
          </ColorTemplate16PopupCenterWide.Title>
          <ColorTemplate16PopupCenterWide.BodyText>
            Chrome cannot drop multiple real files into Finder in one drag (you get a
            .textClipping). Choose a folder and each selected note will be saved as its
            own .html file.
          </ColorTemplate16PopupCenterWide.BodyText>
          <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
            <ColorTemplate16PopupCenterWide.ActionButton
              disabled={multiHtmlExportBusy}
              onClick={() => {
                if (multiHtmlExportBusy) return;
                setMultiHtmlExportOffer(null);
              }}
            >
              Cancel
            </ColorTemplate16PopupCenterWide.ActionButton>
            <ColorTemplate16PopupCenterWide.ActionButton
              disabled={multiHtmlExportBusy}
              onClick={() => {
                if (multiHtmlExportBusy || !multiHtmlExportOffer?.files?.length) return;
                setMultiHtmlExportBusy(true);
                setMultiHtmlExportProgressPercent(0);
                setMultiHtmlExportProgressLabel('Choose a folder…');
                const offer = multiHtmlExportOffer;
                void downloadHtmlFilesSeparately(offer.files, {
                  onProgress: ({ percent, label }) => {
                    setMultiHtmlExportProgressPercent(percent);
                    if (label) setMultiHtmlExportProgressLabel(label);
                  }
                })
                  .then((ok) => {
                    if (ok) {
                      (offer.messages || []).forEach((msg) => enqueueImportSuccessPopup(msg, 2500));
                    }
                  })
                  .finally(() => {
                    setMultiHtmlExportBusy(false);
                    setMultiHtmlExportProgressPercent(0);
                    setMultiHtmlExportProgressLabel('');
                    setMultiHtmlExportOffer(null);
                  });
              }}
            >
              {multiHtmlExportBusy ? 'Saving…' : 'Choose folder'}
            </ColorTemplate16PopupCenterWide.ActionButton>
          </Stack>
        </ColorTemplate16PopupCenterWide.Body>
      </ColorTemplate16PopupCenterWide>
      <ColorTemplate16PopupCenterWide
        open={Boolean(notebookHtmlExportOffer) && !notebookExportBusy && !notebookExportSuccess}
        onClose={() => {
          if (notebookExportBusy) return;
          setNotebookHtmlExportOffer(null);
        }}
        closeOnBackdrop={!notebookExportBusy}
        closeButtonAriaLabel="Close notebook export dialog"
      >
        <ColorTemplate16PopupCenterWide.Body spacing={2}>
          <ColorTemplate16PopupCenterWide.Title>
            Export notebook “{notebookHtmlExportOffer?.notebookName || 'Notebook'}”
          </ColorTemplate16PopupCenterWide.Title>
          <ColorTemplate16PopupCenterWide.BodyText>
            Choose a parent folder. A subfolder named “
            {sanitizeRecordVaultExportFileName(notebookHtmlExportOffer?.notebookName || 'Notebook')}
            ” will be created and each of the {notebookHtmlExportOffer?.noteCount ?? 0} note(s)
            will be saved as its own .html file inside it.
          </ColorTemplate16PopupCenterWide.BodyText>
          <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
            <ColorTemplate16PopupCenterWide.ActionButton
              disabled={notebookExportBusy}
              onClick={() => setNotebookHtmlExportOffer(null)}
            >
              Cancel
            </ColorTemplate16PopupCenterWide.ActionButton>
            <ColorTemplate16PopupCenterWide.ActionButton
              disabled={notebookExportBusy}
              onClick={() => {
                if (notebookExportBusy || !notebookHtmlExportOffer?.notebookId) return;
                const offer = notebookHtmlExportOffer;
                void exportNotebookHtmlFolder(offer.notebookId).then((result) => {
                  setNotebookHtmlExportOffer(null);
                  if (result) setNotebookExportSuccess(result);
                });
              }}
            >
              Choose folder
            </ColorTemplate16PopupCenterWide.ActionButton>
          </Stack>
        </ColorTemplate16PopupCenterWide.Body>
      </ColorTemplate16PopupCenterWide>
      <ColorTemplate16PopupCenterWide
        open={Boolean(notebookExportSuccess)}
        onClose={() => setNotebookExportSuccess(null)}
        closeOnBackdrop={false}
        closeButtonAriaLabel="Close notebook export success"
      >
        <ColorTemplate16PopupCenterWide.Body spacing={2}>
          <ColorTemplate16PopupCenterWide.Title>Notebook export complete</ColorTemplate16PopupCenterWide.Title>
          <ColorTemplate16PopupCenterWide.BodyText>
            {notebookExportSuccess
              ? `Success: Notebook ${notebookExportSuccess.notebookName} been EXPORT to folder ${notebookExportSuccess.folderPath} along with these export HTML files: ${(notebookExportSuccess.noteNames || []).join(', ') || '(none)'}.${
                  notebookExportSuccess.skippedLocked?.length
                    ? ` Skipped locked notes: ${notebookExportSuccess.skippedLocked.join(', ')}.`
                    : ''
                }`
              : ''}
          </ColorTemplate16PopupCenterWide.BodyText>
          <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
            <ColorTemplate16PopupCenterWide.ActionButton onClick={() => setNotebookExportSuccess(null)}>
              Close
            </ColorTemplate16PopupCenterWide.ActionButton>
          </Stack>
        </ColorTemplate16PopupCenterWide.Body>
      </ColorTemplate16PopupCenterWide>
      <RecordVaultViewVaultDialog
        open={viewVaultOpen}
        onClose={() => setViewVaultOpen(false)}
        storageType={viewVaultStorageType}
        folderName={viewVaultStorageType === 'onedrive' ? oneDriveVaultFolderName : ''}
      />
      <RecordVaultOneDriveBackupDialog
        open={oneDriveBackupOpen}
        onClose={() => setOneDriveBackupOpen(false)}
        folderName={oneDriveVaultFolderName}
        tutaDrive={String(paneLabel || '').toLowerCase() === 'tutadrive'}
        onOpenMyNote={() => setOneDriveBackupOpen(false)}
        onRestored={() => void handleOneDriveVaultRestored()}
      />
      <RecordVaultUsbBackupDialog
        open={usbBackupOpen}
        onClose={() => setUsbBackupOpen(false)}
        folderLabel={usbVaultFolderLabel}
        onOpenMyNote={() => setUsbBackupOpen(false)}
        onRestored={() => handleUsbVaultRestoredOrFormatted()}
      />
      <RecordVaultCreateItemDialog
        open={Boolean(createItemDialog)}
        mode={createItemDialog}
        busy={busy}
        noteNamePlaceholder={formatDefaultRecordVaultNoteTitle(
          notebookNumberFromList(notebooks, selectedNotebookId),
          (selectedNotebook?.notes || []).length + 1
        ).toUpperCase()}
        onClose={() => setCreateItemDialog(null)}
        onConfirmNotebook={(name) => void confirmCreateNotebook(name)}
        onConfirmNote={(name) => void confirmCreateNote(name)}
      />
      <ColorTemplate16PopupCenterWide
        open={vaultFileTooLargeOpen}
        onClose={() => setVaultFileTooLargeOpen(false)}
        closeOnBackdrop
        closeButtonAriaLabel="Close file too large dialog"
      >
        <ColorTemplate16PopupCenterWide.Body spacing={2}>
          <ColorTemplate16PopupCenterWide.Title>File too large</ColorTemplate16PopupCenterWide.Title>
          <ColorTemplate16PopupCenterWide.BodyText>
            {vaultFileTooLargeName} ({vaultFileTooLargeActualMb} MB) is over the {vaultFileTooLargeMaxMb} MB allowed
            for vault uploads.
          </ColorTemplate16PopupCenterWide.BodyText>
          <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
            <ColorTemplate16PopupCenterWide.ActionButton onClick={() => setVaultFileTooLargeOpen(false)}>
              OK
            </ColorTemplate16PopupCenterWide.ActionButton>
          </Stack>
        </ColorTemplate16PopupCenterWide.Body>
      </ColorTemplate16PopupCenterWide>
      <ColorTemplate16PopupCenterWide
        open={Boolean(duplicateNamePopup)}
        onClose={() => setDuplicateNamePopup('')}
        closeOnBackdrop
        closeButtonAriaLabel="Close duplicate name dialog"
      >
        <ColorTemplate16PopupCenterWide.Body spacing={2}>
          <ColorTemplate16PopupCenterWide.Title>Duplicate name</ColorTemplate16PopupCenterWide.Title>
          <ColorTemplate16PopupCenterWide.BodyText>{duplicateNamePopup}</ColorTemplate16PopupCenterWide.BodyText>
          <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
            <ColorTemplate16PopupCenterWide.ActionButton onClick={() => setDuplicateNamePopup('')}>
              OK
            </ColorTemplate16PopupCenterWide.ActionButton>
          </Stack>
        </ColorTemplate16PopupCenterWide.Body>
      </ColorTemplate16PopupCenterWide>
      <ColorTemplate16PopupCenterWide
        open={Boolean(renameSavedPopup)}
        onClose={() => setRenameSavedPopup('')}
        closeOnBackdrop
        closeButtonAriaLabel="Close rename saved dialog"
      >
        <ColorTemplate16PopupCenterWide.Body spacing={2}>
          <ColorTemplate16PopupCenterWide.Title>Rename saved</ColorTemplate16PopupCenterWide.Title>
          <ColorTemplate16PopupCenterWide.BodyText>{renameSavedPopup}</ColorTemplate16PopupCenterWide.BodyText>
          <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
            <ColorTemplate16PopupCenterWide.ActionButton onClick={() => setRenameSavedPopup('')}>
              OK
            </ColorTemplate16PopupCenterWide.ActionButton>
          </Stack>
        </ColorTemplate16PopupCenterWide.Body>
      </ColorTemplate16PopupCenterWide>
      <ColorTemplate16PopupCenterWide
        open={Boolean(importSuccessPopup)}
        onClose={() => setImportSuccessPopup('')}
        closeOnBackdrop
        showCloseButton={false}
        closeButtonAriaLabel="Close import success"
      >
        <ColorTemplate16PopupCenterWide.Body spacing={2}>
          <ColorTemplate16PopupCenterWide.Title>Import</ColorTemplate16PopupCenterWide.Title>
          <ColorTemplate16PopupCenterWide.BodyText>{importSuccessPopup}</ColorTemplate16PopupCenterWide.BodyText>
        </ColorTemplate16PopupCenterWide.Body>
      </ColorTemplate16PopupCenterWide>
      <ColorTemplate16PopupCenterWide
        open={vaultUploadErrorOpen}
        onClose={() => setVaultUploadErrorOpen(false)}
        closeOnBackdrop
        closeButtonAriaLabel="Close upload error dialog"
      >
        <ColorTemplate16PopupCenterWide.Body spacing={2}>
          <ColorTemplate16PopupCenterWide.Title>{vaultUploadErrorTitle}</ColorTemplate16PopupCenterWide.Title>
          <ColorTemplate16PopupCenterWide.BodyText sx={{ whiteSpace: 'pre-wrap' }}>
            {vaultUploadErrorMessage}
          </ColorTemplate16PopupCenterWide.BodyText>
          {vaultUploadErrorDetail ? (
            <ColorTemplate16PopupCenterWide.BodyText
              sx={{ whiteSpace: 'pre-wrap', opacity: 0.9, fontSize: '0.9em', textAlign: 'left' }}
            >
              {vaultUploadErrorDetail}
            </ColorTemplate16PopupCenterWide.BodyText>
          ) : null}
          <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
            <ColorTemplate16PopupCenterWide.ActionButton onClick={() => setVaultUploadErrorOpen(false)}>
              OK
            </ColorTemplate16PopupCenterWide.ActionButton>
          </Stack>
        </ColorTemplate16PopupCenterWide.Body>
      </ColorTemplate16PopupCenterWide>
      {error ? (
        <VaultWorkspaceErrorPopup error={error} onClose={() => setError('')} />
      ) : null}

      <BusyHourglassOverlay
        open={!vaultUiReady && loading && unlocked}
        label="Loading vault"
        backdropSx={myNoteLoadingBackdropSx}
        fontSize={BUSY_HOURGLASS_MY_NOTE_SIZE}
      />
      <BusyHourglassOverlay
        open={Boolean(unlocked && noteContentLoading && vaultUiReady)}
        label={paneStorageType === 'onedrive' ? 'Loading note from OneDrive' : 'Loading note'}
        backdropSx={vaultLeavingBackdropSx}
        fontSize={BUSY_HOURGLASS_MY_NOTE_SIZE}
      />

      {!unlocked ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flex: 1,
            py: 6,
            ...myNoteBackgroundPanelSx
          }}
        />
      ) : (
        <Box sx={{ display: 'flex', flex: 1, minHeight: 0, width: '100%', flexDirection: 'column' }}>
          <RecordVaultUsageBar
            usage={vaultUsage}
            storageType={paneStorageType}
            videoTutorialUrl={videoTutorialUrl}
            onPurchased={() => refreshVaultUsageRef.current?.()}
            onGetMoreTokens={openPaymentTokenCheckout}
          />
          <Box
            sx={{
              flexShrink: 0,
              display: 'flex',
              width: '100%',
              minWidth: 0,
              overflow: 'visible',
              borderBottom: '2px solid var(--theme-primary-color)',
              zIndex: 3,
              pt: '2vh',
              alignItems: 'stretch',
              bgcolor: paneStripColor
            }}
          >
            <Box
              {...guestDemoAllowProps()}
              sx={{
                flex: '0 0 auto',
                display: 'flex',
                flexDirection: 'column',
                bgcolor: 'transparent',
                // Keep this rail width stable when menus close so File / Search / Backup
                // stay put; only the notebook sidebar below collapses.
                minWidth: {
                  xs: menuLabelsCompact ? 0 : 148,
                  md: compareMode ? 220 : menuLabelsCompact ? 0 : sidebarWidth
                },
                maxWidth: {
                  xs: '100%',
                  md: compareMode
                    ? 280
                    : menuLabelsCompact
                      ? 'fit-content'
                      : sidebarWidth
                },
                width: menuLabelsCompact ? 'auto' : undefined,
                overflow: 'visible',
                boxSizing: 'border-box'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'stretch', minWidth: 0, overflow: 'visible' }}>
                {!compareMode ? (
                  <Box
                    sx={{
                      ...menuRailButtonCellSx,
                      flex: '0 0 auto',
                      width: 'auto',
                      minWidth: 0,
                      overflow: 'visible'
                    }}
                  >
                    <RecordVaultFileMenu
                      disabled={busy}
                      ready={
                        Boolean(selectedNote) &&
                        !(
                          noteRequiresInnerPinToView(selectedNote) &&
                          !isInnerNoteUnlocked(selectedNote.note_id)
                        )
                      }
                      noteTitle={openNoteTitlePlain}
                      getHtml={getEditorHtml}
                      getMarkdown={getEditorMarkdown}
                      onImportHtml={handleImportHtml}
                      onImportMarkdown={handleImportMarkdown}
                      paymentActive={fileWorkspaceView === 'payment'}
                      onSelectPayment={openPaymentWorkspace}
                      onSelectNotes={() => setFileWorkspaceView('notes')}
                      buttonSx={headerToggleButtonSx}
                    />
                  </Box>
                ) : null}
                <Box
                  sx={{
                    ...menuRailButtonCellSx,
                    flex: '0 0 auto',
                    width: 'auto',
                    minWidth: 0,
                    overflow: 'visible'
                  }}
                >
                  {compareMode ? (
                    <SliderControlButton
                      type="button"
                      variant="yellow"
                      hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
                      aria-label="Return to single storage view"
                      onClick={() => onReturnFromCompare?.()}
                      sx={headerToggleButtonSx}
                    >
                      Return
                    </SliderControlButton>
                  ) : (
                    <SliderControlButton
                      type="button"
                      variant="yellow"
                      hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
                      aria-label={!menusOpen ? 'Open menus' : 'Close menus'}
                      title={!menusOpen ? 'Open left and right menus' : 'Close left and right menus'}
                      onClick={handleMenuLabelsToggle}
                      sx={headerToggleButtonSx}
                    >
                      {menusOpen ? '< Close Menu' : 'Open Menu >'}
                    </SliderControlButton>
                  )}
                </Box>
                <Box
                  sx={{
                    ...menuRailButtonCellSx,
                    flex: '0 0 auto',
                    width: 'auto',
                    minWidth: 0,
                    maxWidth: 'none',
                    overflow: 'visible'
                  }}
                >
                  <SliderControlButton
                    type="button"
                    variant="logoff"
                    hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
                    singleLineLabel
                    data-guest-demo-allow="true"
                    onClick={() => void (usePaneLogOff ? handleLogOffPane() : handleExitToMall())}
                    disabled={busy}
                    aria-label={usePaneLogOff ? logOffPaneLabel : 'Exit to Mall'}
                    title={usePaneLogOff ? logOffPaneLabel : 'Exit to Mall'}
                    sx={headerToggleButtonSx}
                  >
                    {menuLabelsCompact ? (
                      (usePaneLogOff ? logOffPaneLabel : 'Exit to Mall').charAt(0)
                    ) : usePaneLogOff ? (
                      logOffPaneLabel
                    ) : (
                      <>
                        <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                          Exit
                        </Box>
                        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                          Exit to Mall
                        </Box>
                      </>
                    )}
                  </SliderControlButton>
                </Box>
              </Box>
              {!compareMode ? (
                <Box sx={{ display: 'flex', alignItems: 'stretch', minWidth: 0, overflow: 'visible' }}>
                  {paneStorageType === 'onedrive' && oneDriveOffered ? (
                    <Box
                      sx={{
                        ...menuRailButtonCellSx,
                        flex: '1 1 0',
                        width: 'auto',
                        minWidth: 0,
                        maxWidth: canEnterCompare ? '33%' : '50%',
                        overflow: 'visible'
                      }}
                    >
                      <SliderControlButton
                        type="button"
                        variant="yellow"
                        hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
                        fullWidth
                        onClick={() => setOneDriveBackupOpen(true)}
                        disabled={busy}
                        aria-label="Backup/Restore"
                        title="Backup / Restore"
                        sx={headerFullWidthButtonSx}
                      >
                        Backup/Restore
                      </SliderControlButton>
                    </Box>
                  ) : null}
                  {paneStorageType === 'usb' ? (
                    <Box
                      sx={{
                        ...menuRailButtonCellSx,
                        flex: '1 1 0',
                        width: 'auto',
                        minWidth: 0,
                        maxWidth: canEnterCompare ? '33%' : '50%',
                        overflow: 'visible'
                      }}
                    >
                      <SliderControlButton
                        type="button"
                        variant="yellow"
                        hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
                        fullWidth
                        onClick={() => setUsbBackupOpen(true)}
                        disabled={busy}
                        aria-label="Backup/Restore"
                        title="Backup / Restore USB"
                        sx={headerFullWidthButtonSx}
                      >
                        Backup/Restore
                      </SliderControlButton>
                    </Box>
                  ) : null}
                  <Box
                    sx={{
                      ...menuRailButtonCellSx,
                      flex: '1 1 0',
                      width: 'auto',
                      minWidth: 0,
                      maxWidth: canEnterCompare
                        ? '33%'
                        : paneStorageType === 'usb' || (paneStorageType === 'onedrive' && oneDriveOffered)
                          ? '50%'
                          : '100%',
                      overflow: 'visible'
                    }}
                  >
                    <SliderControlButton
                      type="button"
                      variant="yellow"
                      hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
                      fullWidth
                      data-guest-demo-allow="true"
                      onClick={() => setMobileUploadOpen(true)}
                      disabled={
                        busy ||
                        innerEncryptBusy ||
                        notebookGateLocked ||
                        !selectedNote ||
                        (selectedNote &&
                          noteHasInnerEncryption(selectedNote) &&
                          !isInnerNoteUnlocked(selectedNote.note_id))
                      }
                      aria-label="Mobile Upload"
                      title="Mobile Upload"
                      sx={headerFullWidthButtonSx}
                    >
                      {menuLabelsCompact ? 'MU' : 'Mobile Upload'}
                    </SliderControlButton>
                  </Box>
                  {canEnterCompare ? (
                    <Box
                      sx={{
                        ...menuRailButtonCellSx,
                        flex: '1 1 0',
                        width: 'auto',
                        minWidth: 0,
                        maxWidth: '33%',
                        overflow: 'visible'
                      }}
                    >
                      <SliderControlButton
                        type="button"
                        variant="yellow"
                        hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
                        fullWidth
                        onClick={() => onEnterCompare?.()}
                        disabled={busy}
                        aria-label="OneDrive to USB compare"
                        title="Open OneDrive and USB side by side to drag and drop notebooks and notes"
                        sx={headerFullWidthButtonSx}
                      >
                        OneDrive↔USB
                      </SliderControlButton>
                    </Box>
                  ) : null}
                </Box>
              ) : null}
            </Box>
            {!compareMode ? (
            <RecordVaultSearchBar
              term1={searchTerm1}
              term2={searchTerm2}
              op1={searchOp1}
              onTerm1Change={setSearchTerm1}
              onTerm2Change={setSearchTerm2}
              onOp1Change={setSearchOp1}
              onSubmit={() => void runSearch()}
              onClear={handleClearSearch}
              searchBusy={searchBusy}
              clearDisabled={
                busy ||
                (!(searchTerm1.trim() || searchTerm2.trim()) && !searchActive)
              }
              bgcolor={paneStripColor}
            />
            ) : (
              <Box sx={{ flex: 1, minWidth: 0, bgcolor: paneStripColor }} aria-hidden />
            )}
          </Box>

          {!compareMode ? (
          <Box
            aria-label="Search results"
            sx={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              minHeight: 44,
              px: 1,
              py: 0.75,
              overflowX: 'auto',
              bgcolor: paneStripColor,
              borderBottom: '2px solid var(--theme-primary-color)'
            }}
          >
            <Box
              sx={{
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                border: '3px solid #000',
                borderRadius: 0.5,
                bgcolor: '#fff',
                px: 1,
                py: 0.35,
                boxSizing: 'border-box'
              }}
            >
              <Typography
                component="span"
                sx={{
                  fontFamily: MAIN_FONT_FAMILY,
                  fontWeight: 800,
                  fontSize: { xs: '0.9rem', sm: '1rem' },
                  lineHeight: 1.2,
                  color: '#000',
                  WebkitTextFillColor: '#000'
                }}
              >
                Found:
              </Typography>
            </Box>
            {searchActive && Array.isArray(searchResults) && searchResultTabs.length > 0 ? (
              <Box
                sx={{
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.25,
                  border: '3px solid #000',
                  borderRadius: 0.75,
                  bgcolor: '#fff',
                  px: 0.5,
                  py: 0.25
                }}
              >
                <Box
                  component="button"
                  type="button"
                  aria-label="Previous document"
                  title="Previous found note"
                  onClick={() => goToSearchDoc(-1)}
                  disabled={currentSearchDocIndex <= 0}
                  sx={searchNavButtonSx}
                >
                  ◀
                </Box>
                <Box
                  component="button"
                  type="button"
                  aria-label="Previous match in note"
                  title="Previous match in this note"
                  onClick={() => goToSearchHit(-1)}
                  disabled={searchHitCount <= 0 || activeHitIndex <= 0}
                  sx={searchNavButtonSx}
                >
                  ▲
                </Box>
                <Typography
                  component="span"
                  sx={{
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    color: '#000',
                    WebkitTextFillColor: '#000',
                    minWidth: 44,
                    textAlign: 'center',
                    userSelect: 'none'
                  }}
                >
                  {searchHitCount > 0 ? `${activeHitIndex + 1}/${searchHitCount}` : '0/0'}
                </Typography>
                <Box
                  component="button"
                  type="button"
                  aria-label="Next match in note"
                  title="Next match in this note"
                  onClick={() => goToSearchHit(1)}
                  disabled={searchHitCount <= 0 || activeHitIndex >= searchHitCount - 1}
                  sx={searchNavButtonSx}
                >
                  ▼
                </Box>
                <Box
                  component="button"
                  type="button"
                  aria-label="Next document"
                  title="Next found note"
                  onClick={() => goToSearchDoc(1)}
                  disabled={currentSearchDocIndex >= searchResultTabs.length - 1}
                  sx={searchNavButtonSx}
                >
                  ▶
                </Box>
              </Box>
            ) : null}
            {searchBusy ? (
              <Typography sx={{ fontWeight: 700, color: '#000', WebkitTextFillColor: '#000', fontSize: '0.9rem', flexShrink: 0 }}>
                Searching…
              </Typography>
            ) : searchActive && Array.isArray(searchResults) && searchResultTabs.length > 0 ? (
              searchResultTabs.map((tab) => {
                const selected =
                  Number(tab.notebook_id) === Number(selectedNotebookId) &&
                  Number(tab.note_id) === Number(selectedNoteId);
                return (
                  <SliderControlButton
                    key={`search-tab-${tab.note_id}`}
                    type="button"
                    variant="yellow"
                    disableHoverScale
                    disableSelectedTranslate
                    aria-pressed={selected}
                    onClick={() => handleSearchResultSelect(tab.notebook_id, tab.note_id)}
                    sx={{
                      flexShrink: 0,
                      px: 1.25,
                      py: 0.5,
                      whiteSpace: 'nowrap',
                      bgcolor: selected
                        ? `${RECORD_VAULT_SEARCH_HIT_BLUE} !important`
                        : 'var(--theme-yellow-color) !important',
                      color: selected ? '#ffffff !important' : '#000000 !important',
                      WebkitTextFillColor: selected ? '#ffffff !important' : '#000000 !important',
                      border: '4px solid #000000 !important'
                    }}
                  >
                    {tab.label}
                  </SliderControlButton>
                );
              })
            ) : searchActive && Array.isArray(searchResults) && !searchResultTabs.length ? (
              <Typography sx={{ fontWeight: 700, color: '#000', WebkitTextFillColor: '#000', fontSize: '0.9rem', flexShrink: 0 }}>
                {searchMessage || 'No notes match your search'}
              </Typography>
            ) : null}
          </Box>
          ) : null}

          <Box
            sx={{
              display: 'flex',
              flex: 1,
              minHeight: 0,
              width: '100%',
              position: 'relative',
              flexDirection: { xs: 'column', md: 'row' }
            }}
          >
          {fileWorkspaceView === 'payment' && !compareMode ? (
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                overflow: 'auto',
                bgcolor: 'var(--theme-daynight-color)',
                p: { xs: 1, sm: 2 }
              }}
            >
              <ProfilesRecordsPage
                visibleTabs={PROFILES_RECORDS_PAYMENT_TABS}
                embedded
                initialTab={profilesRecordsInitialTab}
                initialTokensBuying={profilesRecordsInitialTokens}
              />
            </Box>
          ) : (
          <>
          {leftMenuOpen ? (
            <>
              <Box
                {...guestDemoAllowProps()}
                sx={{
                  flex: compareMode ? '1 1 0' : '0 0 auto',
                  width: compareMode
                    ? { xs: '100%', md: 'auto' }
                    : { xs: '100%', md: sidebarWidth },
                  maxWidth: compareMode
                    ? { xs: '100%', md: '66%' }
                    : { xs: '100%', md: 'none' },
                  minWidth: compareMode ? { md: 0 } : undefined,
                  display: 'flex',
                  flexDirection: 'column',
                  bgcolor: 'var(--theme-secondary-color)',
                  minHeight: compact || compareMode ? 0 : { xs: 280, md: '100%' },
                  overflow: 'hidden',
                  boxSizing: 'border-box'
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    flex: 1,
                    minHeight: 0,
                    p: compact ? 0.5 : 1,
                    gap: 0
                  }}
                >
                  <Box
                    sx={{
                      ...(compact ? menuColumnShellCompactSx : menuColumnShellSx),
                      width: notebookColWidth,
                      flexShrink: 0,
                      ...(notebookLaneFolderDragActive
                        ? {
                            outline: '3px dashed var(--theme-yellow-color)',
                            outlineOffset: 2,
                            bgcolor: 'rgba(255, 215, 0, 0.18)'
                          }
                        : null)
                    }}
                    onDragOver={handleNotebookLaneFolderDragOver}
                    onDragLeave={handleNotebookLaneFolderDragLeave}
                    onDrop={(e) => void handleNotebookLaneFolderDrop(e)}
                    title="Drop a folder of .html notes here to import as a new notebook"
                  >
                    <Box sx={laneAddButtonWrapSx}>
                      <SliderControlButton
                        type="button"
                        fullWidth
                        onClick={handleAddNotebook}
                        disabled={busy}
                        hoverScale={1.25}
                        singleLineLabel
                        sx={laneContainedButtonOneLineSx}
                      >
                        Add Notebook
                      </SliderControlButton>
                    </Box>
                    <Box
                      sx={{
                        ...recordVaultMenuListScrollSx,
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      {displayNotebooks.map((nb) => {
                        void innerUnlockVersion;
                        const isSystemNb = Boolean(nb.is_system || isBillScheduleNotebookId(nb.notebook_id));
                        const notebookNotes = nb.notes || [];
                        const notebookHasInner = !isSystemNb && notebookNotes.some((n) => noteHasInnerEncryption(n));
                        const notebookInnerLocked = !isSystemNb && notebookInnerLockedForDisplay(notebookNotes);
                        const notebookLockingUp =
                          !isSystemNb &&
                          !notebookInnerLocked &&
                          innerEncryptUiScope === 'notebook' &&
                          (inlineInnerPinMode === 'enable' || inlineInnerPinMode === 'lock') &&
                          Number(nb.notebook_id) === Number(selectedNotebookId);
                        return (
                        <Box
                          key={nb.notebook_id}
                          sx={{
                            width: '100%',
                            flexShrink: 0,
                            ...(isSystemNb ? { mt: 'auto' } : null)
                          }}
                        >
                        <RenamableDraggableMenuRow
                          id={nb.notebook_id}
                          domId={`record-vault-notebook-${nb.notebook_id}`}
                          label={
                            notebookInnerLocked
                              ? RECORD_VAULT_INNER_LOCKED_LABEL
                              : Number(editingNotebookId) === Number(nb.notebook_id) &&
                                  renameUiSurface === 'header'
                                ? editNameDraft
                                : nb.notebook_name
                          }
                          buttonTitle={
                            isSystemNb
                              ? 'Bill Schedule — drag to the other vault (Cloud↔USB) to copy or move'
                              : notebookInnerLocked
                              ? 'Locked notebook — enter PIN to unlock'
                              : notebookLockingUp
                                ? 'Locking notebook — enter PIN'
                                : notebookHasInner
                                  ? 'Notebook has PIN-locked notes'
                                  : undefined
                          }
                          selected={Number(nb.notebook_id) === Number(selectedNotebookId)}
                          locked={notebookInnerLocked}
                          editing={
                            !isSystemNb &&
                            Number(editingNotebookId) === Number(nb.notebook_id) &&
                            renameUiSurface === 'menu' &&
                            !notebookInnerLocked
                          }
                          editValue={editNameDraft}
                          onEditValueChange={setEditNameDraft}
                          onSelect={() => {
                            if (Number(nb.notebook_id) === Number(selectedNotebookId)) return;
                            notebookScopePendingRef.current = true;
                            setInnerEncryptUiScope('notebook');
                            // Immediate feedback — note body may still be loading from OneDrive.
                            setNoteContentLoading(!isSystemNb);
                            setSelectedNotebookId(nb.notebook_id);
                          }}
                          onStartEdit={() => {
                            if (isSystemNb) return;
                            setEditingNoteId(null);
                            setRenameUiSurface('menu');
                            setEditingNotebookId(nb.notebook_id);
                            setEditNameDraft(nb.notebook_name || '');
                          }}
                          onCommitEdit={() => void commitNotebookRename()}
                          onCancelEdit={clearRenameState}
                          dragMime={DRAG_NOTEBOOK}
                          draggingId={draggingNotebookId}
                          alternateDraggingId={draggingNoteId}
                          dropTargetId={dropTargetNotebookId}
                          dragTitle={
                            isSystemNb
                              ? 'Drag Bill Schedule to the other vault to copy or move Monthly + Yearly data'
                              : crossPaneDropActive
                              ? 'Drop here to copy or move from the other vault'
                              : draggingNoteId != null
                                ? 'Drop note here to move into this notebook'
                                : 'Drag to reorder; drag to Finder to export notebook folder + HTML notes'
                          }
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          onDragOver={isSystemNb ? () => {} : setDropTargetNotebookId}
                          onDrop={
                            isSystemNb
                              ? (e) => {
                                  if (tryHandleForeignCrossPaneDrop(e, { targetNotebookId: nb.notebook_id })) {
                                    return;
                                  }
                                }
                              : (e, toId, mime) => void handleNotebookRowDrop(e, toId, mime)
                          }
                          onDelete={
                            isSystemNb
                              ? undefined
                              : () => void handleDeleteNotebook(nb.notebook_id, nb.notebook_name)
                          }
                          deleteLabel={`Delete notebook ${nb.notebook_name}`}
                          onToggleLock={isSystemNb ? undefined : () => handleToggleNotebookLock(nb)}
                          lockTitle={
                            notebookInnerLocked
                              ? 'Unlock notebook (enter 6-digit PIN)'
                              : 'Lock notebook with a 6-digit PIN'
                          }
                          disabled={busy || crossPaneBusy}
                          acceptForeignDrop={
                            crossPaneDropActive &&
                            (isSystemNb
                              ? isBillScheduleCrossPaneKind(getActiveCrossPaneDrag()?.kind)
                              : true)
                          }
                        />
                        </Box>
                        );
                      })}
                    </Box>
                  </Box>

                  <ColumnResizeHandle onMouseDown={(e) => startColumnResize('notebookCol', e)} />

                  <Box
                    sx={{
                      ...(compact ? menuColumnShellCompactSx : menuColumnShellSx),
                      flex: 1,
                      minWidth: MIN_MENU_COL_WIDTH,
                      ...(noteLaneFileDragActive
                        ? {
                            outline: '3px dashed var(--theme-yellow-color)',
                            outlineOffset: 2,
                            bgcolor: 'rgba(255, 215, 0, 0.18)'
                          }
                        : null)
                    }}
                    onDragOver={handleNoteListFileDragOver}
                    onDragLeave={handleNoteListFileDragLeave}
                    onDrop={(e) => void handleNoteListFileDrop(e)}
                  >
                    <Box sx={laneAddButtonWrapSx}>
                      <SliderControlButton
                        type="button"
                        fullWidth
                        onClick={handleAddNote}
                        disabled={
                          busy ||
                          !selectedNotebookId ||
                          notebookGateLocked ||
                          isBillScheduleNotebookId(selectedNotebookId)
                        }
                        hoverScale={1.25}
                        singleLineLabel
                        sx={laneContainedButtonOneLineSx}
                      >
                        Add Note
                      </SliderControlButton>
                    </Box>
                    <Box
                      sx={{
                        ...recordVaultMenuListScrollSx,
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      {/* Encrypted notebook: do not reveal any note names until unlocked. */}
                      {(notebookGateLocked ? [] : notes).map((note) => {
                        const isSystemNote = Boolean(note.is_system || isBillScheduleSystemId(note.note_id));
                        const noteInnerLocked =
                          !isSystemNote &&
                          noteRequiresInnerPinToView(note) &&
                          !isInnerNoteUnlockedForDisplay(note.note_id, note);
                        const noteLockingUp =
                          !isSystemNote &&
                          !noteInnerLocked &&
                          (inlineInnerPinMode === 'enable' || inlineInnerPinMode === 'lock') &&
                          Number(note.note_id) === Number(selectedNoteId);
                        // innerUnlockVersion lives in unlock refs — read so rows re-paint after PIN unlock.
                        void innerUnlockVersion;
                        const noteMenuLabel = isSystemNote
                          ? note.note_name
                          : noteInnerLocked
                          ? RECORD_VAULT_INNER_LOCKED_LABEL
                          : recordVaultNoteMenuLabel(note, notes, {
                              selectedNoteId,
                              openNoteTitlePlain,
                              notebooks
                            });
                        const noteRealLabel = isSystemNote
                          ? note.note_name
                          : recordVaultNoteMenuLabel(note, notes, {
                              selectedNoteId,
                              openNoteTitlePlain,
                              notebooks
                            });
                        const menuEditingThisNote =
                          !isSystemNote &&
                          Number(editingNoteId) === Number(note.note_id) &&
                          renameUiSurface === 'menu';
                        const headerEditingThisNote =
                          !isSystemNote &&
                          Number(editingNoteId) === Number(note.note_id) &&
                          renameUiSurface === 'header';
                        // Pin the first Bill Schedule note (Monthly) — Yearly rides below it.
                        const flushSystemToBottom =
                          isSystemNote && isBillMonthlyNoteId(note.note_id);
                        return (
                        <Box
                          key={note.note_id}
                          sx={{
                            width: '100%',
                            flexShrink: 0,
                            ...(flushSystemToBottom ? { mt: 'auto' } : null)
                          }}
                        >
                        <RenamableDraggableMenuRow
                          id={note.note_id}
                          domId={`record-vault-note-${note.note_id}`}
                          label={
                            noteInnerLocked
                              ? RECORD_VAULT_INNER_LOCKED_LABEL
                              : headerEditingThisNote
                                ? // Freeze sidebar label while the content-header field is being typed.
                                  recordVaultNoteSidebarLabel(note, notes, notebooks)
                                : menuEditingThisNote
                                  ? editNameDraft || noteMenuLabel
                                  : noteMenuLabel
                          }
                          buttonTitle={
                            isSystemNote
                              ? `${note.note_name} — drag to the other vault (Cloud↔USB) to copy or move`
                              : noteInnerLocked
                              ? 'Locked — enter PIN to view'
                              : noteLockingUp
                                ? 'Locking up — enter PIN'
                                : noteRealLabel
                          }
                          selected={Number(note.note_id) === Number(selectedNoteId)}
                          selectedBlue={searchActive}
                          multiSelected={
                            !isSystemNote &&
                            multiSelectedNoteIds.some(
                              (id) => Number(id) === Number(note.note_id)
                            )
                          }
                          locked={noteInnerLocked}
                          editing={menuEditingThisNote && !noteInnerLocked}
                          editValue={editNameDraft}
                          onEditValueChange={handleNoteListTitleEditChange}
                          onSelect={(e) => {
                            if (!isSystemNote && e?.shiftKey) {
                              handleNoteShiftSelect(note.note_id);
                              return;
                            }
                            selectNoteId(note.note_id);
                          }}
                          onStartEdit={() => {
                            if (isSystemNote || noteInnerLocked) return;
                            replaceMultiSelectedNoteIds([]);
                            noteMultiSelectAnchorIdRef.current = note.note_id;
                            setEditingNotebookId(null);
                            setRenameUiSurface('menu');
                            setEditingNoteId(note.note_id);
                            setEditNameDraft(
                              Number(note.note_id) === Number(selectedNoteId)
                                ? openNoteTitlePlain ||
                                    recordVaultNoteSidebarLabel(note, notes, notebooks)
                                : recordVaultNoteSidebarLabel(note, notes, notebooks)
                            );
                          }}
                          onCommitEdit={() => void commitNoteRename()}
                          onCancelEdit={clearRenameState}
                          dragMime={DRAG_NOTE}
                          dragNotebookId={selectedNotebookId}
                          draggingId={draggingNoteId}
                          dropTargetId={dropTargetNoteId}
                          acceptForeignDrop={
                            crossPaneDropActive &&
                            (isSystemNote
                              ? isBillScheduleCrossPaneKind(getActiveCrossPaneDrag()?.kind)
                              : true)
                          }
                          dragTitle={
                            isSystemNote
                              ? `Drag ${note.note_name} to the other vault to copy or move`
                              : crossPaneDropActive
                              ? 'Drop here to copy or move from the other vault'
                              : multiSelectedNoteIds.length > 1
                                ? `Shift-selected: ${multiSelectedNoteIds.length} notes — drag to Finder, then Choose folder for separate HTML files`
                                : 'Shift+click to multi-select; drag to Finder to export HTML; drop on a notebook to move'
                          }
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          onPrefetchDrag={isSystemNote ? undefined : prefetchNoteHtmlExport}
                          onDragOver={isSystemNote ? () => {} : setDropTargetNoteId}
                          onDrop={
                            isSystemNote
                              ? (e) => {
                                  if (
                                    tryHandleForeignCrossPaneDrop(e, {
                                      targetNotebookId: BILL_SCHEDULE_NOTEBOOK_ID
                                    })
                                  ) {
                                    return;
                                  }
                                }
                              : (e, toId, mime) => {
                                  void handleDropReorder(
                                    e,
                                    toId,
                                    mime,
                                    notes,
                                    'note_id',
                                    (ids) => vaultApi.reorderRecordVaultNotes(selectedNotebookId, ids)
                                  );
                                }
                          }
                          onFileDrop={isSystemNote ? undefined : (e) => void handleNoteListFileDrop(e)}
                          onDelete={
                            isSystemNote
                              ? undefined
                              : () => void handleDeleteNote(note.note_id, noteRealLabel)
                          }
                          deleteLabel={`Delete note ${noteRealLabel}`}
                          onToggleLock={isSystemNote ? undefined : () => handleToggleNoteLock(note)}
                          lockTitle={
                            noteInnerLocked
                              ? 'Unlock note (enter 6-digit PIN)'
                              : 'Lock note with a 6-digit PIN'
                          }
                          disabled={busy || crossPaneBusy || !selectedNotebookId}
                        />
                        </Box>
                        );
                      })}
                    </Box>
                  </Box>
                </Box>
              </Box>

              {!compareMode ? (
              <ColumnResizeHandle
                sx={{ display: { xs: 'none', md: 'block' }, bgcolor: 'var(--theme-primary-color)', opacity: 0.35 }}
                onMouseDown={(e) => startColumnResize('sidebar', e)}
              />
              ) : null}
            </>
          ) : null}

          {!compareMode ? (
          <Box
            data-record-vault-note-content
            ref={noteContentPaneRef}
            draggable={Boolean(selectedNoteId)}
            onDragStart={handleContentPaneHtmlExportDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleContentDragOver}
            onDrop={handleContentFileDrop}
            sx={{
              flex: 1,
              minWidth: 0,
              minHeight: compact ? 0 : { xs: 360, md: '100%' },
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {(() => {
              if (isBillMonthlyView) {
                return <BillScheduleMonthlyPanel storageType={paneStorageType} />;
              }
              if (isBillYearlyView) {
                return <BillScheduleYearlyPanel storageType={paneStorageType} />;
              }
              const notebookNotesForLock = selectedNotebook?.notes || [];
              const notebookGateLocked = notebookInnerLockedForDisplay(notebookNotesForLock);
              const openNoteLocked = Boolean(
                selectedNote &&
                  noteRequiresInnerPinToView(selectedNote) &&
                  !isInnerNoteUnlocked(selectedNote.note_id)
              );
              const lockedNow = notebookGateLocked || openNoteLocked;
              // Whole notebook locked (all notes) → "Notebook"; a single locked note → "Note".
              const lockedEntityLabel = notebookGateLocked ? 'Notebook' : 'Note';
              // Dropped files are now embedded inline in the note body, so the
              // editor always fills the content pane (no separate files panel).
              const editorBoxSx = {
                flex: 1,
                minHeight: 0,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column'
              };
              return (
                <>
                  <Box ref={editorBoxRef} sx={editorBoxSx}>
                    <RecordVaultNoteEditor
                      ref={noteEditorApiRef}
                      onReady={handleEditorReady}
                      onChange={scheduleSave}
                      contentZoom={noteContentZoom}
                      header={
                        selectedNote && !lockedNow ? (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              mx: 1,
                              mb: 0.5,
                              px: 1.5,
                              py: 1,
                              border: '2px solid #000',
                              borderRadius: 1,
                              bgcolor: '#fff',
                              flex: '0 0 auto'
                            }}
                          >
                            <Box
                              component="label"
                              htmlFor="rv-note-title-input"
                              sx={{
                                fontWeight: 800,
                                color: '#000',
                                fontSize: '1.15rem',
                                flex: '0 0 auto'
                              }}
                            >
                              Title:
                            </Box>
                            {searchActive &&
                            !titleEditing &&
                            titleMatchesSearchTerms(openNoteTitlePlain, activeSearchTerms) ? (
                              <Box
                                role="textbox"
                                tabIndex={0}
                                title="Click to edit title"
                                onClick={() => {
                                  setTitleEditing(true);
                                  setTimeout(() => {
                                    const el = document.getElementById('rv-note-title-input');
                                    if (el) {
                                      el.focus();
                                      el.select?.();
                                    }
                                  }, 0);
                                }}
                                sx={{
                                  flex: 1,
                                  minWidth: 0,
                                  fontSize: '1.15rem',
                                  fontWeight: 600,
                                  color: '#000',
                                  cursor: 'text',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {renderTitleWithSearchHighlight(openNoteTitlePlain, activeSearchTerms)}
                              </Box>
                            ) : (
                              <TextField
                                id="rv-note-title-input"
                                variant="standard"
                                fullWidth
                                value={openNoteTitlePlain}
                                onChange={(e) => handleNoteTitleBoxChange(e.target.value)}
                                onFocus={() => {
                                  noteTitleBoxSnapshotRef.current = String(
                                    draftRef.current.openNoteTitlePlain ?? ''
                                  );
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.currentTarget.blur();
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    setOpenNoteTitlePlain(noteTitleBoxSnapshotRef.current);
                                    draftRef.current = {
                                      ...draftRef.current,
                                      openNoteTitlePlain: noteTitleBoxSnapshotRef.current
                                    };
                                    setTitleEditing(false);
                                    e.currentTarget.blur();
                                  }
                                }}
                                onBlur={commitNoteTitleBox}
                                placeholder="Untitled note"
                                InputProps={{ disableUnderline: true }}
                                inputProps={{ 'aria-label': 'Note title', maxLength: 200 }}
                                sx={{
                                  flex: 1,
                                  minWidth: 0,
                                  '& .MuiInputBase-input': {
                                    fontSize: '1.15rem',
                                    fontWeight: 600,
                                    color: '#000',
                                    p: 0
                                  }
                                }}
                              />
                            )}
                            <RecordVaultNoteContentZoomBar
                              value={noteContentZoom}
                              onChange={setNoteContentZoom}
                            />
                          </Box>
                        ) : null
                      }
                    />
                    {lockedNow ? (
                      <Box
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          zIndex: 5,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 1.5,
                          bgcolor: '#fff',
                          textAlign: 'center',
                          px: 2
                        }}
                      >
                        <Box
                          component="img"
                          src={innerEncryptOnImg}
                          alt=""
                          sx={{ width: 88, height: 88, display: 'block' }}
                        />
                        <Typography
                          sx={{
                            fontWeight: 900,
                            fontSize: { xs: '2rem', sm: '2.5rem' },
                            lineHeight: 1.15,
                            color: '#000',
                            WebkitTextFillColor: '#000'
                          }}
                        >
                          This {lockedEntityLabel} is{' '}
                          <Box
                            component="span"
                            sx={{ color: '#e60000', WebkitTextFillColor: '#e60000' }}
                          >
                            LOCKED
                          </Box>
                        </Typography>
                        <Box
                          component="button"
                          type="button"
                          onClick={() => {
                            if (notebookGateLocked && selectedNotebook)
                              handleToggleNotebookLock(selectedNotebook);
                            else if (openNoteLocked) handleToggleNoteLock(selectedNote);
                            else if (selectedNotebook) handleToggleNotebookLock(selectedNotebook);
                          }}
                          disabled={busy || innerEncryptBusy}
                          sx={{
                            bgcolor: '#e60000',
                            color: 'var(--theme-yellow-color)',
                            fontWeight: 800,
                            fontSize: '1.1rem',
                            border: '2px solid #000',
                            borderRadius: 1,
                            px: 3,
                            py: 1,
                            cursor: 'pointer',
                            '&:hover': { filter: 'brightness(1.05)' }
                          }}
                        >
                          Unlock now
                        </Box>
                      </Box>
                    ) : null}
                  </Box>
                </>
              );
            })()}
          </Box>
          ) : null}

          <RecordVaultNoteInnerEncryptDialog
            open={innerEncryptDialog.open}
            mode={innerEncryptDialog.mode}
            scope={innerEncryptDialog.scope}
            noteName={selectedNote?.note_name || ''}
            busy={innerEncryptBusy}
            progressPercent={innerEncryptProgressPercent}
            progressLabel={innerEncryptProgressLabel}
            error={innerEncryptError}
            onSubmit={handleInnerEncryptSubmit}
            onClose={closeInnerEncryptDialog}
          />

          {rightMenuOpen ? (
            <>
              {!compareMode ? (
              <ColumnResizeHandle
                sx={{ display: { xs: 'none', md: 'block' }, bgcolor: 'var(--theme-primary-color)', opacity: 0.35 }}
                onMouseDown={(e) => startColumnResize('rightSidebar', e)}
              />
              ) : null}
              <Box
                {...guestDemoAllowProps()}
                sx={{
                  flex: compareMode ? '1 1 0' : '0 0 auto',
                  width: compareMode
                    ? { xs: '100%', md: 'auto' }
                    : { xs: '100%', md: rightSidebarWidth },
                  maxWidth: compareMode
                    ? { xs: '100%', md: '50%' }
                    : { xs: '100%', md: 'none' },
                  minWidth: compareMode ? { md: 0 } : undefined,
                  display: 'flex',
                  flexDirection: 'column',
                  bgcolor: 'var(--theme-secondary-color)',
                  minHeight: compact || compareMode ? 0 : { xs: 220, md: '100%' },
                  borderLeft: { md: '2px solid var(--theme-primary-color)' },
                  overflow: 'hidden',
                  boxSizing: 'border-box'
                }}
              >
                <Box
                  ref={rightSidebarSplitRef}
                  sx={{ flex: 1, minHeight: 0, p: compact ? 0.5 : 1, display: 'flex', flexDirection: 'column', gap: 0 }}
                >
                  <Box
                    sx={{
                      ...(compact ? menuColumnShellCompactSx : menuColumnShellSx),
                      flex: `${shortcutPanePercent} 1 0`,
                      minHeight: compact ? 64 : 100
                    }}
                    onDragOver={(e) => {
                      const fromLeft = isLeftSidebarDragEvent(e);
                      if (fromLeft || draggingShortcutId != null) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = fromLeft ? 'copy' : 'move';
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const notebookRaw = e.dataTransfer.getData(DRAG_NOTEBOOK);
                      const noteRaw = e.dataTransfer.getData(DRAG_NOTE);
                      const shortcutRaw = e.dataTransfer.getData(DRAG_SHORTCUT);
                      if (!shortcutRaw && (notebookRaw || noteRaw || isLeftSidebarDragEvent(e))) {
                        void handleShortcutDropFromLeft(e);
                      }
                    }}
                  >
                    <SliderControlButton
                      type="button"
                      fullWidth
                      tabIndex={-1}
                      aria-hidden
                      disabled
                      disableHoverScale
                      sx={{
                        mb: 1,
                        pointerEvents: 'none',
                        cursor: 'default',
                        ...laneContainedButtonSx,
                        borderRadius: '0 !important',
                        bgcolor: '#ffffff !important',
                        color: '#000000 !important',
                        WebkitTextFillColor: '#000000 !important',
                        border: '2px solid #000000 !important',
                        '&.Mui-disabled': {
                          bgcolor: '#ffffff !important',
                          color: '#000000 !important',
                          WebkitTextFillColor: '#000000 !important',
                          border: '2px solid #000000 !important'
                        }
                      }}
                    >
                      Shortcut
                    </SliderControlButton>
                    <Typography sx={{ fontSize: '0.85rem', mb: 1, opacity: 0.85 }}>
                      Drag notebooks or notes here
                    </Typography>
                    <Box
                      sx={recordVaultMenuListScrollSx}
                      onDragOver={(e) => {
                        const fromLeft = isLeftSidebarDragEvent(e);
                        if (fromLeft || draggingShortcutId != null) {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = fromLeft ? 'copy' : 'move';
                        }
                      }}
                    >
                      {shortcuts.map((shortcut) => {
                        void innerUnlockVersion;
                        let shortcutInnerLocked = false;
                        const shortcutNotebook = notebooks.find(
                          (nb) => Number(nb.notebook_id) === Number(shortcut.notebook_id)
                        );
                        if (shortcut?.target_type === 'notebook') {
                          shortcutInnerLocked = notebookInnerLockedForDisplay(
                            shortcutNotebook?.notes || []
                          );
                        } else {
                          const linkedNote = (shortcutNotebook?.notes || []).find(
                            (n) => Number(n.note_id) === Number(shortcut.note_id)
                          );
                          shortcutInnerLocked = Boolean(
                            linkedNote &&
                              noteRequiresInnerPinToView(linkedNote) &&
                              !isInnerNoteUnlockedForDisplay(linkedNote.note_id, linkedNote)
                          );
                        }
                        const shortcutRealLabel = recordVaultShortcutMenuLabel(shortcut, {
                          selectedNoteId,
                          openNoteTitlePlain,
                          notebooks
                        });
                        const shortcutLabel = shortcutInnerLocked
                          ? RECORD_VAULT_INNER_LOCKED_LABEL
                          : shortcutRealLabel;
                        return (
                        <ShortcutMenuRow
                          key={shortcut.shortcut_id}
                          shortcut={shortcut}
                          label={shortcutLabel}
                          selected={isShortcutSelected(shortcut)}
                          locked={shortcutInnerLocked}
                          draggingId={draggingShortcutId}
                          dropTargetId={dropTargetShortcutId}
                          onSelect={() => handleShortcutClick(shortcut)}
                          onDragStart={(e, shortcutId) => handleDragStart(e, shortcutId, DRAG_SHORTCUT)}
                          onDragEnd={handleDragEnd}
                          onDragOver={setDropTargetShortcutId}
                          onDrop={(e, toId) => void handleShortcutReorderDrop(e, toId)}
                          onDropFromLeft={(e) => void handleShortcutDropFromLeft(e)}
                          onDelete={() => void handleRemoveShortcut(shortcut.shortcut_id, shortcutRealLabel)}
                          deleteLabel={`Remove shortcut ${shortcutRealLabel}`}
                          onToggleLock={() => handleToggleShortcutLock(shortcut)}
                          lockTitle={
                            shortcutInnerLocked
                              ? 'Unlock (enter 6-digit PIN)'
                              : 'Lock with a 6-digit PIN'
                          }
                          disabled={busy}
                        />
                        );
                      })}
                    </Box>
                  </Box>
                  <RowResizeHandle
                    label="Resize Shortcut and Folders & Files"
                    onMouseDown={startShortcutPaneResize}
                  />
                  <Box
                    sx={{
                      flex: `${100 - shortcutPanePercent} 1 0`,
                      minHeight: 80,
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      gap: 0.5
                    }}
                  >
                    <SliderControlButton
                      type="button"
                      variant={
                        paneStorageType === 'usb'
                          ? usbBridgeHealthy
                            ? 'green'
                            : 'red'
                          : 'yellow'
                      }
                      hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
                      fullWidth
                      onClick={() => {
                        setViewVaultStorageType(paneStorageType === 'onedrive' ? 'onedrive' : 'usb');
                        setViewVaultOpen(true);
                      }}
                      disabled={busy || !unlocked}
                      aria-label={paneStorageType === 'onedrive' ? 'View OneDrive' : 'View USB'}
                      title={
                        paneStorageType === 'usb'
                          ? usbBridgeHealthy
                            ? 'Record Vault USB Bridge connected — USB reachable'
                            : 'Record Vault USB Bridge disconnected or USB not reachable'
                          : undefined
                      }
                      sx={{
                        flexShrink: 0,
                        ...laneContainedButtonSx
                      }}
                    >
                      {paneStorageType === 'onedrive' ? 'View OneDrive' : 'View USB'}
                    </SliderControlButton>
                    <RecordVaultStorageFilesPanel storageType={paneStorageType || 'usb'} active={unlocked} />
                  </Box>
                </Box>
              </Box>
            </>
          ) : null}
          </>
          )}
          </Box>
        </Box>
      )}
    </Box>
    </RecordVaultSliderControlButtonProvider>
  );
}

