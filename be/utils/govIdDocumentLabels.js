/** Human-readable labels stored in singles.gov_id_array. */
import { normalizePassportPlaceOfBirthDisplay } from './idCardOcrParse.js';

export const GOV_ID_DOCUMENT_LABELS = {
  driver_license: 'Driver License',
  passport: 'Passport',
  passportCard: 'Passport Card'
};

/** ISO3 passport nationality → country name for Gov Id display. */
const NATIONALITY_COUNTRY_NAMES = {
  USA: 'United States',
  GBR: 'United Kingdom',
  CAN: 'Canada',
  MEX: 'Mexico',
  AUS: 'Australia',
  DEU: 'Germany',
  FRA: 'France',
  IND: 'India',
  CHN: 'China',
  JPN: 'Japan',
  VNM: 'Vietnam'
};

const US_STATE_ABBREV_TO_NAME = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming'
};

function isPassportGovIdEntry(entry) {
  return /passport/i.test(String(entry ?? ''));
}

function isDriverLicenseGovIdEntry(entry) {
  return /driver\s*license/i.test(String(entry ?? ''));
}

export function formatUsStateDisplay(stateText) {
  const text = String(stateText ?? '').trim();
  if (!text) return null;
  const upper = text.toUpperCase();
  if (US_STATE_ABBREV_TO_NAME[upper]) return US_STATE_ABBREV_TO_NAME[upper];
  return text
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function nationalityCodeToCountryName(code) {
  const text = String(code ?? '').trim().toUpperCase();
  if (!text) return null;
  return NATIONALITY_COUNTRY_NAMES[text] || text;
}

export function formatGovIdDocumentLabel(documentType, { state = null, nationalityCode = null } = {}) {
  const base = GOV_ID_DOCUMENT_LABELS[String(documentType || '').trim()];
  if (!base) return null;

  if (documentType === 'driver_license') {
    const stateLabel = formatUsStateDisplay(state);
    return stateLabel ? `${base} - ${stateLabel}` : base;
  }

  if (documentType === 'passport' || documentType === 'passportCard') {
    const country = nationalityCodeToCountryName(nationalityCode);
    if (country) return `${country} Passport`;
    return base;
  }

  return base;
}

/** Legacy join of all gov_id_array entries (admin edits, older callers). */
export function formatGovIdArrayDisplay(govIdArray) {
  if (!Array.isArray(govIdArray) || !govIdArray.length) return null;
  const parts = govIdArray.map((item) => String(item ?? '').trim()).filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

/** Brief Bio Gov Id — driver license only (with state when captured). */
export function formatBriefBioGovIdDisplay(govIdArray) {
  if (!Array.isArray(govIdArray) || !govIdArray.length) return null;
  const parts = govIdArray
    .map((item) => String(item ?? '').trim())
    .filter((item) => item && isDriverLicenseGovIdEntry(item));
  return parts.length ? parts.join(', ') : null;
}

/** Optional Passport section Gov Id — passport with issuing country when known. */
export function formatPassportGovIdDisplay(govIdArray, ppNationality) {
  const nationality = readCitizenshipDisplayValue(ppNationality);
  const hasPassportEntry = Array.isArray(govIdArray) && govIdArray.some(isPassportGovIdEntry);
  if (!hasPassportEntry && !nationality) return null;

  if (nationality) {
    const country = nationalityCodeToCountryName(nationality);
    return country ? `${country} Passport` : 'Passport';
  }

  const passportEntry = govIdArray.find(isPassportGovIdEntry);
  return passportEntry || 'Passport';
}

/** Parse Brief Bio Gov Id edit value into singles.gov_id_array entries. */
export function parseGovIdArrayFromEdit(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const parts = text.split(',').map((item) => item.trim()).filter(Boolean);
  return parts.length ? parts : null;
}

/** Display value for Brief Bio Citizenship row (singles.pp_nationality). */
export function readCitizenshipDisplayValue(ppNationality) {
  const text = String(ppNationality ?? '').trim();
  if (!text || text.toLowerCase() === 'not found') return null;
  return text;
}

/** Display value for Brief Bio Place of birth row (singles.pp_place_of_birth). */
export function readPlaceOfBirthDisplayValue(ppPlaceOfBirth) {
  return normalizePassportPlaceOfBirthDisplay(ppPlaceOfBirth);
}
