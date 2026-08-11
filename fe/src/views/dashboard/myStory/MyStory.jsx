import { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import MainCard from 'ui-component/cards/MainCard';
import YellowButtonTemplate from 'ui-component/YellowButtonTemplate';
import UnSelectedButtonTemplate from 'ui-component/UnSelectedButtonTemplate';
import SelectedButtonTemplate from 'ui-component/SelectedButtonTemplate';
import ColorTemplate11Posting from 'ui-component/ColorTemplate11Posting';
import {
  COLOR_TEMPLATE11_POSTING_INITIAL_LIMIT,
  COLOR_TEMPLATE11_POSTING_VISIBILITY_SELECT_HEIGHT,
  colorTemplate11PostingVisibilityMenuProps,
  colorTemplate11PostingVisibilitySelectSx,
  normalizeColorTemplate11PostingVisibility
} from 'config/colorTemplate11Posting';
import GreenButton from 'ui-component/GreenButton';
import ThumbnailDeleteXButton from 'ui-component/ThumbnailDeleteXButton';
import { colorTemplate1WallColorByTheme } from 'config/colorTemplate1';
import { useAuth } from 'contexts/AuthContext';
import { isAdminImpersonationBypassSession, isAdminSession, isImpersonationSession } from 'utils/adminSession';
import NicknamePickerDialog from './NicknamePickerDialog';
import SecurityIconPickerDialog from './SecurityIconPickerDialog';
import { SELF_REPORT_BIOGRAPHY_PATH } from 'constants/selfReportBiographyRoute';
import { markSignupIdentificationVerificationRequired } from 'utils/signupIdentificationVerification';
import {
  ProfilePhotoChangeConfirmDialog,
  ProfilePhotoChangeWaitDialog
} from './ProfilePhotoChangeGateDialog';
import SelfIntroVideoFlow from 'views/utilities/SelfIntroVideoFlow';
import SelfIntroVideoCta from 'views/utilities/SelfIntroVideoCta';
import SelfIntroVideoSlotsFullPopup from 'views/utilities/SelfIntroVideoSlotsFullPopup';
import SelfIntroVideoPlaybackPopup, {
  SELF_INTRO_VIDEO_ID_MIME,
  SelfIntroVideoFrameThumbnail
} from 'views/utilities/SelfIntroVideoLibrary';
import { selfIntroVideoUrl, uploadPublicVaultMediaFile, isSelfIntroVideoPostingUrl } from 'api/selfIntroVideoFe';
import { resetProfilePhotoVetting } from 'api/checkrBioReviewFe';
import { resetIdVerification } from 'api/vetBioVerificationServicesFe';
import { isPilotUserCategory } from 'utils/memberCategory';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';
import { openEmbeddedYoutubePlayer } from 'utils/embeddedYoutubePlayerEvents';
import { SLIDE_SHOW_MUSIC_SLOT_INDEX } from 'api/userCustomizationFe';
import {
  evaluateProfilePhotoChangeGate,
  fetchProfilePhotoVettingFromBioReview,
  formatProfilePhotoChangeWaitMessage,
  ID_VERIFICATION_REDO_CONFIRM_MESSAGE
} from 'utils/profilePhotoChangeGate';
import {
  useMyPhotos,
  uploadMyPhoto,
  deleteMyPhoto,
  setProfilePhoto,
  myPhotoUrl,
  myPhotoThumbnailUrl,
  fetchUploadLimits,
  saveMyPhoto,
  resetMyPhotoFromOrig,
  updateMyPhotoType
} from 'api/myPhotosFe';
import {
  ALBUM_ACCEPTED_PHOTO_EXTENSIONS_UI,
  ALBUM_ACCEPTED_VIDEO_EXTENSIONS_UI,
  isAllowedAlbumPhotoFile
} from 'constants/albumUploadFormats';
import { useMyAlbumVideos, updateMyVideoType, deleteMyVideo } from 'api/myAlbumVideosFe';
import { bumpPhotosAlbumCacheBust } from 'api/photoCacheBust';
import {
  invalidateMyPicksFeedCache,
  addMyPostingPhotos,
  deleteMyPostingPhoto,
  patchMyPostingContent,
  patchMyPostingVisibility,
  postMyPosting,
  useGetMyPicksFeed,
  fetchMyPicksFeedPage,
  fetchPostingLikes,
  togglePostingLike
} from 'api/myPicksFe';
import PostingCommentsDialog from 'views/dashboard/interested/PostingCommentsDialog';
import PostingLikesDialog from 'views/dashboard/interested/PostingLikesDialog';
import usePostingFeedDelete from 'hooks/usePostingFeedDelete';
import api from 'api/axios';
import {
  MY_STORY_UPLOAD_ACCEPT,
  isAllowedPublicVaultMediaFile,
  PUBLIC_VAULT_UPLOAD_MAX_BYTES,
  PUBLIC_VAULT_UPLOAD_MAX_MB
} from 'utils/publicVaultMediaUpload';
import { IconPlus, IconMinus, IconRotate, IconRotateClockwise, IconCheck } from '@tabler/icons-react';
import dragDropClickUploadImg from 'assets/images/dragDropClickUpload.png';
import dragDropPhotoImg from 'assets/images/dragdropphoto.png';
import cameraOrPhotoUploadImg from 'assets/images/cameraorphotoupload.png';
import filmBackground from 'assets/images/filmBackground.png';
import { formatMemberCode, formatSmilesBannerName } from 'utils/memberLabel';
import {
  getDesktopButtonFontSizeVw,
  getDesktopTextFontSizeVw,
  getDesktopTitleFontSizeVw
} from 'config/desktopFontEnv';
import {
  getMobileSinglesButtonFontSizeVw,
  getMobileSinglesTextFontSizeVw,
  getMobileSinglesTitleFontSizeVw
} from 'config/singlesMemberCardFontEnv';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { SIDEBAR_MOBILE_CLOSE_MEDIA } from 'config/sidebarMobileCloseEnv';
import { LIGHT_SURFACE_CLASS } from 'utils/themeContrast';
import {
  buttonHoverMagnifyFontSx,
  buttonHoverMagnifyTransitionSx,
  getHoverMagnifyFactor,
  hoverMagnifyFontSizeSx
} from 'config/hoverMagnifyEnv';
import PageInstructionEarnTokensAction from 'ui-component/PageInstructionEarnTokensAction';
import { PROFILES_RECORDS_PATH, PROFILES_RECORDS_TAB_PAY_HISTORY } from 'constants/profilesRecordsRoute';
import {
  clearRefereeRewardUxAfterProfileSetup,
  shouldShowRefereeRewardUxAfterProfileSetup
} from 'utils/signupReferralCode';
import { MyAlbumPostingsInstructionPopup } from 'views/utilities/MyAlbumPostingsInstruction';
import ProfilePhotoUploadQrPanel from 'components/ProfilePhotoUploadQrPanel';
import { ERROR_VAR } from 'utils/themeConfig';
import { themedAlert } from 'utils/themedDialog';

const myStoryButtonFontSize = {
  xs: getMobileSinglesButtonFontSizeVw(),
  sm: getDesktopButtonFontSizeVw()
};

/** Uploaded / Public / Private / Deleted album row titles — fe/.env MOBILE_FONT_SIZE_TITLE / DESKTOP_FONT_SIZE_TITLE */
const myStoryAlbumTitleFontSize = {
  xs: getMobileSinglesTitleFontSizeVw(),
  sm: getDesktopTitleFontSizeVw()
};

function scaleResponsiveVwFontSize(fontSizeResponsive, scale) {
  const scaleVw = (value) => {
    const match = String(value ?? '').trim().match(/^([\d.]+)vw$/);
    if (!match) return value;
    const scaled = parseFloat(match[1]) * scale;
    return `${scaled}vw`;
  };
  return {
    xs: scaleVw(fontSizeResponsive.xs),
    sm: scaleVw(fontSizeResponsive.sm)
  };
}

/** Private album title is longer — cap 25% below other album panel titles */
const myStoryPrivateAlbumTitleFontSize = scaleResponsiveVwFontSize(myStoryAlbumTitleFontSize, 0.75);

/** "Drop photos here" — fe/.env MOBILE_FONT_SIZE_TEXT / DESKTOP_FONT_SIZE_TEXT */
const myStoryAlbumDropHintFontSize = {
  xs: getMobileSinglesTextFontSizeVw(),
  sm: getDesktopTextFontSizeVw()
};

function buildMyStoryMediaFileName({ baseName, fileExtension, fallbackId }) {
  const ext = String(fileExtension || '').replace(/^\./, '').trim();
  let base = String(baseName ?? '').trim();
  if (!base) base = String(fallbackId ?? '');
  if (!base) return ext ? `.${ext}` : 'file';
  if (ext && !base.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
    return `${base}.${ext}`;
  }
  return base;
}

function formatMyStoryMediaHoverLabel({ baseName, fileExtension, fileSizeBytes, fallbackId }) {
  const fileName = buildMyStoryMediaFileName({ baseName, fileExtension, fallbackId });
  const sizeBytes = Number(fileSizeBytes);
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) return fileName;
  const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(1);
  return `${fileName} (${sizeMb}mb)`;
}

function formatMyStoryPhotoHoverLabel(photo) {
  return formatMyStoryMediaHoverLabel({
    baseName: photo?.photo_file_name ?? photo?.photos_id,
    fileExtension: photo?.file_extension,
    fileSizeBytes: photo?.file_size_bytes,
    fallbackId: photo?.photos_id
  });
}

function formatMyStoryVideoHoverLabel(video) {
  return formatMyStoryMediaHoverLabel({
    baseName: video?.video_file_name ?? video?.video_id,
    fileExtension: video?.file_extension,
    fileSizeBytes: video?.file_size_bytes,
    fallbackId: video?.video_id
  });
}

const myStoryAlbumMediaHoverLabelSx = {
  position: 'absolute',
  inset: 0,
  zIndex: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  p: 0.5,
  bgcolor: 'rgba(0,0,0,0.35)',
  opacity: 0,
  pointerEvents: 'none',
  transition: 'opacity 0.15s ease'
};

const myStoryAlbumMediaHoverLabelTextSx = {
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 800,
  fontSize: { xs: '0.55rem', sm: '0.65rem' },
  lineHeight: 1.15,
  textAlign: 'center',
  wordBreak: 'break-word',
  color: `var(${ERROR_VAR})`,
  WebkitTextFillColor: `var(${ERROR_VAR})`,
  WebkitTextStroke: '1px #000000',
  paintOrder: 'stroke fill',
  textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
};

/** Album panel title bar — UnSelectedButtonTemplate colors, non-interactive */
const myStoryAlbumPanelTitleButtonSx = {
  mb: 1,
  width: '100%',
  cursor: 'default',
  pointerEvents: 'none',
  boxShadow: 'none',
  fontWeight: 700,
  minHeight: 'unset',
  py: { xs: 0.75, sm: 0.85 },
  overflow: 'visible',
  textAlign: 'center',
  transform: 'none !important',
  '@media (hover: hover)': {
    '&:hover:not(.Mui-disabled)': {
      transform: 'none !important',
      boxShadow: 'none'
    }
  }
};

/** Red dotted outline around Add New Posting (4× the prior 4px dashed weight). */
const ADD_NEW_POSTING_BORDER = '16px dotted #d32f2f';

/** Uploaded / Public / Private / Public Video Vault album panels */
const MY_STORY_ALBUM_PANEL_BORDER = '5px solid #d32f2f';

const MOBILE_UPLOAD_MAX_CSS = '(max-width:768px)';
/** Mobile upload strip below editor — solid panel behind camera/gallery graphic */
const MOBILE_UPLOAD_SURFACE_BG = '#C7E6C8';

const ACCEPT = MY_STORY_UPLOAD_ACCEPT;
/** Keep file inputs mounted (not display:none) so macOS Finder "Open" reliably fires onChange. */
const MY_STORY_FILE_INPUT_PROPS = { hidden: true, tabIndex: -1, 'aria-hidden': true };
const ALBUM_TYPES = {
  uploaded: 'uploaded',
  public: 'public',
  private: 'private'
};
const ALBUM_TITLES = {
  [ALBUM_TYPES.uploaded]: 'Uploaded',
  [ALBUM_TYPES.public]: 'Public Album: Visible to ALL',
  [ALBUM_TYPES.private]: 'Acquaint & Buddies Album'
};

/** Embedded Youtube Player Play N (1-based) opened from album title click. */
const ALBUM_YOUTUBE_PLAY_SLOT_INDEX = {
  [ALBUM_TYPES.public]: 2, // Play 3
  [ALBUM_TYPES.private]: 6, // Play 7
  publicVideo: SLIDE_SHOW_MUSIC_SLOT_INDEX // Play 10
};
const ALBUM_MAX = 10;
const PUBLIC_VIDEO_ALBUM_MAX = 3;
const PUBLIC_VIDEO_ALBUM_TITLE = 'Public Video Vault';
const PUBLIC_VIDEO_ALBUM_HINT =
  'New videos and audio save here automatically (3 max, uploads up to 10 MB). Delete one to add more. Drag to Posting below to share with comments.';
const SECTION_FULL_ERROR = 'Full error message';
const MY_STORY_DELETE_CONFIRM = {
  permanentPhoto: {
    message: 'Do you want to permanently delete this photo?',
    enterConfirms: false
  },
  permanentPhotosBulk: {
    message: 'Do you want to permanently delete the selected photos?',
    enterConfirms: false
  },
  permanentVideo: {
    message: 'Do you want to permanently delete this video?',
    enterConfirms: false
  }
};

const DUPLICATE_UPLOAD_MESSAGE = 'You upload a duplicate file. PLease check again';

function normalizeAlbumType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === ALBUM_TYPES.public) return ALBUM_TYPES.public;
  if (raw === ALBUM_TYPES.private) return ALBUM_TYPES.private;
  if (raw === 'deleted') return null;
  return ALBUM_TYPES.uploaded;
}

const BULK_PHOTO_IDS_MIME = 'application/x-vsingles-photo-ids';

function resolveDroppedVideoIds(e) {
  if (!e.dataTransfer?.types?.includes(SELF_INTRO_VIDEO_ID_MIME)) {
    return [];
  }
  const fromMime = Number(e.dataTransfer.getData(SELF_INTRO_VIDEO_ID_MIME));
  if (Number.isFinite(fromMime) && fromMime > 0) return [fromMime];
  return [];
}

function resolveDroppedPhotoIds(e, draggingPhotoIdsRef) {
  if (e.dataTransfer?.types?.includes(SELF_INTRO_VIDEO_ID_MIME)) {
    return [];
  }
  const bulkRaw = e.dataTransfer.getData(BULK_PHOTO_IDS_MIME);
  if (bulkRaw) {
    try {
      const parsed = JSON.parse(bulkRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return [...new Set(parsed.map(Number).filter((id) => Number.isFinite(id) && id > 0))];
      }
    } catch {
      /* fall through to single-id resolution */
    }
  }
  const idFromTransfer = Number(e.dataTransfer.getData('text/plain'));
  const idFromCustom = Number(e.dataTransfer.getData('application/x-vsingles-photo-id'));
  if (Number.isFinite(idFromTransfer) && idFromTransfer > 0) return [idFromTransfer];
  if (Number.isFinite(idFromCustom) && idFromCustom > 0) return [idFromCustom];
  const fallback = draggingPhotoIdsRef.current ?? [];
  return fallback.length ? [...fallback] : [];
}

function fileListToArray(files) {
  if (!files) return [];
  return Array.from(files);
}

/** Phone / compact sidebar viewports — grow with content; avoid trapped 0-height flex columns. */
function myStoryPageShellSx(phoneLayout) {
  return phoneLayout
    ? { flex: '0 1 auto', minHeight: 'auto', overflow: 'visible', width: '100%' }
    : { flex: '1 1 0', minHeight: 0, overflow: 'hidden' };
}

const MY_STORY_TAB_KEYS = ['albumsCreate', 'reviewPostings'];
const MY_STORY_TAB_LABEL_BY_KEY = {
  albumsCreate: 'Albums&Create Post',
  reviewPostings: 'Review Postings'
};
const MY_STORY_POSTS_INITIAL_LIMIT = COLOR_TEMPLATE11_POSTING_INITIAL_LIMIT;

/** Fixed site footer clearance — keeps bottom actions (Save, load-more) fully scrollable above footer. */
const MY_STORY_ALBUMS_CREATE_FOOTER_CLEARANCE_PX = 200;

/** Scroll area below fixed banner + tabs (Albums & Create Post tab). */
const myStoryTabBodyScrollSx = {
  flex: '1 1 0',
  minHeight: 0,
  overflowX: 'hidden',
  overscrollBehaviorY: 'contain',
  display: 'flex',
  flexDirection: 'column',
  scrollbarGutter: 'stable',
  scrollbarColor: (theme) =>
    `${theme.palette.mode === 'dark' ? 'var(--theme-secondary-color)' : 'var(--theme-primary-color)'} rgba(0,0,0,0.12)`,
  '&::-webkit-scrollbar': { width: 12 },
  '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0,0,0,0.08)' },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: (theme) =>
      theme.palette.mode === 'dark' ? 'var(--theme-secondary-color)' : 'var(--theme-primary-color)',
    borderRadius: 8
  }
};

/** Copied from VettedFriendsPicksLayout right-panel outer frame (Postings tab). */
const myStoryReviewPostingsOuterFrameSx = {
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  border: '1px solid var(--theme-primary-color)',
  borderRadius: 1,
  bgcolor: 'var(--theme-secondary-color)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
};

/** Copied from VettedFriendsPicksLayout right-panel header row. */
const myStoryReviewPostingsHeaderSx = {
  flexShrink: 0,
  px: 1.5,
  py: 1,
  borderBottom: '1px solid var(--theme-primary-color)',
  bgcolor: (theme) => colorTemplate1WallColorByTheme(theme),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 1
};

/** Copied from VettedFriendsPicksLayout postings content area. */
const myStoryReviewPostingsContentSx = {
  flex: 1,
  minHeight: 0,
  overflowY: 'hidden',
  overflowX: 'hidden',
  overscrollBehaviorY: 'contain',
  p: 1.25,
  display: 'flex',
  flexDirection: 'column',
  scrollbarGutter: 'stable',
  scrollbarColor: (theme) =>
    `${theme.palette.mode === 'dark' ? 'var(--theme-secondary-color)' : 'var(--theme-primary-color)'} rgba(0,0,0,0.12)`,
  '&::-webkit-scrollbar': { width: 12 },
  '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0,0,0,0.08)' },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: (theme) =>
      theme.palette.mode === 'dark' ? 'var(--theme-secondary-color)' : 'var(--theme-primary-color)',
    borderRadius: 8
  }
};

const myStoryReviewPostingsHeaderTitleSx = {
  color: 'var(--theme-primary-color)',
  fontWeight: 700,
  fontSize: { xs: getMobileSinglesTextFontSizeVw(), sm: getDesktopTextFontSizeVw() },
  lineHeight: 1.35
};

const comicStyle = {
  fontFamily: MAIN_FONT_FAMILY,
  color: 'var(--theme-primary-color)'
};

/** Add New Posting / profile photo drop zone — black caption on green panel. */
const myStoryPostingDropCaptionSx = {
  fontFamily: MAIN_FONT_FAMILY,
  textAlign: 'center',
  color: '#000000 !important',
  WebkitTextFillColor: '#000000 !important',
  fontWeight: 700,
  fontSize: 'clamp(1.35rem, 1.4vw, 2rem)',
  lineHeight: 1.25,
  px: 1,
  ...buttonHoverMagnifyTransitionSx,
  '@media (hover: hover)': {
    '.my-story-upload-drop:hover &': hoverMagnifyFontSizeSx({
      baseFontSize: { xs: 'clamp(1.35rem, 1.4vw, 2rem)', sm: 'clamp(1.35rem, 1.4vw, 2rem)' }
    })
  }
};

/** Shared chrome for Member_id, ID, and Nick name fields on My Album & Postings. */
const PROFILE_BASICS_INPUT_TEXT = '#4a4a4a';
const PROFILE_BASICS_READONLY_BG = '#e0e0e0';

const profileBasicsReadOnlyInputSx = {
  width: 'auto',
  minWidth: '12ch',
  flexShrink: 0,
  '& .MuiInputBase-root': {
    bgcolor: PROFILE_BASICS_READONLY_BG
  },
  '& .MuiInputBase-root.Mui-disabled': {
    bgcolor: PROFILE_BASICS_READONLY_BG,
    opacity: 1
  },
  '& .MuiInputBase-input': {
    color: PROFILE_BASICS_INPUT_TEXT,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.04em'
  },
  '& .MuiInputBase-input.Mui-disabled': {
    WebkitTextFillColor: PROFILE_BASICS_INPUT_TEXT,
    cursor: 'default'
  }
};

const motivationalPurpleText = {
  fontFamily: MAIN_FONT_FAMILY,
  color: 'var(--theme-primary-color)',
  fontWeight: 600,
  lineHeight: 1.55,
  fontSize: { xs: '1rem', sm: '1.125rem' }
};

/** Default / aspect ratio for the editor viewport (actual pixel size follows container width). */
const ZOOM_VIEWPORT_W = 380;
const ZOOM_VIEWPORT_H = 420;
const VIEWPORT_ASPECT_RATIO = `${ZOOM_VIEWPORT_W} / ${ZOOM_VIEWPORT_H}`;
/** Editor zoom slider: −50 … +50 (percent) → multiplier 0.5 … 1.5 (desktop & mobile) */
const MOBILE_ZOOM_PCT_MIN = -50;
const MOBILE_ZOOM_PCT_MAX = 50;
const MOBILE_ZOOM_MULT_MIN = 0.5;
const MOBILE_ZOOM_MULT_MAX = 1.5;

function mobileZoomFromPercent(pct) {
  const raw = 1 + pct / 100;
  return Math.min(MOBILE_ZOOM_MULT_MAX, Math.max(MOBILE_ZOOM_MULT_MIN, raw));
}

function mobilePercentFromZoom(z) {
  if (typeof z !== 'number' || Number.isNaN(z)) return 0;
  const pct = Math.round((z - 1) * 100);
  return Math.min(MOBILE_ZOOM_PCT_MAX, Math.max(MOBILE_ZOOM_PCT_MIN, pct));
}

/** Editor rotation slider: −180 … +180 degrees */
const MOBILE_ROT_DEG_MIN = -180;
const MOBILE_ROT_DEG_MAX = 180;

/** Photo editor overlay controls: zoom ±, Original, Pan, Crop — same on desktop & mobile. */
const EDITOR_CHROME_BG = '#FBDF1B';
const EDITOR_CHROME_FG = '#000000';
const EDITOR_CHROME_BORDER = `1px solid ${EDITOR_CHROME_FG}`;

/** MUI Slider chrome — yellow editor bars (zoom + rotate). */
const mobileEditorSliderSx = {
  flex: 1,
  mx: 0.5,
  color: EDITOR_CHROME_FG,
  '& .MuiSlider-thumb': {
    width: 14,
    height: 14,
    bgcolor: EDITOR_CHROME_BG,
    border: EDITOR_CHROME_BORDER,
    '&:hover, &.Mui-focusVisible': { boxShadow: '0 0 0 4px rgba(0,0,0,0.12)' }
  },
  '& .MuiSlider-track': { bgcolor: '#000000', border: 'none' },
  '& .MuiSlider-rail': { bgcolor: 'rgba(0,0,0,0.22)' }
};

/** Zoom/rotate rows sit above & below the photo frame (not overlaid on the image). */
const mobileEditorSliderRowSx = {
  width: '100%',
  maxWidth: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 0.75,
  flexShrink: 0,
  bgcolor: EDITOR_CHROME_BG,
  borderRadius: 1,
  px: 1,
  py: 0.75,
  border: EDITOR_CHROME_BORDER,
  boxSizing: 'border-box'
};

const photoEditorActionBtnSx = {
  fontWeight: 700,
  fontSize: myStoryButtonFontSize,
  minWidth: 64,
  py: 0.5,
  flexShrink: 0,
  transformOrigin: 'center center',
  zIndex: 1,
  ...buttonHoverMagnifyTransitionSx,
  '@media (hover: hover)': {
    '&:hover:not(.Mui-disabled)': buttonHoverMagnifyFontSx({ baseFontSize: myStoryButtonFontSize })
  }
};

/** Pan ON: error surface + white label; hover still magnifies label text only. */
const panModeOnBtnSx = {
  bgcolor: 'var(--theme-error-color) !important',
  color: 'var(--theme-white-color) !important',
  WebkitTextFillColor: 'var(--theme-white-color) !important',
  '@media (hover: hover)': {
    '&:hover:not(.Mui-disabled)': {
      bgcolor: 'var(--theme-error-color) !important',
      color: 'var(--theme-white-color) !important',
      WebkitTextFillColor: 'var(--theme-white-color) !important',
      ...buttonHoverMagnifyFontSx({ baseFontSize: myStoryButtonFontSize })
    }
  }
};

/** Raster “UPLOAD” graphic in drag-drop zones — grow graphic on hover (text is baked into PNG). */
const myStoryUploadGraphicHoverSx = {
  transition: 'transform 0.15s ease',
  transformOrigin: 'center center',
  '@media (hover: hover)': {
    '.my-story-upload-drop:hover &': {
      transform: `scale(${getHoverMagnifyFactor()})`
    }
  }
};

/** Full zoom viewport — white + image at current pan/zoom/rotate (size matches on-screen viewport). */
function renderViewportCanvas(img, nw, nh, zoom, panX, panY, Vw, Vh, rotationDeg = 0) {
  const scaleFit = Math.min(Vw / nw, Vh / nh);
  const baseW = nw * scaleFit;
  const baseH = nh * scaleFit;
  const canvas = document.createElement('canvas');
  canvas.width = Vw;
  canvas.height = Vh;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, Vw, Vh);
  if (!rotationDeg) {
    const dispW = baseW * zoom;
    const dispH = baseH * zoom;
    const imgLeft = Vw / 2 + panX - dispW / 2;
    const imgTop = Vh / 2 + panY - dispH / 2;
    ctx.drawImage(img, 0, 0, nw, nh, imgLeft, imgTop, dispW, dispH);
    return canvas;
  }
  ctx.save();
  ctx.translate(Vw / 2 + panX, Vh / 2 + panY);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  ctx.scale(zoom, zoom);
  ctx.drawImage(img, 0, 0, nw, nh, -baseW / 2, -baseH / 2, baseW, baseH);
  ctx.restore();
  return canvas;
}

function viewportSnapshotToDataUrl(img, nw, nh, zoom, panX, panY, Vw, Vh, rotationDeg = 0) {
  return renderViewportCanvas(img, nw, nh, zoom, panX, panY, Vw, Vh, rotationDeg).toDataURL('image/jpeg', 0.92);
}

const StoryPhotoEditor = forwardRef(function StoryPhotoEditor({ photosId, photoCacheBust, onPhotoSaved, onSaveError }, ref) {
  const [displayUrl, setDisplayUrl] = useState(null);
  const originalUrlRef = useRef(null);
  const createdUrlsRef = useRef([]);
  const [loadError, setLoadError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  /** Degrees −180 … 180; mobile rotation slider + export (desktop keeps 0 unless resized from mobile). */
  const [rotationDeg, setRotationDeg] = useState(0);
  /** When false: primary-styled button, no drag. When true: secondary-styled button, pan overlay + drag. */
  const [panEnabled, setPanEnabled] = useState(false);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [cropping, setCropping] = useState(false);
  const imgRef = useRef(null);
  const dragPanRef = useRef(null);
  const viewportBoxRef = useRef(null);
  const [vp, setVp] = useState({ w: ZOOM_VIEWPORT_W, h: ZOOM_VIEWPORT_H });
  const prevVpRef = useRef({ w: ZOOM_VIEWPORT_W, h: ZOOM_VIEWPORT_H });

  useLayoutEffect(() => {
    const el = viewportBoxRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      const w = Math.max(1, Math.round(cr.width));
      const h = Math.max(1, Math.round(cr.height));
      setVp({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const prev = prevVpRef.current;
    if (prev.w > 0 && prev.h > 0 && vp.w > 0 && vp.h > 0 && (prev.w !== vp.w || prev.h !== vp.h)) {
      setPanX((x) => x * (vp.w / prev.w));
      setPanY((y) => y * (vp.h / prev.h));
    }
    prevVpRef.current = vp;
  }, [vp.w, vp.h]);

  useEffect(() => {
    if (!panEnabled) dragPanRef.current = null;
  }, [panEnabled]);

  /** Keep zoom within editor slider range (0.5×–1.5×). */
  useEffect(() => {
    setZoom((z) => Math.min(MOBILE_ZOOM_MULT_MAX, Math.max(MOBILE_ZOOM_MULT_MIN, z)));
  }, []);

  const revokeAllCreated = useCallback(() => {
    createdUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    createdUrlsRef.current = [];
    originalUrlRef.current = null;
  }, []);

  const reloadFromServer = useCallback(async () => {
    if (!photosId) return;
    createdUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    createdUrlsRef.current = [];
    const res = await api.get(`/api/photo/${photosId}`, {
      responseType: 'blob',
      params: { v: photoCacheBust ?? Date.now() }
    });
    const u = URL.createObjectURL(res.data);
    createdUrlsRef.current.push(u);
    originalUrlRef.current = u;
    setDisplayUrl(u);
    setZoom(1);
    setPanX(0);
    setPanY(0);
    setRotationDeg(0);
    setNatural({ w: 0, h: 0 });
  }, [photosId, photoCacheBust]);

  useEffect(() => {
    if (!photosId) return undefined;
    revokeAllCreated();
    setLoadError(false);
    setDisplayUrl(null);
    setNatural({ w: 0, h: 0 });
    setZoom(1);
    setPanX(0);
    setPanY(0);
    setRotationDeg(0);
    let cancelled = false;
    api
      .get(`/api/photo/${photosId}`, {
        responseType: 'blob',
        params: { v: photoCacheBust ?? Date.now() }
      })
      .then((res) => {
        if (cancelled) return;
        const u = URL.createObjectURL(res.data);
        createdUrlsRef.current.push(u);
        originalUrlRef.current = u;
        setDisplayUrl(u);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
      revokeAllCreated();
    };
  }, [photosId, photoCacheBust, revokeAllCreated]);

  const onImgLoad = useCallback((e) => {
    const el = e.currentTarget;
    setNatural({ w: el.naturalWidth, h: el.naturalHeight });
  }, []);

  const handleReset = useCallback(async () => {
    if (!photosId) return;
    setLoadError(false);
    try {
      const { restored } = await resetMyPhotoFromOrig(photosId);
      if (restored) {
        onPhotoSaved?.(photosId);
      }
      await reloadFromServer();
    } catch {
      setLoadError(true);
    }
  }, [photosId, reloadFromServer, onPhotoSaved]);

  /** Crop = save full zoom viewport to server as {id}.jpg (first time: copies current file to {id}orig.jpg, then overwrites). */
  const handleCropToServer = useCallback(async () => {
    const img = imgRef.current;
    const { w: nw, h: nh } = natural;
    if (!img || !nw || !nh || !photosId) {
      const err = new Error('Photo is still loading. Try again in a moment.');
      onSaveError?.(err);
      throw err;
    }
    const dataUrl = viewportSnapshotToDataUrl(img, nw, nh, zoom, panX, panY, vp.w, vp.h, rotationDeg);
    setCropping(true);
    try {
      await saveMyPhoto(photosId, dataUrl);
      await reloadFromServer();
      onPhotoSaved?.(photosId);
    } catch (e) {
      onSaveError?.(e);
      throw e;
    } finally {
      setCropping(false);
    }
  }, [photosId, natural, zoom, panX, panY, rotationDeg, vp.w, vp.h, reloadFromServer, onPhotoSaved, onSaveError]);

  useImperativeHandle(
    ref,
    () => ({
      cropToServer: () => handleCropToServer(),
      saveViewportToServer: () => handleCropToServer(),
      isReadyForCrop: () => {
        const img = imgRef.current;
        const { w, h } = natural;
        return !!(img && w && h && photosId);
      }
    }),
    [handleCropToServer, natural, photosId]
  );

  const onPanPointerDown = useCallback(
    (e) => {
      if (!displayUrl || !panEnabled) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragPanRef.current = { clientX: e.clientX, clientY: e.clientY, panX, panY };
    },
    [displayUrl, panEnabled, panX, panY]
  );

  const onPanPointerMove = useCallback((e) => {
    if (!dragPanRef.current) return;
    const s = dragPanRef.current;
    setPanX(s.panX + (e.clientX - s.clientX));
    setPanY(s.panY + (e.clientY - s.clientY));
  }, []);

  const onPanPointerUp = useCallback((e) => {
    dragPanRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const { w: nw, h: nh } = natural;
  const { w: Vw, h: Vh } = vp;
  const scaleFit = nw && nh ? Math.min(Vw / nw, Vh / nh) : 1;
  const baseW = nw * scaleFit;
  const baseH = nh * scaleFit;

  if (loadError && photosId) {
    return (
      <Box
        sx={{
          width: '100%',
          maxWidth: '100%',
          aspectRatio: VIEWPORT_ASPECT_RATIO,
          bgcolor: 'grey.200',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ px: 2, textAlign: 'center' }}>
          Could not load photo for editing. Preview may still work from the album.
        </Typography>
      </Box>
    );
  }

  const editorActionButtons = (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 0.5,
        flexWrap: 'nowrap'
      }}
    >
      <YellowButtonTemplate
        type="button"
        size="small"
        onClick={() => handleReset()}
        disabled={!displayUrl || cropping}
        aria-label="Restore original file from backup"
        sx={photoEditorActionBtnSx}
      >
        Original
      </YellowButtonTemplate>
      <YellowButtonTemplate
        type="button"
        size="small"
        onClick={() => setPanEnabled((v) => !v)}
        disabled={!displayUrl || cropping}
        aria-pressed={panEnabled}
        sx={{ ...photoEditorActionBtnSx, ...(panEnabled ? panModeOnBtnSx : null) }}
      >
        Pan
      </YellowButtonTemplate>
      <YellowButtonTemplate
        type="button"
        size="small"
        onClick={() => handleCropToServer()}
        disabled={!displayUrl || !nw || cropping}
        sx={photoEditorActionBtnSx}
      >
        {cropping ? '…' : 'Crop'}
      </YellowButtonTemplate>
    </Box>
  );

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 1
      }}
    >
      {displayUrl ? (
        <Box sx={mobileEditorSliderRowSx}>
          <IconMinus size={18} stroke={2.5} color={EDITOR_CHROME_FG} style={{ flexShrink: 0 }} aria-hidden />
          <Slider
            size="small"
            value={mobilePercentFromZoom(zoom)}
            min={MOBILE_ZOOM_PCT_MIN}
            max={MOBILE_ZOOM_PCT_MAX}
            step={1}
            disabled={!displayUrl}
            onChange={(_, v) => setZoom(mobileZoomFromPercent(v))}
            aria-label="Zoom"
            valueLabelDisplay="off"
            sx={mobileEditorSliderSx}
          />
          <Typography
            variant="caption"
            component="span"
            sx={{
              minWidth: 44,
              textAlign: 'right',
              fontWeight: 700,
              color: EDITOR_CHROME_FG,
              flexShrink: 0,
              fontSize: '0.75rem',
              lineHeight: 1.2
            }}
          >
            {(() => {
              const p = mobilePercentFromZoom(zoom);
              return `${p > 0 ? '+' : ''}${p}%`;
            })()}
          </Typography>
          <IconPlus size={18} stroke={2.5} color={EDITOR_CHROME_FG} style={{ flexShrink: 0 }} aria-hidden />
        </Box>
      ) : null}

      <Box
        ref={viewportBoxRef}
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: '100%',
          aspectRatio: VIEWPORT_ASPECT_RATIO,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'var(--theme-white-color)',
          overflow: 'hidden',
          mx: { xs: 0, md: 0 }
        }}
      >
        {displayUrl ? (
          <Box
            component="img"
            ref={(node) => {
              imgRef.current = node;
            }}
            src={displayUrl}
            alt="Edit"
            onLoad={onImgLoad}
            sx={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: baseW ? `${baseW}px` : 'auto',
              height: baseH ? `${baseH}px` : 'auto',
              maxWidth: nw ? 'none' : `${Vw}px`,
              maxHeight: nh ? 'none' : `${Vh}px`,
              objectFit: 'contain',
              transform: `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) rotate(${rotationDeg}deg) scale(${zoom})`,
              transformOrigin: 'center center',
              userSelect: 'none',
              pointerEvents: 'none',
              zIndex: 0
            }}
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <CircularProgress size={32} />
          </Box>
        )}

        {displayUrl && panEnabled ? (
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none'
            }}
          >
            <Box
              component="svg"
              viewBox="0 0 100 100"
              sx={{ width: { xs: 100, sm: 120 }, height: 'auto', opacity: 0.92 }}
            >
              <g fill="#FFEB3B" stroke="#C9A000" strokeWidth={1.5}>
                <path d="M 50 6 L 64 30 L 36 30 Z" />
                <path d="M 50 94 L 36 70 L 64 70 Z" />
                <path d="M 6 50 L 30 36 L 30 64 Z" />
                <path d="M 94 50 L 70 36 L 70 64 Z" />
              </g>
            </Box>
          </Box>
        ) : null}

        {displayUrl && panEnabled ? (
          <Box
            role="application"
            aria-label="Drag to move the photo"
            onPointerDown={onPanPointerDown}
            onPointerMove={onPanPointerMove}
            onPointerUp={onPanPointerUp}
            onPointerCancel={onPanPointerUp}
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 3,
              cursor: 'grab',
              touchAction: 'none',
              '&:active': { cursor: 'grabbing' }
            }}
          />
        ) : null}

      </Box>

      {displayUrl ? (
        <Box sx={mobileEditorSliderRowSx}>
          <IconRotate size={18} stroke={2.5} color={EDITOR_CHROME_FG} style={{ flexShrink: 0 }} aria-hidden />
          <Slider
            size="small"
            value={rotationDeg}
            min={MOBILE_ROT_DEG_MIN}
            max={MOBILE_ROT_DEG_MAX}
            step={1}
            disabled={!displayUrl}
            onChange={(_, v) => setRotationDeg(v)}
            aria-label="Rotate"
            valueLabelDisplay="off"
            sx={mobileEditorSliderSx}
          />
          <Typography
            variant="caption"
            component="span"
            sx={{
              minWidth: 44,
              textAlign: 'right',
              fontWeight: 700,
              color: EDITOR_CHROME_FG,
              flexShrink: 0,
              fontSize: '0.75rem',
              lineHeight: 1.2
            }}
          >
            {(() => {
              const d = Math.round(rotationDeg);
              return `${d > 0 ? '+' : ''}${d}°`;
            })()}
          </Typography>
          <IconRotateClockwise size={18} stroke={2.5} color={EDITOR_CHROME_FG} style={{ flexShrink: 0 }} aria-hidden />
        </Box>
      ) : null}

      {displayUrl ? editorActionButtons : null}
    </Box>
  );
});

StoryPhotoEditor.displayName = 'StoryPhotoEditor';

async function waitForPhotoEditorReady(editorRef, { timeoutMs = 12000, intervalMs = 80 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (editorRef.current?.isReadyForCrop?.()) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

export default function MyStory() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const downSM = useMediaQuery(theme.breakpoints.down('sm'));
  const myStoryPhoneLayout = useMediaQuery(SIDEBAR_MOBILE_CLOSE_MEDIA);
  const isMobileUpload = useMediaQuery(MOBILE_UPLOAD_MAX_CSS);
  const { user, bumpProfilePhotoCache, updateSessionProfilePhoto, refreshAuthProfilePhoto, updateSessionNickname } = useAuth();
  const { photos, myPhotosLoading, refetchMyPhotos } = useMyPhotos(user?.singles_id);
  const { albumVideos, refetchMyAlbumVideos } = useMyAlbumVideos(user?.singles_id);
  const ownerSinglesId = user?.singles_id ?? null;
  const { myPicksFeed, myPicksFeedLoading, myPicksFeedError, refetchMyPicksFeed } = useGetMyPicksFeed(ownerSinglesId, {
    limit: MY_STORY_POSTS_INITIAL_LIMIT
  });
  const { canDeletePosts, deleteBusy, handleDeletePosting, handleDeletePostingPhoto, deleteConfirmDialog: postingDeleteConfirmDialog } =
    usePostingFeedDelete(ownerSinglesId, { refetchFeed: refetchMyPicksFeed });
  const [feedPosts, setFeedPosts] = useState([]);
  const [feedCursor, setFeedCursor] = useState(null);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [loadMoreBusy, setLoadMoreBusy] = useState(false);
  const [commentsDialog, setCommentsDialog] = useState(null);
  const [likeBusyPostId, setLikeBusyPostId] = useState(null);
  const [visibilityBusyPostId, setVisibilityBusyPostId] = useState(null);
  const [contentBusyPostId, setContentBusyPostId] = useState(null);
  const [attachBusyPostId, setAttachBusyPostId] = useState(null);
  const [likesPostId, setLikesPostId] = useState(null);
  const [likesList, setLikesList] = useState([]);
  const [likesLoading, setLikesLoading] = useState(false);
  const [likesError, setLikesError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [selectedPhotoId, setSelectedPhotoId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deletingVideoId, setDeletingVideoId] = useState(null);
  const [draggingPhotoId, setDraggingPhotoId] = useState(null);
  const [dragOverAlbumType, setDragOverAlbumType] = useState(null);
  const [albumVideoPlaybackId, setAlbumVideoPlaybackId] = useState(null);
  const [albumVideoPlaybackExt, setAlbumVideoPlaybackExt] = useState('');
  const [vaultSlotsFullOpen, setVaultSlotsFullOpen] = useState(false);
  const adminImpersonationUploadBypass = isAdminImpersonationBypassSession(user);
  const profilePhotoId = user?.profile_image_fk ?? null;
  const didInitSelectionRef = useRef(false);
  const userClearedAliasRef = useRef(false);
  const userDismissedSecurityIconRef = useRef(false);
  const [showFirstPhotoDialog, setShowFirstPhotoDialog] = useState(false);
  const [showNicknameDialog, setShowNicknameDialog] = useState(false);
  const [showSecurityIconDialog, setShowSecurityIconDialog] = useState(false);
  const [hasSecretIcon, setHasSecretIcon] = useState(false);
  const [suggestListOpen, setSuggestListOpen] = useState(false);
  const [pendingAutoMakeProfile, setPendingAutoMakeProfile] = useState(false);
  const [maxUploadMb, setMaxUploadMb] = useState(2);
  const [debugPhotoInfo, setDebugPhotoInfo] = useState(false);
  const [profilePhotoWaitDialogOpen, setProfilePhotoWaitDialogOpen] = useState(false);
  const [profilePhotoWaitMessage, setProfilePhotoWaitMessage] = useState('');
  const [profilePhotoConfirmDialogOpen, setProfilePhotoConfirmDialogOpen] = useState(false);
  const [makeProfileBusy, setMakeProfileBusy] = useState(false);
  const pendingMakeProfileRef = useRef(null);
  const [wrongFormatDialogOpen, setWrongFormatDialogOpen] = useState(false);
  const [wrongFormatAttemptFile, setWrongFormatAttemptFile] = useState('');
  const [fileTooLargeDialogOpen, setFileTooLargeDialogOpen] = useState(false);
  const [postingAutoMovedDialogOpen, setPostingAutoMovedDialogOpen] = useState(false);
  const [duplicateUploadDialogOpen, setDuplicateUploadDialogOpen] = useState(false);
  const [fileTooLargeActualMb, setFileTooLargeActualMb] = useState('');
  const [fileTooLargeMaxMb, setFileTooLargeMaxMb] = useState(2);
  const [photoVersion, setPhotoVersion] = useState({});
  const [albumPhotoCacheBust, setAlbumPhotoCacheBust] = useState(() => Date.now());
  const [postingDraftText, setPostingDraftText] = useState('');
  const [postingDraftPhotoIds, setPostingDraftPhotoIds] = useState([]);
  const [postingDraftVideoIds, setPostingDraftVideoIds] = useState([]);
  const [postingDraftVisibility, setPostingDraftVisibility] = useState('public');
  /** When set, Save updates this post instead of creating a new one (double-click from Review). */
  const [editingPostId, setEditingPostId] = useState(null);
  /** Original posting_photos rows loaded into the composer: { postingPhotoId, mediaId, kind }. */
  const [editingPostOriginalMedia, setEditingPostOriginalMedia] = useState([]);
  const [postingVisibilityMenuOpen, setPostingVisibilityMenuOpen] = useState(false);
  const pendingSaveAfterVisibilityRef = useRef(false);
  const addNewPostingSectionRef = useRef(null);
  const [moreSharingPopupOpen, setMoreSharingPopupOpen] = useState(false);
  const [postingDragOver, setPostingDragOver] = useState(false);
  const [postingSaving, setPostingSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [profileBasicsLoading, setProfileBasicsLoading] = useState(true);
  const [profileBasicsMessage, setProfileBasicsMessage] = useState('');
  const [profileBasics, setProfileBasics] = useState({
    id: '',
    prefix: null,
    member_id: '',
    alias: ''
  });
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [activeStoryTab, setActiveStoryTab] = useState('albumsCreate');
  const myStoryReviewFeedScrollRef = useRef(null);
  const scrollReviewFeedToTopRef = useRef(false);
  const storyTabFromNavRef = useRef(null);
  const storyEditorRef = useRef(null);
  const selfIntroVideoFlowRef = useRef(null);
  const pendingAutoMakePhotoIdRef = useRef(null);
  const userPickedPhotoIdRef = useRef(null);
  const fileInputRef = useRef(null);
  const firstPhotoFileInputRef = useRef(null);
  const mobileCameraInputRef = useRef(null);
  const mobileGalleryInputRef = useRef(null);
  const draggingPhotoIdsRef = useRef([]);
  const [bulkSelectedPhotoIds, setBulkSelectedPhotoIds] = useState([]);
  const hasNickname = useMemo(() => {
    const alias = String(profileBasics.alias || user?.alias || '').trim();
    return alias.length > 0;
  }, [profileBasics.alias, user?.alias]);

  useEffect(() => {
    const storyTab = location.state?.storyTab;
    if (storyTab !== 'reviewPostings') return;
    if (storyTabFromNavRef.current === location.key) return;
    storyTabFromNavRef.current = location.key;
    setActiveStoryTab('reviewPostings');
    scrollReviewFeedToTopRef.current = true;
    void refetchMyPicksFeed();
  }, [location.key, location.state, refetchMyPicksFeed]);

  const photosWithType = useMemo(
    () =>
      photos
        .map((p) => ({
          ...p,
          albumType: normalizeAlbumType(p.type)
        }))
        .filter((p) => p.albumType != null),
    [photos]
  );
  const photosByType = useMemo(
    () => ({
      [ALBUM_TYPES.uploaded]: photosWithType.filter((p) => p.albumType === ALBUM_TYPES.uploaded),
      [ALBUM_TYPES.public]: photosWithType.filter((p) => p.albumType === ALBUM_TYPES.public),
      [ALBUM_TYPES.private]: photosWithType.filter((p) => p.albumType === ALBUM_TYPES.private)
    }),
    [photosWithType]
  );
  const videosWithType = useMemo(
    () =>
      albumVideos
        .map((v) => ({
          ...v,
          albumType: normalizeAlbumType(v.type)
        }))
        .filter((v) => v.albumType != null),
    [albumVideos]
  );
  const videosByType = useMemo(
    () => ({
      [ALBUM_TYPES.uploaded]: videosWithType.filter((v) => v.albumType === ALBUM_TYPES.uploaded),
      [ALBUM_TYPES.public]: videosWithType.filter((v) => v.albumType === ALBUM_TYPES.public),
      [ALBUM_TYPES.private]: videosWithType.filter((v) => v.albumType === ALBUM_TYPES.private)
    }),
    [videosWithType]
  );
  const photoCountByType = useCallback(
    (albumType) => photosByType[albumType]?.length || 0,
    [photosByType]
  );
  const videoCountByType = useCallback(
    (albumType) => videosByType[albumType]?.length || 0,
    [videosByType]
  );
  const publicAlbumVideos = videosByType[ALBUM_TYPES.public] || [];
  const uploadedCount = photosByType[ALBUM_TYPES.uploaded].length;
  const maxPhotosReached = uploadedCount >= ALBUM_MAX;

  useEffect(() => {
    const validIds = new Set(photosWithType.map((p) => Number(p.photos_id)));
    setBulkSelectedPhotoIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [photosWithType]);

  const bumpPhotoVersion = useCallback((id) => {
    if (id == null) return;
    setPhotoVersion((v) => ({ ...v, [id]: (v[id] || 0) + 1 }));
  }, []);

  const bumpAlbumPhotoCache = useCallback(() => {
    const bust = bumpPhotosAlbumCacheBust();
    setAlbumPhotoCacheBust(bust);
  }, []);

  const albumPhotoUrl = useCallback(
    (photosId) => {
      const id = Number(photosId);
      if (!Number.isFinite(id) || id < 1) return '';
      const perPhoto = photoVersion[id] ?? 0;
      return myPhotoThumbnailUrl(id, `${albumPhotoCacheBust}-${perPhoto}`);
    },
    [albumPhotoCacheBust, photoVersion]
  );

  const selectedPhotoCacheBust = useMemo(() => {
    const id = Number(selectedPhotoId);
    if (!Number.isFinite(id) || id < 1) return albumPhotoCacheBust;
    return `${albumPhotoCacheBust}-${photoVersion[id] ?? 0}`;
  }, [albumPhotoCacheBust, photoVersion, selectedPhotoId]);

  useEffect(() => {
    fetchUploadLimits().then(({ maxUploadMb: m, debugPhotoInfo: d }) => {
      setMaxUploadMb(m);
      setDebugPhotoInfo(d === true);
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadProfileBasics = async () => {
      setProfileBasicsLoading(true);
      try {
        const { data } = await api.get('/api/settings/profile');
        if (!mounted) return;
        setProfileBasics({
          id: data?.id ?? '',
          prefix: data?.prefix ?? null,
          member_id: data?.member_id ?? '',
          alias: data?.alias ?? ''
        });
        setHasSecretIcon(Boolean(data?.has_secret_icon));
      } catch {
        if (!mounted) return;
        setProfileBasics({
          id: user?.singles_id ?? '',
          prefix: user?.prefix ?? null,
          member_id: user?.member_id ?? '',
          alias: user?.alias ?? ''
        });
      } finally {
        if (mounted) setProfileBasicsLoading(false);
      }
    };
    loadProfileBasics();
    return () => {
      mounted = false;
    };
  }, [user?.member_id, user?.alias, user?.prefix, user?.singles_id]);

  const smilesBannerIdentity = useMemo(() => {
    if (!user) {
      return { displayName: 'you' };
    }
    const fullName = [user.firstname || user.first_name, user.lastname || user.last_name].filter(Boolean).join(' ').trim();
    return {
      displayName: formatSmilesBannerName({
        alias: profileBasics.alias || user.alias,
        singlesId: user.singles_id,
        prefix: profileBasics.prefix ?? user.prefix,
        memberId: profileBasics.member_id ?? user.member_id,
        fullName,
        fallback: 'you'
      })
    };
  }, [
    user,
    profileBasics.alias,
    profileBasics.prefix,
    profileBasics.member_id
  ]);

  const handleVaultMediaFiles = useCallback(
    async (files) => {
      const fileArray = fileListToArray(files);
      if (!fileArray.length) return;

      const vaultSlotsLeft = PUBLIC_VIDEO_ALBUM_MAX - publicAlbumVideos.length;
      if (vaultSlotsLeft < 1) {
        setVaultSlotsFullOpen(true);
        return;
      }

      const maxUploadCount = Math.min(fileArray.length, vaultSlotsLeft);
      if (fileArray.length > maxUploadCount) {
        setUploadError(
          `Public Video Vault has room for ${maxUploadCount} more file${maxUploadCount === 1 ? '' : 's'} right now.`
        );
      } else {
        setUploadError('');
      }

      const knownVaultByteSizes = new Set(
        publicAlbumVideos.map((v) => v.file_size_bytes).filter((size) => Number.isFinite(size) && size > 0)
      );

      setUploading(true);
      try {
        for (let i = 0; i < maxUploadCount; i += 1) {
          const file = fileArray[i];
          if (!isAllowedPublicVaultMediaFile(file)) {
            setWrongFormatAttemptFile(file.name);
            setWrongFormatDialogOpen(true);
            continue;
          }
          if (!adminImpersonationUploadBypass && file.size > PUBLIC_VAULT_UPLOAD_MAX_BYTES) {
            setFileTooLargeActualMb((file.size / (1024 * 1024)).toFixed(2));
            setFileTooLargeMaxMb(String(PUBLIC_VAULT_UPLOAD_MAX_MB));
            setFileTooLargeDialogOpen(true);
            continue;
          }
          if (knownVaultByteSizes.has(file.size)) {
            setDuplicateUploadDialogOpen(true);
            continue;
          }
          try {
            await uploadPublicVaultMediaFile(file);
            knownVaultByteSizes.add(file.size);
          } catch (uploadErr) {
            const data = uploadErr?.response?.data;
            const msg = data?.error || uploadErr?.message || 'Upload failed';
            if (data?.code === 'DUPLICATE_UPLOAD') {
              setDuplicateUploadDialogOpen(true);
            } else if (String(msg).toLowerCase().includes('full')) {
              setVaultSlotsFullOpen(true);
            } else if (
              !adminImpersonationUploadBypass &&
              (String(msg).toLowerCase().includes('exceeds') || String(msg).toLowerCase().includes('limit'))
            ) {
              setFileTooLargeActualMb((file.size / (1024 * 1024)).toFixed(2));
              setFileTooLargeMaxMb(String(PUBLIC_VAULT_UPLOAD_MAX_MB));
              setFileTooLargeDialogOpen(true);
            } else {
              setUploadError(msg);
            }
          }
        }
        await refetchMyAlbumVideos();
      } finally {
        setUploading(false);
      }
    },
    [adminImpersonationUploadBypass, publicAlbumVideos, refetchMyAlbumVideos]
  );

  const handlePhotoFiles = useCallback(
    async (files, { targetAlbumType = null } = {}) => {
      const fileArray = fileListToArray(files);
      if (!fileArray.length) return;

      const uploadedSlotsLeft = ALBUM_MAX - (photosByType[ALBUM_TYPES.uploaded]?.length ?? 0);
      const destinationAlbumType =
        targetAlbumType && targetAlbumType !== ALBUM_TYPES.uploaded ? normalizeAlbumType(targetAlbumType) : null;
      const destinationSlotsLeft = destinationAlbumType
        ? ALBUM_MAX - (photosByType[destinationAlbumType]?.length ?? 0)
        : uploadedSlotsLeft;
      const maxUploadCount = destinationAlbumType
        ? Math.min(fileArray.length, uploadedSlotsLeft, destinationSlotsLeft)
        : Math.min(fileArray.length, uploadedSlotsLeft);

      if (maxUploadCount < 1) {
        if (destinationAlbumType) {
          const fullMessage =
            destinationSlotsLeft < 1
              ? SECTION_FULL_ERROR
              : 'Uploaded album is full. Please move or delete one before uploading more.';
          setUploadError(fullMessage);
        } else {
          setUploadError('Uploaded album is full. Please move or delete one before uploading more.');
        }
        return;
      }

      if (fileArray.length > maxUploadCount) {
        setUploadError(`Only ${maxUploadCount} more photo${maxUploadCount === 1 ? '' : 's'} can be added right now.`);
      }

      setUploadError('');
      setUploading(true);
      let uploadedProfileId = null;
      try {
        for (let i = 0; i < maxUploadCount; i += 1) {
          const file = fileArray[i];
          if (!isAllowedAlbumPhotoFile(file)) {
            setWrongFormatAttemptFile(file.name);
            setWrongFormatDialogOpen(true);
            continue;
          }
          const photoMaxBytes = maxUploadMb * 1024 * 1024;
          if (!adminImpersonationUploadBypass && file.size > photoMaxBytes) {
            setFileTooLargeActualMb((file.size / (1024 * 1024)).toFixed(2));
            setFileTooLargeMaxMb(String(maxUploadMb));
            setFileTooLargeDialogOpen(true);
            continue;
          }
          let result;
          try {
            result = await uploadMyPhoto(file);
          } catch (uploadErr) {
            const status = uploadErr.response?.status;
            const data = uploadErr.response?.data;
            const msg = data?.error || uploadErr.message;
            const isNginx413 = status === 413 && (!data?.code || typeof data === 'string');

            console.error('[MyStory upload catch]', {
              fileName: file.name,
              fileSizeMb: (file.size / (1024 * 1024)).toFixed(2),
              httpStatus: status,
              responseCode: data?.code,
              errorMsg: msg,
              isNginx413,
              fullResponse: data
            });

            if (
              !adminImpersonationUploadBypass &&
              (data?.code === 'FILE_TOO_LARGE' ||
                data?.code === 'REQUEST_BODY_TOO_LARGE' ||
                status === 413 ||
                (msg && String(msg).includes('Maximum we allow')))
            ) {
              const limits = await fetchUploadLimits();
              setFileTooLargeActualMb((file.size / (1024 * 1024)).toFixed(2));
              setFileTooLargeMaxMb(limits.maxUploadMb);
              setFileTooLargeDialogOpen(true);

              if (isNginx413) {
                console.error(
                  '%c[MyStory] NGINX is blocking uploads! Fix: add "client_max_body_size 20M;" to nginx server block, then reload nginx.',
                  'color: red; font-weight: bold; font-size: 14px'
                );
              }
            } else {
              setUploadError(msg || 'Upload failed');
            }
            continue;
          }
          const newId = result?.photos_id;
          if (newId) {
            if (destinationAlbumType) {
              try {
                await updateMyPhotoType(newId, destinationAlbumType);
              } catch (moveErr) {
                setUploadError(moveErr?.response?.data?.error || moveErr?.message || 'Failed to move uploaded photo');
                continue;
              }
            }
            uploadedProfileId = newId;
            bumpPhotoVersion(newId);
            setSelectedPhotoId(newId);
            didInitSelectionRef.current = true;
          }
          if (result?.replacedDuplicate) {
            setDuplicateUploadDialogOpen(true);
          }
        }
        await refetchMyPhotos();
        bumpAlbumPhotoCache();
        if (uploadedProfileId && !profilePhotoId) {
          pendingAutoMakePhotoIdRef.current = Number(uploadedProfileId);
          setShowFirstPhotoDialog(false);
          setPendingAutoMakeProfile(true);
        }
      } catch (err) {
        setUploadError(err.response?.data?.error || err.message || 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [
      adminImpersonationUploadBypass,
      refetchMyPhotos,
      photosByType,
      profilePhotoId,
      bumpAlbumPhotoCache,
      bumpPhotoVersion,
      maxUploadMb
    ]
  );

  const handleFiles = useCallback(
    async (files, { targetAlbumType = null } = {}) => {
      const fileArray = fileListToArray(files);
      if (!fileArray.length) return;

      const photoFiles = [];
      const vaultFiles = [];
      for (const file of fileArray) {
        if (isAllowedPublicVaultMediaFile(file)) {
          vaultFiles.push(file);
        } else if (isAllowedAlbumPhotoFile(file)) {
          photoFiles.push(file);
        } else {
          setWrongFormatAttemptFile(file.name);
          setWrongFormatDialogOpen(true);
        }
      }

      if (vaultFiles.length) {
        await handleVaultMediaFiles(vaultFiles);
      }
      if (photoFiles.length) {
        await handlePhotoFiles(photoFiles, { targetAlbumType });
      }
    },
    [handleVaultMediaFiles, handlePhotoFiles]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      void handleFiles(fileListToArray(e.dataTransfer?.files));
    },
    [handleFiles]
  );

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const onSelectFile = useCallback(
    (e) => {
      const files = fileListToArray(e.target.files);
      e.target.value = '';
      if (!files.length) return;
      void handleFiles(files);
    },
    [handleFiles]
  );

  const triggerFilePicker = useCallback(
    (inputRef) => {
      if (maxPhotosReached) {
        setUploadError('Uploaded album is full. Please move or delete one before uploading more.');
        return;
      }
      inputRef.current?.click();
    },
    [maxPhotosReached]
  );

  const handlePhoneUploadComplete = useCallback(
    async (photosId, { replacedDuplicate = false } = {}) => {
      const id = Number(photosId);
      await refetchMyPhotos();
      if (!Number.isFinite(id) || id < 1) return;
      updateSessionProfilePhoto(id);
      bumpProfilePhotoCache();
      bumpPhotoVersion(id);
      bumpAlbumPhotoCache();
      await refreshAuthProfilePhoto();
      setSelectedPhotoId(id);
      didInitSelectionRef.current = true;
      setShowFirstPhotoDialog(false);
      if (!profilePhotoId) {
        pendingAutoMakePhotoIdRef.current = id;
        setPendingAutoMakeProfile(true);
      }
      if (replacedDuplicate) {
        setDuplicateUploadDialogOpen(true);
      }
    },
    [refetchMyPhotos, updateSessionProfilePhoto, refreshAuthProfilePhoto, bumpProfilePhotoCache, bumpPhotoVersion, bumpAlbumPhotoCache, profilePhotoId]
  );

  useEffect(() => {
    didInitSelectionRef.current = false;
    pendingAutoMakePhotoIdRef.current = null;
    userPickedPhotoIdRef.current = null;
    setPendingAutoMakeProfile(false);
    setSelectedPhotoId(null);
  }, [user?.singles_id]);

  useEffect(() => {
    if (didInitSelectionRef.current) return;
    if (!user?.singles_id) return;
    if (myPhotosLoading) return;
    if (profilePhotoId && photos.some((p) => p.photos_id === profilePhotoId)) {
      setSelectedPhotoId(profilePhotoId);
    }
    didInitSelectionRef.current = true;
  }, [user?.singles_id, photos, profilePhotoId, myPhotosLoading]);

  useEffect(() => {
    if (uploading || pendingAutoMakeProfile) return;
    const protectedId = pendingAutoMakePhotoIdRef.current ?? userPickedPhotoIdRef.current;
    if (protectedId != null && selectedPhotoId != null && Number(selectedPhotoId) === Number(protectedId)) return;
    if (selectedPhotoId != null && !photos.some((p) => p.photos_id === selectedPhotoId)) {
      setSelectedPhotoId(null);
    }
  }, [photos, selectedPhotoId, uploading, pendingAutoMakeProfile]);

  useEffect(() => {
    if (myPhotosLoading || !user?.singles_id) return;
    if (profilePhotoId) {
      setShowFirstPhotoDialog(false);
      return;
    }
    if (photos.length === 0) {
      setShowFirstPhotoDialog(true);
      return;
    }
    setShowFirstPhotoDialog(false);
    // Do not auto-run Make this Profile on pre-existing album rows (orphan/demo/stale cache).
    // Auto-make runs only after the member uploads in this session (see handleFiles).
  }, [myPhotosLoading, profilePhotoId, user?.singles_id, photos.length]);

  const runMakeThisProfile = useCallback(
    async (photoId, { tryCrop = true, resetProfilePhotoVetting: shouldResetProfilePhotoVetting = false } = {}) => {
      const id = Number(photoId ?? selectedPhotoId);
      if (!Number.isFinite(id) || id < 1) return;
      const wasFirstProfileSetup =
        !Number.isFinite(Number(profilePhotoId)) || Number(profilePhotoId) < 1;
      setUploadError('');
      try {
        if (tryCrop) {
          const ready = await waitForPhotoEditorReady(storyEditorRef);
          if (ready) {
            try {
              await storyEditorRef.current.cropToServer();
            } catch (cropErr) {
              console.warn('[MyStory] Auto crop skipped; setting profile photo anyway', cropErr?.message ?? cropErr);
            }
          }
        }
        await setProfilePhoto(id);
        if (shouldResetProfilePhotoVetting) {
          await resetProfilePhotoVetting();
        }
        updateSessionProfilePhoto(id);
        bumpProfilePhotoCache();
        await refreshAuthProfilePhoto();
        setShowFirstPhotoDialog(false);
        setSelectedPhotoId(id);
        userPickedPhotoIdRef.current = id;
        didInitSelectionRef.current = true;
        pendingAutoMakePhotoIdRef.current = null;
        if (wasFirstProfileSetup && shouldShowRefereeRewardUxAfterProfileSetup()) {
          clearRefereeRewardUxAfterProfileSetup();
          navigate(PROFILES_RECORDS_PATH, {
            state: { openTab: PROFILES_RECORDS_TAB_PAY_HISTORY, showRefereeRewardPopup: true }
          });
          return;
        }
        if (!String(profileBasics.alias || user?.alias || '').trim()) {
          setShowNicknameDialog(true);
        }
      } catch (err) {
        setUploadError(err?.response?.data?.error || err?.message || 'Failed to crop or set profile photo');
        throw err;
      }
    },
    [
      selectedPhotoId,
      profilePhotoId,
      updateSessionProfilePhoto,
      refreshAuthProfilePhoto,
      bumpProfilePhotoCache,
      profileBasics.alias,
      user?.alias,
      navigate
    ]
  );

  useEffect(() => {
    if (!pendingAutoMakeProfile) return undefined;
    const photoId = pendingAutoMakePhotoIdRef.current;
    if (!photoId) return undefined;

    let cancelled = false;
    (async () => {
      setShowFirstPhotoDialog(false);
      setSelectedPhotoId(photoId);
      didInitSelectionRef.current = true;
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (cancelled) return;
      try {
        await runMakeThisProfile(photoId, { tryCrop: true });
      } catch {
        // runMakeThisProfile sets uploadError
      } finally {
        if (!cancelled) {
          setPendingAutoMakeProfile(false);
          pendingAutoMakePhotoIdRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pendingAutoMakeProfile, runMakeThisProfile]);

  useEffect(() => {
    if (!profilePhotoId || pendingAutoMakeProfile || selectedPhotoId != null) return;
    if (!photos.some((p) => Number(p.photos_id) === Number(profilePhotoId))) return;
    setSelectedPhotoId(Number(profilePhotoId));
    userPickedPhotoIdRef.current = Number(profilePhotoId);
    didInitSelectionRef.current = true;
  }, [profilePhotoId, photos, pendingAutoMakeProfile, selectedPhotoId]);

  useEffect(() => {
    if (userClearedAliasRef.current) return;
    if (myPhotosLoading || pendingAutoMakeProfile || showFirstPhotoDialog) return;
    if (!profilePhotoId || hasNickname) {
      if (hasNickname) setShowNicknameDialog(false);
      return;
    }
    setShowNicknameDialog(true);
  }, [myPhotosLoading, profilePhotoId, hasNickname, pendingAutoMakeProfile, showFirstPhotoDialog]);

  const handleNicknameSaved = useCallback(
    (nickname) => {
      const next = String(nickname ?? '').trim();
      if (next) userClearedAliasRef.current = false;
      setProfileBasics((prev) => ({ ...prev, alias: next }));
      updateSessionNickname(next);
      setShowNicknameDialog(false);
      setSuggestListOpen(false);
      setProfileBasicsMessage(next ? 'Nickname saved.' : 'Nickname removed.');
      if (next && !hasSecretIcon) {
        setShowSecurityIconDialog(true);
      }
    },
    [updateSessionNickname, hasSecretIcon]
  );

  const handleSecretIconSaved = useCallback(() => {
    const isFirstSecurityIconSave = !hasSecretIcon;
    userDismissedSecurityIconRef.current = false;
    setHasSecretIcon(true);
    setShowSecurityIconDialog(false);
    setProfileBasicsMessage('Security icon saved.');
    if (isFirstSecurityIconSave) {
      markSignupIdentificationVerificationRequired();
      navigate(SELF_REPORT_BIOGRAPHY_PATH, {
        state: { openIdentificationVerification: true }
      });
    }
  }, [navigate, hasSecretIcon]);

  const handleSecurityIconDialogClose = useCallback(() => {
    userDismissedSecurityIconRef.current = true;
    setShowSecurityIconDialog(false);
  }, []);

  useEffect(() => {
    if (userDismissedSecurityIconRef.current) return;
    if (profileBasicsLoading || showNicknameDialog || suggestListOpen || showSecurityIconDialog) return;
    if (!hasNickname || hasSecretIcon) return;
    setShowSecurityIconDialog(true);
  }, [profileBasicsLoading, hasNickname, hasSecretIcon, showNicknameDialog, suggestListOpen, showSecurityIconDialog]);

  const openNicknameEditor = useCallback(() => {
    setProfileBasicsMessage('');
    setSuggestListOpen(true);
  }, []);

  const movePhotoToAlbumType = useCallback(
    async (photo, targetType) => {
      if (!photo || !targetType) return;
      const currentType = normalizeAlbumType(photo.type);
      if (currentType === targetType) return;

      const destinationCount = photoCountByType(targetType);
      if (destinationCount >= ALBUM_MAX) {
        await themedAlert(SECTION_FULL_ERROR);
        return;
      }

      try {
        await updateMyPhotoType(photo.photos_id, targetType);
        bumpAlbumPhotoCache();
        await refetchMyPhotos();
      } catch (err) {
        await themedAlert(err?.response?.data?.error || err?.message || 'Failed to move photo');
      }
    },
    [photoCountByType, refetchMyPhotos, bumpAlbumPhotoCache]
  );

  const moveVideoToAlbumType = useCallback(
    async (video, targetType) => {
      if (!video || !targetType) return;
      const videoId = Number(video.video_id);
      if (!Number.isFinite(videoId) || videoId < 1) return;
      const currentType = normalizeAlbumType(video.type);
      if (currentType == null || currentType === targetType) return;

      const destinationCount = videoCountByType(targetType);
      const videoCap = targetType === ALBUM_TYPES.public ? PUBLIC_VIDEO_ALBUM_MAX : ALBUM_MAX;
      if (destinationCount >= videoCap) {
        await themedAlert(SECTION_FULL_ERROR);
        return;
      }

      try {
        await updateMyVideoType(videoId, targetType);
        await refetchMyAlbumVideos();
      } catch (err) {
        await themedAlert(err?.response?.data?.error || err?.message || 'Failed to move video');
      }
    },
    [videoCountByType, refetchMyAlbumVideos]
  );

  const executePermanentDeleteIds = useCallback(
    async (rawIds) => {
      const ids = [...new Set((Array.isArray(rawIds) ? rawIds : []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
      if (!ids.length || deletingId) return;
      setDeletingId(ids[0]);
      const deletedSet = new Set();
      try {
        for (const deletedId of ids) {
          await deleteMyPhoto(deletedId);
          deletedSet.add(deletedId);
        }
        if (selectedPhotoId != null && deletedSet.has(Number(selectedPhotoId))) setSelectedPhotoId(null);
        if (profilePhotoId != null && deletedSet.has(Number(profilePhotoId))) {
          updateSessionProfilePhoto(null);
          bumpProfilePhotoCache();
        }
        setPhotoVersion((v) => {
          const next = { ...v };
          deletedSet.forEach((id) => {
            delete next[id];
          });
          return next;
        });
        setBulkSelectedPhotoIds((prev) => prev.filter((id) => !deletedSet.has(Number(id))));
        bumpAlbumPhotoCache();
        await refetchMyPhotos(
          (current) =>
            Array.isArray(current) ? current.filter((p) => !deletedSet.has(Number(p.photos_id))) : current,
          { revalidate: true }
        );
        await refetchMyPicksFeed();
      } catch (err) {
        setUploadError(err.response?.data?.error || err.message || 'Delete failed');
        if (deletedSet.size) {
          setBulkSelectedPhotoIds((prev) => prev.filter((id) => !deletedSet.has(Number(id))));
          bumpAlbumPhotoCache();
          await refetchMyPhotos(
            (current) =>
              Array.isArray(current) ? current.filter((p) => !deletedSet.has(Number(p.photos_id))) : current,
            { revalidate: true }
          );
          await refetchMyPicksFeed();
        }
      } finally {
        setDeletingId(null);
      }
    },
    [
      deletingId,
      selectedPhotoId,
      profilePhotoId,
      refetchMyPhotos,
      updateSessionProfilePhoto,
      bumpAlbumPhotoCache,
      bumpProfilePhotoCache,
      refetchMyPicksFeed
    ]
  );

  const executePermanentDelete = useCallback(
    async (photo) => {
      if (!photo) return;
      await executePermanentDeleteIds([photo.photos_id]);
    },
    [executePermanentDeleteIds]
  );

  const executePermanentDeleteVideo = useCallback(
    async (video) => {
      if (!video || deletingVideoId) return;
      const deletedId = Number(video.video_id);
      if (!Number.isFinite(deletedId) || deletedId < 1) return;
      setDeletingVideoId(deletedId);
      try {
        await deleteMyVideo(deletedId);
        if (albumVideoPlaybackId === deletedId) {
          setAlbumVideoPlaybackId(null);
          setAlbumVideoPlaybackExt('');
        }
        setPostingDraftVideoIds((prev) => prev.filter((id) => Number(id) !== deletedId));
        await refetchMyAlbumVideos(
          (current) =>
            Array.isArray(current) ? current.filter((v) => Number(v.video_id) !== deletedId) : current,
          { revalidate: true }
        );
        await Promise.all([refetchMyPicksFeed(), invalidateMyPicksFeedCache()]);
      } catch (err) {
        setUploadError(err.response?.data?.error || err.message || 'Delete failed');
      } finally {
        setDeletingVideoId(null);
      }
    },
    [
      deletingVideoId,
      albumVideoPlaybackId,
      refetchMyAlbumVideos,
      refetchMyPicksFeed
    ]
  );

  const closeDeleteConfirm = useCallback(() => {
    setDeleteConfirm(null);
  }, []);

  const openPermanentDeleteConfirm = useCallback(
    (photo) => {
      if (!photo) return;
      const photoId = Number(photo.photos_id);
      const bulkIds =
        Number.isFinite(photoId) &&
        bulkSelectedPhotoIds.includes(photoId) &&
        bulkSelectedPhotoIds.length > 1
          ? bulkSelectedPhotoIds
          : null;
      if (bulkIds) {
        setDeleteConfirm({ type: 'permanentPhotosBulk', photoIds: bulkIds });
        return;
      }
      setDeleteConfirm({ type: 'permanentPhoto', photo });
    },
    [bulkSelectedPhotoIds]
  );

  const openPermanentDeleteVideoConfirm = useCallback((video) => {
    if (!video) return;
    setDeleteConfirm({ type: 'permanentVideo', video });
  }, []);

  const openBulkPhotosDeleteConfirm = useCallback(
    (albumPhotoIds) => {
      const scope =
        Array.isArray(albumPhotoIds) && albumPhotoIds.length
          ? new Set(albumPhotoIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))
          : null;
      const ids = bulkSelectedPhotoIds.filter((id) => {
        const n = Number(id);
        if (!Number.isFinite(n) || n < 1) return false;
        return scope ? scope.has(n) : true;
      });
      if (!ids.length) return;
      if (ids.length === 1) {
        const photo = photos.find((p) => Number(p.photos_id) === Number(ids[0]));
        if (photo) {
          setDeleteConfirm({ type: 'permanentPhoto', photo });
          return;
        }
      }
      setDeleteConfirm({ type: 'permanentPhotosBulk', photoIds: ids });
    },
    [bulkSelectedPhotoIds, photos]
  );

  const confirmDeleteFromDialog = useCallback(async () => {
    const pending = deleteConfirm;
    closeDeleteConfirm();
    if (!pending) return;
    if (pending.type === 'permanentPhoto') {
      await executePermanentDelete(pending.photo);
      return;
    }
    if (pending.type === 'permanentPhotosBulk') {
      await executePermanentDeleteIds(pending.photoIds);
      return;
    }
    if (pending.type === 'permanentVideo') {
      await executePermanentDeleteVideo(pending.video);
    }
  }, [deleteConfirm, closeDeleteConfirm, executePermanentDelete, executePermanentDeleteIds, executePermanentDeleteVideo]);

  useEffect(() => {
    if (!deleteConfirm) return undefined;
    const { enterConfirms } = MY_STORY_DELETE_CONFIRM[deleteConfirm.type] ?? { enterConfirms: false };
    const onKeyDown = (e) => {
      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        void confirmDeleteFromDialog();
        return;
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        closeDeleteConfirm();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (enterConfirms) void confirmDeleteFromDialog();
        else closeDeleteConfirm();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteConfirm, confirmDeleteFromDialog, closeDeleteConfirm]);

  const handleDeletePhoto = useCallback(
    (e, photo) => {
      e.stopPropagation();
      if (!photo || deletingId) return;
      openPermanentDeleteConfirm(photo);
    },
    [deletingId, openPermanentDeleteConfirm]
  );

  const handleDeleteVideo = useCallback(
    (e, video) => {
      e.stopPropagation();
      if (!video || deletingVideoId) return;
      openPermanentDeleteVideoConfirm(video);
    },
    [deletingVideoId, openPermanentDeleteVideoConfirm]
  );

  const handleSelectPhoto = useCallback((photoId) => {
    didInitSelectionRef.current = true;
    userPickedPhotoIdRef.current = Number(photoId);
    setSelectedPhotoId(photoId);
  }, []);

  const toggleBulkPhotoSelection = useCallback((photoId) => {
    const id = Number(photoId);
    if (!Number.isFinite(id) || id < 1) return;
    setBulkSelectedPhotoIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const handleAlbumPhotoClick = useCallback(
    (photoId, event) => {
      handleSelectPhoto(photoId);
      // Green check = multi-select for drag-into-posting (modifier click only).
      // Plain click only previews in the editor so it does not look "locked".
      const multiSelect = Boolean(event?.metaKey || event?.ctrlKey || event?.shiftKey);
      if (multiSelect) {
        toggleBulkPhotoSelection(photoId);
        return;
      }
      setBulkSelectedPhotoIds([]);
    },
    [handleSelectPhoto, toggleBulkPhotoSelection]
  );

  const handleTileDragStart = useCallback(
    (e, photo) => {
      if (!photo) return;
      const photoId = Number(photo.photos_id);
      const dragIds =
        bulkSelectedPhotoIds.includes(photoId) && bulkSelectedPhotoIds.length > 1
          ? bulkSelectedPhotoIds
          : [photoId];
      const primaryId = String(photoId);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', primaryId);
      e.dataTransfer.setData('application/x-vsingles-photo-id', primaryId);
      e.dataTransfer.setData(BULK_PHOTO_IDS_MIME, JSON.stringify(dragIds));
      draggingPhotoIdsRef.current = dragIds;
      setDraggingPhotoId(photoId);
    },
    [bulkSelectedPhotoIds]
  );

  const handleTileDragEnd = useCallback(() => {
    setDraggingPhotoId(null);
    setDragOverAlbumType(null);
    // Drop fires before dragend; defer clearing so resolveDroppedPhotoIds fallback still works.
    window.setTimeout(() => {
      draggingPhotoIdsRef.current = [];
    }, 0);
  }, []);

  const handleAlbumDragOver = useCallback((e, albumType) => {
    if (e.dataTransfer?.types?.includes(SELF_INTRO_VIDEO_ID_MIME)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.types?.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
    } else {
      e.dataTransfer.dropEffect = 'move';
    }
    setDragOverAlbumType(albumType);
  }, []);

  const handleAlbumDrop = useCallback(
    async (e, albumType) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverAlbumType(null);

      const externalFiles = fileListToArray(e.dataTransfer?.files);
      if (externalFiles.length > 0) {
        draggingPhotoIdsRef.current = [];
        setDraggingPhotoId(null);
        await handleFiles(externalFiles, { targetAlbumType: albumType });
        return;
      }

      const videoIds = resolveDroppedVideoIds(e);
      if (videoIds.length > 0) {
        return;
      }

      const sourceIds = resolveDroppedPhotoIds(e, draggingPhotoIdsRef);
      draggingPhotoIdsRef.current = [];
      setDraggingPhotoId(null);
      if (!sourceIds.length) return;
      for (const sourceId of sourceIds) {
        const sourcePhoto = photosWithType.find((p) => Number(p.photos_id) === Number(sourceId));
        if (!sourcePhoto) continue;
        await movePhotoToAlbumType(sourcePhoto, albumType);
      }
      setBulkSelectedPhotoIds([]);
    },
    [photosWithType, movePhotoToAlbumType, handleFiles]
  );

  const handleVideoTileDragStart = useCallback((e, video) => {
    if (!video) return;
    const videoId = Number(video.video_id);
    if (!Number.isFinite(videoId) || videoId < 1) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(SELF_INTRO_VIDEO_ID_MIME, String(videoId));
    e.dataTransfer.setData('text/plain', String(videoId));
  }, []);

  const executeMakeThisProfile = useCallback(
    async ({ photoId, tryCrop = true, resetProfilePhotoVetting: shouldReset = false } = {}) => {
      setMakeProfileBusy(true);
      try {
        await runMakeThisProfile(photoId, { tryCrop, resetProfilePhotoVetting: shouldReset });
      } finally {
        setMakeProfileBusy(false);
      }
    },
    [runMakeThisProfile]
  );

  const handleMakeThisProfile = useCallback(async () => {
    if (makeProfileBusy) return;
    setUploadError('');
    try {
      const vetting = await fetchProfilePhotoVettingFromBioReview();
      const impersonating = isImpersonationSession(user);
      const gate = evaluateProfilePhotoChangeGate({
        ...vetting,
        isAdmin: impersonating,
        isImpersonation: impersonating
      });
      if (gate.action === 'blocked') {
        setProfilePhotoWaitMessage(formatProfilePhotoChangeWaitMessage(vetting.vettedDate));
        setProfilePhotoWaitDialogOpen(true);
        return;
      }
      const hasExistingProfilePhoto = Number.isFinite(Number(profilePhotoId)) && Number(profilePhotoId) > 0;
      if (hasExistingProfilePhoto && !isAdminSession(user)) {
        pendingMakeProfileRef.current = {
          tryCrop: true,
          resetProfilePhotoVetting: gate.action === 'confirm' || Boolean(gate.resetProfilePhotoVetting)
        };
        setProfilePhotoConfirmDialogOpen(true);
        return;
      }
      await executeMakeThisProfile({
        tryCrop: true,
        resetProfilePhotoVetting: Boolean(gate.resetProfilePhotoVetting)
      });
    } catch (err) {
      setUploadError(err?.response?.data?.error || err?.message || 'Failed to check profile photo verification status');
    }
  }, [makeProfileBusy, executeMakeThisProfile, user, profilePhotoId]);

  const handleConfirmProfilePhotoChange = useCallback(async () => {
    const pending = pendingMakeProfileRef.current;
    pendingMakeProfileRef.current = null;
    setProfilePhotoConfirmDialogOpen(false);
    try {
      await executeMakeThisProfile({
        photoId: pending?.photoId,
        tryCrop: pending?.tryCrop ?? true,
        resetProfilePhotoVetting: pending?.resetProfilePhotoVetting ?? true
      });
      await resetIdVerification();
      markSignupIdentificationVerificationRequired();
      navigate(SELF_REPORT_BIOGRAPHY_PATH, {
        state: { openIdentificationVerification: true }
      });
    } catch (err) {
      setUploadError(err?.response?.data?.error || err?.message || 'Failed to update profile photo');
    }
  }, [executeMakeThisProfile, navigate]);

  /** PilotUser: apply profile change without live facial / ID verification redo. */
  const handleSkipProfilePhotoChangeVerification = useCallback(async () => {
    const pending = pendingMakeProfileRef.current;
    pendingMakeProfileRef.current = null;
    setProfilePhotoConfirmDialogOpen(false);
    try {
      await executeMakeThisProfile({
        photoId: pending?.photoId,
        tryCrop: pending?.tryCrop ?? true,
        resetProfilePhotoVetting: pending?.resetProfilePhotoVetting ?? true
      });
    } catch (err) {
      setUploadError(err?.response?.data?.error || err?.message || 'Failed to update profile photo');
    }
  }, [executeMakeThisProfile]);

  const handlePostingDraftPhotoFiles = useCallback(
    async (files) => {
      const fileArray = fileListToArray(files);
      if (!fileArray.length) return;
      try {
        setPostingSaving(true);
        for (const file of fileArray) {
          if (!file) continue;
          if (!isAllowedAlbumPhotoFile(file)) {
            setWrongFormatAttemptFile(file.name);
            setWrongFormatDialogOpen(true);
            continue;
          }
          const photoMaxBytes = maxUploadMb * 1024 * 1024;
          if (!adminImpersonationUploadBypass && file.size > photoMaxBytes) {
            setFileTooLargeActualMb((file.size / (1024 * 1024)).toFixed(2));
            setFileTooLargeMaxMb(String(maxUploadMb));
            setFileTooLargeDialogOpen(true);
            continue;
          }
          const result = await uploadMyPhoto(file);
          const photoId = Number(result?.photos_id);
          if (!Number.isFinite(photoId) || photoId < 1) {
            throw new Error('Upload completed but photo id is missing');
          }
          setPostingDraftPhotoIds((prev) => (prev.includes(photoId) ? prev : [...prev, photoId]));
          bumpPhotoVersion(photoId);
          if (result?.replacedDuplicate) {
            setDuplicateUploadDialogOpen(true);
          }
        }
        bumpAlbumPhotoCache();
        await refetchMyPhotos();
      } catch (err) {
        setUploadError(err?.response?.data?.error || err?.message || 'Failed to upload posting photo');
      } finally {
        setPostingSaving(false);
      }
    },
    [adminImpersonationUploadBypass, refetchMyPhotos, bumpAlbumPhotoCache, bumpPhotoVersion, maxUploadMb]
  );

  const handlePostingDraftPhotoFile = useCallback(
    async (file) => {
      if (!file) return;
      await handlePostingDraftPhotoFiles([file]);
    },
    [handlePostingDraftPhotoFiles]
  );

  const clearPostingComposer = useCallback(() => {
    setPostingDraftText('');
    setPostingDraftPhotoIds([]);
    setPostingDraftVideoIds([]);
    setEditingPostId(null);
    setEditingPostOriginalMedia([]);
  }, []);

  const handleOpenPostingInComposer = useCallback(
    (post) => {
      const postId = Number(post?.post_id);
      if (!Number.isFinite(postId) || postId < 1) return;

      const photoIds = [];
      const videoIds = [];
      const originalMedia = [];
      for (const row of Array.isArray(post?.photos) ? post.photos : []) {
        const url = String(row?.photo_url ?? '').trim();
        const postingPhotoId = Number(row?.photo_id);
        if (!url) continue;
        if (isSelfIntroVideoPostingUrl(url)) {
          const match = url.match(/\/api\/video\/(\d+)/i);
          const mediaId = match ? Number(match[1]) : NaN;
          if (!Number.isFinite(mediaId) || mediaId < 1) continue;
          if (!videoIds.includes(mediaId)) videoIds.push(mediaId);
          if (Number.isFinite(postingPhotoId) && postingPhotoId > 0) {
            originalMedia.push({ postingPhotoId, mediaId, kind: 'video' });
          }
          continue;
        }
        const match = url.match(/\/api\/photo\/(\d+)/i);
        const mediaId = match ? Number(match[1]) : Number(row?.photos_id ?? row?.photo_id);
        if (!Number.isFinite(mediaId) || mediaId < 1) continue;
        // Prefer album photos_id from URL; posting photo_id is for delete API only.
        const albumId = match ? Number(match[1]) : mediaId;
        if (!photoIds.includes(albumId)) photoIds.push(albumId);
        if (Number.isFinite(postingPhotoId) && postingPhotoId > 0) {
          originalMedia.push({ postingPhotoId, mediaId: albumId, kind: 'photo' });
        }
      }

      setEditingPostId(postId);
      setEditingPostOriginalMedia(originalMedia);
      setPostingDraftText(String(post?.content ?? ''));
      setPostingDraftPhotoIds(photoIds);
      setPostingDraftVideoIds(videoIds);
      setPostingDraftVisibility(normalizeColorTemplate11PostingVisibility(post?.posting_visibility ?? 'public'));
      setUploadError('');
      setActiveStoryTab('albumsCreate');
      // Scroll composer into view after tab paints.
      window.setTimeout(() => {
        addNewPostingSectionRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      }, 80);
    },
    []
  );

  const handleCancelPostingEdit = useCallback(() => {
    clearPostingComposer();
    setUploadError('');
  }, [clearPostingComposer]);

  const handleSavePosting = useCallback(async (postingVisibility = 'public') => {
    if (postingSaving) return;
    const trimmedText = postingDraftText.trim();
    const photoUrls = postingDraftPhotoIds.map((id) => myPhotoUrl(id)).filter(Boolean);
    const videoUrls = postingDraftVideoIds.map((id) => selfIntroVideoUrl(id)).filter(Boolean);
    if (!trimmedText && photoUrls.length === 0 && videoUrls.length === 0) {
      setUploadError('Please add posting text, a photo, or a self intro video before saving.');
      return;
    }
    try {
      setPostingSaving(true);
      setUploadError('');

      const editingId = Number(editingPostId);
      if (Number.isFinite(editingId) && editingId > 0) {
        await patchMyPostingContent(editingId, trimmedText);
        const currentVisibility = normalizeColorTemplate11PostingVisibility(postingVisibility);
        await patchMyPostingVisibility(editingId, currentVisibility);

        const keptMediaKeys = new Set([
          ...postingDraftPhotoIds.map((id) => `photo:${Number(id)}`),
          ...postingDraftVideoIds.map((id) => `video:${Number(id)}`)
        ]);
        const toDelete = editingPostOriginalMedia.filter(
          (row) => !keptMediaKeys.has(`${row.kind}:${Number(row.mediaId)}`)
        );
        for (const row of toDelete) {
          const postingPhotoId = Number(row.postingPhotoId);
          if (Number.isFinite(postingPhotoId) && postingPhotoId > 0) {
            await deleteMyPostingPhoto(postingPhotoId);
          }
        }

        const originalKeys = new Set(
          editingPostOriginalMedia.map((row) => `${row.kind}:${Number(row.mediaId)}`)
        );
        const newUrls = [];
        for (const id of postingDraftPhotoIds) {
          if (!originalKeys.has(`photo:${Number(id)}`)) {
            const url = myPhotoUrl(id);
            if (url) newUrls.push(url);
          }
        }
        for (const id of postingDraftVideoIds) {
          if (!originalKeys.has(`video:${Number(id)}`)) {
            const url = selfIntroVideoUrl(id);
            if (url) newUrls.push(url);
          }
        }
        if (newUrls.length > 0) {
          await addMyPostingPhotos(editingId, newUrls);
        }

        clearPostingComposer();
        scrollReviewFeedToTopRef.current = true;
        setActiveStoryTab('reviewPostings');
        await Promise.all([refetchMyPicksFeed(), invalidateMyPicksFeedCache()]);
        return;
      }

      const createResult = await postMyPosting({
        content: trimmedText,
        photo_urls: [...photoUrls, ...videoUrls],
        posting_visibility: postingVisibility
      });
      clearPostingComposer();

      const newPostId = Number(createResult?.post_id);
      if (Number.isFinite(newPostId) && newPostId > 0) {
        setFeedPosts((prev) => {
          const optimistic = {
            post_id: newPostId,
            content: trimmedText,
            created_at: new Date().toISOString(),
            post_owner_id: ownerSinglesId,
            posting_visibility: postingVisibility,
            posting_comment_count: 0,
            posting_like_count: 0,
            viewer_has_liked: false,
            photos: photoUrls.map((url, i) => ({
              photo_id: `optimistic-${newPostId}-${i}`,
              photo_url: url,
              sort_order: i
            }))
          };
          return [optimistic, ...prev.filter((p) => Number(p.post_id) !== newPostId)];
        });
      }

      scrollReviewFeedToTopRef.current = true;
      setActiveStoryTab('reviewPostings');

      await Promise.all([refetchMyPicksFeed(), invalidateMyPicksFeedCache()]);
    } catch (err) {
      setUploadError(err?.response?.data?.error || err?.message || 'Failed to save posting');
    } finally {
      setPostingSaving(false);
    }
  }, [
    clearPostingComposer,
    editingPostId,
    editingPostOriginalMedia,
    ownerSinglesId,
    postingDraftPhotoIds,
    postingDraftVideoIds,
    postingDraftText,
    postingSaving,
    refetchMyPicksFeed
  ]);

  const postingSaveReady =
    postingDraftPhotoIds.length > 0 || postingDraftVideoIds.length > 0 || postingDraftText.trim().length > 0;

  /** Save → open visibility dropdown; picking Public / Buddies / Myself then creates the post. */
  const handlePostingSaveClick = useCallback(() => {
    if (postingSaving || !postingSaveReady) return;
    pendingSaveAfterVisibilityRef.current = true;
    setPostingVisibilityMenuOpen(true);
  }, [postingSaving, postingSaveReady]);

  const handlePostingVisibilityPicked = useCallback(
    (rawVisibility) => {
      const visibility = normalizeColorTemplate11PostingVisibility(rawVisibility);
      setPostingDraftVisibility(visibility);
      const shouldSave = pendingSaveAfterVisibilityRef.current;
      pendingSaveAfterVisibilityRef.current = false;
      setPostingVisibilityMenuOpen(false);
      if (shouldSave) void handleSavePosting(visibility);
    },
    [handleSavePosting]
  );

  useEffect(() => {
    if (!myPicksFeed || Number(myPicksFeed.target_singles_id) !== Number(ownerSinglesId)) {
      setFeedPosts([]);
      setFeedCursor(null);
      setFeedHasMore(false);
      return;
    }
    const incoming = Array.isArray(myPicksFeed.posts) ? myPicksFeed.posts : [];
    setFeedPosts((prev) => {
      const prevById = new Map(prev.map((post) => [Number(post.post_id), post]));
      return incoming.map((post) => {
        const prior = prevById.get(Number(post.post_id));
        const mergedContent = String(post.content ?? '').trim() || String(prior?.content ?? '').trim();
        return mergedContent && mergedContent !== (post.content ?? '') ? { ...post, content: mergedContent } : post;
      });
    });
    setFeedCursor(myPicksFeed.next_cursor ?? null);
    setFeedHasMore(Boolean(myPicksFeed.has_more));
  }, [myPicksFeed, ownerSinglesId]);

  useEffect(() => {
    if (activeStoryTab !== 'reviewPostings' || !scrollReviewFeedToTopRef.current) return;
    const scrollEl = myStoryReviewFeedScrollRef.current;
    if (!scrollEl) return;
    scrollReviewFeedToTopRef.current = false;
    scrollEl.scrollTop = 0;
  }, [activeStoryTab, feedPosts, myPicksFeedLoading]);

  const handleLoadMorePosts = useCallback(
    async (count) => {
      const targetId = Number(ownerSinglesId);
      const limit = Number(count);
      if (!Number.isFinite(targetId) || targetId < 1) return;
      if (!Number.isFinite(limit) || limit < 1) return;
      if (loadMoreBusy || !feedHasMore || !feedCursor?.created_at || !feedCursor?.post_id) return;
      setLoadMoreBusy(true);
      try {
        const page = await fetchMyPicksFeedPage(targetId, {
          limit,
          beforeCreatedAt: feedCursor.created_at,
          beforePostId: feedCursor.post_id
        });
        const nextPosts = Array.isArray(page?.posts) ? page.posts : [];
        setFeedPosts((prev) => {
          const seen = new Set(prev.map((post) => Number(post.post_id)));
          const merged = [...prev];
          for (const post of nextPosts) {
            const id = Number(post?.post_id);
            if (!Number.isFinite(id) || seen.has(id)) continue;
            merged.push(post);
            seen.add(id);
          }
          return merged;
        });
        const cursor = page?.next_cursor;
        setFeedCursor(
          cursor && typeof cursor === 'object'
            ? {
                created_at: cursor.created_at ?? null,
                post_id: Number(cursor.post_id)
              }
            : null
        );
        setFeedHasMore(page?.has_more === true || page?.has_more === 1);
      } catch (err) {
        await themedAlert(err?.message || 'Failed to load older posts');
      } finally {
        setLoadMoreBusy(false);
      }
    },
    [ownerSinglesId, loadMoreBusy, feedHasMore, feedCursor]
  );

  const handleTogglePostingLike = useCallback(
    async (postId) => {
      const numericPostId = Number(postId);
      if (!Number.isFinite(numericPostId) || numericPostId < 1 || likeBusyPostId != null) return;
      setLikeBusyPostId(numericPostId);
      try {
        await togglePostingLike(numericPostId);
        await Promise.all([refetchMyPicksFeed(), invalidateMyPicksFeedCache()]);
      } catch (err) {
        await themedAlert(err?.message || 'Failed to update like');
      } finally {
        setLikeBusyPostId(null);
      }
    },
    [likeBusyPostId, refetchMyPicksFeed]
  );

  const handlePostingVisibilityChange = useCallback(
    async (post, nextVisibility) => {
      const postId = Number(post?.post_id);
      if (!Number.isFinite(postId) || postId < 1 || visibilityBusyPostId != null) return;
      const currentVisibility = normalizeColorTemplate11PostingVisibility(post?.posting_visibility ?? 'public');
      if (currentVisibility === nextVisibility) return;
      setVisibilityBusyPostId(postId);
      try {
        const result = await patchMyPostingVisibility(postId, nextVisibility);
        const savedVisibility = normalizeColorTemplate11PostingVisibility(
          result?.posting_visibility ?? nextVisibility
        );
        setFeedPosts((prev) =>
          prev.map((row) =>
            Number(row.post_id) === postId ? { ...row, posting_visibility: savedVisibility } : row
          )
        );
        await Promise.all([refetchMyPicksFeed(), invalidateMyPicksFeedCache()]);
      } catch (err) {
        await themedAlert(err?.message || 'Failed to update posting visibility');
      } finally {
        setVisibilityBusyPostId(null);
      }
    },
    [visibilityBusyPostId, refetchMyPicksFeed]
  );

  const handlePostingContentSave = useCallback(
    async (post, nextContent) => {
      const postId = Number(post?.post_id);
      if (!Number.isFinite(postId) || postId < 1 || contentBusyPostId != null) {
        throw new Error('Unable to save posting right now');
      }
      setContentBusyPostId(postId);
      try {
        const result = await patchMyPostingContent(postId, nextContent);
        const savedContent = result?.content ?? String(nextContent ?? '');
        setFeedPosts((prev) =>
          prev.map((row) => (Number(row.post_id) === postId ? { ...row, content: savedContent } : row))
        );
        await Promise.all([refetchMyPicksFeed(), invalidateMyPicksFeedCache()]);
      } catch (err) {
        const message = err?.message || 'Failed to update posting';
        await themedAlert(message);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setContentBusyPostId(null);
      }
    },
    [contentBusyPostId, refetchMyPicksFeed]
  );

  const handleShowPostingLikes = useCallback(async (_event, postId) => {
    const numericPostId = Number(postId);
    if (!Number.isFinite(numericPostId) || numericPostId < 1) return;
    setLikesPostId(numericPostId);
    setLikesLoading(true);
    setLikesError('');
    setLikesList([]);
    try {
      const likesPayload = await fetchPostingLikes(numericPostId);
      setLikesList(Array.isArray(likesPayload?.likes) ? likesPayload.likes : []);
    } catch (err) {
      const message = err?.message || 'Failed to load likes';
      setLikesError(message);
      await themedAlert(message);
    } finally {
      setLikesLoading(false);
    }
  }, []);

  const closeLikesPopover = useCallback(() => {
    setLikesPostId(null);
    setLikesList([]);
    setLikesLoading(false);
    setLikesError('');
  }, []);

  const myStoryTabButtonLayoutSx = {
    textTransform: 'none',
    borderRadius: 1,
    minWidth: 0,
    width: '100%',
    px: 0.6,
    py: 0.55,
    fontWeight: 700,
    lineHeight: 1.15,
    transformOrigin: 'center'
  };

  const handleStoryTabClick = useCallback(
    (tab) => {
      setActiveStoryTab(tab);
      if (tab === 'reviewPostings') {
        void refetchMyPicksFeed();
      }
    },
    [refetchMyPicksFeed]
  );

  const handlePostingDrop = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();
      setPostingDragOver(false);
      draggingPhotoIdsRef.current = [];
      setDraggingPhotoId(null);

      const videoIds = resolveDroppedVideoIds(e);
      if (videoIds.length > 0) {
        setPostingDraftVideoIds((prev) => {
          const next = [...prev];
          for (const id of videoIds) {
            if (!next.includes(id)) next.push(id);
          }
          return next;
        });
        return;
      }

      const sourceIds = resolveDroppedPhotoIds(e, draggingPhotoIdsRef);
      if (sourceIds.length > 0) {
        let anyAutoMoved = false;
        const idsToAdd = [];
        try {
          setUploadError('');
          for (const sourceId of sourceIds) {
            const sourcePhoto = photosWithType.find((p) => Number(p.photos_id) === Number(sourceId));
            if (!sourcePhoto) continue;
            const sourceAlbumType = normalizeAlbumType(sourcePhoto.type);
              if (sourceAlbumType !== ALBUM_TYPES.public) {
              await updateMyPhotoType(sourceId, ALBUM_TYPES.public);
              if (sourceAlbumType === ALBUM_TYPES.private) {
                anyAutoMoved = true;
              }
            }
            idsToAdd.push(sourceId);
          }
          if (idsToAdd.length > 0) {
            setPostingDraftPhotoIds((prev) => {
              const next = [...prev];
              for (const id of idsToAdd) {
                if (!next.includes(id)) next.push(id);
              }
              return next;
            });
            if (anyAutoMoved) {
              setPostingAutoMovedDialogOpen(true);
            }
            await refetchMyPhotos();
            setBulkSelectedPhotoIds([]);
          }
        } catch (err) {
          setUploadError(err?.response?.data?.error || err?.message || 'Failed to move photo to Public Album');
        }
        return;
      }
      const externalFiles = fileListToArray(e.dataTransfer?.files);
      if (externalFiles.length > 0) {
        void handlePostingDraftPhotoFiles(externalFiles);
      }
    },
    [photosWithType, handlePostingDraftPhotoFiles, refetchMyPhotos]
  );

  const handleAttachMediaToExistingPost = useCallback(
    async (post, dropEvent) => {
      const postId = Number(post?.post_id);
      if (!Number.isFinite(postId) || postId < 1 || attachBusyPostId != null) return;

      const videoIds = resolveDroppedVideoIds(dropEvent);
      const sourceIds = resolveDroppedPhotoIds(dropEvent, draggingPhotoIdsRef);
      const externalFiles = fileListToArray(dropEvent?.dataTransfer?.files);
      draggingPhotoIdsRef.current = [];
      setDraggingPhotoId(null);

      if (videoIds.length === 0 && sourceIds.length === 0 && externalFiles.length === 0) return;

      setAttachBusyPostId(postId);
      setUploadError('');
      try {
        const photoUrls = [];

        for (const videoId of videoIds) {
          const url = selfIntroVideoUrl(videoId);
          if (url) photoUrls.push(url);
        }

        for (const sourceId of sourceIds) {
          const sourcePhoto = photosWithType.find((p) => Number(p.photos_id) === Number(sourceId));
          if (!sourcePhoto) continue;
          const sourceAlbumType = normalizeAlbumType(sourcePhoto.type);
          if (sourceAlbumType !== ALBUM_TYPES.public) {
            await updateMyPhotoType(sourceId, ALBUM_TYPES.public);
          }
          const url = myPhotoUrl(sourceId);
          if (url) photoUrls.push(url);
        }

        for (const file of externalFiles) {
          if (!file) continue;
          if (!isAllowedAlbumPhotoFile(file)) {
            setWrongFormatAttemptFile(file.name);
            setWrongFormatDialogOpen(true);
            continue;
          }
          const photoMaxBytes = maxUploadMb * 1024 * 1024;
          if (!adminImpersonationUploadBypass && file.size > photoMaxBytes) {
            setFileTooLargeActualMb((file.size / (1024 * 1024)).toFixed(2));
            setFileTooLargeMaxMb(String(maxUploadMb));
            setFileTooLargeDialogOpen(true);
            continue;
          }
          const result = await uploadMyPhoto(file);
          const photoId = Number(result?.photos_id);
          if (!Number.isFinite(photoId) || photoId < 1) {
            throw new Error('Upload completed but photo id is missing');
          }
          bumpPhotoVersion(photoId);
          if (result?.replacedDuplicate) {
            setDuplicateUploadDialogOpen(true);
          }
          const url = myPhotoUrl(photoId);
          if (url) photoUrls.push(url);
        }

        if (photoUrls.length === 0) return;

        const attachResult = await addMyPostingPhotos(postId, photoUrls);
        const attached = Array.isArray(attachResult?.photos) ? attachResult.photos : [];
        if (attached.length > 0) {
          setFeedPosts((prev) =>
            prev.map((row) => {
              if (Number(row.post_id) !== postId) return row;
              const existing = Array.isArray(row.photos) ? row.photos : [];
              return { ...row, photos: [...existing, ...attached] };
            })
          );
        }
        bumpAlbumPhotoCache();
        await Promise.all([refetchMyPhotos(), refetchMyPicksFeed(), invalidateMyPicksFeedCache()]);
      } catch (err) {
        setUploadError(err?.response?.data?.error || err?.message || 'Failed to attach photo to posting');
      } finally {
        setAttachBusyPostId(null);
      }
    },
    [
      attachBusyPostId,
      photosWithType,
      adminImpersonationUploadBypass,
      maxUploadMb,
      bumpPhotoVersion,
      bumpAlbumPhotoCache,
      refetchMyPhotos,
      refetchMyPicksFeed
    ]
  );

  const removeDraftPostingPhoto = useCallback((photoId) => {
    setPostingDraftPhotoIds((prev) => prev.filter((id) => Number(id) !== Number(photoId)));
  }, []);

  const removeDraftPostingVideo = useCallback((videoId) => {
    setPostingDraftVideoIds((prev) => prev.filter((id) => Number(id) !== Number(videoId)));
  }, []);

  const displayMemberId =
    formatMemberCode({
      prefix: profileBasics.prefix,
      memberId: profileBasics.member_id,
      singlesId: profileBasics.singles_id ?? user?.singles_id
    }) ?? '';

  const wrongFormatDialog = (
    <ColorTemplate7PopupLargeDark
      open={wrongFormatDialogOpen}
      onClose={() => {
        setWrongFormatDialogOpen(false);
        setWrongFormatAttemptFile('');
      }}
      closeOnBackdrop
      closeButtonAriaLabel="Close unsupported file format dialog"
    >
      <ColorTemplate7PopupLargeDark.Body spacing={2}>
        <ColorTemplate7PopupLargeDark.Title>Unsupported file format</ColorTemplate7PopupLargeDark.Title>
        {wrongFormatAttemptFile ? (
          <ColorTemplate7PopupLargeDark.ErrorBar>
            You tried upload file {wrongFormatAttemptFile}
          </ColorTemplate7PopupLargeDark.ErrorBar>
        ) : null}
        <ColorTemplate7PopupLargeDark.BodyText>
          {ALBUM_ACCEPTED_PHOTO_EXTENSIONS_UI}
        </ColorTemplate7PopupLargeDark.BodyText>
        <ColorTemplate7PopupLargeDark.BodyText>
          {ALBUM_ACCEPTED_VIDEO_EXTENSIONS_UI}
        </ColorTemplate7PopupLargeDark.BodyText>
        <ColorTemplate7PopupLargeDark.BodyText>
          Vault uploads save to Public Video Vault (3 max, 10 MB each). Photos are limited to {maxUploadMb} MB each.
        </ColorTemplate7PopupLargeDark.BodyText>
        <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
          <ColorTemplate7PopupLargeDark.ActionButton
            onClick={() => {
              setWrongFormatDialogOpen(false);
              setWrongFormatAttemptFile('');
            }}
          >
            OK
          </ColorTemplate7PopupLargeDark.ActionButton>
        </Stack>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );

  const fileTooLargeDialog = (
    <ColorTemplate7PopupLargeDark
      open={fileTooLargeDialogOpen}
      onClose={() => setFileTooLargeDialogOpen(false)}
      closeOnBackdrop
      closeButtonAriaLabel="Close file too large dialog"
    >
      <ColorTemplate7PopupLargeDark.Body spacing={2}>
        <ColorTemplate7PopupLargeDark.Title>File too large</ColorTemplate7PopupLargeDark.Title>
        <ColorTemplate7PopupLargeDark.BodyText>
          Oops! That file {fileTooLargeActualMb} mb is a little too heavy for our servers.
        </ColorTemplate7PopupLargeDark.BodyText>
        <ColorTemplate7PopupLargeDark.BodyText>
          Please keep it under {fileTooLargeMaxMb} mb so we can get your profile live and help you find your match!
        </ColorTemplate7PopupLargeDark.BodyText>
        <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
          <ColorTemplate7PopupLargeDark.ActionButton onClick={() => setFileTooLargeDialogOpen(false)}>
            OK
          </ColorTemplate7PopupLargeDark.ActionButton>
        </Stack>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );

  const albumPhotoDeleteConfirmDialog = (
    <ColorTemplate7PopupLargeDark
      open={Boolean(deleteConfirm)}
      onClose={closeDeleteConfirm}
      closeOnBackdrop
      closeButtonAriaLabel="Close delete confirmation"
    >
      <ColorTemplate7PopupLargeDark.Body spacing={2}>
        <ColorTemplate7PopupLargeDark.BodyText>
          {deleteConfirm?.type === 'permanentPhotosBulk'
            ? `Do you want to permanently delete these ${Array.isArray(deleteConfirm.photoIds) ? deleteConfirm.photoIds.length : 0} photos?`
            : deleteConfirm
              ? MY_STORY_DELETE_CONFIRM[deleteConfirm.type]?.message
              : ''}
        </ColorTemplate7PopupLargeDark.BodyText>
        <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
          <GreenButton type="button" onClick={closeDeleteConfirm}>
            No
          </GreenButton>
          <GreenButton type="button" onClick={() => void confirmDeleteFromDialog()}>
            Yes
          </GreenButton>
        </Stack>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );

  const duplicateUploadDialog = (
    <ColorTemplate7PopupLargeDark
      open={duplicateUploadDialogOpen}
      onClose={() => setDuplicateUploadDialogOpen(false)}
      closeOnBackdrop
      closeButtonAriaLabel="Close duplicate upload dialog"
    >
      <ColorTemplate7PopupLargeDark.Body spacing={2}>
        <ColorTemplate7PopupLargeDark.BodyText>{DUPLICATE_UPLOAD_MESSAGE}</ColorTemplate7PopupLargeDark.BodyText>
        <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
          <GreenButton type="button" onClick={() => setDuplicateUploadDialogOpen(false)}>
            OK
          </GreenButton>
        </Stack>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );

  const postingAutoMovedDialog = (
    <ColorTemplate7PopupLargeDark
      open={postingAutoMovedDialogOpen}
      onClose={() => setPostingAutoMovedDialogOpen(false)}
      closeOnBackdrop
      closeButtonAriaLabel="Close posting auto-moved notice"
    >
      <ColorTemplate7PopupLargeDark.Body spacing={2}>
        <ColorTemplate7PopupLargeDark.BodyText>
          We move the photo from Friends-Only album to Public so you can create a Public Post
        </ColorTemplate7PopupLargeDark.BodyText>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );

  const moreSharingPopup = (
    <ColorTemplate7PopupLargeDark
      open={moreSharingPopupOpen}
      onClose={() => setMoreSharingPopupOpen(false)}
      closeOnBackdrop
      closeButtonAriaLabel="Close upgrade photo sharing limit popup"
    >
      <ColorTemplate7PopupLargeDark.Body spacing={2}>
        <ColorTemplate7PopupLargeDark.Title>Fresh look, fresh posts! 🌿</ColorTemplate7PopupLargeDark.Title>
        <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'left' }}>
          Standard Free accounts can host maximum 10 public, and 10 friends-only photos at a time. If your public
          album is full and you&apos;re ready to share a new memory, just swap an old photo out for a new one, then drag
          it into your post! Just keep in mind that removing a photo from your album will remove it from older posts,
          too.
        </ColorTemplate7PopupLargeDark.BodyText>
        <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'left', fontWeight: 700 }}>
          Coming Soon: Unlock Premium Features!
        </ColorTemplate7PopupLargeDark.BodyText>
        <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'left' }}>
          Get ready to elevate your profile with our upcoming monthly subscription. Here is what you&apos;ll get:
        </ColorTemplate7PopupLargeDark.BodyText>
        <ColorTemplate7PopupLargeDark.BodyText component="ul" sx={{ textAlign: 'left', pl: 2.5, my: 0 }}>
          <li>
            More Room for Memories: Expand your limit to 50 photos in your Public Album and 50 photos in your
            Friends-Only Album.
          </li>
          <li>
            Keep the Conversation Going: Save up to 100 chat messages so you never lose track of a great connection.
          </li>
        </ColorTemplate7PopupLargeDark.BodyText>
        <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
          <ColorTemplate7PopupLargeDark.ActionButton onClick={() => setMoreSharingPopupOpen(false)}>
            OK
          </ColorTemplate7PopupLargeDark.ActionButton>
        </Stack>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        ...myStoryPageShellSx(myStoryPhoneLayout)
      }}
    >
      {wrongFormatDialog}
      {fileTooLargeDialog}
      {albumPhotoDeleteConfirmDialog}
      {duplicateUploadDialog}
      {postingAutoMovedDialog}
      {moreSharingPopup}
      <input
        ref={fileInputRef}
        id="my-story-file-input"
        type="file"
        accept={ACCEPT}
        multiple
        onChange={onSelectFile}
        {...MY_STORY_FILE_INPUT_PROPS}
      />
      {isMobileUpload ? (
        <>
          <input
            ref={mobileCameraInputRef}
            id="my-story-mobile-camera-input"
            type="file"
            accept={ACCEPT}
            capture="user"
            onChange={onSelectFile}
            {...MY_STORY_FILE_INPUT_PROPS}
          />
          <input
            ref={mobileGalleryInputRef}
            id="my-story-mobile-gallery-input"
            type="file"
            accept={ACCEPT}
            multiple
            onChange={onSelectFile}
            {...MY_STORY_FILE_INPUT_PROPS}
          />
        </>
      ) : null}
      <ProfilePhotoChangeWaitDialog
        open={profilePhotoWaitDialogOpen}
        onClose={() => setProfilePhotoWaitDialogOpen(false)}
        message={profilePhotoWaitMessage}
      />
      <ProfilePhotoChangeConfirmDialog
        open={profilePhotoConfirmDialogOpen}
        onClose={() => {
          if (makeProfileBusy) return;
          pendingMakeProfileRef.current = null;
          setProfilePhotoConfirmDialogOpen(false);
        }}
        onConfirm={() => void handleConfirmProfilePhotoChange()}
        showSkip={isPilotUserCategory(user?.member_category)}
        onSkip={() => void handleSkipProfilePhotoChangeVerification()}
        busy={makeProfileBusy}
        title="Profile change"
        message={ID_VERIFICATION_REDO_CONFIRM_MESSAGE}
        cancelLabel="No"
        confirmLabel="Yes"
      />
      <NicknamePickerDialog
        open={showNicknameDialog || suggestListOpen}
        initialNickname={profileBasics.alias || user?.alias || ''}
        onSaved={handleNicknameSaved}
        dismissible={suggestListOpen}
        onClose={() => {
          setSuggestListOpen(false);
          setShowNicknameDialog(false);
        }}
      />
      <SecurityIconPickerDialog
        open={showSecurityIconDialog}
        onSaved={handleSecretIconSaved}
        dismissible={hasSecretIcon}
        onClose={hasSecretIcon ? handleSecurityIconDialogClose : undefined}
      />
      <ColorTemplate7PopupLargeDark
        open={showFirstPhotoDialog}
        showCloseButton={false}
        closeOnBackdrop={false}
      >
        <input
          ref={firstPhotoFileInputRef}
          id="my-story-first-photo-file-input"
          type="file"
          accept={ACCEPT}
          onChange={onSelectFile}
          {...MY_STORY_FILE_INPUT_PROPS}
        />
        <ColorTemplate7PopupLargeDark.Body spacing={2}>
          <ColorTemplate7PopupLargeDark.Title>Please upload 1 profile photo</ColorTemplate7PopupLargeDark.Title>
          {isMobileUpload ? (
            <Box sx={{ mb: 1 }}>
              <Box
                sx={{
                  bgcolor: MOBILE_UPLOAD_SURFACE_BG,
                  borderRadius: 2,
                  p: 1.25,
                  width: '100%',
                  maxWidth: 420,
                  mx: 'auto',
                  boxSizing: 'border-box'
                }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '1 / 1',
                    maxHeight: 280,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Box
                    component="img"
                    src={cameraOrPhotoUploadImg}
                    alt=""
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      display: 'block',
                      pointerEvents: 'none',
                      userSelect: 'none'
                    }}
                  />
                  <Box
                    component="button"
                    type="button"
                    aria-label="Take a photo with your camera"
                    onClick={() => triggerFilePicker(mobileCameraInputRef)}
                    sx={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: '50%',
                      border: 'none',
                      p: 0,
                      m: 0,
                      cursor: 'pointer',
                      bgcolor: 'transparent',
                      borderRadius: 0
                    }}
                  />
                  <Box
                    component="button"
                    type="button"
                    aria-label="Open camera or photo library"
                    onClick={() => triggerFilePicker(firstPhotoFileInputRef)}
                    sx={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: '50%',
                      border: 'none',
                      p: 0,
                      m: 0,
                      cursor: 'pointer',
                      bgcolor: 'transparent',
                      borderRadius: 0
                    }}
                  />
                </Box>
              </Box>
              <ColorTemplate7PopupLargeDark.BodyText>Tap camera or gallery to upload your image.</ColorTemplate7PopupLargeDark.BodyText>
            </Box>
          ) : (
            <Box
              className={dragOver ? undefined : LIGHT_SURFACE_CLASS}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => triggerFilePicker(firstPhotoFileInputRef)}
              sx={{
                border: '3px solid var(--theme-primary-color)',
                borderRadius: 2,
                bgcolor: dragOver ? 'var(--theme-daynight-color)' : 'var(--theme-green-color)',
                minHeight: 200,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: { xs: 1.25, sm: 2 },
                flexWrap: 'wrap',
                cursor: maxPhotosReached ? 'not-allowed' : 'pointer',
                opacity: maxPhotosReached ? 0.6 : 1,
                transition: 'background-color 0.2s, border-color 0.2s',
                px: 1.75,
                py: 1.75,
                mb: 1
              }}
            >
              <Box
                component="img"
                src={dragDropPhotoImg}
                alt=""
                sx={{
                  maxWidth: 'min(100%, clamp(100px, 16vw, 180px))',
                  width: 'auto',
                  height: 'auto',
                  display: 'block',
                  userSelect: 'none',
                  pointerEvents: 'none'
                }}
              />
              <Typography className="my-story-upload-caption" sx={myStoryPostingDropCaptionSx}>
                Drag &amp; Drop photo here
              </Typography>
            </Box>
          )}
          {!isMobileUpload ? (
            <ProfilePhotoUploadQrPanel messageSx={comicStyle} onPhoneUploadComplete={handlePhoneUploadComplete} />
          ) : null}
          {uploading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
              <CircularProgress size={40} sx={{ color: 'var(--theme-primary-color)' }} />
            </Box>
          ) : null}
          {uploadError ? (
            <ColorTemplate7PopupLargeDark.ErrorBar>{uploadError}</ColorTemplate7PopupLargeDark.ErrorBar>
          ) : null}
          <ColorTemplate7PopupLargeDark.BodyText>We&apos;ll use your first photo as your profile photo.</ColorTemplate7PopupLargeDark.BodyText>
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>

      <Box
        sx={{
          borderRadius: { xs: 0, sm: 3 },
          p: { xs: 0, sm: 3 },
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          ...myStoryPageShellSx(myStoryPhoneLayout)
        }}
      >
        <MyAlbumPostingsInstructionPopup open={instructionOpen} onClose={() => setInstructionOpen(false)} />
        <Box
          sx={{
            position: 'absolute',
            top: { xs: 8, sm: 12 },
            right: { xs: 8, sm: 12 },
            zIndex: 2
          }}
        >
          <PageInstructionEarnTokensAction onInstructionClick={() => setInstructionOpen(true)} />
        </Box>
        <MainCard
          sx={{
            display: 'flex',
            flexDirection: 'column',
            ...(myStoryPhoneLayout
              ? { flex: '0 1 auto', minHeight: 'auto', height: 'auto', maxHeight: 'none', overflow: 'visible' }
              : {
                  flex: 1,
                  minHeight: 0,
                  overflow: 'hidden',
                  height: '100%',
                  maxHeight: '100%'
                }),
            '& .MuiCardHeader-root': { flexShrink: 0 },
            '& .MuiCardContent-root': myStoryPhoneLayout
              ? { flex: '0 1 auto', minHeight: 'auto', overflow: 'visible' }
              : {
                  flex: 1,
                  minHeight: 0,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }
          }}
          contentSX={{
            px: { xs: 0, md: 2 },
            py: { xs: 2, md: 2 },
            display: 'flex',
            flexDirection: 'column',
            ...(myStoryPhoneLayout
              ? { flex: '0 1 auto', minHeight: 'auto', overflow: 'visible' }
              : { flex: 1, minHeight: 0, overflow: 'hidden' }),
            '&:last-child': { pb: { xs: 2, md: 2 } }
          }}
          headerSX={{
            p: 0,
            alignItems: 'flex-start',
            width: '100%',
            '& .MuiCardHeader-content': { maxWidth: '100%', width: '100%' }
          }}
          title={
            <Box
              sx={{
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                bgcolor: 'var(--theme-daynight-color)',
                border: 'none',
                borderRadius: 2,
                px: { xs: 2, sm: 3 },
                py: { xs: 2.25, sm: 2.75 },
                mb: 0,
                textAlign: 'center',
                boxShadow: '0 2px 12px rgba(116, 77, 187, 0.35)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: { xs: 1.15, sm: 1.35 }
              }}
            >
              <Typography
                component="h1"
                sx={{
                  m: 0,
                  fontFamily: MAIN_FONT_FAMILY,
                  color: 'var(--theme-primary-color)',
                  fontSize: downSM ? '1.35rem' : '1.75rem',
                  fontWeight: 700,
                  lineHeight: 1.35,
                  textAlign: 'center'
                }}
              >
                The many smiles &amp; stories of {smilesBannerIdentity.displayName}
              </Typography>
              <Typography
                component="p"
                sx={{ ...motivationalPurpleText, m: 0, maxWidth: 720, textAlign: 'center' }}
              >
                Everyone like to know you ! periodically post and tell your stories here
              </Typography>
            </Box>
          }
        >
      <Box
        sx={{
          flexShrink: 0,
          width: '100%',
          mb: activeStoryTab === 'reviewPostings' ? 0 : 2,
          display: 'grid',
          gridTemplateColumns: `repeat(${MY_STORY_TAB_KEYS.length}, minmax(0, 1fr))`,
          gap: 0.6,
          border: '1px solid var(--theme-primary-color)',
          borderRadius: 1,
          p: 0.75,
          bgcolor: (theme) => colorTemplate1WallColorByTheme(theme)
        }}
      >
        {MY_STORY_TAB_KEYS.map((tab) => {
          const isSelected = activeStoryTab === tab;
          const TabButton = isSelected ? SelectedButtonTemplate : UnSelectedButtonTemplate;
          return (
            <TabButton
              key={tab}
              fullWidth
              fitLabelWidth={false}
              hoverScale={isSelected ? 1 : undefined}
              onClick={() => handleStoryTabClick(tab)}
              sx={myStoryTabButtonLayoutSx}
              {...guestDemoAllowProps()}
            >
              {MY_STORY_TAB_LABEL_BY_KEY[tab]}
            </TabButton>
          );
        })}
      </Box>

      <Box
        sx={{
          ...myStoryTabBodyScrollSx,
          ...(myStoryPhoneLayout
            ? {
                flex: '0 1 auto',
                minHeight: 'auto',
                overflowY: 'visible',
                ...(activeStoryTab === 'albumsCreate'
                  ? { pb: `${MY_STORY_ALBUMS_CREATE_FOOTER_CLEARANCE_PX}px` }
                  : null)
              }
            : {
                overflowY: activeStoryTab === 'albumsCreate' ? 'auto' : 'hidden',
                ...(activeStoryTab === 'albumsCreate'
                  ? { pb: `${MY_STORY_ALBUMS_CREATE_FOOTER_CLEARANCE_PX}px` }
                  : null)
              })
        }}
      >
      {activeStoryTab === 'reviewPostings' ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            mt: 2,
            mb: 2,
            ...(myStoryPhoneLayout
              ? { flex: '0 1 auto', minHeight: 'auto', overflow: 'visible' }
              : { flex: '1 1 0', minHeight: 0, overflow: 'hidden' })
          }}
        >
          <Box
            sx={{
              ...myStoryReviewPostingsOuterFrameSx,
              ...(myStoryPhoneLayout
                ? { flex: '0 1 auto', minHeight: 'auto', height: 'auto', maxHeight: 'none' }
                : { flex: '1 1 0', height: '100%', maxHeight: '100%' })
            }}
          >
            <Box sx={myStoryReviewPostingsHeaderSx}>
              <Typography sx={myStoryReviewPostingsHeaderTitleSx}>Postings</Typography>
            </Box>
            <Box
              sx={{
                ...myStoryReviewPostingsContentSx,
                ...(myStoryPhoneLayout
                  ? { flex: '0 1 auto', minHeight: 'auto', overflowY: 'visible' }
                  : null)
              }}
            >
              {ownerSinglesId != null ? (
                <ColorTemplate11Posting.Feed
                  title="Posts and Comments"
                  posts={feedPosts}
                  scrollContainerRef={myStoryReviewFeedScrollRef}
                  loading={myPicksFeedLoading}
                  error={myPicksFeedError}
                  privacyMessage={
                    myPicksFeed && !myPicksFeed.can_view_private_posts && myPicksFeed.message ? myPicksFeed.message : undefined
                  }
                  viewerSinglesId={ownerSinglesId}
                  feedOwnerSinglesId={ownerSinglesId}
                  showDeletePosts={canDeletePosts}
                  deleteBusy={deleteBusy}
                  onDeletePost={handleDeletePosting}
                  onDeletePhoto={handleDeletePostingPhoto}
                  attachBusyPostId={attachBusyPostId}
                  onAttachMedia={handleAttachMediaToExistingPost}
                  visibilityBusyPostId={visibilityBusyPostId}
                  onVisibilityChange={handlePostingVisibilityChange}
                  contentBusyPostId={contentBusyPostId}
                  onSaveContent={handlePostingContentSave}
                  onPostDoubleClick={handleOpenPostingInComposer}
                  showActions
                  likeBusyPostId={likeBusyPostId}
                  onToggleLike={handleTogglePostingLike}
                  onShowLikes={handleShowPostingLikes}
                  onOpenComments={(post) => setCommentsDialog({ postId: post.post_id, photos: post.photos })}
                  showLoadMore={ownerSinglesId != null}
                  feedHasMore={feedHasMore && ownerSinglesId != null}
                  loadMoreBusy={loadMoreBusy}
                  onLoadMore={handleLoadMorePosts}
                  sx={
                    myStoryPhoneLayout
                      ? { flex: '0 1 auto', minHeight: 'auto', height: 'auto', maxHeight: 'none' }
                      : { flex: 1, minHeight: 0, height: '100%', maxHeight: '100%' }
                  }
                />
              ) : null}
            </Box>
          </Box>
        </Box>
      ) : null}

      {activeStoryTab === 'albumsCreate' ? (
      <>
      <Box
        sx={{
          mb: 2,
          p: 0
        }}
      >
        <Typography sx={{ ...comicStyle, mb: 1.25 }}>Below is customize how you appear online:</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
          <Typography sx={{ ...comicStyle, minWidth: 92 }}>Member_id:</Typography>
          <TextField
            size="small"
            value={displayMemberId}
            inputProps={{ readOnly: true }}
            disabled
            sx={{ ...profileBasicsReadOnlyInputSx }}
          />
          <Typography sx={{ ...comicStyle }}>(use default member# or pick alias (initially))</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ ...comicStyle }}>Nick name or alias:</Typography>
          <TextField
            size="small"
            value={profileBasics.alias}
            disabled
            inputProps={{ readOnly: true }}
            sx={{ width: 280, maxWidth: '100%', ...profileBasicsReadOnlyInputSx }}
          />
          <UnSelectedButtonTemplate
            size="small"
            onClick={openNicknameEditor}
            disabled={profileBasicsLoading}
            sx={{ minWidth: 72, boxShadow: 'none' }}
          >
            Edit
          </UnSelectedButtonTemplate>
        </Box>
        {profileBasicsMessage ? (
          <Typography sx={{ ...comicStyle, mt: 1, color: profileBasicsMessage === 'Nickname saved.' ? '#2e7d32' : 'var(--theme-error-color)' }}>
            {profileBasicsMessage}
          </Typography>
        ) : null}
      </Box>

      {myPhotosLoading && photos.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : null}

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          width: '100%',
          mb: 3
        }}
      >
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: 'stretch',
            justifyContent: 'space-between',
            gap: { xs: 2, md: 3 }
          }}
        >
        <Box
          component="form"
          data-suppress-touch-contextmenu="true"
          onSubmit={(e) => {
            e.preventDefault();
            void handleMakeThisProfile();
          }}
          sx={{
            position: 'relative',
            flexShrink: 0,
            width: { xs: '100%', md: 'auto' },
            flex: { md: '1 1 0' },
            minWidth: { md: 0 },
            maxWidth: { xs: '100%', md: 'none' },
            alignSelf: { xs: 'stretch', md: 'stretch' },
            WebkitTouchCallout: 'none'
          }}
        >
          {selectedPhotoId != null ? (
            <StoryPhotoEditor
              ref={storyEditorRef}
              photosId={selectedPhotoId}
              photoCacheBust={selectedPhotoCacheBust}
              onPhotoSaved={(id) => {
                bumpPhotoVersion(id);
                bumpAlbumPhotoCache();
                refetchMyPhotos();
                bumpProfilePhotoCache();
              }}
              onSaveError={(e) => {
                setUploadError(e?.response?.data?.error || e?.message || 'Failed to crop photo');
              }}
            />
          ) : (
            <Box
              sx={{
                width: '100%',
                aspectRatio: VIEWPORT_ASPECT_RATIO,
                bgcolor: 'grey.100',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider'
              }}
              aria-label="No profile photo selected"
            />
          )}
          <UnSelectedButtonTemplate
            type="submit"
            disabled={!selectedPhotoId || makeProfileBusy}
            sx={{
              position: 'relative',
              left: '50%',
              transform: 'translateX(-50%)',
              mt: 1.5,
              fontWeight: 700,
              fontSize: myStoryButtonFontSize,
              whiteSpace: 'nowrap',
              zIndex: 2,
              transformOrigin: 'center center',
              boxShadow: 'none',
              '&.Mui-disabled': {
                opacity: 0.55,
                cursor: 'not-allowed',
                transform: 'translateX(-50%)'
              },
              ...buttonHoverMagnifyTransitionSx,
              '@media (hover: hover)': {
                '&:hover:not(.Mui-disabled)': {
                  transform: 'translateX(-50%) !important',
                  zIndex: 6,
                  ...buttonHoverMagnifyFontSx({ baseFontSize: myStoryButtonFontSize })
                }
              }
            }}
          >
            Make this Profile
          </UnSelectedButtonTemplate>
          <SelfIntroVideoCta onClick={() => selfIntroVideoFlowRef.current?.startFlow()} />
          <SelfIntroVideoFlow
            ref={selfIntroVideoFlowRef}
            hideCta
            onVideoSaved={() => void refetchMyAlbumVideos()}
          />
        </Box>

        <Box
          sx={{
            flex: { md: '1 1 0' },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: { xs: 'center', md: 'stretch' },
            alignItems: 'stretch',
            minWidth: { md: 0 }
          }}
        >
          {maxPhotosReached ? (
            <Box
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              sx={{
                border: '5px dashed var(--theme-primary-color)',
                borderRadius: 2,
                bgcolor: 'var(--theme-error-color)',
                minHeight: { xs: 200, md: 'clamp(120px, 14vw, 200px)' },
                width: '100%',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'default',
                userSelect: 'none',
                transition: 'background-color 0.2s, border-color 0.2s',
                px: 1.5,
                py: 2
              }}
            >
              <Box
                component="img"
                src={dragDropClickUploadImg}
                alt="Photo upload limit reached"
                sx={{
                  maxWidth: 'min(100%, clamp(180px, 28vw, 340px))',
                  width: '100%',
                  height: 'auto',
                  mb: 1,
                  display: 'block',
                  cursor: 'default',
                  userSelect: 'none',
                  pointerEvents: 'none'
                }}
              />
              <Typography
                variant="body1"
                sx={{
                  ...comicStyle,
                  textAlign: 'center',
                  color: 'var(--theme-primary-color)',
                  fontWeight: 700,
                  fontSize: 'clamp(1.35rem, 1.4vw, 2rem)'
                }}
              >
                Uploaded album has reached 10 photos
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  mt: 1,
                  ...comicStyle,
                  textAlign: 'center',
                  color: 'var(--theme-primary-color)',
                  fontSize: 'clamp(1.15rem, 1.1vw, 1.8rem)'
                }}
              >
                Once you remove some, you can add more
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  mt: 1,
                  ...comicStyle,
                  textAlign: 'center',
                  color: 'var(--theme-primary-color)',
                  fontSize: 'clamp(1.15rem, 1.1vw, 1.8rem)'
                }}
              >
                {ALBUM_ACCEPTED_PHOTO_EXTENSIONS_UI}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  mt: 0.5,
                  ...comicStyle,
                  textAlign: 'center',
                  color: 'var(--theme-primary-color)',
                  fontSize: 'clamp(1.15rem, 1.1vw, 1.8rem)'
                }}
              >
                {ALBUM_ACCEPTED_VIDEO_EXTENSIONS_UI}
              </Typography>
            </Box>
          ) : isMobileUpload ? (
            <Box
              sx={{
                width: '100%',
                flexShrink: 0,
                minHeight: { xs: 180, md: 'auto' },
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                px: 1.5,
                py: 2,
                boxSizing: 'border-box'
              }}
            >
              {uploading ? (
                <CircularProgress size={48} sx={{ color: 'var(--theme-primary-color)' }} />
              ) : (
                <>
                  <Box
                    sx={{
                      width: '100%',
                      maxWidth: 420,
                      mx: 'auto',
                      bgcolor: MOBILE_UPLOAD_SURFACE_BG,
                      borderRadius: 2,
                      p: 1.25,
                      boxSizing: 'border-box'
                    }}
                  >
                    <Box
                      sx={{
                        position: 'relative',
                        width: '100%',
                        aspectRatio: '1 / 1',
                        maxHeight: { xs: 300, sm: 360 },
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Box
                        component="img"
                        src={cameraOrPhotoUploadImg}
                        alt=""
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          display: 'block',
                          pointerEvents: 'none',
                          userSelect: 'none'
                        }}
                      />
                      <Box
                        component="button"
                        type="button"
                        aria-label="Take a photo with your camera"
                        onClick={() => triggerFilePicker(mobileCameraInputRef)}
                        sx={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: '50%',
                          border: 'none',
                          p: 0,
                          m: 0,
                          cursor: 'pointer',
                          bgcolor: 'transparent',
                          borderRadius: 0
                        }}
                      />
                      <Box
                        component="button"
                        type="button"
                        aria-label="Open camera or photo library"
                        onClick={() => triggerFilePicker(mobileGalleryInputRef)}
                        sx={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: '50%',
                          border: 'none',
                          p: 0,
                          m: 0,
                          cursor: 'pointer',
                          bgcolor: 'transparent',
                          borderRadius: 0
                        }}
                      />
                    </Box>
                  </Box>
                  <Typography
                    variant="body1"
                    sx={{
                      ...comicStyle,
                      textAlign: 'center',
                      color: 'var(--theme-primary-color)',
                      fontWeight: 700,
                      fontSize: { xs: '1.1rem', sm: '1.2rem' },
                      mt: 1.5,
                      px: 0.5
                    }}
                  >
                    Tap camera or gallery to upload your image
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      mt: 1,
                      ...comicStyle,
                      textAlign: 'center',
                      color: 'var(--theme-primary-color)',
                      fontSize: { xs: '0.88rem', sm: '0.95rem' },
                      px: 0.5
                    }}
                  >
                    {ALBUM_ACCEPTED_PHOTO_EXTENSIONS_UI}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      mt: 0.5,
                      ...comicStyle,
                      textAlign: 'center',
                      color: 'var(--theme-primary-color)',
                      fontSize: { xs: '0.88rem', sm: '0.95rem' },
                      px: 0.5
                    }}
                  >
                    {ALBUM_ACCEPTED_VIDEO_EXTENSIONS_UI}
                  </Typography>
                </>
              )}
            </Box>
          ) : (
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                alignItems: 'stretch',
                gap: { xs: 2, md: 2 },
                width: '100%'
              }}
            >
              <Box
                className="my-story-upload-drop"
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => triggerFilePicker(fileInputRef)}
                sx={{
                  border: '3px solid var(--theme-primary-color)',
                  borderRadius: 2,
                  bgcolor: dragOver ? 'var(--theme-daynight-color)' : 'var(--theme-secondary-color)',
                  minHeight: { xs: 200, md: 'clamp(140px, 14vw, 200px)' },
                  flex: { xs: '1 1 auto', md: '1 1 50%' },
                  width: { xs: '100%', md: '50%' },
                  maxWidth: { md: '50%' },
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s, border-color 0.2s',
                  px: { xs: 1.5, md: 2 },
                  py: { xs: 2, md: 1.5 }
                }}
              >
                {uploading ? (
                  <CircularProgress size={48} sx={{ color: 'var(--theme-primary-color)' }} />
                ) : (
                  <>
                    <Box
                      component="img"
                      src={dragDropClickUploadImg}
                      alt="Drag and drop or click to upload images"
                      className="my-story-upload-graphic"
                      sx={{
                        maxWidth: 'min(100%, clamp(120px, 18vw, 240px))',
                        width: '100%',
                        height: 'auto',
                        mb: { xs: 1, md: 0.5 },
                        display: 'block',
                        cursor: 'pointer',
                        userSelect: 'none',
                        ...myStoryUploadGraphicHoverSx
                      }}
                    />
                    <Typography
                      variant="body1"
                      className="my-story-upload-caption"
                      sx={{
                        ...comicStyle,
                        textAlign: 'center',
                        color: 'var(--theme-primary-color)',
                        fontWeight: 700,
                        fontSize: { xs: 'clamp(1rem, 3.5vw, 1.35rem)', md: 'clamp(1.1rem, 1.2vw, 1.5rem)' },
                        lineHeight: 1.35,
                        maxWidth: '100%',
                        ...buttonHoverMagnifyTransitionSx,
                        '@media (hover: hover)': {
                          '.my-story-upload-drop:hover &': hoverMagnifyFontSizeSx({
                            baseFontSize: {
                              xs: 'clamp(1rem, 3.5vw, 1.35rem)',
                              sm: 'clamp(1.1rem, 1.2vw, 1.5rem)'
                            }
                          })
                        }
                      }}
                    >
                      Drag and drop or click here to upload photos or vault media
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        mt: 1,
                        ...comicStyle,
                        textAlign: 'center',
                        color: 'var(--theme-primary-color)',
                        fontSize: { xs: 'clamp(0.85rem, 3vw, 1.1rem)', md: 'clamp(0.95rem, 1vw, 1.25rem)' },
                        lineHeight: 1.35,
                        maxWidth: '100%'
                      }}
                    >
                      {ALBUM_ACCEPTED_PHOTO_EXTENSIONS_UI}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        mt: 0.5,
                        ...comicStyle,
                        textAlign: 'center',
                        color: 'var(--theme-primary-color)',
                        fontSize: { xs: 'clamp(0.85rem, 3vw, 1.1rem)', md: 'clamp(0.95rem, 1vw, 1.25rem)' },
                        lineHeight: 1.35,
                        maxWidth: '100%'
                      }}
                    >
                      {ALBUM_ACCEPTED_VIDEO_EXTENSIONS_UI}
                    </Typography>
                  </>
                )}
              </Box>
              <Box
                sx={{
                  flex: { xs: '1 1 auto', md: '1 1 50%' },
                  width: { xs: '100%', md: '50%' },
                  maxWidth: { md: '50%' },
                  minWidth: 0,
                  alignSelf: 'stretch',
                  display: 'flex'
                }}
                onClick={(e) => e.stopPropagation()}
                {...guestDemoAllowProps()}
              >
                <ProfilePhotoUploadQrPanel
                  variant="inline"
                  onPhoneUploadComplete={handlePhoneUploadComplete}
                />
              </Box>
            </Box>
          )}
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[ALBUM_TYPES.uploaded, ALBUM_TYPES.public, ALBUM_TYPES.private].map((albumType) => {
                const albumPhotos = photosByType[albumType] || [];
                const albumPhotoCount = albumPhotos.length;
                const isDragOver = dragOverAlbumType === albumType;
                return (
                  <Box
                    key={albumType}
                    onDragOver={(e) => handleAlbumDragOver(e, albumType)}
                    onDragLeave={(e) => {
                      const rel = e.relatedTarget;
                      if (rel && e.currentTarget.contains(rel)) return;
                      setDragOverAlbumType((prev) => (prev === albumType ? null : prev));
                    }}
                    onDrop={(e) => {
                      void handleAlbumDrop(e, albumType);
                    }}
                  >
                    <Box
                      sx={{
                        border: MY_STORY_ALBUM_PANEL_BORDER,
                        borderRadius: 1,
                        p: 1,
                        minHeight: 88,
                        bgcolor: isDragOver ? 'var(--theme-daynight-color)' : 'var(--theme-secondary-color)',
                        transition: 'background-color 0.2s, border-color 0.2s'
                      }}
                    >
                      {(() => {
                        const youtubeSlotIndex = ALBUM_YOUTUBE_PLAY_SLOT_INDEX[albumType];
                        const opensYoutube = Number.isFinite(youtubeSlotIndex);
                        const albumBulkCount = albumPhotos.filter((p) =>
                          bulkSelectedPhotoIds.includes(Number(p.photos_id))
                        ).length;
                        return (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', mb: 0.5 }}>
                      <UnSelectedButtonTemplate
                        {...(opensYoutube
                          ? {
                              type: 'button',
                              onClick: () => openEmbeddedYoutubePlayer({ slotIndex: youtubeSlotIndex, play: true }),
                              ...guestDemoAllowProps()
                            }
                          : { component: 'div', tabIndex: -1 })}
                        hoverScale={1}
                        fitLabelWidth={false}
                        shrinkLabelToFit
                        shrinkLabelMaxFontSize={
                          albumType === ALBUM_TYPES.private
                            ? myStoryPrivateAlbumTitleFontSize
                            : myStoryAlbumTitleFontSize
                        }
                        fullWidth
                        sx={{
                          ...myStoryAlbumPanelTitleButtonSx,
                          cursor: opensYoutube ? 'pointer' : 'default',
                          flex: 1
                        }}
                      >
                        {ALBUM_TITLES[albumType]} ({albumPhotoCount}/{ALBUM_MAX})
                      </UnSelectedButtonTemplate>
                      {albumBulkCount > 0 ? (
                        <UnSelectedButtonTemplate
                          type="button"
                          size="small"
                          disabled={Boolean(deletingId)}
                          onClick={() =>
                            openBulkPhotosDeleteConfirm(albumPhotos.map((p) => Number(p.photos_id)))
                          }
                          sx={{ minWidth: 0, flexShrink: 0, whiteSpace: 'nowrap', boxShadow: 'none' }}
                        >
                          Delete selected ({albumBulkCount})
                        </UnSelectedButtonTemplate>
                      ) : null}
                      </Box>
                        );
                      })()}
                      {albumPhotoCount === 0 ? (
                        <Typography
                          variant="caption"
                          sx={{ fontSize: myStoryAlbumDropHintFontSize, color: 'var(--theme-primary-color)', opacity: 0.78 }}
                        >
                          Drop photos here
                        </Typography>
                      ) : null}
                      <Box
                        data-suppress-touch-contextmenu="true"
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                          gap: { xs: 0.75, sm: 1 },
                          width: '100%',
                          WebkitTouchCallout: 'none',
                          WebkitTapHighlightColor: 'transparent',
                          userSelect: 'none'
                        }}
                      >
                        {albumPhotos.map((p) => {
                          const photoId = Number(p.photos_id);
                          const isBulkSelected = bulkSelectedPhotoIds.includes(photoId);
                          return (
                          <Box
                            key={p.photos_id}
                            sx={{ minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                          >
                            <Box
                              draggable
                              onDragStart={(e) => handleTileDragStart(e, p)}
                              onDragEnd={handleTileDragEnd}
                              onClick={(e) => handleAlbumPhotoClick(p.photos_id, e)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              sx={{
                                position: 'relative',
                                cursor: 'grab',
                                width: '100%',
                                aspectRatio: '1 / 1',
                                borderRadius: 1,
                                border: selectedPhotoId === p.photos_id || isBulkSelected ? '2px solid' : '2px solid transparent',
                                borderColor:
                                  selectedPhotoId === p.photos_id
                                    ? 'primary.main'
                                    : isBulkSelected
                                      ? '#00e676'
                                      : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                bgcolor: 'grey.200',
                                transformOrigin: 'center center',
                                transition: 'transform 0.18s ease, filter 0.18s ease',
                                WebkitTouchCallout: 'none',
                                WebkitTapHighlightColor: 'transparent',
                                userSelect: 'none',
                                '&:active': { cursor: 'grabbing' },
                                '&:hover, &:focus-visible': {
                                  transform: 'scale(1.18)',
                                  zIndex: 6
                                },
                                '&:hover .my-story-album-media-hover-label, &:focus-visible .my-story-album-media-hover-label': {
                                  opacity: 1
                                }
                              }}
                            >
                              <Box
                                sx={{
                                  position: 'relative',
                                  zIndex: 0,
                                  width: '79%',
                                  height: '79%',
                                  overflow: 'hidden'
                                }}
                              >
                                <Box
                                  component="img"
                                  src={albumPhotoUrl(p.photos_id)}
                                  alt={`Upload ${p.photos_id}`}
                                  draggable={false}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  sx={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    display: 'block',
                                    WebkitTouchCallout: 'none',
                                    WebkitTapHighlightColor: 'transparent',
                                    userSelect: 'none',
                                    pointerEvents: 'none'
                                  }}
                                />
                              </Box>
                              <Box
                                sx={{
                                  position: 'absolute',
                                  inset: 0,
                                  zIndex: 1,
                                  backgroundImage: `url(${filmBackground})`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                  pointerEvents: 'none'
                                }}
                                aria-hidden
                              />

                              <ThumbnailDeleteXButton
                                aria-label="Permanently delete photo"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => handleDeletePhoto(e, p)}
                              />

                              {profilePhotoId === p.photos_id && (
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    zIndex: 2,
                                    top: 4,
                                    left: -22,
                                    bgcolor: 'var(--theme-secondary-color)',
                                    color: '#000',
                                    border: '2px solid #000',
                                    px: 1,
                                    py: 0.25,
                                    transform: 'rotate(-45deg)',
                                    transformOrigin: 'left top',
                                    fontSize: '0.6rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    pointerEvents: 'none'
                                  }}
                                >
                                  Profile
                                </Box>
                              )}

                              {isBulkSelected ? (
                                <Box
                                  aria-hidden
                                  sx={{
                                    position: 'absolute',
                                    zIndex: 3,
                                    left: 4,
                                    bottom: 4,
                                    width: 22,
                                    height: 22,
                                    borderRadius: '50%',
                                    bgcolor: '#00e676',
                                    border: '2px solid #fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 1px 6px rgba(0,0,0,0.45)',
                                    pointerEvents: 'none'
                                  }}
                                >
                                  <IconCheck size={14} color="#fff" stroke={3.2} />
                                </Box>
                              ) : null}

                              <Box className="my-story-album-media-hover-label" sx={myStoryAlbumMediaHoverLabelSx} aria-hidden>
                                <Typography component="span" sx={myStoryAlbumMediaHoverLabelTextSx}>
                                  {formatMyStoryPhotoHoverLabel(p)}
                                </Typography>
                              </Box>

                            </Box>

                            {debugPhotoInfo ? (
                              <Typography
                                variant="caption"
                                sx={{
                                  mt: 0.5,
                                  fontFamily: MAIN_FONT_FAMILY,
                                  color: 'var(--theme-primary-color)',
                                  fontWeight: 700,
                                  fontSize: '0.65rem',
                                  lineHeight: 1.1,
                                  textAlign: 'center',
                                  maxWidth: '100%',
                                  wordBreak: 'break-word'
                                }}
                              >
                                {(() => {
                                  const fileName = p.file_extension ? `${p.photos_id}.${p.file_extension}` : `${p.photos_id}`;
                                  const sizeBytes = p.file_size_bytes;
                                  if (sizeBytes == null) return fileName;
                                  const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(1);
                                  return `${fileName} (${sizeMb}mb)`;
                                })()}
                              </Typography>
                            ) : null}
                          </Box>
                        );
                        })}
                      </Box>
                    </Box>
                  </Box>
                );
              })}
              <Box>
                <Box
                  sx={{
                    border: MY_STORY_ALBUM_PANEL_BORDER,
                    borderRadius: 1,
                    p: 1,
                    minHeight: 88,
                    bgcolor: 'var(--theme-secondary-color)'
                  }}
                >
                  <UnSelectedButtonTemplate
                    type="button"
                    hoverScale={1}
                    fitLabelWidth={false}
                    shrinkLabelToFit
                    shrinkLabelMaxFontSize={myStoryAlbumTitleFontSize}
                    fullWidth
                    {...guestDemoAllowProps()}
                    onClick={() =>
                      openEmbeddedYoutubePlayer({
                        slotIndex: ALBUM_YOUTUBE_PLAY_SLOT_INDEX.publicVideo,
                        play: true
                      })
                    }
                    sx={{ ...myStoryAlbumPanelTitleButtonSx, mb: 0.5, cursor: 'pointer' }}
                  >
                    {PUBLIC_VIDEO_ALBUM_TITLE} ({publicAlbumVideos.length}/{PUBLIC_VIDEO_ALBUM_MAX})
                  </UnSelectedButtonTemplate>
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      mb: 1,
                      fontSize: myStoryAlbumDropHintFontSize,
                      color: 'var(--theme-primary-color)',
                      opacity: 0.85
                    }}
                  >
                    {PUBLIC_VIDEO_ALBUM_HINT}
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                      gap: { xs: 0.75, sm: 1 },
                      width: '100%'
                    }}
                  >
                    {Array.from({ length: PUBLIC_VIDEO_ALBUM_MAX }, (_, slotIndex) => {
                      const v = publicAlbumVideos[slotIndex];
                      if (!v) {
                        return (
                          <Box
                            key={`public-video-empty-${slotIndex}`}
                            sx={{
                              border: '2px dashed var(--theme-primary-color)',
                              borderRadius: 1,
                              aspectRatio: '1 / 1',
                              minHeight: { xs: 44, sm: 48 },
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--theme-primary-color)',
                              opacity: 0.65,
                              fontWeight: 700,
                              fontSize: myStoryAlbumDropHintFontSize
                            }}
                            aria-label={`Public video album slot ${slotIndex + 1} empty`}
                          >
                            Empty
                          </Box>
                        );
                      }
                      const videoId = Number(v.video_id);
                      return (
                        <Box
                          key={`public-video-${videoId}`}
                          sx={{ minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                        >
                          <Box
                            draggable
                            onDragStart={(e) => handleVideoTileDragStart(e, v)}
                            onClick={() => {
                              setAlbumVideoPlaybackId(videoId);
                              setAlbumVideoPlaybackExt(v.file_extension || '');
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            sx={{
                              position: 'relative',
                              cursor: 'grab',
                              width: '100%',
                              aspectRatio: '1 / 1',
                              borderRadius: 1,
                              border: '2px solid transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              bgcolor: '#111',
                              transformOrigin: 'center center',
                              transition: 'transform 0.18s ease',
                              '&:active': { cursor: 'grabbing' },
                              '&:hover, &:focus-visible': {
                                transform: 'scale(1.18)',
                                zIndex: 6
                              },
                              '&:hover .my-story-album-media-hover-label, &:focus-visible .my-story-album-media-hover-label': {
                                opacity: 1
                              }
                            }}
                          >
                            <Box
                              sx={{
                                position: 'relative',
                                zIndex: 0,
                                width: '79%',
                                height: '79%',
                                overflow: 'hidden'
                              }}
                            >
                              <SelfIntroVideoFrameThumbnail
                                videoId={videoId}
                                mediaExtension={v.file_extension}
                                sx={{ width: '100%', height: '100%' }}
                              />
                            </Box>
                            <Box
                              sx={{
                                position: 'absolute',
                                inset: 0,
                                zIndex: 1,
                                backgroundImage: `url(${filmBackground})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                pointerEvents: 'none'
                              }}
                              aria-hidden
                            />
                            <ThumbnailDeleteXButton
                              aria-label="Permanently delete video"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => handleDeleteVideo(e, v)}
                            />
                            <Box className="my-story-album-media-hover-label" sx={myStoryAlbumMediaHoverLabelSx} aria-hidden>
                              <Typography component="span" sx={myStoryAlbumMediaHoverLabelTextSx}>
                                {formatMyStoryVideoHoverLabel(v)}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              </Box>
          </Box>
        </Box>
        </Box>
      </Box>

      {uploadError && (
        <Typography color="error" variant="body2" sx={{ mb: 2 }}>
          {uploadError}
        </Typography>
      )}

      <Box
        ref={addNewPostingSectionRef}
        sx={{
          mt: 2,
          border: ADD_NEW_POSTING_BORDER,
          borderRadius: 1,
          bgcolor: 'var(--theme-daynight-color)'
        }}
      >
        <Box
          sx={{
            px: 1.5,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            flexWrap: 'wrap',
            borderBottom: '1px solid var(--theme-primary-color)'
          }}
        >
          <Typography
            sx={{
              fontFamily: MAIN_FONT_FAMILY,
              color: 'var(--theme-primary-color)',
              fontWeight: 700
            }}
          >
            {editingPostId != null ? 'Edit Posting here' : 'Add New Posting here'}
          </Typography>
          <Select
            value={postingDraftVisibility}
            open={postingVisibilityMenuOpen}
            onOpen={() => setPostingVisibilityMenuOpen(true)}
            onClose={() => {
              setPostingVisibilityMenuOpen(false);
              pendingSaveAfterVisibilityRef.current = false;
            }}
            onChange={(e) => {
              // Draft-only when user opens the control without clicking Save.
              if (pendingSaveAfterVisibilityRef.current) return;
              setPostingDraftVisibility(normalizeColorTemplate11PostingVisibility(e.target.value));
            }}
            size="small"
            sx={colorTemplate11PostingVisibilitySelectSx()}
            MenuProps={colorTemplate11PostingVisibilityMenuProps({
              PaperProps: { sx: { maxHeight: COLOR_TEMPLATE11_POSTING_VISIBILITY_SELECT_HEIGHT * 6 } }
            })}
            {...guestDemoAllowProps()}
          >
            <MenuItem value="public" onClick={() => handlePostingVisibilityPicked('public')}>
              Public
            </MenuItem>
            <MenuItem value="friends" onClick={() => handlePostingVisibilityPicked('friends')}>
              Buddies
            </MenuItem>
            <MenuItem value="mySelf" onClick={() => handlePostingVisibilityPicked('mySelf')}>
              MySelf
            </MenuItem>
          </Select>
        </Box>
        <Box sx={{ px: 1.5, pt: 1, pb: 0 }}>
          <Box
            component="button"
            type="button"
            onClick={() => setMoreSharingPopupOpen(true)}
            sx={{
              display: 'inline',
              p: 0,
              m: 0,
              border: 'none',
              bgcolor: 'transparent',
              fontFamily: MAIN_FONT_FAMILY,
              fontSize: { xs: getMobileSinglesTextFontSizeVw(), sm: getDesktopTextFontSizeVw() },
              fontWeight: 700,
              color: 'var(--theme-primary-color)',
              textDecoration: 'underline',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            (Click here for upgrade photo sharing limit)
          </Box>
        </Box>
        <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <Box
            className="my-story-upload-drop"
            onDrop={handlePostingDrop}
            onDragOver={(e) => {
              e.preventDefault();
              if (e.dataTransfer?.types?.includes(SELF_INTRO_VIDEO_ID_MIME) || e.dataTransfer?.types?.includes('Files')) {
                e.dataTransfer.dropEffect = 'copy';
              } else {
                e.dataTransfer.dropEffect = 'move';
              }
              setPostingDragOver(true);
            }}
            onDragLeave={(e) => {
              const rel = e.relatedTarget;
              if (rel && e.currentTarget.contains(rel)) return;
              setPostingDragOver(false);
            }}
            sx={{
              minHeight: { xs: 200, sm: 240 },
              border: '3px solid var(--theme-primary-color)',
              borderRadius: 2,
              bgcolor: postingDragOver ? 'var(--theme-daynight-color)' : 'var(--theme-green-color)',
              px: 1.75,
              py: 1.75,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s ease'
            }}
          >
            {postingDraftPhotoIds.length === 0 && postingDraftVideoIds.length === 0 ? (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: { xs: 1.25, sm: 2 },
                  flexWrap: 'wrap'
                }}
              >
                <Box
                  component="img"
                  src={dragDropPhotoImg}
                  alt=""
                  sx={{
                    maxWidth: 'min(100%, clamp(100px, 16vw, 180px))',
                    width: 'auto',
                    height: 'auto',
                    display: 'block',
                    userSelect: 'none',
                    pointerEvents: 'none'
                  }}
                />
                <Typography className="my-story-upload-caption" component="div" sx={myStoryPostingDropCaptionSx}>
                  <Box component="span" sx={{ display: 'block' }}>
                    Drag &amp; Drop Photos or Self Intro Videos here
                  </Box>
                  <Box component="span" sx={{ display: 'block' }}>
                    From Albums or Video Library
                  </Box>
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {postingDraftPhotoIds.map((photoId) => (
                  <Box
                    key={`photo-${photoId}`}
                    sx={{
                      width: 86,
                      height: 86,
                      borderRadius: 1,
                      position: 'relative',
                      border: '1px solid var(--theme-primary-color)',
                      overflow: 'hidden',
                      bgcolor: '#fff'
                    }}
                  >
                    <Box component="img" src={albumPhotoUrl(photoId)} alt="draft posting" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <ThumbnailDeleteXButton
                      aria-label="Remove draft posting photo"
                      onClick={() => removeDraftPostingPhoto(photoId)}
                    />
                  </Box>
                ))}
                {postingDraftVideoIds.map((videoId) => (
                  <Box
                    key={`video-${videoId}`}
                    sx={{
                      width: 86,
                      height: 86,
                      borderRadius: 1,
                      position: 'relative',
                      border: '1px solid var(--theme-primary-color)',
                      overflow: 'hidden',
                      bgcolor: '#111'
                    }}
                  >
                    <SelfIntroVideoFrameThumbnail videoId={videoId} />
                    <ThumbnailDeleteXButton
                      aria-label="Remove draft posting video"
                      onClick={() => removeDraftPostingVideo(videoId)}
                    />
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          <Box
            sx={{
              bgcolor: 'var(--theme-primary-color)',
              borderRadius: 2,
              p: 1.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.25
            }}
          >
          <TextField
            multiline
            minRows={2}
            value={postingDraftText}
            onChange={(e) => setPostingDraftText(e.target.value)}
            placeholder="Add comments here"
            fullWidth
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: '#ffffff',
                color: '#000000',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'var(--theme-primary-color)'
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'var(--theme-primary-color)'
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'var(--theme-primary-color)',
                  borderWidth: 1
                }
              },
              '& .MuiInputBase-input': {
                color: '#000000'
              },
              '& .MuiInputBase-input::placeholder': {
                color: 'rgba(0,0,0,0.45)',
                opacity: 1
              }
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
            {editingPostId != null ? (
              <UnSelectedButtonTemplate
                fitLabelWidth={false}
                disableElevation
                onClick={handleCancelPostingEdit}
                disabled={postingSaving}
                sx={{
                  minWidth: 120,
                  fontWeight: 600,
                  fontSize: myStoryButtonFontSize,
                  transformOrigin: 'center center'
                }}
              >
                Cancel
              </UnSelectedButtonTemplate>
            ) : null}
            <UnSelectedButtonTemplate
              greenGreyStates={postingSaveReady}
              fitLabelWidth={false}
              disableElevation
              onClick={handlePostingSaveClick}
              disabled={postingSaving}
              sx={{
                minWidth: 120,
                fontWeight: 600,
                fontSize: myStoryButtonFontSize,
                transformOrigin: 'center center',
                ...buttonHoverMagnifyTransitionSx,
                ...(!postingSaveReady
                  ? {
                      bgcolor: 'transparent !important',
                      color: 'var(--theme-inverse-daynight-color) !important',
                      WebkitTextFillColor: 'var(--theme-inverse-daynight-color) !important',
                      border: '1px solid var(--theme-inverse-daynight-color) !important',
                      boxShadow: 'none',
                      opacity: 1,
                      cursor: 'default',
                      pointerEvents: 'auto',
                      '&.Mui-disabled': {
                        bgcolor: 'transparent !important',
                        color: 'var(--theme-inverse-daynight-color) !important',
                        WebkitTextFillColor: 'var(--theme-inverse-daynight-color) !important',
                        border: '1px solid var(--theme-inverse-daynight-color) !important',
                        opacity: 1,
                        cursor: 'default',
                        pointerEvents: 'auto'
                      }
                    }
                  : null),
                '@media (hover: hover)': {
                  '&:hover:not(.Mui-disabled)': {
                    ...(postingSaveReady
                      ? null
                      : {
                          bgcolor: 'transparent !important',
                          color: 'var(--theme-inverse-daynight-color) !important',
                          WebkitTextFillColor: 'var(--theme-inverse-daynight-color) !important',
                          border: '1px solid var(--theme-inverse-daynight-color) !important'
                        }),
                    ...buttonHoverMagnifyFontSx({ baseFontSize: myStoryButtonFontSize })
                  }
                }
              }}
            >
              {postingSaving ? 'Saving...' : 'Save'}
            </UnSelectedButtonTemplate>
          </Box>
          </Box>
        </Box>
      </Box>
      </>
      ) : null}
      </Box>

      <PostingCommentsDialog
        open={commentsDialog != null}
        postId={commentsDialog?.postId}
        photos={commentsDialog?.photos ?? []}
        onClose={() => setCommentsDialog(null)}
        onCommentsChanged={() => {
          void Promise.all([refetchMyPicksFeed(), invalidateMyPicksFeedCache()]);
        }}
      />
      <PostingLikesDialog
        open={likesPostId != null}
        loading={likesLoading}
        error={likesError}
        likesList={likesList}
        onClose={closeLikesPopover}
      />
      <SelfIntroVideoPlaybackPopup
        open={albumVideoPlaybackId != null}
        videoId={albumVideoPlaybackId}
        mediaExtension={albumVideoPlaybackExt}
        onClose={() => {
          setAlbumVideoPlaybackId(null);
          setAlbumVideoPlaybackExt('');
        }}
      />
      <SelfIntroVideoSlotsFullPopup open={vaultSlotsFullOpen} onClose={() => setVaultSlotsFullOpen(false)} />
      {postingDeleteConfirmDialog}

        </MainCard>
      </Box>
    </Box>
  );
}
