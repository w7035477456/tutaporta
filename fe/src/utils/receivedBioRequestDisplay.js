import { formatAliasWithMemberCode, formatMemberCode, formatMemberLabel, formatMemberNumber } from 'utils/memberLabel';
import {
  APPROVAL_STATUS,
  isNoResponseApprovalStatus,
  normalizeApprovalStatus
} from 'utils/approvalStatusEnum';

/** vet_bio *_vetted columns counted for completion % (fixed denominators per product spec). */
export const BRIEF_BIO_VETTED_FIELDS = [
  'profilephoto_vetted',
  'firstname_vetted',
  'middlename_vetted',
  'lastname_vetted',
  'age_vetted',
  'height_vetted',
  'official_gender_vetted',
  'current_city_vetted',
  'countryofcitizenship_vetted'
];

export const FULL_BIO_VETTED_FIELDS = [
  'company_domain_name_vetted',
  'current_company_vetted',
  'job_title_vetted',
  'college_name_vetted',
  'highest_degree_completed_vetted',
  'professional_license_vetted',
  'degree_graduation_date_vetted',
  'linkedin_url_vetted'
];

export const ALL_VET_BIO_MATCH_FIELDS = [...BRIEF_BIO_VETTED_FIELDS, ...FULL_BIO_VETTED_FIELDS];

export function isVetBioInfoMatches(vettedValue) {
  const s = String(vettedValue ?? '').trim().toLowerCase();
  return s === 'info_matches' || s === 'info_matched';
}

/**
 * Self-Report-Bio % completed — only these 13 UI fields count (yellow digits on Self-Report page).
 * Other page fields (names, citizenship, POB, Gov Id, misc, etc.) do not count.
 */
export const SELF_REPORT_COMPLETION_BRIEF_FIELD_KEYS = Object.freeze([
  'profileDlPhoto', // 1 Profile&DL photo
  'profileLivePhoto', // 2 Profile&Live
  'age', // 3
  'height', // 4
  'gender', // 5
  'current_city' // 6
]);

export const SELF_REPORT_COMPLETION_FULL_FIELD_KEYS = Object.freeze([
  'company_domain_name', // 7
  'current_company', // 8 Employer Name
  'job_title', // 9
  'linkedin_url', // 10
  'college_name', // 11
  'highest_degree_completed', // 12
  'degree_graduation_date' // 13
]);

export const SELF_REPORT_COMPLETION_FIELD_KEYS = Object.freeze([
  ...SELF_REPORT_COMPLETION_BRIEF_FIELD_KEYS,
  ...SELF_REPORT_COMPLETION_FULL_FIELD_KEYS
]);

function isDemoUserMemberCategory(raw) {
  return String(raw ?? '').trim().toLowerCase() === 'demouser';
}

function findBioReviewCompletionRow(bioReview, key) {
  const brief = Array.isArray(bioReview?.briefBio) ? bioReview.briefBio : [];
  const full = Array.isArray(bioReview?.fullBio) ? bioReview.fullBio : [];
  return brief.find((row) => row?.key === key) || full.find((row) => row?.key === key) || null;
}

/**
 * Matches Self-Report Matching Status display:
 * DemoUser → Profile&DL / Profile&Live = Not Started; other counted fields = Completed.
 * Everyone else → verificationStatus info_matches.
 */
export function isSelfReportCompletionFieldCompleted(row, { demoUser = false } = {}) {
  if (!row?.key) return false;
  if (demoUser) {
    if (row.key === 'profileDlPhoto' || row.key === 'profileLivePhoto') return false;
    return true;
  }
  return isVetBioInfoMatches(row.verificationStatus);
}

/** Round to whole % — completed count / fieldKeys.length. */
export function calcSelfReportCompletionPercent(bioReview, fieldKeys = SELF_REPORT_COMPLETION_FIELD_KEYS) {
  const keys = Array.isArray(fieldKeys) ? fieldKeys : SELF_REPORT_COMPLETION_FIELD_KEYS;
  if (!keys.length) return 0;
  const demoUser = isDemoUserMemberCategory(bioReview?.member?.memberCategory);
  let matched = 0;
  for (const key of keys) {
    const row = findBioReviewCompletionRow(bioReview, key);
    if (isSelfReportCompletionFieldCompleted(row, { demoUser })) matched += 1;
  }
  return Math.round((matched / keys.length) * 100);
}

/** vet_bio.profilephoto_vetted / age_vetted — Brief/Full Bio Available when info_matches. */
export function isVetBioAvailable(vettedValue) {
  return isVetBioInfoMatches(vettedValue);
}

/** requests.brief_bio_request / full_bio_request — display label for UI. */
export function formatBioRequestStatus(requestValue) {
  return String(requestValue ?? '').trim().toLowerCase() === 'requested' ? 'Requested' : 'Not Requested';
}

export function isBioRequestRequested(requestValue) {
  return formatBioRequestStatus(requestValue) === 'Requested';
}

/** Incoming row has at least one active brief or full bio request. */
export function hasIncomingBioRequest(row) {
  if (!row) return false;
  return isBioRequestRequested(row.brief_bio_request) || isBioRequestRequested(row.full_bio_request);
}

/** Pending incoming brief/full items awaiting approve/deny (each requested + approval na counts as 1). */
export function countIncomingBioRequestsPending(row) {
  if (!row) return 0;
  let count = 0;
  if (
    isBioRequestRequested(row.brief_bio_request) &&
    isNoResponseApprovalStatus(row.brief_bio_request_approval)
  ) {
    count += 1;
  }
  if (
    isBioRequestRequested(row.full_bio_request) &&
    isNoResponseApprovalStatus(row.full_bio_request_approval)
  ) {
    count += 1;
  }
  return count;
}

export function parseApprovalDate(value) {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (!text) return null;
  const dateOnly = text.length >= 10 ? text.slice(0, 10) : text;
  const parsed = new Date(`${dateOnly}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function calcMonthsAndDaysBetween(fromDate, toDate) {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  from.setHours(12, 0, 0, 0);
  to.setHours(12, 0, 0, 0);
  if (to <= from) return { months: 0, days: 0 };

  let months = 0;
  let cursor = new Date(from);
  while (true) {
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + 1);
    if (next > to) break;
    months += 1;
    cursor = next;
  }
  const days = Math.max(0, Math.round((to - cursor) / 86400000));
  return { months, days };
}

/** e.g. "11 months 15 days left" */
export function formatApprovedViewingTimeLeftLabel(approvalDate, viewingDurationMonths) {
  const start = parseApprovalDate(approvalDate);
  if (!start) return '';
  const termMonths = Number(viewingDurationMonths);
  if (!Number.isFinite(termMonths) || termMonths < 0) return '';

  const end = new Date(start);
  end.setMonth(end.getMonth() + termMonths);
  end.setHours(12, 0, 0, 0);

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const { months, days } = calcMonthsAndDaysBetween(today, end);
  const monthWord = months === 1 ? 'month' : 'months';
  const dayWord = days === 1 ? 'day' : 'days';
  return `${months} ${monthWord} ${days} ${dayWord} left`;
}

/** True when approval_date + viewing term has ended (0 months 0 days left). */
export function isApprovedViewingExpired(approvalDate, viewingDurationMonths) {
  const start = parseApprovalDate(approvalDate);
  if (!start) return false;
  const termMonths = Number(viewingDurationMonths);
  if (!Number.isFinite(termMonths) || termMonths < 0) return false;

  const end = new Date(start);
  end.setMonth(end.getMonth() + termMonths);
  end.setHours(12, 0, 0, 0);

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return today >= end;
}

/** After viewing term ends or request is notrequested. */
export function formatIncomingBioNotRequestedResponseMessage(bioKind) {
  const bioPhrase = bioKind === 'brief' ? 'Brief Bio' : 'Full Bio';
  return `You have not requested to view ${bioPhrase} (or requested approval expired)`;
}

/** Saved approval status line on Received Bio Requests (Brief / Full). */
export function formatIncomingBioApprovalStatusMessage({
  bioKind,
  requestFlag,
  savedApproval,
  approvalDate,
  viewingDurationMonths
}) {
  if (!isBioRequestRequested(requestFlag)) return '';
  const bioPhrase = bioKind === 'brief' ? 'Brief Bio' : 'Full Bio';
  const approval = triStateBioRequestApproval(savedApproval);
  if (approval === APPROVAL_STATUS.APPROVE) {
    if (isApprovedViewingExpired(approvalDate, viewingDurationMonths)) return '';
    const timeLeft = formatApprovedViewingTimeLeftLabel(approvalDate, viewingDurationMonths);
    return timeLeft
      ? `You approved viewing ${bioPhrase} (${timeLeft})`
      : `You approved viewing ${bioPhrase}`;
  }
  if (approval === APPROVAL_STATUS.DENY) {
    return `You denied viewing ${bioPhrase}`;
  }
  return '';
}

/** True while saved approve is still inside ADD_DAYS_TO_DATE_APPROVE_STAY_DURATION window. */
export function isApprovalLockedDuringStay(approvalValue, approvalDate, stayDays) {
  if (triStateBioRequestApproval(approvalValue) !== APPROVAL_STATUS.APPROVE) return false;
  const start = parseApprovalDate(approvalDate);
  if (!start) return false;
  const days = Number(stayDays);
  if (!Number.isFinite(days) || days < 0) return false;
  const unlockDate = new Date(start);
  unlockDate.setDate(unlockDate.getDate() + days);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return today < unlockDate;
}

/** Tri-state approval from requests.brief_bio_request_approval / full_bio_request_approval. */
export function triStateBioRequestApproval(value) {
  return normalizeApprovalStatus(value);
}

/** Outgoing request row — recipient approved Brief or Full bio (Acquaint. & Buddies list). */
export function isOutgoingBioRequestApproved(row) {
  return (
    triStateBioRequestApproval(row?.brief_bio_request_approval) === APPROVAL_STATUS.APPROVE ||
    triStateBioRequestApproval(row?.full_bio_request_approval) === APPROVAL_STATUS.APPROVE
  );
}

/**
 * When they approved my outgoing bio request, mirror that level as my incoming approval
 * (Brief → Acquaintance, Full → Buddies) even if they never requested my bio.
 * @returns {{ brief_bio_request_approval: string, full_bio_request_approval: string } | null}
 */
export function mirroredIncomingApprovalFromOutgoing(outgoingRow) {
  if (!outgoingRow) return null;
  const fullApproved =
    triStateBioRequestApproval(outgoingRow.full_bio_request_approval) === APPROVAL_STATUS.APPROVE;
  const briefApproved =
    triStateBioRequestApproval(outgoingRow.brief_bio_request_approval) === APPROVAL_STATUS.APPROVE;
  if (fullApproved) {
    return {
      brief_bio_request_approval: APPROVAL_STATUS.APPROVE,
      full_bio_request_approval: APPROVAL_STATUS.APPROVE
    };
  }
  if (briefApproved) {
    return {
      brief_bio_request_approval: APPROVAL_STATUS.APPROVE,
      full_bio_request_approval: APPROVAL_STATUS.NO_RESPONSE
    };
  }
  return null;
}

/** Received Bio Req left rail — incoming request and/or reciprocal buddy/acquaintance. */
export function shouldShowOnReceivedBioRequestsPage(incomingRow, outgoingRow) {
  if (hasIncomingBioRequest(incomingRow)) return true;
  return isOutgoingBioRequestApproved(outgoingRow);
}

/** Outgoing request row — display name for singles_id_to (friend being viewed). */
export function formatOutgoingBioFriendLabel(row) {
  return formatAliasWithMemberCode({
    alias: row?.alias,
    singlesId: row?.singles_id_to,
    prefix: row?.prefix,
    memberId: row?.member_id
  });
}

/** Approval suffix for outgoing bio request sentences on Vetted Friends. */
export function formatBioRequestApprovalDisplay(approvalValue, { requestFlag, bioKind } = {}) {
  if (!isBioRequestRequested(requestFlag)) {
    return { text: '', clickable: false, showViewAction: false, tone: 'neutral' };
  }
  const state = triStateBioRequestApproval(approvalValue);
  if (state === APPROVAL_STATUS.APPROVE) {
    return {
      text: 'Approved !',
      actionText:
        bioKind === 'brief'
          ? 'View Acquaintance Bio (Brief Bio)'
          : 'View Buddies Bio (Full Bio)',
      clickable: true,
      showViewAction: true,
      tone: 'approve'
    };
  }
  if (state === APPROVAL_STATUS.DENY) {
    return { text: 'Denied', clickable: false, showViewAction: false, tone: 'denied' };
  }
  return { text: 'Not Responded', clickable: false, showViewAction: false, tone: 'pending' };
}

/**
 * Outgoing bio request status sentence (Vetted Friends Biography tab).
 * e.g. "Status: Requested to view WackyWill Brief Bio Response: Approved | Buddies Bio (Full Bio)"
 */
export function formatOutgoingBioRequestSentence(row, bioKind) {
  const friendLabel = formatOutgoingBioFriendLabel(row);
  const requestFlag = bioKind === 'brief' ? row?.brief_bio_request : row?.full_bio_request;
  const approvalValue = bioKind === 'brief' ? row?.brief_bio_request_approval : row?.full_bio_request_approval;
  const bioPhrase = bioKind === 'brief' ? 'Brief Bio' : 'Full Bio';
  const requestText = formatBioRequestStatus(requestFlag);
  return {
    requestText,
    friendLabel,
    bioPhrase,
    approval: formatBioRequestApprovalDisplay(approvalValue, { requestFlag, bioKind })
  };
}

export function formatRequesterMemberCode(prefix, memberId) {
  return formatMemberCode({ prefix, memberId }) || '';
}

export function formatOutgoingBioRequestIncludesPhrase(bioKind) {
  return bioKind === 'brief'
    ? '(Includes view-only access to Friends-only Album)'
    : '(Includes 2-way chat, likes, repost, and comments)';
}

/** Vetted Friends — main detail after the action button (before Includes phrase). */
export function formatOutgoingBioRequestActionMainDetailText(row, bioKind) {
  const friendLabel = formatOutgoingBioFriendLabel(row);
  const bioLabel = bioKind === 'brief' ? 'Brief Bio' : 'Full Bio';
  return `${friendLabel} ${bioLabel}`;
}

/** Vetted Friends — plain text after the yellow "Request to View" button. */
export function formatOutgoingBioRequestActionDetailText(row, bioKind) {
  return `${formatOutgoingBioRequestActionMainDetailText(row, bioKind)} ${formatOutgoingBioRequestIncludesPhrase(bioKind)}`;
}

/** Vetted Friends — main detail after the "Cancel Request" button. */
export function formatOutgoingBioCancelActionMainDetailText(row, bioKind) {
  return `to View ${formatOutgoingBioRequestActionMainDetailText(row, bioKind)}`;
}

/** Vetted Friends — plain text after the "Cancel Request" button. */
export function formatOutgoingBioCancelActionDetailText(row, bioKind) {
  return `${formatOutgoingBioCancelActionMainDetailText(row, bioKind)} ${formatOutgoingBioRequestIncludesPhrase(bioKind)}`;
}

/** Parsed incoming request sentence for Received Bio Requests UI. */
export function formatIncomingBioRequestMessageParts(row, bioKind) {
  const requesterLabel = formatAliasWithMemberCode({
    alias: row?.alias,
    prefix: row?.prefix,
    memberId: row?.member_id
  });
  const requestFlag = bioKind === 'brief' ? row?.brief_bio_request : row?.full_bio_request;
  const bioPhrase = bioKind === 'brief' ? 'Brief Bio' : 'Full Bio';
  const requested = isBioRequestRequested(requestFlag);
  if (requested) {
    return {
      requesterLabel: requesterLabel || 'Member',
      statusPhrase: 'Requested',
      trailingText: ` To View Your ${bioPhrase}`
    };
  }
  return {
    requesterLabel: requesterLabel || 'Member',
    statusPhrase: 'Not Requested',
    trailingText: ` To View Your ${bioPhrase}`
  };
}

/** e.g. "Lisa_2 M00348573 Requested To View Your Brief Bio" */
export function formatIncomingBioRequestMessage(row, bioKind) {
  const { requesterLabel, statusPhrase, trailingText } = formatIncomingBioRequestMessageParts(row, bioKind);
  return `${requesterLabel} ${statusPhrase}${trailingText}`.trim();
}

/** Heading inside the Your Response box when a request exists. */
export function formatIncomingBioYourResponseHeading(row, bioKind) {
  const alias = String(row?.alias || '').trim();
  const requester =
    alias ||
    formatAliasWithMemberCode({
      alias: row?.alias,
      prefix: row?.prefix,
      memberId: row?.member_id
    }) ||
    'this member';
  if (bioKind === 'brief') {
    return `Your response to ${requester} Request to 'view your Brief Bio':`;
  }
  return `Your response to ${requester} Request to 'view your Full Bio':`;
}

function countInfoMatches(vetRow, fieldNames) {
  if (!vetRow || !fieldNames.length) return 0;
  return fieldNames.reduce((count, field) => (isVetBioInfoMatches(vetRow[field]) ? count + 1 : count), 0);
}

/** Round to whole % — matched count / BRIEF_BIO_VETTED_FIELDS.length. */
export function calcBriefBioMatchPercent(vetRow) {
  const matched = countInfoMatches(vetRow, BRIEF_BIO_VETTED_FIELDS);
  return Math.round((matched / BRIEF_BIO_VETTED_FIELDS.length) * 100);
}

/** Round to whole % — matched count / FULL_BIO_VETTED_FIELDS.length. */
export function calcFullBioMatchPercent(vetRow) {
  const matched = countInfoMatches(vetRow, FULL_BIO_VETTED_FIELDS);
  return Math.round((matched / FULL_BIO_VETTED_FIELDS.length) * 100);
}

export function calcBriefBioMatchPercentFromBioReview(bioReview) {
  return calcSelfReportCompletionPercent(bioReview, SELF_REPORT_COMPLETION_BRIEF_FIELD_KEYS);
}

export function calcFullBioMatchPercentFromBioReview(bioReview) {
  return calcSelfReportCompletionPercent(bioReview, SELF_REPORT_COMPLETION_FULL_FIELD_KEYS);
}

/**
 * Sidebar "My Self-Report-Bio" badge — completed count / 13 Self-Report fields only
 * (see SELF_REPORT_COMPLETION_FIELD_KEYS).
 */
export function calcSelfReportBioAverageCompletedPercent(bioReview) {
  return calcSelfReportCompletionPercent(bioReview, SELF_REPORT_COMPLETION_FIELD_KEYS);
}

const BRIEF_BIO_ROW_VET_FIELD = {
  profilePhoto: 'profilephoto_vetted',
  profileDlPhoto: 'profilephoto_vetted',
  profileLivePhoto: 'profilephoto_vetted',
  profilePpPhoto: 'profilephoto_vetted',
  firstname: 'firstname_vetted',
  middlename: 'middlename_vetted',
  lastname: 'lastname_vetted',
  age: 'age_vetted',
  height: 'height_vetted',
  gender: 'official_gender_vetted',
  current_city: 'current_city_vetted',
  citizenship: 'countryofcitizenship_vetted',
  placeOfBirth: 'countryofbirth_vetted'
};

const FULL_BIO_ROW_VET_FIELD = {
  company_domain_name: 'company_domain_name_vetted',
  current_company: 'current_company_vetted',
  job_title: 'job_title_vetted',
  college_name: 'college_name_vetted',
  highest_degree_completed: 'highest_degree_completed_vetted',
  professional_license: 'professional_license_vetted',
  degree_graduation_date: 'degree_graduation_date_vetted',
  linkedin_url: 'linkedin_url_vetted'
};

/** vet_bio *_vetted column for a bio-review table row, if any. */
export function getBioReviewRowVetColumn(row) {
  if (!row) return null;
  return (
    BRIEF_BIO_ROW_VET_FIELD[row.key] ??
    FULL_BIO_ROW_VET_FIELD[row.key] ??
    null
  );
}

/** Per-table-row match indicator from vet_bio (info_matches). */
export function isBioReviewRowInfoMatches(bioReview, row) {
  const vetRow = bioReview?.vetBio;
  if (!vetRow || !row) return false;
  const field = BRIEF_BIO_ROW_VET_FIELD[row.key] ?? FULL_BIO_ROW_VET_FIELD[row.key];
  if (!field) {
    return isVetBioInfoMatches(row.verificationStatus);
  }
  return isVetBioInfoMatches(vetRow[field]);
}
