import { getBioReviewRowVetColumn } from 'utils/receivedBioRequestDisplay';
import { normalizeVettingStatusKey } from 'utils/vettingStatusDisplay';

/** Rows that show a per-field Edit button in the bio tables. */
export function canPerFieldEditRow(row, sectionKey) {
  if (!row) return false;
  if (row.key === 'profilePhoto' || row.key === 'profileDlPhoto' || row.responseType === 'profilePhoto' || row.responseType === 'profileMatchPair') return false;
  if (sectionKey === 'miscBio') return true;
  if (sectionKey === 'briefBio') {
    return (
      row.key === 'firstname' ||
      row.key === 'middlename' ||
      row.key === 'lastname' ||
      row.key === 'age' ||
      row.key === 'height' ||
      row.key === 'gender' ||
      row.key === 'current_city' ||
      row.key === 'citizenship' ||
      row.key === 'placeOfBirth' ||
      row.key === 'govId' ||
      row.key === 'passportGovId'
    );
  }
  if (sectionKey === 'fullBio') return true;
  return false;
}

export function getDraftKeyForBioRow(row, sectionKey) {
  if (sectionKey === 'briefBio' && row.key === 'passportGovId') {
    return 'briefBio.govId';
  }
  return `${sectionKey}.${row.key}`;
}

export function fieldWasVerified(row) {
  const vetColumn = getBioReviewRowVetColumn(row);
  if (!vetColumn) return false;
  const key = normalizeVettingStatusKey(row.verificationStatus);
  return Boolean(key && key !== 'verification_not_started');
}

export const BIO_FIELD_EDIT_WARNING =
  "Warning: if this field has been verified, changing it will reset verification status to 'Not Started'";
