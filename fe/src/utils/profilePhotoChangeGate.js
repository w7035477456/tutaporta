import api from 'api/axios';
import { normalizeVettingStatusKey } from 'utils/vettingStatusDisplay';
import { NOT_AVAILABLE, toDisplayVettedDate } from 'views/utilities/verifySelfVettedDate';

export const PROFILE_PHOTO_CHANGE_COOLDOWN_DAYS = 30;

function formatRemainingDaysPhrase(remainingDays) {
  const n = Math.max(1, Math.ceil(Number(remainingDays) || 0));
  return n === 1 ? '1 day' : `${n} days`;
}

/** Whole days left in the 30-day profile-photo change cooldown; null vettedDate → full 30. */
export function daysRemainingInProfilePhotoCooldown(vettedDate) {
  const daysSince = daysSinceVettedDate(vettedDate);
  if (daysSince == null) return PROFILE_PHOTO_CHANGE_COOLDOWN_DAYS;
  return Math.max(1, Math.ceil(PROFILE_PHOTO_CHANGE_COOLDOWN_DAYS - daysSince));
}

/** My Album → Make this Profile wait popup. */
export function formatProfilePhotoChangeWaitMessage(vettedDate, userTimeZoneProfile = null) {
  const verifiedDateDisplay = toDisplayVettedDate(vettedDate, userTimeZoneProfile);
  const remainingPhrase = formatRemainingDaysPhrase(daysRemainingInProfilePhotoCooldown(vettedDate));
  const verifiedPart =
    verifiedDateDisplay !== NOT_AVAILABLE ? `on ${verifiedDateDisplay}` : 'under 30 days ago';
  return `Because you have verified your photo ${verifiedPart}, you must wait for ${remainingPhrase} before you can change profile photo and once changed, the photo verification status will show "Not Started".`;
}

export const PROFILE_PHOTO_CHANGE_WAIT_MESSAGE = formatProfilePhotoChangeWaitMessage(null);

export const PROFILE_PHOTO_CHANGE_CONFIRM_MESSAGE =
  'You have verified your profile photo. If you change to new photo, the photo verification will change from "Match" to "Not started".';

export const ID_VERIFICATION_REDO_CONFIRM_MESSAGE =
  'To help keep our community safe, updating your profile requires a quick live facial verification scan. Ready to start?';

/** Self-Report-Bio Profile Photo Edit → My Album. */
export const PROFILE_PHOTO_EDIT_CONFIRM_MESSAGE =
  'Awesome job getting verified! To keep things secure, just note that if you click "Confirm Change" we will reset Photo verification status from "Match" to \u2018Not Started\u2019.';

export function isProfilePhotoMatchStatus(verificationStatus) {
  return normalizeVettingStatusKey(verificationStatus) === 'info_matches';
}

/** Whole days since vettedDate; null if date missing or invalid. */
export function daysSinceVettedDate(raw) {
  if (raw == null) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
}

export function formatProfilePhotoEditWaitMessage(vettedDate, userTimeZoneProfile = null) {
  const verifiedDateDisplay = toDisplayVettedDate(vettedDate, userTimeZoneProfile);
  const remainingPhrase = formatRemainingDaysPhrase(daysRemainingInProfilePhotoCooldown(vettedDate));
  const verifiedPart =
    verifiedDateDisplay !== NOT_AVAILABLE ? `on ${verifiedDateDisplay}` : 'recently';
  return `Awesome job getting photo verified ${verifiedPart}! To keep things secure, we ask that you wait ${remainingPhrase} before swapping out your profile picture.`;
}

export function evaluateProfilePhotoChangeGate({
  verificationStatus,
  vettedDate,
  isAdmin = false,
  isImpersonation = false
}) {
  if (!isProfilePhotoMatchStatus(verificationStatus)) {
    return { action: 'proceed', resetProfilePhotoVetting: false, daysSinceVerified: null };
  }
  const days = daysSinceVettedDate(vettedDate);
  if (isImpersonation) {
    return { action: 'proceed', resetProfilePhotoVetting: false, daysSinceVerified: days };
  }
  if (isAdmin) {
    return { action: 'proceed', resetProfilePhotoVetting: true, daysSinceVerified: days };
  }
  if (days != null && days < PROFILE_PHOTO_CHANGE_COOLDOWN_DAYS) {
    return { action: 'blocked', resetProfilePhotoVetting: false, daysSinceVerified: days };
  }
  return { action: 'confirm', resetProfilePhotoVetting: true, daysSinceVerified: days };
}

export async function fetchProfilePhotoVettingFromBioReview() {
  const { data } = await api.get('/api/checkr/bio-review');
  const row = (data?.briefBio || []).find((r) => r.key === 'profileDlPhoto' || r.key === 'profilePhoto');
  return {
    verificationStatus: row?.verificationStatus ?? null,
    vettedDate: row?.vettedDate ?? null
  };
}

/** vet_bio.id_verification_date for Identification Verification button gate. */
export async function fetchIdVerificationDateFromServices() {
  const { data } = await api.get('/api/vet-bio/verification-services');
  const idService = (data?.services || []).find((s) => s.key === 'id');
  return { idVerificationDate: idService?.verificationDate ?? null };
}

/**
 * Relative time phrase without "ago", e.g. "0 days 10 min" or "40 days 12 min".
 * @param {Date|string|number|null} rawDate
 * @param {{ alwaysShowDays?: boolean }} opts — when true, includes "0 days" when under 24h
 */
export function formatDaysMinAgoPhrase(rawDate, { alwaysShowDays = false } = {}) {
  if (rawDate == null) return null;
  const d = rawDate instanceof Date ? rawDate : new Date(rawDate);
  if (Number.isNaN(d.getTime())) return null;
  const totalMin = Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60)));
  const days = Math.floor(totalMin / (60 * 24));
  const minutes = totalMin % (60 * 24);
  const dayPart = days === 1 ? '1 day' : `${days} days`;
  const minPart = minutes === 1 ? '1 min' : `${minutes} min`;
  if (alwaysShowDays || days > 0) return `${dayPart} ${minPart}`;
  return minPart;
}

/**
 * Relative time phrase without "ago", e.g. "0 days 3:04 hour" or "2 days 4:12 hour".
 * @param {Date|string|number|null} rawDate
 * @param {{ alwaysShowDays?: boolean }} opts — when true, includes "0 days" when under 24h
 */
export function formatDaysHourMinAgoPhrase(rawDate, { alwaysShowDays = true } = {}) {
  if (rawDate == null) return null;
  const d = rawDate instanceof Date ? rawDate : new Date(rawDate);
  if (Number.isNaN(d.getTime())) return null;
  const totalMin = Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60)));
  const days = Math.floor(totalMin / (60 * 24));
  const remainderMin = totalMin % (60 * 24);
  const hours = Math.floor(remainderMin / 60);
  const minutes = remainderMin % 60;
  const dayPart = days === 1 ? '1 day' : `${days} days`;
  const hourPart = `${hours}:${String(minutes).padStart(2, '0')} hour`;
  if (alwaysShowDays || days > 0) return `${dayPart} ${hourPart}`;
  return hourPart;
}

/** Status table suffix, e.g. " 0 days 3:04 hour ago". */
export function formatVerificationDateSuffix(verificationDate) {
  const phrase = formatDaysHourMinAgoPhrase(verificationDate);
  if (!phrase) return '';
  return ` ${phrase} ago`;
}

/** Red popup when ID was verified within the last 30 days. */
export function formatIdVerificationCooldownMessage(idVerificationDate) {
  const phrase = formatDaysMinAgoPhrase(idVerificationDate, { alwaysShowDays: true });
  const agoPart = phrase ? `${phrase} ago` : 'recently';
  const remainingPhrase = formatRemainingDaysPhrase(daysRemainingInProfilePhotoCooldown(idVerificationDate));
  return `Awesome job getting photo verified ${agoPart}! To keep things secure, we ask that you wait ${remainingPhrase} before you can Id verify again.`;
}

/**
 * Identification Verification entry (vet_bio.id_verification_date).
 * blocked: date set and under 30 days ago.
 * proceed: no date yet, or date 30+ days ago.
 */
export function evaluateIdVerificationGate({ idVerificationDate }) {
  if (idVerificationDate == null) {
    return { action: 'proceed', daysSinceVerified: null };
  }
  const days = daysSinceVettedDate(idVerificationDate);
  if (days == null) {
    return { action: 'proceed', daysSinceVerified: null };
  }
  if (days < PROFILE_PHOTO_CHANGE_COOLDOWN_DAYS) {
    return { action: 'blocked', daysSinceVerified: days };
  }
  return { action: 'proceed', daysSinceVerified: days };
}

/** Identification Verification only: yellow when null or verified 30+ days ago; grey when under 30 days. */
export function isVerificationServiceActionEnabled(verificationDate) {
  return evaluateIdVerificationGate({ idVerificationDate: verificationDate }).action === 'proceed';
}
