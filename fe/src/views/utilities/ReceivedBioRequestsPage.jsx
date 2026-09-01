import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';
import { focusMainScrollColumn } from 'utils/focusMainScrollColumn';
import { useNavigate } from 'react-router-dom';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

// project imports
import MainCard from 'ui-component/cards/MainCard';
import { useAuth } from 'contexts/AuthContext';
import { getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTitleFontSizeVw } from 'config/singlesMemberCardFontEnv';
import {
  normalizeRequestApproval,
  postRequestAboutMeApproval,
  postRequestAboutMeRequestFlag,
  useGetRequestsAboutMe,
  useGetRequestsAboutMeSettings
} from 'api/requestsAboutMeFe';
import { APPROVAL_STATUS } from 'utils/approvalStatusEnum';
import { isAdminSession } from 'utils/adminSession';
import { isRegularMemberCategory } from 'utils/memberCategory';
import { postSaveConsentRecord } from 'api/consentRecordFe';
import { PROFILES_RECORDS_PATH } from 'constants/profilesRecordsRoute';
import api from 'api/axios';
import {
  CONSENT_DESCRIPTION_REQUEST_ABOUT_ME,
  CONSENT_WATERMARK_VARIANTS
} from 'constants/consentRecordVariants';
import { captureElementAsPng } from 'utils/captureConsentDialogImage';
import { combineImagesSideBySide } from 'utils/combineImagesSideBySide';
import VerificationAuthorizationDialog from './VerificationAuthorizationDialog';
import {
  ReceivedBioRequestsInstructionPopup
} from './SelfReportBiographyInstruction';
import EarnTokensPageTitle from 'ui-component/EarnTokensPageTitle';
import PageInstructionEarnTokensAction from 'ui-component/PageInstructionEarnTokensAction';
import PageVideoTutorialsButton from 'ui-component/PageVideoTutorialsButton';
import { formatMemberLabel } from 'utils/memberLabel';
import { formatCapitalizedFullName } from 'utils/fullNameFormat';

const IDENTIFICATION_SEARCH_NAME_REQUIRED_MSG =
  'You must complete "Identifcation Search" on "MY self-report-bio menu" first for verified name before signing off approval for your own bio requests.';
import { useGetRequestsSent } from 'api/requestsSentFe';
import {
  isBioRequestRequested,
  isOutgoingBioRequestApproved,
  isIncomingAutoMutualApprovedFromOutgoingInitiative,
  mirroredIncomingApprovalFromOutgoing,
  shouldShowOnReceivedBioRequestsPage
} from 'utils/receivedBioRequestDisplay';
import ReceivedBioRequestsBiographyLayout from './ReceivedBioRequestsBiographyLayout';
import { SIDEBAR_MOBILE_CLOSE_MEDIA } from 'config/sidebarMobileCloseEnv';
import { dispatchBellNotificationRefresh } from 'utils/notificationBellStore';
import { themedAlert } from 'utils/themedDialog';
import { useTheme } from '@mui/material/styles';
import useConfig from 'hooks/useConfig';
import { appPageScrollHostCardSx, buildAppPageScrollRegionSx, getAppPageZoomFactor } from 'utils/appPageScrollRegionEnv';
import FirstVisitPageWelcomePopup from 'ui-component/FirstVisitPageWelcomePopup';
import useFirstVisitPageWelcomePopup from 'hooks/useFirstVisitPageWelcomePopup';

function isRequestedState(value) {
  return String(value ?? '').trim().toLowerCase() === 'requested';
}

function buildReciprocalIncomingRow(outgoingRow, viewerSinglesId) {
  const mirrored = mirroredIncomingApprovalFromOutgoing(outgoingRow);
  return {
    requests_id: `reciprocal-${outgoingRow.requests_id}`,
    singles_id_from: Number(outgoingRow.singles_id_to),
    singles_id_to: viewerSinglesId,
    prefix: outgoingRow.prefix ?? null,
    member_id: outgoingRow.member_id ?? null,
    alias: outgoingRow.alias ?? null,
    profile_image_url: outgoingRow.profile_image_url ?? null,
    gallery_image_urls: outgoingRow.gallery_image_urls ?? [],
    vetted_status: Boolean(outgoingRow.vetted_status),
    brief_bio_request: 'notrequested',
    full_bio_request: 'notrequested',
    brief_bio_request_approval: mirrored?.brief_bio_request_approval ?? APPROVAL_STATUS.NO_RESPONSE,
    full_bio_request_approval: mirrored?.full_bio_request_approval ?? APPROVAL_STATUS.NO_RESPONSE,
    brief_approval_date: null,
    full_approval_date: null,
    block_user: Boolean(outgoingRow.block_user),
    reciprocal_from_outgoing: true
  };
}

function applyMirroredIncomingApproval(row, outgoingRow) {
  const mirrored = mirroredIncomingApprovalFromOutgoing(outgoingRow);
  if (!mirrored) return row;
  return {
    ...row,
    brief_bio_request_approval: mirrored.brief_bio_request_approval,
    full_bio_request_approval: mirrored.full_bio_request_approval
  };
}

// ==============================|| RECEIVED BIO REQUESTS PAGE ||============================== //

export default function ReceivedBioRequestsPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const downSM = useMediaQuery(theme.breakpoints.down('sm'));
  const mobileFullWidth = useMediaQuery(SIDEBAR_MOBILE_CLOSE_MEDIA);
  const {
    state: { pageZoom }
  } = useConfig();
  const scrollRegionSx = useMemo(
    () => buildAppPageScrollRegionSx(downSM ? 1 : getAppPageZoomFactor(pageZoom)),
    [downSM, pageZoom]
  );
  const { user } = useAuth();
  const {
    open: firstVisitWelcomeOpen,
    onClose: closeFirstVisitWelcome
  } = useFirstVisitPageWelcomePopup('firstVisitRecBioRequest', { userSinglesId: user?.singles_id });
  const isRegularMember = isRegularMemberCategory(user?.member_category);
  const { requestsAboutMe, requestsAboutMeLoading, requestsAboutMeError, refetch } = useGetRequestsAboutMe();
  const { requestsSent, requestsSentLoading, requestsSentError } = useGetRequestsSent();
  const { approvalStayDurationDays, approvedViewingDurationMonths } = useGetRequestsAboutMeSettings();
  const [requestBusyKey, setRequestBusyKey] = useState('');
  const [approvalStateByRequestId, setApprovalStateByRequestId] = useState({});
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [pendingConsent, setPendingConsent] = useState(null);
  const [bioReview, setBioReview] = useState(null);
  const [instructionOpen, setInstructionOpen] = useState(false);
  const previewCaptureRef = useRef(null);
  const requestCaptureInFlightRef = useRef(false);

  useLayoutEffect(() => {
    focusMainScrollColumn();
  }, []);

  useLayoutEffect(() => {
    if (requestsAboutMeLoading || requestsSentLoading || requestsAboutMeError || requestsSentError) return;
    focusMainScrollColumn();
  }, [requestsAboutMeLoading, requestsSentLoading, requestsAboutMeError, requestsSentError]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/api/checkr/bio-review');
        if (!cancelled) setBioReview(data ?? null);
      } catch (err) {
        console.warn('[ReceivedBioRequestsPage] bio-review preload failed', err?.response?.data?.error || err?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const outgoingByRequesterId = useMemo(() => {
    const myId = user?.singles_id != null ? Number(user.singles_id) : null;
    const myIdOk = Number.isFinite(myId);
    const map = new Map();
    for (const row of requestsSent) {
      if (!Number.isFinite(row?.singles_id_to) || !Number.isFinite(row?.singles_id_from)) continue;
      if (myIdOk && Number(row.singles_id_from) !== myId) continue;
      map.set(Number(row.singles_id_to), row);
    }
    return map;
  }, [requestsSent, user?.singles_id]);

  const rows = useMemo(() => {
    const currentSinglesId = Number(user?.singles_id);
    const shouldFilterByTarget = Number.isFinite(currentSinglesId);
    const incomingRows = requestsAboutMe
      .filter((x) => Number.isFinite(x?.singles_id_from))
      .filter((x) => (shouldFilterByTarget ? Number(x?.singles_id_to) === currentSinglesId : true));

    const mergedByRequester = new Map();
    for (const row of incomingRows) {
      const requesterId = Number(row.singles_id_from);
      const outgoingRow = outgoingByRequesterId.get(requesterId);
      if (!shouldShowOnReceivedBioRequestsPage(row, outgoingRow)) continue;
      mergedByRequester.set(requesterId, applyMirroredIncomingApproval(row, outgoingRow));
    }

    for (const [requesterId, outgoingRow] of outgoingByRequesterId.entries()) {
      if (mergedByRequester.has(requesterId)) continue;
      if (!isOutgoingBioRequestApproved(outgoingRow)) continue;
      mergedByRequester.set(requesterId, buildReciprocalIncomingRow(outgoingRow, currentSinglesId));
    }

    return [...mergedByRequester.values()].sort((a, b) => a.singles_id_from - b.singles_id_from);
  }, [requestsAboutMe, outgoingByRequesterId, user?.singles_id]);

  const effectiveRowApproval = (row, key) => {
    const override = approvalStateByRequestId?.[row.requests_id];
    if (override && Object.prototype.hasOwnProperty.call(override, key)) {
      return normalizeRequestApproval(override[key]);
    }
    return normalizeRequestApproval(row[key]);
  };

  const rowsWithEffectiveApproval = useMemo(
    () =>
      rows.map((row) => {
        const override = approvalStateByRequestId?.[row.requests_id];
        const briefOverride =
          override && Object.prototype.hasOwnProperty.call(override, 'brief_bio_request_approval');
        const fullOverride =
          override && Object.prototype.hasOwnProperty.call(override, 'full_bio_request_approval');
        const briefRequested = isBioRequestRequested(row.brief_bio_request);
        const fullRequested = isBioRequestRequested(row.full_bio_request);
        const outgoingRow = outgoingByRequesterId.get(Number(row.singles_id_from));
        const mirrored = mirroredIncomingApprovalFromOutgoing(outgoingRow);
        let briefApproval = briefOverride
          ? effectiveRowApproval(row, 'brief_bio_request_approval')
          : normalizeRequestApproval(row.brief_bio_request_approval);
        let fullApproval = fullOverride
          ? effectiveRowApproval(row, 'full_bio_request_approval')
          : normalizeRequestApproval(row.full_bio_request_approval);

        if (mirrored && !briefOverride && !fullOverride) {
          briefApproval = normalizeRequestApproval(mirrored.brief_bio_request_approval);
          fullApproval = normalizeRequestApproval(mirrored.full_bio_request_approval);
        }

        if (!briefRequested && briefApproval !== APPROVAL_STATUS.APPROVE) {
          briefApproval = APPROVAL_STATUS.NO_RESPONSE;
        }
        if (!fullRequested && fullApproval !== APPROVAL_STATUS.APPROVE) {
          fullApproval = APPROVAL_STATUS.NO_RESPONSE;
        }
        if (isRegularMember) {
          briefApproval = APPROVAL_STATUS.NO_RESPONSE;
          fullApproval = APPROVAL_STATUS.NO_RESPONSE;
        }

        const rowForAutoMutual = {
          ...row,
          brief_bio_request_approval: briefApproval,
          full_bio_request_approval: fullApproval
        };
        const briefAutoMutualFromOutgoing = isIncomingAutoMutualApprovedFromOutgoingInitiative(
          rowForAutoMutual,
          outgoingRow,
          'brief'
        );
        const fullAutoMutualFromOutgoing = isIncomingAutoMutualApprovedFromOutgoingInitiative(
          rowForAutoMutual,
          outgoingRow,
          'full'
        );

        return {
          ...row,
          brief_bio_request_approval: briefApproval,
          full_bio_request_approval: fullApproval,
          brief_auto_mutual_from_outgoing: briefAutoMutualFromOutgoing,
          full_auto_mutual_from_outgoing: fullAutoMutualFromOutgoing
        };
      }),
    [rows, approvalStateByRequestId, outgoingByRequesterId, isRegularMember]
  );

  const expectedFullName = useMemo(() => {
    const dl = bioReview?.verifiedDlLegalName;
    const first = String(dl?.firstname ?? '').trim();
    const middle = String(dl?.middlename ?? '').trim();
    const last = String(dl?.lastname ?? '').trim();
    if (!first || !middle || !last) return '';
    return dl?.fullName || formatCapitalizedFullName(first, middle, last);
  }, [bioReview?.verifiedDlLegalName]);

  const handleAdminCycleIncomingRequest = async (row, approvalType) => {
    if (!isAdminSession(user)) return;
    const from = Number(row?.singles_id_from);
    if (!Number.isFinite(from) || from < 1) return;

    const busyKey = `${from}:${approvalType}:admin-request`;
    if (requestBusyKey) return;

    const isBasic = approvalType === 'basic';
    const currentFlag = isBasic ? row?.brief_bio_request : row?.full_bio_request;
    const nextValue = isRequestedState(currentFlag) ? 'notrequested' : 'requested';

    setRequestBusyKey(busyKey);
    try {
      await postRequestAboutMeRequestFlag(from, approvalType, nextValue);
      await refetch();
    } catch (err) {
      await themedAlert(err?.message || 'Failed to update request status');
    } finally {
      setRequestBusyKey('');
    }
  };

  const handleApprovalChange = (row, approvalType, next) => {
    if (isRegularMember) return;
    const requestFlag = approvalType === 'basic' ? row.brief_bio_request : row.full_bio_request;
    if (!isRequestedState(requestFlag) || requestBusyKey || consentSaving) return;

    if (
      (approvalType === 'basic' && row.brief_auto_mutual_from_outgoing) ||
      (approvalType === 'details' && row.full_auto_mutual_from_outgoing)
    ) {
      return;
    }

    const stateField = approvalType === 'basic' ? 'brief_bio_request_approval' : 'full_bio_request_approval';
    const nextUpdates = { [stateField]: next };

    if (approvalType === 'basic' && next === APPROVAL_STATUS.DENY && isRequestedState(row.full_bio_request)) {
      nextUpdates.full_bio_request_approval = APPROVAL_STATUS.DENY;
    }
    if (approvalType === 'details' && next === APPROVAL_STATUS.APPROVE && isRequestedState(row.brief_bio_request)) {
      nextUpdates.brief_bio_request_approval = APPROVAL_STATUS.APPROVE;
    }

    setApprovalStateByRequestId((prev) => ({
      ...prev,
      [row.requests_id]: {
        ...(prev?.[row.requests_id] ?? {}),
        ...nextUpdates
      }
    }));
  };

  const clearSubmitResponseBusy = (submitBusyKey) => {
    if (!submitBusyKey) return;
    setRequestBusyKey((current) => (current === submitBusyKey ? '' : current));
  };

  const beginConsentFlow = async (row, approvalType, remainingApproveTypes = [], submitBusyKey = '') => {
    if (!bioReview) {
      await themedAlert('Self-report bio is still loading. Please try again on or after a moment.');
      clearSubmitResponseBusy(submitBusyKey);
      return;
    }
    if (!expectedFullName) {
      await themedAlert(IDENTIFICATION_SEARCH_NAME_REQUIRED_MSG);
      navigate(RECEIVED_BIO_REQUESTS_PATH, { replace: true });
      clearSubmitResponseBusy(submitBusyKey);
      return;
    }
    if (requestCaptureInFlightRef.current) return;

    const stateField = approvalType === 'basic' ? 'brief_bio_request_approval' : 'full_bio_request_approval';
    const originalRow = rows.find((item) => item.requests_id === row.requests_id);
    const previousApproval = normalizeRequestApproval(originalRow?.[stateField]);

    const captureNode = previewCaptureRef.current;
    if (!captureNode) {
      await themedAlert(
        'Request preview is not visible. Select Approve so the yellow preview box appears, then try again.'
      );
      clearSubmitResponseBusy(submitBusyKey);
      return;
    }

    requestCaptureInFlightRef.current = true;
    void (async () => {
      try {
        captureNode.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        await new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        });
        const previewImage = await captureElementAsPng(captureNode, {
          backgroundColor: '#ffffff',
          forceViewportStaging: true,
          validateNonEmpty: true,
          validateLabel: 'Bio preview'
        });
        setPendingConsent({
          row,
          approvalType,
          bioImage: previewImage,
          stateField,
          previousApproval,
          remainingApproveTypes
        });
        setConsentDialogOpen(true);
      } catch (err) {
        console.warn('[ReceivedBioRequestsPage] preview capture failed', err?.message || err);
        await themedAlert('Failed to capture request preview image. Please try again.');
      } finally {
        requestCaptureInFlightRef.current = false;
        clearSubmitResponseBusy(submitBusyKey);
      }
    })();
  };

  const handleSubmitResponse = async (row) => {
    if (isRegularMember) return;
    if (!row || requestBusyKey || consentSaving || consentDialogOpen) return;

    const originalRow = rows.find((item) => item.requests_id === row.requests_id);
    if (!originalRow) return;

    const draftBrief = effectiveRowApproval(row, 'brief_bio_request_approval');
    const draftFull = effectiveRowApproval(row, 'full_bio_request_approval');
    const savedBrief = normalizeRequestApproval(originalRow.brief_bio_request_approval);
    const savedFull = normalizeRequestApproval(originalRow.full_bio_request_approval);

    const briefRequested = isRequestedState(row.brief_bio_request);
    const fullRequested = isRequestedState(row.full_bio_request);
    const briefAutoMutual = Boolean(row.brief_auto_mutual_from_outgoing);
    const fullAutoMutual = Boolean(row.full_auto_mutual_from_outgoing);

    const briefChanged =
      briefRequested &&
      !briefAutoMutual &&
      draftBrief !== savedBrief &&
      draftBrief !== APPROVAL_STATUS.NO_RESPONSE;
    const fullChanged =
      fullRequested &&
      !fullAutoMutual &&
      draftFull !== savedFull &&
      draftFull !== APPROVAL_STATUS.NO_RESPONSE;

    if (!briefChanged && !fullChanged) return;

    const approveQueue = [];
    if (briefChanged && draftBrief === APPROVAL_STATUS.APPROVE) approveQueue.push('basic');
    if (fullChanged && draftFull === APPROVAL_STATUS.APPROVE) approveQueue.push('details');

    if (approveQueue.length > 0) {
      const submitBusyKey = `${row.requests_id}:submit`;
      setRequestBusyKey(submitBusyKey);
      await beginConsentFlow(row, approveQueue[0], approveQueue.slice(1), submitBusyKey);
      return;
    }

    const busyKey = `${row.requests_id}:submit`;
    setRequestBusyKey(busyKey);
    try {
      if (briefChanged && draftBrief === APPROVAL_STATUS.DENY) {
        await postRequestAboutMeApproval(row.singles_id_from, 'basic', APPROVAL_STATUS.DENY);
      }
      if (fullChanged && draftFull === APPROVAL_STATUS.DENY) {
        await postRequestAboutMeApproval(row.singles_id_from, 'details', APPROVAL_STATUS.DENY);
      }
      await refetch();
      setApprovalStateByRequestId((prev) => {
        const next = { ...prev };
        delete next[row.requests_id];
        return next;
      });
      dispatchBellNotificationRefresh('bio');
    } catch (err) {
      console.error('[ReceivedBioRequestsPage] submit response failed', err?.message ?? err);
      await themedAlert(err?.message || 'Failed to submit response');
    } finally {
      setRequestBusyKey('');
    }
  };

  const handleConsentCancel = () => {
    if (consentSaving) return;
    if (pendingConsent?.row?.requests_id != null && pendingConsent?.stateField) {
      const { row, stateField, previousApproval } = pendingConsent;
      setApprovalStateByRequestId((prev) => ({
        ...prev,
        [row.requests_id]: {
          ...(prev?.[row.requests_id] ?? {}),
          [stateField]: previousApproval
        }
      }));
    }
    setConsentDialogOpen(false);
    setPendingConsent(null);
  };

  const handleConsentConfirm = async ({ fullNameSigned, viewerApprovedId, dateSigned, consentSignatureImage }) => {
    if (!pendingConsent || isRegularMember) return;

    const { row, approvalType, bioImage, remainingApproveTypes = [] } = pendingConsent;
    const stateField = approvalType === 'basic' ? 'brief_bio_request_approval' : 'full_bio_request_approval';
    const current = effectiveRowApproval(row, stateField);
    const busyKey = `${row.requests_id}:${approvalType}`;

    setConsentSaving(true);
    setRequestBusyKey(busyKey);

    try {
      if (!consentSignatureImage) {
        throw new Error('Consent screen was not captured. Please try again.');
      }

      let consentImageToSave = consentSignatureImage;
      if (bioImage) {
        consentImageToSave = await combineImagesSideBySide(bioImage, consentSignatureImage);
      }

      await postSaveConsentRecord({
        full_name_signed: fullNameSigned,
        viewer_approved: viewerApprovedId,
        date_signed: dateSigned,
        consent_signature_image: consentImageToSave,
        description: CONSENT_DESCRIPTION_REQUEST_ABOUT_ME,
        watermark_variant: CONSENT_WATERMARK_VARIANTS.requestAboutMe
      });
      await postRequestAboutMeApproval(row.singles_id_from, approvalType, APPROVAL_STATUS.APPROVE);
      setApprovalStateByRequestId((prev) => ({
        ...prev,
        [row.requests_id]: {
          ...(prev?.[row.requests_id] ?? {}),
          [stateField]: APPROVAL_STATUS.APPROVE
        }
      }));

      if (remainingApproveTypes.length > 0) {
        await refetch();
        dispatchBellNotificationRefresh('bio');
        setConsentDialogOpen(false);
        setPendingConsent(null);
        setConsentSaving(false);
        setRequestBusyKey('');
        const submitBusyKey = `${row.requests_id}:submit`;
        setRequestBusyKey(submitBusyKey);
        await beginConsentFlow(row, remainingApproveTypes[0], remainingApproveTypes.slice(1), submitBusyKey);
        return;
      }

      await refetch();
      dispatchBellNotificationRefresh('bio');
      setConsentDialogOpen(false);
      setPendingConsent(null);
      setApprovalStateByRequestId((prev) => {
        const next = { ...prev };
        delete next[row.requests_id];
        return next;
      });
      navigate(PROFILES_RECORDS_PATH, { state: { openTab: 'consents' } });
    } catch (err) {
      console.error('[ReceivedBioRequestsPage] consent submit failed', err?.message ?? err);
      await themedAlert(err?.message || 'Failed to submit consent');
      setApprovalStateByRequestId((prev) => ({
        ...prev,
        [row.requests_id]: {
          ...(prev?.[row.requests_id] ?? {}),
          [stateField]: current
        }
      }));
    } finally {
      setConsentSaving(false);
      setRequestBusyKey('');
    }
  };

  const pendingViewerApprovedLabel = pendingConsent
    ? formatMemberLabel({
        alias: pendingConsent.row?.alias,
        singlesId: pendingConsent.row?.singles_id_from,
        prefix: pendingConsent.row?.prefix,
        memberId: pendingConsent.row?.member_id
      })
    : '';

  return (
    <MainCard
      headerSX={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
      contentSX={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...(mobileFullWidth
          ? {
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              p: 0,
              '&:last-child': { pb: 2 }
            }
          : {})
      }}
      sx={{
        ...appPageScrollHostCardSx,
        ...(mobileFullWidth
          ? { width: '100%', maxWidth: '100%', boxSizing: 'border-box', borderRadius: 0 }
          : {})
      }}
      title={
        <EarnTokensPageTitle>
          <Typography
            sx={{
              fontSize: { xs: getMobileSinglesTitleFontSizeVw(), sm: getDesktopTitleFontSizeVw() },
              color: 'var(--theme-primary-color)'
            }}
          >
            Received Bio Requests
          </Typography>
        </EarnTokensPageTitle>
      }
      center={<PageVideoTutorialsButton pageKey="receivedBioRequest" />}
      secondary={<PageInstructionEarnTokensAction onInstructionClick={() => setInstructionOpen(true)} />}
    >
      <FirstVisitPageWelcomePopup
        pageKey="recBioRequest"
        open={firstVisitWelcomeOpen}
        onClose={closeFirstVisitWelcome}
      />
      <ReceivedBioRequestsInstructionPopup open={instructionOpen} onClose={() => setInstructionOpen(false)} />
      <VerificationAuthorizationDialog
        open={consentDialogOpen}
        confirmBusy={consentSaving}
        viewerApprovedLabel={pendingViewerApprovedLabel}
        viewerApprovedId={pendingConsent?.row?.singles_id_from ?? null}
        expectedFullName={expectedFullName}
        scrollToBottomOnOpen
        onConfirm={handleConsentConfirm}
        onCancel={handleConsentCancel}
      />
      {requestsAboutMeLoading || requestsSentLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : null}
      {requestsAboutMeError || requestsSentError ? (
        <Alert severity="error">
          Failed to load requests.
          <Box component="pre" sx={{ mt: 1, fontSize: '0.75rem', overflow: 'auto', maxHeight: 120 }}>
            {requestsAboutMeError?.message ?? requestsSentError?.message ?? String(requestsAboutMeError ?? requestsSentError)}
          </Box>
        </Alert>
      ) : null}
      {!requestsAboutMeLoading && !requestsSentLoading && !requestsAboutMeError && !requestsSentError ? (
        <Box sx={scrollRegionSx}>
          <ReceivedBioRequestsBiographyLayout
            rows={rowsWithEffectiveApproval}
            originalRows={rows}
            approvalStayDurationDays={approvalStayDurationDays}
            approvedViewingDurationMonths={approvedViewingDurationMonths}
            onApprovalChange={handleApprovalChange}
            onAdminCycleIncomingRequest={handleAdminCycleIncomingRequest}
            onSubmitResponse={handleSubmitResponse}
            requestBusyKey={requestBusyKey}
            responseDisabled={consentSaving || consentDialogOpen}
            bioReview={bioReview}
            previewCaptureRef={previewCaptureRef}
          />
        </Box>
      ) : null}
    </MainCard>
  );
}
