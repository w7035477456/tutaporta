/**
 * Second copy of the "Picks & Posts" (MyPicks) two-column layout, adapted for
 * Vetted Friends (/vettedFriends): left member list + actions from the
 * former grid; right column uses the same posting feed API as MyPicks.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import ButtonBase from '@mui/material/ButtonBase';
import Button from '@mui/material/Button';
import UserRound from 'assets/images/users/profile.jpeg';
import sendFlowerGreenIcon from 'assets/images/sendFlower_green.png';
import {
  fetchApprovedCheckrBioReview,
  fetchMemberCheckrBioReviewPreview,
  fetchMyPicksFeedPage,
  fetchPostingLikes,
  invalidateMyPicksFeedCache,
  togglePostingLike,
  useGetMyPicksFeed
} from 'api/myPicksFe';
import { postInterestedRequestInfo } from 'api/interestedSinglesFe';
import { postRequestSentBlock } from 'api/requestsSentFe';
import PostingCommentsDialog from 'views/dashboard/interested/PostingCommentsDialog';
import PostingLikesDialog from 'views/dashboard/interested/PostingLikesDialog';
import CheckrBioReviewPanel from 'views/utilities/CheckrBioReviewPanel';
import { postSaveConsentRecord } from 'api/consentRecordFe';
import { PROFILES_RECORDS_PATH } from 'constants/profilesRecordsRoute';
import {
  CONSENT_DESCRIPTION_VIEW_BRIEF_BIO,
  CONSENT_DESCRIPTION_VIEW_FULL_BIO,
  CONSENT_WATERMARK_VARIANTS
} from 'constants/consentRecordVariants';
import { captureElementAsPng } from 'utils/captureConsentDialogImage';
import { formatCapitalizedFullName } from 'utils/fullNameFormat';
import api from 'api/axios';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import { buildProfilePhotoUrl } from 'utils/profilePhotoUrl';
import { formatMemberLabel, formatMemberNumber, getMemberDisplayLines } from 'utils/memberLabel';
import {
  formatOutgoingBioFriendLabel,
  formatOutgoingBioCancelActionMainDetailText,
  formatOutgoingBioRequestActionMainDetailText,
  formatOutgoingBioRequestIncludesPhrase,
  formatOutgoingBioRequestSentence,
  triStateBioRequestApproval
} from 'utils/receivedBioRequestDisplay';
import { APPROVAL_STATUS } from 'utils/approvalStatusEnum';
import useVsinglesTour from 'hooks/useVsinglesTour';
import { TOUR_STEP_VETTED_FRIENDS_SMS } from 'utils/vsinglesTour';
import { TOUR_LISA_MEMBER_NUMBER } from 'utils/vsinglesTourActions';
import { getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import ColorTemplate8PhotoGallery from 'ui-component/ColorTemplate8PhotoGallery';
import UnSelectedButtonTemplate from 'ui-component/UnSelectedButtonTemplate';
import ColorTemplate11Posting from 'ui-component/ColorTemplate11Posting';
import { isSelfIntroVideoPostingUrl, videoThumbnailUrlFromPostingUrl } from 'api/selfIntroVideoFe';
import { COLOR_TEMPLATE11_POSTING_INITIAL_LIMIT } from 'config/colorTemplate11Posting';
import usePostingFeedDelete from 'hooks/usePostingFeedDelete';
import { usePostingAlbumMediaFullscreen } from 'hooks/usePostingAlbumMediaFullscreen';
import PostingAlbumMediaFullscreen from 'ui-component/PostingAlbumMediaFullscreen';
import AlbumMediaDoubleClickSurface from 'ui-component/AlbumMediaDoubleClickSurface';
import { MANUAL_REFRESH_BUTTON_SX } from 'config/manualRefreshButtonEnv';
import { dispatchBellNotificationRefresh } from 'utils/notificationBellStore';
import { themedAlert } from 'utils/themedDialog';
import NotificationSection from 'layout/MainLayout/Header/NotificationSection';
import { LIGHT_SURFACE_CLASS } from 'utils/themeContrast';
import { getMobileSinglesTextFontSizeVw } from 'config/singlesMemberCardFontEnv';
import { useAuth } from 'contexts/AuthContext';
import { isAdminSession } from 'utils/adminSession';
import {
  buttonHoverMagnifyFontSx,
  buttonHoverMagnifyLabelOnlyFontSx,
  buttonHoverMagnifyTransitionSx,
  clickableTextHoverMagnifySx
} from 'config/hoverMagnifyEnv';
import VettedFriendsInlineChatPanel from 'views/utilities/VettedFriendsInlineChatPanel';
import { colorTemplate1WallColorByTheme } from 'config/colorTemplate1';
import { colorTemplate10MenuItemButtonSx } from 'config/colorTemplate10Menu';
import useConfig from 'hooks/useConfig';
import { getMyPicksAvatarSize } from 'config/myPicksCardEnv';
import { SIDEBAR_MOBILE_CLOSE_MEDIA } from 'config/sidebarMobileCloseEnv';
import { getAppPageScrollRegionMaxHeightCss, getAppPageZoomFactor } from 'utils/appPageScrollRegionEnv';

/** fe/.env MOBILE_FONT_SIZE_TEXT / DESKTOP_FONT_SIZE_TEXT — Vetted Friends main content copy */
const outgoingBioBodyTextFontSize = {
  xs: getMobileSinglesTextFontSizeVw(),
  sm: getDesktopTextFontSizeVw()
};

/** Approved ! — extra bold + visibly larger (“fat”) than surrounding bio copy */
const OUTGOING_BIO_APPROVED_FAT_FONT_SCALE = 1.3;
const outgoingBioApprovedStatusFontSize = {
  xs: `calc(${getMobileSinglesTextFontSizeVw()} * ${OUTGOING_BIO_APPROVED_FAT_FONT_SCALE})`,
  sm: `calc(${getDesktopTextFontSizeVw()} * ${OUTGOING_BIO_APPROVED_FAT_FONT_SCALE})`
};

/** Yellow sash + black outlined text — avatar when brief/full bio approval is approve. */
const vettedFriendsApprovedRibbonSx = {
  position: 'absolute',
  zIndex: 100,
  top: '14%',
  left: '-38%',
  width: '100%',
  py: '0.2rem',
  bgcolor: '#FFEB3B',
  color: '#000000',
  WebkitTextFillColor: '#000000',
  WebkitTextStroke: '0.45px #000000',
  paintOrder: 'stroke fill',
  textShadow: `
    -0.5px -0.5px 0 #000000,
     0.5px -0.5px 0 #000000,
    -0.5px  0.5px 0 #000000,
     0.5px  0.5px 0 #000000
  `,
  fontFamily: 'inherit',
  fontSize: { xs: '1.04rem', sm: '1.16rem' },
  fontWeight: 800,
  letterSpacing: 0.15,
  lineHeight: 1.15,
  textAlign: 'center',
  textTransform: 'none',
  whiteSpace: 'nowrap',
  transform: 'rotate(-45deg)',
  transformOrigin: 'center',
  pointerEvents: 'none',
  boxShadow: '0 1px 2px rgba(0,0,0,0.35)',
  border: '1.5px solid #000000',
  boxSizing: 'border-box'
};

const vettedFriendsPanelTextSx = {
  fontSize: outgoingBioBodyTextFontSize,
  lineHeight: 1.35
};

const VETTED_FRIENDS_ORDER_LS_PREFIX = 'vettedFriendsPhotoOrder:';
const INITIAL_POSTS_LIMIT = COLOR_TEMPLATE11_POSTING_INITIAL_LIMIT;

const blockedMemberCardSx = {
  border: '10px solid #d32f2f !important',
  borderStyle: 'solid !important',
  boxSizing: 'border-box',
  bgcolor: '#A1A1A1 !important'
};

const blockedMemberAvatarSx = {
  bgcolor: '#A1A1A1',
  cursor: 'not-allowed',
  pointerEvents: 'none',
  opacity: 0.9,
  '& img': {
    filter: 'grayscale(1)',
    opacity: 0.65
  }
};

const vettedFriendsUnblockButtonSx = {
  bgcolor: '#d32f2f !important',
  border: '1px solid #d32f2f !important',
  color: '#ffffff !important',
  WebkitTextFillColor: '#ffffff !important',
  fontWeight: 700,
  '@media (hover: hover)': {
    '&:hover:not(.Mui-disabled)': {
      bgcolor: '#b71c1c !important',
      border: '1px solid #b71c1c !important'
    }
  }
};

function triStateApproval(value) {
  return triStateBioRequestApproval(value);
}

function getFullBioRequestApproval(row) {
  return triStateApproval(row?.full_bio_request_approval);
}

function isBioRequestFlagged(value) {
  return String(value ?? '').trim().toLowerCase() === 'requested';
}

function isFullBioRequestFlagged(row) {
  return isBioRequestFlagged(row?.full_bio_request);
}

function isTruthyPaidFlag(value) {
  if (value === true || value === 1) return true;
  return (
    String(value ?? '')
      .trim()
      .toLowerCase() === 'true'
  );
}

function getBioRequestApprovalState(row, kind) {
  const value = kind === 'brief' ? row?.brief_bio_request_approval : row?.full_bio_request_approval;
  return triStateApproval(value);
}

function hasApprovedBioRequestRibbon(row) {
  return (
    getBioRequestApprovalState(row, 'brief') === APPROVAL_STATUS.APPROVE ||
    getBioRequestApprovalState(row, 'full') === APPROVAL_STATUS.APPROVE
  );
}

/** Outgoing request can be canceled only while still awaiting a response. */
function canCancelOutgoingBioRequest(row, kind) {
  const requested = kind === 'brief' ? isBioRequestFlagged(row?.brief_bio_request) : isFullBioRequestFlagged(row);
  if (!requested) return false;
  return getBioRequestApprovalState(row, kind) === APPROVAL_STATUS.NO_RESPONSE;
}

function formatOutgoingBioPanelTitle(row, kind) {
  const friendLabel = formatOutgoingBioFriendLabel(row);
  const bioLabel = kind === 'brief' ? 'Brief Bio' : 'Full Bio';
  return `View ${bioLabel} of ${friendLabel}`;
}

const VETTED_FRIENDS_ACTION_BUTTON_HOVER_SX = {
  ...buttonHoverMagnifyTransitionSx,
  transformOrigin: 'center'
};

const APPROVAL_BUTTON_GREEN_SX = {
  backgroundColor: '#43a047',
  color: '#ffffff',
  border: '1px solid #2e7d32',
  WebkitTextFillColor: '#ffffff',
  ...buttonHoverMagnifyTransitionSx,
  '&:hover:not(.Mui-disabled)': {
    bgcolor: '#388e3c',
    color: '#fff',
    ...buttonHoverMagnifyFontSx({ baseFontSize: outgoingBioBodyTextFontSize })
  }
};

const APPROVAL_BUTTON_RED_SX = {
  backgroundColor: '#ef5350',
  color: '#ffffff',
  border: '2px solid #b71c1c',
  WebkitTextFillColor: '#ffffff',
  ...buttonHoverMagnifyTransitionSx,
  '&:hover:not(.Mui-disabled)': {
    bgcolor: '#e53935',
    color: '#fff',
    ...buttonHoverMagnifyFontSx({ baseFontSize: outgoingBioBodyTextFontSize })
  }
};

const APPROVAL_BUTTON_GREY_SX = {
  backgroundColor: '#bdbdbd',
  color: '#212121',
  border: '1px solid #9e9e9e',
  cursor: 'not-allowed',
  WebkitTextFillColor: '#212121',
  '&.Mui-disabled': {
    backgroundColor: '#bdbdbd',
    color: '#212121',
    border: '1px solid #9e9e9e',
    WebkitTextFillColor: '#212121',
    opacity: 0.95
  }
};

const OUTGOING_BIO_APPROVAL_STATUS_TEXT_BORDER_SX = {
  WebkitTextStroke: '1px var(--theme-inverse-daynight-color)',
  paintOrder: 'stroke fill'
};

const OUTGOING_BIO_APPROVED_DOUBLE_TEXT_BORDER_SX = {
  WebkitTextStroke: '2px #000000',
  paintOrder: 'stroke fill'
};

function outgoingBioStatusWordSx(
  color,
  { clickable = false, busy = false, textBorder = false, doubleBold = false, doubleThickTextBorder = false } = {}
) {
  const statusFontSize = doubleBold ? outgoingBioApprovedStatusFontSize : outgoingBioBodyTextFontSize;
  return {
    color,
    WebkitTextFillColor: color,
    fontWeight: doubleBold ? 900 : 700,
    letterSpacing: doubleBold ? '0.03em' : undefined,
    background: 'none',
    backgroundColor: 'transparent',
    border: 'none',
    padding: 0,
    margin: 0,
    boxShadow: 'none',
    borderRadius: 0,
    display: 'inline',
    fontSize: statusFontSize,
    lineHeight: 1.2,
    verticalAlign: 'baseline',
    cursor: clickable && !busy ? 'pointer' : 'default',
    textDecoration: 'underline',
    textDecorationColor: '#ffffff',
    textUnderlineOffset: '2px',
    opacity: busy ? 0.65 : 1,
    ...(textBorder
      ? doubleThickTextBorder
        ? OUTGOING_BIO_APPROVED_DOUBLE_TEXT_BORDER_SX
        : OUTGOING_BIO_APPROVAL_STATUS_TEXT_BORDER_SX
      : null),
    ...clickableTextHoverMagnifySx({
      baseFontSize: statusFontSize,
      clickable,
      busy
    })
  };
}

const OUTGOING_BIO_APPROVAL_CYCLE = [
  APPROVAL_STATUS.NO_RESPONSE,
  APPROVAL_STATUS.APPROVE,
  APPROVAL_STATUS.DENY
];

function nextOutgoingBioApprovalState(current) {
  const state = triStateApproval(current);
  const idx = OUTGOING_BIO_APPROVAL_CYCLE.indexOf(state);
  const nextIdx = idx >= 0 ? (idx + 1) % OUTGOING_BIO_APPROVAL_CYCLE.length : 0;
  return OUTGOING_BIO_APPROVAL_CYCLE[nextIdx];
}

function outgoingBioApprovalWordColor(tone) {
  if (tone === 'approve') return '#43a047';
  if (tone === 'denied') return '#ef5350';
  return '#ffffff';
}

const OUTGOING_BIO_GREEN_ACTION_LABEL_SX = {
  display: 'inline-block',
  lineHeight: 1.2,
  fontSize: outgoingBioBodyTextFontSize,
  fontWeight: 700
};

const OUTGOING_BIO_CLICK_TO_VIEW_BORDER = '3px solid var(--theme-inverse-daynight-color)';

/** Green bio actions — label text magnifies on hover (HOVER_MAGNIFY_FACTOR); button box unchanged. */
function outgoingBioGreenActionButtonSx({ py = 0.5, px = 1, border = '1px solid #2e7d32' } = {}) {
  return {
    flexShrink: 0,
    textTransform: 'none',
    lineHeight: 1.25,
    py,
    px,
    minWidth: 0,
    minHeight: 'unset',
    bgcolor: '#43a047 !important',
    border: `${border} !important`,
    color: '#ffffff !important',
    WebkitTextFillColor: '#ffffff !important',
    boxShadow: 'none',
    transform: 'none !important',
    ...buttonHoverMagnifyTransitionSx,
    '@media (hover: hover)': {
      '&:hover:not(.Mui-disabled)': {
        bgcolor: '#388e3c !important',
        border: `${border} !important`,
        color: '#ffffff !important',
        WebkitTextFillColor: '#ffffff !important',
        transform: 'none !important',
        ...buttonHoverMagnifyLabelOnlyFontSx({ baseFontSize: outgoingBioBodyTextFontSize })
      }
    }
  };
}

const OUTGOING_BIO_CLICK_TO_VIEW_BUTTON_SX = outgoingBioGreenActionButtonSx({
  border: OUTGOING_BIO_CLICK_TO_VIEW_BORDER
});
const OUTGOING_BIO_REQUEST_TO_VIEW_BUTTON_SX = outgoingBioGreenActionButtonSx({
  py: 0.75,
  px: 1.25,
  border: OUTGOING_BIO_CLICK_TO_VIEW_BORDER
});

function BioRequestNumberedLine({ lineNumber, children }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.6, width: '100%' }}>
      <Typography
        component="span"
        sx={{
          flexShrink: 0,
          fontWeight: 700,
          color: 'var(--theme-primary-color)',
          ...vettedFriendsPanelTextSx
        }}
      >
        {lineNumber})
      </Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

function OutgoingBioRequestSentenceLine({
  row,
  bioKind,
  onApprovedClick,
  needsTokenUnlock = false,
  isAdmin = false,
  statusBusy = false,
  onAdminCycleRequest,
  onAdminCycleApproval
}) {
  const sentence = useMemo(
    () => (row ? formatOutgoingBioRequestSentence(row, bioKind) : null),
    [row, bioKind]
  );

  if (!row || !sentence) return null;

  const { requestText, friendLabel, bioPhrase, approval } = sentence;
  const showResponseLine = requestText !== 'Not Requested';
  const bioStatusSuffix = showResponseLine ? `${bioPhrase} Response:` : `${bioPhrase}.`;
  const requestWordClickable = isAdmin && typeof onAdminCycleRequest === 'function';
  const approvalWordClickable = isAdmin && approval.text && typeof onAdminCycleApproval === 'function';

  const sentenceTextSx = {
    display: 'block',
    width: '100%',
    color: 'var(--theme-primary-color)',
    fontWeight: 600,
    lineHeight: 1.35,
    fontSize: outgoingBioBodyTextFontSize
  };

  const renderApprovalContent = () => {
    if (approval.showViewAction) {
      return (
        <>
          <Box
            component="span"
            role={approvalWordClickable ? 'button' : undefined}
            tabIndex={approvalWordClickable ? 0 : undefined}
            title={approvalWordClickable ? 'Admin: click to cycle response status' : undefined}
            onClick={approvalWordClickable ? () => onAdminCycleApproval(row, bioKind) : undefined}
            onKeyDown={
              approvalWordClickable
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onAdminCycleApproval(row, bioKind);
                    }
                  }
                : undefined
            }
            sx={outgoingBioStatusWordSx('#43a047', {
              clickable: approvalWordClickable,
              busy: statusBusy,
              textBorder: true,
              doubleBold: true,
              doubleThickTextBorder: true
            })}
          >
            {approval.text}
          </Box>{' '}
          <Button
            type="button"
            disableElevation
            onClick={() => void onApprovedClick?.(bioKind)}
            sx={OUTGOING_BIO_CLICK_TO_VIEW_BUTTON_SX}
          >
            <Box component="span" className="hover-magnify-label" sx={OUTGOING_BIO_GREEN_ACTION_LABEL_SX}>
              {approval.actionText}
            </Box>
          </Button>
          {needsTokenUnlock ? (
            <Typography
              component="span"
              sx={{
                display: 'block',
                mt: 0.75,
                color: 'var(--theme-primary-color)',
                fontWeight: 600,
                fontSize: outgoingBioBodyTextFontSize,
                lineHeight: 1.35
              }}
            >
              Tap Click to view to unlock with {bioKind === 'full' ? '2 tokens' : '1 token'}. The bio table appears below
              after unlock.
            </Typography>
          ) : null}
        </>
      );
    }
    if (!approval.text) return null;
    return (
      <Box
        component="span"
        role={approvalWordClickable ? 'button' : undefined}
        tabIndex={approvalWordClickable ? 0 : undefined}
        className={approval.tone === 'denied' ? 'theme-red-emphasis' : undefined}
        title={approvalWordClickable ? 'Admin: click to cycle response status' : undefined}
        onClick={approvalWordClickable ? () => onAdminCycleApproval(row, bioKind) : undefined}
        onKeyDown={
          approvalWordClickable
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onAdminCycleApproval(row, bioKind);
                }
              }
            : undefined
        }
        sx={outgoingBioStatusWordSx(outgoingBioApprovalWordColor(approval.tone), {
          clickable: approvalWordClickable,
          busy: statusBusy,
          textBorder: approval.tone === 'approve' || approval.tone === 'denied',
          doubleBold: approval.tone === 'approve',
          doubleThickTextBorder: approval.tone === 'approve'
        })}
      >
        {approval.text}
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, width: '100%' }}>
      <Box component="span" sx={sentenceTextSx}>
        Status:{' '}
        <Box
          component="span"
          role={requestWordClickable ? 'button' : undefined}
          tabIndex={requestWordClickable ? 0 : undefined}
          title={requestWordClickable ? 'Admin: click to cycle request status' : undefined}
          onClick={requestWordClickable ? () => onAdminCycleRequest(row, bioKind) : undefined}
          onKeyDown={
            requestWordClickable
              ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onAdminCycleRequest(row, bioKind);
                  }
                }
              : undefined
          }
          sx={outgoingBioStatusWordSx('#ffffff', {
            clickable: requestWordClickable,
            busy: statusBusy,
            textBorder: true
          })}
        >
          {requestText}
        </Box>{' '}
        to view {friendLabel}
        {showResponseLine ? null : ` ${bioStatusSuffix}`}
      </Box>
      {showResponseLine ? (
        <Box component="span" sx={sentenceTextSx}>
          {bioStatusSuffix}{' '}
          {renderApprovalContent()}
        </Box>
      ) : null}
    </Box>
  );
}

function loadSavedOrderIds(storageKey, serverIds) {
  if (!storageKey) return [...serverIds];
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [...serverIds];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...serverIds];
    const saved = parsed.map(Number).filter((n) => Number.isFinite(n) && n >= 1);
    const serverSet = new Set(serverIds);
    const next = [];
    const used = new Set();
    for (const id of saved) {
      if (serverSet.has(id)) {
        next.push(id);
        used.add(id);
      }
    }
    for (const id of serverIds) {
      if (!used.has(id)) next.push(id);
    }
    return next;
  } catch {
    return [...serverIds];
  }
}

function persistOrder(storageKey, ids) {
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export default function VettedFriendsPicksLayout({
  rows,
  onApprovedViewClick,
  unlockApprovedBioViewKind = null,
  onUnlockApprovedBioViewConsumed,
  bioViewConsentCapture = null,
  onBioViewConsentCaptureConsumed,
  onBioRequestUpdated,
  onPrepareInlineChat,
  onSendFlower,
  initialSelectedSinglesId = null,
  initialOpenChat = false
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const downSM = useMediaQuery(theme.breakpoints.down('sm'));
  const vettedFriendsPhoneLayout = useMediaQuery(SIDEBAR_MOBILE_CLOSE_MEDIA);
  const {
    state: { pageZoom }
  } = useConfig();
  const API_BASE_URL = getApiBaseUrl();
  const [selectedSinglesId, setSelectedSinglesId] = useState(null);
  const [activeTabByTargetId, setActiveTabByTargetId] = useState({});
  /** Bumped when user opens SMS Chat so the inline composer can steal focus after mount. */
  const [composerFocusNonce, setComposerFocusNonce] = useState(0);
  const { myPicksFeed, myPicksFeedLoading, myPicksFeedError, refetchMyPicksFeed } = useGetMyPicksFeed(selectedSinglesId, {
    limit: INITIAL_POSTS_LIMIT,
    visibilityFeed: 'friends'
  });
  const { canDeletePosts, deleteBusy, handleDeletePosting, handleDeletePostingPhoto, deleteConfirmDialog } =
    usePostingFeedDelete(selectedSinglesId, { refetchFeed: refetchMyPicksFeed });
  const [commentsDialog, setCommentsDialog] = useState(null);
  const [likeBusyPostId, setLikeBusyPostId] = useState(null);
  const [likesPostId, setLikesPostId] = useState(null);
  const [likesList, setLikesList] = useState([]);
  const [likesLoading, setLikesLoading] = useState(false);
  const [likesError, setLikesError] = useState('');
  const [feedPosts, setFeedPosts] = useState([]);
  const [feedCursor, setFeedCursor] = useState(null);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [loadMoreBusy, setLoadMoreBusy] = useState(false);
  const [selectedPublicGalleryImageUrl, setSelectedPublicGalleryImageUrl] = useState('');
  const [selectedFriendGalleryImageUrl, setSelectedFriendGalleryImageUrl] = useState('');
  const [selectedPublicVideoGalleryImageUrl, setSelectedPublicVideoGalleryImageUrl] = useState('');
  const [chatRefreshNonce, setChatRefreshNonce] = useState(0);
  const [refreshChatBusy, setRefreshChatBusy] = useState(false);
  const [bioRequestBusyKey, setBioRequestBusyKey] = useState('');
  const [blockBusyKey, setBlockBusyKey] = useState('');
  const [blockUserOverrideByTargetId, setBlockUserOverrideByTargetId] = useState({});
  const [approvedBioReview, setApprovedBioReview] = useState(null);
  const [approvedBioReviewLoading, setApprovedBioReviewLoading] = useState(false);
  const [approvedBioReviewError, setApprovedBioReviewError] = useState('');
  const [viewUnlockError, setViewUnlockError] = useState('');
  const [previewBioReview, setPreviewBioReview] = useState(null);
  const [previewBioReviewLoading, setPreviewBioReviewLoading] = useState(false);
  const [previewBioReviewError, setPreviewBioReviewError] = useState('');
  const [approvedBioViewKinds, setApprovedBioViewKinds] = useState({ brief: false, full: false });
  const approvedBioCaptureRef = useRef(null);
  const bioViewConsentCaptureInFlightRef = useRef(false);

  const orderStorageKey = user?.singles_id ? `${VETTED_FRIENDS_ORDER_LS_PREFIX}${user.singles_id}` : null;
  const orderStorageKeyRef = useRef(orderStorageKey);
  const [orderedIds, setOrderedIds] = useState([]);
  const [draggingSinglesId, setDraggingSinglesId] = useState(null);
  const [dropTargetSinglesId, setDropTargetSinglesId] = useState(null);

  const rowByTargetId = useMemo(
    () => new Map(rows.map((r) => [Number(r.singles_id_to), r]).filter(([id]) => Number.isFinite(id) && id > 0)),
    [rows]
  );

  const effectiveBlockUser = useCallback(
    (row) => {
      const targetId = Number(row?.singles_id_to);
      if (!Number.isFinite(targetId) || targetId < 1) return false;
      if (Object.prototype.hasOwnProperty.call(blockUserOverrideByTargetId, targetId)) {
        return Boolean(blockUserOverrideByTargetId[targetId]);
      }
      return Boolean(row?.block_user);
    },
    [blockUserOverrideByTargetId]
  );

  const handleBlockToggle = useCallback(
    async (row) => {
      const targetId = Number(row?.singles_id_to);
      if (!Number.isFinite(targetId) || targetId < 1 || blockBusyKey) return;

      const nextBlock = !effectiveBlockUser(row);
      const busyKey = `${targetId}:block`;
      setBlockBusyKey(busyKey);
      setBlockUserOverrideByTargetId((prev) => ({ ...prev, [targetId]: nextBlock }));

      try {
        await postRequestSentBlock(targetId, nextBlock);
        if (typeof onBioRequestUpdated === 'function') {
          await onBioRequestUpdated();
        }
        setBlockUserOverrideByTargetId((prev) => {
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
      } catch (err) {
        console.error('[VettedFriendsPicksLayout] block toggle failed', err?.message ?? err);
        await themedAlert(err?.message || 'Failed to update block status');
        setBlockUserOverrideByTargetId((prev) => {
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
      } finally {
        setBlockBusyKey('');
      }
    },
    [blockBusyKey, effectiveBlockUser, onBioRequestUpdated]
  );

  useEffect(() => {
    if (!rows.length) {
      setOrderedIds([]);
      return;
    }
    const serverIds = rows.map((r) => Number(r.singles_id_to)).filter((id) => Number.isFinite(id) && id > 0);
    const storageKeyChanged = orderStorageKeyRef.current !== orderStorageKey;
    orderStorageKeyRef.current = orderStorageKey;
    setOrderedIds((prev) => {
      if (!prev.length || storageKeyChanged) {
        return loadSavedOrderIds(orderStorageKey, serverIds);
      }
      const serverSet = new Set(serverIds);
      const next = [];
      const used = new Set();
      for (const id of prev) {
        if (serverSet.has(id)) {
          next.push(id);
          used.add(id);
        }
      }
      for (const id of serverIds) {
        if (!used.has(id)) next.push(id);
      }
      return next;
    });
  }, [rows, orderStorageKey]);

  useEffect(() => {
    if (selectedSinglesId != null) return;
    if (!orderedIds.length) return;
    setSelectedSinglesId(orderedIds[0]);
  }, [orderedIds, selectedSinglesId]);

  useEffect(() => {
    if (selectedSinglesId == null) return;
    const stillVisible = rows.some((row) => Number(row.singles_id_to) === Number(selectedSinglesId));
    if (!stillVisible) setSelectedSinglesId(null);
  }, [rows, selectedSinglesId]);

  useEffect(() => {
    setChatRefreshNonce((n) => n + 1);
  }, []);

  const handleRefreshChat = useCallback(() => {
    setRefreshChatBusy(true);
    setChatRefreshNonce((n) => n + 1);
    dispatchBellNotificationRefresh('chat');
    window.setTimeout(() => setRefreshChatBusy(false), 400);
  }, []);

  const handleReorderDrop = (fromId, toId) => {
    const a = Number(fromId);
    const b = Number(toId);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return;
    setOrderedIds((ids) => {
      const next = [...ids];
      const fromIdx = next.indexOf(a);
      const toIdx = next.indexOf(b);
      if (fromIdx === -1 || toIdx === -1) return ids;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, a);
      persistOrder(orderStorageKey, next);
      return next;
    });
  };

  const handleTogglePostingLike = async (postId) => {
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
  };

  const handleShowPostingLikes = async (_event, postId) => {
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
  };

  const closeLikesPopover = useCallback(() => {
    setLikesPostId(null);
    setLikesList([]);
    setLikesLoading(false);
    setLikesError('');
  }, []);

  useEffect(() => {
    if (!myPicksFeed || Number(myPicksFeed.target_singles_id) !== Number(selectedSinglesId)) {
      setFeedPosts([]);
      setFeedCursor(null);
      setFeedHasMore(false);
      return;
    }
    setFeedPosts(Array.isArray(myPicksFeed.posts) ? myPicksFeed.posts : []);
    setFeedCursor(myPicksFeed.next_cursor ?? null);
    setFeedHasMore(Boolean(myPicksFeed.has_more));
  }, [myPicksFeed, selectedSinglesId]);

  const handleLoadMorePosts = useCallback(
    async (count) => {
      const targetId = Number(selectedSinglesId);
      const limit = Number(count);
      if (!Number.isFinite(targetId) || targetId < 1) return;
      if (!Number.isFinite(limit) || limit < 1) return;
      if (loadMoreBusy || !feedHasMore || !feedCursor?.created_at || !feedCursor?.post_id) return;
      setLoadMoreBusy(true);
      try {
        const page = await fetchMyPicksFeedPage(targetId, {
          limit,
          beforeCreatedAt: feedCursor.created_at,
          beforePostId: feedCursor.post_id,
          visibilityFeed: 'friends'
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
    [selectedSinglesId, loadMoreBusy, feedHasMore, feedCursor]
  );

  const selectedRow = useMemo(() => {
    if (!Number.isFinite(Number(selectedSinglesId))) return null;
    return rowByTargetId.get(Number(selectedSinglesId)) ?? null;
  }, [rowByTargetId, selectedSinglesId]);
  const selectedIsBlocked = useMemo(
    () => Boolean(selectedRow && effectiveBlockUser(selectedRow)),
    [selectedRow, effectiveBlockUser]
  );
  const selectedRowPublicMediaUrls = useMemo(() => {
    if (!selectedRow) return [];
    return Array.isArray(selectedRow.public_gallery_image_urls)
      ? selectedRow.public_gallery_image_urls.map((url) => String(url ?? '').trim()).filter(Boolean)
      : Array.isArray(selectedRow.gallery_image_urls)
        ? selectedRow.gallery_image_urls.map((url) => String(url ?? '').trim()).filter(Boolean)
        : [];
  }, [selectedRow]);
  const selectedRowPublicPhotoGalleryUrls = useMemo(
    () => selectedRowPublicMediaUrls.filter((url) => !isSelfIntroVideoPostingUrl(url)),
    [selectedRowPublicMediaUrls]
  );
  const selectedRowPublicVideoGalleryUrls = useMemo(
    () => selectedRowPublicMediaUrls.filter((url) => isSelfIntroVideoPostingUrl(url)),
    [selectedRowPublicMediaUrls]
  );
  const selectedRowFriendMediaUrls = useMemo(() => {
    if (!selectedRow) return [];
    return Array.isArray(selectedRow.friend_gallery_image_urls)
      ? selectedRow.friend_gallery_image_urls.map((url) => String(url ?? '').trim()).filter(Boolean)
      : [];
  }, [selectedRow]);
  const selectedRowPrivatePhotoGalleryUrls = useMemo(
    () => selectedRowFriendMediaUrls.filter((url) => !isSelfIntroVideoPostingUrl(url)),
    [selectedRowFriendMediaUrls]
  );

  const handleSendBioRequest = useCallback(
    async (row, kind) => {
      const singlesIdTo = Number(row?.singles_id_to);
      if (!Number.isFinite(singlesIdTo) || singlesIdTo < 1) return;
      const isBrief = kind === 'brief';
      const alreadyRequested = isBrief ? isBioRequestFlagged(row?.brief_bio_request) : isFullBioRequestFlagged(row);
      if (alreadyRequested) return;

      const busyKey = `${singlesIdTo}:${kind}`;
      if (bioRequestBusyKey) return;

      const payload = isBrief ? { brief_bio_request: 'requested' } : { full_bio_request: 'requested' };
      setBioRequestBusyKey(busyKey);
      try {
        await postInterestedRequestInfo(singlesIdTo, payload);
        if (typeof onBioRequestUpdated === 'function') {
          await onBioRequestUpdated();
        }
      } catch (error) {
        await themedAlert(error?.message || 'Failed to send bio request');
      } finally {
        setBioRequestBusyKey('');
      }
    },
    [bioRequestBusyKey, onBioRequestUpdated]
  );

  const handleCancelBioRequest = useCallback(
    async (row, kind) => {
      const singlesIdTo = Number(row?.singles_id_to);
      if (!Number.isFinite(singlesIdTo) || singlesIdTo < 1) return;
      if (!canCancelOutgoingBioRequest(row, kind)) return;

      const busyKey = `${singlesIdTo}:${kind}`;
      if (bioRequestBusyKey) return;

      const isBrief = kind === 'brief';
      const payload = isBrief ? { brief_bio_request: 'notrequested' } : { full_bio_request: 'notrequested' };
      setBioRequestBusyKey(busyKey);
      try {
        await postInterestedRequestInfo(singlesIdTo, payload);
        if (typeof onBioRequestUpdated === 'function') {
          await onBioRequestUpdated();
        }
      } catch (error) {
        await themedAlert(error?.message || 'Failed to cancel bio request');
      } finally {
        setBioRequestBusyKey('');
      }
    },
    [bioRequestBusyKey, onBioRequestUpdated]
  );

  const isAdmin = isAdminSession(user);

  const handleAdminCycleOutgoingBioRequest = useCallback(
    async (row, kind) => {
      if (!isAdmin) return;
      const singlesIdTo = Number(row?.singles_id_to);
      if (!Number.isFinite(singlesIdTo) || singlesIdTo < 1) return;

      const busyKey = `${singlesIdTo}:${kind}:admin-request`;
      if (bioRequestBusyKey) return;

      const isBrief = kind === 'brief';
      const currentFlag = isBrief ? row?.brief_bio_request : row?.full_bio_request;
      const nextValue = isBioRequestFlagged(currentFlag) ? 'notrequested' : 'requested';
      const payload = isBrief ? { brief_bio_request: nextValue } : { full_bio_request: nextValue };

      setBioRequestBusyKey(busyKey);
      try {
        await postInterestedRequestInfo(singlesIdTo, payload);
        if (typeof onBioRequestUpdated === 'function') {
          await onBioRequestUpdated();
        }
      } catch (error) {
        await themedAlert(error?.message || 'Failed to update request status');
      } finally {
        setBioRequestBusyKey('');
      }
    },
    [bioRequestBusyKey, isAdmin, onBioRequestUpdated]
  );

  const handleAdminCycleOutgoingBioApproval = useCallback(
    async (row, kind) => {
      if (!isAdmin) return;
      const singlesIdTo = Number(row?.singles_id_to);
      if (!Number.isFinite(singlesIdTo) || singlesIdTo < 1) return;

      const busyKey = `${singlesIdTo}:${kind}:admin-approval`;
      if (bioRequestBusyKey) return;

      const isBrief = kind === 'brief';
      const currentApproval = isBrief ? row?.brief_bio_request_approval : row?.full_bio_request_approval;
      const nextApproval = nextOutgoingBioApprovalState(currentApproval);
      const payload = isBrief
        ? { brief_bio_request_approval: nextApproval }
        : { full_bio_request_approval: nextApproval };

      setBioRequestBusyKey(busyKey);
      try {
        await postInterestedRequestInfo(singlesIdTo, payload);
        if (typeof onBioRequestUpdated === 'function') {
          await onBioRequestUpdated();
        }
      } catch (error) {
        await themedAlert(error?.message || 'Failed to update response status');
      } finally {
        setBioRequestBusyKey('');
      }
    },
    [bioRequestBusyKey, isAdmin, onBioRequestUpdated]
  );

  useEffect(() => {
    if (selectedRowPublicPhotoGalleryUrls.length === 0) {
      setSelectedPublicGalleryImageUrl('');
      return;
    }
    if (!selectedRowPublicPhotoGalleryUrls.includes(selectedPublicGalleryImageUrl)) {
      setSelectedPublicGalleryImageUrl(selectedRowPublicPhotoGalleryUrls[0]);
    }
  }, [selectedRowPublicPhotoGalleryUrls, selectedPublicGalleryImageUrl]);

  useEffect(() => {
    if (selectedRowPrivatePhotoGalleryUrls.length === 0) {
      setSelectedFriendGalleryImageUrl('');
      return;
    }
    if (!selectedRowPrivatePhotoGalleryUrls.includes(selectedFriendGalleryImageUrl)) {
      setSelectedFriendGalleryImageUrl(selectedRowPrivatePhotoGalleryUrls[0]);
    }
  }, [selectedRowPrivatePhotoGalleryUrls, selectedFriendGalleryImageUrl]);

  useEffect(() => {
    if (selectedRowPublicVideoGalleryUrls.length === 0) {
      setSelectedPublicVideoGalleryImageUrl('');
      return;
    }
    if (!selectedRowPublicVideoGalleryUrls.includes(selectedPublicVideoGalleryImageUrl)) {
      setSelectedPublicVideoGalleryImageUrl(selectedRowPublicVideoGalleryUrls[0]);
    }
  }, [selectedRowPublicVideoGalleryUrls, selectedPublicVideoGalleryImageUrl]);

  const selectedTargetId = Number(selectedRow?.singles_id_to);
  const selectedRightPanelActiveTab =
    Number.isFinite(selectedTargetId) && selectedTargetId > 0 ? activeTabByTargetId[selectedTargetId] ?? 'postings' : 'postings';
  const selectedRightPanelShowsChat = selectedRightPanelActiveTab === 'chat';
  const chatPanelViewportSx = useMemo(() => {
    if (!selectedRightPanelShowsChat) return undefined;
    const zoomFactor = downSM ? 1 : getAppPageZoomFactor(pageZoom);
    return {
      minHeight: getAppPageScrollRegionMaxHeightCss(zoomFactor, { rightPanelHeader: true }),
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    };
  }, [downSM, pageZoom, selectedRightPanelShowsChat]);
  useEffect(() => {
    setApprovedBioViewKinds({ brief: false, full: false });
  }, [selectedSinglesId]);

  const selectedBriefBioApproved = triStateApproval(selectedRow?.brief_bio_request_approval) === APPROVAL_STATUS.APPROVE;
  const selectedFullBioApproved = triStateApproval(selectedRow?.full_bio_request_approval) === APPROVAL_STATUS.APPROVE;
  const showApprovedBriefBio = selectedBriefBioApproved && approvedBioViewKinds.brief;
  const showApprovedFullBio = selectedFullBioApproved && approvedBioViewKinds.full;
  const hasApprovedBioViewOpen = showApprovedBriefBio || showApprovedFullBio;

  const openApprovedInlineBioView = useCallback(
    (bioKind) => {
      if (bioKind === 'brief') {
        if (!selectedBriefBioApproved) return;
        setApprovedBioViewKinds({ brief: true, full: false });
        return;
      }
      if (bioKind === 'full') {
        if (!selectedFullBioApproved) return;
        setApprovedBioViewKinds({
          brief: selectedBriefBioApproved,
          full: true
        });
      }
    },
    [selectedBriefBioApproved, selectedFullBioApproved]
  );

  const handleApprovedBioViewClick = useCallback(
    async (bioKind) => {
      if (!selectedRow) return;
      setViewUnlockError('');
      const isBrief = bioKind === 'brief';
      if (isBrief) {
        if (!selectedBriefBioApproved) {
          setViewUnlockError('Brief Bio is not approved yet.');
          return;
        }
        if (!isTruthyPaidFlag(selectedRow.brief_paid)) {
          if (typeof onApprovedViewClick === 'function') {
            try {
              await onApprovedViewClick(selectedRow, 'basic');
            } catch (err) {
              setViewUnlockError(err?.message || 'Could not start Brief Bio unlock.');
            }
          } else {
            setViewUnlockError('Bio unlock is not available on this page.');
          }
          return;
        }
        openApprovedInlineBioView('brief');
        return;
      }
      if (!selectedFullBioApproved) {
        setViewUnlockError('Full Bio is not approved yet.');
        return;
      }
      if (!isTruthyPaidFlag(selectedRow.full_paid)) {
        if (typeof onApprovedViewClick === 'function') {
          try {
            await onApprovedViewClick(selectedRow, 'detail');
          } catch (err) {
            setViewUnlockError(err?.message || 'Could not start Full Bio unlock.');
          }
        } else {
          setViewUnlockError('Bio unlock is not available on this page.');
        }
        return;
      }
      openApprovedInlineBioView('full');
    },
    [
      selectedRow,
      selectedBriefBioApproved,
      selectedFullBioApproved,
      onApprovedViewClick,
      openApprovedInlineBioView
    ]
  );

  useEffect(() => {
    if (!unlockApprovedBioViewKind) return;
    openApprovedInlineBioView(unlockApprovedBioViewKind);
    if (typeof onUnlockApprovedBioViewConsumed === 'function') {
      onUnlockApprovedBioViewConsumed();
    }
  }, [unlockApprovedBioViewKind, openApprovedInlineBioView, onUnlockApprovedBioViewConsumed]);
  const selectedBioMemberLabel = useMemo(() => {
    if (!selectedRow) return 'this member';
    return formatMemberLabel({
      alias: selectedRow.alias,
      singlesId: selectedRow.singles_id_to,
      prefix: selectedRow.prefix,
      memberId: selectedRow.member_id
    });
  }, [selectedRow]);
  const photoFullscreenOverlayLines = useMemo(() => {
    if (!selectedRow) return [];
    const { primary, secondary } = getMemberDisplayLines({
      alias: selectedRow.alias,
      singlesId: selectedRow.singles_id_to,
      prefix: selectedRow.prefix,
      memberId: selectedRow.member_id
    });
    return [primary, secondary].filter(Boolean);
  }, [selectedRow]);
  const {
    fullscreenOpen,
    fullscreenMediaUrl,
    fullscreenOverlayLines,
    openFullscreenMedia,
    closeFullscreenMedia
  } = usePostingAlbumMediaFullscreen();
  const openAlbumFullscreenMedia = useCallback(
    (mediaUrl) => {
      openFullscreenMedia(mediaUrl, photoFullscreenOverlayLines);
    },
    [openFullscreenMedia, photoFullscreenOverlayLines]
  );

  const vettedFriendsBioPanel = useMemo(() => {
    if (!hasApprovedBioViewOpen) return null;
    return {
      bioReview: approvedBioReview,
      loading: approvedBioReviewLoading,
      viewerMaskPending: false,
      viewerMaskMiscOnly: false,
      visibleSections: {
        brief: showApprovedBriefBio,
        full: showApprovedFullBio,
        misc: showApprovedFullBio
      }
    };
  }, [
    approvedBioReview,
    approvedBioReviewLoading,
    hasApprovedBioViewOpen,
    showApprovedBriefBio,
    showApprovedFullBio
  ]);

  useEffect(() => {
    let cancelled = false;
    const targetId = Number(selectedRow?.singles_id_to);
    const shouldLoad =
      selectedRightPanelActiveTab === 'bio' &&
      Number.isFinite(targetId) &&
      targetId > 0 &&
      hasApprovedBioViewOpen;

    setApprovedBioReview(null);
    setApprovedBioReviewError('');

    if (!shouldLoad) {
      setApprovedBioReviewLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setApprovedBioReviewLoading(true);
    fetchApprovedCheckrBioReview(targetId)
      .then((data) => {
        if (!cancelled) setApprovedBioReview(data || null);
      })
      .catch((err) => {
        if (!cancelled) {
          setApprovedBioReviewError(err?.message || 'Failed to load approved self-report bio');
        }
      })
      .finally(() => {
        if (!cancelled) setApprovedBioReviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    selectedRow?.singles_id_to,
    selectedRightPanelActiveTab,
    selectedBriefBioApproved,
    selectedFullBioApproved,
    hasApprovedBioViewOpen
  ]);

  useEffect(() => {
    const captureNonce = bioViewConsentCapture?.nonce;
    if (!captureNonce) return;

    const targetId = Number(bioViewConsentCapture?.targetSinglesId);
    const bioKind = bioViewConsentCapture?.bioKind === 'full' ? 'full' : 'brief';
    if (!Number.isFinite(targetId) || targetId < 1) return;
    if (Number(selectedRow?.singles_id_to) !== targetId) return;
    if (!hasApprovedBioViewOpen) return;
    if (approvedBioReviewLoading || !approvedBioReview) return;
    if (bioViewConsentCaptureInFlightRef.current) return;

    bioViewConsentCaptureInFlightRef.current = true;
    void (async () => {
      try {
        await new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        });
        const captureNode = approvedBioCaptureRef.current;
        if (!captureNode) return;

        const snapshotImage = await captureElementAsPng(captureNode, { backgroundColor: '#ffffff' });
        const { data: profile } = await api.get('/api/settings/profile');
        const fullNameSigned =
          formatCapitalizedFullName(profile?.firstname, '', profile?.lastname) ||
          String(user?.alias ?? '').trim() ||
          'Member';
        const isFullBio = bioKind === 'full';

        await postSaveConsentRecord({
          full_name_signed: fullNameSigned,
          viewer_approved: targetId,
          date_signed: new Date().toISOString(),
          consent_signature_image: snapshotImage,
          description: isFullBio ? CONSENT_DESCRIPTION_VIEW_FULL_BIO : CONSENT_DESCRIPTION_VIEW_BRIEF_BIO,
          watermark_variant: isFullBio
            ? CONSENT_WATERMARK_VARIANTS.viewFullBio
            : CONSENT_WATERMARK_VARIANTS.viewBriefBio
        });
        if (typeof onBioViewConsentCaptureConsumed === 'function') {
          onBioViewConsentCaptureConsumed();
        }
      } catch (err) {
        console.warn('[VettedFriendsPicksLayout] bio view consent snapshot failed', err?.message || err);
      } finally {
        bioViewConsentCaptureInFlightRef.current = false;
      }
    })();
  }, [
    bioViewConsentCapture,
    selectedRow?.singles_id_to,
    hasApprovedBioViewOpen,
    approvedBioReviewLoading,
    approvedBioReview,
    user?.alias,
    onBioViewConsentCaptureConsumed
  ]);

  useEffect(() => {
    let cancelled = false;
    const targetId = Number(selectedRow?.singles_id_to);
    const shouldLoad =
      selectedRightPanelActiveTab === 'bio' && Number.isFinite(targetId) && targetId > 0;

    setPreviewBioReview(null);
    setPreviewBioReviewError('');

    if (!shouldLoad) {
      setPreviewBioReviewLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setPreviewBioReviewLoading(true);
    fetchMemberCheckrBioReviewPreview(targetId)
      .then((data) => {
        if (!cancelled) setPreviewBioReview(data || null);
      })
      .catch((err) => {
        if (!cancelled) {
          setPreviewBioReviewError(err?.message || 'Failed to load bio preview');
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewBioReviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRow?.singles_id_to, selectedRightPanelActiveTab]);

  const { open: tourOpen, step: tourStep } = useVsinglesTour();

  const openSmsChatForRow = useCallback(
    async (row) => {
      if (!row) return;
      const targetId = Number(row.singles_id_to);
      if (!Number.isFinite(targetId) || targetId < 1) return;
      const prepared = await Promise.resolve(onPrepareInlineChat(row));
      if (!prepared) return;
      setSelectedSinglesId(targetId);
      setActiveTabByTargetId((prev) => ({ ...prev, [targetId]: 'chat' }));
      setComposerFocusNonce((n) => n + 1);
    },
    [onPrepareInlineChat]
  );

  const renderOutgoingBioRequestSentence = (row, bioKind) => {
    const busyKey = `${row?.singles_id_to}:${bioKind}`;
    const statusBusy =
      bioRequestBusyKey === `${busyKey}:admin-request` || bioRequestBusyKey === `${busyKey}:admin-approval`;
    return (
      <OutgoingBioRequestSentenceLine
        row={row}
        bioKind={bioKind}
        onApprovedClick={handleApprovedBioViewClick}
        needsTokenUnlock={
          bioKind === 'brief'
            ? triStateApproval(row?.brief_bio_request_approval) === APPROVAL_STATUS.APPROVE &&
              !isTruthyPaidFlag(row?.brief_paid)
            : triStateApproval(row?.full_bio_request_approval) === APPROVAL_STATUS.APPROVE &&
              !isTruthyPaidFlag(row?.full_paid)
        }
        isAdmin={isAdmin}
        statusBusy={statusBusy}
        onAdminCycleRequest={handleAdminCycleOutgoingBioRequest}
        onAdminCycleApproval={handleAdminCycleOutgoingBioApproval}
      />
    );
  };

  const renderBioRequestActionRow = (row, kind, lineNumber) => {
    if (!row) return null;
    const isBrief = kind === 'brief';
    const requestFlag = isBrief ? row?.brief_bio_request : row?.full_bio_request;
    const isNotRequested = !isBioRequestFlagged(requestFlag);
    const canCancel = canCancelOutgoingBioRequest(row, kind);
    const busyKey = `${row.singles_id_to}:${kind}`;
    const requestMainDetailText = formatOutgoingBioRequestActionMainDetailText(row, kind);
    const cancelMainDetailText = formatOutgoingBioCancelActionMainDetailText(row, kind);
    const includesDetailText = formatOutgoingBioRequestIncludesPhrase(kind);
    const bioRequestDetailTextSx = {
      color: 'var(--theme-primary-color)',
      fontWeight: 700,
      ...vettedFriendsPanelTextSx,
      lineHeight: 1.25
    };
    const renderBioRequestActionDetailLine = (buttonNode, mainDetailText) => (
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          columnGap: 0.75,
          rowGap: 0.25,
          width: '100%'
        }}
      >
        <Box
          component="span"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            maxWidth: '100%'
          }}
        >
          {buttonNode}
          <Typography component="span" sx={bioRequestDetailTextSx}>
            {mainDetailText}
          </Typography>
        </Box>
        <Typography component="span" sx={{ ...bioRequestDetailTextSx, minWidth: 0, whiteSpace: 'normal' }}>
          {includesDetailText}
        </Typography>
      </Box>
    );
    const cancelButtonSx = {
      textTransform: 'none',
      fontWeight: 700,
      ...vettedFriendsPanelTextSx,
      lineHeight: 1.25,
      py: 0.75,
      px: 1.25,
      flexShrink: 0,
      backgroundColor: 'transparent !important',
      bgcolor: 'transparent !important',
      boxShadow: 'none !important',
      border: 'none !important',
      color: 'var(--theme-primary-color) !important',
      WebkitTextFillColor: 'var(--theme-primary-color) !important',
      minWidth: 0,
      cursor: canCancel ? 'pointer' : 'default',
      opacity: canCancel ? 1 : 0.85,
      ...(canCancel
        ? {
            ...VETTED_FRIENDS_ACTION_BUTTON_HOVER_SX,
            '@media (hover: hover)': {
              '&:hover:not(.Mui-disabled)': {
                backgroundColor: 'transparent !important',
                color: 'var(--theme-primary-color) !important',
                WebkitTextFillColor: 'var(--theme-primary-color) !important',
                textDecoration: 'underline',
                ...buttonHoverMagnifyFontSx({ baseFontSize: outgoingBioBodyTextFontSize })
              }
            }
          }
        : {
            '&.Mui-disabled': {
              backgroundColor: 'transparent !important',
              bgcolor: 'transparent !important',
              color: 'var(--theme-primary-color) !important',
              WebkitTextFillColor: 'var(--theme-primary-color) !important',
              opacity: 0.85
            }
          }),
      '&.MuiButton-root': { fontSize: outgoingBioBodyTextFontSize },
      '& .MuiButton-label': { fontSize: outgoingBioBodyTextFontSize }
    };

    if (isNotRequested) {
      return (
        <BioRequestNumberedLine lineNumber={lineNumber}>
          {renderBioRequestActionDetailLine(
            <Button
              type="button"
              disableElevation
              disabled={bioRequestBusyKey === busyKey}
              onClick={() => void handleSendBioRequest(row, kind)}
              sx={OUTGOING_BIO_REQUEST_TO_VIEW_BUTTON_SX}
            >
              <Box component="span" className="hover-magnify-label" sx={OUTGOING_BIO_GREEN_ACTION_LABEL_SX}>
                {bioRequestBusyKey === busyKey ? 'Sending…' : 'Request to View'}
              </Box>
            </Button>,
            requestMainDetailText
          )}
        </BioRequestNumberedLine>
      );
    }

    const approvalState = getBioRequestApprovalState(row, kind);
    const awaitingResponse = approvalState === APPROVAL_STATUS.NO_RESPONSE;
    const cancelSentenceBorderSx = awaitingResponse
      ? { border: '2px dotted #ffd84d', bgcolor: '#A1A1A1' }
      : { border: '2px dotted #43a047', bgcolor: '#A1A1A1' };

    return (
      <BioRequestNumberedLine lineNumber={lineNumber}>
        <Box
          sx={{
            width: '100%',
            p: 1,
            borderRadius: 1,
            boxSizing: 'border-box',
            ...cancelSentenceBorderSx
          }}
        >
          {renderBioRequestActionDetailLine(
            <Button
              variant="text"
              size="small"
              disableElevation
              disabled={!canCancel || bioRequestBusyKey === busyKey}
              onClick={() => void handleCancelBioRequest(row, kind)}
              sx={cancelButtonSx}
            >
              {bioRequestBusyKey === busyKey ? 'Canceling…' : 'Cancel Request'}
            </Button>,
            cancelMainDetailText
          )}
        </Box>
      </BioRequestNumberedLine>
    );
  };

  const renderOutgoingBioKindPanel = (row, kind) => {
    if (!row) return null;
    const statusLineNumber = kind === 'brief' ? 1 : 3;
    const actionLineNumber = kind === 'brief' ? 2 : 4;
    return (
      <Box
        key={kind}
        sx={{
          border: '2px solid var(--theme-primary-color)',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'var(--theme-secondary-color)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Box
          sx={{
            bgcolor: 'var(--theme-primary-color)',
            px: { xs: 1, sm: 1.25 },
            py: 0.85,
            textAlign: 'center'
          }}
        >
          <Typography
            sx={{
              color: '#ffffff',
              WebkitTextFillColor: '#ffffff',
              fontWeight: 700,
              fontSize: outgoingBioBodyTextFontSize,
              lineHeight: 1.35,
              whiteSpace: 'normal',
              wordBreak: 'break-word'
            }}
          >
            {formatOutgoingBioPanelTitle(row, kind)}
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            p: { xs: 1, sm: 1.25 }
          }}
        >
          <Box sx={{ pb: { xs: 1.25, sm: 1.5 } }}>
            <BioRequestNumberedLine lineNumber={statusLineNumber}>
              {renderOutgoingBioRequestSentence(row, kind)}
            </BioRequestNumberedLine>
          </Box>
          <Box sx={{ pt: { xs: 0.25, sm: 0.5 } }}>
            {renderBioRequestActionRow(row, kind, actionLineNumber)}
          </Box>
        </Box>
      </Box>
    );
  };

  const openTabForRow = useCallback((row, tab) => {
    const targetId = Number(row?.singles_id_to);
    if (!Number.isFinite(targetId) || targetId < 1) return;
    setSelectedSinglesId(targetId);
    setActiveTabByTargetId((prev) => ({ ...prev, [targetId]: tab }));
  }, []);

  const refreshRightPanelTabData = useCallback(
    async (tab) => {
      if (tab === 'postings' && Number.isFinite(Number(selectedSinglesId)) && Number(selectedSinglesId) > 0) {
        await Promise.all([refetchMyPicksFeed(), invalidateMyPicksFeedCache()]);
      } else if (tab === 'chat') {
        setChatRefreshNonce((n) => n + 1);
      }
      if (tab === 'bio' || tab === 'publicAlbum' || tab === 'friendAlbum' || tab === 'publicVideoAlbum' || tab === 'chat') {
        if (typeof onBioRequestUpdated === 'function') {
          await onBioRequestUpdated();
        }
      }
    },
    [selectedSinglesId, refetchMyPicksFeed, onBioRequestUpdated]
  );

  const handleRightTabClick = useCallback(
    (row, tab) => {
      if (!row) return;
      openTabForRow(row, tab);
      if (tab === 'chat') {
        setComposerFocusNonce((n) => n + 1);
      }
      void refreshRightPanelTabData(tab);
    },
    [openTabForRow, refreshRightPanelTabData]
  );

  useEffect(() => {
    const targetId = Number(initialSelectedSinglesId);
    if (!Number.isFinite(targetId) || targetId < 1) return;
    const row = rowByTargetId.get(targetId);
    if (!row) return;
    setSelectedSinglesId(targetId);
    if (initialOpenChat) {
      openSmsChatForRow(row);
    }
  }, [initialSelectedSinglesId, initialOpenChat, rowByTargetId, openSmsChatForRow]);

  useEffect(() => {
    if (!tourOpen || tourStep !== TOUR_STEP_VETTED_FRIENDS_SMS) return undefined;
    const lisaRow = rows.find((r) => formatMemberNumber(r.prefix, r.member_id) === TOUR_LISA_MEMBER_NUMBER);
    if (!lisaRow) return undefined;
    const t1 = window.setTimeout(() => openSmsChatForRow(lisaRow), 150);
    const t2 = window.setTimeout(() => openSmsChatForRow(lisaRow), 650);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [tourOpen, tourStep, rows, openSmsChatForRow]);

  const renderSendFlowerButton = (row) => {
    const fullApproved = getFullBioRequestApproval(row) === APPROVAL_STATUS.APPROVE;
    return (
      <UnSelectedButtonTemplate
        fullWidth
        data-clickable-zone="true"
        disabled={!fullApproved}
        onClick={(e) => {
          e.stopPropagation();
          if (!fullApproved) return;
          onSendFlower(row);
        }}
        sx={
          fullApproved
            ? {
                bgcolor: '#60C447 !important',
                border: '1px solid #60C447 !important',
                '@media (hover: hover)': {
                  '&:hover:not(.Mui-disabled)': {
                    bgcolor: '#60C447 !important',
                    border: '1px solid #60C447 !important'
                  }
                }
              }
            : {
                bgcolor: '#bdbdbd !important',
                border: '1px solid #9e9e9e !important',
                cursor: 'not-allowed'
              }
        }
      >
        <UnSelectedButtonTemplate.Icon src={sendFlowerGreenIcon} alt="" draggable={false} />
      </UnSelectedButtonTemplate>
    );
  };

  const renderCardFooterAction = (row) => {
    if (effectiveBlockUser(row)) {
      const busyKey = `${row.singles_id_to}:block`;
      return (
        <UnSelectedButtonTemplate
          fullWidth
          data-clickable-zone="true"
          disabled={blockBusyKey === busyKey}
          onClick={(e) => {
            e.stopPropagation();
            void handleBlockToggle(row);
          }}
          sx={vettedFriendsUnblockButtonSx}
        >
          Unblock
        </UnSelectedButtonTemplate>
      );
    }
    return renderSendFlowerButton(row);
  };

  const tabKeys = ['bio', 'chat', 'postings', 'publicAlbum', 'friendAlbum', 'publicVideoAlbum'];
  const tabLabelByKey = {
    bio: 'Biography',
    chat: 'Chat',
    postings: 'Postings',
    publicAlbum: 'Public Photo Album',
    friendAlbum: 'Private Photo Album',
    publicVideoAlbum: 'Public Video Album'
  };

  const tabButtonSx = (selected) => ({
    ...colorTemplate10MenuItemButtonSx({ selected, fitLabelWidth: true }),
    textTransform: 'none',
    borderRadius: 1,
    minWidth: 0,
    width: vettedFriendsPhoneLayout ? 'auto' : '100%',
    flexShrink: vettedFriendsPhoneLayout ? 0 : undefined,
    whiteSpace: vettedFriendsPhoneLayout ? 'nowrap' : undefined,
    px: vettedFriendsPhoneLayout ? 1 : 0.6,
    py: 0.55,
    fontWeight: selected ? 700 : 600,
    lineHeight: 1.15,
    fontSize: outgoingBioBodyTextFontSize
  });
  const visiblePosts = useMemo(() => feedPosts, [feedPosts]);
  const rightPanelHeaderTitleSx = { color: 'var(--theme-primary-color)', fontWeight: 700, ...vettedFriendsPanelTextSx };

  const renderAlbumPanel = ({ title, urls, selectedImageUrl, setSelectedImageUrl, emptyText }) => (
    <Box
      sx={{
        border: '2px dashed #d32f2f',
        borderRadius: 1,
        p: 0.75,
        mb: 1.25,
        bgcolor: 'var(--theme-daynight-color, #fff)'
      }}
    >
      <Box
        sx={{
          mb: 0.75,
          px: 1,
          py: 1.05,
          bgcolor: (theme) => colorTemplate1WallColorByTheme(theme),
          color: (theme) => (theme.palette.mode === 'dark' ? '#fff' : 'var(--theme-primary-color)'),
          border: '1px solid var(--theme-primary-color)',
          borderRadius: 0.6,
          textAlign: 'center',
          fontWeight: 700,
          lineHeight: 1.15
        }}
      >
        <Typography sx={{ color: 'inherit', fontWeight: 700, ...vettedFriendsPanelTextSx }}>{title}</Typography>
      </Box>
      {selectedSinglesId == null ? (
        <Typography sx={{ color: 'var(--theme-primary-color)', ...vettedFriendsPanelTextSx }}>Select a photo on the left.</Typography>
      ) : null}
      {selectedSinglesId != null && urls.length === 0 ? (
        <Typography sx={{ color: 'var(--theme-primary-color)', ...vettedFriendsPanelTextSx }}>{emptyText}</Typography>
      ) : null}
      {urls.length > 0 ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 0.75, mb: 1 }}>
          {urls.map((mediaUrl) => {
            const isSelected = selectedImageUrl === mediaUrl;
            const isVideo = isSelfIntroVideoPostingUrl(mediaUrl);
            return (
              <Box
                key={mediaUrl}
                component="button"
                type="button"
                onClick={() => setSelectedImageUrl(mediaUrl)}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openAlbumFullscreenMedia(mediaUrl);
                }}
                sx={{
                  p: 0,
                  m: 0,
                  border: isSelected ? '2px solid var(--theme-primary-color)' : '1px solid rgba(0,0,0,0.2)',
                  borderRadius: 0.75,
                  overflow: 'hidden',
                  width: '100%',
                  aspectRatio: '1 / 1',
                  background: 'transparent',
                  cursor: 'zoom-in'
                }}
              >
                <Box
                  component="img"
                  src={isVideo ? videoThumbnailUrlFromPostingUrl(mediaUrl) : mediaUrl}
                  alt={`${title} thumbnail`}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </Box>
            );
          })}
        </Box>
      ) : null}
      {selectedImageUrl ? (
        <AlbumMediaDoubleClickSurface
          mediaUrl={selectedImageUrl}
          onOpenFullscreen={openAlbumFullscreenMedia}
          sx={{ width: '100%', borderRadius: 1, overflow: 'hidden', bgcolor: '#111' }}
        >
          {isSelfIntroVideoPostingUrl(selectedImageUrl) ? (
            <Box
              component="video"
              src={selectedImageUrl}
              controls
              autoPlay
              playsInline
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openAlbumFullscreenMedia(selectedImageUrl);
              }}
              sx={{
                display: 'block',
                width: '100%',
                height: 'auto',
                maxHeight: 'none',
                objectFit: 'contain',
                borderRadius: 1,
                border: '1px solid rgba(0,0,0,0.22)',
                bgcolor: '#000',
                cursor: 'zoom-in'
              }}
            />
          ) : (
            <Box
              component="img"
              src={selectedImageUrl}
              alt={`${title} preview`}
              sx={{
                display: 'block',
                width: '100%',
                height: 'auto',
                maxHeight: 'none',
                objectFit: 'contain',
                borderRadius: 1,
                border: '1px solid rgba(0,0,0,0.22)',
                bgcolor: '#fff',
                pointerEvents: 'none',
                userSelect: 'none'
              }}
              draggable={false}
            />
          )}
        </AlbumMediaDoubleClickSurface>
      ) : null}
    </Box>
  );

  if (!rows.length) {
    return (
      <Typography sx={{ color: 'var(--theme-primary-color)', ...vettedFriendsPanelTextSx }}>
        Currently there is no users who have responded to your bio requests
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '100%' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 1.5, flexShrink: 0 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: { xs: 1, sm: 1.5 },
            flexWrap: 'wrap'
          }}
        >
          <Button variant="contained" disabled={refreshChatBusy} onClick={handleRefreshChat} sx={MANUAL_REFRESH_BUTTON_SX}>
            Refresh Posts & Chats
          </Button>
          <NotificationSection placement="inline" />
        </Box>
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 1.5,
          width: '100%',
          alignItems: 'flex-start'
        }}
      >
      <ColorTemplate8PhotoGallery header="Drag a card to rearrange order" selectedGreenBackground selectedAvatarCircular>
          {orderedIds.map((singlesId) => {
            const row = rowByTargetId.get(singlesId);
            if (!row) return null;
            const selected = Number(singlesId) === Number(selectedSinglesId);
            const memberLabel = formatMemberLabel({
              alias: row.alias,
              singlesId: row.singles_id_to,
              prefix: row.prefix,
              memberId: row.member_id
            });
            const memberDisplay = getMemberDisplayLines({
              alias: row.alias,
              singlesId: row.singles_id_to,
              prefix: row.prefix,
              memberId: row.member_id
            });
            const profileUrl =
              row.profile_image_url || buildProfilePhotoUrl(row.singles_id_to, row.profile_image_fk);
            const isDropTarget = draggingSinglesId != null && dropTargetSinglesId === singlesId && draggingSinglesId !== singlesId;
            const isBlockedUser = effectiveBlockUser(row);
            const showApprovedRibbon = hasApprovedBioRequestRibbon(row);

            return (
              <ColorTemplate8PhotoGallery.Item
                key={singlesId}
                impersonateSinglesId={singlesId}
                selected={selected}
                isDropTarget={isDropTarget}
                sx={isBlockedUser ? blockedMemberCardSx : undefined}
                draggable
                title="Drag to reorder"
                onDragStart={(e) => {
                  if (e.target instanceof Element && e.target.closest('[data-clickable-zone="true"]')) {
                    e.preventDefault();
                    return;
                  }
                  setDraggingSinglesId(singlesId);
                  e.dataTransfer.setData('application/x-vetted-friends-singles-id', String(singlesId));
                  e.dataTransfer.setData('text/plain', String(singlesId));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => {
                  setDraggingSinglesId(null);
                  setDropTargetSinglesId(null);
                }}
                onDragOver={(e) => {
                  if (draggingSinglesId == null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDropTargetSinglesId(singlesId);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const raw = e.dataTransfer.getData('application/x-vetted-friends-singles-id') || e.dataTransfer.getData('text/plain');
                  const fromId = Number(raw);
                  handleReorderDrop(fromId, singlesId);
                  setDraggingSinglesId(null);
                  setDropTargetSinglesId(null);
                }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    zIndex: 100,
                    width: getMyPicksAvatarSize(),
                    height: getMyPicksAvatarSize(),
                    borderRadius: '50%',
                    overflow: 'visible',
                    flexShrink: 0
                  }}
                >
                  <ColorTemplate8PhotoGallery.Avatar
                    src={profileUrl}
                    alt={memberLabel}
                    selected={selected}
                    onClick={isBlockedUser ? undefined : () => setSelectedSinglesId(Number(singlesId))}
                    sx={isBlockedUser ? blockedMemberAvatarSx : undefined}
                    imgProps={{
                      onError: (e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = UserRound;
                      }
                    }}
                  />
                  {showApprovedRibbon ? (
                    <Box component="span" aria-label="Approved" sx={vettedFriendsApprovedRibbonSx}>
                      Approved!
                    </Box>
                  ) : null}
                </Box>
                <ColorTemplate8PhotoGallery.NameButton
                  onClick={isBlockedUser ? undefined : () => setSelectedSinglesId(Number(singlesId))}
                  sx={isBlockedUser ? { pointerEvents: 'none', opacity: 0.55 } : undefined}
                >
                  <ColorTemplate8PhotoGallery.Label
                    primary={memberDisplay.primary}
                    secondary={memberDisplay.secondary}
                    selected={selected}
                  />
                </ColorTemplate8PhotoGallery.NameButton>
                <ColorTemplate8PhotoGallery.Footer>{renderCardFooterAction(row)}</ColorTemplate8PhotoGallery.Footer>
              </ColorTemplate8PhotoGallery.Item>
            );
          })}
      </ColorTemplate8PhotoGallery>

      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          border: '1px solid var(--theme-primary-color)',
          borderLeft: 'none',
          borderRadius: 1,
          bgcolor: selectedRightPanelShowsChat ? '#ffffff' : 'var(--theme-secondary-color)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box'
        }}
      >
        {selectedIsBlocked ? null : (
          <>
        <Box
          sx={{
            flexShrink: 0,
            px: 1.5,
            py: 1,
            borderBottom: '1px solid var(--theme-primary-color)',
            bgcolor: (theme) => colorTemplate1WallColorByTheme(theme),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1
          }}
        >
          {selectedRightPanelShowsChat ? (
            <Typography sx={rightPanelHeaderTitleSx}>
              {selectedRow
                ? `Chat with ${formatMemberLabel({
                    alias: selectedRow.alias,
                    singlesId: selectedRow.singles_id_to,
                    prefix: selectedRow.prefix,
                    memberId: selectedRow.member_id
                  })}`
                : 'Chat'}
            </Typography>
          ) : selectedRightPanelActiveTab === 'bio' ? (
            <Typography sx={rightPanelHeaderTitleSx}>
              Vetted Biography by{' '}
              <Link
                href="https://checkr.com/"
                target="_blank"
                rel="noopener noreferrer"
                underline="always"
                sx={{
                  color: 'inherit',
                  fontWeight: 700,
                  display: 'inline-block',
                  textDecorationLine: 'underline',
                  textDecorationColor: 'currentColor',
                  textUnderlineOffset: '2px',
                  textDecorationThickness: '2px',
                  ...buttonHoverMagnifyTransitionSx,
                  '&:hover': {
                    ...buttonHoverMagnifyFontSx()
                  }
                }}
              >
                3rd-Party
              </Link>
            </Typography>
          ) : selectedRightPanelActiveTab === 'publicAlbum' ? (
            <Typography sx={rightPanelHeaderTitleSx}>Public Photo Album</Typography>
          ) : selectedRightPanelActiveTab === 'friendAlbum' ? (
            <Typography sx={rightPanelHeaderTitleSx}>Private Photo Album</Typography>
          ) : selectedRightPanelActiveTab === 'publicVideoAlbum' ? (
            <Typography sx={rightPanelHeaderTitleSx}>Public Video Album</Typography>
          ) : (
            <Typography sx={rightPanelHeaderTitleSx}>Postings</Typography>
          )}
          {selectedRow && !effectiveBlockUser(selectedRow) ? (
            <UnSelectedButtonTemplate
              type="button"
              disabled={Boolean(blockBusyKey)}
              onClick={() => {
                void handleBlockToggle(selectedRow);
              }}
              sx={{ flexShrink: 0, ...vettedFriendsPanelTextSx, '&.MuiButton-root': { fontSize: outgoingBioBodyTextFontSize } }}
            >
              Block
            </UnSelectedButtonTemplate>
          ) : null}
        </Box>
        <Box
          sx={{
            flexShrink: 0,
            width: '100%',
            px: 0.75,
            py: 0.7,
            borderBottom: '1px solid var(--theme-primary-color)',
            ...(vettedFriendsPhoneLayout
              ? {
                  display: 'flex',
                  flexWrap: 'nowrap',
                  alignItems: 'stretch',
                  gap: 0.6,
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  scrollbarGutter: 'stable'
                }
              : {
                  display: 'grid',
                  gridTemplateColumns: `repeat(${tabKeys.length}, minmax(0, 1fr))`,
                  gap: 0.6
                })
          }}
        >
          {tabKeys.map((tab) => (
            <Button
              key={tab}
              onClick={() => handleRightTabClick(selectedRow, tab)}
              sx={tabButtonSx(selectedRightPanelActiveTab === tab)}
            >
              {tabLabelByKey[tab]}
            </Button>
          ))}
        </Box>
        <Box
          className={selectedRightPanelShowsChat ? LIGHT_SURFACE_CLASS : undefined}
          sx={{
            p: selectedRightPanelShowsChat ? 1 : 1.25,
            pb: 0.5,
            ...(chatPanelViewportSx ?? { display: 'block' })
          }}
        >
          {selectedRightPanelShowsChat && selectedRow ? (
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <VettedFriendsInlineChatPanel
                requestRow={selectedRow}
                focusComposerNonce={composerFocusNonce}
                refreshNonce={chatRefreshNonce}
              />
            </Box>
          ) : null}
          {selectedRightPanelActiveTab === 'publicAlbum'
            ? renderAlbumPanel({
                title: 'Public Photo Album',
                urls: selectedRowPublicPhotoGalleryUrls,
                selectedImageUrl: selectedPublicGalleryImageUrl,
                setSelectedImageUrl: setSelectedPublicGalleryImageUrl,
                emptyText: 'No public photo album photos.'
              })
            : null}
          {selectedRightPanelActiveTab === 'friendAlbum'
            ? renderAlbumPanel({
                title: 'Private Photo Album',
                urls: selectedRowPrivatePhotoGalleryUrls,
                selectedImageUrl: selectedFriendGalleryImageUrl,
                setSelectedImageUrl: setSelectedFriendGalleryImageUrl,
                emptyText: 'No private photo album photos.'
              })
            : null}
          {selectedRightPanelActiveTab === 'publicVideoAlbum'
            ? renderAlbumPanel({
                title: 'Public Video Album',
                urls: selectedRowPublicVideoGalleryUrls,
                selectedImageUrl: selectedPublicVideoGalleryImageUrl,
                setSelectedImageUrl: setSelectedPublicVideoGalleryImageUrl,
                emptyText: 'No public videos.'
              })
            : null}
          {selectedRightPanelActiveTab === 'bio' ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {selectedRow == null ? (
                <Typography sx={{ color: 'var(--theme-primary-color)', ...vettedFriendsPanelTextSx }}>
                  Select a member on the left.
                </Typography>
              ) : (
                <>
                  <Typography
                    sx={{
                      color: 'var(--theme-primary-color)',
                      fontWeight: 600,
                      lineHeight: 1.45,
                      ...vettedFriendsPanelTextSx
                    }}
                  >
                    {`Want to view ${selectedBioMemberLabel}'s vetted profile? Click Request Brief Bio or Request Full Bio button. As soon as ${selectedBioMemberLabel} responds with 'Approved !', you will have a green button 'Click to View'.`}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, width: '100%' }}>
                    {renderOutgoingBioKindPanel(selectedRow, 'brief')}
                    {renderOutgoingBioKindPanel(selectedRow, 'full')}
                  </Box>
                  {approvedBioReviewError ? <Alert severity="error">{approvedBioReviewError}</Alert> : null}
                  {viewUnlockError ? <Alert severity="warning">{viewUnlockError}</Alert> : null}
                  {hasApprovedBioViewOpen && vettedFriendsBioPanel?.loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                      <CircularProgress size={28} />
                    </Box>
                  ) : null}
                  {hasApprovedBioViewOpen && vettedFriendsBioPanel && !vettedFriendsBioPanel.loading ? (
                    <Box
                      ref={approvedBioCaptureRef}
                      sx={{
                        border: '2px dashed #d32f2f',
                        borderRadius: 1,
                        p: { xs: 0.75, sm: 1 },
                        bgcolor: '#ffffff'
                      }}
                    >
                      <Typography
                        sx={{
                          color: 'var(--theme-primary-color)',
                          fontWeight: 600,
                          lineHeight: 1.45,
                          mb: 1,
                          ...vettedFriendsPanelTextSx
                        }}
                      >
                        Below is update to Bio.{' '}
                        <Link
                          component="button"
                          type="button"
                          underline="always"
                          onClick={() => navigate(PROFILES_RECORDS_PATH, { state: { openTab: 'consents' } })}
                          sx={{
                            ...vettedFriendsPanelTextSx,
                            fontWeight: 700,
                            verticalAlign: 'baseline'
                          }}
                        >
                          Click here
                        </Link>{' '}
                        to view snapshot of Bio when requested.
                      </Typography>
                      <CheckrBioReviewPanel
                        bioReview={vettedFriendsBioPanel.bioReview}
                        loading={false}
                        consentFlowEnabled={false}
                        showMatchNoteColumn={false}
                        viewerMaskPending={vettedFriendsBioPanel.viewerMaskPending}
                        viewerMaskMiscOnly={vettedFriendsBioPanel.viewerMaskMiscOnly}
                        suppressEditActions
                        visibleSections={vettedFriendsBioPanel.visibleSections}
                      />
                    </Box>
                  ) : null}
                </>
              )}
            </Box>
          ) : null}
          {selectedRightPanelActiveTab === 'postings' && selectedSinglesId == null ? (
            <Typography sx={{ color: 'var(--theme-primary-color)', ...vettedFriendsPanelTextSx }}>
              Select a photo on the left.
            </Typography>
          ) : null}
          {selectedRightPanelActiveTab === 'postings' && selectedSinglesId != null ? (
            <ColorTemplate11Posting.Feed
              title="Posts and Comments"
              posts={visiblePosts}
              loading={myPicksFeedLoading}
              error={myPicksFeedError}
              photoFullscreenOverlayLines={photoFullscreenOverlayLines}
              privacyMessage={
                myPicksFeed && !myPicksFeed.can_view_private_posts && myPicksFeed.message ? myPicksFeed.message : undefined
              }
              viewerSinglesId={user?.singles_id}
              feedOwnerSinglesId={selectedSinglesId}
              showDeletePosts={canDeletePosts}
              deleteBusy={deleteBusy}
              onDeletePost={handleDeletePosting}
              onDeletePhoto={handleDeletePostingPhoto}
              showActions
              likeBusyPostId={likeBusyPostId}
              onToggleLike={handleTogglePostingLike}
              onShowLikes={handleShowPostingLikes}
              onOpenComments={(post) => setCommentsDialog({ postId: post.post_id, photos: post.photos })}
              showLoadMore={selectedSinglesId != null}
              feedHasMore={feedHasMore && selectedSinglesId != null}
              loadMoreBusy={loadMoreBusy}
              onLoadMore={handleLoadMorePosts}
            />
          ) : null}
        </Box>
          </>
        )}
      </Box>
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
      {deleteConfirmDialog}
      <PostingAlbumMediaFullscreen
        open={fullscreenOpen}
        mediaUrl={fullscreenMediaUrl}
        overlayLines={fullscreenOverlayLines}
        onClose={closeFullscreenMedia}
      />
    </Box>
  );
}
