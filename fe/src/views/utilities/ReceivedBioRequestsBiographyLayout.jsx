/**
 * Cloned from VettedFriendsPicksLayout (/vettedFriends) — left member list + biography
 * panel only, adapted for Received Bio Requests (/receivedBioRequests).
 * Baseline copy; further behavior changes belong in this file.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import { SELF_REPORT_BIOGRAPHY_PATH } from 'constants/selfReportBiographyRoute';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';
import BusyHourglassOverlay from 'ui-component/BusyHourglassOverlay';
import {
  buttonHoverMagnifyTransitionSx,
  clickableTextHoverMagnifySx,
  hoverMagnifyNestedLabelSx
} from 'config/hoverMagnifyEnv';
import GreenButton from 'ui-component/GreenButton';
import UserRound from 'assets/images/users/profile.jpeg';
import ColorTemplate8PhotoGallery from 'ui-component/ColorTemplate8PhotoGallery';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import { formatMemberLabel, getMemberDisplayLines } from 'utils/memberLabel';
import {
  calcBriefBioMatchPercent,
  calcFullBioMatchPercent,
  countIncomingBioRequestsPending,
  formatIncomingBioApprovalStatusMessage,
  formatIncomingBioNotRequestedResponseMessage,
  formatIncomingBioRequestMessageParts,
  isApprovedViewingExpired,
  isApprovalLockedDuringStay,
  isBioRequestRequested,
  triStateBioRequestApproval
} from 'utils/receivedBioRequestDisplay';
import { APPROVAL_STATUS } from 'utils/approvalStatusEnum';
import { useAuth } from 'contexts/AuthContext';
import { isAdminSession } from 'utils/adminSession';
import CheckrBioReviewPanel from 'views/utilities/CheckrBioReviewPanel';
import { buttonFontSizeResponsive } from 'config/buttonFontEnv';
import { getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTextFontSizeVw } from 'config/singlesMemberCardFontEnv';
import { colorTemplate1WallColorByTheme } from 'config/colorTemplate1';
import {
  COLOR_TEMPLATE8_PHOTO_GALLERY_SELECTED_AVATAR_Z_INDEX
} from 'config/colorTemplate8PhotoGallery';
import { receivedBioPendingBadgeSx } from 'config/receivedBioPendingBadge';
import { SIDEBAR_MOBILE_CLOSE_MEDIA } from 'config/sidebarMobileCloseEnv';

const RECEIVED_BIO_ORDER_LS_PREFIX = 'receivedBioRequestsPhotoOrder:';
const RECEIVED_BIO_PENDING_BADGE_Z_INDEX = COLOR_TEMPLATE8_PHOTO_GALLERY_SELECTED_AVATAR_Z_INDEX + 25;
const RECEIVED_BIO_PREVIEW_YELLOW = 'var(--theme-yellow-color, #FFEB3B)';
const RECEIVED_BIO_PREVIEW_BORDER_PX = 10;

const incomingBioResponsePendingBadgeSx = receivedBioPendingBadgeSx({
  ml: 0.35,
  verticalAlign: 'middle'
});

function incomingBioResponsePendingBadgeNumber(bioKind) {
  return bioKind === 'brief' ? 1 : 2;
}

/** fe/.env MOBILE_FONT_SIZE_TEXT / DESKTOP_FONT_SIZE_TEXT — main panel copy */
const incomingBioBodyTextFontSize = {
  xs: getMobileSinglesTextFontSizeVw(),
  sm: getDesktopTextFontSizeVw()
};

function triStateApproval(value) {
  return triStateBioRequestApproval(value);
}

const incomingBioRequestStatusPhraseFontSize = {
  xs: `calc(${getMobileSinglesTextFontSizeVw()} + 0.2vw)`,
  sm: `calc(${getDesktopTextFontSizeVw()} + 0.1vw)`
};

function incomingBioRequestStatusPhraseSx({ isRequested, clickable = false, busy = false } = {}) {
  const statusColor = isRequested ? '#43a047' : '#ffeb3b';
  return {
    color: statusColor,
    WebkitTextFillColor: statusColor,
    fontWeight: 700,
    WebkitTextStroke: '1px var(--theme-inverse-daynight-color)',
    paintOrder: 'stroke fill',
    background: 'none',
    backgroundColor: 'transparent',
    border: 'none',
    padding: 0,
    margin: 0,
    boxShadow: 'none',
    borderRadius: 0,
    display: 'inline',
    fontSize: incomingBioRequestStatusPhraseFontSize,
    lineHeight: 1.35,
    verticalAlign: 'baseline',
    whiteSpace: 'nowrap',
    cursor: clickable && !busy ? 'pointer' : 'default',
    textDecoration: isRequested || clickable ? 'underline' : 'none',
    textDecorationColor: isRequested ? '#d32f2f' : clickable ? statusColor : undefined,
    textDecorationThickness: isRequested ? '3px' : undefined,
    WebkitTextDecorationThickness: isRequested ? '3px' : undefined,
    textUnderlineOffset: isRequested ? '3px' : clickable ? '2px' : undefined,
    opacity: busy ? 0.65 : 1,
    ...clickableTextHoverMagnifySx({
      baseFontSize: incomingBioRequestStatusPhraseFontSize,
      clickable,
      busy
    })
  };
}

/** Radio circle — fe/.env MOBILE_FONT_SIZE_TEXT / DESKTOP_FONT_SIZE_TEXT (labels use button size). */
const responseRadioCircleFontSizeResponsive = {
  xs: getMobileSinglesTextFontSizeVw(),
  sm: getDesktopTextFontSizeVw()
};

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

export default function ReceivedBioRequestsBiographyLayout({
  rows,
  originalRows = [],
  onApprovalChange,
  onAdminCycleIncomingRequest,
  onSubmitResponse,
  requestBusyKey = '',
  responseDisabled = false,
  bioReview = null,
  previewCaptureRef = null,
  approvalStayDurationDays = 90,
  approvedViewingDurationMonths = 12
}) {
  const { user } = useAuth();
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const mobileFullWidth = useMediaQuery(SIDEBAR_MOBILE_CLOSE_MEDIA);
  const isAdmin = isAdminSession(user);
  const API_BASE_URL = getApiBaseUrl();
  const [selectedSinglesId, setSelectedSinglesId] = useState(null);
  const [touchedApprovalsByRequestId, setTouchedApprovalsByRequestId] = useState({});

  const orderStorageKey = user?.singles_id ? `${RECEIVED_BIO_ORDER_LS_PREFIX}${user.singles_id}` : null;
  const orderStorageKeyRef = useRef(orderStorageKey);
  const [orderedIds, setOrderedIds] = useState([]);
  const [draggingSinglesId, setDraggingSinglesId] = useState(null);
  const [dropTargetSinglesId, setDropTargetSinglesId] = useState(null);
  const rowByRequesterId = useMemo(
    () => new Map(rows.map((r) => [Number(r.singles_id_from), r]).filter(([id]) => Number.isFinite(id) && id > 0)),
    [rows]
  );

  useEffect(() => {
    if (!rows.length) {
      setOrderedIds([]);
      return;
    }
    const serverIds = rows.map((r) => Number(r.singles_id_from)).filter((id) => Number.isFinite(id) && id > 0);
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
    const qp = new URLSearchParams(location.search);
    const focusRequesterId = Number(qp.get('focusRequester') ?? location.state?.focusRequesterId);
    if (!Number.isFinite(focusRequesterId) || focusRequesterId < 1) return;
    setSelectedSinglesId(focusRequesterId);
    navigate({ pathname: location.pathname, search: '' }, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate]);

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

  const selectedRow = useMemo(() => {
    if (!Number.isFinite(Number(selectedSinglesId))) return null;
    return rowByRequesterId.get(Number(selectedSinglesId)) ?? null;
  }, [rowByRequesterId, selectedSinglesId]);

  const markApprovalTouched = useCallback((requesterSinglesId, bioKind) => {
    const id = Number(requesterSinglesId);
    if (!Number.isFinite(id) || id < 1) return;
    if (bioKind !== 'brief' && bioKind !== 'full') return;
    setTouchedApprovalsByRequestId((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? {}),
        [bioKind]: true
      }
    }));
  }, []);

  const requesterPreviewLabel = useMemo(() => {
    if (!selectedRow) return 'this member';
    return formatMemberLabel({
      alias: selectedRow.alias,
      singlesId: selectedRow.singles_id_from,
      prefix: selectedRow.prefix,
      memberId: selectedRow.member_id
    });
  }, [selectedRow]);

  const briefBioApproval = triStateApproval(selectedRow?.brief_bio_request_approval);
  const fullBioApproval = triStateApproval(selectedRow?.full_bio_request_approval);
  const briefBioRequested = isBioRequestRequested(selectedRow?.brief_bio_request);
  const fullBioRequested = isBioRequestRequested(selectedRow?.full_bio_request);
  const briefBioApproved = briefBioApproval === APPROVAL_STATUS.APPROVE;
  const fullBioApproved = fullBioApproval === APPROVAL_STATUS.APPROVE;

  const requestBlocked = Boolean(selectedRow?.block_user);

  const showRequesterPreview =
    !requestBlocked &&
    ((briefBioRequested && briefBioApproval !== APPROVAL_STATUS.NO_RESPONSE) ||
      (fullBioRequested && fullBioApproval !== APPROVAL_STATUS.NO_RESPONSE));

  const requesterPreviewPanel = useMemo(() => {
    if (!showRequesterPreview) return null;

    if (!briefBioApproved) {
      return { bioReview: null, empty: true, visibleSections: { brief: false, full: false, misc: false } };
    }

    return {
      bioReview,
      empty: false,
      visibleSections: {
        brief: true,
        full: fullBioApproved,
        misc: fullBioApproved
      }
    };
  }, [bioReview, briefBioApproved, fullBioApproved, showRequesterPreview]);

  const submitResponseEnabled = useMemo(() => {
    if (!selectedRow || responseDisabled || requestBusyKey) return false;

    const touchKey = Number(selectedRow.singles_id_from);
    const touched = Number.isFinite(touchKey) ? touchedApprovalsByRequestId[touchKey] ?? {} : {};
    const briefRequested = isBioRequestRequested(selectedRow.brief_bio_request);
    const fullRequested = isBioRequestRequested(selectedRow.full_bio_request);
    const briefApproval = triStateApproval(selectedRow.brief_bio_request_approval);
    const fullApproval = triStateApproval(selectedRow.full_bio_request_approval);

    // Approve/Deny: draft leaves noresponse. No Response: requires an explicit radio click (touched).
    const briefChosen =
      briefRequested && (Boolean(touched.brief) || briefApproval !== APPROVAL_STATUS.NO_RESPONSE);
    const fullChosen =
      fullRequested && (Boolean(touched.full) || fullApproval !== APPROVAL_STATUS.NO_RESPONSE);

    return briefChosen || fullChosen;
  }, [selectedRow, responseDisabled, requestBusyKey, touchedApprovalsByRequestId]);

  const submitResponseBusy = requestBusyKey === `${selectedRow?.requests_id}:submit`;

  const matchPercentLinkSx = {
    color: 'inherit',
    fontWeight: 700,
    textDecorationLine: 'underline',
    textDecorationColor: 'currentColor',
    textUnderlineOffset: '2px',
    cursor: 'pointer',
    '&:hover': {
      opacity: 0.85
    }
  };

  const renderMatchPercentHeader = (headingPrefix, matchPercent) => (
    <Typography sx={{ color: 'inherit', fontWeight: 700, lineHeight: 1.3 }}>
      {`${headingPrefix}: `}
      <Link component={RouterLink} to={SELF_REPORT_BIOGRAPHY_PATH} underline="always" sx={matchPercentLinkSx}>
        {`${matchPercent}%`}
      </Link>
    </Typography>
  );

  const responseRadioLabelSx = {
    alignItems: 'center',
    '.MuiRadio-root': {
      fontSize: responseRadioCircleFontSizeResponsive,
      color: 'var(--theme-primary-color)',
      p: { xs: 0.5, sm: 0.65 },
      '&.Mui-checked': { color: 'var(--theme-primary-color)' }
    },
    '.MuiFormControlLabel-label': {
      fontSize: buttonFontSizeResponsive,
      lineHeight: 1.2,
      color: 'var(--theme-primary-color)',
      ...buttonHoverMagnifyTransitionSx
    },
    ...hoverMagnifyNestedLabelSx({ baseFontSize: buttonFontSizeResponsive })
  };

  const responseRadioLabelDisabledSx = {
    alignItems: 'center',
    my: 0,
    mr: 0,
    '.MuiRadio-root': {
      fontSize: responseRadioCircleFontSizeResponsive,
      color: '#DADADA',
      p: { xs: 0.5, sm: 0.65 }
    },
    '.MuiFormControlLabel-label': {
      fontSize: buttonFontSizeResponsive,
      lineHeight: 1.2,
      color: '#DADADA'
    },
    '.MuiFormControlLabel-label.Mui-disabled': {
      color: '#DADADA',
      opacity: 1
    },
    '.MuiRadio-root.Mui-disabled': {
      color: '#DADADA'
    }
  };

  const getYourResponseBoxSx = (requestEnabled) => ({
    mt: 0.35,
    px: 0.75,
    py: requestEnabled ? { xs: 0.6, sm: 0.75 } : 0.4,
    minHeight: requestEnabled ? 'auto' : { xs: 88, sm: 82 },
    boxSizing: 'border-box',
    borderRadius: 0.5,
    borderStyle: requestEnabled ? 'dashed' : 'solid',
    borderWidth: '1px',
    borderColor: requestEnabled ? 'var(--theme-primary-color)' : '#A1A1A1',
    bgcolor: requestEnabled ? 'transparent' : '#A1A1A1',
    color: requestEnabled ? 'var(--theme-primary-color)' : '#DADADA',
    opacity: requestEnabled ? 1 : 0.95,
    pointerEvents: requestEnabled ? 'auto' : 'none',
    userSelect: requestEnabled ? 'auto' : 'none'
  });

  const blockedMemberAvatarSx = {
    border: '20px solid #d32f2f',
    boxSizing: 'border-box',
    bgcolor: '#A1A1A1',
    cursor: 'not-allowed',
    pointerEvents: 'none',
    opacity: 0.9,
    '& img': {
      filter: 'grayscale(1)',
      opacity: 0.65
    }
  };

  const renderBioStatusSummary = ({
    bioKind,
    requestFlag,
    approvalState,
    approvalType,
    row,
    busy
  }) => {
    const responseBoxEnabled = isBioRequestRequested(requestFlag);
    const incomingRequestParts = formatIncomingBioRequestMessageParts(row, bioKind);
    const statusPhraseClickable = isAdmin && typeof onAdminCycleIncomingRequest === 'function';
    const statusPhraseBusy = requestBusyKey === `${row.singles_id_from}:${approvalType}:admin-request`;
    const originalRow = originalRows.find((item) => item.requests_id === row.requests_id);
    const savedApproval = triStateBioRequestApproval(
      bioKind === 'brief' ? originalRow?.brief_bio_request_approval : originalRow?.full_bio_request_approval
    );
    const approvalDate = bioKind === 'brief' ? originalRow?.brief_approval_date : originalRow?.full_approval_date;
    const viewingTermExpired =
      savedApproval === APPROVAL_STATUS.APPROVE && isApprovedViewingExpired(approvalDate, approvedViewingDurationMonths);
    const showExpiredResetPanel = !responseBoxEnabled || viewingTermExpired;
    const responsePanelEnabled = responseBoxEnabled && !viewingTermExpired;
    const canRespondToBioRequest = responseBoxEnabled && (responsePanelEnabled || viewingTermExpired);
    const responseBoxInteractive = canRespondToBioRequest;
    const radiosBusy = responseDisabled || Boolean(requestBusyKey) || busy;
    const approvalValue = triStateApproval(approvalState);
    const radioLabelSx = responseBoxInteractive ? responseRadioLabelSx : responseRadioLabelDisabledSx;
    const effectiveSavedApproval = responsePanelEnabled ? savedApproval : APPROVAL_STATUS.NO_RESPONSE;
    const effectiveApprovalValue = canRespondToBioRequest ? approvalValue : APPROVAL_STATUS.NO_RESPONSE;
    const approvalTouched = Boolean(
      touchedApprovalsByRequestId[Number(row.singles_id_from)]?.[bioKind]
    );
    // Pending requests start with no radio selected until the user clicks one.
    const radioGroupValue =
      canRespondToBioRequest && !approvalTouched && effectiveSavedApproval === APPROVAL_STATUS.NO_RESPONSE
        ? ''
        : effectiveApprovalValue;
    const approveDenyLocked =
      responsePanelEnabled &&
      isApprovalLockedDuringStay(effectiveSavedApproval, approvalDate, approvalStayDurationDays);
    const approveDenyDisabled = !canRespondToBioRequest
      ? true
      : responsePanelEnabled
        ? radiosBusy || approveDenyLocked
        : radiosBusy;
    const approvalStatusMessage = responsePanelEnabled
      ? formatIncomingBioApprovalStatusMessage({
          bioKind,
          requestFlag,
          savedApproval: effectiveSavedApproval,
          approvalDate,
          viewingDurationMonths: approvedViewingDurationMonths
        })
      : '';
    const notRequestedResponseMessage = showExpiredResetPanel
      ? formatIncomingBioNotRequestedResponseMessage(bioKind)
      : '';
    const approveRadioLabel =
      bioKind === 'brief'
        ? 'Approve (Includes view-only access to Friends-only Album)'
        : 'Approve (Includes 2-way chat, likes, repost, and comments)';

    const handleRadioChange = (nextValue) => {
      if (!canRespondToBioRequest || approveDenyDisabled) return;
      markApprovalTouched(row.singles_id_from, bioKind);
      if (typeof onApprovalChange === 'function') {
        onApprovalChange(row, approvalType, nextValue);
      }
    };

    const showResponsePendingBadge = responseBoxEnabled && approvalValue === APPROVAL_STATUS.NO_RESPONSE;
    const statusPhraseSx = incomingBioRequestStatusPhraseSx({
      isRequested: responseBoxEnabled,
      clickable: statusPhraseClickable,
      busy: statusPhraseBusy
    });
    const statusPhraseProps = {
      role: statusPhraseClickable ? 'button' : undefined,
      tabIndex: statusPhraseClickable ? 0 : undefined,
      title: statusPhraseClickable ? 'Admin: click to cycle request status' : undefined,
      onClick: statusPhraseClickable ? () => onAdminCycleIncomingRequest(row, approvalType) : undefined,
      onKeyDown: statusPhraseClickable
        ? (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onAdminCycleIncomingRequest(row, approvalType);
            }
          }
        : undefined
    };

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Typography
          sx={{
            color: 'var(--theme-primary-color)',
            fontWeight: 700,
            lineHeight: 1.35,
            fontSize: incomingBioBodyTextFontSize
          }}
        >
          {incomingRequestParts.requesterLabel}{' '}
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              verticalAlign: 'baseline',
              whiteSpace: 'nowrap'
            }}
          >
            <Box component="span" {...statusPhraseProps} sx={statusPhraseSx}>
              {incomingRequestParts.statusPhrase}
            </Box>
            {showResponsePendingBadge ? (
              <Box
                component="span"
                aria-hidden
                sx={incomingBioResponsePendingBadgeSx}
              >
                {incomingBioResponsePendingBadgeNumber(bioKind)}
              </Box>
            ) : null}
          </Box>
          {incomingRequestParts.trailingText}
        </Typography>
        {responsePanelEnabled ? (
          <Box
            sx={{
              width: '100%',
              height: { xs: 28, sm: 32 },
              bgcolor: '#000000',
              borderRadius: 0.25,
              flexShrink: 0
            }}
          />
        ) : null}
        <Box sx={getYourResponseBoxSx(responseBoxInteractive)}>
          <Typography
            sx={{
              fontWeight: 700,
              mb: 0.35,
              color: 'inherit'
            }}
          >
            Your Response:
          </Typography>
          <Box sx={{ position: 'relative' }}>
            {busy && responsePanelEnabled ? (
              <CircularProgress
                size={14}
                sx={{ position: 'absolute', top: 0, right: 0, color: 'var(--theme-primary-color)' }}
              />
            ) : null}
            {notRequestedResponseMessage ? (
              <Typography
                sx={{
                  mb: 0.5,
                  fontWeight: 700,
                  lineHeight: 1.35,
                  color: 'inherit'
                }}
              >
                {notRequestedResponseMessage}
              </Typography>
            ) : null}
            {approvalStatusMessage ? (
              <Typography
                sx={{
                  mb: 0.5,
                  fontWeight: 700,
                  lineHeight: 1.35,
                  color: 'inherit'
                }}
              >
                {approvalStatusMessage}
              </Typography>
            ) : null}
            <RadioGroup
              value={radioGroupValue}
              onChange={(e) => handleRadioChange(e.target.value)}
              sx={{
                mt: 0,
                gap: { xs: 0.35, sm: 0.5 },
                '.MuiFormControlLabel-root': { my: 0, mr: 0 }
              }}
            >
              <FormControlLabel
                value={APPROVAL_STATUS.APPROVE}
                disabled={approveDenyDisabled}
                control={<Radio />}
                label={approveRadioLabel}
                sx={approveDenyLocked && responsePanelEnabled ? responseRadioLabelDisabledSx : radioLabelSx}
              />
              <FormControlLabel
                value={APPROVAL_STATUS.DENY}
                disabled={approveDenyDisabled}
                control={<Radio />}
                label="Deny"
                sx={approveDenyLocked && responsePanelEnabled ? responseRadioLabelDisabledSx : radioLabelSx}
              />
              <FormControlLabel
                value={APPROVAL_STATUS.NO_RESPONSE}
                disabled={approveDenyDisabled}
                control={<Radio />}
                label="No Response"
                sx={approveDenyLocked && responsePanelEnabled ? responseRadioLabelDisabledSx : radioLabelSx}
              />
            </RadioGroup>
          </Box>
        </Box>
      </Box>
    );
  };

  if (!rows.length) {
    return (
      <Typography sx={{ color: 'var(--theme-primary-color)' }}>
        No incoming bio requests found.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: mobileFullWidth ? 0 : 1.5,
          width: '100%',
          maxWidth: '100%',
          alignItems: 'flex-start'
        }}
      >
        <ColorTemplate8PhotoGallery
          header="Drag a card to rearrange order"
          selectedGreenBackground
          selectedAvatarCircular
          sx={mobileFullWidth ? { width: '100%', maxWidth: '100%', borderRadius: 0 } : undefined}
          listSx={mobileFullWidth ? { width: '100%' } : undefined}
        >
            {orderedIds.map((singlesId) => {
              const row = rowByRequesterId.get(singlesId);
              if (!row) return null;
              const selected = Number(singlesId) === Number(selectedSinglesId);
              const memberLabel = formatMemberLabel({
                alias: row.alias,
                singlesId: row.singles_id_from,
                prefix: row.prefix,
                memberId: row.member_id
              });
              const memberDisplay = getMemberDisplayLines({
                alias: row.alias,
                singlesId: row.singles_id_from,
                prefix: row.prefix,
                memberId: row.member_id
              });
              const profileUrl =
                row.profile_image_url && row.profile_image_url !== 'profile.jpeg'
                  ? row.profile_image_url
                  : `${API_BASE_URL}/api/profile-photo/${row.singles_id_from}`;
              const isDropTarget = draggingSinglesId != null && dropTargetSinglesId === singlesId && draggingSinglesId !== singlesId;
              const isBlockedUser = Boolean(row.block_user);
              const savedRow = originalRows.find((item) => item.requests_id === row.requests_id) ?? row;
              const pendingBadgeCount = countIncomingBioRequestsPending(savedRow);

              return (
                <ColorTemplate8PhotoGallery.Item
                  key={singlesId}
                  impersonateSinglesId={singlesId}
                  selected={selected}
                  isDropTarget={isDropTarget}
                  draggable
                  title="Drag to reorder"
                  onDragStart={(e) => {
                    if (e.target instanceof Element && e.target.closest('[data-clickable-zone="true"]')) {
                      e.preventDefault();
                      return;
                    }
                    setDraggingSinglesId(singlesId);
                    e.dataTransfer.setData('application/x-received-bio-singles-id', String(singlesId));
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
                    const raw =
                      e.dataTransfer.getData('application/x-received-bio-singles-id') || e.dataTransfer.getData('text/plain');
                    const fromId = Number(raw);
                    handleReorderDrop(fromId, singlesId);
                    setDraggingSinglesId(null);
                    setDropTargetSinglesId(null);
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      width: '100%'
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
                    {pendingBadgeCount > 0 ? (
                      <Box
                        component="span"
                        aria-label={`${pendingBadgeCount} pending bio request${pendingBadgeCount === 1 ? '' : 's'}`}
                        sx={receivedBioPendingBadgeSx({
                          mt: { xs: 0.35, sm: 0.25 },
                          mb: { xs: 0.15, sm: 0.1 },
                          zIndex: RECEIVED_BIO_PENDING_BADGE_Z_INDEX + 1,
                          px: pendingBadgeCount > 9 ? 0.35 : 0
                        })}
                      >
                        {pendingBadgeCount}
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
                </ColorTemplate8PhotoGallery.Item>
              );
            })}
        </ColorTemplate8PhotoGallery>

        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            width: '100%',
            maxWidth: '100%',
            border: '1px solid var(--theme-primary-color)',
            borderRadius: mobileFullWidth ? 0 : 1,
            bgcolor: 'var(--theme-secondary-color)',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box'
          }}
        >
          <Box
            role="region"
            aria-label="Bio request response"
            sx={{
              px: 1.25,
              pt: 1.25,
              pb: 0.5
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {selectedRow == null ? (
                <Typography sx={{ color: 'var(--theme-primary-color)' }}>Select a member on the left.</Typography>
              ) : (
                <>
                  {(function renderBriefBioSection() {
                    const briefMatchPercent = calcBriefBioMatchPercent(selectedRow);
                    return (
                      <Box
                        sx={{
                          border: '1px solid var(--theme-primary-color)',
                          borderRadius: 1,
                          overflow: 'hidden',
                          bgcolor: 'var(--theme-daynight-color, #fff)'
                        }}
                      >
                        <Box
                          sx={{
                            px: 1,
                            py: 0.6,
                            bgcolor: (theme) => colorTemplate1WallColorByTheme(theme),
                            color: (theme) => (theme.palette.mode === 'dark' ? '#fff' : 'var(--theme-primary-color)'),
                            textAlign: 'center'
                          }}
                        >
                          {renderMatchPercentHeader('My Brief Bio Percentage Completed & Match', briefMatchPercent)}
                        </Box>
                        <Box sx={{ p: 0.75 }}>
                          {renderBioStatusSummary({
                            bioKind: 'brief',
                            requestFlag: selectedRow?.brief_bio_request,
                            approvalState: selectedRow?.brief_bio_request_approval,
                            approvalType: 'basic',
                            row: selectedRow,
                            busy: requestBusyKey === `${selectedRow.requests_id}:basic`
                          })}
                        </Box>
                      </Box>
                    );
                  })()}
                  {(function renderFullBioSection() {
                    const fullMatchPercent = calcFullBioMatchPercent(selectedRow);
                    return (
                      <Box
                        sx={{
                          border: '1px solid var(--theme-primary-color)',
                          borderRadius: 1,
                          overflow: 'hidden',
                          bgcolor: 'var(--theme-daynight-color, #fff)'
                        }}
                      >
                        <Box
                          sx={{
                            px: 1,
                            py: 0.6,
                            bgcolor: (theme) => colorTemplate1WallColorByTheme(theme),
                            color: (theme) => (theme.palette.mode === 'dark' ? '#fff' : 'var(--theme-primary-color)'),
                            textAlign: 'center'
                          }}
                        >
                          {renderMatchPercentHeader('My Full Bio Percentage Completed & Match', fullMatchPercent)}
                        </Box>
                        <Box sx={{ p: 0.75 }}>
                          {renderBioStatusSummary({
                            bioKind: 'full',
                            requestFlag: selectedRow?.full_bio_request,
                            approvalState: selectedRow?.full_bio_request_approval,
                            approvalType: 'details',
                            row: selectedRow,
                            busy: requestBusyKey === `${selectedRow.requests_id}:details`
                          })}
                        </Box>
                      </Box>
                    );
                  })()}
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0.75,
                      py: 0.5
                    }}
                  >
                    {submitResponseBusy ? (
                      <BusyHourglassOverlay open={submitResponseBusy} label="Submitting response" />
                    ) : null}
                    <GreenButton
                      type="button"
                      disabled={!submitResponseEnabled || submitResponseBusy}
                      onClick={() => {
                        if (typeof onSubmitResponse === 'function' && selectedRow) {
                          void onSubmitResponse(selectedRow);
                        }
                      }}
                      sx={{
                        // Fixed green — Minimal remaps --theme-action-green-color away from green.
                        bgcolor: '#60C446 !important',
                        '@media (hover: hover)': {
                          '&:hover:not(.Mui-disabled)': {
                            bgcolor: '#60C446 !important'
                          }
                        }
                      }}
                    >
                      {submitResponseBusy ? 'Submitting…' : 'Submit Response'}
                    </GreenButton>
                  </Box>
                  {showRequesterPreview ? (
                    <Box
                      ref={previewCaptureRef}
                      data-ui-test-target="received-bio-preview-capture"
                      sx={{
                        border: `${RECEIVED_BIO_PREVIEW_BORDER_PX}px solid ${RECEIVED_BIO_PREVIEW_YELLOW}`,
                        borderRadius: 0.5,
                        overflow: 'hidden',
                        bgcolor: '#ffffff'
                      }}
                    >
                      <Typography
                        sx={{
                          bgcolor: RECEIVED_BIO_PREVIEW_YELLOW,
                          color: '#000000 !important',
                          WebkitTextFillColor: '#000000',
                          fontWeight: 700,
                          lineHeight: 1.45,
                          fontSize: buttonFontSizeResponsive,
                          px: { xs: 1, sm: 1.25 },
                          py: { xs: 0.75, sm: 1 }
                        }}
                      >
                        {`Based on your choices above, here is a preview of what ${requesterPreviewLabel} will see (after you approved):`}
                      </Typography>
                      {requesterPreviewPanel?.empty ? null : requesterPreviewPanel?.bioReview ? (
                        <CheckrBioReviewPanel
                          bioReview={requesterPreviewPanel.bioReview}
                          loading={false}
                          consentFlowEnabled={false}
                          showMatchNoteColumn={false}
                          suppressEditActions
                          visibleSections={requesterPreviewPanel.visibleSections}
                        />
                      ) : requesterPreviewPanel && !requesterPreviewPanel.empty ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                          <CircularProgress size={24} />
                        </Box>
                      ) : null}
                    </Box>
                  ) : null}
                </>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
