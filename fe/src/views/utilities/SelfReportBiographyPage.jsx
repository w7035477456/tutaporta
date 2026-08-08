import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import MainCard from 'ui-component/cards/MainCard';
import api from 'api/axios';
import { useAuth } from 'contexts/AuthContext';
import { SIDEBAR_MOBILE_CLOSE_MEDIA } from 'config/sidebarMobileCloseEnv';
import { getDesktopTextFontSizeVw, getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTitleFontSizeVw } from 'config/singlesMemberCardFontEnv';
import { fetchVetBioVerificationServices, patchVetBioVerificationServices } from 'api/vetBioVerificationServicesFe';
import CheckrBioReviewPanel from './CheckrBioReviewPanel';
import RekognitionVerifyDialog from './RekognitionVerifyDialog';
import PassportCitizenshipUploadDialog from './PassportCitizenshipUploadDialog';
import { MY_STORY_PATH } from 'utils/profilePhotoSetup';
import {
  clearSignupIdentificationVerificationRequired,
  isSignupIdentificationVerificationRequired
} from 'utils/signupIdentificationVerification';
import { sanitizeUserFacingTechTerms } from 'utils/sanitizeUserFacingTechTerms';
import { themedAlert } from 'utils/themedDialog';
import {
  ProfilePhotoChangeConfirmDialog,
  ProfilePhotoChangeWaitDialog
} from 'views/dashboard/myStory/ProfilePhotoChangeGateDialog';
import {
  evaluateProfilePhotoChangeGate,
  fetchProfilePhotoVettingFromBioReview,
  formatProfilePhotoEditWaitMessage,
  PROFILE_PHOTO_EDIT_CONFIRM_MESSAGE
} from 'utils/profilePhotoChangeGate';
import { SelfReportBiographyInstructionPopup } from './SelfReportBiographyInstruction';
import PageInstructionEarnTokensAction from 'ui-component/PageInstructionEarnTokensAction';
import EarnTokensPageTitle from 'ui-component/EarnTokensPageTitle';
import DomainVerificationPopup from './DomainVerificationPopup';
import AcademicRecordVerificationPopup from './AcademicRecordVerificationPopup';
import LinkedInVerificationPopup from './LinkedInVerificationPopup';
import VerificationServicesTable from './VerificationServicesTable';
import { fetchLinkedInStatus } from 'api/linkedinVerificationFe';
import { isAdminSession, isImpersonationSession, isToolsOnlyAdminSession } from 'utils/adminSession';
import { cycleVerificationStatus } from 'utils/verificationServiceStatus';
import useConfig from 'hooks/useConfig';
import {
  appPageScrollHostCardSx,
  buildAppPageScrollRegionSx,
  getAppPageZoomFactor
} from 'utils/appPageScrollRegionEnv';

export default function SelfReportBiographyPage() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const adminCanEdit = isAdminSession(user);
  const toolsOnlyAdmin = isToolsOnlyAdminSession(user);
  const [bioReview, setBioReview] = useState(null);
  const [bioReviewLoading, setBioReviewLoading] = useState(true);
  const [verificationServices, setVerificationServices] = useState([]);
  const [verificationServicesLoading, setVerificationServicesLoading] = useState(true);
  const [verificationStatusOverrides, setVerificationStatusOverrides] = useState({});
  const [verificationStatusSavingKey, setVerificationStatusSavingKey] = useState(null);
  const [successText, setSuccessText] = useState('');
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [domainVerificationOpen, setDomainVerificationOpen] = useState(false);
  const [academicRecordVerificationOpen, setAcademicRecordVerificationOpen] = useState(false);
  const [linkedInVerificationOpen, setLinkedInVerificationOpen] = useState(false);
  const [rekognitionOpen, setRekognitionOpen] = useState(false);
  const [passportUploadOpen, setPassportUploadOpen] = useState(false);
  const [idVerificationUserDismissed, setIdVerificationUserDismissed] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [actionLoadingKey, setActionLoadingKey] = useState(null);
  const [profilePhotoEditWaitOpen, setProfilePhotoEditWaitOpen] = useState(false);
  const [profilePhotoEditWaitMessage, setProfilePhotoEditWaitMessage] = useState('');
  const [profilePhotoEditConfirmOpen, setProfilePhotoEditConfirmOpen] = useState(false);
  const [linkedInPartnerPositions, setLinkedInPartnerPositions] = useState(false);

  const idVerificationService = useMemo(
    () => verificationServices.find((service) => service.key === 'id'),
    [verificationServices]
  );
  const idVerificationStatus = idVerificationService?.status;
  const mandatoryIdentificationVerification =
    !adminCanEdit &&
    isSignupIdentificationVerificationRequired() &&
    idVerificationStatus !== 'completed';

  useEffect(() => {
    void fetchLinkedInStatus()
      .then((data) => setLinkedInPartnerPositions(Boolean(data?.partnerPositions)))
      .catch(() => setLinkedInPartnerPositions(false));
  }, []);

  useEffect(() => {
    if (location.state?.openIdentificationVerification !== true) return;
    setIdVerificationUserDismissed(false);
    setRekognitionOpen(true);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (verificationServicesLoading) return;
    if (idVerificationStatus === 'completed') {
      clearSignupIdentificationVerificationRequired();
      setIdVerificationUserDismissed(false);
      return;
    }
    if (mandatoryIdentificationVerification && !idVerificationUserDismissed) {
      setRekognitionOpen(true);
    }
  }, [
    verificationServicesLoading,
    idVerificationStatus,
    mandatoryIdentificationVerification,
    idVerificationUserDismissed
  ]);

  const loadVerificationServices = useCallback(async () => {
    setVerificationServicesLoading(true);
    try {
      const data = await fetchVetBioVerificationServices();
      setVerificationServices(Array.isArray(data?.services) ? data.services : []);
    } catch (err) {
      console.warn(
        '[SelfReportBiographyPage] verification-services load failed',
        err?.response?.data?.error || err?.message
      );
      setVerificationServices([]);
    } finally {
      setVerificationServicesLoading(false);
    }
  }, []);

  const setChannelStatus = useCallback(async (channel, status) => {
    if (!adminCanEdit) {
      throw new Error('Admin access required');
    }
    const columnMap = {
      id: 'id_verification',
      work: 'work_verification',
      education: 'education_verification',
      linkedin: 'linkedin_verification'
    };
    const column = columnMap[channel];
    if (!column) {
      throw new Error('Unknown verification channel');
    }
    const data = await patchVetBioVerificationServices({ [column]: status });
    if (Array.isArray(data?.services)) {
      setVerificationServices(data.services);
    } else {
      await loadVerificationServices();
    }
    return data;
  }, [adminCanEdit, loadVerificationServices]);

  const handleCycleVerificationStatus = useCallback(
    async (row, currentStatus) => {
      if (!row?.key) return;
      const nextStatus = cycleVerificationStatus(currentStatus);
      setVerificationStatusSavingKey(row.key);
      setVerificationStatusOverrides((prev) => ({ ...prev, [row.key]: nextStatus }));
      try {
        await setChannelStatus(row.key, nextStatus);
        setVerificationStatusOverrides((prev) => {
          const next = { ...prev };
          delete next[row.key];
          return next;
        });
      } catch (err) {
        setVerificationStatusOverrides((prev) => {
          const next = { ...prev };
          delete next[row.key];
          return next;
        });
        await themedAlert(err?.response?.data?.error || err?.message || 'Failed to save verification status');
      } finally {
        setVerificationStatusSavingKey(null);
      }
    },
    [setChannelStatus]
  );

  async function loadBioReview() {
    setBioReviewLoading(true);
    try {
      const { data } = await api.get('/api/checkr/bio-review');
      setBioReview(data || null);
    } catch (err) {
      console.warn('[SelfReportBiographyPage] bio-review load failed', err?.response?.data?.error || err?.message);
      setBioReview(null);
    } finally {
      setBioReviewLoading(false);
    }
  }

  async function refreshAll() {
    await Promise.all([loadBioReview(), loadVerificationServices()]);
  }

  useEffect(() => {
    void refreshAll();
  }, []);

  const handleProfilePhotoEdit = useCallback(async () => {
    setVerificationError('');
    try {
      const vetting = await fetchProfilePhotoVettingFromBioReview();
      const impersonating = isImpersonationSession(user);
      const gate = evaluateProfilePhotoChangeGate({
        ...vetting,
        isAdmin: impersonating,
        isImpersonation: impersonating
      });
      if (gate.action === 'blocked') {
        setProfilePhotoEditWaitMessage(formatProfilePhotoEditWaitMessage(vetting.vettedDate));
        setProfilePhotoEditWaitOpen(true);
        return;
      }
      if (gate.action === 'confirm') {
        setProfilePhotoEditConfirmOpen(true);
        return;
      }
      navigate(MY_STORY_PATH);
    } catch (err) {
      setVerificationError(err?.response?.data?.error || err?.message || 'Failed to check profile photo status');
    }
  }, [navigate, user]);

  const handleVerificationClick = useCallback(
    (key) => {
      setVerificationError('');
      // Tools-only admin (no member context): action buttons cycle channel status.
      if (toolsOnlyAdmin) {
        const row = verificationServices.find((service) => service.key === key);
        if (row) {
          void handleCycleVerificationStatus(row, verificationStatusOverrides[key] ?? row.status);
        }
        return;
      }
      if (key === 'id') {
        setIdVerificationUserDismissed(false);
        setRekognitionOpen(true);
        return;
      }
      if (key === 'work') {
        setDomainVerificationOpen(true);
        return;
      }
      if (key === 'education') {
        setAcademicRecordVerificationOpen(true);
        return;
      }
      if (key === 'linkedin') {
        setLinkedInVerificationOpen(true);
      }
    },
    [
      toolsOnlyAdmin,
      verificationServices,
      verificationStatusOverrides,
      handleCycleVerificationStatus
    ]
  );

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
          ? { width: '100%', maxWidth: '100%', boxSizing: 'border-box', p: 0, '&:last-child': { pb: 2 } }
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
            My Self-Report-Bio
          </Typography>
        </EarnTokensPageTitle>
      }
      secondary={<PageInstructionEarnTokensAction onInstructionClick={() => setInstructionOpen(true)} />}
    >
      <SelfReportBiographyInstructionPopup open={instructionOpen} onClose={() => setInstructionOpen(false)} />
      <ProfilePhotoChangeWaitDialog
        open={profilePhotoEditWaitOpen}
        onClose={() => setProfilePhotoEditWaitOpen(false)}
        message={profilePhotoEditWaitMessage}
      />
      <ProfilePhotoChangeConfirmDialog
        open={profilePhotoEditConfirmOpen}
        onClose={() => setProfilePhotoEditConfirmOpen(false)}
        message={PROFILE_PHOTO_EDIT_CONFIRM_MESSAGE}
        onConfirm={() => {
          setProfilePhotoEditConfirmOpen(false);
          navigate(MY_STORY_PATH);
        }}
      />
      <DomainVerificationPopup
        open={domainVerificationOpen}
        onClose={() => setDomainVerificationOpen(false)}
        onVerified={async () => {
          setSuccessText('');
          await refreshAll();
        }}
        onFailed={async () => {
          await setChannelStatus('work', 'error');
        }}
      />
      <AcademicRecordVerificationPopup
        open={academicRecordVerificationOpen}
        onClose={() => setAcademicRecordVerificationOpen(false)}
      />
      <LinkedInVerificationPopup
        open={linkedInVerificationOpen}
        onClose={() => setLinkedInVerificationOpen(false)}
        defaultFirstName={bioReview?.briefBio?.find((row) => row.key === 'firstname')?.response || user?.firstname || ''}
        defaultLastName={bioReview?.briefBio?.find((row) => row.key === 'lastname')?.response || user?.lastname || ''}
        defaultProfileUrl={bioReview?.fullBio?.find((row) => row.key === 'linkedin_url')?.response || ''}
        defaultJobTitle={bioReview?.fullBio?.find((row) => row.key === 'job_title')?.response || bioReview?.vetBio?.job_title || ''}
        defaultCurrentCompany={
          bioReview?.fullBio?.find((row) => row.key === 'current_company')?.response || bioReview?.vetBio?.current_company || ''
        }
        onEmploymentSaved={refreshAll}
        onVerified={async (data) => {
          setSuccessText(data?.message || 'LinkedIn Search verification complete.');
          await refreshAll();
        }}
        onFailed={async () => {
          await setChannelStatus('linkedin', 'error');
        }}
      />
      <Box sx={scrollRegionSx}>
        <Stack spacing={2} sx={mobileFullWidth ? { width: '100%', maxWidth: '100%' } : undefined}>
          <Typography sx={{ fontSize: { xs: '0.9rem', sm: getDesktopTextFontSizeVw() } }}>
            Identity verification compares your profile photo to your ID, reads name, address, and just year of birth from your ID, and confirms you
            are present with a quick liveness check. For your maximum security, we do not scan ID from driver license or passpord.  Also your government ID info is processed in memory only and is not stored on this server.  Your real name and address will never be reveal to anyone ever.
          </Typography>

          {successText ? <Alert severity="success">{successText}</Alert> : null}
          {verificationError ? (
            <Alert severity="error">{sanitizeUserFacingTechTerms(verificationError)}</Alert>
          ) : null}

          {!verificationServicesLoading ? (
            <VerificationServicesTable
              services={verificationServices}
              linkedInPartnerPositions={linkedInPartnerPositions}
              onActionClick={handleVerificationClick}
              actionLoadingKey={actionLoadingKey}
              adminCanEditStatus={adminCanEdit}
              onCycleStatus={handleCycleVerificationStatus}
              savingStatusKey={verificationStatusSavingKey}
              statusOverrides={verificationStatusOverrides}
            />
          ) : null}

          <CheckrBioReviewPanel
            bioReview={bioReview}
            loading={bioReviewLoading}
            onBioReviewSaved={refreshAll}
            showMatchNoteColumn={false}
            showLegalNameTable
            showBriefBioSectionFieldEdit={adminCanEdit}
            showFullBioSectionFieldEdit={adminCanEdit}
            canEditVettingStatus={adminCanEdit}
            onProfilePhotoEdit={() => void handleProfilePhotoEdit()}
            onPassportUploadClick={() => setPassportUploadOpen(true)}
          />

          <PassportCitizenshipUploadDialog
            open={passportUploadOpen}
            onClose={() => setPassportUploadOpen(false)}
            onComplete={async () => {
              setSuccessText('Passport citizenship and place of birth updated from your upload.');
              await refreshAll();
            }}
          />

          <RekognitionVerifyDialog
            open={rekognitionOpen}
            onClose={() => {
              setIdVerificationUserDismissed(true);
              setRekognitionOpen(false);
              void refreshAll();
            }}
            accountEmail={user?.email || ''}
            singlesId={user?.singles_id}
            onVerified={async () => {
              setSuccessText('');
              clearSignupIdentificationVerificationRequired();
              await refreshAll();
            }}
            onFailed={async () => {
              await setChannelStatus('id', 'error');
            }}
          />
        </Stack>
      </Box>
    </MainCard>
  );
}
