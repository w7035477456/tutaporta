import pool from '../../db/connection.js';
import { MISC_BIO_FIELD_KEYS, loadTableColumns, resolveBioSchema, sqlIdent } from './checkrBioReviewDb.js';
import { resolveRequestsAppSchema } from './resolveRequestsAppSchema.js';
import { briefBioApprovalSelectExpr, fullBioApprovalSelectExpr } from './requestApprovalSql.js';
import {
  formatCapitalizedFullName
} from './fullNameFormat.js';
import { formatBriefBioGovIdDisplay, formatPassportGovIdDisplay, readCitizenshipDisplayValue, readPlaceOfBirthDisplayValue } from '../../utils/govIdDocumentLabels.js';
import { normalizeApprovalStatus, APPROVAL_STATUS_APPROVE } from '../../utils/approvalStatusEnum.js';
import { isRegularMemberCategory } from '../../utils/memberCategory.js';

function readVettedGroup(row, prefix) {
  const responseKey = prefix;
  const hasVetted =
    row &&
    (`${prefix}_vetted` in row ||
      `${prefix}_vetted_date` in row ||
      `${prefix}_vetted_note` in row ||
      responseKey in row);
  if (!hasVetted) return null;
  return {
    response: row[responseKey] ?? null,
    verificationStatus: row[`${prefix}_vetted`] ?? null,
    vettedDate: row[`${prefix}_vetted_date`] ?? null,
    vettedNote: row[`${prefix}_vetted_note`] ?? null
  };
}

function vettedBioRow(vetRow, key, label, extra = {}) {
  const group = readVettedGroup(vetRow, key);
  return {
    key,
    label,
    response: group?.response ?? null,
    verificationStatus: group?.verificationStatus ?? null,
    vettedDate: group?.vettedDate ?? null,
    vettedNote: group?.vettedNote ?? null,
    ...extra
  };
}

function readMiscField(row, key) {
  if (!row || !(key in row)) return { response: null };
  return { response: row[key] ?? null };
}

function buildFullName(singlesRow) {
  const parts = [singlesRow?.mailing_firstname, singlesRow?.mailing_middlename, singlesRow?.mailing_lastname]
    .map((p) => String(p ?? '').trim())
    .filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

function triStateApproval(value) {
  return normalizeApprovalStatus(value) ?? normalizeApprovalStatus(null);
}

function readNamePartValue(vetRow, singlesRow, vetKey, mailingKey) {
  const fromVet = String(vetRow?.[vetKey] ?? '').trim();
  if (fromVet) return fromVet;
  const fromMailing = String(singlesRow?.[mailingKey] ?? '').trim();
  return fromMailing || null;
}

function buildMergedVetRowForNames(vetRow, singlesRow) {
  return {
    ...vetRow,
    firstname: readNamePartValue(vetRow, singlesRow, 'firstname', 'mailing_firstname'),
    middlename: readNamePartValue(vetRow, singlesRow, 'middlename', 'mailing_middlename'),
    lastname: readNamePartValue(vetRow, singlesRow, 'lastname', 'mailing_lastname')
  };
}

function buildDisplayName(vetRow, singlesRow) {
  const merged = buildMergedVetRowForNames(vetRow, singlesRow);
  return (
    formatCapitalizedFullName(merged.firstname, merged.middlename, merged.lastname) ||
    buildFullName(singlesRow) ||
    null
  );
}

function readHeightDisplayValue(singlesRow, vetRow) {
  const fromDl = String(singlesRow?.dl_height ?? '').trim();
  if (fromDl) return fromDl;
  return String(vetRow?.height ?? '').trim() || null;
}

function formatDlSexDisplay(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const upper = text.toUpperCase();
  if (upper === 'M' || upper === 'MALE') return 'Male';
  if (upper === 'F' || upper === 'FEMALE') return 'Female';
  if (text.toLowerCase() === 'not found') return 'not found';
  return text;
}

function readGenderDisplayValue(singlesRow, vetRow) {
  const fromDl = formatDlSexDisplay(singlesRow?.dl_sex);
  if (fromDl) return fromDl;
  return formatDlSexDisplay(vetRow?.official_gender);
}

function buildVerifiedDlLegalName(singlesRow) {
  const firstname = String(singlesRow?.dl_firstname ?? '').trim();
  const middlename = String(singlesRow?.dl_middlename ?? '').trim();
  const lastname = String(singlesRow?.dl_lastname ?? '').trim();
  return {
    firstname: firstname || null,
    middlename: middlename || null,
    lastname: lastname || null,
    fullName: formatCapitalizedFullName(firstname, middlename, lastname) || null
  };
}

function readMatchPercent(raw) {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function readProfileDlVettedGroup(singlesRow, vetRow) {
  const dl = readMatchPercent(singlesRow?.dl_profile_percent_match);
  const scanResult = String(singlesRow?.dl_profile_scan_result ?? '').trim();
  const fromVet = readVettedGroup(vetRow, 'profilephoto');
  const note = dl != null ? `DL ${dl}%` : null;
  if (scanResult === 'Match') {
    return {
      verificationStatus: 'info_matches',
      vettedDate: fromVet?.vettedDate ?? null,
      vettedNote: note ?? fromVet?.vettedNote ?? null
    };
  }
  if (scanResult === 'Not Match') {
    return {
      verificationStatus: 'info_not_matches',
      vettedDate: fromVet?.vettedDate ?? null,
      vettedNote: note ?? fromVet?.vettedNote ?? null
    };
  }
  if (note) {
    return {
      verificationStatus: fromVet?.verificationStatus ?? null,
      vettedDate: fromVet?.vettedDate ?? null,
      vettedNote: note
    };
  }
  return fromVet;
}

function readProfileLiveVettedGroup(singlesRow, vetRow) {
  const live = readMatchPercent(singlesRow?.live_scan_percent_match);
  const fromVet = readVettedGroup(vetRow, 'profilephoto');
  const note = live != null ? `LIVE ${live}%` : null;
  if (live != null && live >= 80) {
    return {
      verificationStatus: 'info_matches',
      vettedDate: fromVet?.vettedDate ?? null,
      vettedNote: note
    };
  }
  if (live != null) {
    return {
      verificationStatus: 'info_not_matches',
      vettedDate: fromVet?.vettedDate ?? null,
      vettedNote: note
    };
  }
  return {
    verificationStatus: null,
    vettedDate: null,
    vettedNote: null
  };
}

function readProfilePpVettedGroup(singlesRow, vetRow) {
  const pp = readMatchPercent(singlesRow?.pp_profile_percent_match);
  const scanResult = String(singlesRow?.pp_profile_scan_result ?? '').trim();
  const fromVet = readVettedGroup(vetRow, 'profilephoto');
  const note = pp != null ? `PP ${pp}%` : null;
  if (scanResult === 'Match') {
    return {
      verificationStatus: 'info_matches',
      vettedDate: fromVet?.vettedDate ?? null,
      vettedNote: note ?? fromVet?.vettedNote ?? null
    };
  }
  if (scanResult === 'Not Match') {
    return {
      verificationStatus: 'info_not_matches',
      vettedDate: fromVet?.vettedDate ?? null,
      vettedNote: note ?? fromVet?.vettedNote ?? null
    };
  }
  if (pp != null) {
    return {
      verificationStatus: 'info_matches',
      vettedDate: fromVet?.vettedDate ?? null,
      vettedNote: note
    };
  }
  return {
    verificationStatus: null,
    vettedDate: null,
    vettedNote: null
  };
}

function memberHasPassportProfileMatch(singlesRow) {
  if (readMatchPercent(singlesRow?.pp_profile_percent_match) != null) return true;
  const govIds = singlesRow?.gov_id_array;
  if (Array.isArray(govIds) && govIds.some((entry) => /passport/i.test(String(entry ?? '')))) {
    return true;
  }
  return readCitizenshipDisplayValue(singlesRow?.pp_nationality) != null;
}

function buildProfileMatchPairRow(singlesRow, config) {
  const {
    key,
    label,
    matchKind,
    matchLabel,
    matchPercent,
    comparisonImageKind,
    primaryImagePhotosId,
    comparisonImagePhotosId,
    vetted
  } = config;
  return {
    key,
    label,
    response: singlesRow?.profile_image_fk ?? null,
    responseType: 'profileMatchPair',
    matchKind,
    matchLabel,
    matchPercent,
    comparisonImageKind,
    primaryImagePhotosId: primaryImagePhotosId ?? singlesRow?.profile_image_fk ?? null,
    comparisonImagePhotosId: comparisonImagePhotosId ?? null,
    singlesId: Number(singlesRow?.singles_id),
    verificationStatus: vetted?.verificationStatus ?? null,
    vettedDate: vetted?.vettedDate ?? null,
    vettedNote: vetted?.vettedNote ?? null
  };
}

function mergePassportSinglesVetting(vetGroup, displayValue, defaultNote) {
  if (displayValue == null) {
    return vetGroup ?? { response: null, verificationStatus: null, vettedDate: null, vettedNote: null };
  }
  const status = String(vetGroup?.verificationStatus ?? '').trim().toLowerCase();
  if (status === 'info_matches' || status === 'info_matched') {
    return {
      ...vetGroup,
      response: displayValue
    };
  }
  return {
    response: displayValue,
    verificationStatus: 'info_matches',
    vettedDate: vetGroup?.vettedDate ?? null,
    vettedNote: vetGroup?.vettedNote ?? defaultNote
  };
}

function readCitizenshipVettedGroup(singlesRow, vetRow) {
  const fromVet = readVettedGroup(vetRow, 'countryofcitizenship');
  const display = readCitizenshipDisplayValue(singlesRow?.pp_nationality);
  if (display == null) {
    return fromVet;
  }
  return mergePassportSinglesVetting(fromVet, display, 'Nationality from passport OCR');
}

function readPlaceOfBirthVettedGroup(singlesRow, vetRow) {
  const fromVet = readVettedGroup(vetRow, 'countryofbirth');
  const display = readPlaceOfBirthDisplayValue(singlesRow?.pp_place_of_birth);
  if (display == null) {
    return fromVet;
  }
  return mergePassportSinglesVetting(fromVet, display, 'Place of birth from passport OCR');
}

function buildBriefBioRows(singlesRow, vetRow) {
  const mergedVetRow = buildMergedVetRowForNames(vetRow, singlesRow);
  const forceRegularPhotoMatch = isRegularMemberCategory(singlesRow?.member_category);
  const regularMatchedVetted = {
    verificationStatus: 'info_matches',
    vettedDate: null,
    vettedNote: null
  };
  const profileDlVetted = forceRegularPhotoMatch
    ? { ...regularMatchedVetted, vettedNote: 'DL 100%' }
    : readProfileDlVettedGroup(singlesRow, vetRow);
  const profileLiveVetted = forceRegularPhotoMatch
    ? { ...regularMatchedVetted, vettedNote: 'LIVE 100%' }
    : readProfileLiveVettedGroup(singlesRow, vetRow);
  const profilePpVetted = forceRegularPhotoMatch
    ? { ...regularMatchedVetted, vettedNote: 'PP 100%' }
    : readProfilePpVettedGroup(singlesRow, vetRow);
  const ageVetted = readVettedGroup(vetRow, 'age');
  const heightVetted = readVettedGroup(vetRow, 'height');
  const genderVetted = readVettedGroup(vetRow, 'official_gender');
  const citizenshipVetted = readCitizenshipVettedGroup(singlesRow, vetRow);
  const placeOfBirthVetted = readPlaceOfBirthVettedGroup(singlesRow, vetRow);

  const rows = [
    buildProfileMatchPairRow(singlesRow, {
      key: 'profileDlPhoto',
      label: 'Profile&DL photo',
      matchKind: 'dl',
      matchLabel: 'DL',
      matchPercent: forceRegularPhotoMatch ? 100 : readMatchPercent(singlesRow?.dl_profile_percent_match),
      comparisonImageKind: 'driver_license',
      comparisonImagePhotosId: singlesRow?.dl_face_reference_photos_id ?? null,
      vetted: profileDlVetted
    }),
    buildProfileMatchPairRow(singlesRow, {
      key: 'profileLivePhoto',
      label: 'Profile&Live',
      matchKind: 'live',
      matchLabel: 'LIVE',
      matchPercent: forceRegularPhotoMatch ? 100 : readMatchPercent(singlesRow?.live_scan_percent_match),
      comparisonImageKind: 'profile',
      primaryImagePhotosId: singlesRow?.live_scan_reference_photos_id ?? null,
      comparisonImagePhotosId: singlesRow?.profile_image_fk ?? null,
      vetted: profileLiveVetted
    })
  ];

  if (forceRegularPhotoMatch || memberHasPassportProfileMatch(singlesRow)) {
    rows.push(
      buildProfileMatchPairRow(singlesRow, {
        key: 'profilePpPhoto',
        label: 'Profile&PP',
        matchKind: 'pp',
        matchLabel: 'PP',
        matchPercent: forceRegularPhotoMatch ? 100 : readMatchPercent(singlesRow?.pp_profile_percent_match),
        comparisonImageKind: 'passport',
        comparisonImagePhotosId: singlesRow?.pp_face_reference_photos_id ?? null,
        vetted: profilePpVetted
      })
    );
  }

  rows.push(
    vettedBioRow(mergedVetRow, 'firstname', 'First Name'),
    vettedBioRow(mergedVetRow, 'middlename', 'Middle Initial'),
    vettedBioRow(mergedVetRow, 'lastname', 'Last Name'),
    {
      key: 'age',
      label: 'Age',
      response: ageVetted?.response ?? null,
      verificationStatus: ageVetted?.verificationStatus ?? null,
      vettedDate: ageVetted?.vettedDate ?? null,
      vettedNote: ageVetted?.vettedNote ?? null
    },
    {
      key: 'height',
      label: 'Height',
      response: readHeightDisplayValue(singlesRow, vetRow),
      verificationStatus: heightVetted?.verificationStatus ?? null,
      vettedDate: heightVetted?.vettedDate ?? null,
      vettedNote: heightVetted?.vettedNote ?? null
    },
    {
      key: 'gender',
      label: 'Gender',
      response: readGenderDisplayValue(singlesRow, vetRow),
      verificationStatus: genderVetted?.verificationStatus ?? null,
      vettedDate: genderVetted?.vettedDate ?? null,
      vettedNote: genderVetted?.vettedNote ?? null
    },
    vettedBioRow(vetRow, 'current_city', 'Current City'),
    {
      key: 'citizenship',
      label: 'Citizenship',
      response: readCitizenshipDisplayValue(singlesRow?.pp_nationality),
      verificationStatus: citizenshipVetted?.verificationStatus ?? null,
      vettedDate: citizenshipVetted?.vettedDate ?? null,
      vettedNote: citizenshipVetted?.vettedNote ?? null
    },
    {
      key: 'placeOfBirth',
      label: 'Place of birth',
      response: readPlaceOfBirthDisplayValue(singlesRow?.pp_place_of_birth),
      verificationStatus: placeOfBirthVetted?.verificationStatus ?? null,
      vettedDate: placeOfBirthVetted?.vettedDate ?? null,
      vettedNote: placeOfBirthVetted?.vettedNote ?? null
    },
    {
      key: 'govId',
      label: 'Gov Id',
      response: formatBriefBioGovIdDisplay(singlesRow?.gov_id_array),
      hideVettingColumns: true
    }
  );

  if (memberHasPassportProfileMatch(singlesRow)) {
    rows.push({
      key: 'passportGovId',
      label: 'Gov Id',
      response: formatPassportGovIdDisplay(singlesRow?.gov_id_array, singlesRow?.pp_nationality),
      hideVettingColumns: true
    });
  }

  return rows;
}

function buildFullBioRows(miscRow, vetRow) {
  return [
    vettedBioRow(vetRow, 'company_domain_name', 'Company Domain'),
    vettedBioRow(vetRow, 'current_company', 'Employer Name'),
    vettedBioRow(vetRow, 'job_title', 'Job Title'),
    vettedBioRow(vetRow, 'linkedin_url', 'LinkedIn URL'),
    vettedBioRow(vetRow, 'college_name', 'College Name'),
    vettedBioRow(vetRow, 'highest_degree_completed', 'Highest Degree Completed'),
    vettedBioRow(vetRow, 'degree_graduation_date', 'Degree Graduation Date')
  ];
}

const MISC_BIO_ROWS = [
  { key: 'favorite_hobbies', label: 'Favorite hobbies' },
  { key: 'favorite_food', label: 'Favorite food' },
  { key: 'favorite_drinks', label: 'Favorite drinks' },
  { key: 'favorite_desserts', label: 'Favorite desserts' },
  { key: 'favorite_movie', label: 'Favorite movie' },
  { key: 'favorite_spectator_sport_team', label: 'Favorite TV Sport(s) and Team(s)' },
  { key: 'favorite_music', label: 'Favorite music' },
  { key: 'favorite_books', label: 'Favorite books' },
  { key: 'favorite_video_games', label: 'Favorite Video Game(s)' },
  { key: 'favorite_vacation_places', label: 'Favorite vacation places' },
  { key: 'favorite_memories', label: 'Favorite memories' },
  { key: 'children_info', label: 'Children info' },
  { key: 'marriage_history', label: 'Marriage history' },
  { key: 'ethnicity', label: 'Ethnicity' },
  { key: 'country_of_birth', label: 'Country of Birth' },
  { key: 'religion', label: 'Religion' }
].filter(({ key }) => MISC_BIO_FIELD_KEYS.has(key));

function buildMiscBioRows(miscRow) {
  return MISC_BIO_ROWS.map(({ key, label }) => ({
    key,
    label,
    response: miscRow?.[key] ?? null
  }));
}

async function loadBioReviewForSinglesId(singlesId) {
  const schemaName = await resolveBioSchema();
  const schema = sqlIdent(schemaName);

  const result = await pool.query(
    `SELECT
       s.singles_id,
       s.member_id,
       s.prefix,
       s.alias,
       s.member_category,
       s.profile_image_fk,
       s.mailing_firstname,
       s.mailing_lastname,
       s.mailing_middlename,
       s.dl_height,
       s.dl_sex,
       s.dl_firstname,
       s.dl_middlename,
       s.dl_lastname,
       s.pp_nationality,
       s.pp_place_of_birth,
       s.gov_id_array,
       s.dl_profile_percent_match,
       s.dl_profile_scan_result,
       s.pp_profile_percent_match,
       s.pp_profile_scan_result,
       s.live_scan_percent_match,
       (
         SELECT p.photos_id
         FROM ${schema}.photos p
         WHERE p.singles_id = s.singles_id
           AND lower(coalesce(p.photo_file_name, '')) LIKE 'live_scan_ref_%'
         ORDER BY p.photos_id DESC
         LIMIT 1
       ) AS live_scan_reference_photos_id,
       (
         SELECT p.photos_id
         FROM ${schema}.photos p
         WHERE p.singles_id = s.singles_id
           AND lower(coalesce(p.photo_file_name, '')) LIKE 'dl_face_ref_%'
         ORDER BY p.photos_id DESC
         LIMIT 1
       ) AS dl_face_reference_photos_id,
       (
         SELECT p.photos_id
         FROM ${schema}.photos p
         WHERE p.singles_id = s.singles_id
           AND lower(coalesce(p.photo_file_name, '')) LIKE 'pp_face_ref_%'
         ORDER BY p.photos_id DESC
         LIMIT 1
       ) AS pp_face_reference_photos_id,
       to_jsonb(vb) AS vet_bio,
       to_jsonb(mb) AS misc_bio
     FROM ${schema}.singles s
     LEFT JOIN ${schema}.vet_bio vb ON vb.singles_id = s.singles_id
     LEFT JOIN ${schema}.misc_bio mb ON mb.singles_id = s.singles_id
     WHERE s.singles_id = $1
     LIMIT 1`,
    [singlesId]
  );

  if (!result.rows.length) return null;

  const row = result.rows[0];
  const vetRow = row.vet_bio && typeof row.vet_bio === 'object' ? row.vet_bio : {};
  const miscRow = row.misc_bio && typeof row.misc_bio === 'object' ? row.misc_bio : {};

  const displayName =
    String(row.alias ?? '').trim() ||
    buildDisplayName(vetRow, row) ||
    'Member';

  return {
    member: {
      singlesId: row.singles_id,
      memberId: row.member_id ?? null,
      prefix: row.prefix ?? null,
      alias: row.alias ?? null,
      memberCategory: row.member_category ?? null,
      displayName
    },
    vetBio: vetRow,
    verifiedDlLegalName: buildVerifiedDlLegalName(row),
    briefBio: buildBriefBioRows(row, vetRow),
    fullBio: buildFullBioRows(miscRow, vetRow),
    miscBio: buildMiscBioRows(miscRow)
  };
}

function bioRowHasData(row) {
  if (!row) return false;
  if (row.responseType === 'profilePhoto' || row.responseType === 'profileMatchPair') {
    const id = Number(row.response);
    return Number.isFinite(id) && id > 0;
  }
  return String(row.response ?? '').trim().length > 0;
}

function redactBioRowForPreview(row) {
  const hasData = bioRowHasData(row);
  const next = {
    ...row,
    hasData,
    response: null,
    vettedNote: hasData ? null : row.vettedNote
  };
  if (row.responseType === 'profilePhoto' || row.responseType === 'profileMatchPair') {
    next.responseType = 'masked';
  }
  return next;
}

function redactBioReviewForPreview(bioReview) {
  if (!bioReview) return null;
  return {
    ...bioReview,
    vetBio: null,
    briefBio: (bioReview.briefBio || []).map(redactBioRowForPreview),
    fullBio: (bioReview.fullBio || []).map(redactBioRowForPreview),
    miscBio: (bioReview.miscBio || []).map(redactBioRowForPreview)
  };
}

async function loadOutgoingBioRequestExists(viewerSinglesId, targetSinglesId) {
  const requestSchemaName = await resolveRequestsAppSchema();
  const requestSchema = sqlIdent(requestSchemaName);
  const result = await pool.query(
    `SELECT 1
     FROM ${requestSchema}.requests r
     WHERE r.singles_id_from = $1
       AND r.singles_id_to = $2
     LIMIT 1`,
    [viewerSinglesId, targetSinglesId]
  );
  return result.rows.length > 0;
}

async function loadOutgoingBioApproval(viewerSinglesId, targetSinglesId) {
  const requestSchemaName = await resolveRequestsAppSchema();
  const requestSchema = sqlIdent(requestSchemaName);
  const requestCols = await loadTableColumns(requestSchemaName, 'requests');
  const briefApprovalExpr = briefBioApprovalSelectExpr(requestCols, 'r');
  const fullApprovalExpr = fullBioApprovalSelectExpr(requestCols, 'r');

  const result = await pool.query(
    `SELECT
       ${briefApprovalExpr} AS brief_bio_request_approval,
       ${fullApprovalExpr} AS full_bio_request_approval
     FROM ${requestSchema}.requests r
     WHERE r.singles_id_from = $1
       AND r.singles_id_to = $2
     ORDER BY
       COALESCE(r.updated_at, r.created_at) DESC,
       r.requests_id DESC
     LIMIT 1`,
    [viewerSinglesId, targetSinglesId]
  );

  const row = result.rows[0] ?? {};
  return {
    brief: triStateApproval(row.brief_bio_request_approval) === APPROVAL_STATUS_APPROVE,
    full: triStateApproval(row.full_bio_request_approval) === APPROVAL_STATUS_APPROVE
  };
}

/**
 * GET /api/checkr/bio-review
 * Returns Brief Bio, Full Bio, and Misc Bio rows for the logged-in member.
 */
export async function getCheckrBioReview(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const bioReview = await loadBioReviewForSinglesId(singlesId);
    if (!bioReview) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(bioReview);
  } catch (error) {
    console.error('[checkr:getBioReview]', error?.message || error);
    return res.status(500).json({ error: 'Failed to load bio review data' });
  }
}

/**
 * GET /api/checkr/bio-review/member/:targetSinglesId
 * Returns another member's self-report bio rows only for request-approved sections.
 */
export async function getApprovedCheckrBioReview(req, res) {
  const viewerSinglesId = Number(req.auth?.singles_id);
  const targetSinglesId = Number(req.params?.targetSinglesId);
  if (!Number.isFinite(viewerSinglesId) || viewerSinglesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!Number.isFinite(targetSinglesId) || targetSinglesId < 1) {
    return res.status(400).json({ error: 'Invalid member' });
  }

  try {
    const access = await loadOutgoingBioApproval(viewerSinglesId, targetSinglesId);
    if (!access.brief && !access.full) {
      return res.status(403).json({ error: 'No approved bio request found for this member' });
    }

    const bioReview = await loadBioReviewForSinglesId(targetSinglesId);
    if (!bioReview) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Full Bio (Buddies) is a superset of Brief Bio (Acquaintance) — include brief rows with full.
    const includeBrief = Boolean(access.brief || access.full);
    const includeFull = Boolean(access.full);

    return res.json({
      ...bioReview,
      access: {
        ...access,
        brief: includeBrief,
        full: includeFull
      },
      briefBio: includeBrief ? bioReview.briefBio : [],
      fullBio: includeFull ? bioReview.fullBio : [],
      miscBio: includeFull ? bioReview.miscBio : []
    });
  } catch (error) {
    console.error('[checkr:getApprovedBioReview]', error?.message || error);
    return res.status(500).json({ error: 'Failed to load approved bio review data' });
  }
}

/**
 * GET /api/checkr/bio-review/member/:targetSinglesId/preview
 * Masked bio rows for a vetted-friends target (hasData + matching status only).
 */
export async function getMemberCheckrBioReviewPreview(req, res) {
  const viewerSinglesId = Number(req.auth?.singles_id);
  const targetSinglesId = Number(req.params?.targetSinglesId);
  if (!Number.isFinite(viewerSinglesId) || viewerSinglesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!Number.isFinite(targetSinglesId) || targetSinglesId < 1) {
    return res.status(400).json({ error: 'Invalid member' });
  }

  try {
    const hasRequest = await loadOutgoingBioRequestExists(viewerSinglesId, targetSinglesId);
    if (!hasRequest) {
      return res.status(403).json({ error: 'No bio request found for this member' });
    }

    const bioReview = await loadBioReviewForSinglesId(targetSinglesId);
    if (!bioReview) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const access = await loadOutgoingBioApproval(viewerSinglesId, targetSinglesId);
    return res.json({
      ...redactBioReviewForPreview(bioReview),
      access
    });
  } catch (error) {
    console.error('[checkr:getMemberBioReviewPreview]', error?.message || error);
    return res.status(500).json({ error: 'Failed to load bio preview' });
  }
}
