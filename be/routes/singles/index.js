/**
 * Singles routes – re-exports all handlers for server_be.js.
 * Legacy names (with suffix) are kept for compatibility.
 */

export { registerUser, registerUser as registerUser_FFFFFFFF } from './register.js';
export { validateReferralCode } from './validateReferralCode.js';
export {
  verifyRegistrationLink,
  verifyRegistrationLink as verifyRegistrationLink_KKKKKKKK,
  verifyRegistrationCode,
  verifyRegistrationCode as verifyRegistrationCode_VVVVVVVV
} from './verifyRegistrationLink.js';
export {
  verifyPasswordResetLink,
  verifyPasswordResetLink as verifyPasswordResetLink_LLLLLLLL
} from './verifyPasswordResetLink.js';
export { completePasswordReset, completePasswordReset as completePasswordReset_MMMMMMMMMM } from './completePasswordReset.js';
export { beVerifyLoginPassword } from './beVerifyLoginPassword.js';
export { getAllSingles, getAllSingles as getAllSingles_BBBBBBBB } from './getAllSingles.js';
export { markInterested, markInterested as markInterested_MMMMMMMM } from './markInterested.js';
export { notInterested, notInterested as notInterested_NNNNNNNN } from './notInterested.js';
export { toggleInterestedRequestInfo, toggleInterestedRequestInfo as toggleInterestedRequestInfo_OOOOOOOO } from './toggleInterestedRequestInfo.js';
export { getSinglesInterested, getSinglesInterested as getSinglesInterested_DDDDDDD } from './getSinglesInterested.js';
export { getRequestsAboutMe, getRequestsAboutMe as getRequestsAboutMe_PPPPPPPP } from './getRequestsAboutMe.js';
export { getRequestsAboutMeSettings, getRequestsAboutMeSettings as getRequestsAboutMeSettings_RRRRRRRR } from './getRequestsAboutMeSettings.js';
export { getRequestedSingles, getRequestedSingles as getRequestedSingles_TTTTTTTT } from './getRequestedSingles.js';
export { getRequestedSinglesPoem } from './poems.js';
export {
  getMyPicksList,
  getMyPicksFeed,
  getMyPicksPostNotifications,
  dismissMyPicksPostNotification,
  dismissAllMyPicksPostNotifications,
  createMyPosting,
  updateMyPostingVisibility,
  deleteMyPosting,
  deleteMyPostingPhoto
} from './getMyPicks.js';
export {
  getPostingComments,
  createPostingComment,
  deletePostingComment,
  togglePostingLike,
  getPostingLikes
} from './postingComments.js';
export { toggleRequestApprovalAboutMe, toggleRequestApprovalAboutMe as toggleRequestApprovalAboutMe_QQQQQQQQ } from './toggleRequestApprovalAboutMe.js';
export {
  toggleRequestsAboutMeRequestFlag,
  toggleRequestsAboutMeRequestFlag as toggleRequestsAboutMeRequestFlag_WWWWWWWW
} from './toggleRequestsAboutMeRequestFlag.js';
export { toggleRequestBlockAboutMe, toggleRequestBlockAboutMe as toggleRequestBlockAboutMe_SSSSSSSS } from './toggleRequestBlockAboutMe.js';
export { toggleRequestBlockSent, toggleRequestBlockSent as toggleRequestBlockSent_UUUUUUUU } from './toggleRequestBlockSent.js';
export { createPassword, createPassword as createPassword_GGGGGGGG } from './createPassword.js';
export {
  verifyPhone,
  verifyPhone as verifyPhone_HHHHHHHH,
  cleanupVerificationsByEmail,
  cleanupVerificationsByEmail as cleanupVerificationsByEmail_VVVVVVVV
} from './verifyPhone.js';
export { resendPhoneCode } from './resendPhoneCode.js';
export { sendRegistrationSms } from './sendRegistrationSms.js';
export { bypassSignupSmsVerification } from './bypassSignupSmsVerification.js';
export { beLoginBypass } from './beLoginBypass.js';
export { getVerifySelfPhotoValue, saveVerifySelfRows } from './getVerifySelfPhotoValue.js';
export {
  getSettingsProfile,
  updateSettingsProfile,
  completeSettingsPayment,
  createSettingsPaypalOrder,
  captureSettingsPaypalOrder,
  purchaseRecordVaultRefill,
  getSettingsPaymentHistory,
  putAdminImpersonatedTokenBalance,
  putAdminImpersonatedVaultRefillQuota,
  postAdminSetSinglesTokenBalance,
  debitRequestedViewToken
} from './settingsProfile.js';
export {
  getSettingsCustomLogoutDuration,
  updateSettingsCustomLogoutDuration
} from './settingsCustomLogoutDuration.js';
export {
  getPaymentBalanceNotifications,
  dismissPaymentBalanceNotification,
  dismissAllPaymentBalanceNotifications
} from './paymentNotifications.js';
export {
  getBioRequestNotifications,
  dismissBioRequestNotification,
  dismissAllBioRequestNotifications,
  getReceivedBioRequestsPendingCount
} from './bioRequestNotifications.js';
export {
  getVettedFriendsBioResponsePendingCount,
  dismissBioResponseNotification,
  dismissAllBioResponseNotifications,
  clearBioResponseNotificationDismissed
} from './bioResponseNotifications.js';
export {
  changeSettingsPassword,
  changeSettingsEmail,
  changeSettingsPhone,
  submitSettingsChangePhone,
  verifySettingsChangePhoneEmailCode,
  sendSettingsChangePhoneSms,
  verifySettingsChangePhoneSms,
  requestSettingsEmailChange,
  verifyEmailChangeLink,
  completeEmailChange,
  sendSettingsChangePasswordSms,
  verifySettingsChangePasswordSms,
  completeSettingsChangePassword,
  sendSettingsChangeEmailSms,
  verifySettingsChangeEmailSms,
  submitSettingsChangeEmail,
  completeSettingsChangeEmail
} from './settingsAccount.js';
export { sendReferralInviteEmail } from './sendReferralInviteEmail.js';
export { getPromotionalMessages } from './getPromotionalMessages.js';
export { upgradeLegacyPassword } from './upgradeLegacyPassword.js';
export { getSendFlowerSetup, getSendFlowerHistory, getSendFlowerAuthorizeNetKey, placeSendFlowerOrder } from './sendFlower.js';
export { createCheckrInvitation, getCheckrStatus } from './checkr.js';
export { getApprovedCheckrBioReview, getCheckrBioReview, getMemberCheckrBioReviewPreview } from './getCheckrBioReview.js';
export { saveCheckrBioReview } from './saveCheckrBioReview.js';
export { saveCheckrBioReviewField } from './saveCheckrBioReviewField.js';
export { saveConsentRecord } from './saveConsentRecord.js';
export { saveLiveFaceScanVideoConsent } from './saveLiveFaceScanVideoConsent.js';
export { deleteLiveFaceScanVideoConsent } from './deleteLiveFaceScanVideoConsent.js';
export { saveSelfIntroVideoRoute } from './saveSelfIntroVideoRoute.js';
export { getSelfIntroVideoSlotsRoute } from './getSelfIntroVideoSlotsRoute.js';
export { clearSelfIntroVideoSlotRoute } from './clearSelfIntroVideoSlotRoute.js';
export { getConsentRecords } from './getConsentRecords.js';
export {
  getRekognitionStatus,
  createRekognitionLivenessSession,
  getRekognitionLivenessResults,
  verifyIdentityWithRekognition,
  captureDriverLicenseFromIdImage,
  previewFaceMatchForIdImage,
  previewLiveScanProfileMatch
} from './rekognition.js';
export { postIdVerificationManualSupportEmail } from './idVerificationManualSupportEmail.js';
export {
  getMeasureOneEducationStatus,
  startMeasureOneEducationVerification,
  syncMeasureOneEducationVerification,
  simulateMeasureOneEducationVerification,
  handleMeasureOneWebhook,
  devSimulateMeasureOneVerification
} from './measureoneEducation.js';
export { sendDomainVerificationCode, verifyDomainVerificationCode } from './domainVerification.js';
export {
  getVetBioVerificationServices,
  patchVetBioVerificationServices,
  postIdVerificationDateOnClose,
  postResetIdVerification
} from './vetBioVerificationServices.js';
export {
  getSinglesPreferences_IIIIIIII,
  updateSinglesPreferences_JJJJJJJJ
} from '../singles_be.js';
