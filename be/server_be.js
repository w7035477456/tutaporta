import './loadEnv.js'; // load ~/.ssh/be/.env first so DB_* etc. are set regardless of cwd
import { isDuplicatePhoneAllowed } from './utils/duplicatePhonePolicy.js';
import { isBlockMobileEnabled } from './utils/blockMobileConfig.js';
import { isBypassSmsPhoneVerificationEnabled } from './utils/bypassSmsPhoneVerification.js';
import { startBlockedAsnDailyRefresh } from './utils/blockedAsnRefresh.js';
import { startBillOverdueEmailDaily } from './utils/billOverdueEmail.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import { createServer } from 'http';
import pool from './db/connection.js';
import {
  beVerifyLoginPassword,
  beLoginBypass,
  registerUser_FFFFFFFF,
  validateReferralCode,
  getAllSingles_BBBBBBBB,
  getSinglesInterested_DDDDDDD,
  getRequestsAboutMe_PPPPPPPP,
  getRequestsAboutMeSettings_RRRRRRRR,
  getRequestedSingles_TTTTTTTT,
  getRequestedSinglesPoem,
  getMyPicksList,
  getMyPicksFeed,
  getMyPicksPostNotifications,
  dismissMyPicksPostNotification,
  dismissAllMyPicksPostNotifications,
  createMyPosting,
  addMyPostingPhotos,
  updateMyPostingVisibility,
  updateMyPostingContent,
  deleteMyPosting,
  deleteMyPostingPhoto,
  getPostingComments,
  createPostingComment,
  deletePostingComment,
  togglePostingLike,
  getPostingLikes,
  toggleRequestApprovalAboutMe_QQQQQQQQ,
  toggleRequestsAboutMeRequestFlag_WWWWWWWW,
  toggleRequestBlockAboutMe_SSSSSSSS,
  toggleRequestBlockSent_UUUUUUUU,
  removeRequestedFriend,
  createPassword_GGGGGGGG,
  verifyRegistrationLink_KKKKKKKK,
  verifyRegistrationCode_VVVVVVVV,
  verifyPasswordResetLink_LLLLLLLL,
  completePasswordReset_MMMMMMMMMM,
  verifyPhone_HHHHHHHH,
  cleanupVerificationsByEmail_VVVVVVVV,
  resendPhoneCode,
  sendRegistrationSms,
  bypassSignupSmsVerification,
  getSinglesPreferences_IIIIIIII,
  updateSinglesPreferences_JJJJJJJJ,
  markInterested_MMMMMMMM,
  notInterested_NNNNNNNN,
  toggleInterestedRequestInfo_OOOOOOOO,
  getVerifySelfPhotoValue,
  saveVerifySelfRows,
  getSettingsProfile,
  updateSettingsProfile,
  getSettingsCustomLogoutDuration,
  updateSettingsCustomLogoutDuration,
  completeSettingsPayment,
  createSettingsPaypalOrder,
  captureSettingsPaypalOrder,
  purchaseRecordVaultRefill,
  purchaseRecordVaultRefill as purchasePhotoAlbumsRefill,
  getSettingsPaymentHistory,
  putAdminImpersonatedTokenBalance,
  putAdminImpersonatedVaultRefillQuota,
  postAdminSetSinglesTokenBalance,
  getPaymentBalanceNotifications,
  dismissPaymentBalanceNotification,
  dismissAllPaymentBalanceNotifications,
  getBioRequestNotifications,
  dismissBioRequestNotification,
  dismissAllBioRequestNotifications,
  getReceivedBioRequestsPendingCount,
  getVettedFriendsBioResponsePendingCount,
  dismissBioResponseNotification,
  dismissAllBioResponseNotifications,
  debitRequestedViewToken,
  changeSettingsPassword,
  sendSettingsChangePasswordSms,
  verifySettingsChangePasswordSms,
  completeSettingsChangePassword,
  sendSettingsChangeEmailSms,
  verifySettingsChangeEmailSms,
  submitSettingsChangeEmail,
  completeSettingsChangeEmail,
  changeSettingsEmail,
  changeSettingsPhone,
  submitSettingsChangePhone,
  verifySettingsChangePhoneEmailCode,
  sendSettingsChangePhoneSms,
  verifySettingsChangePhoneSms,
  sendReferralInviteEmail,
  getPromotionalMessages,
  requestSettingsEmailChange,
  verifyEmailChangeLink,
  completeEmailChange,
  upgradeLegacyPassword,
  getSendFlowerSetup,
  getSendFlowerHistory,
  getSendFlowerAuthorizeNetKey,
  placeSendFlowerOrder,
  createCheckrInvitation,
  getApprovedCheckrBioReview,
  getMemberCheckrBioReviewPreview,
  getCheckrStatus,
  getCheckrBioReview,
  saveCheckrBioReview,
  saveCheckrBioReviewField,
  saveConsentRecord,
  saveLiveFaceScanVideoConsent,
  deleteLiveFaceScanVideoConsent,
  saveSelfIntroVideoRoute,
  getSelfIntroVideoSlotsRoute,
  clearSelfIntroVideoSlotRoute,
  getConsentRecords,
  getRekognitionStatus,
  createRekognitionLivenessSession,
  getRekognitionLivenessResults,
  verifyIdentityWithRekognition,
  captureDriverLicenseFromIdImage,
  previewFaceMatchForIdImage,
  previewLiveScanProfileMatch,
  postIdVerificationManualSupportEmail,
  getMeasureOneEducationStatus,
  startMeasureOneEducationVerification,
  syncMeasureOneEducationVerification,
  simulateMeasureOneEducationVerification,
  handleMeasureOneWebhook,
  devSimulateMeasureOneVerification,
  sendDomainVerificationCode,
  verifyDomainVerificationCode,
  getVetBioVerificationServices,
  patchVetBioVerificationServices,
  postIdVerificationDateOnClose,
  postResetIdVerification
} from './routes/singles/index.js';
import { getPhoto } from './routes/photos/getPhoto.js';
import { getPhotoThumbnail } from './routes/photos/getPhotoThumbnail.js';
import { getVideo } from './routes/videos/getVideo.js';
import { getMyAlbumVideos } from './routes/videos/getMyAlbumVideos.js';
import {
  createRecordVaultNotebook,
  createRecordVaultNote,
  createRecordVaultShortcut,
  deleteRecordVaultNotebook,
  deleteRecordVaultNote,
  deleteRecordVaultShortcut,
  getRecordVaultNote,
  getRecordVaultNoteImage,
  getRecordVaultNoteExtraImage,
  uploadRecordVaultNoteExtraImage,
  deleteRecordVaultNoteExtraImage,
  getRecordVaultNoteAttachment,
  openRecordVaultNoteAttachmentNative,
  uploadRecordVaultNoteAttachment,
  deleteRecordVaultNoteAttachment,
  getRecordVaultTree,
  reorderRecordVaultNotebooks,
  reorderRecordVaultNotes,
  reorderRecordVaultShortcuts,
  searchRecordVaultNotes,
  updateRecordVaultNotebook,
  updateRecordVaultNote,
  moveRecordVaultNoteImage
} from './routes/recordVault/recordVaultRoutes.js';
import {
  changeRecordVaultAccessPassword,
  clearRecordVaultAccessFail,
  getRecordVaultAccessFailStatus,
  getRecordVaultAccessStatus,
  logoffRecordVaultAccess,
  postRecordVaultAccessFail,
  setRecordVaultAccessPassword,
  setRecordVaultAccessPasswordEnabled,
  setRecordVaultAccessPasswordHint,
  verifyRecordVaultAccess
} from './routes/recordVault/recordVaultAccessRoutes.js';
import {
  getRecordVaultE2eKeys,
  putRecordVaultE2eKeys,
  updateRecordVaultE2eKeys
} from './routes/recordVault/recordVaultE2eRoutes.js';
import {
  browseRecordVaultUsbPath,
  formatRecordVaultUsb,
  getRecordVaultUsbStatus,
  getRecordVaultUsbUnlockGuard,
  getRecordVaultUsbIconDerivedKey,
  getRecordVaultUsbVaultTree,
  downloadRecordVaultUsbBackupZip,
  restoreRecordVaultUsbBackupZip,
  initRecordVaultUsb,
  listRecordVaultUsbIcons,
  listRecordVaultUsbLocations,
  logoffRecordVaultUsb,
  scanRecordVaultUsb,
  unlockRecordVaultUsb
} from './routes/recordVault/recordVaultUsbRoutes.js';
import {
  disconnectRecordVaultOneDrive,
  downloadRecordVaultOneDriveBackupZip,
  formatRecordVaultOneDrive,
  getRecordVaultOneDriveConfig,
  getRecordVaultOneDriveEmails,
  getRecordVaultOneDriveStatus,
  getRecordVaultOneDriveVaultTree,
  getRecordVaultOneDriveUnlockGuard,
  initRecordVaultOneDrive,
  getRecordVaultOneDriveLogoffProgress,
  getRecordVaultOneDriveOpenProgress,
  getRecordVaultOneDriveSyncProgress,
  logoffRecordVaultOneDrive,
  rememberRecordVaultOneDriveEmail,
  restoreRecordVaultOneDriveBackupZip,
  syncRecordVaultOneDrive,
  testWriteRecordVaultOneDrive,
  unlockRecordVaultOneDrive
} from './routes/recordVault/recordVaultOneDriveRoutes.js';
import {
  downloadRecordVaultTutaDriveBackupZip,
  downloadRecordVaultTutaDriveStoredBackup,
  formatRecordVaultTutaDrive,
  getRecordVaultTutaDriveBackupStatus,
  getRecordVaultTutaDriveStatus,
  initRecordVaultTutaDrive,
  logoffRecordVaultTutaDrive,
  restoreRecordVaultTutaDriveBackupZip,
  storeRecordVaultTutaDriveBackup,
  unlockRecordVaultTutaDrive
} from './routes/recordVault/recordVaultTutaDriveRoutes.js';
import { getLeftSideMode, isLeftSideTutaDrive } from './utils/tutaDriveMemberPaths.js';
import { isSkipTutaPhotoEncEnabled } from './utils/skipTutaPhotoEncConfig.js';
import { getRecordVaultStorageConfig, logoffRecordVaultStorage } from './routes/recordVault/recordVaultStorageRoutes.js';
import { downloadRecordVaultBridgeInstaller } from './routes/recordVault/recordVaultBridgeInstaller.js';
import {
  getRecordVaultSessionFileCounts,
  getRecordVaultUsage,
  postRecordVaultSessionFileCounts
} from './routes/recordVault/recordVaultUsageRoutes.js';
import {
  buildVaultStorageChoice,
  isVaultLocalUsbOffered,
  isVaultOneDriveOffered
} from './utils/recordVaultStorageFlags.js';
import {
  isOneDriveVaultOAuthConfigured,
  recordVaultOneDriveOAuthCallback,
  recordVaultOneDriveOAuthStart
} from './routes/recordVault/recordVaultOneDriveOAuth.js';

// ---- Photo Albums (independent clone) ----
import {
  createPhotoAlbumsNotebook,
  createPhotoAlbumsNote,
  createPhotoAlbumsShortcut,
  deletePhotoAlbumsNotebook,
  deletePhotoAlbumsNote,
  deletePhotoAlbumsShortcut,
  getPhotoAlbumsNote,
  getPhotoAlbumsNoteImage,
  getPhotoAlbumsNoteExtraImage,
  uploadPhotoAlbumsNoteExtraImage,
  deletePhotoAlbumsNoteExtraImage,
  getPhotoAlbumsNoteAttachment,
  openPhotoAlbumsNoteAttachmentNative,
  uploadPhotoAlbumsNoteAttachment,
  deletePhotoAlbumsNoteAttachment,
  getPhotoAlbumsTree,
  reorderPhotoAlbumsNotebooks,
  reorderPhotoAlbumsNotes,
  reorderPhotoAlbumsShortcuts,
  searchPhotoAlbumsNotes,
  updatePhotoAlbumsNotebook,
  updatePhotoAlbumsNote,
  movePhotoAlbumsNoteImage
} from './routes/photoAlbums/photoAlbumsRoutes.js';
import {
  changePhotoAlbumsAccessPassword,
  clearPhotoAlbumsAccessFail,
  getPhotoAlbumsAccessFailStatus,
  getPhotoAlbumsAccessStatus,
  logoffPhotoAlbumsAccess,
  postPhotoAlbumsAccessFail,
  setPhotoAlbumsAccessPassword,
  setPhotoAlbumsAccessPasswordEnabled,
  setPhotoAlbumsAccessPasswordHint,
  verifyPhotoAlbumsAccess
} from './routes/photoAlbums/photoAlbumsAccessRoutes.js';
import {
  getPhotoAlbumsE2eKeys,
  putPhotoAlbumsE2eKeys,
  updatePhotoAlbumsE2eKeys
} from './routes/photoAlbums/photoAlbumsE2eRoutes.js';
import {
  browsePhotoAlbumsUsbPath,
  formatPhotoAlbumsUsb,
  getPhotoAlbumsUsbStatus,
  getPhotoAlbumsUsbUnlockGuard,
  getPhotoAlbumsUsbIconDerivedKey,
  getPhotoAlbumsUsbVaultTree,
  downloadPhotoAlbumsUsbBackupZip,
  restorePhotoAlbumsUsbBackupZip,
  initPhotoAlbumsUsb,
  listPhotoAlbumsUsbIcons,
  listPhotoAlbumsUsbLocations,
  logoffPhotoAlbumsUsb,
  scanPhotoAlbumsUsb,
  unlockPhotoAlbumsUsb
} from './routes/photoAlbums/photoAlbumsUsbRoutes.js';
import {
  disconnectPhotoAlbumsOneDrive,
  downloadPhotoAlbumsOneDriveBackupZip,
  formatPhotoAlbumsOneDrive,
  getPhotoAlbumsOneDriveConfig,
  getPhotoAlbumsOneDriveEmails,
  getPhotoAlbumsOneDriveStatus,
  getPhotoAlbumsOneDriveVaultTree,
  getPhotoAlbumsOneDriveUnlockGuard,
  initPhotoAlbumsOneDrive,
  getPhotoAlbumsOneDriveLogoffProgress,
  getPhotoAlbumsOneDriveOpenProgress,
  getPhotoAlbumsOneDriveSyncProgress,
  logoffPhotoAlbumsOneDrive,
  rememberPhotoAlbumsOneDriveEmail,
  restorePhotoAlbumsOneDriveBackupZip,
  syncPhotoAlbumsOneDrive,
  testWritePhotoAlbumsOneDrive,
  unlockPhotoAlbumsOneDrive
} from './routes/photoAlbums/photoAlbumsOneDriveRoutes.js';
import { getPhotoAlbumsStorageConfig, logoffPhotoAlbumsStorage } from './routes/photoAlbums/photoAlbumsStorageRoutes.js';
import {
  formatPhotoAlbumsTutaDrive,
  getPhotoAlbumsTutaDriveStatus,
  initPhotoAlbumsTutaDrive,
  logoffPhotoAlbumsTutaDrive,
  unlockPhotoAlbumsTutaDrive
} from './routes/photoAlbums/photoAlbumsTutaDriveRoutes.js';
import {
  deletePhotoAlbumsMobileUploadFile,
  getPhotoAlbumsMobileUploadFile,
  listPhotoAlbumsMobileUploadFiles
} from './routes/photoAlbums/photoAlbumsMobileUploadFolderRoutes.js';
import { downloadPhotoAlbumsBridgeInstaller } from './routes/photoAlbums/photoAlbumsBridgeInstaller.js';
import {
  acceptPhotoAlbumsInvite,
  createPhotoAlbumsInvite,
  getPhotoAlbumsSharedAlbumAttachment,
  getPhotoAlbumsSharedAlbumContent,
  listPhotoAlbumsInvites,
  listPhotoAlbumsSharedAlbums,
  previewPhotoAlbumsInvite,
  removePhotoAlbumsSharedAlbum,
  revokePhotoAlbumsInvite
} from './routes/photoAlbums/photoAlbumsInviteRoutes.js';
import {
  getPhotoAlbumsSessionFileCounts,
  getPhotoAlbumsUsage,
  postPhotoAlbumsSessionFileCounts,
  postPhotoAlbumsTransferBytes
} from './routes/photoAlbums/photoAlbumsUsageRoutes.js';
import {
  buildVaultStorageChoice as buildPhotoAlbumsStorageChoice,
  isVaultOneDriveOffered as isPhotoAlbumsOneDriveOffered
} from './utils/photoAlbumsStorageFlags.js';
import {
  isOneDriveVaultOAuthConfigured as isPhotoAlbumsOneDriveOAuthConfigured,
  photoAlbumsOneDriveOAuthCallback,
  photoAlbumsOneDriveOAuthStart
} from './routes/photoAlbums/photoAlbumsOneDriveOAuth.js';
import { clearPhotoAlbumsCacheIcon } from './utils/photoAlbumsCacheIcon.js';
import { logoffVaultUsb as logoffPhotoAlbumsUsbSession } from './utils/photoAlbumsUsb/vaultSession.js';
import { updateMyVideoType } from './routes/videos/updateMyVideoType.js';
import { clearRecordVaultCacheIcon, RECORD_VAULT_CACHE_ICON_KEY_PREFIX } from './utils/recordVaultCacheIcon.js';
import { logoffVaultUsb } from './utils/recordVaultUsb/vaultSession.js';
import { validateMediaStorage } from './utils/sharedMediaStorage.js';
import { getOneDriveStagingRootStatus } from './utils/recordVaultOneDriveStagingRoot.js';
import { deleteMyVideo } from './routes/videos/deleteMyVideo.js';
import { getAdminPhoto } from './routes/photos/getAdminPhoto.js';
import { getAdminPhotoThumbnail } from './routes/photos/getAdminPhotoThumbnail.js';
import { getAdminVideo } from './routes/videos/getAdminVideo.js';
import { getAdminVideoThumbnail, getVideoThumbnail } from './routes/videos/getVideoThumbnail.js';
import { getProfilePhoto } from './routes/photos/getProfilePhoto.js';
import { uploadPhoto } from './routes/photos/uploadPhoto.js';
import {
  postMobilePhotoUploadSession,
  getMobilePhotoUploadSessionStatus,
  getMobilePhotoUploadSessionPublic,
  getMobilePhotoUploadValidate,
  getMobilePhotoUploadPing,
  postMobilePhotoUploadViaSession,
  postMobilePhotoUploadPhotoQuery
} from './routes/photos/mobilePhotoUpload.js';
import { updateMyPhoto } from './routes/photos/updateMyPhoto.js';
import { resetMyPhotoFromOrig } from './routes/photos/resetMyPhotoFromOrig.js';
import { getUploadLimits } from './routes/photos/getUploadLimits.js';
import { getMyPhotos } from './routes/photos/getMyPhotos.js';
import { deletePhoto } from './routes/photos/deletePhoto.js';
import { setProfileImage } from './routes/photos/setProfileImage.js';
import { postGenderSelfReport, postSeedDemoBuddies } from './routes/singles/genderSelfReportRoute.js';
import { updateMyPhotoType } from './routes/photos/updateMyPhotoType.js';
import { getPublicPrivateAlbum } from './routes/photos/getPublicPrivateAlbum.js';
import { requireAuth } from './middleware/requireAuth.js';
import { enforceSingleLoginSession } from './middleware/enforceSingleLogin.js';
import {
  buildToolsOnlyAdminSessionUser,
  isToolsOnlyAdminJwt,
  requireAdminRole,
  resolveAuthUserFromJwt
} from './utils/adminAuth.js';
import { lookupSystemToolsAdminSingles } from './utils/systemToolsAdmin.js';
import { adminImpersonate, adminReturnAdmin } from './routes/admin/adminImpersonate.js';
import { attachAuthIfPresent } from './middleware/attachAuthIfPresent.js';
import { photoAlbumsTransferMeterStack } from './middleware/photoAlbumsTransferMeter.js';
import { getPublicKey } from './jwtKeys.js';
import { clearAuthCookie, getAuthTokenFromCookies, getKeepMeLoginDays } from './utils/authCookie.js';
import { getMallDepartmentMode } from './mallDepartmentMode.js';
import { ensureDemoRegularInitialSetupDone } from './utils/ensureDemoRegularInitialSetupDone.js';
import { ensureSeededDemoBuddiesOnLogin } from './utils/ensureSeededDemoBuddiesOnLogin.js';
import { closeLoginLogSession } from './utils/loginLog.js';
import appLog from './logger.js';
import { respondSessionInvalid } from './utils/sessionInvalidResponse.js';
import { buildSessionConfigResponse } from './utils/sessionTimeoutConfig.js';
import { withResolvedCustomLogoutMinutes } from './utils/customLogoutDuration.js';
import { requestPasswordReset } from './routes/requestPasswordReset.js';
import { postSupportMessage } from './routes/supportMessage.js';
import { updateAdminVetBioMatchingStatus } from './routes/adminVetBioStatus.js';
import {
  getAdminPhotoStorageDuplicates,
  getAdminPhotoStorageFile,
  getAdminPhotoStorageFiles,
  postAdminPhotoStorageRemoveDuplicates
} from './routes/adminPhotoStorage.js';
import {
  createGraphicalTestRecording,
  deleteGraphicalTestRecording,
  getGraphicalTestLogs,
  getGraphicalTestRecordingSteps,
  listGraphicalTestRecordings,
  patchGraphicalTestRecording,
  postGraphicalTestLogsReset,
  postGraphicalTestRecordingStart,
  postGraphicalTestRecordingStop,
  postGraphicalTestRecordingResetLoop,
  postGraphicalTestRunLoopComplete,
  postGraphicalTestRunStart,
  postGraphicalTestRunStop
} from './routes/adminUiTestRecordings.js';
import { getAdminStatistics } from './routes/adminStatistics.js';
import {
  getAdminTables,
  postAdminTableCascadeDelete,
  postAdminTableTruncate
} from './routes/admin/adminTables.js';
import {
  postAdminWipeBySinglesIdCascadeDelete,
  postAdminWipeBySinglesIdDelete,
  postAdminWipeBySinglesIdSearch
} from './routes/admin/adminWipeBySinglesId.js';
import {
  postAdminWipeBySinglesIdVideoDelete,
  postAdminWipeBySinglesIdVideosList
} from './routes/admin/adminWipeBySinglesIdVideos.js';
import {
  postAdminWipeBySinglesIdPhotoDelete,
  postAdminWipeBySinglesIdPhotosList
} from './routes/admin/adminWipeBySinglesIdPhotos.js';
import {
  postAdminPasswordCheck,
  postAdminPasswordCheckLookup,
  postAdminPasswordCheckSetGlobal,
  postAdminPasswordCheckSetMemberCategory,
  postAdminPasswordCheckSetSingles,
  postAdminPasswordHashPreview
} from './routes/admin/adminPasswordCheck.js';
import {
  postAdminAuditRegistrationLookup,
  postAdminCycleSinglesStatus,
  postAdminResetPasswordAttemptCount,
  postAdminSetSinglesMemberCategory,
  postAdminSetSinglesStatus,
  postAdminSinglesLookupAll
} from './routes/admin/adminAuditRegistrationLookup.js';
import {
  postAdminLoginLogLookup,
  postAdminLoginLogLookupAll
} from './routes/admin/adminLoginLogLookup.js';
import {
  deleteAdminBlockedAsnVpn,
  getAdminBlockedAsnVpn,
  getAdminBlockedAsnVpnCloudflare,
  getAdminBlockedAsnVpnGithub,
  postAdminBlockedAsnVpn,
  postAdminBlockedAsnVpnRefreshFromGithub,
  postAdminBlockedAsnVpnSyncCloudflare,
  postAdminBlockedAsnVpnSyncFromGithub,
  putAdminBlockedAsnVpn
} from './routes/admin/adminBlockedAsnVpn.js';
import { invalidateAuthUserCache } from './utils/authUserLookupCache.js';
import { getAdminPgQueryErrors, postAdminPgQueryErrorsReset } from './routes/adminPgQueryErrors.js';
import {
  isOriginAllowed,
  parseAllowedOriginPatterns,
  requireTrustedOriginFactory
} from './middleware/requireTrustedOrigin.js';
import { getUserCustomization, putUserCustomization, postLoadDefaultMusicUrls } from './routes/user/userCustomization.js';
import {
  getBpmDiagram,
  getBpmListings,
  getBpmInstances,
  getBpmPending,
  getBpmInstance,
  postBpmStart,
  postBpmComplete,
  postBpmResetAll
} from './routes/eClassifieds/bpmDemo.js';
import {
  getChatFriends,
  getChatHistory,
  getChatHistoryBatch,
  getUnreadChatMessagesHandler,
  getUnreadChatSenderCountHandler,
  markChatVisitedHandler,
  sendChatMessage
} from './routes/chat/chatWithFriends.js';
import {
  getGroupChatInviteCandidates,
  getGroupChatMessages,
  getGroupChatOverview,
  getMyGroupChat,
  getMyGroupChatMemberships,
  getPendingGroupChatInvites,
  postAcceptGroupChatInvite,
  postDeclineGroupChatInvite,
  postGroupChatInvite,
  postGroupChatMarkVisited,
  postGroupChatMessage
} from './routes/chat/groupChat.js';
import { uploadChatInlineImage, getChatInlineImage } from './routes/chat/chatImage.js';
import {
  createSpeedDateEvent,
  endSpeedDateEvent,
  getSpeedDateSession,
  getSpeedDateSignals,
  heartbeatSpeedDate,
  listSpeedDateEvents,
  nextSpeedDateRound,
  postSpeedDateInterest,
  postSpeedDateSignal,
  rsvpSpeedDateEvent,
  startSpeedDateEvent
} from './routes/speedDate/speedDateRoutes.js';
import { getMonthlyBill, putMonthlyBill } from './routes/recordVault/monthlyBillRoutes.js';
import { getYearlyBill, putYearlyBill } from './routes/recordVault/yearlyBillRoutes.js';
import { transferBillSchedule } from './routes/recordVault/billScheduleTransferRoutes.js';
import {
  postPaidRecordEnsure,
  getPaidRecord,
  putPaidRecordNotes,
  postPaidRecordAttachment,
  getPaidRecordAttachment,
  downloadPaidRecordAttachment,
  deletePaidRecordAttachment
} from './routes/recordVault/paidRecordRoutes.js';
import {
  feBeTrafficLogMiddleware,
  isFeBeTrafficLogEnabled,
  logFeBeTrafficLogStartupStatus
} from './utils/feBeTrafficLog.js';
import { initPhotoCacheStats } from './utils/photoCacheStats.js';
import { initUserActivityStatsSchema } from './utils/userActivityStats.js';
import { initUserCustomizationSchema } from './routes/user/userCustomization.js';
import { initMobilePhotoUploadSchema, setMobilePhotoUploadRedis } from './utils/mobilePhotoUploadSession.js';
import { mobilePhotoUploadTraceMiddleware } from './middleware/mobilePhotoUploadTrace.js';
import { setSingleLoginRedis, endSingleLoginSessionIfMatches } from './utils/singleLoginSession.js';
import { saveOnlineNickname } from './routes/singles/saveOnlineNickname.js';
import { saveSecretIcon, verifySecretIcon } from './routes/singles/saveSecretIcon.js';
import {
  googleSignupStart,
  googleSignupCallback,
  isGoogleSignupOAuthConfigured
} from './routes/auth/googleSignupOAuth.js';
import {
  getLinkedInStatus,
  isLinkedInOAuthConfigured,
  linkedInOAuthCallback,
  linkedInShareStart,
  linkedInVerifyStart,
  saveLinkedInProfileUrl,
  saveSelfReportedEmployment
} from './routes/singles/linkedinOAuth.js';

import cookieParser from 'cookie-parser';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number.parseInt(process.env.PORT, 10) || 40000;
const httpServer = createServer(app);
const isProduction = process.env.NODE_ENV === 'production';

// Respect HAProxy/pfSense forwarded proto/host in production.
if (isProduction) {
  app.set('trust proxy', 1);
}

// Canonical host is the apex (https://onlinemall.website). Serving the SPA on www looks up
// VITE_API_BASE_URL=https://onlinemall.website, which is a different origin — CORS then
// fails /api/health and the UI shows Service Notice (E3). Redirect www → apex instead
// of running two live hostnames (auth cookies are __Host- and cannot be shared).
app.use((req, res, next) => {
  const host = String(req.hostname || req.get('host') || '')
    .split(':')[0]
    .trim()
    .toLowerCase();
  if (host !== 'www.onlinemall.website') return next();
  res.redirect(301, `https://onlinemall.website${req.originalUrl || '/'}`);
});

function normalizeOrigin(urlLike) {
  try {
    return new URL(String(urlLike || '').trim()).origin;
  } catch {
    return '';
  }
}

function parseSimpleOriginList(raw) {
  return String(raw || '')
    .split(',')
    .map((item) => normalizeOrigin(item))
    .filter(Boolean);
}

function strictAppOriginPatterns() {
  const appOrigin = normalizeOrigin(process.env.PUBLIC_APP_URL || process.env.FRONTEND_PUBLIC_URL);
  if (!appOrigin) {
    if (!isProduction) {
      const devOrigins = parseSimpleOriginList(process.env.DEV_ALLOWED_ORIGINS);
      if (devOrigins.length > 0) return devOrigins;
      throw new Error(
        'DEV_ALLOWED_ORIGINS must be set in dev (example: http://localhost:3000,http://localhost:40000) when PUBLIC_APP_URL is missing.'
      );
    }
    throw new Error('PUBLIC_APP_URL (or FRONTEND_PUBLIC_URL) must be a valid absolute URL for strict same-origin mode.');
  }
  return [appOrigin];
}

const allowedOriginPatterns = (() => {
  const parsed = parseAllowedOriginPatterns();
  const base = parsed.length > 0 ? [...parsed] : strictAppOriginPatterns();
  // Mac/local FE (e.g. Vite :3000) may run while PUBLIC_APP_URL points at production.
  // DEV_ALLOWED_ORIGINS is merged here; do not set it on Ubuntu test / prod servers.
  for (const origin of parseSimpleOriginList(process.env.DEV_ALLOWED_ORIGINS)) {
    if (!base.includes(origin)) base.push(origin);
  }
  return base;
})();

const envFlagEnabledByDefault = (key) => String(process.env[key] ?? 'true').trim().toLowerCase() !== 'false';
/** When false: bell/list UI does not auto-sync; manual Refresh Chat/Posts still works. Does not block DB CRUD. */
const isAutoUiChatUpdateEnabled = () => envFlagEnabledByDefault('AUTO_UI_CHAT_UPDATE');
const isAutoUiPostUpdateEnabled = () => envFlagEnabledByDefault('AUTO_UI_POST_UPDATE');
const hasMacDevOrigins = parseSimpleOriginList(process.env.DEV_ALLOWED_ORIGINS).length > 0;
const loginBypassEnabled =
  String(process.env.ENABLE_LOGIN_BYPASS || '').toLowerCase() === 'true' &&
  (!isProduction || hasMacDevOrigins);

app.use(helmet({
  // Frontend bundle may include inline/eval during transitions; enable other headers now.
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  // Keep window.opener for Google OAuth popup after cross-origin redirect.
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }
}));

app.use(cors({
  origin: (origin, cb) => {
    const allowed = isOriginAllowed(origin, allowedOriginPatterns);
    cb(null, allowed ? (origin || true) : false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Allow large JSON bodies for photo upload (base64). From ~/.ssh/be/.env JSON_LIMIT_MB (default 20).
const JSON_LIMIT_MB = Math.max(1, Math.min(100, Number(process.env.JSON_LIMIT_MB) || 999));
const jsonLimitBytes = JSON_LIMIT_MB * 1024 * 1024;
console.log('[server_be] express.json body limit:', JSON_LIMIT_MB, 'MiB');
const effectiveMaxUploadMb = Math.max(0.5, Math.min(999, Number(process.env.MAX_SIZE_UPLOAD_MB) || 999));
console.log('[server_be] photo upload max size: env MAX_SIZE_UPLOAD_MB =', JSON.stringify(process.env.MAX_SIZE_UPLOAD_MB), '→ effective', effectiveMaxUploadMb, 'MiB (restart PM2 after changing ~/.ssh/be/.env)');

// ================================|| ENV DEBUG LOGS ||================================ //
// Scan-based list of env keys referenced via `process.env.X` in ./be code.
// If missing, we log NULL. For sensitive values we redact to avoid leaking secrets into PM2 logs.
const ENV_KEYS_USED_IN_BACKEND = [
  'DB_HOST',
  'DB_NAME',
  'DB_PASSWORD',
  'DB_PORT',
  'DB_USER',
  'JSON_LIMIT_MB',
  'JWT_PRIVATE_KEY_PATH',
  'JWT_PUBLIC_KEY_PATH',
  'LOCK_OUT',
  'LOGOUT_AUTO_MIN',
  'LOGOUT_AUTO_SEC',
  'LOGOUT_WARN_MIN',
  'LOGOUT_WARN_SEC',
  'MAX_SIZE_UPLOAD_MB',
  'NODE_ENV',
  'PM2_LOG_LEVEL',
  'PORT',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_ENV',
  'PRICE_PER_TOKEN',
  'PHOTO_BROWSER_CACHE_FOREVER',
  'PHOTO_BROWSER_CACHE_MAX_AGE_SEC',
  'PUBLIC_APP_URL',
  'FRONTEND_PUBLIC_URL',
  'CHECKR_API_KEY',
  'CHECKR_BASE_URL',
  'CHECKR_ENV',
  'CHECKR_PACKAGE',
  'CHECKR_NODE',
  'CHECKR_WORK_LOCATION_COUNTRY',
  'CHECKR_WORK_LOCATION_STATE',
  'CHECKR_WORK_LOCATION_CITY',
  'FE_BE_TRAFFIC_LOG',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_URL',
  'SMTP_HOST',
  'SMTP_PASS',
  'SMTP_PORT',
  'SMTP_USER',
  'AUTO_UI_CHAT_UPDATE',
  'AUTO_UI_POST_UPDATE',
  'AUTH_SESSION_MAX_AGE_MS',
  'AUTH_REMEMBER_MAX_AGE_MS',
  'KEEP_ME_LOGIN',
  'ALLOWED_ORIGINS',
  'VSINGLES_PHOTO_FOLDER',
  '__ENV_SOURCE'
];

function envValueForLog(key) {
  const raw = process.env[key];
  if (raw === undefined || raw === null || raw === '') return 'NULL';

  const s = String(raw);
  const isSensitive =
    /(PASS|PASSWORD|TOKEN|SECRET|AUTH_TOKEN|API_KEY)/i.test(key) ||
    key === 'DB_PASSWORD' ||
    key === 'SMTP_PASS' ||
    key === 'JWT_PRIVATE_KEY_PATH';

  if (isSensitive) return `(redacted; length=${s.length})`;
  // Prevent huge multiline logs (rare, but safe)
  const oneLine = s.replace(/\s+/g, ' ').trim();
  return oneLine.length > 140 ? `${oneLine.slice(0, 140)}…` : oneLine;
}

console.log('[env-debug] __ENV_SOURCE =', JSON.stringify(process.env.__ENV_SOURCE));
for (const key of ENV_KEYS_USED_IN_BACKEND) {
  // Keep the output consistent for easier grep in PM2 logs
  console.log(`[env-debug] ${key}=${envValueForLog(key)}`);
}

/** Upload trace: always console.log (not gated by PM2_LOG_LEVEL) so PM2 app-out shows the pipeline */
function uploadTrace(step, detail) {
  console.log('[upload trace]', step, detail != null ? detail : '');
}

app.use((req, res, next) => {
  if (req.method === 'POST' && req.path === '/api/myPhotos') {
    const cl = req.get('content-length');
    const n = cl ? parseInt(cl, 10) : NaN;
    uploadTrace('1-incoming', {
      path: req.path,
      contentLength: cl || '(no header)',
      approxRequestMiB: Number.isFinite(n) ? (n / (1024 * 1024)).toFixed(2) : '?',
      expressJsonLimitMiB: JSON_LIMIT_MB,
      note: 'If logs stop here, body failed before route (JSON limit, nginx client_max_body_size, or disconnect)'
    });
  }
  if (req.path.startsWith('/api/mobilePhotoUpload')) {
    const cl = req.get('content-length');
    const n = cl ? parseInt(cl, 10) : NaN;
    uploadTrace('mobile-barcode-incoming', {
      method: req.method,
      path: req.originalUrl || req.path,
      contentLength: cl || '(no header)',
      approxRequestMiB: Number.isFinite(n) ? (n / (1024 * 1024)).toFixed(2) : '?',
      contentType: String(req.get('content-type') || '').slice(0, 80) || '(none)',
      note: 'Phone QR upload — if logs stop here, body never reached route (proxy limit or disconnect)'
    });
  }
  next();
});

app.use(express.json({ limit: jsonLimitBytes }));

app.use((req, res, next) => {
  if (req.method === 'POST' && req.path === '/api/myPhotos') {
    const img = req.body?.image;
    const chars = typeof img === 'string' ? img.length : 0;
    uploadTrace('2-json-parsed', {
      hasBody: !!req.body,
      hasImageField: typeof img === 'string',
      imageStringChars: chars,
      approxDataUrlMiB: chars ? (chars / (1024 * 1024)).toFixed(2) : 0
    });
  }
  next();
});

app.use(cookieParser());
app.use(requireTrustedOriginFactory(allowedOriginPatterns));
app.use(mobilePhotoUploadTraceMiddleware());
app.use(feBeTrafficLogMiddleware());

const PHOTO_CACHE_WINDOW_MINUTES = 15;
const PHOTO_CACHE_STATS_PREFIX = `pcs:w${PHOTO_CACHE_WINDOW_MINUTES}m:`;
const PHOTO_CACHE_WINDOW_MS = PHOTO_CACHE_WINDOW_MINUTES * 60 * 1000;
const redisUrl = process.env.REDIS_URL && String(process.env.REDIS_URL).trim();
const redisHost = process.env.REDIS_HOST && String(process.env.REDIS_HOST).trim();
const redisPort = parseInt(process.env.REDIS_PORT, 10) || 6379;
const useRedis = Boolean(redisUrl || redisHost);

let redisClient = null;
initPhotoCacheStats({
  client: null,
  prefix: PHOTO_CACHE_STATS_PREFIX,
  windowMs: PHOTO_CACHE_WINDOW_MS
});
if (useRedis) {
  // Fail fast when Redis is down so API/UI do not stall on ioredis's default 20 retries.
  const redisOpts = {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy(times) {
      if (times > 10) return Math.min(times * 200, 5000);
      return Math.min(times * 100, 2000);
    }
  };
  redisClient = redisUrl
    ? new Redis(redisUrl, redisOpts)
    : new Redis({ host: redisHost || 'localhost', port: redisPort, ...redisOpts });
  let lastRedisErrLogAt = 0;
  redisClient.on('error', (err) => {
    const now = Date.now();
    if (now - lastRedisErrLogAt < 15000) return;
    lastRedisErrLogAt = now;
    console.error('[redis] connection error:', err?.message || err);
  });
  redisClient.on('connect', () => {
    console.log('[redis] connected');
  });
  initPhotoCacheStats({
    client: redisClient,
    prefix: PHOTO_CACHE_STATS_PREFIX,
    windowMs: PHOTO_CACHE_WINDOW_MS
  });
  setMobilePhotoUploadRedis(redisClient);
  setSingleLoginRedis(redisClient);
}
console.log('[startup] Redis single-login store: v1:session:{singles_id} (degrades to JWT-only when Redis unavailable)');
console.log(
  `[startup] Redis record-vault cache icons: ${RECORD_VAULT_CACHE_ICON_KEY_PREFIX}{onedrive|usb}:{singles_id} (shared across web servers; falls back to Postgres when Redis unavailable)`
);
console.log(
  '[startup] Cluster state (signup, vault unlock, OneDrive dirty/queue, transfer bytes): Redis keys v1:* (in-memory fallback when Redis unavailable)'
);
{
  const stagingStatus = getOneDriveStagingRootStatus();
  if (stagingStatus.configured) {
    console.log('[startup] OneDrive staging', {
      configured: stagingStatus.configured,
      effective: stagingStatus.effective,
      usingFallback: stagingStatus.usingFallback
    });
    if (stagingStatus.clusterMode && stagingStatus.usingFallback) {
      console.error(
        '[startup] CLUSTER_MULTI_SERVER: RECORD_VAULT_ONEDRIVE_STAGING_ROOT is set but not usable on this host'
      );
    }
  }
}
{
  const mediaCheck = validateMediaStorage();
  if (mediaCheck.ok) {
    console.log('[startup] media storage OK', {
      photoDir: mediaCheck.photoDir,
      videoDir: mediaCheck.videoDir
    });
  } else {
    console.error(
      '[startup] MEDIA STORAGE NOT USABLE — uploads will fail until this is fixed:',
      mediaCheck.issues
    );
  }
}
console.log(
  `[startup] PhotoCache: every GET /api/photo/:id logs [PhotoCache] HIT|MISS to console/PM2 (window=${PHOTO_CACHE_WINDOW_MINUTES}m; totals need Redis)`
);

// Log to PM2 at startup if Redis config is missing
console.log('[startup] Redis (REDIS_URL or REDIS_HOST) from ~/.ssh/be/.env:', useRedis ? 'set' : 'MISSING');
logFeBeTrafficLogStartupStatus();

const healthErrorE4 = {
  error: 'E4',
  errorCode: 4,
  message: 'Application encounter server error. Application halted. Our has been notified to fix the server. Please try again later. (Error code 4)'
};

const healthErrorE5 = {
  error: 'E5',
  errorCode: 5,
  message: 'Redis is not configured. Application halted. Our team has been notified to fix the server. Please try again later. (Error code 5)'
};

// Read health ping count from Redis, log it, increment by 1 and store back (so each ping increases the counter)
const REDIS_HEALTH_PING_KEY = 'health:ping_count';

async function logAndIncrementHealthPingCount(req) {
  if (!redisClient) return;
  try {
    const current = await redisClient.get(REDIS_HEALTH_PING_KEY);
    const value = current == null ? 0 : parseInt(current, 10) || 0;

    const clientIp = req && (req.ip || req.headers?.['x-forwarded-for']?.split(',')[0]?.trim()) || 'unknown';
    //appLog.info('[health] Redis health ping count:', value + ', IP: ' + clientIp);
    await redisClient.incr(REDIS_HEALTH_PING_KEY);
  } catch (err) {
    console.error('[health] Redis health ping count error:', err.message);
  }
}

// Health check for HAProxy (httpchk GET /health)
app.get('/health', async (req, res) => {
  if (!useRedis) {
    console.log('[health] REDIS_URL and REDIS_HOST missing from ~/.ssh/be/.env (E5)');
    return res.status(503).json(healthErrorE5);
  }
  await logAndIncrementHealthPingCount(req);
  res.status(200).json({ status: 'ok' });
});

// Microsoft Azure publisher domain verification (OneDrive OAuth app registration)
const microsoftIdentityAssociationPath = path.join(
  __dirname,
  '../fe/public/.well-known/microsoft-identity-association.json'
);
function sendMicrosoftIdentityAssociationFile(_req, res) {
  if (!fs.existsSync(microsoftIdentityAssociationPath)) {
    return res.status(404).type('text/plain').send('microsoft-identity-association.json not found');
  }
  res.set('Cache-Control', 'public, max-age=300');
  res.type('application/json');
  res.sendFile(microsoftIdentityAssociationPath);
}
// Azure may request either path; without .json must not fall through to SPA index.html.
app.get('/.well-known/microsoft-identity-association.json', sendMicrosoftIdentityAssociationFile);
app.get('/.well-known/microsoft-identity-association', sendMicrosoftIdentityAssociationFile);

// DB health check for frontend – verifies Redis config and DB before any API use
app.get('/api/health', async (req, res) => {
  if (!useRedis) {
    console.log('[health] REDIS_URL and REDIS_HOST missing from ~/.ssh/be/.env (E5)');
    return res.status(503).json(healthErrorE5);
  }
  await logAndIncrementHealthPingCount(req);
  try {
    await pool.query('SELECT NOW()');
    res.status(200).json({ status: 'ok', dbConnected: true });
  } catch (err) {
    console.error('Database connection check failed:', err.message);
    res.status(503).json({ error: 'E3', message: 'Database connection failed' });
  }
});

// Backend rate-limit system was removed; keep endpoint for frontend compatibility.
app.get('/api/rateLimitStatus', (_req, res) => {
  return res.json({
    enabled: false,
    message: 'Backend rate limiting is disabled and removed.',
    warnPercent: null
  });
});

// Server info: internal IP of this machine (for footer display)
function getInternalIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return null;
}
app.get('/api/serverInfo', (req, res) => {
  res.status(200).json({ internalIp: getInternalIp() || req.socket?.localAddress || '' });
});

app.get('/api/public/validateReferralCode', validateReferralCode);

// Public frontend config (safe values only)
app.get('/api/publicConfig', (_req, res) => {
  const paypalEnv = String(process.env.PAYPAL_ENV || '').trim().toLowerCase() === 'live' ? 'live' : 'sandbox';
  const newAccountSignup = ['true', '1', 'yes', 'on'].includes(
    String(process.env.NEW_ACCOUNT_SIGNUP ?? '').trim().toLowerCase()
  );
  res.status(200).json({
    googleMapsApiKey: String(process.env.VITE_GOOGLE_MAPS_API_KEY || '').trim(),
    paypalClientId: String(process.env.PAYPAL_CLIENT_ID || '').trim(),
    paypalEnv,
    paymentPricePerToken: (() => {
      const n = Number(process.env.PRICE_PER_TOKEN);
      return Number.isFinite(n) && n > 0 ? n : 1;
    })(),
    feBeTrafficLog: isFeBeTrafficLogEnabled(),
    autoUiChatUpdate: isAutoUiChatUpdateEnabled(),
    autoUiPostUpdate: isAutoUiPostUpdateEnabled(),
    newAccountSignup,
    bypassSmsPhoneVerification: isBypassSmsPhoneVerificationEnabled(),
    googleSignupEnabled: isGoogleSignupOAuthConfigured(),
    oneDriveVaultEnabled: buildVaultStorageChoice(isVaultOneDriveOffered(), isOneDriveVaultOAuthConfigured()).enabled,
    linkedInEnabled: isLinkedInOAuthConfigured(),
    blockMobile: isBlockMobileEnabled(),
    duplicatePhoneAllow: isDuplicatePhoneAllowed('AnyMember'),
    onenoteUsbUpgrade: ['true', '1', 'yes', 'on'].includes(
      String(process.env.ONENOTE_USB_UPGRADE ?? '').trim().toLowerCase()
    ),
    // TutaNotes panels: LEFT_SIDE=OneDrive|TutaDrive|None, RIGHT_SIDE=USB|None (~/.ssh/be/.env)
    leftSide: getLeftSideMode(),
    tutaDrive: isLeftSideTutaDrive(),
    rightSide: isVaultLocalUsbOffered() ? 'USB' : 'None',
    // SKIP_TUTAPHOTO_ENC — skip Full Disk Encryption for TutaPhotoAlbums only (TutaNotes always encrypts)
    skipTutaPhotoEnc: isSkipTutaPhotoEncEnabled()
  });
});

// Validation endpoint: React calls this on refresh
app.get('/api/me', async (req, res) => {
  const token = getAuthTokenFromCookies(req.cookies);
  if (!token) return res.status(401).json({ authenticated: false });

  try {
    const decoded = jwt.verify(token, getPublicKey(), { algorithms: ['RS256'] });

    if (isToolsOnlyAdminJwt(decoded)) {
      const sysRow = await lookupSystemToolsAdminSingles(pool);
      const legacyToolsOnly = Number(decoded.singles_id) === 0;
      if (!legacyToolsOnly && (!sysRow?.singles_id || Number(sysRow.singles_id) !== Number(decoded.singles_id))) {
        return res.status(401).json({ authenticated: false, sessionInvalid: true });
      }
      const user = buildToolsOnlyAdminSessionUser(decoded, sysRow);
      return res.json({
        authenticated: true,
        role: 'Admin',
        tools_only: true,
        impersonated_by_admin_id: 0,
        requiresPasswordUpgrade: false,
        user
      });
    }

    const authUser = await withResolvedCustomLogoutMinutes(await resolveAuthUserFromJwt(decoded), decoded);
    if (!authUser) {
      return respondSessionInvalid(res);
    }
    req.auth = authUser;
    const gate = await enforceSingleLoginSession(req, res, decoded);
    if (!gate.ok) {
      return res.status(gate.status).json({ authenticated: false, ...gate.body });
    }

    // Fetch fresh user data from DB
    const result = await pool.query(
      `SELECT 
        singles_id, 
        prefix,
        member_id,
        email, 
        phone,
        mailing_zip,
        profile_image_fk,
        alias,
        member_category,
        seeded_demo_buddies_boolean,
        gender_self_report
       FROM helloworldjunktest.singles 
       WHERE singles_id = $1`,
      [decoded.singles_id]
    );

    if (result.rows.length === 0) {
      return respondSessionInvalid(res);
    }

    const row = result.rows[0];
    try {
      await ensureDemoRegularInitialSetupDone(pool, row.singles_id, row.member_category);
    } catch (err) {
      console.error('[/api/me] ensureDemoRegularInitialSetupDone:', err?.message ?? err);
    }
    try {
      await ensureSeededDemoBuddiesOnLogin(pool, row.singles_id);
    } catch (err) {
      console.error('[/api/me] ensureSeededDemoBuddiesOnLogin:', err?.message ?? err);
    }
    // Re-read flags after possible seed on /api/me
    const flagsRes = await pool.query(
      `SELECT seeded_demo_buddies_boolean, gender_self_report
       FROM helloworldjunktest.singles
       WHERE singles_id = $1`,
      [row.singles_id]
    );
    const flags = flagsRes.rows[0] ?? row;
    const genderRaw = String(flags.gender_self_report ?? '')
      .trim()
      .toUpperCase();
    const user = {
      singles_id: row.singles_id,
      prefix: row.prefix,
      member_id: row.member_id,
      email: row.email,
      phone: row.phone,
      mailing_zip: row.mailing_zip,
      profile_image_fk: row.profile_image_fk,
      alias: row.alias,
      member_category: row.member_category,
      seeded_demo_buddies_boolean:
        String(flags.seeded_demo_buddies_boolean ?? '').trim().toLowerCase() === 'true' ||
        flags.seeded_demo_buddies_boolean === true,
      gender_self_report: genderRaw === 'M' || genderRaw === 'F' ? genderRaw : null,
      guest_demo_login: decoded.guest_demo_login === true
    };
    const mallDepartmentMode = getMallDepartmentMode(user.member_category);
    const role = String(decoded?.role ?? '').trim() === 'Admin' ? 'Admin' : 'user';
    const impersonatedRaw = decoded?.impersonated_by_admin_id;
    const impersonatedByAdminId =
      role === 'Admin' && impersonatedRaw != null && Number.isFinite(Number(impersonatedRaw))
        ? Math.trunc(Number(impersonatedRaw))
        : null;

    res.json({
      authenticated: true,
      role,
      impersonated_by_admin_id: impersonatedByAdminId,
      requiresPasswordUpgrade: decoded.requiresPasswordUpgrade === true,
      user: { ...user, mallDepartmentMode, role, impersonated_by_admin_id: impersonatedByAdminId }
    });
  } catch (err) {
    console.error('Auth check error:', err.message);
    res.status(401).json({ authenticated: false });
  }
});

// Logout endpoint — also nulls singles.cache_onedrive_icon / cache_usb_icon
app.post('/api/logout', async (req, res) => {
  try {
    const token = getAuthTokenFromCookies(req.cookies);
    if (token) {
      // Accept expired JWT so idle auto-logout still clears cache icons.
      const decoded = jwt.verify(token, getPublicKey(), {
        algorithms: ['RS256'],
        ignoreExpiration: true
      });
      const singlesId = Number(decoded?.singles_id);
      if (Number.isFinite(singlesId) && singlesId > 0) {
        try {
          await invalidateAuthUserCache(singlesId);
        } catch (err) {
          console.error('[logout] invalidateAuthUserCache', err?.message || err);
        }
        try {
          await endSingleLoginSessionIfMatches(singlesId, decoded?.session_id);
        } catch (err) {
          console.error('[logout] endSingleLoginSessionIfMatches', err?.message || err);
        }
        // Flush Cloud + USB vault sessions before clearing cookies (dirty DB/media).
        try {
          await logoffVaultUsb(singlesId);
        } catch (err) {
          console.error('[logout] logoffVaultUsb', err?.message || err);
        }
        try {
          await logoffPhotoAlbumsUsbSession(singlesId);
        } catch (err) {
          console.error('[logout] logoffPhotoAlbumsUsbSession', err?.message || err);
        }
        // Always clear MyNote / Photo Albums icon cache on logout / auto-logout.
        try {
          await clearRecordVaultCacheIcon(singlesId);
        } catch (err) {
          console.error('[logout] clearRecordVaultCacheIcon', err?.message || err);
        }
        try {
          await clearPhotoAlbumsCacheIcon(singlesId);
        } catch (err) {
          console.error('[logout] clearPhotoAlbumsCacheIcon', err?.message || err);
        }
      }
      try {
        const logoutReason =
          String(req.body?.reason ?? req.body?.logoutReason ?? '')
            .trim()
            .toLowerCase() === 'auto_logout'
            ? 'auto_logout'
            : 'user_logout';
        const loginLogSession = String(decoded?.login_log_session ?? '').trim();
        if (loginLogSession) {
          await closeLoginLogSession({ sessionToken: loginLogSession, reason: logoutReason });
        } else if (decoded?.guest_demo_login === true && Number.isFinite(singlesId) && singlesId > 0) {
          await closeLoginLogSession({ singlesId, reason: logoutReason, onlyDemo: true });
        }
      } catch (err) {
        console.error('[logout] closeLoginLogSession', err?.message || err);
      }
    }
  } catch (err) {
    console.error('[logout] token decode', err?.message || err);
  }
  clearAuthCookie(res);
  res.status(200).json({ message: 'Logged out' });
});

/** Clear auth cookie only — used when session already expired/superseded (do not delete active Redis session). */
app.post('/api/clearAuthCookie', (_req, res) => {
  clearAuthCookie(res);
  res.status(200).json({ ok: true });
});

app.post('/api/admin/impersonate', adminImpersonate);
app.post('/api/admin/return-admin', requireAuth, requireAdminRole, adminReturnAdmin);

app.post('/api/admin/vet-bio/matching-status', requireAuth, requireAdminRole, updateAdminVetBioMatchingStatus);
app.get('/api/admin/photo-storage/files', requireAuth, requireAdminRole, getAdminPhotoStorageFiles);
app.get('/api/admin/photo-storage/duplicates', requireAuth, requireAdminRole, getAdminPhotoStorageDuplicates);
app.get('/api/admin/photo-storage/file/:fileName', requireAuth, requireAdminRole, getAdminPhotoStorageFile);
app.post('/api/admin/photo-storage/duplicates/remove', requireAuth, requireAdminRole, postAdminPhotoStorageRemoveDuplicates);
app.get('/api/admin/pg-query-errors', requireAuth, requireAdminRole, getAdminPgQueryErrors);
app.post('/api/admin/pg-query-errors/reset', requireAuth, requireAdminRole, postAdminPgQueryErrorsReset);
app.get('/api/admin/ui-test-recordings', requireAuth, requireAdminRole, listGraphicalTestRecordings);
app.post('/api/admin/ui-test-recordings', requireAuth, requireAdminRole, createGraphicalTestRecording);
app.patch('/api/admin/ui-test-recordings/:recordingId', requireAuth, requireAdminRole, patchGraphicalTestRecording);
app.delete('/api/admin/ui-test-recordings/:recordingId', requireAuth, requireAdminRole, deleteGraphicalTestRecording);
app.post('/api/admin/ui-test-recordings/:recordingId/loop/reset', requireAuth, requireAdminRole, postGraphicalTestRecordingResetLoop);
app.get('/api/admin/ui-test-recordings/:recordingId/steps', requireAuth, requireAdminRole, getGraphicalTestRecordingSteps);
app.post('/api/admin/ui-test-recordings/:recordingId/record/start', requireAuth, requireAdminRole, postGraphicalTestRecordingStart);
app.post('/api/admin/ui-test-recordings/:recordingId/record/stop', requireAuth, requireAdminRole, postGraphicalTestRecordingStop);
app.post('/api/admin/ui-test-recordings/:recordingId/run/start', requireAuth, requireAdminRole, postGraphicalTestRunStart);
app.post('/api/admin/ui-test-recordings/:recordingId/run/stop', requireAuth, requireAdminRole, postGraphicalTestRunStop);
app.post('/api/admin/ui-test-recordings/:recordingId/run/loop-complete', requireAuth, requireAdminRole, postGraphicalTestRunLoopComplete);
app.get('/api/admin/ui-test-recordings/logs', requireAuth, requireAdminRole, getGraphicalTestLogs);
app.post('/api/admin/ui-test-recordings/logs/reset', requireAuth, requireAdminRole, postGraphicalTestLogsReset);
app.get('/api/admin/statistics', requireAuth, requireAdminRole, getAdminStatistics);
app.get('/api/admin/tables', requireAuth, requireAdminRole, getAdminTables);
app.post('/api/admin/tables/:tableKey/truncate', requireAuth, requireAdminRole, postAdminTableTruncate);
app.post('/api/admin/tables/:tableKey/cascade-delete', requireAuth, requireAdminRole, postAdminTableCascadeDelete);
app.post('/api/admin/wipe-by-singles-id/search', requireAuth, requireAdminRole, postAdminWipeBySinglesIdSearch);
app.post('/api/admin/wipe-by-singles-id/delete', requireAuth, requireAdminRole, postAdminWipeBySinglesIdDelete);
app.post(
  '/api/admin/wipe-by-singles-id/cascade-delete',
  requireAuth,
  requireAdminRole,
  postAdminWipeBySinglesIdCascadeDelete
);
app.post('/api/admin/wipe-by-singles-id/videos/list', requireAuth, requireAdminRole, postAdminWipeBySinglesIdVideosList);
app.post('/api/admin/wipe-by-singles-id/videos/delete', requireAuth, requireAdminRole, postAdminWipeBySinglesIdVideoDelete);
app.post('/api/admin/wipe-by-singles-id/photos/list', requireAuth, requireAdminRole, postAdminWipeBySinglesIdPhotosList);
app.post('/api/admin/wipe-by-singles-id/photos/delete', requireAuth, requireAdminRole, postAdminWipeBySinglesIdPhotoDelete);
app.get('/api/admin/photo/:id/thumbnail', requireAuth, requireAdminRole, getAdminPhotoThumbnail);
app.get('/api/admin/photo/:id', requireAuth, requireAdminRole, getAdminPhoto);
app.post('/api/admin/password-check', requireAuth, requireAdminRole, postAdminPasswordCheck);
app.post('/api/admin/password-check/hash', requireAuth, requireAdminRole, postAdminPasswordHashPreview);
app.post('/api/admin/password-check/lookup', requireAuth, requireAdminRole, postAdminPasswordCheckLookup);
app.post('/api/admin/password-check/singles', requireAuth, requireAdminRole, postAdminPasswordCheckSetSingles);
app.post('/api/admin/password-check/member-category', requireAuth, requireAdminRole, postAdminPasswordCheckSetMemberCategory);
app.post('/api/admin/password-check/global', requireAuth, requireAdminRole, postAdminPasswordCheckSetGlobal);
app.post('/api/admin/audit-registrations/lookup', requireAuth, requireAdminRole, postAdminAuditRegistrationLookup);
app.post('/api/admin/login-log/lookup', requireAuth, requireAdminRole, postAdminLoginLogLookup);
app.post('/api/admin/login-log/lookup-all', requireAuth, requireAdminRole, postAdminLoginLogLookupAll);
app.post('/api/admin/singles/lookup-all', requireAuth, requireAdminRole, postAdminSinglesLookupAll);
app.post('/api/admin/singles/cycle-status', requireAuth, requireAdminRole, postAdminCycleSinglesStatus);
app.post('/api/admin/singles/set-status', requireAuth, requireAdminRole, postAdminSetSinglesStatus);
app.post('/api/admin/singles/set-member-category', requireAuth, requireAdminRole, postAdminSetSinglesMemberCategory);
app.post('/api/admin/singles/set-token-balance', requireAuth, requireAdminRole, postAdminSetSinglesTokenBalance);
app.post('/api/admin/singles/reset-password-attempt-count', requireAuth, requireAdminRole, postAdminResetPasswordAttemptCount);
app.get('/api/admin/blocked-asn-vpn', requireAuth, requireAdminRole, getAdminBlockedAsnVpn);
app.get('/api/admin/video/:id', requireAuth, requireAdminRole, getAdminVideo);
app.get('/api/admin/video/:id/thumbnail', requireAuth, requireAdminRole, getAdminVideoThumbnail);
app.get('/api/admin/blocked-asn-vpn/github', requireAuth, requireAdminRole, getAdminBlockedAsnVpnGithub);
app.get('/api/admin/blocked-asn-vpn/cloudflare', requireAuth, requireAdminRole, getAdminBlockedAsnVpnCloudflare);
app.put('/api/admin/blocked-asn-vpn', requireAuth, requireAdminRole, putAdminBlockedAsnVpn);
app.post('/api/admin/blocked-asn-vpn', requireAuth, requireAdminRole, postAdminBlockedAsnVpn);
app.delete('/api/admin/blocked-asn-vpn', requireAuth, requireAdminRole, deleteAdminBlockedAsnVpn);
app.post(
  '/api/admin/blocked-asn-vpn/sync-from-github',
  requireAuth,
  requireAdminRole,
  postAdminBlockedAsnVpnSyncFromGithub
);
app.post(
  '/api/admin/blocked-asn-vpn/refresh-from-github',
  requireAuth,
  requireAdminRole,
  postAdminBlockedAsnVpnRefreshFromGithub
);
app.post(
  '/api/admin/blocked-asn-vpn/sync-cloudflare',
  requireAuth,
  requireAdminRole,
  postAdminBlockedAsnVpnSyncCloudflare
);

// Session timeout: custom_logout_duration main header countdown + LOGOUT_WARN_MIN popup.
app.get('/api/sessionConfig', attachAuthIfPresent, async (req, res) => {
  try {
    return res.json({
      ...(await buildSessionConfigResponse({ singlesId: req.auth?.singles_id })),
      keepMeLoginDays: getKeepMeLoginDays()
    });
  } catch (err) {
    console.error('[sessionConfig]', err?.message ?? err);
    return res.json({
      ...(await buildSessionConfigResponse()),
      keepMeLoginDays: getKeepMeLoginDays()
    });
  }
});

// API routes
if (loginBypassEnabled) {
  app.get('/api/loginBypass', beLoginBypass);
} else {
  app.get('/api/loginBypass', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
}
app.post('/api/verifyPassword', beVerifyLoginPassword);
app.post('/api/requestPasswordReset', requestPasswordReset);
app.post('/api/supportMessage', postSupportMessage);
app.get('/api/auth/google/signup/start', googleSignupStart);
app.get('/api/auth/google/signup/callback', googleSignupCallback);
app.get('/api/auth/linkedin/verify/start', requireAuth, linkedInVerifyStart);
app.get('/api/auth/linkedin/share/start', requireAuth, linkedInShareStart);
app.get('/api/auth/linkedin/callback', linkedInOAuthCallback);
app.get('/api/linkedin/status', requireAuth, getLinkedInStatus);
app.post('/api/linkedin/save-url', requireAuth, saveLinkedInProfileUrl);
app.post('/api/linkedin/save-employment', requireAuth, saveSelfReportedEmployment);
app.post('/api/register', registerUser_FFFFFFFF);
app.get('/api/verifyRegistrationLink', verifyRegistrationLink_KKKKKKKK);
app.post('/api/verifyRegistrationCode', verifyRegistrationCode_VVVVVVVV);
app.get('/api/verifyPasswordResetLink', verifyPasswordResetLink_LLLLLLLL);
app.post('/api/completePasswordReset', completePasswordReset_MMMMMMMMMM);
app.post('/api/createPassword', createPassword_GGGGGGGG);
app.post('/api/verifyPhone', verifyPhone_HHHHHHHH);
app.post('/api/cleanupVerificationsByEmail', cleanupVerificationsByEmail_VVVVVVVV);
app.post('/api/resendPhoneCode', resendPhoneCode);
app.post('/api/sendRegistrationSms', sendRegistrationSms);
app.post('/api/signup/bypass-sms-phone-verification', bypassSignupSmsVerification);
app.get('/api/allSingles', requireAuth, getAllSingles_BBBBBBBB);
app.post('/api/markInterested', requireAuth, markInterested_MMMMMMMM);
app.post('/api/notInterested', requireAuth, notInterested_NNNNNNNN);
app.post('/api/interested/requestInfo', requireAuth, toggleInterestedRequestInfo_OOOOOOOO);
app.get('/api/interestedSingles', requireAuth, getSinglesInterested_DDDDDDD);
app.get('/api/myPicks/list', requireAuth, getMyPicksList);
app.get('/api/myPicks/feed/:targetSinglesId', requireAuth, getMyPicksFeed);
app.get('/api/myPicks/notifications', requireAuth, getMyPicksPostNotifications);
app.post('/api/myPicks/notifications/dismiss', requireAuth, dismissMyPicksPostNotification);
app.post('/api/myPicks/notifications/dismissAll', requireAuth, dismissAllMyPicksPostNotifications);
app.get('/api/bioRequests/notifications', requireAuth, getBioRequestNotifications);
app.get('/api/bioRequests/pendingCount', requireAuth, getReceivedBioRequestsPendingCount);
app.post('/api/bioRequests/notifications/dismiss', requireAuth, dismissBioRequestNotification);
app.post('/api/bioRequests/notifications/dismissAll', requireAuth, dismissAllBioRequestNotifications);
app.get('/api/bioResponses/pendingCount', requireAuth, getVettedFriendsBioResponsePendingCount);
app.post('/api/bioResponses/notifications/dismiss', requireAuth, dismissBioResponseNotification);
app.post('/api/bioResponses/notifications/dismissAll', requireAuth, dismissAllBioResponseNotifications);
app.post('/api/myPicks/posting', requireAuth, createMyPosting);
app.post('/api/myPicks/posting/:postId/photos', requireAuth, addMyPostingPhotos);
app.patch('/api/myPicks/posting/:postId/visibility', requireAuth, updateMyPostingVisibility);
app.patch('/api/myPicks/posting/:postId/content', requireAuth, updateMyPostingContent);
app.delete('/api/myPicks/posting/:postId', requireAuth, deleteMyPosting);
app.delete('/api/myPicks/postingPhoto/:photoId', requireAuth, deleteMyPostingPhoto);
app.get('/api/myPicks/posting/:postId/comments', requireAuth, getPostingComments);
app.post('/api/myPicks/postingPhoto/:photoId/comments', requireAuth, createPostingComment);
app.delete('/api/myPicks/postingComments/:commentId', requireAuth, deletePostingComment);
app.post('/api/myPicks/posting/:postId/like', requireAuth, togglePostingLike);
app.get('/api/myPicks/posting/:postId/likes', requireAuth, getPostingLikes);
app.get('/api/requestsAboutMe', requireAuth, getRequestsAboutMe_PPPPPPPP);
app.get('/api/requestsAboutMe/settings', requireAuth, getRequestsAboutMeSettings_RRRRRRRR);
app.get('/api/requestedSingles', requireAuth, getRequestedSingles_TTTTTTTT);
app.get('/api/requestedSingles/poem', requireAuth, getRequestedSinglesPoem);
app.post('/api/requestedSingles/block', requireAuth, toggleRequestBlockSent_UUUUUUUU);
app.post('/api/requestedSingles/remove', requireAuth, removeRequestedFriend);
app.post('/api/requestsAboutMe/approval', requireAuth, toggleRequestApprovalAboutMe_QQQQQQQQ);
app.post('/api/requestsAboutMe/requestFlag', requireAuth, toggleRequestsAboutMeRequestFlag_WWWWWWWW);
app.post('/api/requestsAboutMe/block', requireAuth, toggleRequestBlockAboutMe_SSSSSSSS);
app.get('/api/photo/:id/thumbnail', requireAuth, getPhotoThumbnail);
app.get('/api/photo/:id', requireAuth, getPhoto);
app.get('/api/video/:id', requireAuth, getVideo);
app.get('/api/video/:id/thumbnail', requireAuth, getVideoThumbnail);
app.get('/api/myAlbumVideos', requireAuth, getMyAlbumVideos);
app.patch('/api/myVideos/:id/type', requireAuth, updateMyVideoType);
app.delete('/api/myVideos/:id', requireAuth, deleteMyVideo);
app.get('/api/recordVault', requireAuth, getRecordVaultTree);
app.get('/api/recordVault/search', requireAuth, searchRecordVaultNotes);
app.post('/api/recordVault/notebooks', requireAuth, createRecordVaultNotebook);
app.put('/api/recordVault/notebooks/reorder', requireAuth, reorderRecordVaultNotebooks);
app.patch('/api/recordVault/notebooks/:notebookId', requireAuth, updateRecordVaultNotebook);
app.delete('/api/recordVault/notebooks/:notebookId', requireAuth, deleteRecordVaultNotebook);
app.post('/api/recordVault/notebooks/:notebookId/notes', requireAuth, createRecordVaultNote);
app.put('/api/recordVault/notebooks/:notebookId/notes/reorder', requireAuth, reorderRecordVaultNotes);
app.get('/api/recordVault/notes/:noteId', requireAuth, getRecordVaultNote);
app.patch('/api/recordVault/notes/:noteId', requireAuth, updateRecordVaultNote);
app.post('/api/recordVault/notes/move-image', requireAuth, moveRecordVaultNoteImage);
app.delete('/api/recordVault/notes/:noteId', requireAuth, deleteRecordVaultNote);
app.get('/api/recordVault/notes/:noteId/image/top', requireAuth, getRecordVaultNoteImage);
app.get('/api/recordVault/notes/:noteId/image/bottom', requireAuth, getRecordVaultNoteImage);
app.get('/api/recordVault/notes/:noteId/image', requireAuth, getRecordVaultNoteImage);
app.get('/api/recordVault/notes/:noteId/extra-images/:imageId', requireAuth, getRecordVaultNoteExtraImage);
app.post('/api/recordVault/notes/:noteId/extra-images', requireAuth, uploadRecordVaultNoteExtraImage);
app.delete('/api/recordVault/notes/:noteId/extra-images/:imageId', requireAuth, deleteRecordVaultNoteExtraImage);
app.get('/api/recordVault/notes/:noteId/attachments/:attachmentId', requireAuth, getRecordVaultNoteAttachment);
app.post(
  '/api/recordVault/notes/:noteId/attachments/:attachmentId/open-native',
  requireAuth,
  openRecordVaultNoteAttachmentNative
);
app.post('/api/recordVault/notes/:noteId/attachments', requireAuth, uploadRecordVaultNoteAttachment);
app.delete('/api/recordVault/notes/:noteId/attachments/:attachmentId', requireAuth, deleteRecordVaultNoteAttachment);
app.post('/api/recordVault/shortcuts', requireAuth, createRecordVaultShortcut);
app.put('/api/recordVault/shortcuts/reorder', requireAuth, reorderRecordVaultShortcuts);
app.delete('/api/recordVault/shortcuts/:shortcutId', requireAuth, deleteRecordVaultShortcut);
app.get('/api/recordVault/access/status', requireAuth, getRecordVaultAccessStatus);
app.get('/api/recordVault/access/fail-status', requireAuth, getRecordVaultAccessFailStatus);
app.post('/api/recordVault/access/fail', requireAuth, postRecordVaultAccessFail);
app.post('/api/recordVault/access/fail/clear', requireAuth, clearRecordVaultAccessFail);
app.post('/api/recordVault/access/verify', requireAuth, verifyRecordVaultAccess);
app.post('/api/recordVault/access/set', requireAuth, setRecordVaultAccessPassword);
app.post('/api/recordVault/access/change', requireAuth, changeRecordVaultAccessPassword);
app.post('/api/recordVault/access/logoff', requireAuth, logoffRecordVaultAccess);
app.post('/api/recordVault/access/enabled', requireAuth, setRecordVaultAccessPasswordEnabled);
app.post('/api/recordVault/access/hint', requireAuth, setRecordVaultAccessPasswordHint);
app.get('/api/recordVault/e2e/keys', requireAuth, getRecordVaultE2eKeys);
app.post('/api/recordVault/e2e/keys', requireAuth, putRecordVaultE2eKeys);
app.put('/api/recordVault/e2e/keys', requireAuth, updateRecordVaultE2eKeys);
app.get('/api/recordVault/usb/unlock-guard', requireAuth, getRecordVaultUsbUnlockGuard);
app.get('/api/recordVault/usb/icons', requireAuth, listRecordVaultUsbIcons);
app.get('/api/recordVault/usb/scan', requireAuth, scanRecordVaultUsb);
app.get('/api/recordVault/usb/locations', requireAuth, listRecordVaultUsbLocations);
app.get('/api/recordVault/usb/browse', requireAuth, browseRecordVaultUsbPath);
app.get('/api/recordVault/usb/vault-tree', requireAuth, getRecordVaultUsbVaultTree);
app.get('/api/recordVault/usb/backup-zip', requireAuth, downloadRecordVaultUsbBackupZip);
app.post('/api/recordVault/usb/restore-zip', requireAuth, restoreRecordVaultUsbBackupZip);
app.get('/api/recordVault/usb/status', requireAuth, getRecordVaultUsbStatus);
app.post('/api/recordVault/usb/unlock', requireAuth, unlockRecordVaultUsb);
app.post('/api/recordVault/usb/icon-derived-key', requireAuth, getRecordVaultUsbIconDerivedKey);
app.post('/api/recordVault/usb/logoff', requireAuth, logoffRecordVaultUsb);
app.post('/api/recordVault/usb/init', requireAuth, initRecordVaultUsb);
app.post('/api/recordVault/usb/format', requireAuth, formatRecordVaultUsb);
app.get('/api/recordVault/storage/config', requireAuth, getRecordVaultStorageConfig);
app.get('/api/recordVault/bridge/installer/:platform', requireAuth, downloadRecordVaultBridgeInstaller);
app.post('/api/recordVault/storage/logoff', requireAuth, logoffRecordVaultStorage);
app.get('/api/recordVault/usage', requireAuth, getRecordVaultUsage);
app.get('/api/recordVault/session-file-counts', requireAuth, getRecordVaultSessionFileCounts);
app.post('/api/recordVault/session-file-counts', requireAuth, postRecordVaultSessionFileCounts);
app.get('/api/recordVault/onedrive/config', requireAuth, getRecordVaultOneDriveConfig);
app.get('/api/recordVault/onedrive/status', requireAuth, getRecordVaultOneDriveStatus);
app.get('/api/recordVault/onedrive/vault-tree', requireAuth, getRecordVaultOneDriveVaultTree);
app.get('/api/recordVault/onedrive/backup-zip', requireAuth, downloadRecordVaultOneDriveBackupZip);
app.get('/api/recordVault/onedrive/emails', requireAuth, getRecordVaultOneDriveEmails);
app.post('/api/recordVault/onedrive/emails', requireAuth, rememberRecordVaultOneDriveEmail);
app.get('/api/recordVault/onedrive/oauth/start', requireAuth, recordVaultOneDriveOAuthStart);
app.get('/api/recordVault/onedrive/oauth/callback', recordVaultOneDriveOAuthCallback);
app.post('/api/recordVault/onedrive/disconnect', requireAuth, disconnectRecordVaultOneDrive);
app.get('/api/recordVault/onedrive/unlock-guard', requireAuth, getRecordVaultOneDriveUnlockGuard);
app.post('/api/recordVault/onedrive/unlock', requireAuth, unlockRecordVaultOneDrive);
app.get('/api/recordVault/onedrive/open-progress', requireAuth, getRecordVaultOneDriveOpenProgress);
app.get('/api/recordVault/onedrive/sync-progress', requireAuth, getRecordVaultOneDriveSyncProgress);
app.post('/api/recordVault/onedrive/logoff', requireAuth, logoffRecordVaultOneDrive);
app.get('/api/recordVault/onedrive/logoff-progress', requireAuth, getRecordVaultOneDriveLogoffProgress);
app.post('/api/recordVault/onedrive/sync', requireAuth, syncRecordVaultOneDrive);
app.post('/api/recordVault/onedrive/init', requireAuth, initRecordVaultOneDrive);
app.post('/api/recordVault/onedrive/format', requireAuth, formatRecordVaultOneDrive);
app.post('/api/recordVault/onedrive/test-write', requireAuth, testWriteRecordVaultOneDrive);
app.post('/api/recordVault/onedrive/restore-zip', requireAuth, restoreRecordVaultOneDriveBackupZip);

app.get('/api/recordVault/tutadrive/status', requireAuth, getRecordVaultTutaDriveStatus);
app.post('/api/recordVault/tutadrive/unlock', requireAuth, unlockRecordVaultTutaDrive);
app.post('/api/recordVault/tutadrive/init', requireAuth, initRecordVaultTutaDrive);
app.post('/api/recordVault/tutadrive/format', requireAuth, formatRecordVaultTutaDrive);
app.post('/api/recordVault/tutadrive/logoff', requireAuth, logoffRecordVaultTutaDrive);
app.get('/api/recordVault/tutadrive/backup-zip', requireAuth, downloadRecordVaultTutaDriveBackupZip);
app.post('/api/recordVault/tutadrive/backup', requireAuth, storeRecordVaultTutaDriveBackup);
app.get('/api/recordVault/tutadrive/backup', requireAuth, downloadRecordVaultTutaDriveStoredBackup);
app.get('/api/recordVault/tutadrive/backup/status', requireAuth, getRecordVaultTutaDriveBackupStatus);
app.post('/api/recordVault/tutadrive/restore-zip', requireAuth, restoreRecordVaultTutaDriveBackupZip);

// ---- Photo Albums API (independent clone of Record Vault / Notes) ----
app.use('/api/photoAlbums', ...photoAlbumsTransferMeterStack);
app.get('/api/photoAlbums', requireAuth, getPhotoAlbumsTree);
app.get('/api/photoAlbums/search', requireAuth, searchPhotoAlbumsNotes);
app.post('/api/photoAlbums/notebooks', requireAuth, createPhotoAlbumsNotebook);
app.put('/api/photoAlbums/notebooks/reorder', requireAuth, reorderPhotoAlbumsNotebooks);
app.patch('/api/photoAlbums/notebooks/:notebookId', requireAuth, updatePhotoAlbumsNotebook);
app.delete('/api/photoAlbums/notebooks/:notebookId', requireAuth, deletePhotoAlbumsNotebook);
app.post('/api/photoAlbums/notebooks/:notebookId/notes', requireAuth, createPhotoAlbumsNote);
app.put('/api/photoAlbums/notebooks/:notebookId/notes/reorder', requireAuth, reorderPhotoAlbumsNotes);
app.get('/api/photoAlbums/notes/:noteId', requireAuth, getPhotoAlbumsNote);
app.patch('/api/photoAlbums/notes/:noteId', requireAuth, updatePhotoAlbumsNote);
app.post('/api/photoAlbums/notes/move-image', requireAuth, movePhotoAlbumsNoteImage);
app.delete('/api/photoAlbums/notes/:noteId', requireAuth, deletePhotoAlbumsNote);
app.get('/api/photoAlbums/notes/:noteId/image/top', requireAuth, getPhotoAlbumsNoteImage);
app.get('/api/photoAlbums/notes/:noteId/image/bottom', requireAuth, getPhotoAlbumsNoteImage);
app.get('/api/photoAlbums/notes/:noteId/image', requireAuth, getPhotoAlbumsNoteImage);
app.get('/api/photoAlbums/notes/:noteId/extra-images/:imageId', requireAuth, getPhotoAlbumsNoteExtraImage);
app.post('/api/photoAlbums/notes/:noteId/extra-images', requireAuth, uploadPhotoAlbumsNoteExtraImage);
app.delete('/api/photoAlbums/notes/:noteId/extra-images/:imageId', requireAuth, deletePhotoAlbumsNoteExtraImage);
app.get('/api/photoAlbums/notes/:noteId/attachments/:attachmentId', requireAuth, getPhotoAlbumsNoteAttachment);
app.post(
  '/api/photoAlbums/notes/:noteId/attachments/:attachmentId/open-native',
  requireAuth,
  openPhotoAlbumsNoteAttachmentNative
);
app.post('/api/photoAlbums/notes/:noteId/attachments', requireAuth, uploadPhotoAlbumsNoteAttachment);
app.delete('/api/photoAlbums/notes/:noteId/attachments/:attachmentId', requireAuth, deletePhotoAlbumsNoteAttachment);
app.post('/api/photoAlbums/shortcuts', requireAuth, createPhotoAlbumsShortcut);
app.put('/api/photoAlbums/shortcuts/reorder', requireAuth, reorderPhotoAlbumsShortcuts);
app.delete('/api/photoAlbums/shortcuts/:shortcutId', requireAuth, deletePhotoAlbumsShortcut);
app.get('/api/photoAlbums/access/status', requireAuth, getPhotoAlbumsAccessStatus);
app.get('/api/photoAlbums/access/fail-status', requireAuth, getPhotoAlbumsAccessFailStatus);
app.post('/api/photoAlbums/access/fail', requireAuth, postPhotoAlbumsAccessFail);
app.post('/api/photoAlbums/access/fail/clear', requireAuth, clearPhotoAlbumsAccessFail);
app.post('/api/photoAlbums/access/verify', requireAuth, verifyPhotoAlbumsAccess);
app.post('/api/photoAlbums/access/set', requireAuth, setPhotoAlbumsAccessPassword);
app.post('/api/photoAlbums/access/change', requireAuth, changePhotoAlbumsAccessPassword);
app.post('/api/photoAlbums/access/logoff', requireAuth, logoffPhotoAlbumsAccess);
app.post('/api/photoAlbums/access/enabled', requireAuth, setPhotoAlbumsAccessPasswordEnabled);
app.post('/api/photoAlbums/access/hint', requireAuth, setPhotoAlbumsAccessPasswordHint);
app.get('/api/photoAlbums/e2e/keys', requireAuth, getPhotoAlbumsE2eKeys);
app.post('/api/photoAlbums/e2e/keys', requireAuth, putPhotoAlbumsE2eKeys);
app.put('/api/photoAlbums/e2e/keys', requireAuth, updatePhotoAlbumsE2eKeys);
app.get('/api/photoAlbums/usb/unlock-guard', requireAuth, getPhotoAlbumsUsbUnlockGuard);
app.get('/api/photoAlbums/usb/icons', requireAuth, listPhotoAlbumsUsbIcons);
app.get('/api/photoAlbums/usb/scan', requireAuth, scanPhotoAlbumsUsb);
app.get('/api/photoAlbums/usb/locations', requireAuth, listPhotoAlbumsUsbLocations);
app.get('/api/photoAlbums/usb/browse', requireAuth, browsePhotoAlbumsUsbPath);
app.get('/api/photoAlbums/usb/vault-tree', requireAuth, getPhotoAlbumsUsbVaultTree);
app.get('/api/photoAlbums/usb/backup-zip', requireAuth, downloadPhotoAlbumsUsbBackupZip);
app.post('/api/photoAlbums/usb/restore-zip', requireAuth, restorePhotoAlbumsUsbBackupZip);
app.get('/api/photoAlbums/usb/status', requireAuth, getPhotoAlbumsUsbStatus);
app.post('/api/photoAlbums/usb/unlock', requireAuth, unlockPhotoAlbumsUsb);
app.post('/api/photoAlbums/usb/icon-derived-key', requireAuth, getPhotoAlbumsUsbIconDerivedKey);
app.post('/api/photoAlbums/usb/logoff', requireAuth, logoffPhotoAlbumsUsb);
app.post('/api/photoAlbums/usb/init', requireAuth, initPhotoAlbumsUsb);
app.post('/api/photoAlbums/usb/format', requireAuth, formatPhotoAlbumsUsb);
app.get('/api/photoAlbums/storage/config', requireAuth, getPhotoAlbumsStorageConfig);
app.get('/api/photoAlbums/tutadrive/status', requireAuth, getPhotoAlbumsTutaDriveStatus);
app.post('/api/photoAlbums/tutadrive/unlock', requireAuth, unlockPhotoAlbumsTutaDrive);
app.post('/api/photoAlbums/tutadrive/init', requireAuth, initPhotoAlbumsTutaDrive);
app.post('/api/photoAlbums/tutadrive/format', requireAuth, formatPhotoAlbumsTutaDrive);
app.post('/api/photoAlbums/tutadrive/logoff', requireAuth, logoffPhotoAlbumsTutaDrive);
app.get('/api/photoAlbums/mobile-upload/files', requireAuth, listPhotoAlbumsMobileUploadFiles);
app.get('/api/photoAlbums/mobile-upload/files/:fileName', requireAuth, getPhotoAlbumsMobileUploadFile);
app.delete('/api/photoAlbums/mobile-upload/files/:fileName', requireAuth, deletePhotoAlbumsMobileUploadFile);
app.get('/api/photoAlbums/bridge/installer/:platform', requireAuth, downloadPhotoAlbumsBridgeInstaller);
app.post('/api/photoAlbums/storage/logoff', requireAuth, logoffPhotoAlbumsStorage);
app.get('/api/photoAlbums/usage', requireAuth, getPhotoAlbumsUsage);
app.post('/api/photoAlbums/transfer-bytes', requireAuth, postPhotoAlbumsTransferBytes);
app.get('/api/photoAlbums/session-file-counts', requireAuth, getPhotoAlbumsSessionFileCounts);
app.post('/api/photoAlbums/session-file-counts', requireAuth, postPhotoAlbumsSessionFileCounts);
app.get('/api/photoAlbums/onedrive/config', requireAuth, getPhotoAlbumsOneDriveConfig);
app.get('/api/photoAlbums/onedrive/status', requireAuth, getPhotoAlbumsOneDriveStatus);
app.get('/api/photoAlbums/onedrive/vault-tree', requireAuth, getPhotoAlbumsOneDriveVaultTree);
app.get('/api/photoAlbums/onedrive/backup-zip', requireAuth, downloadPhotoAlbumsOneDriveBackupZip);
app.get('/api/photoAlbums/onedrive/emails', requireAuth, getPhotoAlbumsOneDriveEmails);
app.post('/api/photoAlbums/onedrive/emails', requireAuth, rememberPhotoAlbumsOneDriveEmail);
app.get('/api/photoAlbums/onedrive/oauth/start', requireAuth, photoAlbumsOneDriveOAuthStart);
app.get('/api/photoAlbums/onedrive/oauth/callback', photoAlbumsOneDriveOAuthCallback);
app.post('/api/photoAlbums/onedrive/disconnect', requireAuth, disconnectPhotoAlbumsOneDrive);
app.get('/api/photoAlbums/onedrive/unlock-guard', requireAuth, getPhotoAlbumsOneDriveUnlockGuard);
app.post('/api/photoAlbums/onedrive/unlock', requireAuth, unlockPhotoAlbumsOneDrive);
app.get('/api/photoAlbums/onedrive/open-progress', requireAuth, getPhotoAlbumsOneDriveOpenProgress);
app.get('/api/photoAlbums/onedrive/sync-progress', requireAuth, getPhotoAlbumsOneDriveSyncProgress);
app.post('/api/photoAlbums/onedrive/logoff', requireAuth, logoffPhotoAlbumsOneDrive);
app.get('/api/photoAlbums/onedrive/logoff-progress', requireAuth, getPhotoAlbumsOneDriveLogoffProgress);
app.post('/api/photoAlbums/onedrive/sync', requireAuth, syncPhotoAlbumsOneDrive);
app.post('/api/photoAlbums/onedrive/init', requireAuth, initPhotoAlbumsOneDrive);
app.post('/api/photoAlbums/onedrive/format', requireAuth, formatPhotoAlbumsOneDrive);
app.post('/api/photoAlbums/onedrive/test-write', requireAuth, testWritePhotoAlbumsOneDrive);
app.post('/api/photoAlbums/onedrive/restore-zip', requireAuth, restorePhotoAlbumsOneDriveBackupZip);

app.get('/api/publicPrivateAlbum/:targetSinglesId', requireAuth, getPublicPrivateAlbum);
app.get('/api/profile-photo/:singlesId', requireAuth, getProfilePhoto);
app.get('/api/myPhotos', requireAuth, getMyPhotos);
app.get('/api/myPhotos/uploadLimits', requireAuth, getUploadLimits);
app.post('/api/myPhotos', requireAuth, uploadPhoto);
app.post('/api/mobilePhotoUpload/session', requireAuth, postMobilePhotoUploadSession);
app.get('/api/mobilePhotoUpload/session/:token/status', requireAuth, getMobilePhotoUploadSessionStatus);
app.get('/api/mobilePhotoUpload/ping', getMobilePhotoUploadPing);
app.get('/api/mobilePhotoUpload/validate', getMobilePhotoUploadValidate);
app.post('/api/mobilePhotoUpload/photo', postMobilePhotoUploadPhotoQuery);
app.get('/api/mobilePhotoUpload/session/:token', getMobilePhotoUploadSessionPublic);
app.post('/api/mobilePhotoUpload/session/:token/photo', postMobilePhotoUploadViaSession);
app.put('/api/myPhotos/:id', requireAuth, updateMyPhoto);
app.patch('/api/myPhotos/:id/type', requireAuth, updateMyPhotoType);
app.post('/api/myPhotos/:id/resetOriginal', requireAuth, resetMyPhotoFromOrig);
app.delete('/api/myPhotos/:id', requireAuth, deletePhoto);
app.post('/api/profilePhoto', requireAuth, setProfileImage);
app.post('/api/singles/gender-self-report', requireAuth, postGenderSelfReport);
app.post('/api/singles/seed-demo-buddies', requireAuth, postSeedDemoBuddies);
app.get('/api/singlesPreferences', requireAuth, getSinglesPreferences_IIIIIIII);
app.post('/api/singlesPreferences', requireAuth, updateSinglesPreferences_JJJJJJJJ);
app.get('/api/verifyself/photo', requireAuth, getVerifySelfPhotoValue);
app.post('/api/verifyself/save', requireAuth, saveVerifySelfRows);
app.get('/api/settings/profile', requireAuth, getSettingsProfile);
app.put('/api/settings/profile', requireAuth, updateSettingsProfile);
app.get('/api/settings/custom-logout-duration', requireAuth, getSettingsCustomLogoutDuration);
app.put('/api/settings/custom-logout-duration', requireAuth, updateSettingsCustomLogoutDuration);
app.post('/api/settings/nickname', requireAuth, saveOnlineNickname);
app.post('/api/settings/secretIcon', requireAuth, saveSecretIcon);
app.post('/api/settings/secretIcon/verify', requireAuth, verifySecretIcon);
app.post('/api/settings/changePassword', requireAuth, changeSettingsPassword);
app.post('/api/settings/changePassword/sendSms', requireAuth, sendSettingsChangePasswordSms);
app.post('/api/settings/changePassword/verifySms', requireAuth, verifySettingsChangePasswordSms);
app.post('/api/settings/changePassword/complete', requireAuth, completeSettingsChangePassword);
app.post('/api/upgradeLegacyPassword', requireAuth, upgradeLegacyPassword);
app.post('/api/settings/changeEmail', requireAuth, changeSettingsEmail);
app.post('/api/settings/changeEmail/sendSms', requireAuth, sendSettingsChangeEmailSms);
app.post('/api/settings/changeEmail/verifySms', requireAuth, verifySettingsChangeEmailSms);
app.post('/api/settings/changeEmail/submit', requireAuth, submitSettingsChangeEmail);
app.post('/api/settings/changeEmail/complete', requireAuth, completeSettingsChangeEmail);
app.post('/api/settings/changePhone', requireAuth, changeSettingsPhone);
app.post('/api/settings/changePhone/submit', requireAuth, submitSettingsChangePhone);
app.post('/api/settings/changePhone/verifyEmailCode', requireAuth, verifySettingsChangePhoneEmailCode);
app.post('/api/settings/changePhone/sendSms', requireAuth, sendSettingsChangePhoneSms);
app.post('/api/settings/changePhone/verifySms', requireAuth, verifySettingsChangePhoneSms);
app.post('/api/settings/referralInviteEmail', requireAuth, sendReferralInviteEmail);
app.get('/api/promotionalMessages', requireAuth, getPromotionalMessages);
app.post('/api/settings/requestEmailChange', requireAuth, requestSettingsEmailChange);
app.get('/api/verifyEmailChangeLink', verifyEmailChangeLink);
app.post('/api/completeEmailChange', completeEmailChange);
app.post('/api/settings/payment/complete', requireAuth, completeSettingsPayment);
app.post('/api/settings/payment/paypal/orders', requireAuth, createSettingsPaypalOrder);
app.post('/api/settings/payment/paypal/orders/:orderID/capture', requireAuth, captureSettingsPaypalOrder);
app.post('/api/recordVault/refill', requireAuth, purchaseRecordVaultRefill);
app.post('/api/photoAlbums/refill', requireAuth, purchasePhotoAlbumsRefill);
app.get('/api/photoAlbums/invites', requireAuth, listPhotoAlbumsInvites);
app.post('/api/photoAlbums/invites', requireAuth, createPhotoAlbumsInvite);
app.post('/api/photoAlbums/invites/:inviteId/revoke', requireAuth, revokePhotoAlbumsInvite);
app.get('/api/photoAlbums/invites/preview', previewPhotoAlbumsInvite);
app.post('/api/photoAlbums/invites/accept', requireAuth, acceptPhotoAlbumsInvite);
app.get('/api/photoAlbums/shared-albums', requireAuth, listPhotoAlbumsSharedAlbums);
app.get('/api/photoAlbums/shared-albums/:sharedAlbumId/content', requireAuth, getPhotoAlbumsSharedAlbumContent);
app.get(
  '/api/photoAlbums/shared-albums/:sharedAlbumId/attachments/:attachmentId',
  requireAuth,
  getPhotoAlbumsSharedAlbumAttachment
);
app.delete('/api/photoAlbums/shared-albums/:sharedAlbumId', requireAuth, removePhotoAlbumsSharedAlbum);
app.get('/api/settings/payment/history', requireAuth, getSettingsPaymentHistory);
app.put('/api/admin/payment/token-balance', requireAuth, requireAdminRole, putAdminImpersonatedTokenBalance);
app.put('/api/admin/vault/refill-quota', requireAuth, requireAdminRole, putAdminImpersonatedVaultRefillQuota);
app.get('/api/settings/payment/notifications', requireAuth, getPaymentBalanceNotifications);
app.post('/api/settings/payment/notifications/dismiss', requireAuth, dismissPaymentBalanceNotification);
app.post('/api/settings/payment/notifications/dismissAll', requireAuth, dismissAllPaymentBalanceNotifications);
app.post('/api/requestedSingles/debitView', requireAuth, debitRequestedViewToken);
app.get('/api/sendFlower/setup', requireAuth, getSendFlowerSetup);
app.get('/api/sendFlower/history', requireAuth, getSendFlowerHistory);
app.get('/api/sendFlower/authorizenetKey', requireAuth, getSendFlowerAuthorizeNetKey);
app.post('/api/sendFlower/placeOrder', requireAuth, placeSendFlowerOrder);
app.get('/api/checkr/status', requireAuth, getCheckrStatus);
app.get('/api/checkr/bio-review', requireAuth, getCheckrBioReview);
app.get('/api/checkr/bio-review/member/:targetSinglesId/preview', requireAuth, getMemberCheckrBioReviewPreview);
app.get('/api/checkr/bio-review/member/:targetSinglesId', requireAuth, getApprovedCheckrBioReview);
app.post('/api/checkr/bio-review/save', requireAuth, saveCheckrBioReview);
app.post('/api/checkr/bio-review/field-save', requireAuth, saveCheckrBioReviewField);
app.post('/api/consent-record/save', requireAuth, saveConsentRecord);
app.post('/api/consent-record/save-live-face-scan-video', requireAuth, saveLiveFaceScanVideoConsent);
app.delete('/api/consent-record/live-face-scan-video', requireAuth, deleteLiveFaceScanVideoConsent);
app.post('/api/self-intro-video/save', requireAuth, saveSelfIntroVideoRoute);
app.get('/api/self-intro-video/slots', requireAuth, getSelfIntroVideoSlotsRoute);
app.delete('/api/self-intro-video/slot/:slot', requireAuth, clearSelfIntroVideoSlotRoute);
app.get('/api/consent-record/list', requireAuth, getConsentRecords);
app.post('/api/checkr/invitation', requireAuth, createCheckrInvitation);
app.get('/api/rekognition/status', requireAuth, getRekognitionStatus);
app.post('/api/rekognition/liveness/session', requireAuth, createRekognitionLivenessSession);
app.get('/api/rekognition/liveness/results/:sessionId', requireAuth, getRekognitionLivenessResults);
app.post('/api/rekognition/verify', requireAuth, verifyIdentityWithRekognition);
app.post('/api/rekognition/face-match-preview', requireAuth, previewFaceMatchForIdImage);
app.post('/api/rekognition/live-scan-profile-match', requireAuth, previewLiveScanProfileMatch);
app.post('/api/rekognition/id-capture', requireAuth, captureDriverLicenseFromIdImage);
app.post('/api/rekognition/manual-support-email', requireAuth, postIdVerificationManualSupportEmail);
app.get('/api/measureone/education/status', requireAuth, getMeasureOneEducationStatus);
app.post('/api/measureone/education/start', requireAuth, startMeasureOneEducationVerification);
app.post('/api/measureone/education/sync', requireAuth, syncMeasureOneEducationVerification);
app.post('/api/measureone/education/simulate', requireAuth, simulateMeasureOneEducationVerification);
app.get('/api/dev/simulate-verification', devSimulateMeasureOneVerification);
app.post('/webhooks/measureone', handleMeasureOneWebhook);
app.post('/api/domain-verification/send-code', requireAuth, sendDomainVerificationCode);
app.post('/api/domain-verification/verify', requireAuth, verifyDomainVerificationCode);
app.get('/api/vet-bio/verification-services', requireAuth, getVetBioVerificationServices);
app.patch('/api/vet-bio/verification-services', requireAuth, requireAdminRole, patchVetBioVerificationServices);
app.post('/api/vet-bio/id-verification-date-on-close', requireAuth, postIdVerificationDateOnClose);
app.post('/api/vet-bio/reset-id-verification', requireAuth, postResetIdVerification);
app.get('/api/speed-date/events', requireAuth, listSpeedDateEvents);
app.post('/api/speed-date/events', requireAuth, requireAdminRole, createSpeedDateEvent);
app.post('/api/speed-date/events/:eventId/rsvp', requireAuth, rsvpSpeedDateEvent);
app.post('/api/speed-date/events/:eventId/heartbeat', requireAuth, heartbeatSpeedDate);
app.get('/api/speed-date/session', requireAuth, getSpeedDateSession);
app.post('/api/speed-date/events/:eventId/start', requireAuth, requireAdminRole, startSpeedDateEvent);
app.post('/api/speed-date/events/:eventId/next-round', requireAuth, requireAdminRole, nextSpeedDateRound);
app.post('/api/speed-date/events/:eventId/end', requireAuth, requireAdminRole, endSpeedDateEvent);
app.post('/api/speed-date/signal', requireAuth, postSpeedDateSignal);
app.get('/api/speed-date/signals', requireAuth, getSpeedDateSignals);
app.post('/api/speed-date/pairs/:pairId/interest', requireAuth, postSpeedDateInterest);

app.get('/api/monthlyBill', requireAuth, getMonthlyBill);
app.put('/api/monthlyBill', requireAuth, putMonthlyBill);
app.get('/api/yearlyBill', requireAuth, getYearlyBill);
app.put('/api/yearlyBill', requireAuth, putYearlyBill);
app.post('/api/billSchedule/transfer', requireAuth, transferBillSchedule);

app.post('/api/paidRecord/ensure', requireAuth, postPaidRecordEnsure);
app.get('/api/paidRecord/:id', requireAuth, getPaidRecord);
app.put('/api/paidRecord/:id/notes', requireAuth, putPaidRecordNotes);
app.post('/api/paidRecord/:id/attachments', requireAuth, postPaidRecordAttachment);
app.get('/api/paidRecord/:id/attachments/:attachmentId', requireAuth, getPaidRecordAttachment);
app.get(
  '/api/paidRecord/:id/attachments/:attachmentId/download',
  requireAuth,
  downloadPaidRecordAttachment
);
app.delete('/api/paidRecord/:id/attachments/:attachmentId', requireAuth, deletePaidRecordAttachment);

app.post('/api/chat/send', requireAuth, sendChatMessage);
app.get('/api/chat/history/:targetUserId', requireAuth, getChatHistory);
app.post('/api/chat/historyBatch', requireAuth, getChatHistoryBatch);
app.get('/api/chat/friends', requireAuth, getChatFriends);
app.get('/api/chat/unreadMessages', requireAuth, getUnreadChatMessagesHandler);
app.get('/api/chat/unreadSenderCount', requireAuth, getUnreadChatSenderCountHandler);
app.post('/api/chat/markVisited/:targetUserId', requireAuth, markChatVisitedHandler);
app.get('/api/user/customization', requireAuth, getUserCustomization);
app.put('/api/user/customization', requireAuth, putUserCustomization);
app.post('/api/user/customization/load-default-music-urls', requireAuth, postLoadDefaultMusicUrls);

app.get('/api/eClassifieds/bpm/diagram', requireAuth, getBpmDiagram);
app.get('/api/eClassifieds/bpm/listings', requireAuth, getBpmListings);
app.get('/api/eClassifieds/bpm/instances', requireAuth, getBpmInstances);
app.get('/api/eClassifieds/bpm/pending', requireAuth, getBpmPending);
app.get('/api/eClassifieds/bpm/instances/:instanceId', requireAuth, getBpmInstance);
app.post('/api/eClassifieds/bpm/instances', requireAuth, postBpmStart);
app.post('/api/eClassifieds/bpm/instances/:instanceId/complete', requireAuth, postBpmComplete);
app.post('/api/eClassifieds/bpm/reset', requireAuth, postBpmResetAll);
app.post('/api/chat/uploadImage', requireAuth, uploadChatInlineImage);
app.get('/api/chat/image/:filename', requireAuth, getChatInlineImage);

app.get('/api/group-chat/mine', requireAuth, getMyGroupChat);
app.get('/api/group-chat/memberships', requireAuth, getMyGroupChatMemberships);
app.get('/api/group-chat/invite-candidates', requireAuth, getGroupChatInviteCandidates);
app.post('/api/group-chat/invite', requireAuth, postGroupChatInvite);
app.get('/api/group-chat/invites/pending', requireAuth, getPendingGroupChatInvites);
app.post('/api/group-chat/invite/:inviteId/accept', requireAuth, postAcceptGroupChatInvite);
app.post('/api/group-chat/invite/:inviteId/decline', requireAuth, postDeclineGroupChatInvite);
app.get('/api/group-chat/:groupId/messages', requireAuth, getGroupChatMessages);
app.get('/api/group-chat/:groupId/overview', requireAuth, getGroupChatOverview);
app.post('/api/group-chat/:groupId/send', requireAuth, postGroupChatMessage);
app.post('/api/group-chat/:groupId/markVisited', requireAuth, postGroupChatMarkVisited);

// Serve built frontend (fe/dist). Production (NODE_ENV=production, e.g. pm2 --env production) requires a prior fe build.
// Local dev (npm run dev, NODE_ENV unset): skip if fe/dist missing — use Vite on :3000 for the UI.
const feDistPath = path.join(__dirname, '../fe/dist');
const feIndexPath = path.join(feDistPath, 'index.html');
const feBuilt = fs.existsSync(feIndexPath);
if (!feBuilt) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: Frontend not built. Missing: ' + feIndexPath);
    console.error('On Mac run: febemac (or in fe/: npm run build). On Ubuntu run: febeprod (or in fe/: npm run buildprod).');
    process.exit(1);
  }
  console.warn(
    '[server_be] fe/dist not found; serving API only. Run the frontend with Vite (e.g. fe on http://localhost:3000) or build fe for same-origin static hosting.'
  );
}
if (feBuilt) {
  // On Ubuntu: ensure both OnlineMall.Website and www.OnlineMall.Website route to this app so /assets/* (e.g. Login-*.js) are served.
  app.use(express.static(feDistPath, { index: false }));

  // SPA: all other GET routes serve index.html (no-cache so registration/auth get fresh code)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    if (!fs.existsSync(feIndexPath)) {
      console.error('[server_be] fe/dist/index.html missing for', req.method, req.path);
      return res.status(503).type('text/plain').send(
        'Frontend not built. On Ubuntu run: cd fe && npm run buildprod && pm2 restart onlinemallwebsite'
      );
    }
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.sendFile(feIndexPath, (err) => {
      if (err) next(err);
    });
  });
}

// Unmatched /api/* must return JSON — never fall through to SPA index.html
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: 'API route not found',
      path: req.originalUrl || req.path,
      hint: 'Restart PM2 after deploy; mobile upload needs GET /api/mobilePhotoUpload/ping'
    });
  }
  next();
});

// Error handling middleware (runs after body-parser errors, e.g. JSON too large)
app.use((err, req, res, next) => {
  const tooLarge =
    err?.type === 'entity.too.large' ||
    err?.status === 413 ||
    /too large|Payload Too Large|request entity too large/i.test(String(err?.message || ''));

  if (tooLarge) {
    const limit = err?.limit ?? jsonLimitBytes;
    const length = err?.length ?? err?.expected;
    const isMobileUpload = String(req.path || '').startsWith('/api/mobilePhotoUpload');
    console.error(
      isMobileUpload ? '[mobilePhotoUpload] FAIL body-parser — REQUEST TOO LARGE' : '[upload trace] FAIL body-parser / raw-body — REQUEST TOO LARGE',
      {
      path: req.path,
      method: req.method,
      limitBytes: limit,
      limitMiB: limit ? (limit / (1024 * 1024)).toFixed(2) : '?',
      receivedBytes: length,
      receivedMiB: length ? (length / (1024 * 1024)).toFixed(2) : '?',
      errName: err?.name,
      errType: err?.type,
      hint: isMobileUpload
        ? 'Multipart phone upload may be blocked by nginx client_max_body_size or HAProxy — not JSON_LIMIT_MB'
        : 'Increase JSON_LIMIT_MB in ~/.ssh/be/.env; check nginx client_max_body_size if request never reaches Node'
    });
    console.error('[upload trace] Full error stack:', err?.stack || err);
    if (res.headersSent) return next(err);
    return res.status(413).json({
      code: 'REQUEST_BODY_TOO_LARGE',
      error: `Request body too large for server (JSON limit ${JSON_LIMIT_MB} MiB).`
    });
  }

  console.error('[server_be] Unhandled error:', err?.message, req.method, req.path);
  if (String(req.path || '').startsWith('/api/mobilePhotoUpload')) {
    console.error('[mobilePhotoUpload] Unhandled error detail:', {
      path: req.originalUrl || req.path,
      method: req.method,
      message: err?.message,
      code: err?.code,
      stack: err?.stack
    });
  }
  console.error(err?.stack || err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Mobile upload API: GET /api/mobilePhotoUpload/ping → {"ok":true,"apiVersion":2}`);
  void import('./utils/appStorageFolderPerms.js')
    .then(({ ensureAllAppStorageFoldersWritable }) => {
      const perm = ensureAllAppStorageFoldersWritable({ route: 'startup' });
      if (perm.ok) {
        console.log(
          '[startup] storage folder perms OK:',
          perm.roots.join(' | ') || '(none configured)'
        );
      } else {
        console.error(
          '[startup] storage folder perms FAILED — UI will show Folder permission error until fixed'
        );
      }
    })
    .catch((err) => console.error('[startup] storage folder perm check failed:', err?.message ?? err));
  void initUserActivityStatsSchema()
    .then(() => console.log('[startup] user activity / search event tables ready'))
    .catch((err) => console.error('[startup] user activity schema bootstrap failed:', err?.message ?? err));
  void initUserCustomizationSchema()
    .then(() => console.log('[startup] user_customization schema ready'))
    .catch((err) => console.error('[startup] user_customization schema bootstrap failed:', err?.message ?? err));
  void initMobilePhotoUploadSchema()
    .then(() => console.log('[startup] mobile_photo_upload_sessions schema ready'))
    .catch((err) => console.error('[startup] mobile_photo_upload schema bootstrap failed:', err?.message ?? err));
  startBlockedAsnDailyRefresh().catch((err) =>
    console.error('[startup] blocked-asn init failed:', err?.message ?? err)
  );
  try {
    startBillOverdueEmailDaily();
  } catch (err) {
    console.error('[startup] bill overdue email schedule failed:', err?.message ?? err);
  }
});

