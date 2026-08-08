import { isAdminImpersonationSession } from './adminAuth.js';

/** Profile↔ID / live-scan percent match when admin impersonates (no AWS scan). */
export const ADMIN_IMPERSONATION_REKOGNITION_MATCH = 100;

const MOCK_STREETS = ['742 Evergreen Terrace', '123 Market St', '456 Oak Ave', '890 Cedar Ln'];
const MOCK_CITIES = ['Springfield', 'Fairview', 'Riverside', 'Madison'];
const MOCK_STATES = ['CA', 'TX', 'NY', 'FL', 'WA'];
const MOCK_COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Australia'];
const MOCK_NATIONALITY_CODES = ['USA', 'CAN', 'GBR', 'AUS'];
const MOCK_FIRST_NAMES = ['Alex', 'Jordan', 'Taylor', 'Casey', 'Morgan', 'Riley'];
const MOCK_LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Davis', 'Miller'];
const MOCK_MIDDLE_INITIALS = ['A', 'B', 'C', 'D', 'E', 'J', 'M', 'R'];

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function toTrimmedText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

/** Admin JWT impersonating a member — skip Rekognition OCR / face match / liveness. */
export function isAdminImpersonationRekognitionBypass(auth) {
  return isAdminImpersonationSession(auth);
}

/** 100% Match capture object used for DL, PP, and live scan columns. */
export function adminImpersonationMatchCapture(threshold = 90) {
  return {
    percentMatch: ADMIN_IMPERSONATION_REKOGNITION_MATCH,
    scanResult: 'Match',
    matched: true,
    faceMatchThreshold: threshold
  };
}

function randomAdultDob() {
  const year = 1975 + Math.floor(Math.random() * 30);
  const month = 1 + Math.floor(Math.random() * 12);
  const day = 1 + Math.floor(Math.random() * 28);
  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
}

function randomHeight() {
  const feet = 5 + Math.floor(Math.random() * 2);
  const inches = Math.floor(Math.random() * 12);
  return `${feet}'-${inches}"`;
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} singlesId
 */
export async function loadMemberBasicsForRekognitionBypass(db, singlesId) {
  const { rows } = await db.query(
    `SELECT s.alias,
            vb.firstname AS vb_firstname,
            vb.middlename AS vb_middlename,
            vb.lastname AS vb_lastname,
            vb.official_gender
     FROM helloworldjunktest.singles s
     LEFT JOIN helloworldjunktest.vet_bio vb ON vb.singles_id = s.singles_id
     WHERE s.singles_id = $1
     LIMIT 1`,
    [singlesId]
  );
  const row = rows[0] || {};
  return {
    firstName: toTrimmedText(row.vb_firstname) || toTrimmedText(row.alias),
    middleName: toTrimmedText(row.vb_middlename),
    lastName: toTrimmedText(row.vb_lastname),
    sex: toTrimmedText(row.official_gender)
  };
}

/**
 * Synthetic OCR fields for admin impersonation (driver license or passport slot).
 * @param {{ slotDocumentType: 'driver_license' | 'passport', member?: object }} opts
 */
export function buildMockIdCardParsedForAdminBypass({ slotDocumentType, member = {} }) {
  const firstName = toTrimmedText(member.firstName) || pickRandom(MOCK_FIRST_NAMES);
  const lastName = toTrimmedText(member.lastName) || pickRandom(MOCK_LAST_NAMES);
  const middleInitial = toTrimmedText(member.middleName)?.slice(0, 1) || pickRandom(MOCK_MIDDLE_INITIALS);
  const sexRaw = toTrimmedText(member.sex);
  const sex = sexRaw && /^[mf]/i.test(sexRaw) ? sexRaw.charAt(0).toUpperCase() : pickRandom(['M', 'F']);
  const city = pickRandom(MOCK_CITIES);
  const state = pickRandom(MOCK_STATES);
  const country = pickRandom(MOCK_COUNTRIES);
  const nationalityCode = pickRandom(MOCK_NATIONALITY_CODES);

  const base = {
    firstName,
    middleInitial,
    middleName: middleInitial,
    lastName,
    address: pickRandom(MOCK_STREETS),
    city,
    state,
    dateOfBirth: randomAdultDob(),
    sex,
    height: randomHeight(),
    documentType: slotDocumentType
  };

  if (slotDocumentType === 'passport') {
    return {
      ...base,
      countryOfCitizenship: country,
      countryOfBirth: country,
      ppNationality: nationalityCode
    };
  }

  return base;
}
