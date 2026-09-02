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
import VaultExitToMallToolbarButton from 'components/VaultExitToMallToolbarButton';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { themedAlert, themedConfirm } from 'utils/themedDialog';
import { downsizeImageFileToMaxMb, bytesToMbLabel } from 'utils/photoAlbumsDownsizeMedia';
import {
  isPhotoAlbumsStorageNotUnlockedError,
  isPhotoAlbumsVaultOpenFatalError,
  isPhotoAlbumsBridgeRouteMissingError,
  PHOTO_ALBUMS_STORAGE_NOT_UNLOCKED_MESSAGE,
  fetchPhotoAlbumsStorageConfig,
  fetchPhotoAlbumsOneDriveConfig,
  fetchPhotoAlbumsUsbStatus,
  fetchPhotoAlbumsUsbLocations,
  fetchPhotoAlbumsOneDriveStatus,
  rememberPhotoAlbumsOneDriveEmail,
  probePhotoAlbumsBridge,
  setPhotoAlbumsBridgeSinglesId,
  setPhotoAlbumsBridgeStorageType,
  readPhotoAlbumsApiError,
  readPhotoAlbumsOpenFailureMessage,
  readFileAsDataUrl,
  createPhotoAlbumsPaneApi,
  fetchPhotoAlbumsNoteAttachmentBlob
} from 'api/photoAlbumsFe';
import { registerPhotoAlbumsLeavePrepare } from 'utils/photoAlbumsLeavePrepare';
import { useAuth } from 'contexts/AuthContext';
import { guestDemoBlockProps } from 'utils/guestDemoLogin';
import {
  isAllowedPhotoAlbumsFile,
  isMacOsMetadataFileName,
  isPhotoAlbumsStagingPhotoFile,
  isPhotoAlbumsStagingAlbumMediaFile,
  isPhotoAlbumsStagingPhotoExtension,
  isPhotoAlbumsStagingVideoFile,
  photoAlbumsStagingPhotoPrefersServerThumb,
  photoAlbumsUploadFileName,
  probePhotoAlbumsImageFile,
  resolvePhotoAlbumsFileExtension
} from 'utils/photoAlbumsFileFormats';
import PhotoAlbumsSearchBar from './PhotoAlbumsSearchBar';
import PhotoAlbumsInviteBar from './PhotoAlbumsInviteBar';
import PhotoAlbumsInviteReviewDialog from './PhotoAlbumsInviteReviewDialog';
import { fetchPhotoAlbumsSharedAlbums, fetchPhotoAlbumsSharedAlbumContent, removePhotoAlbumsSharedAlbum, readPhotoAlbumsInviteError } from 'api/photoAlbumsInviteFe';
import {
  PHOTO_ALBUMS_MENU_BUTTON_FONT_REM_VAR,
  photoAlbumsMenuButtonFontRemFromTenths
} from 'config/photoAlbumsMenuButtonFontEnv';
import { getVaultDefaultButtonFontSizeRem } from 'config/photoAlbumsDefaultButtonFontSizeEnv';
import { fetchUserCustomization, saveUserCustomization } from 'api/userCustomizationFe';
import { PhotoAlbumsSliderControlButtonProvider } from './PhotoAlbumsSliderControlButtonContext';
import { usePhotoAlbumsPaneStorageType } from './PhotoAlbumsPaneContext';
import BusyHourglassOverlay from 'ui-component/BusyHourglassOverlay';
import { BUSY_HOURGLASS_MY_PHOTO_ALBUMS_SIZE } from 'config/busyHourglassEnv';
import PhotoAlbumsViewVaultDialog from './PhotoAlbumsViewVaultDialog';
import PhotoAlbumsOneDriveBackupDialog from './PhotoAlbumsOneDriveBackupDialog';
import PhotoAlbumsUsbBackupDialog from './PhotoAlbumsUsbBackupDialog';
import PhotoAlbumsStorageFilesPanel from './PhotoAlbumsStorageFilesPanel';
import PhotoAlbumsFilesExplorerPanel from './PhotoAlbumsFilesExplorerPanel';
import PhotoAlbumsNoteEditor from './PhotoAlbumsNoteEditor';
import {
  clearAttachmentVariantPreviewsForNote,
  setAttachmentVariantPreview
} from './photoAlbumsAttachmentVariantCache';
import { formatPhotoAlbumsSidebarAlbumLines } from './photoAlbumsAlbumTitleStyle';
import {
  countPhotoAlbumsSidebarMediaInAttachments,
  photoAlbumsSidebarAlbumMediaCount,
  photoAlbumsSidebarAlbumSetCount
} from './photoAlbumsSidebarCounts';
import {
  FILES_EXPLORER_TAB_EXPLORER,
  FILES_EXPLORER_TAB_FOLDERS,
  FILES_EXPLORER_TAB_MOBILE_UPLOAD,
  readFilesExplorerTab,
  writeFilesExplorerTab
} from 'utils/photoAlbumsFilesExplorerPreference';
import { PageThumb } from './PhotoAlbumsPageFilmstrip';
import PhotoAlbumsFileMenu, {
  prepareImportedHtml,
  stripYamlFrontMatter,
  pdfArrayBufferToHtml,
  buildHtmlDocument,
  sanitizePhotoAlbumsExportFileName
} from './PhotoAlbumsFileMenu';
import ProfilesRecordsPage from 'views/utilities/ProfilesRecordsPage';
import { PROFILES_RECORDS_PAYMENT_TABS } from 'constants/profilesRecordsRoute';
import PhotoAlbumsMobileUploadDialog from './PhotoAlbumsMobileUploadDialog';
import PhotoAlbumsMobileUploadFolderPanel from './PhotoAlbumsMobileUploadFolderPanel';
import PhotoAlbumsCrossPaneTransferDialog from './PhotoAlbumsCrossPaneTransferDialog';
import PhotoAlbumsOrderAlbumDialog from './PhotoAlbumsOrderAlbumDialog';
import PhotoAlbumsCreateItemDialog from './PhotoAlbumsCreateItemDialog';
import {
  loadOrderAlbumItems,
  saveOrderAlbumItems,
  loadOrderAlbumName,
  saveOrderAlbumName,
  newOrderAlbumItemId,
  DEFAULT_ORDER_ALBUM_NAME
} from './photoAlbumsOrderAlbum';
import api from 'api/axios';
import {
  clearActiveCrossPaneDrag,
  DRAG_CROSS_PANE,
  isForeignCrossPaneDrag,
  markCrossPaneDropConsumed,
  notifyPhotoAlbumsTreeReload,
  PHOTO_ALBUMS_TREE_RELOAD_EVENT,
  readCrossPaneDragFromEvent,
  serializeCrossPaneDrag,
  setActiveCrossPaneDrag,
  takeCrossPaneDropConsumed
} from './photoAlbumsCrossPaneDrag';
import { transferPhotoAlbumsItem } from './photoAlbumsCrossPaneTransfer';
import {
  clearActiveAlbumPageDrag,
  DRAG_ALBUM_PAGE,
  getActiveAlbumPageDrag,
  isAlbumPageDrag,
  readAlbumPageDrag,
  serializeAlbumPageDrag,
  setActiveAlbumPageDrag
} from './photoAlbumsAlbumPageDrag';
import { commitAlbumPageMoveToNote } from './photoAlbumsMoveAlbumPage';
import { setPhotoAlbumsColumnResizing } from './photoAlbumsColumnResizeGate';
import { mergeStagingItemPreview, primeStagingAttachmentPreview } from './photoAlbumsStagingPreviewCache';
import { createPhotoStagingPreviewObjectUrl } from './photoAlbumsFilesExplorerDrag';
import {
  photoAlbumsSourceTakenAtMs,
  sortPhotoAlbumsFilesBySourceTakenAt
} from './photoAlbumsSourceTakenAt';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import VaultWorkspaceErrorPopup from 'ui-component/VaultWorkspaceErrorPopup';
import PhotoAlbumsUsageBar from './PhotoAlbumsUsageBar';
import PhotoAlbumsTrafficWaitHost from './PhotoAlbumsTrafficWaitHost';
import { MY_PHOTO_ALBUMS_BACKGROUND_IMAGE } from 'config/photoAlbumsLayout';
import {
  PHOTO_ALBUMS_DEFAULT_CONTENT_BG_INDEX,
  PHOTO_ALBUMS_DEFAULT_FONT_SIZE_PT,
  PHOTO_ALBUMS_DEFAULT_FONT_STYLE_INDEX,
  PHOTO_ALBUMS_DEFAULT_MENU_BUTTON_FONT_SIZE_TENTHS,
  PHOTO_ALBUMS_DEFAULT_TEXT_HIGHLIGHT_INDEX,
  PHOTO_ALBUMS_FONT_STYLE_COUNT,
  normalizePhotoAlbumsFontSizePt,
  PHOTO_ALBUMS_THEME_DAYNIGHT_BG,
  PHOTO_ALBUMS_THEME_INVERSE_FG,
  PHOTO_ALBUMS_THEME_INVERSE_BORDER,
  PHOTO_ALBUMS_THEME_INVERSE_BORDER_1,
  PHOTO_ALBUMS_THEME_INVERSE_BORDER_2,
  photoAlbumsThemeDaynightSurfaceSx
} from './photoAlbumsNoteFontTokens';
import {
  getIndexedNoteText,
  indexNoteSearchText,
  removeNoteSearchIndex,
  searchIndexedNotes
} from './photoAlbumsSearchIndex';
import innerEncryptOnImg from 'assets/images/innerEncryptON.png';
import redLockImg from 'assets/images/redlock.png';
import greenUnlockImg from 'assets/images/unlockIcon.png';
import PhotoAlbumsNoteInnerEncryptDialog from './PhotoAlbumsNoteInnerEncryptDialog';
import { LOCK_GIF_CYCLE_MS } from './PhotoAlbumsEncryptDecryptVideoOverlay';
import {
  decryptPhotoAlbumsNoteInnerBody,
  encryptPhotoAlbumsNoteInnerBody,
  isPhotoAlbumsInnerEncryptedBody,
  isValidInnerEncryptPin
} from 'utils/photoAlbumsNoteInnerCrypto';
import {
  INNER_UNLOCK_LOCKOUT_MS,
  clearPersistedInnerUnlockLockout,
  formatInnerUnlockLockoutLabel,
  persistInnerUnlockLockoutMs,
  remainingInnerUnlockLockoutSeconds,
  resolveInnerUnlockLockedUntilMs,
  wipeAllPersistedInnerUnlockPins
} from 'utils/photoAlbumsNoteInnerUnlockStorage';
import { tutaPhotoAlbumsStorageStripColor } from './tutaPhotoAlbumsBranding';
import {
  cleanPhotoAlbumsNoteBodyHtml,
  photoAlbumsRichTextHasContent,
  stripPhotoAlbumsHtml,
} from 'utils/photoAlbumsRichText';
import ThumbnailDeleteXButton from 'ui-component/ThumbnailDeleteXButton';
import threeDashesImg from 'assets/images/threeDashes.png';
import {
  photoAlbumsNoteSidebarLabel,
  photoAlbumsNotebookSidebarLabel,
  photoAlbumsNoteMenuLabel,
  photoAlbumsShortcutMenuLabel,
  photoAlbumsSearchResultTabLabel,
  resolvePhotoAlbumsNoteTitle,
  formatDefaultPhotoAlbumsNoteTitle,
  formatDefaultPhotoAlbumsNotebookTitle,
  normalizePhotoAlbumsNotebookCreateName,
  buildPhotoAlbumsAlbumNoteName,
  notebookNumberFromList,
  isDefaultStylePhotoAlbumsNotebookTitle,
  isDefaultStylePhotoAlbumsNoteTitle,
  isLegacyShortPhotoAlbumsNoteName
} from 'utils/photoAlbumsNoteTitle';

const LAYOUT_LS_KEY = 'photoAlbumsMenuLayout_v2';
const NOTE_FONT_STYLE_LS_KEY = 'photoAlbumsNoteFontStyle_v1';
const NOTE_FONT_SIZE_PT_LS_KEY = 'photoAlbumsNoteFontSizePt_v1';
const DEFAULT_SIDEBAR_WIDTH = 380;
/** Used until GET /api/photoAlbums/mediaQuota answers; mirrors the TUTAPHOTO_* env defaults. */
const TUTAPHOTO_QUOTA_FALLBACK = {
  imageMaxMb: 20,
  videoMaxMb: 100,
  maxImagesPerAccount: 1000,
  maxVideosPerAccount: 100,
  imageCount: 0,
  videoCount: 0
};

const TUTAPHOTO_DOWNSIZE_FAILED_MESSAGE =
  'Auto downsize failed.  Please resize with online tools and upload again.';

function tutaPhotoQuotaExceededMessage(quota) {
  return `Total image allow per user Free Tier Account is ${quota.maxImagesPerAccount}, and total video per free tier account is ${quota.maxVideosPerAccount}. Please click top left Upgrade to VIP tier to upload beyond free tier limit.`;
}

function tutaPhotoDownsizeMessage(originalBytes, quota) {
  return `We downsize your upload image size ${bytesToMbLabel(originalBytes)} mb to maximum size allowed ${quota.imageMaxMb} mb for image, and ${quota.videoMaxMb} mb for video`;
}

const DEFAULT_NOTEBOOK_COL_WIDTH = 168;
const DEFAULT_RIGHT_SIDEBAR_WIDTH = 200;
const MIN_SIDEBAR_WIDTH = 260;
const MAX_SIDEBAR_WIDTH = 720;
const MIN_RIGHT_SIDEBAR_WIDTH = 140;
const MAX_RIGHT_SIDEBAR_WIDTH = 420;
const MIN_MENU_COL_WIDTH = 96;
const DEFAULT_SHORTCUT_PANE_PERCENT = 42;
const MIN_SHORTCUT_PANE_PERCENT = 15;
const MAX_SHORTCUT_PANE_PERCENT = 75;
const DEFAULT_SHARED_ALBUM_PANE_PERCENT = 28;
const MIN_SHARED_ALBUM_PANE_PERCENT = 12;
const MAX_SHARED_ALBUM_PANE_PERCENT = 55;

function noteTitlePlainText(value) {
  return stripPhotoAlbumsHtml(value).trim();
}

function resolveOpenNoteTitlePlain(note, notebooks, notesInNotebook) {
  return (
    noteTitlePlainText(resolvePhotoAlbumsNoteTitle(note, notebooks, notesInNotebook)) ||
    photoAlbumsNoteSidebarLabel(note, notesInNotebook, notebooks)
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

const myPhotoAlbumsBackgroundPanelSx = {
  backgroundImage: `url(${MY_PHOTO_ALBUMS_BACKGROUND_IMAGE})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  bgcolor: 'var(--theme-daynight-color)'
};

/** Slight dim so the colorful hourglass reads clearly over myPhotoAlbumsBackground.png. */
const myPhotoAlbumsLoadingBackdropSx = {
  ...myPhotoAlbumsBackgroundPanelSx,
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

/** Scales with yellow menu-font slider so labels are not clipped (default ~2rem). */
const menuBtnFontRemExpr = () =>
  `var(${PHOTO_ALBUMS_MENU_BUTTON_FONT_REM_VAR}, ${getVaultDefaultButtonFontSizeRem()})`;

/** One text line + padding/border. */
const SINGLE_LINE_MENU_BUTTON_MIN_HEIGHT = `calc((${menuBtnFontRemExpr()} * 1.45 + 0.7) * 1rem)`;

/** Two text lines (sidebar album / album-set / shortcut rows) + padding/border. */
const TWO_LINE_LANE_BUTTON_HEIGHT = `calc((${menuBtnFontRemExpr()} * 3.05 + 1.35) * 1rem)`;

const headerToggleButtonSx = {
  width: 'max-content',
  minWidth: 'max-content',
  maxWidth: '100%',
  flexShrink: 0,
  whiteSpace: 'nowrap',
  px: { xs: 0.3, sm: 0.45 },
  py: { xs: 0.45, sm: 0.55 },
  minHeight: SINGLE_LINE_MENU_BUTTON_MIN_HEIGHT
};

/** Square-ish compact toolbar chips (LO / MU / BR / <=>) after Close Menu. */
const headerCompactChipSx = {
  width: 'auto',
  minWidth: { xs: 36, sm: 40 },
  maxWidth: 'none',
  flexShrink: 0,
  whiteSpace: 'nowrap',
  px: { xs: 0.55, sm: 0.7 },
  py: { xs: 0.35, sm: 0.45 },
  fontWeight: 800
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
 * Narrow notebook/note columns — always two text rows thick (Add / Album-Set, Add / Album).
 * Height tracks menu font rem so large Comic fonts are not clipped.
 * Hover scale (+25%) comes from SliderControlButton default (do not pass disableHoverScale).
 */
const laneContainedButtonTwoLineSx = {
  width: '100% !important',
  maxWidth: '100% !important',
  minWidth: '0 !important',
  alignSelf: 'stretch',
  boxSizing: 'border-box',
  flexShrink: 0,
  flexGrow: 0,
  whiteSpace: 'normal !important',
  overflow: 'hidden',
  textAlign: 'center',
  justifyContent: 'center',
  alignItems: 'center',
  px: { xs: 0.25, sm: 0.35 },
  py: { xs: 0.45, sm: 0.55 },
  height: TWO_LINE_LANE_BUTTON_HEIGHT,
  minHeight: TWO_LINE_LANE_BUTTON_HEIGHT,
  maxHeight: TWO_LINE_LANE_BUTTON_HEIGHT,
  lineHeight: '1.2 !important',
  transformOrigin: 'center center'
};

/** Lets Add Album-Set / Add Album scale 25% on hover without clipping in the column shell. */
const laneAddButtonWrapSx = {
  position: 'relative',
  zIndex: 2,
  flexShrink: 0,
  mb: 1,
  overflow: 'visible',
  width: '100%'
};

const menuToggleIconSx = {
  display: 'block',
  height: { xs: 28, md: 32 },
  width: 'auto',
  objectFit: 'contain',
  pointerEvents: 'none',
  userSelect: 'none'
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
  minHeight: SINGLE_LINE_MENU_BUTTON_MIN_HEIGHT,
  py: { xs: 0.45, sm: 0.55 },
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

/** Album list rows — two-line height tracks menu font; title + dates left-aligned. */
const menuButtonTwoLineAlbumSx = {
  whiteSpace: 'normal !important',
  minHeight: TWO_LINE_LANE_BUTTON_HEIGHT,
  height: 'auto',
  maxHeight: 'none',
  lineHeight: '1.2 !important',
  py: { xs: 0.5, sm: 0.65 },
  alignItems: 'center !important',
  justifyContent: 'center !important',
  overflow: 'visible',
  boxSizing: 'border-box',
  '& .MuiButton-label': {
    display: 'flex !important',
    flexDirection: 'column',
    alignItems: 'flex-start !important',
    justifyContent: 'center !important',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    minHeight: `calc(${menuBtnFontRemExpr()} * 2.2 * 1rem)`,
    overflow: 'visible',
    whiteSpace: 'normal !important',
    textAlign: 'left !important'
  }
};

const sidebarAlbumLineSx = {
  display: 'block',
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textAlign: 'left'
};

/** Sidebar album / album-set title — up to two lines, no ellipsis truncation. */
const sidebarAlbumTitleTwoLineSx = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  overflow: 'hidden',
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  overflowWrap: 'anywhere',
  textAlign: 'left',
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  lineHeight: 1.2,
  paddingTop: '0.08em',
  paddingBottom: '0.04em'
};

function MenuRowTwoLineLabelText({ children }) {
  return (
    <Box component="span" sx={{ ...sidebarAlbumTitleTwoLineSx, flex: '1 1 auto', alignSelf: 'center' }}>
      {children}
    </Box>
  );
}

function SidebarAlbumTwoLineLabel({ titleLine, datesLine }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
        minHeight: `calc(${menuBtnFontRemExpr()} * 2.2 * 1rem)`,
        lineHeight: 1.2
      }}
    >
      <Box component="span" sx={sidebarAlbumTitleTwoLineSx}>
        {titleLine}
      </Box>
      <Box component="span" sx={{ ...sidebarAlbumLineSx, minHeight: '1.15em' }}>
        {datesLine}
      </Box>
    </Box>
  );
}

/** Blue used to mark the active search-result note (chip + matching sidebar row). */
const PHOTO_ALBUMS_SEARCH_HIT_BLUE = '#1e88e5';

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
const PHOTO_ALBUMS_INNER_LOCKED_LABEL = '*****';
const PHOTO_ALBUMS_INNER_LOCKED_BG = '#000000';
const photoAlbumsInnerLockedMenuSx = {
  bgcolor: `${PHOTO_ALBUMS_INNER_LOCKED_BG} !important`,
  color: '#ffffff !important',
  WebkitTextFillColor: '#ffffff !important',
  border: '4px solid #ffffff !important',
  '&:hover': {
    bgcolor: `${PHOTO_ALBUMS_INNER_LOCKED_BG} !important`,
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
  border: PHOTO_ALBUMS_THEME_INVERSE_BORDER_2,
  borderRadius: 1,
  p: 1,
  bgcolor: 'var(--theme-daynight-color)',
  minHeight: 320,
  // visible so Add Album-Set / Add Album +25% hover scale is not clipped
  overflow: 'visible',
  boxSizing: 'border-box',
  containerType: 'inline-size'
};

const menuColumnShellCompactSx = {
  ...menuColumnShellSx,
  minHeight: 0,
  p: 0.75
};

const COLUMN_RESIZE_BAR_RED = '#e53935';

const columnResizeHandleSx = {
  flex: '0 0 auto',
  width: 30,
  cursor: 'col-resize',
  touchAction: 'none',
  alignSelf: 'stretch',
  // Light/Dark series: divider chrome follows day/night surface.
  bgcolor: 'var(--theme-daynight-color)',
  position: 'relative',
  zIndex: 20,
  borderLeft: PHOTO_ALBUMS_THEME_INVERSE_BORDER_1,
  borderRight: PHOTO_ALBUMS_THEME_INVERSE_BORDER_1,
  /* Yellow dashed vertical — red only on hover / drag */
  '&::before': {
    content: '""',
    position: 'absolute',
    top: '12%',
    bottom: '12%',
    left: '50%',
    width: 0,
    borderLeft: '6px dashed var(--theme-yellow-color)',
    transform: 'translateX(-50%)',
    pointerEvents: 'none',
    transition: 'border-left-color 120ms ease'
  },
  '&:hover::before, &.is-dragging::before': {
    borderLeftColor: COLUMN_RESIZE_BAR_RED
  }
};

const rowResizeHandleSx = {
  flex: '0 0 auto',
  height: 10,
  cursor: 'ns-resize',
  touchAction: 'none',
  alignSelf: 'stretch',
  bgcolor: 'var(--theme-daynight-color)',
  position: 'relative',
  zIndex: 20,
  borderTop: PHOTO_ALBUMS_THEME_INVERSE_BORDER_1,
  borderBottom: PHOTO_ALBUMS_THEME_INVERSE_BORDER_1,
  '&::before': {
    content: '""',
    position: 'absolute',
    left: '12%',
    right: '12%',
    top: '50%',
    height: 0,
    borderTop: '6px dashed var(--theme-yellow-color)',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
    transition: 'border-top-color 120ms ease'
  },
  '&:hover::before, &.is-dragging::before': {
    borderTopColor: COLUMN_RESIZE_BAR_RED
  }
};


function loadStoredNoteFontStyleIndex() {
  try {
    const raw = localStorage.getItem(NOTE_FONT_STYLE_LS_KEY);
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed % PHOTO_ALBUMS_FONT_STYLE_COUNT;
    }
  } catch {
    // ignore
  }
  return PHOTO_ALBUMS_DEFAULT_FONT_STYLE_INDEX;
}

function loadStoredNoteFontSizePt() {
  try {
    const raw = localStorage.getItem(NOTE_FONT_SIZE_PT_LS_KEY);
    return normalizePhotoAlbumsFontSizePt(raw);
  } catch {
    // ignore
  }
  return PHOTO_ALBUMS_DEFAULT_FONT_SIZE_PT;
}









const photoAlbumsContentScrollSx = {
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
    border: PHOTO_ALBUMS_THEME_INVERSE_BORDER_2
  },
  '&::-webkit-scrollbar-thumb:hover': {
    filter: 'brightness(1.08)'
  }
};

/** Notebook / Note / Shortcut list panels — always show a vertical scrollbar (OneDrive + USB). */
const photoAlbumsMenuListScrollSx = {
  ...photoAlbumsContentScrollSx,
  pr: 0.25,
  border: PHOTO_ALBUMS_THEME_INVERSE_BORDER_2,
  borderRadius: 1,
  boxSizing: 'border-box'
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
      shortcutPanePercent: Number(parsed?.shortcutPanePercent),
      sharedAlbumPanePercent: Number(parsed?.sharedAlbumPanePercent)
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
    maxLabel = Math.max(
      maxLabel,
      measureMenuLabelWidth(photoAlbumsNotebookSidebarLabel(nb, notebooks) || 'Untitled', rem)
    );
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

function ColumnResizeHandle({ onMouseDown, sx, label = 'Resize column' }) {
  const [dragging, setDragging] = useState(false);

  const handleMouseDown = (event) => {
    setDragging(true);
    const onUp = () => {
      setDragging(false);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mouseup', onUp);
    onMouseDown?.(event);
  };

  return (
    <Box
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      title={label}
      className={dragging ? 'is-dragging' : undefined}
      onMouseDown={handleMouseDown}
      sx={{ ...columnResizeHandleSx, ...sx }}
    />
  );
}

function RowResizeHandle({ onMouseDown, sx, label = 'Resize panels' }) {
  const [dragging, setDragging] = useState(false);

  const handleMouseDown = (event) => {
    setDragging(true);
    const onUp = () => {
      setDragging(false);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mouseup', onUp);
    onMouseDown?.(event);
  };

  return (
    <Box
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      title={label}
      className={dragging ? 'is-dragging' : undefined}
      onMouseDown={handleMouseDown}
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
 * media (images/video/iframe/data URIs). `photoAlbumsRichTextHasContent` only
 * counts text, so image-only notes must be detected here too.
 */
function photoAlbumsHtmlHasProtectableContent(html) {
  const raw = String(html ?? '');
  if (photoAlbumsRichTextHasContent(raw)) return true;
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

const themeDaynightSurfaceImportantSx = {
  bgcolor: `${PHOTO_ALBUMS_THEME_DAYNIGHT_BG} !important`,
  color: `${PHOTO_ALBUMS_THEME_INVERSE_FG} !important`,
  WebkitTextFillColor: `${PHOTO_ALBUMS_THEME_INVERSE_FG} !important`
};

const menuRowCountBadgeSx = {
  flex: '0 0 auto',
  minWidth: 28,
  px: 0.45,
  py: 0.1,
  ...photoAlbumsThemeDaynightSurfaceSx,
  fontSize: '0.72rem',
  fontWeight: 800,
  lineHeight: 1.2,
  textAlign: 'center',
  border: PHOTO_ALBUMS_THEME_INVERSE_BORDER_2,
  borderRadius: '4px',
  boxSizing: 'border-box'
};

const menuRowEditFieldSx = {
  mb: 0.5,
  ...photoAlbumsThemeDaynightSurfaceSx,
  borderRadius: '12px',
  border: `4px double ${PHOTO_ALBUMS_THEME_INVERSE_BORDER}`,
  px: 0.75,
  py: 0.25,
  boxSizing: 'border-box',
  '& .MuiInputBase-root': {
    fontFamily: MAIN_FONT_FAMILY,
    color: PHOTO_ALBUMS_THEME_INVERSE_FG,
    WebkitTextFillColor: PHOTO_ALBUMS_THEME_INVERSE_FG
  },
  '& .MuiInputBase-input': {
    color: `${PHOTO_ALBUMS_THEME_INVERSE_FG} !important`,
    WebkitTextFillColor: `${PHOTO_ALBUMS_THEME_INVERSE_FG} !important`,
    caretColor: PHOTO_ALBUMS_THEME_INVERSE_FG
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
      variant="yellow"
      hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
      disableSelectedTranslate
      aria-pressed={lookSelected || undefined}
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
                bgcolor: `${PHOTO_ALBUMS_SEARCH_HIT_BLUE} !important`,
                color: '#ffffff !important',
                WebkitTextFillColor: '#ffffff !important',
                border: '4px double #ffffff !important'
              }
            : {
                bgcolor: `${PHOTO_ALBUMS_THEME_DAYNIGHT_BG} !important`,
                color: `${PHOTO_ALBUMS_THEME_INVERSE_FG} !important`,
                WebkitTextFillColor: `${PHOTO_ALBUMS_THEME_INVERSE_FG} !important`,
                border:
                  multiSelected && !selected
                    ? `3px solid ${PHOTO_ALBUMS_THEME_INVERSE_BORDER} !important`
                    : `${PHOTO_ALBUMS_THEME_INVERSE_BORDER_2} !important`
              }
          : null),
        ...(locked ? photoAlbumsInnerLockedMenuSx : null),
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
        sx={{
          ...(!locked ? menuButtonTwoLineAlbumSx : null),
          ...(isDropTarget
            ? {
                outline: '2px dashed var(--theme-primary-color)',
                outlineOffset: 2
              }
            : null)
        }}
      >
        {locked ? (
          label ?? shortcut.label
        ) : (
          <MenuRowTwoLineLabelText>{label ?? shortcut.label}</MenuRowTwoLineLabelText>
        )}
      </MenuRowButton>
    </MenuRowWithDelete>
  );
}

function RenamableDraggableMenuRow({
  id,
  label,
  albumLabelLines = null,
  /** Optional white count badge at the right of the row label (album-set / album totals). */
  sideCount = null,
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
  albumPageDropActive = false,
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
    draggingId != null ||
    alternateDraggingId != null ||
    noteImageDropActive ||
    acceptForeignDrop ||
    albumPageDropActive ||
    Boolean(getActiveAlbumPageDrag());
  const isDropTarget =
    acceptsDrop &&
    dropTargetId === id &&
    (noteImageDropActive ||
      acceptForeignDrop ||
      albumPageDropActive ||
      Boolean(getActiveAlbumPageDrag()) ||
      (draggingId !== id && alternateDraggingId !== id));

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
            const albumPageDrag =
              albumPageDropActive ||
              isAlbumPageDrag(e.dataTransfer) ||
              types.includes(DRAG_ALBUM_PAGE);
            const isInternalVaultDrag =
              types.includes(DRAG_NOTEBOOK) ||
              types.includes(DRAG_NOTE) ||
              types.includes(DRAG_SHORTCUT) ||
              types.includes(DRAG_CROSS_PANE) ||
              albumPageDrag;
            const isOsFile = types.includes('Files') && !isInternalVaultDrag;
            if (isOsFile && onFileDrop) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              return;
            }
            // OS files without a row handler: let the event bubble to the column drop zone.
            if (isOsFile) return;
            if (!acceptsDrop && !albumPageDrag) return;
            if (albumPageDrag) {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'move';
              onDragOver(id);
              return;
            }
            if (!acceptsDrop) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = acceptForeignDrop ? 'copy' : 'move';
            onDragOver(id);
          }}
          onDrop={(e) => {
            const types = e.dataTransfer?.types ? Array.from(e.dataTransfer.types) : [];
            const albumPageDrag =
              albumPageDropActive ||
              isAlbumPageDrag(e.dataTransfer) ||
              types.includes(DRAG_ALBUM_PAGE);
            const isInternalVaultDrag =
              types.includes(DRAG_NOTEBOOK) ||
              types.includes(DRAG_NOTE) ||
              types.includes(DRAG_SHORTCUT) ||
              types.includes(DRAG_CROSS_PANE) ||
              albumPageDrag;
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
          sx={{
            ...(!editing && !locked ? menuButtonTwoLineAlbumSx : null),
            ...(isDropTarget
              ? {
                  outline: '2px dashed var(--theme-primary-color)',
                  outlineOffset: 2
                }
              : null)
          }}
        >
          {locked ? (
            PHOTO_ALBUMS_INNER_LOCKED_LABEL
          ) : albumLabelLines ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                minWidth: 0,
                gap: 0.5
              }}
            >
              <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
                <SidebarAlbumTwoLineLabel
                  titleLine={albumLabelLines.titleLine}
                  datesLine={albumLabelLines.datesLine}
                />
              </Box>
              {sideCount != null ? (
                <Box component="span" sx={menuRowCountBadgeSx} aria-hidden="true">
                  {sideCount}
                </Box>
              ) : null}
            </Box>
          ) : (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                minWidth: 0,
                gap: 0.5
              }}
            >
              <MenuRowTwoLineLabelText>{label}</MenuRowTwoLineLabelText>
              {sideCount != null ? (
                <Box component="span" sx={menuRowCountBadgeSx} aria-hidden="true">
                  {sideCount}
                </Box>
              ) : null}
            </Box>
          )}
        </MenuRowButton>
      </Box>
    </MenuRowWithDelete>
  );
}

/** Content-pane copy of menu notebook/note buttons — click to rename; stays in sync with the menu. */









/** Splits v2 / legacy notes into title↔photo / photo↔photo text segments. */

export default function PhotoAlbumsWorkspacePane({
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
  const paneStorageType = usePhotoAlbumsPaneStorageType();
  const vaultApi = useMemo(() => createPhotoAlbumsPaneApi(paneStorageType), [paneStorageType]);
  const { user } = useAuth();
  const storedLayout = useMemo(() => loadStoredLayout(), []);
  const [loading, setLoading] = useState(true);
  const [vaultUiReady, setVaultUiReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [batchUploadProgress, setBatchUploadProgress] = useState(null);
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
  const isTutaDrivePane = String(paneLabel || '').toLowerCase() === 'tutadrive';
  const [albumFullscreen, setAlbumFullscreen] = useState(false);
  /** Zoom icon — hide sidebars/menus and show album only (not true fullscreen overlay). */
  const [albumFocusView, setAlbumFocusView] = useState(false);
  const hideWorkspaceChrome = albumFullscreen || albumFocusView;
  const [usbVaultFolderLabel] = useState('USB');
  const [usbBridgeHealthy, setUsbBridgeHealthy] = useState(false);
  const [crossPaneDropActive, setCrossPaneDropActive] = useState(false);
  const [crossPaneTransfer, setCrossPaneTransfer] = useState(null);
  const [crossPaneBusy, setCrossPaneBusy] = useState(false);
  const [crossPaneProgressPercent, setCrossPaneProgressPercent] = useState(0);
  const [crossPaneProgressLabel, setCrossPaneProgressLabel] = useState('');
  const [crossPaneDuplicateError, setCrossPaneDuplicateError] = useState('');
  const [duplicateNamePopup, setDuplicateNamePopup] = useState('');
  /** 'album-set' | 'album' — prompt before creating a notebook or note. */
  const [createItemDialog, setCreateItemDialog] = useState(null);
  const [renameSavedPopup, setRenameSavedPopup] = useState('');
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
  const [noteContentBgIndex, setNoteContentBgIndex] = useState(PHOTO_ALBUMS_DEFAULT_CONTENT_BG_INDEX);
  const [noteTextBgIndex, setNoteTextBgIndex] = useState(PHOTO_ALBUMS_DEFAULT_TEXT_HIGHLIGHT_INDEX);
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
  // While searching, the title shows blinking highlights (read-only) until the
  // user clicks it to edit; flips back to highlight view on blur / note swap.
  const [titleEditing, setTitleEditing] = useState(false);
  const [searchTerm1, setSearchTerm1] = useState('');
  /** Non-null only after the user presses Search (or Clear resets to null). */
  const [searchResults, setSearchResults] = useState(null);
  /** Terms from the last Search press — highlights/Found bar ignore typing until then. */
  const [appliedSearchTerms, setAppliedSearchTerms] = useState([]);
  const [searchMessage, setSearchMessage] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  // Search-hit navigation within the open note (up/down steps through matches).
  const [searchHitCount, setSearchHitCount] = useState(0);
  const [activeHitIndex, setActiveHitIndex] = useState(-1);
  /** Matching album-page previews for the open note — shown in the Found bar, not in the filmstrip. */
  const [searchFoundPages, setSearchFoundPages] = useState(null);
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
  const [inviteReviewOpen, setInviteReviewOpen] = useState(false);
  const [inviteReviewSendResult, setInviteReviewSendResult] = useState(null);
  const [sharedAlbums, setSharedAlbums] = useState([]);
  const [selectedSharedAlbumId, setSelectedSharedAlbumId] = useState(null);
  const [sharedAlbumView, setSharedAlbumView] = useState(null);
  const [sharedAlbumLoading, setSharedAlbumLoading] = useState(false);
  const [orderAlbumItems, setOrderAlbumItems] = useState([]);
  const [orderAlbumName, setOrderAlbumName] = useState(DEFAULT_ORDER_ALBUM_NAME);
  const [orderAlbumViewOpen, setOrderAlbumViewOpen] = useState(false);
  const [orderAlbumDropActive, setOrderAlbumDropActive] = useState(false);
  /** Exclusive focus: ForOrder selected (Set/Album whites cleared). */
  const [orderAlbumActive, setOrderAlbumActive] = useState(false);
  const [orderFilmstripIndex, setOrderFilmstripIndex] = useState(0);
  /** After selecting an ordered album, jump to this page once the editor hydrates. */
  const pendingOrderPageRef = useRef(null);
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
  const leftSidebarPaneRef = useRef(null);
  const notebookColPaneRef = useRef(null);
  const rightSidebarPaneRef = useRef(null);
  const [shortcutPanePercent, setShortcutPanePercent] = useState(() =>
    clamp(
      Number.isFinite(storedLayout?.shortcutPanePercent)
        ? storedLayout.shortcutPanePercent
        : DEFAULT_SHORTCUT_PANE_PERCENT,
      MIN_SHORTCUT_PANE_PERCENT,
      MAX_SHORTCUT_PANE_PERCENT
    )
  );
  const [filesSidebarTab, setFilesSidebarTab] = useState(() => readFilesExplorerTab());
  const [mobileUploadFolderRefreshToken, setMobileUploadFolderRefreshToken] = useState(0);
  const [sharedAlbumPanePercent, setSharedAlbumPanePercent] = useState(() =>
    clamp(
      Number.isFinite(storedLayout?.sharedAlbumPanePercent)
        ? storedLayout.sharedAlbumPanePercent
        : DEFAULT_SHARED_ALBUM_PANE_PERCENT,
      MIN_SHARED_ALBUM_PANE_PERCENT,
      MAX_SHARED_ALBUM_PANE_PERCENT
    )
  );
  const leftSidebarSplitRef = useRef(null);
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
  /** Last per-file staging failure, so batch adds can report the real reason. */
  const stagingFailureRef = useRef('');
  /** TutaPhoto free-tier caps + live counts; refreshed from the vault per batch. */
  const mediaQuotaRef = useRef({ ...TUTAPHOTO_QUOTA_FALLBACK });
  /** Batch-scoped so each drop shows the quota / downsize popup at most once. */
  const quotaPopupShownRef = useRef(false);
  const downsizeNoticeShownRef = useRef(false);
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
  const [draggingAlbumPage, setDraggingAlbumPage] = useState(false);
  const [draggingShortcutId, setDraggingShortcutId] = useState(null);
  const [dropTargetShortcutId, setDropTargetShortcutId] = useState(null);
  const refreshVaultUsageRef = useRef(() => {});
  const bumpVaultUsageTimerRef = useRef(null);
  const saveTimerRef = useRef(null);
  const mynotePrefsSaveTimerRef = useRef(null);
  const contentScrollRef = useRef(null);
  const pendingMynoteRestoreRef = useRef({ applied: false });
  const noteContentBgIndexRef = useRef(PHOTO_ALBUMS_DEFAULT_CONTENT_BG_INDEX);
  const noteFontStyleIndexRef = useRef(PHOTO_ALBUMS_DEFAULT_FONT_STYLE_INDEX);
  const noteTextBgIndexRef = useRef(PHOTO_ALBUMS_DEFAULT_TEXT_HIGHLIGHT_INDEX);
  const noteFontSizePtRef = useRef(PHOTO_ALBUMS_DEFAULT_FONT_SIZE_PT);
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
  /** Persisted note_name at title-box focus — not the live optimistic tree value. */
  const noteTitleBoxPersistedNameRef = useRef('');
  /** Sidebar rename: persisted note_name / label when edit started. */
  const noteRenameStartPersistedRef = useRef('');
  const noteRenameStartLabelRef = useRef('');
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

  const selectedNotebook = useMemo(
    () => notebooks.find((nb) => Number(nb.notebook_id) === Number(selectedNotebookId)) ?? null,
    [notebooks, selectedNotebookId]
  );

  const selectedNote = useMemo(() => {
    if (!selectedNotebook) return null;
    return (selectedNotebook.notes || []).find((n) => Number(n.note_id) === Number(selectedNoteId)) ?? null;
  }, [selectedNotebook, selectedNoteId]);

  const albumBackupContext = useMemo(() => {
    if (!selectedNote || !selectedNotebook) return null;
    const notesInNotebook = selectedNotebook.notes || [];
    const albumLabel = resolveOpenNoteTitlePlain(selectedNote, notebooks, notesInNotebook);
    return {
      notebookId: Number(selectedNote.notebook_id),
      noteId: Number(selectedNote.note_id),
      albumLabel
    };
  }, [selectedNote, selectedNotebook, notebooks]);

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
  const displayNotebooks = notebooks;

  // Must be declared before any useCallback that lists `notes` in deps (TDZ).
  const notes = useMemo(() => {
    const source = searchActive ? displayNotebooks : notebooks;
    const nb =
      source.find((item) => Number(item.notebook_id) === Number(selectedNotebookId)) ??
      source[0] ??
      selectedNotebook;
    return nb?.notes || [];
  }, [searchActive, displayNotebooks, notebooks, selectedNotebookId, selectedNotebook]);

  const loadNoteContent = useCallback(async (noteId, { syncStaging = true } = {}) => {
    const id = Number(noteId);
    if (!Number.isFinite(id) || id < 1) return null;
    const note = await vaultApi.fetchPhotoAlbumsNote(id);
    if (!note) throw new Error('Note not found');
    setNotebooks((prev) =>
      prev.map((nb) => ({
        ...nb,
        notes: (nb.notes || []).map((row) => {
          if (Number(row.note_id) === id) {
            const merged = { ...row, ...note, content_loaded: true };
            merged.album_media_count = countPhotoAlbumsSidebarMediaInAttachments(
              merged.attachments
            );
            return merged;
          }
          return stripNoteHeavyFields(row);
        })
      }))
    );
    // Alley + ENV hard-file purge already ran in vaultGetNote; mirror kept attachments in UI.
    if (syncStaging) {
      noteEditorApiRef.current?.syncStagingAlleyFromAttachments?.(note.attachments || []);
    }
    return note;
  }, [vaultApi]);

  const noteHasInnerEncryption = useCallback((note) => {
    if (!note) return false;
    return Boolean(note.inner_encrypt_enabled) || isPhotoAlbumsInnerEncryptedBody(note.body_text);
  }, []);

  /** Note still needs a PIN before content can be read/edited. */
  const noteRequiresInnerPinToView = useCallback(
    (note) => {
      if (!note) return false;
      const bodyEncrypted = isPhotoAlbumsInnerEncryptedBody(note.body_text);
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
    return isPhotoAlbumsInnerEncryptedBody(stored) ? '' : stored;
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
            const fresh = await vaultApi.fetchPhotoAlbumsNote(id);
            body = fresh?.body_text ?? '';
          }
          if (isPhotoAlbumsInnerEncryptedBody(body)) return id; // already locked
          plainHtml = body ?? '';
        }
      }
      // Notebook-scope lock (force) hides every note name, so even empty notes
      // get locked. Note-scope lock still requires real content to protect —
      // either body text/media OR at least one dropped file attachment (which the
      // locked view hides behind the PIN too).
      const hasAttachments =
        Array.isArray(noteRow?.attachments) && noteRow.attachments.length > 0;
      if (!force && !hasAttachments && !photoAlbumsHtmlHasProtectableContent(plainHtml)) {
        return null;
      }
      // PIN stays in the browser only — body blob holds salt + wrapped DEK + ciphertext.
      const { bodyText, innerPinSalt } = await encryptPhotoAlbumsNoteInnerBody(plainHtml, pin);
      await vaultApi.updatePhotoAlbumsNote(id, {
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
      if (!noteRow?.content_loaded || body == null || !isPhotoAlbumsInnerEncryptedBody(body)) {
        freshNote = await vaultApi.fetchPhotoAlbumsNote(id);
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
        ...(attachmentsForRow
          ? {
              attachments: attachmentsForRow,
              album_media_count: countPhotoAlbumsSidebarMediaInAttachments(attachmentsForRow)
            }
          : null),
        ...(extraImagesForRow ? { extra_images: extraImagesForRow } : null)
      };
      if (!isPhotoAlbumsInnerEncryptedBody(body)) {
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
        plainHtml = await decryptPhotoAlbumsNoteInnerBody(body, pin, salt);
      } catch (err) {
        const until = Date.now() + INNER_UNLOCK_LOCKOUT_MS;
        persistInnerUnlockLockoutMs(paneStorageType, user?.singles_id, id, until);
        try {
          await vaultApi.updatePhotoAlbumsNote(id, {
            inner_unlock_locked_until: new Date(until).toISOString()
          });
        } catch {
          // Local lockout still applies even if the server write fails.
        }
        throw err;
      }
      clearPersistedInnerUnlockLockout(paneStorageType, user?.singles_id, id);
      await vaultApi.updatePhotoAlbumsNote(id, {
        body_text: plainHtml,
        inner_encrypt_enabled: false,
        inner_pin_salt: null,
        inner_unlock_locked_until: null
      });
      indexNoteSearchText(id, stripPhotoAlbumsHtml(plainHtml), '');
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
          vaultApi.syncPhotoAlbumsStorage({
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
            readPhotoAlbumsApiError(
              syncErr,
              'Note locked locally, but Cloud sync failed. Leave this page to retry saving, then reopen.'
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
    if (!Number.isFinite(next) || next < 1) return;
    replaceMultiSelectedNoteIds([]);
    noteMultiSelectAnchorIdRef.current = next;
    if (Number(selectedNoteIdRef.current) === next) {
      if (!fromNotebook) setInnerEncryptUiScope('note');
      return;
    }
    void (async () => {
      const prevNoteId = selectedNoteIdRef.current;
      // Flush body before leaving the album.
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
      setSelectedSharedAlbumId(null);
      setSharedAlbumView(null);
      editorHydratedRef.current.key = '';
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
    if (!t1) {
      setAppliedSearchTerms([]);
      setSearchResults(null);
      setSearchMessage('');
      return;
    }
    setAppliedSearchTerms([t1]);
    setSearchBusy(true);
    setError('');
    try {
      const results = await vaultApi.searchPhotoAlbumsNotes({
        q1: t1,
        q2: '',
        q3: '',
        op1: 'and',
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
              const fresh = await vaultApi.fetchPhotoAlbumsNote(noteId);
              const body = fresh?.body_text;
              if (body == null || isPhotoAlbumsInnerEncryptedBody(body)) continue;
              const meta = noteById.get(noteId);
              indexNoteSearchText(noteId, stripPhotoAlbumsHtml(body), meta?.note?.note_name || '');
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
      for (const query of [t1]) {
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
      setError(readPhotoAlbumsApiError(err, 'Search failed'));
    } finally {
      setSearchBusy(false);
    }
  }, [
    isNoteHiddenFromSearch,
    noteHasInnerEncryption,
    isInnerNoteUnlocked,
    notebooks,
    searchTerm1,
    selectNoteId,
    vaultApi
  ]);

  const handleClearSearch = useCallback(() => {
    setSearchTerm1('');
    setAppliedSearchTerms([]);
    setSearchResults(null);
    setSearchMessage('');
    setSearchFoundPages(null);
  }, []);

  const handleSearchMatchPagesChange = useCallback((payload) => {
    setSearchFoundPages(payload);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchUserCustomization()
      .then((prefs) => {
        if (cancelled) return;
        setMenuButtonFontRem(
          photoAlbumsMenuButtonFontRemFromTenths(
            prefs.mynoteFontSize ?? PHOTO_ALBUMS_DEFAULT_MENU_BUTTON_FONT_SIZE_TENTHS,
            defaultMenuButtonFontRem
          )
        );
        setNoteFontSizePt(
          normalizePhotoAlbumsFontSizePt(
            prefs.mynoteEditorFontSizePt ?? PHOTO_ALBUMS_DEFAULT_FONT_SIZE_PT
          )
        );
        setNoteFontStyleIndex(
          prefs.mynoteFontColorIndex ?? PHOTO_ALBUMS_DEFAULT_FONT_STYLE_INDEX
        );
        setNoteContentBgIndex(
          prefs.mynoteContentBgIndex ?? PHOTO_ALBUMS_DEFAULT_CONTENT_BG_INDEX
        );
        // Legacy default was white (1) — that painted a white “input box” around note text.
        const loadedHighlight = prefs.mynoteTextHighlightIndex;
        const nextHighlight =
          loadedHighlight == null || Number(loadedHighlight) === 1
            ? null
            : loadedHighlight;
        setNoteTextBgIndex(nextHighlight ?? PHOTO_ALBUMS_DEFAULT_TEXT_HIGHLIGHT_INDEX);
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










  const leaveUnlockedWorkspace = useCallback(
    (err) => {
      const message = err
        ? readPhotoAlbumsOpenFailureMessage(err)
        : PHOTO_ALBUMS_STORAGE_NOT_UNLOCKED_MESSAGE;
      setError('');
      setPhotoAlbumsBridgeStorageType(null);
      onSessionEnded?.(message);
      // Best-effort logoff so a half-open USB/Cloud session does not stick.
      void vaultApi.logoffPhotoAlbumsStorage().catch(() => {});
    },
    [onSessionEnded, vaultApi]
  );

  const loadTree = useCallback(async ({ preferNotebookId, preferNoteId, silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    if (!silent) loadedNoteIdRef.current = null;
    try {
      const { notebooks: tree, shortcuts: loadedShortcuts } = await vaultApi.fetchPhotoAlbumsTree();
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
      // Initial open failed — return to Cloud/USB login with the error (do not keep editor banner).
      if (!silent || isPhotoAlbumsVaultOpenFatalError(err) || isPhotoAlbumsStorageNotUnlockedError(err)) {
        leaveUnlockedWorkspace(err);
        return;
      }
      setError(readPhotoAlbumsApiError(err, 'Failed to load Record Vault'));
    } finally {
      if (!silent) {
        setLoading(false);
        setVaultUiReady(true);
      }
    }
  }, [vaultApi, leaveUnlockedWorkspace]);

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
    window.addEventListener(PHOTO_ALBUMS_TREE_RELOAD_EVENT, onReload);
    return () => window.removeEventListener(PHOTO_ALBUMS_TREE_RELOAD_EVENT, onReload);
  }, [loadTree, paneStorageType]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await fetchPhotoAlbumsStorageConfig();
        if (cancelled) return;
        setOneDriveOffered(Boolean(cfg.oneDrive?.visible && cfg.oneDrive?.enabled));
        setLocalUsbOffered(Boolean(cfg.localUsb?.visible && cfg.localUsb?.enabled));
        setVideoTutorialUrl(String(cfg?.videoTutorialTutaphotoalbums || '').trim());
        if (cfg.oneDrive?.visible && cfg.oneDrive?.enabled) {
          if (cfg.tutaDrive) {
            setOneDriveVaultFolderName('TutaDrive');
          } else {
            try {
              const oneDriveCfg = await fetchPhotoAlbumsOneDriveConfig();
              if (!cancelled && oneDriveCfg?.folderName) {
                setOneDriveVaultFolderName(String(oneDriveCfg.folderName));
              }
            } catch {
              // keep default folder name
            }
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
    setPhotoAlbumsBridgeSinglesId(user?.singles_id ?? null);
  }, [user?.singles_id]);

  useEffect(() => {
    void probePhotoAlbumsBridge();
    const timerId = window.setInterval(() => {
      void probePhotoAlbumsBridge();
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
      const probe = await probePhotoAlbumsBridge();
      if (cancelled) return;
      if (!probe.ok) {
        setUsbBridgeHealthy(false);
        return;
      }
      try {
        const [status, locations] = await Promise.all([
          fetchPhotoAlbumsUsbStatus(),
          fetchPhotoAlbumsUsbLocations()
        ]);
        if (cancelled) return;
        const unlockedSession = Boolean(status?.session?.unlocked);
        if (!unlockedSession) {
          setUsbBridgeHealthy(false);
          setPhotoAlbumsBridgeStorageType(null);
          leaveUnlockedWorkspace();
          return;
        }
        const mountPath = String(status?.session?.mountPath || '').trim();
        const mountStillPresent =
          !mountPath ||
          (Array.isArray(locations) &&
            locations.some((loc) => String(loc?.mountPath || '').trim() === mountPath));
        setUsbBridgeHealthy(unlockedSession && mountStillPresent);
      } catch (err) {
        if (cancelled) return;
        if (isPhotoAlbumsBridgeRouteMissingError(err) || isPhotoAlbumsStorageNotUnlockedError(err)) {
          setUsbBridgeHealthy(false);
          leaveUnlockedWorkspace(err);
          return;
        }
        setUsbBridgeHealthy(false);
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
  }, [unlocked, paneStorageType, leaveUnlockedWorkspace]);

  /** OneDrive: leave workspace when server session is no longer unlocked. */
  useEffect(() => {
    if (!unlocked || paneStorageType !== 'onedrive') return undefined;
    let cancelled = false;
    const refreshOneDriveSession = async () => {
      try {
        const status = await fetchPhotoAlbumsOneDriveStatus();
        if (cancelled) return;
        if (!status?.session?.unlocked) {
          setPhotoAlbumsBridgeStorageType(null);
          leaveUnlockedWorkspace();
        }
      } catch {
        // ignore transient status errors
      }
    };
    void refreshOneDriveSession();
    const timerId = window.setInterval(() => {
      void refreshOneDriveSession();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timerId);
    };
  }, [unlocked, paneStorageType, leaveUnlockedWorkspace]);

  useEffect(() => {
    if (!unlocked) {
      setLoading(false);
      setVaultUiReady(true);
      return undefined;
    }
    setPhotoAlbumsBridgeStorageType(paneStorageType);
    const pending = pendingMynoteRestoreRef.current;
    void loadTree({
      preferNotebookId: pending?.notebookId ?? undefined,
      preferNoteId: pending?.noteId ?? undefined
    });
  }, [unlocked, paneStorageType, loadTree]);

  useEffect(() => {
    if (!unlocked || !selectedNoteId) return undefined;
    const id = Number(selectedNoteId);
    let cancelled = false;
    void (async () => {
      setNoteContentLoading(true);
      setError('');
      try {
        // Always fetch on display so BE runs size+checksum attachment purge + ENV folder hard-file cleanup.
        const note = await loadNoteContent(id);
        if (cancelled) return;
        // Prefetch all album page photos as *_1000px (never full) before clearing hourglass.
        clearAttachmentVariantPreviewsForNote(id);
        const attachments = Array.isArray(note?.attachments) ? note.attachments : [];
        const photoIds = [];
        for (const row of attachments) {
          const aid = Number(row?.attachment_id ?? row?.attachmentId);
          const ext = String(row?.file_extension ?? row?.fileExtension ?? '')
            .replace(/^\./, '')
            .toLowerCase();
          if (!Number.isFinite(aid) || aid < 1) continue;
          if (!isPhotoAlbumsStagingPhotoExtension(ext)) continue;
          photoIds.push(aid);
        }
        if (photoIds.length) {
          await Promise.all(
            photoIds.map(async (aid) => {
              if (cancelled) return;
              try {
                const blob = await fetchPhotoAlbumsNoteAttachmentBlob(id, aid, {
                  inline: true,
                  storageType: paneStorageType,
                  variant: 'display'
                });
                if (cancelled || !blob) return;
                const url = URL.createObjectURL(blob);
                setAttachmentVariantPreview(id, aid, 'display', url);
              } catch {
                // Node view will retry individually.
              }
            })
          );
        }
        if (!cancelled) loadedNoteIdRef.current = id;
      } catch (err) {
        if (!cancelled) {
          if (isPhotoAlbumsVaultOpenFatalError(err) || isPhotoAlbumsStorageNotUnlockedError(err)) {
            leaveUnlockedWorkspace(err);
            return;
          }
          setError(readPhotoAlbumsApiError(err, 'Failed to load note'));
        }
      } finally {
        if (!cancelled) setNoteContentLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unlocked, selectedNoteId, loadNoteContent, leaveUnlockedWorkspace, paneStorageType]);

  // Push the resolved note body into the TipTap editor once per note/lock-state.
  // Guarded by a hydration key so autosave (which updates body_text in the tree)
  // never re-clobbers the caret while the user is typing.
  useEffect(() => {
    const api = noteEditorApiRef.current;
    if (!api) return;
    if (sharedAlbumView) return;
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
    // Bump clean-vN when title-strip / drag-junk rules change so already-open notes rehydrate.
    const key = `${id}:${locked ? 'locked' : 'open'}:clean-v4`;
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
        noteTitlePlainText(resolvePhotoAlbumsNoteTitle(selectedNote, notebooks, notesInNotebook)) ||
        noteTitlePlainText(selectedNote.note_name) ||
        String(draftRef.current?.openNoteTitlePlain || openNoteTitlePlain || '').trim();
      const rawBody = String(selectedNote.body_text ?? '');
      // Drop title-matching body rows (ignore [n]/[#]); leave title intact.
      const cleanedBody = cleanPhotoAlbumsNoteBodyHtml(rawBody, titlePlain);
      api.setContent(cleanedBody || '<p></p>', true);
      // Alley display: drop size+checksum duplicates; prune IDs purged on the server.
      api.syncStagingAlleyFromAttachments?.(selectedNote.attachments || []);
      if (cleanedBody !== rawBody) {
        patchNoteRowInTree(id, { body_text: cleanedBody, content_loaded: true });
        void vaultApi.updatePhotoAlbumsNote(id, { body_text: cleanedBody }).catch(() => {
          // Keep the cleaned editor view even if persist fails; next save retries.
        });
      }
    }
  }, [
    sharedAlbumView,
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

  useEffect(() => {
    const api = noteEditorApiRef.current;
    if (!api || !sharedAlbumView) return;
    const key = `shared:${Number(sharedAlbumView.sharedAlbumId) || 0}`;
    if (editorHydratedRef.current.key === key) return;
    editorHydratedRef.current.key = key;
    hydratedDraftKeyRef.current = '';
    api.setContent(String(sharedAlbumView.html || '') || '<p></p>', true);
    const staged = (sharedAlbumView.attachments || [])
      .map((row) => ({
        attachmentId: Number(row.attachmentId),
        fileName: String(row.fileName || ''),
        fileExtension: String(row.fileExtension || '')
      }))
      .filter((row) => Number.isFinite(row.attachmentId) && row.attachmentId > 0);
    api.syncStagingAlleyFromAttachments?.(staged);
  }, [sharedAlbumView, editorReadyTick]);

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
        const usage = await vaultApi.fetchPhotoAlbumsUsage();
        if (!cancelled) setVaultUsage(usage);
        const email = String(usage?.onedriveEmail || '').trim();
        if (!cancelled && usage?.storageType === 'onedrive' && email) {
          try {
            await rememberPhotoAlbumsOneDriveEmail(email);
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
    const timer = setInterval(() => void loadUsage(), 15000);
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
    }, 400);
  }, []);

  /**
   * Pull the free-tier caps and current image/video counts from the vault.
   * Called at the start of every batch so counts reflect other tabs/devices.
   */
  const refreshMediaQuota = useCallback(async () => {
    try {
      const quota = await vaultApi.fetchPhotoAlbumsMediaQuota?.();
      if (quota) {
        mediaQuotaRef.current = { ...mediaQuotaRef.current, ...quota };
      }
    } catch (err) {
      console.warn('[photoAlbums] media quota fetch failed', err);
    }
    return mediaQuotaRef.current;
  }, [vaultApi]);

  /**
   * Take one image/video slot from the free-tier allowance, or refuse the upload
   * with the VIP upgrade popup. Reserving up front keeps a single batch from
   * blowing past the cap before the server sees any of it.
   */
  const reserveMediaQuotaSlot = useCallback(
    async (isVideo) => {
      const quota = mediaQuotaRef.current;
      const used = isVideo ? quota.videoCount : quota.imageCount;
      const maxAllowed = isVideo ? quota.maxVideosPerAccount : quota.maxImagesPerAccount;
      if (used >= maxAllowed) {
        const message = tutaPhotoQuotaExceededMessage(quota);
        stagingFailureRef.current = message;
        if (!quotaPopupShownRef.current) {
          quotaPopupShownRef.current = true;
          await themedAlert(message, { title: 'Free Tier Limit Reached' });
        }
        return false;
      }
      if (isVideo) quota.videoCount = used + 1;
      else quota.imageCount = used + 1;
      return true;
    },
    []
  );

  const releaseMediaQuotaSlot = useCallback((isVideo) => {
    const quota = mediaQuotaRef.current;
    if (isVideo) quota.videoCount = Math.max(0, quota.videoCount - 1);
    else quota.imageCount = Math.max(0, quota.imageCount - 1);
  }, []);

  /** One "we are downsizing" popup per batch, awaited so the user reads it. */
  const announceDownsizeOnce = useCallback(async (originalBytes) => {
    if (downsizeNoticeShownRef.current) return;
    downsizeNoticeShownRef.current = true;
    await themedAlert(tutaPhotoDownsizeMessage(originalBytes, mediaQuotaRef.current), {
      title: 'Downsizing Upload'
    });
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
    setVaultLeavingProgressLabel('Locking templates…');
    try {
      const { runPhotoAlbumsLeavePrepare } = await import('utils/photoAlbumsLeavePrepare');
      await runPhotoAlbumsLeavePrepare();
    } catch (err) {
      console.error('[performVaultStorageLogoff] prepare', err?.message || err);
    }
    setVaultLeavingProgressPercent(2);
    setVaultLeavingProgressLabel(
      paneStorageType === 'onedrive' ? 'Saving notes to OneDrive…' : 'Logging off USB…'
    );
    await vaultApi.logoffPhotoAlbumsStorage({
      onProgress: (progress) => {
        void reportVaultLeavingProgress(progress);
      }
    });
    setVaultLeavingProgressPercent(100);
    setVaultLeavingProgressLabel('Done');
    setPhotoAlbumsBridgeStorageType(null);
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
        setError(readPhotoAlbumsApiError(err, 'Logoff failed'));
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

  const refreshSharedAlbums = useCallback(async () => {
    if (!user?.singles_id) {
      setSharedAlbums([]);
      return;
    }
    try {
      const list = await fetchPhotoAlbumsSharedAlbums();
      setSharedAlbums(list);
    } catch {
      setSharedAlbums([]);
    }
  }, [user?.singles_id]);

  useEffect(() => {
    if (!user?.singles_id) {
      setSharedAlbums([]);
      return;
    }
    void refreshSharedAlbums();
  }, [user?.singles_id, refreshSharedAlbums]);

  useEffect(() => {
    setOrderAlbumItems(loadOrderAlbumItems(paneStorageType, user?.singles_id));
    setOrderAlbumName(loadOrderAlbumName(paneStorageType, user?.singles_id));
  }, [paneStorageType, user?.singles_id]);

  const persistOrderAlbumItems = useCallback(
    (next) => {
      const list = Array.isArray(next) ? next : [];
      setOrderAlbumItems(list);
      saveOrderAlbumItems(paneStorageType, user?.singles_id, list);
    },
    [paneStorageType, user?.singles_id]
  );

  const persistOrderAlbumName = useCallback(
    (next) => {
      const saved = saveOrderAlbumName(paneStorageType, user?.singles_id, next);
      setOrderAlbumName(saved);
    },
    [paneStorageType, user?.singles_id]
  );

  /** One filmstrip thumb per openable ForOrder item — count must match (N). */
  const orderFilmstripEntries = useMemo(() => {
    const out = [];
    (orderAlbumItems || []).forEach((item, idx) => {
      const sourceKey = String(item.id || `order-${idx}`);
      const emptyModel = {
        key: sourceKey,
        slots: [],
        photos: []
      };
      if (item.kind === 'page') {
        const noteId = Number(item.noteId);
        if (!Number.isFinite(noteId) || noteId < 1) return;
        out.push({
          model: item.filmstripModel || emptyModel,
          noteId,
          pageIndex: Math.max(0, Math.round(Number(item.pageIndex) || 0)),
          pageKey: item.pageKey || item.filmstripModel?.key || null,
          orientation: item.orientation || 'portrait',
          sourceKey
        });
        return;
      }
      if (item.kind === 'album') {
        const noteId = Number(item.noteId);
        if (!Number.isFinite(noteId) || noteId < 1) return;
        out.push({
          model: item.filmstripModel || emptyModel,
          noteId,
          pageIndex: 0,
          pageKey: item.pageKey || null,
          orientation: item.orientation || 'portrait',
          sourceKey
        });
        return;
      }
      if (item.kind === 'shortcut') {
        const shortcut = shortcuts.find((s) => Number(s.shortcut_id) === Number(item.shortcutId));
        const noteId = Number(shortcut?.note_id);
        if (!Number.isFinite(noteId) || noteId < 1) return;
        out.push({
          model: emptyModel,
          noteId,
          pageIndex: 0,
          pageKey: null,
          orientation: 'portrait',
          sourceKey
        });
        return;
      }
      if (item.kind === 'albumSet') {
        const nb = notebooks.find((n) => Number(n.notebook_id) === Number(item.notebookId));
        const noteId = Number(nb?.notes?.[0]?.note_id);
        if (!Number.isFinite(noteId) || noteId < 1) return;
        out.push({
          model: emptyModel,
          noteId,
          pageIndex: 0,
          pageKey: null,
          orientation: 'portrait',
          sourceKey
        });
      }
    });
    return out;
  }, [orderAlbumItems, shortcuts, notebooks]);

  /** First openable page/album/shortcut/set in the ForOrder queue. */
  const resolveOrderAlbumOpenTarget = useCallback(() => {
    for (let i = 0; i < orderAlbumItems.length; i += 1) {
      const item = orderAlbumItems[i];
      if (item.kind === 'page') {
        const noteId = Number(item.noteId);
        if (Number.isFinite(noteId) && noteId > 0) {
          return {
            noteId,
            pageIndex: Math.max(0, Math.round(Number(item.pageIndex) || 0)),
            pageKey: item.pageKey || item.filmstripModel?.key || null,
            orderIndex: i
          };
        }
      }
      if (item.kind === 'album') {
        const noteId = Number(item.noteId);
        if (Number.isFinite(noteId) && noteId > 0) {
          return { noteId, pageIndex: 0, pageKey: item.pageKey || null, orderIndex: i };
        }
      }
      if (item.kind === 'shortcut') {
        const shortcut = shortcuts.find((s) => Number(s.shortcut_id) === Number(item.shortcutId));
        const noteId = Number(shortcut?.note_id);
        if (Number.isFinite(noteId) && noteId > 0) {
          return { noteId, pageIndex: 0, pageKey: null, orderIndex: i };
        }
      }
      if (item.kind === 'albumSet') {
        const nb = notebooks.find((n) => Number(n.notebook_id) === Number(item.notebookId));
        const noteId = Number(nb?.notes?.[0]?.note_id);
        if (Number.isFinite(noteId) && noteId > 0) {
          return { noteId, pageIndex: 0, pageKey: null, orderIndex: i };
        }
      }
    }
    return null;
  }, [orderAlbumItems, shortcuts, notebooks]);

  const navigateToOrderEntry = useCallback(
    (entry, orderIndex) => {
      if (!entry) return;
      const noteId = Number(entry.noteId);
      const pageIndex = Math.max(0, Math.round(Number(entry.pageIndex) || 0));
      const pageKey = entry.pageKey ? String(entry.pageKey) : null;
      if (!Number.isFinite(noteId) || noteId < 1) return;
      const { notebook } = findNoteRowById(noteId);
      if (!notebook) {
        setError('That ordered album is no longer in this vault.');
        return;
      }
      setOrderAlbumActive(true);
      setOrderFilmstripIndex(Math.max(0, orderIndex));
      setOrderAlbumViewOpen(false);
      setSelectedNotebookId(Number(notebook.notebook_id));
      pendingOrderPageRef.current = { noteId, pageIndex, pageKey };
      const jumpToOrderedPage = () => {
        const api = noteEditorApiRef.current;
        if (pageKey && api?.goToAlbumPageByKey?.(pageKey, { skipTrafficGate: true })) {
          pendingOrderPageRef.current = null;
          return;
        }
        api?.goToAlbumPage?.(pageIndex, { skipTrafficGate: true });
        pendingOrderPageRef.current = null;
      };
      if (Number(selectedNoteIdRef.current) === noteId) {
        requestAnimationFrame(jumpToOrderedPage);
        return;
      }
      selectNoteId(noteId);
    },
    [findNoteRowById, selectNoteId]
  );

  /**
   * Click ForOrder → exclusive selection + show N ordered pages in filmstrip.
   * Double-click still opens the queue manager.
   */
  const handleOpenOrderAlbumPages = useCallback(() => {
    const label = orderAlbumName || DEFAULT_ORDER_ALBUM_NAME;
    if (!orderAlbumItems.length) {
      setError(`${label} is empty. Use Order Print or Add Order Album to add pages.`);
      return;
    }
    setOrderAlbumActive(true);
    setOrderAlbumViewOpen(false);
    const entries = orderFilmstripEntries;
    if (entries.length) {
      navigateToOrderEntry(entries[0], 0);
      return;
    }
    const target = resolveOrderAlbumOpenTarget();
    if (!target) {
      setError(`No openable page in ${label} yet.`);
      return;
    }
    const { notebook } = findNoteRowById(target.noteId);
    if (!notebook) {
      setError('That ordered album is no longer in this vault.');
      return;
    }
    setOrderFilmstripIndex(Math.max(0, target.orderIndex || 0));
    setSelectedNotebookId(Number(notebook.notebook_id));
    pendingOrderPageRef.current = {
      noteId: target.noteId,
      pageIndex: target.pageIndex,
      pageKey: target.pageKey || null
    };
    if (Number(selectedNoteIdRef.current) === target.noteId) {
      requestAnimationFrame(() => {
        const api = noteEditorApiRef.current;
        if (
          target.pageKey &&
          api?.goToAlbumPageByKey?.(target.pageKey, { skipTrafficGate: true })
        ) {
          pendingOrderPageRef.current = null;
          return;
        }
        api?.goToAlbumPage?.(target.pageIndex, { skipTrafficGate: true });
        pendingOrderPageRef.current = null;
      });
      return;
    }
    selectNoteId(target.noteId);
  }, [
    orderAlbumItems.length,
    orderAlbumName,
    orderFilmstripEntries,
    navigateToOrderEntry,
    resolveOrderAlbumOpenTarget,
    findNoteRowById,
    selectNoteId
  ]);

  // After ForOrder opens a note, flip to the queued page once body is in the editor.
  useEffect(() => {
    const pending = pendingOrderPageRef.current;
    if (!pending) return;
    if (Number(selectedNoteId) !== Number(pending.noteId)) return;
    if (!selectedNote?.content_loaded) return;
    const api = noteEditorApiRef.current;
    if (!api?.goToAlbumPage && !api?.goToAlbumPageByKey) return;
    const pageIndex = pending.pageIndex;
    const pageKey = pending.pageKey;
    pendingOrderPageRef.current = null;
    requestAnimationFrame(() => {
      if (pageKey && api.goToAlbumPageByKey?.(pageKey, { skipTrafficGate: true })) return;
      api.goToAlbumPage?.(pageIndex, { skipTrafficGate: true });
    });
  }, [selectedNoteId, selectedNote?.content_loaded, editorReadyTick]);

  const openSharedAlbum = useCallback(async (sharedAlbumId) => {
    const id = Number(sharedAlbumId);
    if (!Number.isFinite(id) || id < 1) return;
    setSelectedSharedAlbumId(id);
    setSharedAlbumLoading(true);
    setError('');
    try {
      const album = await fetchPhotoAlbumsSharedAlbumContent(id);
      if (!album?.html) {
        throw new Error('Shared album is empty');
      }
      setSharedAlbumView(album);
      editorHydratedRef.current.key = '';
    } catch (err) {
      setSharedAlbumView(null);
      setError(readPhotoAlbumsInviteError(err, 'Failed to load shared album'));
    } finally {
      setSharedAlbumLoading(false);
    }
  }, []);

  /** Hide from Shared Album list (recipient copy only — owner's album is untouched). */
  const handleRemoveSharedAlbum = useCallback(
    async (sharedAlbumId, displayLabel) => {
      const id = Number(sharedAlbumId);
      if (!Number.isFinite(id) || id < 1 || busy) return;
      const label = String(displayLabel || 'this shared album').trim() || 'this shared album';
      if (
        !(await themedConfirm(
          `Remove “${label}” from Shared Album?\n\nThis only hides it from your list. The owner’s album is not deleted.`
        ))
      ) {
        return;
      }
      setBusy(true);
      setError('');
      try {
        await removePhotoAlbumsSharedAlbum(id);
        setSharedAlbums((prev) =>
          (Array.isArray(prev) ? prev : []).filter((row) => Number(row.sharedAlbumId) !== id)
        );
        if (Number(selectedSharedAlbumId) === id) {
          setSelectedSharedAlbumId(null);
          setSharedAlbumView(null);
        }
      } catch (err) {
        setError(readPhotoAlbumsInviteError(err, 'Failed to remove shared album'));
      } finally {
        setBusy(false);
      }
    },
    [busy, selectedSharedAlbumId]
  );

  const activeAlbumSetName =
    selectedNotebook && !sharedAlbumView
      ? photoAlbumsNotebookSidebarLabel(selectedNotebook, notebooks)
      : '';
  const activeAlbumName = sharedAlbumView
    ? String(sharedAlbumView.displayLabel || sharedAlbumView.albumName || '').trim()
    : selectedNote
      ? openNoteTitlePlain ||
        photoAlbumsNoteSidebarLabel(selectedNote, selectedNotebook?.notes || [], notebooks)
      : '';

  const handleAddCurrentPageToOrderAlbum = useCallback(async () => {
    const noteId = Number(selectedNoteId);
    if (!Number.isFinite(noteId) || noteId < 1) {
      setError('Open an album page first, then use Order Print or Add Order Album.');
      return;
    }
    const api = noteEditorApiRef.current;
    const pageIndex = Number(api?.getAlbumPageIndex?.() ?? 0) || 0;
    const pageCount = Number(api?.getAlbumPageCount?.() ?? 0) || 0;
    if (pageCount < 1) {
      setError('Add a Template to the page before adding it to For Order.');
      return;
    }
    const snapshot = api?.snapshotAlbumPage?.(pageIndex);
    if (!snapshot) {
      setError('Could not capture this album page for For Order.');
      return;
    }
    const film = api?.getFilmstripModelForPage?.(pageIndex);
    const noteName =
      openNoteTitlePlain ||
      photoAlbumsNoteSidebarLabel(selectedNote, selectedNotebook?.notes || [], notebooks) ||
      'Album';
    const pageKey =
      snapshot?.template?.key != null
        ? String(snapshot.template.key)
        : film?.pageKey || film?.model?.key || null;
    const item = {
      id: newOrderAlbumItemId(),
      kind: 'page',
      noteId,
      noteName: String(noteName).trim() || 'Album',
      albumSetName: activeAlbumSetName || '',
      pageIndex,
      pageKey,
      photoCount: Array.isArray(snapshot.photos) ? snapshot.photos.length : 0,
      filmstripModel: film?.model || null,
      orientation: film?.orientation || snapshot.orientation || 'portrait',
      pageWidth: film?.pageWidth || snapshot.pageWidth || null,
      addedAt: Date.now()
    };
    persistOrderAlbumItems([item, ...orderAlbumItems]);
    await themedAlert(
      `Added “${item.noteName}” page ${pageIndex + 1} to ${orderAlbumName || DEFAULT_ORDER_ALBUM_NAME} (${orderAlbumItems.length + 1} item${
        orderAlbumItems.length ? 's' : ''
      }).`
    );
  }, [
    selectedNoteId,
    selectedNote,
    selectedNotebook,
    notebooks,
    openNoteTitlePlain,
    activeAlbumSetName,
    orderAlbumName,
    orderAlbumItems,
    persistOrderAlbumItems
  ]);

  const handleOrderAlbumDrop = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      setOrderAlbumDropActive(false);
      const types = event.dataTransfer?.types ? Array.from(event.dataTransfer.types) : [];
      const next = [...orderAlbumItems];
      let added = 0;

      if (types.includes(DRAG_SHORTCUT)) {
        const raw = event.dataTransfer.getData(DRAG_SHORTCUT);
        const shortcutId = Number(raw);
        const shortcut = shortcuts.find((s) => Number(s.shortcut_id) === shortcutId);
        if (shortcut) {
          next.unshift({
            id: newOrderAlbumItemId(),
            kind: 'shortcut',
            shortcutId,
            label: String(shortcut.label || 'Shortcut').trim() || 'Shortcut',
            addedAt: Date.now()
          });
          added += 1;
        }
      } else if (types.includes(DRAG_NOTEBOOK)) {
        const raw = event.dataTransfer.getData(DRAG_NOTEBOOK);
        const notebookId = Number(raw);
        const nb = notebooks.find((n) => Number(n.notebook_id) === notebookId);
        if (nb) {
          next.unshift({
            id: newOrderAlbumItemId(),
            kind: 'albumSet',
            notebookId,
            notebookName: photoAlbumsNotebookSidebarLabel(nb, notebooks) || 'Album-Set',
            addedAt: Date.now()
          });
          added += 1;
        }
      } else if (types.includes(DRAG_NOTE) || types.includes(DRAG_NOTE_IDS)) {
        let ids = [];
        try {
          const multi = event.dataTransfer.getData(DRAG_NOTE_IDS);
          if (multi) {
            const parsed = JSON.parse(multi);
            if (Array.isArray(parsed)) ids = parsed.map(Number).filter((n) => n > 0);
          }
        } catch {
          ids = [];
        }
        if (!ids.length) {
          const one = Number(event.dataTransfer.getData(DRAG_NOTE));
          if (Number.isFinite(one) && one > 0) ids = [one];
        }
        for (const noteId of ids) {
          const row = findNoteRowById(noteId).note;
          if (!row) continue;
          next.unshift({
            id: newOrderAlbumItemId(),
            kind: 'album',
            noteId,
            noteName:
              photoAlbumsNoteSidebarLabel(row, selectedNotebook?.notes || notes, notebooks) ||
              'Album',
            albumSetName:
              photoAlbumsNotebookSidebarLabel(
                notebooks.find((n) => Number(n.notebook_id) === Number(row.notebook_id)),
                notebooks
              ) || '',
            addedAt: Date.now()
          });
          added += 1;
        }
      }

      if (!added) {
        setError('Drop an album, album-set, or shortcut onto For Order.');
        return;
      }
      persistOrderAlbumItems(next);
    },
    [
      orderAlbumItems,
      shortcuts,
      notebooks,
      notes,
      selectedNotebook,
      findNoteRowById,
      persistOrderAlbumItems
    ]
  );

  useEffect(() => {
    if (!selectedNotebook) {
      setSelectedNoteId(null);
      return;
    }
    const notes = selectedNotebook.notes || [];
    if (!notes.length) {
      setSelectedNoteId(null);
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
      await vaultApi.updatePhotoAlbumsNote(noteId, { body_text: html });
      patchNoteRowInTree(noteId, { body_text: html, content_loaded: true });
      indexNoteSearchText(noteId, stripPhotoAlbumsHtml(html), noteName);
    } catch (err) {
      setError(readPhotoAlbumsApiError(err, 'Failed to save note'));
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

  // Before Log off USB/Cloud, Exit to Mall, or site logout: flush note.
  useEffect(() => {
    return registerPhotoAlbumsLeavePrepare(async () => {
      await persistNoteRef.current?.();
    });
  }, []);

  /**
   * Upload one dropped file to the selected note and embed it inline in the note
   * body at the drop location (instead of a separate list). The file bytes live
   * server-side keyed by the returned attachment id; the note body only keeps a
   * lightweight reference node.
   */
  const uploadNoteVaultFile = useCallback(
    async (inputFile, coords) => {
      let file = inputFile;
      if (!selectedNote || !file || busy) return;
      const noteId = Number(selectedNote.note_id);
      if (!isAllowedPhotoAlbumsFile(file)) {
        setError(`Unsupported vault file type: ${file.name || 'file'}`);
        return;
      }
      const isVideoFile = isPhotoAlbumsStagingVideoFile(file);
      quotaPopupShownRef.current = false;
      downsizeNoticeShownRef.current = false;
      await refreshMediaQuota();
      if (!(await reserveMediaQuotaSlot(isVideoFile))) return;

      const quota = mediaQuotaRef.current;
      const limitMb = isVideoFile ? quota.videoMaxMb : quota.imageMaxMb;
      if (file.size > limitMb * 1024 * 1024) {
        if (isVideoFile || !isPhotoAlbumsStagingPhotoFile(file)) {
          releaseMediaQuotaSlot(isVideoFile);
          setError(TUTAPHOTO_DOWNSIZE_FAILED_MESSAGE);
          return;
        }
        await announceDownsizeOnce(file.size);
        const smaller = await downsizeImageFileToMaxMb(file, limitMb);
        if (!smaller) {
          releaseMediaQuotaSlot(isVideoFile);
          setError(TUTAPHOTO_DOWNSIZE_FAILED_MESSAGE);
          return;
        }
        file = smaller;
      }
      setBusy(true);
      setError('');
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const attachment = await vaultApi.uploadPhotoAlbumsNoteAttachment(noteId, {
          file: dataUrl,
          file_name: photoAlbumsUploadFileName(file),
          source_taken_at_ms: photoAlbumsSourceTakenAtMs(file)
        });
        if (attachment) {
          const fresh = await loadNoteContent(noteId);
          if (!attachment.duplicate) {
            noteEditorApiRef.current?.insertAttachmentAtCoords?.(
              {
                attachmentId: Number(attachment.attachment_id),
                fileName: attachment.file_name || '',
                fileExtension: attachment.file_extension || '',
                fileSizeBytes: attachment.file_size_bytes ?? null,
                checksum: attachment.checksum || null,
                albumPhotoSeq:
                  attachment.album_photo_seq != null ? Number(attachment.album_photo_seq) : null
              },
              coords
            );
          }
          noteEditorApiRef.current?.syncStagingAlleyFromAttachments?.(
            fresh?.attachments || selectedNote.attachments || []
          );
        }
      } catch (err) {
        setError(readPhotoAlbumsApiError(err, `Failed to upload ${file.name || 'file'}`));
      } finally {
        setBusy(false);
        bumpVaultUsage();
      }
    },
    [
      selectedNote,
      busy,
      vaultApi,
      bumpVaultUsage,
      loadNoteContent,
      refreshMediaQuota,
      reserveMediaQuotaSlot,
      releaseMediaQuotaSlot,
      announceDownsizeOnce
    ]
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
        await vaultApi.deletePhotoAlbumsNoteAttachment(noteId, id);
        setNotebooks((prev) =>
          prev.map((nb) => ({
            ...nb,
            notes: (nb.notes || []).map((note) => {
              if (Number(note.note_id) !== noteId) return note;
              const attachments = (note.attachments || []).filter(
                (entry) => Number(entry.attachment_id) !== id
              );
              return {
                ...note,
                attachments,
                album_media_count: countPhotoAlbumsSidebarMediaInAttachments(attachments)
              };
            })
          }))
        );
        return true;
      } catch (err) {
        setError(readPhotoAlbumsApiError(err, 'Failed to remove vault file'));
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

  /** Phone QR upload (photo_albums) → UPLOAD_FOLDER; switch to Mobile Upload tab (no note insert). */
  const handleMobilePhoneUploadComplete = useCallback(async (_fileNameOrId, meta = {}) => {
    setMobileUploadOpen(false);
    setFilesSidebarTab(FILES_EXPLORER_TAB_MOBILE_UPLOAD);
    writeFilesExplorerTab(FILES_EXPLORER_TAB_MOBILE_UPLOAD);
    setMobileUploadFolderRefreshToken((n) => n + 1);
    if (meta?.purpose === 'photo_albums' || meta?.fileName) {
      // Soft status — avoid red error styling
      setError('');
    }
  }, []);

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
    const staged = new Set(
      (api.getStagedAttachmentIds?.() || []).map((id) => String(id))
    );
    const missing = atts.filter((a) => {
      const id = String(a.attachment_id);
      return !present.has(id) && !staged.has(id);
    });
    if (!missing.length) return;
    api.appendAttachments(
      missing.map((a) => ({
        attachmentId: Number(a.attachment_id),
        fileName: a.file_name || '',
        fileExtension: a.file_extension || '',
        fileSizeBytes: a.file_size_bytes ?? null,
        checksum: a.checksum || null
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
      const cleaned = cleanPhotoAlbumsNoteBodyHtml(html || '<p></p>', titlePlain);
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
        void vaultApi.updatePhotoAlbumsNote(noteId, { note_name: importedTitle }).catch(() => {
          // Body import still succeeded; title can be fixed manually if rename fails.
        });
      }
      const titleForStrip =
        importedTitle ||
        String(draftRef.current?.openNoteTitlePlain || openNoteTitlePlain || '').trim() ||
        noteTitlePlainText(selectedNote?.note_name);
      const afterMd = api.getHTML?.() || '';
      const cleaned = cleanPhotoAlbumsNoteBodyHtml(afterMd, titleForStrip);
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
            bodyHtml = cleanPhotoAlbumsNoteBodyHtml(bodyHtml || '<p></p>', noteName);
            const created = await vaultApi.createPhotoAlbumsNote(selectedNotebookId, {
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
              `${fileLabel}: ${readPhotoAlbumsApiError(err, 'import failed')}`
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
   * Upload a file into the note's vault attachment list and stage it in the
   * top-bar tray (does not place it on the page until the user drops it).
   * Do not gate on `busy` — multi-file drops must queue, not silently skip.
   */
  const uploadNoteVaultFileToStaging = useCallback(
    async (inputFile, { skipBusy = false, skipReconcile = false } = {}) => {
      let file = inputFile;
      let reservedVideoSlot = null;
      const failStaging = (message) => {
        if (reservedVideoSlot !== null) releaseMediaQuotaSlot(reservedVideoSlot);
        reservedVideoSlot = null;
        stagingFailureRef.current = message;
        setError(message);
        return false;
      };
      if (!file) return false;
      if (!selectedNote) {
        return failStaging('Select an album on the left before adding photos to the Thumbnail Tray.');
      }
      const noteId = Number(selectedNote.note_id);
      if (!isAllowedPhotoAlbumsFile(file)) {
        return failStaging(`Unsupported vault file type: ${file.name || 'file'}`);
      }
      const isVideoFile = isPhotoAlbumsStagingVideoFile(file);

      if (!(await reserveMediaQuotaSlot(isVideoFile))) return false;
      reservedVideoSlot = isVideoFile;

      const quota = mediaQuotaRef.current;
      const limitMb = isVideoFile ? quota.videoMaxMb : quota.imageMaxMb;
      if (file.size > limitMb * 1024 * 1024) {
        // Videos cannot be transcoded in the browser, so oversized ones go
        // straight to the "resize externally" message.
        if (isVideoFile || !isPhotoAlbumsStagingPhotoFile(file)) {
          return failStaging(TUTAPHOTO_DOWNSIZE_FAILED_MESSAGE);
        }
        await announceDownsizeOnce(file.size);
        const smaller = await downsizeImageFileToMaxMb(file, limitMb);
        if (!smaller) return failStaging(TUTAPHOTO_DOWNSIZE_FAILED_MESSAGE);
        file = smaller;
      }

      if (isPhotoAlbumsStagingPhotoFile(file) && !isVideoFile) {
        const readable = await probePhotoAlbumsImageFile(file);
        if (!readable) {
          if (isMacOsMetadataFileName(file.name)) {
            return failStaging(
              `“${file.name}” is macOS metadata (._ sidecar), not a photo. Choose the file without the ._ prefix (e.g. hike2.jpg).`
            );
          }
          return failStaging(`“${file.name || 'file'}” is not a readable photo image.`);
        }
      }

      const fileExt = resolvePhotoAlbumsFileExtension(file);
      let localPreviewUrl = '';
      if (!photoAlbumsStagingPhotoPrefersServerThumb(fileExt)) {
        localPreviewUrl = createPhotoStagingPreviewObjectUrl(file, file.name || '');
      }

      if (!skipBusy) setBusy(true);
      setError('');
      try {
        const dataUrl = await readFileAsDataUrl(file);
        if (!dataUrl || !String(dataUrl).startsWith('data:')) {
          throw new Error(`Could not read “${file.name || 'file'}” for upload`);
        }
        const attachment = await vaultApi.uploadPhotoAlbumsNoteAttachment(noteId, {
          file: dataUrl,
          file_name: photoAlbumsUploadFileName(file),
          source_taken_at_ms: photoAlbumsSourceTakenAtMs(file)
        });
        if (attachment) {
          const attachmentId = Number(attachment.attachment_id);
          if (Number.isFinite(attachmentId) && attachmentId > 0) {
            const previewUrl =
              localPreviewUrl ||
              primeStagingAttachmentPreview(attachmentId, file, file.name || '') ||
              '';
            if (previewUrl) localPreviewUrl = previewUrl;
          }
          const ext = String(attachment.file_extension || '').toLowerCase();
          const isTrayMedia =
            isPhotoAlbumsStagingAlbumMediaFile({
              name: attachment.file_name || file.name,
              type: file.type
            }) || isPhotoAlbumsStagingAlbumMediaFile({ name: `x.${ext}` });
          if (isTrayMedia && Number.isFinite(attachmentId) && attachmentId > 0) {
            const seqFromUpload =
              attachment.album_photo_seq != null ? Number(attachment.album_photo_seq) : null;
            noteEditorApiRef.current?.addStagedAttachment?.(
              mergeStagingItemPreview({
                attachmentId,
                fileName: attachment.file_name || '',
                fileExtension: attachment.file_extension || '',
                fileSizeBytes: attachment.file_size_bytes ?? null,
                checksum: attachment.checksum || null,
                albumPhotoSeq:
                  Number.isFinite(seqFromUpload) && seqFromUpload >= 1 ? seqFromUpload : null,
                ...(localPreviewUrl ? { localPreviewUrl } : null)
              })
            );
          }
          const fresh = await loadNoteContent(noteId, { syncStaging: !skipReconcile });
          if (!skipReconcile) {
            const attachmentsAfter =
              typeof vaultApi.reconcilePhotoAlbumsAlbumPhotoSeq === 'function'
                ? await vaultApi.reconcilePhotoAlbumsAlbumPhotoSeq(noteId)
                : fresh?.attachments || selectedNote.attachments || [];
            noteEditorApiRef.current?.syncStagingAlleyFromAttachments?.(attachmentsAfter);
          }
          return true;
        } else if (localPreviewUrl) {
          try {
            URL.revokeObjectURL(localPreviewUrl);
          } catch {
            // ignore
          }
        }
      } catch (err) {
        if (localPreviewUrl) {
          try {
            URL.revokeObjectURL(localPreviewUrl);
          } catch {
            // ignore
          }
        }
        return failStaging(
          readPhotoAlbumsApiError(err, `Failed to upload ${file.name || 'file'}`)
        );
      } finally {
        if (!skipBusy) setBusy(false);
        bumpVaultUsage();
      }
      return failStaging(`Vault did not accept “${file.name || 'file'}”.`);
    },
    [
      selectedNote,
      vaultApi,
      bumpVaultUsage,
      loadNoteContent,
      reserveMediaQuotaSlot,
      releaseMediaQuotaSlot,
      announceDownsizeOnce
    ]
  );

  /**
   * Drag files onto the editor / staging tray → vault attachments land in the
   * top-bar tray. Drag tray thumbnails onto template slots to place them.
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

      const attachFiles = files.filter((file) => isAllowedPhotoAlbumsFile(file));
      const markdownOnly = files.filter((file) => classifyNoteImportDropFile(file) === 'md');
      // Onto the album workspace: prefer photo-tray types so they preview in slots.
      const stageMedia = attachFiles.filter((file) => isPhotoAlbumsStagingAlbumMediaFile(file));
      const otherVault = attachFiles.filter((file) => !isPhotoAlbumsStagingAlbumMediaFile(file));

      if (!attachFiles.length) {
        if (markdownOnly.length) {
          setError('Drop Markdown onto the Notes list to import as a new note (or use File → Import).');
        } else {
          setError(`Unsupported vault file type: ${files[0]?.name || 'file'}`);
        }
        return;
      }

      for (const file of stageMedia.length ? stageMedia : attachFiles) {
        // eslint-disable-next-line no-await-in-loop
        await uploadNoteVaultFileToStaging(file);
      }

      if (stageMedia.length && otherVault.length) {
        setError(
          `Staged ${stageMedia.length} photo/video file(s). ${otherVault.length} other vault file(s) were not added to the photo tray (preview not supported).`
        );
      } else if (markdownOnly.length) {
        setError('Staged supported files. Drop Markdown onto the Notes list to import as a new note.');
      }
    },
    [
      selectedNote,
      busy,
      uploadNoteVaultFileToStaging,
      noteHasInnerEncryption,
      isInnerNoteUnlocked,
      classifyNoteImportDropFile
    ]
  );

  const handleStageOsFiles = useCallback(
    async (files) => {
      if (!selectedNote) {
        setError('Select an album on the left before adding photos to the Thumbnail Tray.');
        return;
      }
      const list = Array.isArray(files) ? files : [];
      const photoFiles = sortPhotoAlbumsFilesBySourceTakenAt(
        list.filter((file) => isPhotoAlbumsStagingAlbumMediaFile(file))
      );
      const rejected = list.filter((file) => !isPhotoAlbumsStagingAlbumMediaFile(file));
      if (!photoFiles.length) {
        const name = rejected[0]?.name || 'file';
        if (isMacOsMetadataFileName(name)) {
          setError(
            `“${name}” is macOS metadata (._ sidecar), not a photo. Drag the matching file without ._ (e.g. hike2.jpg).`
          );
        } else {
          setError(
            `Cannot preview “${name}” in the photo tray. Supported album media: PNG, JPEG, SVG, WebP, GIF, AVIF, ICO, BMP, TIFF, APNG, HEIC/HEIF; videos MP4, MOV, WebM, MKV, AVI, WMV, MTS/M2TS.`
          );
        }
        return;
      }
      const total = photoFiles.length;
      setBatchUploadProgress({
        label: `Adding to Thumbnail Tray (0 of ${total})`,
        percent: 0
      });
      stagingFailureRef.current = '';
      quotaPopupShownRef.current = false;
      downsizeNoticeShownRef.current = false;
      await refreshMediaQuota();
      let uploaded = 0;
      try {
        for (let i = 0; i < total; i += 1) {
          setBatchUploadProgress({
            label: `Adding to Thumbnail Tray (${i + 1} of ${total})`,
            percent: Math.round((i / total) * 100)
          });
          // eslint-disable-next-line no-await-in-loop
          const ok = await uploadNoteVaultFileToStaging(photoFiles[i], {
            skipBusy: true,
            skipReconcile: true
          });
          if (ok) uploaded += 1;
        }
        if (total > 0) {
          const noteId = Number(selectedNote.note_id);
          let attachmentsAfter = [];
          try {
            if (typeof vaultApi.reconcilePhotoAlbumsAlbumPhotoSeq === 'function') {
              attachmentsAfter = await vaultApi.reconcilePhotoAlbumsAlbumPhotoSeq(noteId);
            }
          } catch (reconcileErr) {
            console.warn('[handleStageOsFiles] reconcile album seq failed', reconcileErr);
          }
          const fresh = await loadNoteContent(noteId, { syncStaging: false });
          noteEditorApiRef.current?.syncStagingAlleyFromAttachments?.(
            attachmentsAfter.length ? attachmentsAfter : fresh?.attachments || []
          );
        }
        setBatchUploadProgress({
          label: `Adding to Thumbnail Tray (${total} of ${total})`,
          percent: 100
        });
        if (!uploaded) {
          // Show why the upload actually failed instead of a generic "pick an album" hint.
          setError(
            stagingFailureRef.current ||
              'No photos were added to the Thumbnail Tray. Select an album on the left, unlock TutaDrive, then try again.'
          );
        } else if (rejected.length) {
          setError(
            `Staged ${uploaded} photo(s). Skipped ${rejected.length} unsupported preview type(s) (e.g. RAW, PSD, PDF, JXL).`
          );
        }
      } finally {
        setBatchUploadProgress(null);
      }
    },
    [uploadNoteVaultFileToStaging, selectedNote, vaultApi, loadNoteContent, refreshMediaQuota]
  );

  /** Spinning busy while Files Explorer / Mobile Upload reads local files before upload. */
  const handleStageTrayBusyChange = useCallback((open, label) => {
    if (open) {
      setBatchUploadProgress({
        label: label || 'Adding photos to Thumbnail Tray',
        percent: 0
      });
    } else {
      setBatchUploadProgress(null);
    }
  }, []);

  const handleRemoveStagedAttachment = useCallback(
    async (attachmentId) => {
      // Keep server file unless user removes from tray — delete vault file too.
      await handleDeleteVaultAttachment(attachmentId);
    },
    [handleDeleteVaultAttachment]
  );

  /** Batch-delete every attachment cleared by Remove All on the thumbnail tray. */
  const handleRemoveAllStagedAttachments = useCallback(
    async (attachmentIds) => {
      if (!selectedNote) return;
      const noteId = Number(selectedNote.note_id);
      const ids = [
        ...new Set(
          (Array.isArray(attachmentIds) ? attachmentIds : [])
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id) && id > 0)
        )
      ];
      if (!ids.length) return;
      setBusy(true);
      setError('');
      const deleted = new Set();
      try {
        for (const id of ids) {
          try {
            await vaultApi.deletePhotoAlbumsNoteAttachment(noteId, id);
            deleted.add(id);
          } catch (err) {
            setError(readPhotoAlbumsApiError(err, 'Failed to remove vault file'));
          }
        }
        if (deleted.size) {
          setNotebooks((prev) =>
            prev.map((nb) => ({
              ...nb,
              notes: (nb.notes || []).map((note) =>
                Number(note.note_id) === noteId
                  ? {
                      ...note,
                      attachments: (note.attachments || []).filter(
                        (entry) => !deleted.has(Number(entry.attachment_id))
                      )
                    }
                  : note
              )
            }))
          );
        }
      } finally {
        setBusy(false);
        bumpVaultUsage();
      }
    },
    [selectedNote, vaultApi, bumpVaultUsage]
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

  // Live edits from the Title box: keep the raw value (so spaces can be typed).
  // Do NOT patch note_name in the tree here — that made blur think the name was
  // already saved and skip the API write, so renames reverted after click-around.
  // Sidebar/footer for the open album already follow openNoteTitlePlain live.
  const handleNoteTitleBoxChange = useCallback(
    (rawValue) => {
      if (!selectedNoteId) return;
      const value = String(rawValue ?? '').replace(/[\r\n]+/g, ' ');
      setOpenNoteTitlePlain(value);
      draftRef.current = { ...draftRef.current, openNoteTitlePlain: value };
    },
    [selectedNoteId]
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




  /**
   * Column splitter drag — slider-style: rAF-coalesced live width via DOM
   * (no React re-render / album autofit thrash per mousemove). Commit state on mouseup.
   */
  const startColumnResize = useCallback((mode, event) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startSidebar = sidebarWidth;
    const startNotebookCol = notebookColWidth;
    const startRightSidebar = rightSidebarWidth;
    // Pulling the right-edge grip when the right menu is closed opens it.
    if (mode === 'rightSidebar' && !rightMenuOpen) {
      setRightMenuOpen(true);
      setLeftMenuOpen(true);
    }

    setPhotoAlbumsColumnResizing(true);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    let raf = 0;
    let pendingWidth = null;
    let latestWidth =
      mode === 'sidebar' ? startSidebar : mode === 'notebookCol' ? startNotebookCol : startRightSidebar;
    let shouldCloseRight = false;

    const paintWidth = (width) => {
      if (mode === 'sidebar') {
        const el = leftSidebarPaneRef.current;
        if (el) el.style.width = `${width}px`;
      } else if (mode === 'notebookCol') {
        const el = notebookColPaneRef.current;
        if (el) el.style.width = `${width}px`;
      } else {
        const el = rightSidebarPaneRef.current;
        if (el) el.style.width = `${width}px`;
      }
    };

    const flush = () => {
      raf = 0;
      if (pendingWidth == null) return;
      latestWidth = pendingWidth;
      pendingWidth = null;
      paintWidth(latestWidth);
    };

    const onMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      let next;
      if (mode === 'sidebar') {
        next = clamp(startSidebar + delta, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH);
      } else if (mode === 'notebookCol') {
        next = Math.max(MIN_MENU_COL_WIDTH, startNotebookCol + delta);
      } else {
        next = clamp(startRightSidebar - delta, MIN_RIGHT_SIDEBAR_WIDTH, MAX_RIGHT_SIDEBAR_WIDTH);
        shouldCloseRight = delta > 72 && next <= MIN_RIGHT_SIDEBAR_WIDTH + 4;
      }
      pendingWidth = next;
      if (!raf) raf = requestAnimationFrame(flush);
    };

    const onUp = () => {
      cancelAnimationFrame(raf);
      if (pendingWidth != null) {
        latestWidth = pendingWidth;
        pendingWidth = null;
        paintWidth(latestWidth);
      }
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.removeProperty('user-select');
      document.body.style.removeProperty('cursor');

      const nextSidebar = mode === 'sidebar' ? latestWidth : sidebarWidth;
      const nextNotebookCol = mode === 'notebookCol' ? latestWidth : notebookColWidth;
      const nextRight = mode === 'rightSidebar' ? latestWidth : rightSidebarWidth;

      if (mode === 'sidebar') {
        setSidebarWidth(latestWidth);
        leftSidebarPaneRef.current?.style.removeProperty('width');
      } else if (mode === 'notebookCol') {
        setNotebookColAutoFit(false);
        setNotebookColWidth(latestWidth);
        notebookColPaneRef.current?.style.removeProperty('width');
      } else {
        setRightSidebarWidth(latestWidth);
        rightSidebarPaneRef.current?.style.removeProperty('width');
        if (shouldCloseRight) setRightMenuOpen(false);
      }

      setPhotoAlbumsColumnResizing(false);

      setShortcutPanePercent((shortcutPercent) => {
        setSharedAlbumPanePercent((sharedPercent) => {
          writeStoredLayout({
            sidebarWidth: nextSidebar,
            notebookColWidth: nextNotebookCol,
            rightSidebarWidth: nextRight,
            shortcutPanePercent: shortcutPercent,
            sharedAlbumPanePercent: sharedPercent
          });
          return sharedPercent;
        });
        return shortcutPercent;
      });
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [notebookColWidth, rightSidebarWidth, sidebarWidth, rightMenuOpen]);

  const rightSidebarSplitRef = useRef(null);

  const startSharedAlbumPaneResize = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    const container = leftSidebarSplitRef.current;
    if (!container) return;

    const onMove = (moveEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.height <= 0) return;
      // Bottom = Shared Album; dragging up grows the shared pane.
      const fromBottom = ((rect.bottom - moveEvent.clientY) / rect.height) * 100;
      setSharedAlbumPanePercent(
        clamp(fromBottom, MIN_SHARED_ALBUM_PANE_PERCENT, MAX_SHARED_ALBUM_PANE_PERCENT)
      );
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
              setSharedAlbumPanePercent((sharedPercent) => {
                writeStoredLayout({
                  sidebarWidth: w,
                  notebookColWidth: col,
                  rightSidebarWidth: right,
                  shortcutPanePercent: shortcutPercent,
                  sharedAlbumPanePercent: sharedPercent
                });
                return sharedPercent;
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
              setSharedAlbumPanePercent((sharedPercent) => {
                writeStoredLayout({
                  sidebarWidth: w,
                  notebookColWidth: col,
                  rightSidebarWidth: right,
                  shortcutPanePercent: shortcutPercent,
                  sharedAlbumPanePercent: sharedPercent
                });
                return sharedPercent;
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
          setSharedAlbumPanePercent((sharedPercent) => {
            writeStoredLayout({
              sidebarWidth: sidebar,
              notebookColWidth: fitWidth,
              rightSidebarWidth: right,
              shortcutPanePercent: shortcutPercent,
              sharedAlbumPanePercent: sharedPercent
            });
            return sharedPercent;
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
        const fileName = `${sanitizePhotoAlbumsExportFileName(title)}.html`;
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
      const folderName = sanitizePhotoAlbumsExportFileName(notebookName) || 'Notebook';
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
              photoAlbumsNoteSidebarLabel(note, notes, notebooks) || `Note ${noteId}`
            );
            doneSteps += 1;
            setNotebookExportProgressPercent(Math.max(1, Math.round((doneSteps / totalSteps) * 100)));
            continue;
          }

          let title =
            Number(selectedNoteId) === noteId
              ? String(openNoteTitlePlain || '').trim() ||
                photoAlbumsNoteSidebarLabel(note, notes, notebooks)
              : photoAlbumsNoteSidebarLabel(note, notes, notebooks);
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
                const fresh = await vaultApi.fetchPhotoAlbumsNote(noteId);
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
          let fileName = `${sanitizePhotoAlbumsExportFileName(title)}.html`;
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
            photoAlbumsNoteSidebarLabel(note, siblingNotes, notebooks)
          : photoAlbumsNoteSidebarLabel(note, siblingNotes, notebooks);
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
          .fetchPhotoAlbumsNote(id)
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
                return photoAlbumsNoteSidebarLabel(note, notebook?.notes || [], notebooks);
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
      } else if (mime === DRAG_NOTE) {
        setDraggingNoteId(id);
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
      } else if (mime === DRAG_SHORTCUT) setDraggingShortcutId(id);

      if (mime === DRAG_NOTEBOOK || mime === DRAG_NOTE) {
        let name = '';
        let notebookId = notebookIdForNote != null ? Number(notebookIdForNote) : null;
        if (mime === DRAG_NOTEBOOK) {
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
          kind: mime === DRAG_NOTEBOOK ? 'notebook' : 'note',
          id: Number(id),
          storageType: paneStorageType === 'onedrive' ? 'onedrive' : 'usb',
          name,
          notebookId: Number.isFinite(notebookId) ? notebookId : null,
          noteIds: mime === DRAG_NOTE && draggedNoteIds.length > 1 ? draggedNoteIds : undefined
        };
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
        clearActiveAlbumPageDrag();
        setDraggingAlbumPage(false);
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

  /** Content-pane HTML export drag removed — `draggable` on the album editor
   * dragged the entire binder as a huge translucent ghost. Export from the note list. */

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
        await transferPhotoAlbumsItem({
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
        notifyPhotoAlbumsTreeReload(null);
        await loadTree({
          preferNotebookId: selectedNotebookIdRef.current,
          preferNoteId: selectedNoteIdRef.current,
          silent: true
        });
      } catch (err) {
        if (err?.code === 'DUPLICATE_NAME') {
          setCrossPaneDuplicateError(err.message || 'Duplicate name. Rename and try again');
        } else {
          setError(readPhotoAlbumsApiError(err, 'Transfer failed'));
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
        setError(readPhotoAlbumsApiError(err, 'Failed to reorder'));
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
              `An album named “${movedNote.note_name}” already exists in album-set “${photoAlbumsNotebookSidebarLabel(targetNotebook, notebooks)}”. Rename one first, then move it.`
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
          await vaultApi.movePhotoAlbumsNote(noteId, targetId);
        }
        const focusId = noteIds[noteIds.length - 1];
        setSelectedNotebookId(targetId);
        setSelectedNoteId(focusId);
        replaceMultiSelectedNoteIds([]);
        await loadTree({ preferNotebookId: targetId, preferNoteId: focusId, silent: true });
      } catch (err) {
        setError(readPhotoAlbumsApiError(err, 'Failed to move album'));
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

  const handleAlbumPageDragStart = useCallback(
    (event, meta) => {
      const nid = Number(selectedNoteId);
      const pageIndex = Math.max(0, Math.round(Number(meta?.pageIndex) || 0));
      const pageNumber = Math.max(1, Math.round(Number(meta?.pageNumber) || pageIndex + 1));
      const instanceKey = String(meta?.modelKey || '');
      if (!Number.isFinite(nid) || nid < 1) {
        event.preventDefault();
        return;
      }
      const payload = {
        noteId: nid,
        pageIndex,
        pageNumber,
        instanceKey,
        storageType: paneStorageType === 'onedrive' ? 'onedrive' : 'usb'
      };
      setActiveAlbumPageDrag(payload);
      setDraggingAlbumPage(true);
      try {
        event.dataTransfer.setData(DRAG_ALBUM_PAGE, serializeAlbumPageDrag(payload));
        event.dataTransfer.setData('text/plain', `Album page ${pageNumber}`);
      } catch {
        // Custom MIME may fail in some browsers; module payload still works.
      }
      event.dataTransfer.effectAllowed = 'move';
    },
    [paneStorageType, selectedNoteId]
  );

  const handleAlbumPageDragEnd = useCallback(() => {
    clearActiveAlbumPageDrag();
    setDraggingAlbumPage(false);
    setDropTargetNoteId(null);
  }, []);

  const handleMoveAlbumPageToNote = useCallback(
    async (event, targetNoteId) => {
      event.preventDefault();
      event.stopPropagation();
      const drag = readAlbumPageDrag(event.dataTransfer) || getActiveAlbumPageDrag();
      clearActiveAlbumPageDrag();
      setDraggingAlbumPage(false);
      setDropTargetNoteId(null);

      const targetId = Number(targetNoteId);
      if (!drag || !Number.isFinite(targetId) || targetId < 1 || busy) return;

      const sourceNoteId = Number(drag.noteId);
      if (!Number.isFinite(sourceNoteId) || sourceNoteId < 1) return;
      if (sourceNoteId === targetId) {
        setError('Drop onto a different album to move this page.');
        return;
      }
      if (Number(selectedNoteId) !== sourceNoteId) {
        setError('Open the source album before moving a page.');
        return;
      }

      const targetRow = findNoteRowById(targetId).note;
      if (!targetRow) {
        setError('Target album not found.');
        return;
      }
      if (noteHasInnerEncryption(targetRow)) {
        setError(
          'Cannot move a page into a PIN-protected album yet. Remove the PIN on the target album first (or copy content manually).'
        );
        return;
      }
      if (noteRequiresInnerPinToView(selectedNote) && !isInnerNoteUnlocked(sourceNoteId)) {
        setError('Unlock the current album before moving a page.');
        return;
      }

      const targetLabel =
        photoAlbumsNoteSidebarLabel(targetRow, notes, notebooks) ||
        String(targetRow.note_name || 'album').trim() ||
        'album';
      const pageLabel = `page ${drag.pageNumber}`;
      if (
        !(await themedConfirm(
          `Move ${pageLabel} into album “${targetLabel}”?\n\nThe page will be removed from the current album.`
        ))
      ) {
        return;
      }

      const api = noteEditorApiRef.current;
      const snapshot = api?.snapshotAlbumPage?.(drag.pageIndex);
      if (!snapshot?.template?.id) {
        setError('Could not read that album page.');
        return;
      }

      setBusy(true);
      setError('');
      try {
        await commitAlbumPageMoveToNote({
          snapshot,
          sourceNoteId,
          targetNoteId: targetId,
          storageType: paneStorageType === 'onedrive' ? 'onedrive' : 'usb',
          deleteSourceAttachmentIds: snapshot.attachmentIds || [],
          removeFromSource: () => {
            api?.removeAlbumPage?.(drag.pageIndex);
          }
        });
        // Flush source body after page removal.
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        skipSaveRef.current = false;
        await persistNoteRef.current?.();
      } catch (err) {
        setError(readPhotoAlbumsApiError(err, 'Failed to move album page'));
      } finally {
        setBusy(false);
      }
    },
    [
      busy,
      findNoteRowById,
      isInnerNoteUnlocked,
      noteHasInnerEncryption,
      noteRequiresInnerPinToView,
      notebooks,
      notes,
      paneStorageType,
      selectedNote,
      selectedNoteId
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
        vaultApi.reorderPhotoAlbumsNotebooks(ids)
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
        const created = await vaultApi.createPhotoAlbumsShortcut({
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
        setError(readPhotoAlbumsApiError(err, 'Failed to add shortcut'));
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
        await vaultApi.reorderPhotoAlbumsShortcuts(reordered.map((sc) => sc.shortcut_id));
      } catch (err) {
        setError(readPhotoAlbumsApiError(err, 'Failed to reorder shortcuts'));
        const { shortcuts: loadedShortcuts } = await vaultApi.fetchPhotoAlbumsTree();
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
          if (photoAlbumsNotebookSidebarLabel(nb, notebooks).trim().toLowerCase() === target) return true;
        }
        const notes = nb.notes || [];
        for (const n of notes) {
          if (Number(n.note_id) === Number(excludeNoteId)) continue;
          if (photoAlbumsNoteSidebarLabel(n, notes, notebooks).trim().toLowerCase() === target) {
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
          const createdNb = await vaultApi.createPhotoAlbumsNotebook(notebookName);
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
              bodyHtml = cleanPhotoAlbumsNoteBodyHtml(bodyHtml || '<p></p>', noteName);
              // eslint-disable-next-line no-await-in-loop
              const created = await vaultApi.createPhotoAlbumsNote(notebookId, {
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
                `${fileLabel}: ${readPhotoAlbumsApiError(err, 'import failed')}`
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
        setError(readPhotoAlbumsApiError(err, 'Folder import failed'));
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
    const currentLabel = existing ? photoAlbumsNotebookSidebarLabel(existing, notebooks) : '';
    const currentLabelUpper = String(currentLabel).trim().toUpperCase();
    const storedNameUpper = String(existing?.notebook_name ?? '').trim().toUpperCase();
    const unchanged =
      !trimmed ||
      currentLabelUpper === trimmed ||
      storedNameUpper === trimmed ||
      isDefaultStylePhotoAlbumsNotebookTitle(trimmed);
    if (!existing || unchanged) {
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
      await vaultApi.updatePhotoAlbumsNotebook(notebookId, trimmed);
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
      setError(readPhotoAlbumsApiError(err, 'Failed to rename notebook'));
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
    const startLabelUpper = String(noteRenameStartLabelRef.current || '').trim().toUpperCase();
    const startPersistedUpper = String(noteRenameStartPersistedRef.current || '')
      .trim()
      .toUpperCase();

    // Compare to the name at edit-start only. Live typing can patch the tree, so
    // reading existing.note_name here would false-match and skip the API save.
    const unchanged =
      !trimmed ||
      startLabelUpper === trimmed ||
      startPersistedUpper === trimmed ||
      isDefaultStylePhotoAlbumsNoteTitle(trimmed) ||
      isLegacyShortPhotoAlbumsNoteName(trimmed);
    if (unchanged) {
      clearRenameState();
      if (isSelected && existing) {
        const fallback =
          startLabelUpper ||
          photoAlbumsNoteSidebarLabel(existing, siblingNotes, notebooks);
        updateOpenNoteTitle(fallback, { schedulePersist: false });
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
      await vaultApi.updatePhotoAlbumsNote(noteId, { note_name: trimmed });
      patchNoteTitleInTree(noteId, trimmed);
      setRenameSavedPopup(`Rename “${trimmed}” saved`);
    } catch (err) {
      setError(readPhotoAlbumsApiError(err, 'Failed to rename note'));
    } finally {
      if (!isSelected) setBusy(false);
    }
  };

  /**
   * Blur/commit for the note title box in the editor header. Upper-cases the
   * entered title and rejects (with a popup + revert) any name that already
   * exists anywhere in the vault, case-insensitive.
   * Shows "Rename saved" only when the name actually changed.
   */
  const commitNoteTitleBox = async () => {
    setTitleEditing(false);
    if (!selectedNoteId) return;
    const noteId = Number(selectedNoteId);
    const snapshot = String(noteTitleBoxSnapshotRef.current ?? '');
    const upper = String(draftRef.current.openNoteTitlePlain ?? '').trim().toUpperCase();
    const snapshotUpper = snapshot.trim().toUpperCase();
    const persistedAtFocusUpper = String(noteTitleBoxPersistedNameRef.current ?? '')
      .trim()
      .toUpperCase();

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
      isDefaultStylePhotoAlbumsNoteTitle(upper) ||
      isLegacyShortPhotoAlbumsNoteName(upper);
    if (isPlaceholder) {
      revertToSnapshot();
      return;
    }

    // Unchanged vs focus snapshot / name that was persisted when focus began.
    // Do NOT compare against live tree note_name — typing already patches the tree
    // optimistically, which used to skip the API save and revert on the next reload.
    if (upper === snapshotUpper || upper === persistedAtFocusUpper) {
      setOpenNoteTitlePlain(upper);
      draftRef.current = { ...draftRef.current, openNoteTitlePlain: upper };
      return;
    }

    setOpenNoteTitlePlain(upper);
    draftRef.current = { ...draftRef.current, openNoteTitlePlain: upper };
    patchNoteTitleInTree(noteId, upper);
    setError('');
    try {
      await vaultApi.updatePhotoAlbumsNote(noteId, { note_name: upper });
      noteTitleBoxPersistedNameRef.current = upper;
      setRenameSavedPopup(`Rename “${upper}” saved`);
    } catch (err) {
      setError(readPhotoAlbumsApiError(err, 'Failed to rename note'));
      revertToSnapshot();
    }
  };

  const handleAddNotebook = () => {
    if (busy) return;
    setCreateItemDialog('album-set');
  };

  const handleAddNote = () => {
    if (busy || !selectedNotebookId) return;
    setCreateItemDialog('album');
  };

  const confirmCreateAlbumSet = async (rawName) => {
    const desiredName = normalizePhotoAlbumsNotebookCreateName(rawName);
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
      const created = await vaultApi.createPhotoAlbumsNotebook(desiredName);
      await loadTree({ preferNotebookId: created?.notebook_id, silent: true });
    } catch (err) {
      setError(readPhotoAlbumsApiError(err, 'Failed to add notebook'));
    } finally {
      setBusy(false);
    }
  };

  const confirmCreateAlbum = async (rawName, rawDates) => {
    if (!selectedNotebookId) return;
    const desiredName = buildPhotoAlbumsAlbumNoteName(rawName, rawDates);
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
      const created = await vaultApi.createPhotoAlbumsNote(selectedNotebookId, { note_name: desiredName });
      if (!created?.note_id) throw new Error('Failed to create note');
      const createdRow = {
        ...created,
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
      setError(readPhotoAlbumsApiError(err, 'Failed to add note'));
    } finally {
      setBusy(false);
    }
  };















  const handleDeleteNotebook = async (notebookId, notebookName) => {
    if (busy || !notebookId) return;
    const label = String(notebookName ?? 'this notebook').trim() || 'this notebook';
    if (!(await themedConfirm(`Delete "${label}" and all its notes? You can restore within 7 days (undelete coming later).`))) return;
    setBusy(true);
    setError('');
    try {
      await vaultApi.deletePhotoAlbumsNotebook(notebookId);
      await loadTree({ silent: true });
    } catch (err) {
      setError(readPhotoAlbumsApiError(err, 'Failed to delete notebook'));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteNote = async (noteId, noteLabel) => {
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
    setBusy(true);
    setError('');
    try {
      await vaultApi.deletePhotoAlbumsNote(noteId);
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
      setError(readPhotoAlbumsApiError(err, 'Failed to delete note'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveShortcut = async (shortcutId, shortcutLabel) => {
    if (busy || !shortcutId) return;
    const label = String(shortcutLabel ?? 'this shortcut').trim() || 'this shortcut';
    if (!(await themedConfirm(`Remove "${label}" from shortcuts?`))) return;
    setBusy(true);
    setError('');
    try {
      await vaultApi.deletePhotoAlbumsShortcut(shortcutId);
      setShortcuts((prev) => prev.filter((sc) => Number(sc.shortcut_id) !== Number(shortcutId)));
    } catch (err) {
      setError(readPhotoAlbumsApiError(err, 'Failed to remove shortcut'));
    } finally {
      setBusy(false);
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

  const mobileUploadDisabled =
    busy ||
    innerEncryptBusy ||
    notebookGateLocked ||
    !selectedNote ||
    (selectedNote &&
      noteHasInnerEncryption(selectedNote) &&
      !isInnerNoteUnlocked(selectedNote.note_id));

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
              photoAlbumsSearchResultTabLabel(note, notebook, notebooks, notesInNotebook)
            : photoAlbumsSearchResultTabLabel(note, notebook, notebooks, notesInNotebook)
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
  /** Closed menus → compact 2-letter toolbar (File / ☰ / LO / MU / BR / <=>). */
  const menuLabelsCompact = !menusOpen && !compareMode;

  const row2ShowsMobileUpload = !compareMode;
  const row2ActionSlotCount =
    (paneStorageType === 'onedrive' && oneDriveOffered ? 1 : 0) +
    (paneStorageType === 'usb' ? 1 : 0) +
    (row2ShowsMobileUpload ? 1 : 0) +
    (canEnterCompare ? 1 : 0);
  const row2ButtonMaxWidth =
    menuLabelsCompact || row2ActionSlotCount <= 0 ? 'none' : `${100 / row2ActionSlotCount}%`;

  /** Open menus from the hamburger (full labels), or close left+right and shrink the toolbar. */
  const handleMenuLabelsToggle = useCallback(() => {
    if (!menusOpen) {
      setLeftMenuOpen(true);
      setRightMenuOpen(true);
      setMenuLabelsExpanded(true);
      return;
    }
    setLeftMenuOpen(false);
    setRightMenuOpen(false);
    setMenuLabelsExpanded(false);
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

  const paneStripColor = tutaPhotoAlbumsStorageStripColor(paneStorageType);

  return (
    <PhotoAlbumsSliderControlButtonProvider fontRem={menuButtonFontRem}>
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
        label={batchUploadProgress?.label || 'Adding photos to Thumbnail Tray'}
        progressPercent={
          batchUploadProgress?.percent != null ? Number(batchUploadProgress.percent) : null
        }
        progressLabel={batchUploadProgress?.label || ''}
        backdropSx={vaultLeavingBackdropSx}
        fontSize={BUSY_HOURGLASS_MY_PHOTO_ALBUMS_SIZE}
      />
      <BusyHourglassOverlay
        open={Boolean(noteContentLoading)}
        label="Loading album photos"
        backdropSx={vaultLeavingBackdropSx}
        fontSize={BUSY_HOURGLASS_MY_PHOTO_ALBUMS_SIZE}
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
        fontSize={BUSY_HOURGLASS_MY_PHOTO_ALBUMS_SIZE}
      />
      <BusyHourglassOverlay
        open={false}
        label="Loading OneDrive sign-in"
        backdropSx={vaultLeavingBackdropSx}
        fontSize={BUSY_HOURGLASS_MY_PHOTO_ALBUMS_SIZE}
      />
      <BusyHourglassOverlay
        open={vaultLeaving}
        label={paneStorageType === 'onedrive' ? 'Saving to Cloud' : 'Logging off USB'}
        progressPercent={vaultLeavingProgressPercent}
        progressLabel={vaultLeavingProgressLabel}
        backdropSx={vaultLeavingBackdropSx}
        fontSize={BUSY_HOURGLASS_MY_PHOTO_ALBUMS_SIZE}
      />

      <PhotoAlbumsMobileUploadDialog
        open={mobileUploadOpen}
        onClose={() => setMobileUploadOpen(false)}
        disabled={busy || !selectedNote}
        onPhoneUploadComplete={(fileNameOrId, meta) => void handleMobilePhoneUploadComplete(fileNameOrId, meta)}
      />

      <PhotoAlbumsInviteReviewDialog
        open={inviteReviewOpen}
        onClose={() => {
          setInviteReviewOpen(false);
          setInviteReviewSendResult(null);
        }}
        noteId={selectedNote ? Number(selectedNote.note_id) : null}
        storageType={paneStorageType}
        sendResult={inviteReviewSendResult}
      />

      <PhotoAlbumsOrderAlbumDialog
        open={orderAlbumViewOpen}
        items={orderAlbumItems}
        albumName={orderAlbumName}
        onAlbumNameChange={persistOrderAlbumName}
        onClose={() => setOrderAlbumViewOpen(false)}
        onRemove={(id) => {
          persistOrderAlbumItems(orderAlbumItems.filter((item) => item.id !== id));
        }}
        onOpenItem={(item) => {
          setOrderAlbumViewOpen(false);
          if (!item) return;
          let noteId = null;
          let pageIndex = 0;
          if (item.kind === 'page' || item.kind === 'album') {
            noteId = Number(item.noteId);
            pageIndex = item.kind === 'page' ? Math.max(0, Math.round(Number(item.pageIndex) || 0)) : 0;
          } else if (item.kind === 'shortcut') {
            const shortcut = shortcuts.find((s) => Number(s.shortcut_id) === Number(item.shortcutId));
            noteId = Number(shortcut?.note_id);
          } else if (item.kind === 'albumSet') {
            const nb = notebooks.find((n) => Number(n.notebook_id) === Number(item.notebookId));
            noteId = Number(nb?.notes?.[0]?.note_id);
          }
          if (!Number.isFinite(noteId) || noteId < 1) {
            setError('That ordered item is no longer in this vault.');
            return;
          }
          const { notebook } = findNoteRowById(noteId);
          if (!notebook) {
            setError('That ordered album is no longer in this vault.');
            return;
          }
          setSelectedNotebookId(Number(notebook.notebook_id));
          pendingOrderPageRef.current = { noteId, pageIndex };
          if (Number(selectedNoteId) === noteId) {
            requestAnimationFrame(() => {
              noteEditorApiRef.current?.goToAlbumPage?.(pageIndex, { skipTrafficGate: true });
              pendingOrderPageRef.current = null;
            });
            return;
          }
          selectNoteId(noteId);
        }}
      />

      <PhotoAlbumsCrossPaneTransferDialog
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
        fontSize={BUSY_HOURGLASS_MY_PHOTO_ALBUMS_SIZE}
      />
      <BusyHourglassOverlay
        open={folderImportBusy}
        label="Importing folder as notebook"
        progressPercent={folderImportProgressPercent}
        progressLabel={folderImportProgressLabel}
        backdropSx={vaultLeavingBackdropSx}
        fontSize={BUSY_HOURGLASS_MY_PHOTO_ALBUMS_SIZE}
      />
      <BusyHourglassOverlay
        open={multiHtmlExportBusy}
        label="Exporting notes as HTML"
        progressPercent={multiHtmlExportProgressPercent}
        progressLabel={multiHtmlExportProgressLabel}
        backdropSx={vaultLeavingBackdropSx}
        fontSize={BUSY_HOURGLASS_MY_PHOTO_ALBUMS_SIZE}
      />
      <BusyHourglassOverlay
        open={Boolean(noteFileImportProgress)}
        label="Importing notes"
        progressPercent={noteFileImportProgress?.percent ?? 0}
        progressLabel={noteFileImportProgress?.label || ''}
        backdropSx={vaultLeavingBackdropSx}
        fontSize={BUSY_HOURGLASS_MY_PHOTO_ALBUMS_SIZE}
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
            {sanitizePhotoAlbumsExportFileName(notebookHtmlExportOffer?.notebookName || 'Notebook')}
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
      <PhotoAlbumsViewVaultDialog
        open={viewVaultOpen}
        onClose={() => setViewVaultOpen(false)}
        storageType={viewVaultStorageType}
        folderName={viewVaultStorageType === 'onedrive' ? oneDriveVaultFolderName : ''}
        tutaDrive={isTutaDrivePane}
      />
      <PhotoAlbumsOneDriveBackupDialog
        open={oneDriveBackupOpen}
        onClose={() => setOneDriveBackupOpen(false)}
        folderName={oneDriveVaultFolderName}
        albumContext={albumBackupContext}
        onOpenMyPhotoAlbums={() => setOneDriveBackupOpen(false)}
        onRestored={() => void handleOneDriveVaultRestored()}
      />
      <PhotoAlbumsUsbBackupDialog
        open={usbBackupOpen}
        onClose={() => setUsbBackupOpen(false)}
        folderLabel={usbVaultFolderLabel}
        albumContext={albumBackupContext}
        onOpenMyPhotoAlbums={() => setUsbBackupOpen(false)}
        onRestored={() => handleUsbVaultRestoredOrFormatted()}
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
      <PhotoAlbumsCreateItemDialog
        open={Boolean(createItemDialog)}
        mode={createItemDialog}
        busy={busy}
        onClose={() => setCreateItemDialog(null)}
        onConfirmAlbumSet={(name) => void confirmCreateAlbumSet(name)}
        onConfirmAlbum={(name, dates) => void confirmCreateAlbum(name, dates)}
      />
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
        backdropSx={myPhotoAlbumsLoadingBackdropSx}
        fontSize={BUSY_HOURGLASS_MY_PHOTO_ALBUMS_SIZE}
      />

      {!unlocked ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flex: 1,
            py: 6,
            ...myPhotoAlbumsBackgroundPanelSx
          }}
        />
      ) : (
        <Box sx={{ display: 'flex', flex: 1, minHeight: 0, width: '100%', flexDirection: 'column' }}>
          <PhotoAlbumsTrafficWaitHost />
          {!hideWorkspaceChrome ? (
            <PhotoAlbumsUsageBar
              usage={vaultUsage}
              storageType={paneStorageType}
              videoTutorialUrl={videoTutorialUrl}
              onPurchased={() => refreshVaultUsageRef.current?.() ?? Promise.resolve()}
              onGetMoreTokens={openPaymentTokenCheckout}
              onRequestUsageRefresh={() => refreshVaultUsageRef.current?.()}
            />
          ) : null}
          {!hideWorkspaceChrome ? (
          <Box
            sx={{
              flexShrink: 0,
              display: 'flex',
              width: '100%',
              minWidth: 0,
              overflow: 'visible',
              borderBottom: '2px solid var(--theme-primary-color)',
              zIndex: 3,
              pt: 0.35,
              pb: 0.35,
              alignItems: 'center',
              bgcolor: 'var(--theme-primary-color)',
              gap: { xs: 0.5, sm: 0.75 },
              px: { xs: 0.5, sm: 0.75 },
              boxSizing: 'border-box'
            }}
          >
            {/* Section 1 — File / menus (row 1) + Backup/Restore / Mobile Upload (row 2) */}
            <Box
              sx={{
                flex: '1 1 0',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 0.35,
                py: 0.25
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 0.5,
                  minWidth: 0
                }}
              >
              {!compareMode ? (
                <Box sx={{ ...menuRailButtonCellSx, p: 0.35 }}>
                  <PhotoAlbumsFileMenu
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
                    buttonSx={menuLabelsCompact ? headerCompactChipSx : headerToggleButtonSx}
                  />
                </Box>
              ) : null}
              <Box sx={{ ...menuRailButtonCellSx, p: 0.35 }}>
                {compareMode ? (
                  <SliderControlButton
                    type="button"
                    variant="yellow"
                    hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
                    aria-label="Return to single storage view"
                    onClick={() => {
                      onReturnFromCompare?.();
                    }}
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
                    title={!menusOpen ? 'Open menus' : 'Close left and right menus'}
                    onClick={handleMenuLabelsToggle}
                    {...(menusOpen ? guestDemoBlockProps() : null)}
                    sx={menuLabelsCompact ? headerCompactChipSx : headerToggleButtonSx}
                  >
                    {menusOpen ? (
                      '< Close Menu'
                    ) : (
                      <Box
                        component="img"
                        src={threeDashesImg}
                        alt=""
                        aria-hidden
                        sx={{
                          ...menuToggleIconSx,
                          height: { xs: 22, md: 24 }
                        }}
                      />
                    )}
                  </SliderControlButton>
                )}
              </Box>
              <Box sx={{ ...menuRailButtonCellSx, p: 0.35 }}>
                <VaultExitToMallToolbarButton
                  compact={menuLabelsCompact}
                  {...guestDemoBlockProps()}
                  onClick={() => void handleExitToMall()}
                  disabled={busy}
                  sx={menuLabelsCompact ? headerCompactChipSx : headerToggleButtonSx}
                />
              </Box>
              </Box>

              {!compareMode ? (
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 0.5,
                  minWidth: 0
                }}
              >
              {paneStorageType === 'onedrive' && oneDriveOffered ? (
                <Box sx={{ ...menuRailButtonCellSx, p: 0.35 }}>
                  <SliderControlButton
                    type="button"
                    variant="yellow"
                    hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
                    onClick={() => {
                      setOneDriveBackupOpen(true);
                    }}
                    disabled={busy}
                    aria-label="Backup/Restore"
                    title="Backup / Restore"
                    {...guestDemoBlockProps()}
                    sx={menuLabelsCompact ? headerCompactChipSx : headerToggleButtonSx}
                  >
                    {menuLabelsCompact ? 'BR' : 'Backup/Restore'}
                  </SliderControlButton>
                </Box>
              ) : null}
              {paneStorageType === 'usb' ? (
                <Box sx={{ ...menuRailButtonCellSx, p: 0.35 }}>
                  <SliderControlButton
                    type="button"
                    variant="yellow"
                    hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
                    onClick={() => {
                      setUsbBackupOpen(true);
                    }}
                    disabled={busy}
                    aria-label="Backup/Restore"
                    title="Backup / Restore"
                    {...guestDemoBlockProps()}
                    sx={menuLabelsCompact ? headerCompactChipSx : headerToggleButtonSx}
                  >
                    {menuLabelsCompact ? 'BR' : 'Backup/Restore'}
                  </SliderControlButton>
                </Box>
              ) : null}
              {row2ShowsMobileUpload ? (
                <Box sx={{ ...menuRailButtonCellSx, p: 0.35 }}>
                  <SliderControlButton
                    type="button"
                    variant="yellow"
                    hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
                    {...guestDemoBlockProps()}
                    onClick={() => {
                      setMobileUploadOpen(true);
                    }}
                    disabled={mobileUploadDisabled}
                    aria-label="Mobile Upload"
                    title="Mobile Upload"
                    sx={menuLabelsCompact ? headerCompactChipSx : headerToggleButtonSx}
                  >
                    {menuLabelsCompact ? 'MU' : 'Mobile Upload'}
                  </SliderControlButton>
                </Box>
              ) : null}
              {canEnterCompare ? (
                <Box sx={{ ...menuRailButtonCellSx, p: 0.35 }}>
                  <SliderControlButton
                    type="button"
                    variant="yellow"
                    hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
                    onClick={() => {
                      onEnterCompare?.();
                    }}
                    disabled={busy}
                    aria-label="OneDrive to USB compare"
                    title="Open OneDrive and USB side by side to drag and drop notebooks and notes"
                    {...guestDemoBlockProps()}
                    sx={menuLabelsCompact ? headerCompactChipSx : headerToggleButtonSx}
                  >
                    {menuLabelsCompact ? '<=>' : 'OneDrive↔USB'}
                  </SliderControlButton>
                </Box>
              ) : null}
              </Box>
              ) : null}
            </Box>

            {/* Section 2 — Album Title + Search + Invite */}
            <Box
              sx={{
                flex: '2 1 0',
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                flexWrap: { xs: 'wrap', md: 'nowrap' },
                gap: 0.75,
                pl: 0.5,
                pr: { xs: 0.75, sm: 1 },
                py: 0.25,
                boxSizing: 'border-box',
                borderLeft: '2px solid rgba(255,255,255,0.35)',
                overflow: 'visible'
              }}
            >
              {!compareMode &&
              selectedNote &&
              !(
                noteRequiresInnerPinToView(selectedNote) &&
                !isInnerNoteUnlocked(selectedNote.note_id)
              ) ? (
                <>
                  <Box
                    component="label"
                    htmlFor="rv-note-title-input"
                    sx={{
                      fontWeight: 800,
                      color: '#fff',
                      WebkitTextFillColor: '#fff',
                      fontSize: { xs: '0.8rem', sm: '0.9rem' },
                      flex: '0 0 auto',
                      bgcolor: 'transparent',
                      border: 'none',
                      px: 0,
                      py: 0,
                      whiteSpace: 'nowrap',
                      lineHeight: 1.15
                    }}
                  >
                    Album:
                  </Box>
                  {searchActive &&
                  !titleEditing &&
                  titleMatchesSearchTerms(openNoteTitlePlain, activeSearchTerms) ? (
                    <Box
                      role="textbox"
                      tabIndex={0}
                      title="Click to edit album title"
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
                        flex: '1 1 8rem',
                        minWidth: '6rem',
                        maxWidth: { xs: '100%', md: '14rem' },
                        fontSize: { xs: '0.85rem', sm: '0.95rem' },
                        fontWeight: 600,
                        color: PHOTO_ALBUMS_THEME_INVERSE_FG,
                        WebkitTextFillColor: PHOTO_ALBUMS_THEME_INVERSE_FG,
                        cursor: 'text',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        bgcolor: PHOTO_ALBUMS_THEME_DAYNIGHT_BG,
                        border: '3px solid #000',
                        borderRadius: 0.5,
                        px: 0.85,
                        py: 0.45
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
                        const noteId = Number(selectedNoteId);
                        const ownerNotebook =
                          notebooks.find((nb) =>
                            (nb.notes || []).some((n) => Number(n.note_id) === noteId)
                          ) || selectedNotebook;
                        const row = (ownerNotebook?.notes || []).find(
                          (n) => Number(n.note_id) === noteId
                        );
                        noteTitleBoxPersistedNameRef.current = String(
                          row?.note_name ?? ''
                        ).trim();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void commitNoteTitleBox();
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
                      onBlur={() => {
                        void commitNoteTitleBox();
                      }}
                      placeholder="Untitled"
                      InputProps={{ disableUnderline: true }}
                      inputProps={{ 'aria-label': 'Album title', maxLength: 200 }}
                      sx={{
                        flex: '1 1 8rem',
                        minWidth: '6rem',
                        maxWidth: { xs: '100%', md: '14rem' },
                        ...photoAlbumsThemeDaynightSurfaceSx,
                        border: '3px solid #000',
                        borderRadius: 0.5,
                        px: 0.85,
                        py: 0.3,
                        '& .MuiInputBase-input': {
                          fontSize: { xs: '0.85rem', sm: '0.95rem' },
                          fontWeight: 600,
                          color: PHOTO_ALBUMS_THEME_INVERSE_FG,
                          WebkitTextFillColor: PHOTO_ALBUMS_THEME_INVERSE_FG,
                          p: 0
                        }
                      }}
                    />
                  )}
                </>
              ) : null}
              {!compareMode ? (
                <Box
                  sx={{
                    flex: '1 1 auto',
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: { xs: 'wrap', lg: 'nowrap' },
                    gap: 0,
                    justifyContent: 'flex-start'
                  }}
                >
                  <PhotoAlbumsSearchBar
                    term1={searchTerm1}
                    onTerm1Change={setSearchTerm1}
                    onSubmit={() => void runSearch()}
                    onClear={handleClearSearch}
                    searchBusy={searchBusy}
                    clearDisabled={busy || (!searchTerm1.trim() && !searchActive)}
                    bgcolor="var(--theme-primary-color)"
                    fillWidth={false}
                    headerFlush
                  />
                  <PhotoAlbumsInviteBar
                    disabled={busy}
                    noteId={selectedNote ? Number(selectedNote.note_id) : null}
                    notebookId={selectedNotebookId ? Number(selectedNotebookId) : null}
                    storageType={paneStorageType}
                    albumSetName={activeAlbumSetName}
                    albumName={activeAlbumName}
                    videoTutorialUrl={videoTutorialUrl}
                    onInvited={() => void refreshSharedAlbums()}
                    onOpenReview={(sendResult) => {
                      setInviteReviewSendResult(sendResult || null);
                      setInviteReviewOpen(true);
                    }}
                  />
                </Box>
              ) : (
                <Box sx={{ flex: '1 1 auto', minWidth: 0 }} aria-hidden />
              )}
            </Box>
          </Box>
          ) : null}

          {!hideWorkspaceChrome && !compareMode ? (
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
                ...photoAlbumsThemeDaynightSurfaceSx,
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
                  color: PHOTO_ALBUMS_THEME_INVERSE_FG,
                  WebkitTextFillColor: PHOTO_ALBUMS_THEME_INVERSE_FG
                }}
              >
                Found:
              </Typography>
            </Box>
            {searchActive ? (
              <SliderControlButton
                type="button"
                variant="yellow"
                hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
                onClick={handleClearSearch}
                disabled={busy || searchBusy}
                aria-label="Clear search"
                sx={{
                  flexShrink: 0,
                  width: 'auto',
                  minWidth: 0,
                  px: 1,
                  py: 0.35,
                  whiteSpace: 'nowrap'
                }}
              >
                Clear
              </SliderControlButton>
            ) : null}
            {searchActive && Array.isArray(searchResults) && searchResultTabs.length > 0 ? (
              <Box
                sx={{
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.25,
                  border: '3px solid #000',
                  borderRadius: 0.75,
                  bgcolor: PHOTO_ALBUMS_THEME_DAYNIGHT_BG,
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
            ) : searchActive && Array.isArray(searchResults) && !searchResultTabs.length ? (
              <Typography sx={{ fontWeight: 700, color: '#000', WebkitTextFillColor: '#000', fontSize: '0.9rem', flexShrink: 0 }}>
                {searchMessage || 'No notes match your search'}
              </Typography>
            ) : null}
            {searchActive && searchFoundPages ? (
              <Box
                aria-label="Found album pages"
                sx={{
                  flex: '1 1 auto',
                  minWidth: 120,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  py: 0.15,
                  px: 0.35,
                  minHeight: 40,
                  boxSizing: 'border-box'
                }}
              >
                {(Array.isArray(searchFoundPages.matchIndexes)
                  ? searchFoundPages.matchIndexes
                  : []
                ).length ? (
                  searchFoundPages.matchIndexes.map((idx) => {
                    const model =
                      searchFoundPages.models?.[idx] || {
                        key: `missing-${idx}`,
                        slots: [],
                        photos: []
                      };
                    return (
                      <PageThumb
                        key={`found-page-${idx}-${model.key}`}
                        model={model}
                        pageNumber={idx + 1}
                        active={idx === searchFoundPages.pageIndex}
                        orientation={searchFoundPages.orientation}
                        noteId={searchFoundPages.noteId}
                        storageType={searchFoundPages.storageType}
                        onSelect={() => searchFoundPages.onGoToPage?.(idx)}
                        heightPx={40}
                      />
                    );
                  })
                ) : (
                  <Typography
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      color: '#b71c1c',
                      WebkitTextFillColor: '#b71c1c',
                      whiteSpace: 'nowrap',
                      px: 0.5
                    }}
                  >
                    No album pages contain this search text
                  </Typography>
                )}
              </Box>
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
          {leftMenuOpen && !hideWorkspaceChrome ? (
            <>
              <Box
                ref={leftSidebarPaneRef}
                sx={{
                  flex: compareMode ? '1 1 0' : '0 0 auto',
                  width: compareMode
                    ? { xs: '100%', md: 'auto' }
                    : { xs: '100%', md: sidebarWidth },
                  maxWidth: compareMode
                    ? { xs: '100%', md: '66%' }
                    : { xs: '100%', md: '85vw' },
                  minWidth: compareMode ? { md: 0 } : undefined,
                  display: 'flex',
                  flexDirection: 'column',
                  bgcolor: 'var(--theme-daynight-color)',
                  minHeight: compact || compareMode ? 0 : { xs: 280, md: '100%' },
                  overflow: 'hidden',
                  boxSizing: 'border-box'
                }}
              >
                <Box
                  ref={leftSidebarSplitRef}
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    p: compact ? 0.5 : 1,
                    gap: 0,
                    boxSizing: 'border-box'
                  }}
                >
                <Box
                  sx={{
                    display: 'flex',
                    flex: compareMode
                      ? '1 1 auto'
                      : `${100 - sharedAlbumPanePercent} 1 0`,
                    minHeight: compareMode ? 0 : 120,
                    minWidth: 0
                  }}
                >
                  <Box
                    ref={notebookColPaneRef}
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
                        {...guestDemoBlockProps()}
                        sx={laneContainedButtonTwoLineSx}
                      >
                        Add
                        <br />
                        Album-Set
                      </SliderControlButton>
                    </Box>
                    <Box sx={photoAlbumsMenuListScrollSx}>
                      {displayNotebooks.map((nb) => {
                        void innerUnlockVersion;
                        const notebookNotes = nb.notes || [];
                        const notebookHasInner = notebookNotes.some((n) => noteHasInnerEncryption(n));
                        const notebookInnerLocked = notebookInnerLockedForDisplay(notebookNotes);
                        const notebookLockingUp =
                          !notebookInnerLocked &&
                          innerEncryptUiScope === 'notebook' &&
                          (inlineInnerPinMode === 'enable' || inlineInnerPinMode === 'lock') &&
                          Number(nb.notebook_id) === Number(selectedNotebookId);
                        return (
                        <RenamableDraggableMenuRow
                          key={nb.notebook_id}
                          id={nb.notebook_id}
                          domId={`record-vault-notebook-${nb.notebook_id}`}
                          sideCount={photoAlbumsSidebarAlbumSetCount(nb)}
                          label={
                            notebookInnerLocked
                              ? PHOTO_ALBUMS_INNER_LOCKED_LABEL
                              : Number(editingNotebookId) === Number(nb.notebook_id) &&
                                  renameUiSurface === 'header'
                                ? editNameDraft
                                : photoAlbumsNotebookSidebarLabel(nb, notebooks)
                          }
                          buttonTitle={
                            notebookInnerLocked
                              ? 'Locked notebook — enter PIN to unlock'
                              : notebookLockingUp
                                ? 'Locking notebook — enter PIN'
                                : notebookHasInner
                                  ? 'Notebook has PIN-locked notes'
                                  : undefined
                          }
                          selected={
                            !orderAlbumActive &&
                            Number(nb.notebook_id) === Number(selectedNotebookId)
                          }
                          locked={notebookInnerLocked}
                          editing={
                            Number(editingNotebookId) === Number(nb.notebook_id) &&
                            renameUiSurface === 'menu' &&
                            !notebookInnerLocked
                          }
                          editValue={editNameDraft}
                          onEditValueChange={setEditNameDraft}
                          onSelect={() => {
                            setOrderAlbumActive(false);
                            notebookScopePendingRef.current = true;
                            setInnerEncryptUiScope('notebook');
                            setSelectedNotebookId(nb.notebook_id);
                          }}
                          onStartEdit={() => {
                            setEditingNoteId(null);
                            setRenameUiSurface('menu');
                            setEditingNotebookId(nb.notebook_id);
                            setEditNameDraft(photoAlbumsNotebookSidebarLabel(nb, notebooks));
                          }}
                          onCommitEdit={() => void commitNotebookRename()}
                          onCancelEdit={clearRenameState}
                          dragMime={DRAG_NOTEBOOK}
                          draggingId={draggingNotebookId}
                          alternateDraggingId={draggingNoteId}
                          dropTargetId={dropTargetNotebookId}
                          dragTitle={
                            crossPaneDropActive
                              ? 'Drop here to copy or move from the other vault'
                              : draggingNoteId != null
                                ? 'Drop album here to move it into this album-set'
                                : 'Drag to reorder; drop an album here to move it into this set'
                          }
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          onDragOver={setDropTargetNotebookId}
                          onDrop={(e, toId, mime) => void handleNotebookRowDrop(e, toId, mime)}
                          onDelete={() =>
                            void handleDeleteNotebook(
                              nb.notebook_id,
                              photoAlbumsNotebookSidebarLabel(nb, notebooks)
                            )
                          }
                          deleteLabel={`Delete notebook ${photoAlbumsNotebookSidebarLabel(nb, notebooks)}`}
                          onToggleLock={() => handleToggleNotebookLock(nb)}
                          lockTitle={
                            notebookInnerLocked
                              ? 'Unlock notebook (enter 6-digit PIN)'
                              : 'Lock notebook with a 6-digit PIN'
                          }
                          disabled={busy || crossPaneBusy}
                          acceptForeignDrop={crossPaneDropActive}
                        />
                        );
                      })}
                    </Box>
                  </Box>

                  <ColumnResizeHandle
                    label="Slide to resize notebook and note lists"
                    onMouseDown={(e) => startColumnResize('notebookCol', e)}
                  />

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
                        disabled={busy || !selectedNotebookId || notebookGateLocked}
                        hoverScale={1.25}
                        {...guestDemoBlockProps()}
                        sx={laneContainedButtonTwoLineSx}
                      >
                        Add
                        <br />
                        Album
                      </SliderControlButton>
                    </Box>
                    <Box sx={photoAlbumsMenuListScrollSx}>
                      {/* Encrypted notebook: do not reveal any note names until unlocked. */}
                      {(notebookGateLocked ? [] : notes).map((note) => {
                        const noteInnerLocked =
                          noteRequiresInnerPinToView(note) &&
                          !isInnerNoteUnlockedForDisplay(note.note_id, note);
                        const noteLockingUp =
                          !noteInnerLocked &&
                          (inlineInnerPinMode === 'enable' || inlineInnerPinMode === 'lock') &&
                          Number(note.note_id) === Number(selectedNoteId);
                        // innerUnlockVersion lives in unlock refs — read so rows re-paint after PIN unlock.
                        void innerUnlockVersion;
                        const noteMenuLabel = noteInnerLocked
                          ? PHOTO_ALBUMS_INNER_LOCKED_LABEL
                          : photoAlbumsNoteMenuLabel(note, notes, {
                              selectedNoteId,
                              openNoteTitlePlain,
                              notebooks
                            });
                        const noteRealLabel = photoAlbumsNoteMenuLabel(note, notes, {
                          selectedNoteId,
                          openNoteTitlePlain,
                          notebooks
                        });
                        const menuEditingThisNote =
                          Number(editingNoteId) === Number(note.note_id) &&
                          renameUiSurface === 'menu';
                        const headerEditingThisNote =
                          Number(editingNoteId) === Number(note.note_id) &&
                          renameUiSurface === 'header';
                        const sidebarAlbumLines =
                          noteInnerLocked || menuEditingThisNote
                            ? null
                            : formatPhotoAlbumsSidebarAlbumLines(
                                headerEditingThisNote
                                  ? photoAlbumsNoteSidebarLabel(note, notes, notebooks)
                                  : noteMenuLabel
                              );
                        return (
                        <RenamableDraggableMenuRow
                          key={note.note_id}
                          id={note.note_id}
                          domId={`record-vault-note-${note.note_id}`}
                          sideCount={
                            noteInnerLocked ? null : photoAlbumsSidebarAlbumMediaCount(note)
                          }
                          label={
                            noteInnerLocked
                              ? PHOTO_ALBUMS_INNER_LOCKED_LABEL
                              : headerEditingThisNote
                                ? // Freeze sidebar label while the content-header field is being typed.
                                  photoAlbumsNoteSidebarLabel(note, notes, notebooks)
                                : menuEditingThisNote
                                  ? editNameDraft || noteMenuLabel
                                  : noteMenuLabel
                          }
                          albumLabelLines={sidebarAlbumLines}
                          buttonTitle={
                            noteInnerLocked
                              ? 'Locked — enter PIN to view'
                              : noteLockingUp
                                ? 'Locking up — enter PIN'
                                : noteRealLabel
                          }
                          selected={
                            !orderAlbumActive &&
                            Number(note.note_id) === Number(selectedNoteId)
                          }
                          selectedBlue={searchActive}
                          multiSelected={
                            !orderAlbumActive &&
                            multiSelectedNoteIds.some(
                              (id) => Number(id) === Number(note.note_id)
                            )
                          }
                          locked={noteInnerLocked}
                          editing={menuEditingThisNote && !noteInnerLocked}
                          editValue={editNameDraft}
                          onEditValueChange={handleNoteListTitleEditChange}
                          onSelect={(e) => {
                            setOrderAlbumActive(false);
                            if (e?.shiftKey) {
                              handleNoteShiftSelect(note.note_id);
                              return;
                            }
                            selectNoteId(note.note_id);
                          }}
                          onStartEdit={() => {
                            if (noteInnerLocked) return;
                            replaceMultiSelectedNoteIds([]);
                            noteMultiSelectAnchorIdRef.current = note.note_id;
                            setEditingNotebookId(null);
                            setRenameUiSurface('menu');
                            setEditingNoteId(note.note_id);
                            noteRenameStartPersistedRef.current = String(note.note_name ?? '').trim();
                            noteRenameStartLabelRef.current = photoAlbumsNoteSidebarLabel(
                              note,
                              notes,
                              notebooks
                            );
                            setEditNameDraft(
                              Number(note.note_id) === Number(selectedNoteId)
                                ? openNoteTitlePlain ||
                                    photoAlbumsNoteSidebarLabel(note, notes, notebooks)
                                : photoAlbumsNoteSidebarLabel(note, notes, notebooks)
                            );
                          }}
                          onCommitEdit={() => void commitNoteRename()}
                          onCancelEdit={clearRenameState}
                          dragMime={DRAG_NOTE}
                          dragNotebookId={selectedNotebookId}
                          draggingId={draggingNoteId}
                          dropTargetId={dropTargetNoteId}
                          acceptForeignDrop={crossPaneDropActive}
                          dragTitle={
                            crossPaneDropActive
                              ? 'Drop here to copy or move from the other vault'
                              : draggingAlbumPage
                                ? 'Drop album page here to move it into this album'
                                : multiSelectedNoteIds.length > 1
                                  ? `Shift-selected: ${multiSelectedNoteIds.length} albums — drag onto an album-set to move`
                                  : 'Drag onto an album-set to move; drop a page thumb here to receive that page'
                          }
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          onPrefetchDrag={prefetchNoteHtmlExport}
                          onDragOver={setDropTargetNoteId}
                          albumPageDropActive={draggingAlbumPage}
                          onDrop={(e, toId, mime) => {
                            if (isAlbumPageDrag(e.dataTransfer) || draggingAlbumPage) {
                              void handleMoveAlbumPageToNote(e, toId);
                              return;
                            }
                            void handleDropReorder(
                              e,
                              toId,
                              mime,
                              notes,
                              'note_id',
                              (ids) => vaultApi.reorderPhotoAlbumsNotes(selectedNotebookId, ids)
                            );
                          }}
                          onFileDrop={(e) => void handleNoteListFileDrop(e)}
                          onDelete={() =>
                            void handleDeleteNote(note.note_id, noteRealLabel)
                          }
                          deleteLabel={`Delete note ${noteRealLabel}`}
                          onToggleLock={() => handleToggleNoteLock(note)}
                          lockTitle={
                            noteInnerLocked
                              ? 'Unlock note (enter 6-digit PIN)'
                              : 'Lock note with a 6-digit PIN'
                          }
                          disabled={busy || crossPaneBusy || !selectedNotebookId}
                        />
                        );
                      })}
                    </Box>
                  </Box>
                </Box>

                {!compareMode ? (
                  <>
                    <RowResizeHandle
                      label="Drag up or down to resize Shared Album / Order Album area"
                      onMouseDown={startSharedAlbumPaneResize}
                    />
                    <Box
                      sx={{
                        flex: `${sharedAlbumPanePercent} 1 0`,
                        minHeight: 88,
                        display: 'flex',
                        minWidth: 0,
                        borderTop: PHOTO_ALBUMS_THEME_INVERSE_BORDER_2,
                        overflow: 'hidden'
                      }}
                    >
                    <Box
                      sx={{
                        ...(compact ? menuColumnShellCompactSx : menuColumnShellSx),
                        width: notebookColWidth,
                        flexShrink: 0,
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      <Box sx={laneAddButtonWrapSx}>
                        <SliderControlButton
                          type="button"
                          fullWidth
                          disabled
                          disableHoverScale
                          tabIndex={-1}
                          aria-hidden
                          aria-label="Album for Order"
                          title="Album for Order"
                          sx={{
                            ...laneContainedButtonTwoLineSx,
                            pointerEvents: 'none',
                            cursor: 'default',
                            borderRadius: '0 !important',
                            ...themeDaynightSurfaceImportantSx,
                            border: 'none !important',
                            boxShadow: 'none !important',
                            '&.Mui-disabled': {
                              ...themeDaynightSurfaceImportantSx,
                              border: 'none !important',
                              boxShadow: 'none !important',
                              opacity: 1,
                              transform: 'none !important',
                              cursor: 'default !important'
                            }
                          }}
                        >
                          Album
                          <br />
                          for Order
                        </SliderControlButton>
                      </Box>
                      <Box sx={{ ...photoAlbumsMenuListScrollSx, flex: 1, minHeight: 0 }}>
                        <MenuRowWithDelete
                          deleteLabel={`Clear ${orderAlbumName || DEFAULT_ORDER_ALBUM_NAME} album`}
                          disabled={busy || !orderAlbumItems.length}
                          onDelete={async () => {
                            if (!orderAlbumItems.length) return;
                            if (
                              !(await themedConfirm(
                                `Clear all ${orderAlbumItems.length} item${
                                  orderAlbumItems.length === 1 ? '' : 's'
                                } from ${orderAlbumName || DEFAULT_ORDER_ALBUM_NAME}?`
                              ))
                            ) {
                              return;
                            }
                            persistOrderAlbumItems([]);
                          }}
                        >
                          <MenuRowButton
                            selected={orderAlbumActive}
                            disabled={busy}
                            onClick={handleOpenOrderAlbumPages}
                            onDoubleClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setOrderAlbumViewOpen(true);
                            }}
                            onDragOver={(e) => {
                              const types = e.dataTransfer?.types
                                ? Array.from(e.dataTransfer.types)
                                : [];
                              if (
                                !types.includes(DRAG_NOTE) &&
                                !types.includes(DRAG_NOTE_IDS) &&
                                !types.includes(DRAG_NOTEBOOK) &&
                                !types.includes(DRAG_SHORTCUT)
                              ) {
                                return;
                              }
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'copy';
                              setOrderAlbumDropActive(true);
                            }}
                            onDragLeave={() => setOrderAlbumDropActive(false)}
                            onDrop={(e) => void handleOrderAlbumDrop(e)}
                            title={`Click to open ${orderAlbumName || DEFAULT_ORDER_ALBUM_NAME} pages. Double-click to manage the queue.`}
                            sx={{
                              border: `2px solid ${PHOTO_ALBUMS_THEME_INVERSE_BORDER} !important`,
                              ...(orderAlbumActive
                                ? themeDaynightSurfaceImportantSx
                                : null),
                              ...(orderAlbumDropActive
                                ? {
                                    outline: `3px dashed ${PHOTO_ALBUMS_THEME_INVERSE_BORDER}`,
                                    outlineOffset: 2,
                                    bgcolor: 'rgba(255, 215, 0, 0.55) !important'
                                  }
                                : null)
                            }}
                          >
                            {orderAlbumName || DEFAULT_ORDER_ALBUM_NAME}
                            {orderFilmstripEntries.length
                              ? ` (${orderFilmstripEntries.length})`
                              : orderAlbumItems.length
                                ? ` (${orderAlbumItems.length})`
                                : ''}
                          </MenuRowButton>
                        </MenuRowWithDelete>
                      </Box>
                    </Box>
                    <ColumnResizeHandle
                      label="Shared album column resize"
                      sx={{ visibility: 'hidden', width: 0, minWidth: 0, p: 0, border: 0 }}
                    />
                    <Box
                      sx={{
                        ...(compact ? menuColumnShellCompactSx : menuColumnShellSx),
                        flex: 1,
                        minWidth: MIN_MENU_COL_WIDTH,
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      <Box sx={laneAddButtonWrapSx}>
                        <SliderControlButton
                          type="button"
                          fullWidth
                          disabled
                          disableHoverScale
                          tabIndex={-1}
                          aria-hidden
                          aria-label="Shared Album"
                          title="Shared Album"
                          sx={{
                            ...laneContainedButtonTwoLineSx,
                            pointerEvents: 'none',
                            cursor: 'default',
                            borderRadius: '0 !important',
                            ...themeDaynightSurfaceImportantSx,
                            border: 'none !important',
                            boxShadow: 'none !important',
                            '&.Mui-disabled': {
                              ...themeDaynightSurfaceImportantSx,
                              border: 'none !important',
                              boxShadow: 'none !important',
                              opacity: 1,
                              transform: 'none !important',
                              cursor: 'default !important'
                            }
                          }}
                        >
                          Shared
                          <br />
                          Album
                        </SliderControlButton>
                      </Box>
                      <Box sx={{ ...photoAlbumsMenuListScrollSx, flex: 1, minHeight: 0 }}>
                        {sharedAlbums.map((item) => {
                          const label = item.displayLabel || `${item.albumSetName} / ${item.albumName}`;
                          const selected = Number(selectedSharedAlbumId) === Number(item.sharedAlbumId);
                          return (
                            <MenuRowWithDelete
                              key={item.sharedAlbumId}
                              deleteLabel={`Remove ${label} from Shared Album`}
                              disabled={busy}
                              onDelete={() => void handleRemoveSharedAlbum(item.sharedAlbumId, label)}
                            >
                              <SliderControlButton
                                type="button"
                                fullWidth
                                variant={selected ? 'green' : 'yellow'}
                                hoverScale={1.15}
                                onClick={() => void openSharedAlbum(item.sharedAlbumId)}
                                title={
                                  item.ownerEmail
                                    ? `Shared by ${item.ownerEmail} — view album`
                                    : label
                                }
                                sx={{
                                  justifyContent: 'flex-start',
                                  textAlign: 'left',
                                  mb: 0,
                                  px: 1,
                                  py: 0.75,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {label}
                              </SliderControlButton>
                            </MenuRowWithDelete>
                          );
                        })}
                        {!sharedAlbums.length ? (
                          <Typography sx={{ px: 1, py: 0.5, fontSize: '0.82rem', fontWeight: 700 }}>
                            No shared albums yet.
                          </Typography>
                        ) : null}
                      </Box>
                    </Box>
                    </Box>
                  </>
                ) : null}
                </Box>
              </Box>

              {!compareMode ? (
              <ColumnResizeHandle
                label="Slide left menu wider or narrower"
                sx={{ display: { xs: 'none', md: 'block' } }}
                onMouseDown={(e) => startColumnResize('sidebar', e)}
              />
              ) : null}
            </>
          ) : null}

          {!compareMode ? (
          <Box
            data-record-vault-note-content
            ref={noteContentPaneRef}
            // Do not make the whole album/editor pane HTML5-draggable — that dragged
            // the entire binder as a huge translucent ghost. Export HTML from the
            // notebook/note list on the left instead.
            draggable={false}
            onDragOver={handleContentDragOver}
            onDrop={handleContentFileDrop}
            sx={{
              flex: 1,
              minWidth: 0,
              minHeight: compact ? 0 : { xs: 360, md: '100%' },
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
              bgcolor: 'var(--theme-primary-color)'
            }}
          >
            {(() => {
              const notebookNotesForLock = selectedNotebook?.notes || [];
              const notebookGateLocked = notebookInnerLockedForDisplay(notebookNotesForLock);
              const openNoteLocked = Boolean(
                selectedNote &&
                  noteRequiresInnerPinToView(selectedNote) &&
                  !isInnerNoteUnlocked(selectedNote.note_id)
              );
              const lockedNow =
                !sharedAlbumView && (notebookGateLocked || openNoteLocked);
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
                    <PhotoAlbumsNoteEditor
                      ref={noteEditorApiRef}
                      onReady={handleEditorReady}
                      onChange={sharedAlbumView ? undefined : scheduleSave}
                      editable={!sharedAlbumView}
                      noteId={
                        sharedAlbumView
                          ? Number(sharedAlbumView.vaultNoteId) || null
                          : selectedNote
                            ? Number(selectedNote.note_id)
                            : null
                      }
                      sharedAlbumId={
                        sharedAlbumView ? Number(sharedAlbumView.sharedAlbumId) || null : null
                      }
                      storageType={
                        sharedAlbumView?.storageType || paneStorageType
                      }
                      albumTitle={
                        sharedAlbumView
                          ? String(
                              sharedAlbumView.displayLabel ||
                                sharedAlbumView.albumName ||
                                ''
                            ).trim()
                          : String(openNoteTitlePlain || '').trim() ||
                            noteTitlePlainText(selectedNote?.note_name) ||
                            ''
                      }
                      onAlbumTitleChange={(nextTitle) => {
                        if (sharedAlbumView || !selectedNote) return;
                        const noteId = Number(selectedNote.note_id);
                        const upper = String(nextTitle || '').trim().toUpperCase();
                        if (!upper || !Number.isFinite(noteId) || noteId < 1) return;
                        if (vaultNameExists(upper, { excludeNoteId: noteId })) {
                          setDuplicateNamePopup(DUPLICATE_NAME_MESSAGE);
                          return;
                        }
                        setOpenNoteTitlePlain(upper);
                        draftRef.current = { ...draftRef.current, openNoteTitlePlain: upper };
                        patchNoteTitleInTree(noteId, upper);
                        void vaultApi
                          .updatePhotoAlbumsNote(noteId, { note_name: upper })
                          .catch((err) => {
                            setError(readPhotoAlbumsApiError(err, 'Failed to rename note'));
                          });
                      }}
                      onStageOsFiles={(files) => handleStageOsFiles(files)}
                      onRemoveStagedAttachment={(id) => void handleRemoveStagedAttachment(id)}
                      onRemoveAllStagedAttachments={(ids) =>
                        void handleRemoveAllStagedAttachments(ids)
                      }
                      onAlbumFullscreenChange={setAlbumFullscreen}
                      albumFocusView={albumFocusView}
                      onAlbumFocusViewChange={setAlbumFocusView}
                      searchTerms={activeSearchTerms}
                      onSearchMatchPagesChange={handleSearchMatchPagesChange}
                      onAlbumPageDragStart={
                        sharedAlbumView ? undefined : handleAlbumPageDragStart
                      }
                      onAlbumPageDragEnd={sharedAlbumView ? undefined : handleAlbumPageDragEnd}
                      onOrderPrint={
                        sharedAlbumView ? undefined : handleAddCurrentPageToOrderAlbum
                      }
                      orderAlbumActive={orderAlbumActive}
                      orderFilmstripEntries={orderAlbumActive ? orderFilmstripEntries : null}
                      orderFilmstripIndex={orderFilmstripIndex}
                      onOrderFilmstripSelect={(idx) => {
                        const entry = orderFilmstripEntries[idx];
                        if (!entry) return;
                        navigateToOrderEntry(entry, idx);
                      }}
                      onOrderFilmstripDelete={(idx) => {
                        const entry = orderFilmstripEntries[idx];
                        if (!entry) return;
                        const sourceKey = String(entry.sourceKey || '');
                        const next = (orderAlbumItems || []).filter((item) => {
                          if (sourceKey && String(item.id) === sourceKey) return false;
                          // Fallback: match by note + page when sourceKey missing.
                          if (
                            item.kind === 'page' &&
                            Number(item.noteId) === Number(entry.noteId) &&
                            Math.max(0, Math.round(Number(item.pageIndex) || 0)) ===
                              Math.max(0, Math.round(Number(entry.pageIndex) || 0))
                          ) {
                            return false;
                          }
                          return true;
                        });
                        // Prefer remove by index among page-kind items when filter matched none uniquely.
                        if (next.length === orderAlbumItems.length) {
                          const pageItems = orderAlbumItems
                            .map((item, i) => ({ item, i }))
                            .filter(({ item }) => item.kind === 'page');
                          const hit = pageItems[idx];
                          if (hit) {
                            persistOrderAlbumItems(
                              orderAlbumItems.filter((_, i) => i !== hit.i)
                            );
                            return;
                          }
                        }
                        persistOrderAlbumItems(next);
                      }}
                      header={null}
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
                          ...photoAlbumsThemeDaynightSurfaceSx,
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
                            color: PHOTO_ALBUMS_THEME_INVERSE_FG,
                            WebkitTextFillColor: PHOTO_ALBUMS_THEME_INVERSE_FG
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

          {/* Closed menus: no right-edge grab strip — reopen via the hamburger (☰). */}

          <PhotoAlbumsNoteInnerEncryptDialog
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

          {rightMenuOpen && !hideWorkspaceChrome ? (
            <>
              {!compareMode ? (
              <ColumnResizeHandle
                label="Grab and slide to resize or tuck away the right menu"
                sx={{ display: { xs: 'none', md: 'block' } }}
                onMouseDown={(e) => startColumnResize('rightSidebar', e)}
              />
              ) : null}
              <Box
                ref={rightSidebarPaneRef}
                data-pa-right-swim-lane=""
                sx={{
                  flex: compareMode ? '1 1 0' : '0 0 auto',
                  width: compareMode
                    ? { xs: '100%', md: 'auto' }
                    : { xs: '100%', md: rightSidebarWidth },
                  maxWidth: compareMode
                    ? { xs: '100%', md: '50%' }
                    : { xs: '100%', md: '50vw' },
                  minWidth: compareMode ? { md: 0 } : undefined,
                  display: 'flex',
                  flexDirection: 'column',
                  bgcolor: 'var(--theme-daynight-color)',
                  minHeight: compact || compareMode ? 0 : { xs: 220, md: '100%' },
                  borderLeft: { md: PHOTO_ALBUMS_THEME_INVERSE_BORDER_2 },
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
                      minHeight: compact ? 64 : 100,
                      bgcolor: PHOTO_ALBUMS_THEME_DAYNIGHT_BG,
                      color: PHOTO_ALBUMS_THEME_INVERSE_FG,
                      WebkitTextFillColor: PHOTO_ALBUMS_THEME_INVERSE_FG
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
                        ...themeDaynightSurfaceImportantSx,
                        border: PHOTO_ALBUMS_THEME_INVERSE_BORDER_2,
                        '&.Mui-disabled': {
                          ...themeDaynightSurfaceImportantSx,
                          border: `${PHOTO_ALBUMS_THEME_INVERSE_BORDER_2} !important`
                        }
                      }}
                    >
                      Shortcut
                    </SliderControlButton>
                    <Typography
                      sx={{
                        fontSize: '0.85rem',
                        mb: 1,
                        color: `${PHOTO_ALBUMS_THEME_INVERSE_FG} !important`,
                        WebkitTextFillColor: `${PHOTO_ALBUMS_THEME_INVERSE_FG} !important`
                      }}
                    >
                      Drag notebooks or notes here
                    </Typography>
                    <Box
                      sx={photoAlbumsMenuListScrollSx}
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
                        const shortcutRealLabel = photoAlbumsShortcutMenuLabel(shortcut, {
                          selectedNoteId,
                          openNoteTitlePlain,
                          notebooks
                        });
                        const shortcutLabel = shortcutInnerLocked
                          ? PHOTO_ALBUMS_INNER_LOCKED_LABEL
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
                    label={
                      paneStorageType === 'onedrive'
                        ? 'Resize Shortcut and OneDrive Folders & Files'
                        : 'Resize Shortcut and USB Folders & Files'
                    }
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
                    <Box
                      role="tablist"
                      aria-label="Vault files and local Files Explorer"
                      sx={{
                        flexShrink: 0,
                        display: 'flex',
                        gap: 0.5,
                        alignItems: 'stretch'
                      }}
                    >
                      {[
                        {
                          id: FILES_EXPLORER_TAB_FOLDERS,
                          label:
                            paneStorageType === 'onedrive'
                              ? 'OneDrive Folders & Files'
                              : 'USB Folders & Files'
                        },
                        { id: FILES_EXPLORER_TAB_EXPLORER, label: 'Files Explorer' },
                        { id: FILES_EXPLORER_TAB_MOBILE_UPLOAD, label: 'Mobile Upload' }
                      ].map((tab) => {
                        const selected = filesSidebarTab === tab.id;
                        return (
                          <Box
                            key={tab.id}
                            component="button"
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            onClick={() => {
                              setFilesSidebarTab(tab.id);
                              writeFilesExplorerTab(tab.id);
                            }}
                            sx={{
                              flex: 1,
                              minWidth: 0,
                              cursor: 'pointer',
                              border: PHOTO_ALBUMS_THEME_INVERSE_BORDER_2,
                              borderBottom: selected
                                ? `2px solid ${PHOTO_ALBUMS_THEME_DAYNIGHT_BG}`
                                : PHOTO_ALBUMS_THEME_INVERSE_BORDER_2,
                              borderRadius: '6px 6px 0 0',
                              bgcolor: selected ? PHOTO_ALBUMS_THEME_DAYNIGHT_BG : 'rgba(0,0,0,0.08)',
                              color: PHOTO_ALBUMS_THEME_INVERSE_FG,
                              WebkitTextFillColor: PHOTO_ALBUMS_THEME_INVERSE_FG,
                              fontWeight: selected ? 800 : 600,
                              fontSize: '0.72rem',
                              lineHeight: 1.2,
                              px: 0.5,
                              py: 0.4,
                              mb: selected ? '-2px' : 0,
                              zIndex: selected ? 1 : 0,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {tab.label}
                          </Box>
                        );
                      })}
                    </Box>
                    {filesSidebarTab === FILES_EXPLORER_TAB_EXPLORER ? (
                      <PhotoAlbumsFilesExplorerPanel
                        active={unlocked && filesSidebarTab === FILES_EXPLORER_TAB_EXPLORER}
                        disabled={busy || !unlocked || Boolean(batchUploadProgress)}
                        onStageOsFiles={(files) => handleStageOsFiles(files)}
                        onStageTrayBusyChange={handleStageTrayBusyChange}
                      />
                    ) : filesSidebarTab === FILES_EXPLORER_TAB_MOBILE_UPLOAD ? (
                      <PhotoAlbumsMobileUploadFolderPanel
                        active={unlocked && filesSidebarTab === FILES_EXPLORER_TAB_MOBILE_UPLOAD}
                        disabled={busy || !unlocked || Boolean(batchUploadProgress)}
                        refreshToken={mobileUploadFolderRefreshToken}
                        onStageOsFiles={(files) => handleStageOsFiles(files)}
                        onStageTrayBusyChange={handleStageTrayBusyChange}
                      />
                    ) : (
                      <PhotoAlbumsStorageFilesPanel
                        storageType={paneStorageType || 'usb'}
                        active={unlocked}
                        hideTitle
                      />
                    )}
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
    </PhotoAlbumsSliderControlButtonProvider>
  );
}

