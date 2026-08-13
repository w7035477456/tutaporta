import {
  formatCapitalizedFullName,
  formatCapitalizedFullNameString,
  parseFullNameParts
} from '../routes/singles/fullNameFormat.js';

const DOB_PATTERNS = [
  /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/g,
  /\b(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(\d{2,4})\b/gi
];

const DOB_LABEL_PREFIX = String.raw`(?:\d+\.?\s*)?`;
const DOB_LABEL_CORE = String.raw`(?:DOB|DATE\s+OF\s+BIRTH|BIRTH\s+DATE)`;
const DOB_LABEL_PATTERN = new RegExp(`\\b${DOB_LABEL_PREFIX}${DOB_LABEL_CORE}\\b`, 'i');

const STREET_HINT = /\b(ST|STREET|AVE|AVENUE|RD|ROAD|DR|DRIVE|LN|LANE|BLVD|CT|COURT|WAY|PL|PLACE)\b/i;
const ZIP_PATTERN = /\b\d{5}(?:-\d{4})?\b/;
const STATE_ZIP_TAIL = /(?:[A-Z]{2}|[A-Za-z]{4,})\s+\d{5}(?:-\d{4})?\s*$/i;

/** OCR lines that are not a cardholder name (issuer text, business names, etc.). */
const NON_PERSON_NAME_HINT =
  /\b(SERVICE|SERVICES|QUALITY|CUILITY|COMPANY|CORP|LLC|INC|DEPARTMENT|MOTOR|VEHICLE|DMV|COMMONWEALTH|DRIVER|LICENSE|VIRGINIA|UNITED|STATE|END|NONE|RESTRICTION|PASSPORT|PASSEPORT|PASAPORTE|REISEPASS|NATIONALITY|AUTHORIT|SIGNATURE|BEARER|TRAVEL|DOCUMENT|DEPARTMENT OF STATE)\b/i;

const ID_FIELD_SKIP =
  /\b(DRIVER|LICENSE|IDENTIFICATION|CARD|USA|UNITED|STATE|DEPARTMENT|CLASS|RESTRICTIONS|ENDORSEMENTS|ISS|EXP|SEX|HT|WGT|EYES|DD|ID|DOB|ORGAN|DONOR|PASSPORT|PASSEPORT|PASAPORTE|NATIONALITY|PLACE OF BIRTH|DATE OF|EXPIRATION|AUTHORITY)\b/i;

const PASSPORT_DOC_HINT = /\b(PASSPORT|PASSEPORT|PASAPORTE|REISEPASS)\b/i;

const PASSPORT_CARD_HINT = /\bPASSPORT\s+CARD\b/i;

const PASSPORT_NATIONALITY_CODE = {
  'UNITED STATES OF AMERICA': 'USA',
  'UNITED STATES': 'USA',
  'U.S.A.': 'USA',
  'U.S.A': 'USA',
  USA: 'USA',
  'BRITISH CITIZEN': 'GBR',
  BRITISH: 'GBR',
  'UNITED KINGDOM': 'GBR',
  'GREAT BRITAIN': 'GBR',
  GBR: 'GBR'
};

/** Multilingual passport title / label-only lines (not the holder name). */
const PASSPORT_TITLE_LINE =
  /^(?:PASSPORT|PASSEPORT|PASAPORTE|REISEPASS)(?:\s+(?:PASSPORT|PASSEPORT|PASAPORTE|REISEPASS))*$/i;

const PASSPORT_LABEL_ONLY =
  /\b(Surname\/Nom|Given\s+names\/Pr|Apellidos|Pr[eéè]noms|Nombres|Nationalit[eé]|Type\/Type|Tipo)\b/i;

function normalizeYear(y) {
  const n = parseInt(y, 10);
  if (!Number.isFinite(n)) return null;
  if (n < 100) return n >= 30 ? 1900 + n : 2000 + n;
  return n;
}

const MONTH_ABBR = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12
};

function parseMonthToken(month) {
  const n = parseInt(month, 10);
  if (Number.isFinite(n)) return n;
  return MONTH_ABBR[String(month ?? '').slice(0, 3).toUpperCase()] ?? null;
}

function formatDob(month, day, year) {
  const m = parseMonthToken(month);
  const d = parseInt(day, 10);
  const y = normalizeYear(year);
  if (!Number.isFinite(m) || !Number.isFinite(d) || !Number.isFinite(y)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${mm}/${dd}/${y}`;
}

function extractDateFromText(text) {
  const source = String(text ?? '');
  if (!source) return null;
  for (let pi = 0; pi < DOB_PATTERNS.length; pi += 1) {
    const pattern = DOB_PATTERNS[pi];
    pattern.lastIndex = 0;
    let match = pattern.exec(source);
    while (match) {
      const formatted =
        pi === 1 ? formatDob(match[2], match[1], match[3]) : formatDob(match[1], match[2], match[3]);
      if (formatted) return formatted;
      match = pattern.exec(source);
    }
  }
  // Passport dual-language DOB: "17 FEB / FEV 77", "24 FEB / FEB 87"
  const dualLang = source.match(
    /\b(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*(?:\s*\/\s*[A-Z]{3,4})?\s+(\d{2,4})\b/i
  );
  if (dualLang) {
    const formatted = formatDob(dualLang[2], dualLang[1], dualLang[3]);
    if (formatted) return formatted;
  }
  return null;
}

function isDobLabelLine(line) {
  const text = String(line ?? '');
  if (!text.trim()) return false;
  if (/\bPLACE\s+OF\s+BIRTH\b/i.test(text)) return false;
  if (DOB_LABEL_PATTERN.test(text)) return true;
  if (/\bDATE\s+OF\s+BIRTH\b/i.test(text)) return true;
  if (/\bD[O0][B8]\b/i.test(text) && /\b(?:DATE|BIRTH|DOB)\b/i.test(text)) return true;
  if (/\bDATE\s+O[F\s]+BIRTH\b/i.test(text)) return true;
  return false;
}

/** OCR sometimes splits "Date of Birth" across two lines. */
function isDateOfLabelStart(line) {
  const text = String(line ?? '').trim();
  return /\bDATE\s+OF\b/i.test(text) && !/\b(?:BIRTH|PLACE)\b/i.test(text);
}

function isBirthLabelContinuation(line) {
  return /^\s*BIRTH\s*:?\s*$/i.test(String(line ?? '').trim());
}

function dobLabelEndIndex(lines, startIndex) {
  if (
    isDateOfLabelStart(lines[startIndex]) &&
    isBirthLabelContinuation(lines[startIndex + 1])
  ) {
    return startIndex + 1;
  }
  return startIndex;
}

function isIssueOrExpiryLine(line) {
  return /\b(ISS|ISSUED|EXP|EXPIR|EXPIRES|EXPIRATION|ISS\s+REN)\b/i.test(line);
}

function isPlausibleBirthDate(formatted) {
  const year = parseInt(String(formatted).split('/')[2], 10);
  if (!Number.isFinite(year)) return false;
  const nowYear = new Date().getFullYear();
  return year >= nowYear - 120 && year <= nowYear - 16;
}

/** Date immediately after a DOB / Date of Birth label (same text chunk). */
function extractDobAdjacentToLabel(text) {
  const source = String(text ?? '');
  if (!source || !DOB_LABEL_PATTERN.test(source)) return null;
  if (/\bPLACE\s+OF\s+BIRTH\b/i.test(source)) return null;

  const beforeMatch = source.match(
    new RegExp(
      String.raw`\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\s*${DOB_LABEL_PREFIX}${DOB_LABEL_CORE}\b`,
      'i'
    )
  );
  if (beforeMatch) {
    const formatted = formatDob(beforeMatch[1], beforeMatch[2], beforeMatch[3]);
    if (formatted && isPlausibleBirthDate(formatted)) return formatted;
  }

  const numericMatch = source.match(
    new RegExp(
      String.raw`\b${DOB_LABEL_PREFIX}${DOB_LABEL_CORE}\s*:?\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b`,
      'i'
    )
  );
  if (numericMatch) {
    const formatted = formatDob(numericMatch[1], numericMatch[2], numericMatch[3]);
    if (formatted && isPlausibleBirthDate(formatted)) return formatted;
  }

  const monthMatch = source.match(
    new RegExp(
      String.raw`\b${DOB_LABEL_PREFIX}${DOB_LABEL_CORE}\s*:?\s*(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(\d{2,4})\b`,
      'i'
    )
  );
  if (monthMatch) {
    const formatted = formatDob(monthMatch[2], monthMatch[1], monthMatch[3]);
    if (formatted && isPlausibleBirthDate(formatted)) return formatted;
  }

  return null;
}

function findDateOnPrecedingLine(lines, labelIndex) {
  if (labelIndex <= 0) return null;
  const prev = lines[labelIndex - 1];
  if (!prev || isIssueOrExpiryLine(prev) || isDobLabelLine(prev)) return null;
  const adjacent = extractDateFromText(prev);
  if (adjacent && isPlausibleBirthDate(adjacent)) return adjacent;
  return null;
}

function findDateOnFollowingLines(lines, afterIndex, maxLookahead = 3) {
  for (let j = 1; j <= maxLookahead; j += 1) {
    const next = lines[afterIndex + j];
    if (!next) break;
    if (isIssueOrExpiryLine(next)) continue;
    if (isBirthLabelContinuation(next)) continue;
    const adjacent = extractDateFromText(next);
    if (adjacent && isPlausibleBirthDate(adjacent)) return adjacent;
  }
  return null;
}

/**
 * Only extract DOB when it appears next to DOB or "Date of Birth" — never guess from ISS/EXP/DD dates.
 * @param {string[]} lines
 * @param {{ maxLookahead?: number }} [options] — Tesseract backup uses wider lookahead (date on line below label).
 * @returns {string|null} MM/DD/YYYY or null
 */
export function findDateOfBirth(lines, { maxLookahead = 3 } = {}) {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!isDobLabelLine(line) && !isDateOfLabelStart(line)) continue;

    const inline = extractDobAdjacentToLabel(line);
    if (inline) return inline;

    const beforeLabel = findDateOnPrecedingLine(lines, i);
    if (beforeLabel) return beforeLabel;

    const afterLabel = findDateOnFollowingLines(lines, dobLabelEndIndex(lines, i), maxLookahead);
    if (afterLabel) return afterLabel;
  }

  const blob = lines.join(' ');
  const fromBlob = extractDobAdjacentToLabel(blob);
  if (fromBlob) return fromBlob;

  if (isPassportDocument(lines)) {
    const mrz = parseMrzLine2Record(lines);
    if (mrz?.dateOfBirth) return mrz.dateOfBirth;
  }

  return null;
}

/** Tesseract backup — Virginia and similar IDs often print DOB date on the next line below the label. */
export function findDateOfBirthFromTesseractLines(lines) {
  return findDateOfBirth(lines, { maxLookahead: 5 });
}

function detectionBBox(item) {
  const box = item?.Geometry?.BoundingBox;
  if (!box) return null;
  const left = Number(box.Left) || 0;
  const top = Number(box.Top) || 0;
  const width = Number(box.Width) || 0;
  const height = Number(box.Height) || 0;
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    cx: left + width / 2,
    cy: top + height / 2
  };
}

function isDobLabelText(text) {
  const source = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!source) return false;
  if (/\bPLACE\s+OF\s+BIRTH\b/i.test(source)) return false;
  return DOB_LABEL_PATTERN.test(source) || isDateOfLabelStart(source);
}

/** Group Rekognition WORD boxes into horizontal text rows (backup when LINE merge fails). */
export function buildSyntheticLinesFromWordDetections(detections) {
  const words = (detections || [])
    .filter((d) => d?.Type === 'WORD' && d?.DetectedText && d?.Geometry?.BoundingBox)
    .map((d) => {
      const box = detectionBBox(d);
      return {
        text: String(d.DetectedText).trim(),
        top: box.top,
        left: box.left,
        height: box.height
      };
    })
    .filter((w) => w.text);

  if (!words.length) return [];

  words.sort((a, b) => a.top - b.top || a.left - b.left);

  const rows = [];
  let current = [];
  let rowTop = null;

  for (const word of words) {
    const threshold = Math.max(word.height, 0.012) * 0.65;
    if (rowTop == null || Math.abs(word.top - rowTop) <= threshold) {
      current.push(word);
      rowTop = rowTop == null ? word.top : (rowTop + word.top) / 2;
    } else {
      if (current.length) rows.push(current);
      current = [word];
      rowTop = word.top;
    }
  }
  if (current.length) rows.push(current);

  return rows.map((row) => {
    row.sort((a, b) => a.left - b.left);
    return row.map((w) => w.text).join(' ');
  });
}

/**
 * Spatial backup: find a birth date whose OCR box sits beside a DOB / Date of Birth label box.
 * Uses Rekognition geometry only — still requires an adjacent DOB label (never raw date guessing).
 * @param {Array<{ Type?: string, DetectedText?: string, Geometry?: object }>} detections
 * @returns {string|null}
 */
export function findDateOfBirthFromSpatialDetections(detections) {
  const items = (detections || []).filter(
    (d) => d?.DetectedText && (d.Type === 'LINE' || d.Type === 'WORD') && d?.Geometry?.BoundingBox
  );

  const labels = items.filter((d) => isDobLabelText(d.DetectedText));
  if (!labels.length) return null;

  const dateItems = items.filter((d) => {
    const text = String(d.DetectedText ?? '').trim();
    if (!text || isIssueOrExpiryLine(text)) return false;
    const formatted = extractDateFromText(text);
    return formatted && isPlausibleBirthDate(formatted);
  });

  for (const label of labels) {
    const lb = detectionBBox(label);
    if (!lb) continue;

    for (const cand of dateItems) {
      const cb = detectionBBox(cand);
      if (!cb) continue;

      const rowTol = Math.max(lb.height, cb.height, 0.012) * 0.85;
      const sameRow = Math.abs(cb.cy - lb.cy) <= rowTol;
      const toRight = sameRow && cb.left >= lb.right - lb.width * 0.15;
      const below =
        cb.top >= lb.top + lb.height * 0.35 &&
        cb.top <= lb.bottom + Math.max(lb.height, cb.height) * 2.5 &&
        cb.cx >= lb.left - 0.08 &&
        cb.cx <= lb.right + Math.max(lb.width, cb.width) * 2;

      if (!toRight && !below) continue;

      const formatted = extractDateFromText(String(cand.DetectedText ?? ''));
      if (formatted && isPlausibleBirthDate(formatted)) return formatted;
    }
  }

  return null;
}

/**
 * Build DOB trace summary from completed step results (for API + UI).
 * @param {Array<{ key: string, label: string, dob: string|null, found: boolean, error?: string }>} steps
 */
function stepValue(step) {
  return step?.value ?? step?.dob ?? step?.sex ?? null;
}

export function buildDobOcrTraceFromSteps(steps) {
  const winner = steps.find((step) => step.found && stepValue(step)) || null;
  return {
    steps,
    selectedStep: winner?.key ?? null,
    selectedDob: stepValue(winner) ?? null,
    allFailed: !winner,
    tesseractPassRan: steps.some((s) => s.key === 'tesseract' || s.key === 'tesseract-enhanced')
  };
}

export function buildSexOcrTraceFromSteps(steps) {
  const winner = steps.find((step) => step.found && stepValue(step)) || null;
  return {
    steps,
    selectedStep: winner?.key ?? null,
    selectedSex: stepValue(winner) ?? null,
    allFailed: !winner,
    tesseractPassRan: steps.some((s) => s.key === 'tesseract' || s.key === 'tesseract-enhanced')
  };
}

function findAddress(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!/\d/.test(line) || !STREET_HINT.test(line)) continue;
    const parts = [line.trim()];
    const next = lines[i + 1];
    if (next && (ZIP_PATTERN.test(next) || /[A-Z]{2}\s*\d{5}/i.test(next))) {
      parts.push(next.trim());
    }
    return parts.join(', ');
  }
  const zipLine = lines.find((line) => ZIP_PATTERN.test(line) && /[A-Za-z]/.test(line));
  return zipLine || null;
}

function titleCaseWord(word) {
  if (!word) return '';
  const lower = String(word).toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function titleCaseCity(city) {
  return String(city || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((part) => titleCaseWord(part))
    .join(' ');
}

/**
 * @param {string} addressText
 * @returns {string|null}
 */
export function extractCityFromAddress(addressText) {
  const address = String(addressText ?? '').trim();
  if (!address) return null;

  // "street, CITY, ST 12345" (common on US licenses)
  const cityCommaState = address.match(/,\s*([A-Za-z][A-Za-z .'-]+?)\s*,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\s*$/i);
  if (cityCommaState?.[1]) {
    return titleCaseCity(cityCommaState[1]);
  }

  // "street, CITY ST 12345"
  const cityBeforeState = address.match(/,\s*([A-Za-z][A-Za-z .'-]+?)\s+(?:[A-Z]{2}|[A-Za-z]{4,})\s+\d{5}(?:-\d{4})?\s*$/i);
  if (cityBeforeState?.[1]) {
    return titleCaseCity(cityBeforeState[1]);
  }

  // "CITY, ST 12345" (address line 2 only)
  const cityLine = address.match(/^([A-Za-z][A-Za-z .'-]+?)\s*,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\s*$/i);
  if (cityLine?.[1]) {
    return titleCaseCity(cityLine[1]);
  }

  return null;
}

/** US state from license address (e.g. "Annandale, VA 22003"). */
export function extractStateFromAddress(addressText) {
  const address = String(addressText ?? '').trim();
  if (!address) return null;

  const commaState = address.match(/,\s*([A-Za-z][A-Za-z .'-]+?)\s*,\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?\s*$/i);
  if (commaState?.[2]) return commaState[2].toUpperCase();

  const cityState = address.match(/,\s*([A-Za-z][A-Za-z .'-]+?)\s+([A-Z]{2})\s+\d{5}(?:-\d{4})?\s*$/i);
  if (cityState?.[2]) return cityState[2].toUpperCase();

  const lineOnly = address.match(/^([A-Za-z][A-Za-z .'-]+?)\s*,\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?\s*$/i);
  if (lineOnly?.[2]) return lineOnly[2].toUpperCase();

  return null;
}

function findIssuingStateInLines(lines) {
  for (const rawLine of lines) {
    const line = String(rawLine ?? '').trim();
    const match = line.match(/\b(?:COMMONWEALTH|STATE)\s+OF\s+([A-Za-z][A-Za-z .'-]+)\b/i);
    if (match?.[1]) {
      return match[1]
        .replace(/\s+/g, ' ')
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
  }
  return null;
}

function findCityInLines(lines) {
  for (const line of lines) {
    const city = extractCityFromAddress(line);
    if (city) return city;
  }
  return null;
}

function parseAamvaNumberedName(lines) {
  const readField = (fieldNum) => {
    const re = new RegExp(`^\\s*${fieldNum}[\\s.:)]*([A-Za-z][A-Za-z'\\- ]{0,39})\\s*$`, 'i');
    for (const line of lines) {
      const m = line.match(re);
      if (m?.[1] && !NON_PERSON_NAME_HINT.test(m[1]) && !ID_FIELD_SKIP.test(m[1])) {
        return m[1].trim();
      }
    }
    return '';
  };

  const last = readField(1);
  const first = readField(2);
  const middleRaw = readField(3);
  if (!first && !last) return null;

  const middleClean = middleRaw ? middleRaw.replace(/[^A-Za-z'\-\s]/g, '').trim() : '';
  return {
    firstName: titleCaseWord((first || '').split(/\s+/)[0]),
    middleInitial: middleClean ? middleClean.replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase() : '',
    middleName: middleClean ? middleClean.split(/\s+/).map((token) => titleCaseWord(token)).join(' ') : null,
    lastName: titleCaseWord((last || '').split(/\s+/)[0])
  };
}

function parseLabeledNameLines(lines) {
  const readLabel = (labelRe) => {
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!labelRe.test(line)) continue;
      const inline = line.replace(labelRe, '').trim();
      if (inline && inline.length >= 2 && !NON_PERSON_NAME_HINT.test(inline)) return inline;
      const next = lines[i + 1];
      if (next && !ID_FIELD_SKIP.test(next) && !NON_PERSON_NAME_HINT.test(next)) return next.trim();
    }
    return '';
  };

  const last = readLabel(/\bLAST\s*NAME\b/i);
  const first = readLabel(/\bFIRST\s*NAME\b/i);
  const middle = readLabel(/\bMIDDLE\s*NAME\b/i);
  if (!first && !last) return null;

  const middleClean = middle ? middle.replace(/[^A-Za-z'\-\s]/g, '').trim() : '';
  return {
    firstName: titleCaseWord((first || '').split(/\s+/)[0]),
    middleInitial: middleClean ? middleClean.replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase() : '',
    middleName: middleClean ? middleClean.split(/\s+/).map((token) => titleCaseWord(token)).join(' ') : null,
    lastName: titleCaseWord((last || '').split(/\s+/)[0])
  };
}

function cleanNameToken(value) {
  return String(value ?? '')
    .replace(/[,;:.]+$/g, '')
    .replace(/^[,;:.]+/g, '')
    .trim();
}

function compactMrzLine(line) {
  return String(line ?? '').replace(/\s/g, '').toUpperCase();
}

function isPassportDocument(lines) {
  if (lines.some((line) => PASSPORT_DOC_HINT.test(line))) return true;
  if (lines.some((line) => PASSPORT_CARD_HINT.test(line))) return true;
  if (lines.some((line) => /\bBRITISH\s+PASSPORT\b/i.test(line))) return true;
  if (lines.some((line) => /^P<[A-Z]{3}/.test(compactMrzLine(line)))) return true;
  return false;
}

function isPassportNoiseLine(line) {
  const t = String(line ?? '').trim();
  if (!t) return true;
  if (PASSPORT_TITLE_LINE.test(t.replace(/\s+/g, ' '))) return true;
  if (PASSPORT_LABEL_ONLY.test(t) && t.length < 60) return true;
  if (/^UNITED\s+STATES\s+OF\s+AMERICA$/i.test(t)) return true;
  if (/^USA$/i.test(t) && t.length <= 4) return true;
  return false;
}

function isValidHolderNameValue(value) {
  const val = cleanNameToken(value);
  if (!val || val.length < 2 || val.length > 48) return false;
  if (isPassportNoiseLine(val)) return false;
  if (PASSPORT_TITLE_LINE.test(val.replace(/\s+/g, ' '))) return false;
  if (NON_PERSON_NAME_HINT.test(val) && !/^[A-Z]{2,}([,\s]+[A-Z]{2,}){0,3}$/.test(val)) return false;
  if (!/^[A-Za-z][A-Za-z'.,\-\s]{1,}$/.test(val)) return false;
  return true;
}

function namePartsFromSurnameAndGiven(surnameRaw, givenRaw) {
  const lastName = titleCaseWord(cleanNameToken(surnameRaw).split(/\s+/)[0] || '');
  const givenTokens = cleanNameToken(givenRaw)
    .split(/\s+/)
    .filter(Boolean);
  if (!lastName && !givenTokens.length) return null;

  const firstName = titleCaseWord(givenTokens[0] || '');
  const middleTokens = givenTokens.slice(1);
  const middleName = middleTokens.length
    ? middleTokens.map((token) => titleCaseWord(token)).join(' ')
    : null;
  let middleInitial = '';
  if (middleTokens.length) {
    const mid = middleTokens.join(' ');
    middleInitial = mid.length === 1 ? mid.toUpperCase() : mid.charAt(0).toUpperCase();
  }
  return {
    firstName: firstName || null,
    middleInitial: middleInitial || null,
    middleName: middleName || null,
    lastName: lastName || null
  };
}

function readPassportLabelValue(lines, labelRes, { allowAbove = true, maxLookahead = 3 } = {}) {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    let matched = false;
    for (const labelRe of labelRes) {
      if (!labelRe.test(line)) continue;
      matched = true;
      const inline = cleanNameToken(line.replace(labelRe, '').replace(/^[\s:.\/\-]+/, ''));
      if (isValidHolderNameValue(inline)) return inline;
      for (let j = 1; j <= maxLookahead; j += 1) {
        const next = cleanNameToken(lines[i + j]);
        if (isValidHolderNameValue(next)) return next;
      }
      if (allowAbove && i > 0) {
        const prev = cleanNameToken(lines[i - 1]);
        if (isValidHolderNameValue(prev)) return prev;
      }
    }
    if (matched) continue;
  }
  return '';
}

/**
 * ICAO MRZ TD3 name row: P<USATON<<HUNG<THAT<<<
 */
function parseMrzNameLine(lines) {
  for (const line of lines) {
    const compact = String(line).replace(/\s/g, '').toUpperCase();
    // TD3 line 1: P<USA + SURNAME<<GIVEN<NAMES<<<
    const m = compact.match(/^P<[A-Z]{3}([A-Z]+)<<([A-Z<]+)/);
    if (!m) continue;
    const surname = m[1].replace(/</g, ' ').trim();
    const given = m[2].replace(/</g, ' ').trim();
    const parsed = namePartsFromSurnameAndGiven(surname, given);
    if (parsed?.firstName || parsed?.lastName) return parsed;
  }
  return null;
}

function parsePassportNameHeuristic(lines) {
  const capsNames = lines
    .map((line) => cleanNameToken(line))
    .filter(
      (line) =>
        isValidHolderNameValue(line) &&
        /^[A-Z][A-Z'.\-]+(\s+[A-Z][A-Z'.\-]+){0,2}$/.test(line)
    );

  if (capsNames.length < 2) return null;

  const surnameLine = capsNames.find((line) => !/\s/.test(line)) || capsNames[0];
  const givenLine = capsNames.find((line) => line !== surnameLine && /\s/.test(line)) || capsNames[1];
  return namePartsFromSurnameAndGiven(surnameLine, givenLine);
}

function parsePassportNameLines(lines) {
  if (!isPassportDocument(lines)) return null;

  const surname = readPassportLabelValue(lines, [
    /\bSURNAME\b[\s\/A-Za-zéèêà]*:?\s*/i,
    /\bSurname\/Nom\b[:\s]*/i,
    /\bSurname\/Nom\/Apellidos\b[:\s]*/i
  ]);
  const given = readPassportLabelValue(lines, [
    /\bGIVEN\s*NAMES?\b[\s\/A-Za-zéèêà]*:?\s*/i,
    /\bGiven\s+names?\b[:\s]*/i,
    /\bGiven\s+names\/Pr[eéè]noms\b[:\s]*/i,
    /\bGiven\s+names\/Pr[eéè]noms\/Nombres\b[:\s]*/i
  ]);

  if (surname || given) {
    const parsed = namePartsFromSurnameAndGiven(surname, given);
    if (parsed?.firstName || parsed?.lastName) return parsed;
  }

  const mrz = parseMrzNameLine(lines);
  if (mrz?.firstName || mrz?.lastName) return mrz;

  return parsePassportNameHeuristic(lines);
}

function parseFnLnLabels(lines) {
  const lnMatch = lines.find((line) => /\bLN\b/i.test(line));
  if (!lnMatch) return null;
  const last = lnMatch.replace(/^.*\bLN\b\s*/i, '').trim();
  const fnLine = lines.find((line) => /\bFN\b/i.test(line));
  const first = fnLine ? fnLine.replace(/^.*\bFN\b\s*/i, '').trim() : '';
  const middleLine = lines.find((line) => /\bMN\b/i.test(line));
  const middle = middleLine ? middleLine.replace(/^.*\bMN\b\s*/i, '').trim().charAt(0) : '';
  if (!first && !last) return null;
  if (NON_PERSON_NAME_HINT.test(`${first} ${last}`)) return null;

  const middleClean = middle ? middle.replace(/[^A-Za-z'\-\s]/g, '').trim() : '';
  return {
    firstName: titleCaseWord(first.split(/\s+/)[0] || ''),
    middleInitial: middleClean ? middleClean.replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase() : '',
    middleName: middleClean ? middleClean.split(/\s+/).map((token) => titleCaseWord(token)).join(' ') : null,
    lastName: titleCaseWord(last.split(/\s+/)[0] || '')
  };
}

function isDriverLicenseDocument(lines) {
  return lines.some((line) => /\b(DRIVER'?S?\s+LICENSE|DRIVING\s+LICEN[CS]E)\b/i.test(line));
}

function isAllCapsNameLine(line) {
  const val = cleanNameToken(line);
  return Boolean(val && /^[A-Z][A-Z'.\-]+(\s+[A-Z][A-Z'.\-]+){0,3}$/.test(val));
}

/** US licenses often print surname on one line and given names on the next (e.g. TON / HUNG THAT). */
function parseStackedDlNameLines(lines) {
  if (!isDriverLicenseDocument(lines) && !lines.some((line) => /\b(DRIVER|LICENSE|DMV)\b/i.test(line))) {
    return null;
  }

  for (let i = 0; i < lines.length - 1; i += 1) {
    const lastLine = cleanNameToken(lines[i]);
    const givenLine = cleanNameToken(lines[i + 1]);
    if (!isValidHolderNameValue(lastLine) || !isValidHolderNameValue(givenLine)) continue;
    if (!isAllCapsNameLine(lastLine) || !isAllCapsNameLine(givenLine)) continue;
    if (/\s/.test(lastLine) || !/\s/.test(givenLine)) continue;
    const parsed = namePartsFromSurnameAndGiven(lastLine, givenLine);
    if (parsed?.firstName || parsed?.lastName) return parsed;
  }
  return null;
}

function titleCaseCountry(text) {
  const SMALL = new Set(['of', 'the', 'and']);
  return String(text ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && SMALL.has(lower)) return lower;
      return titleCaseWord(word);
    })
    .join(' ');
}

function isValidCountryValue(value) {
  const val = cleanNameToken(value);
  if (!val || val.length < 2 || val.length > 64) return false;
  const upper = val.toUpperCase();
  if (/^[A-Z]{3}$/.test(upper)) return true;
  if (/\b(UNITED|STATES|AMERICA|BRITISH|CITIZEN|KINGDOM|REPUBLIC|FEDERATION|COMMONWEALTH)\b/i.test(val)) {
    return /^[A-Za-z][A-Za-z .'-]{1,}$/.test(val);
  }
  if (NON_PERSON_NAME_HINT.test(val) && !/^[A-Z]{2,}(\s+[A-Z]{2,})+$/.test(val)) return false;
  if (/^[A-Z]{2,}\s+[A-Z]{2,}$/.test(val)) return false;
  return /^[A-Za-z][A-Za-z .'-]{1,}$/.test(val);
}

function readPassportCountryLabel(lines, labelRes) {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    let matched = false;
    for (const labelRe of labelRes) {
      if (!labelRe.test(line)) continue;
      matched = true;
      const inline = cleanNameToken(line.replace(labelRe, '').replace(/^[\s:.\/\-]+/, ''));
      if (isValidCountryValue(inline)) return titleCaseCountry(inline);
      for (let j = 1; j <= 3; j += 1) {
        const next = cleanNameToken(lines[i + j]);
        if (isValidCountryValue(next)) return titleCaseCountry(next);
      }
      if (i > 0) {
        const prev = cleanNameToken(lines[i - 1]);
        if (isValidCountryValue(prev)) return titleCaseCountry(prev);
      }
    }
    if (matched) continue;
  }
  return null;
}

function parseMrzLine2Record(lines) {
  for (const line of lines) {
    const compact = compactMrzLine(line);
    const match = compact.match(/^[A-Z0-9<]{10}([A-Z]{3})(\d{6})\d/);
    if (!match) continue;
    const nationality = match[1].replace(/</g, '').trim();
    const yymmdd = match[2];
    const yy = yymmdd.slice(0, 2);
    const mm = yymmdd.slice(2, 4);
    const dd = yymmdd.slice(4, 6);
    const dateOfBirth = formatDob(mm, dd, yy);
    return {
      nationality: nationality || null,
      dateOfBirth: dateOfBirth && isPlausibleBirthDate(dateOfBirth) ? dateOfBirth : null
    };
  }
  return null;
}

function parseMrzNationalityFromNameLine(lines) {
  for (const line of lines) {
    const compact = compactMrzLine(line);
    const match = compact.match(/^P<[A-Z0-9<]{3}/);
    if (!match) continue;
    const code = compact.slice(2, 5).replace(/</g, '').trim();
    if (/^[A-Z]{3}$/.test(code)) return code;
  }
  return null;
}

export function normalizePassportNationalityCode(rawNationality, lines = []) {
  const raw = cleanNameToken(rawNationality);
  if (raw) {
    const upper = raw.toUpperCase();
    if (PASSPORT_NATIONALITY_CODE[upper]) return PASSPORT_NATIONALITY_CODE[upper];
    if (/^[A-Z]{3}$/.test(upper)) return upper;
    const title = titleCaseCountry(raw);
    const fromTitle = PASSPORT_NATIONALITY_CODE[title.toUpperCase()];
    if (fromTitle) return fromTitle;
    for (const [key, code] of Object.entries(PASSPORT_NATIONALITY_CODE)) {
      if (upper.includes(key)) return code;
    }
  }
  const mrz = parseMrzLine2Record(lines) || {};
  if (mrz.nationality) return mrz.nationality;
  return parseMrzNationalityFromNameLine(lines);
}

function parsePassportNationality(lines) {
  if (!isPassportDocument(lines)) return null;
  return readPassportCountryLabel(lines, [
    /\bNATIONALITY\b[\s\/A-Za-zéèêà]*:?\s*/i,
    /\bNationalit[eé]\/Nationalit[eé]\b[:\s]*/i,
    /\bNationalit[eé]\/Nationalit[eé]\/Nacionalidad\b[:\s]*/i
  ]);
}

/** Exact "Place of Birth" first, then multilingual passport labels (longest first). */
const PLACE_OF_BIRTH_LABEL_PATTERNS = [
  /\bPlace\s+of\s+birth\s*(?:\/\s*Lieu\s+de\s+naissance\s*)?(?:\/\s*Lugar\s+de\s+nacimiento\s*)?/i,
  /\bPLACE\s+OF\s+BIRTH\s*(?:\/\s*LIEU\s+DE\s+NAISSANCE\s*)?(?:\/\s*LUGAR\s+DE\s+NACIMIENTO\s*)?/i,
  /\bLieu\s+de\s+naissance\b/i,
  /\bLugar\s+de\s+nacimiento\b/i
];

function isPlaceOfBirthLabelTail(value) {
  const raw = String(value ?? '').trim();
  const lower = raw.toLowerCase();
  if (!raw) return true;
  if (/^[\s\/\-]+/.test(raw)) return true;
  if (/\b(lieu|lugar|naissance|nacimiento)\b/i.test(lower)) return true;
  if (/\b(apellidos|pr[eé]noms|nombres|nationalit[eé]|surname|given|date de|fecha de)\b/i.test(lower)) {
    return true;
  }
  return false;
}

function isPlausiblePlaceOfBirthValue(value) {
  const val = cleanNameToken(value);
  if (!val || val.length < 2 || val.length > 80) return false;
  if (isPlaceOfBirthLabelTail(val)) return false;
  if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/.test(val)) return false;
  if (/^(M|F|X)$/i.test(val)) return false;
  if (/^P<|^PASSPORT/i.test(val)) return false;
  if (/^(SURNAME|GIVEN|NATIONALITY|SEX|DATE\s+OF\s+BIRTH|HEIGHT|WEIGHT)/i.test(val)) return false;
  if (/^[A-Z0-9<]{20,}$/.test(val.replace(/\s/g, ''))) return false;
  return /^[\p{L}\p{N}][\p{L}\p{N}\s,.'\-\/]{1,}$/u.test(val);
}

function formatPlaceOfBirthPart(part) {
  const trimmed = String(part ?? '').trim();
  if (!trimmed) return '';
  const upper = trimmed.toUpperCase().replace(/\s/g, '');
  if (upper === 'U.S.A.' || upper === 'U.S.A' || upper === 'USA') return 'U.S.A.';
  if (/^[A-Z]{2,3}\.?$/.test(trimmed)) return trimmed.replace(/\.?$/, '').toUpperCase();
  return titleCaseCountry(trimmed);
}

function countShortPlaceOfBirthNoiseTokens(tokens) {
  return tokens.filter((token) => {
    const t = cleanNameToken(token).replace(/\./g, '');
    return t.length <= 2 && !/^(US|UK)$/i.test(t);
  }).length;
}

function looksLikeOcrNoisyPlaceOfBirth(text) {
  const tokens = cleanNameToken(text).split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return false;
  return countShortPlaceOfBirthNoiseTokens(tokens) >= 2;
}

const PLACE_OF_BIRTH_SHORT_TOKEN_ALLOW = new Set(['st', 'la', 'le', 'el', 'of', 'de', 'us', 'uk']);

function hasDisallowedShortPlaceToken(text) {
  const tokens = cleanNameToken(text).split(/\s+/).filter(Boolean);
  return tokens.some((token) => {
    const t = cleanNameToken(token).replace(/\./g, '');
    if (t.length !== 2) return false;
    return !PLACE_OF_BIRTH_SHORT_TOKEN_ALLOW.has(t.toLowerCase());
  });
}

/** Pull a valid passport country/place name out of noisy OCR (e.g. "Aa Vietnam Rl Tt St" → "Vietnam"). */
function salvagePlaceOfBirthFromOcrNoise(text) {
  const val = cleanNameToken(text);
  if (!val) return null;
  const tokens = val.split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return null;

  let best = null;
  let bestScore = -1;
  for (let len = tokens.length; len >= 1; len -= 1) {
    for (let start = 0; start <= tokens.length - len; start += 1) {
      const candidate = tokens.slice(start, start + len).join(' ');
      if (!isValidCountryValue(candidate)) continue;
      if (looksLikeOcrNoisyPlaceOfBirth(candidate)) continue;
      if (hasDisallowedShortPlaceToken(candidate)) continue;
      const formatted = formatPlaceOfBirthPart(candidate);
      if (!formatted) continue;
      const score = len * 100 + formatted.length;
      if (score > bestScore) {
        best = formatted;
        bestScore = score;
      }
    }
  }
  return best;
}

function formatPlaceOfBirthDisplay(value) {
  const val = cleanNameToken(value);
  if (!val) return null;
  if (val.includes(',')) {
    return val
      .split(',')
      .map((part) => {
        const partVal = cleanNameToken(part);
        if (!partVal) return '';
        if (looksLikeOcrNoisyPlaceOfBirth(partVal)) {
          return salvagePlaceOfBirthFromOcrNoise(partVal) || formatPlaceOfBirthPart(partVal);
        }
        return formatPlaceOfBirthPart(partVal);
      })
      .filter(Boolean)
      .join(', ');
  }
  if (looksLikeOcrNoisyPlaceOfBirth(val)) {
    return salvagePlaceOfBirthFromOcrNoise(val) || formatPlaceOfBirthPart(val);
  }
  if (isValidCountryValue(val)) {
    return formatPlaceOfBirthPart(val);
  }
  const salvaged = salvagePlaceOfBirthFromOcrNoise(val);
  if (salvaged) return salvaged;
  return formatPlaceOfBirthPart(val);
}

/** Normalize stored or OCR place-of-birth text for Brief Bio display and capture. */
export function normalizePassportPlaceOfBirthDisplay(raw) {
  const text = String(raw ?? '').trim();
  if (!text || text.toLowerCase() === 'not found') return null;
  return formatPlaceOfBirthDisplay(text) || null;
}

/**
 * Passport place of birth — only when next to Place of Birth label (not guessed).
 * @param {string[]} lines
 * @param {{ maxLookahead?: number }} [options]
 * @returns {string|null}
 */
function isPassportFieldLabelLine(value) {
  const lower = String(value ?? '').trim().toLowerCase();
  if (!lower) return true;
  return (
    /\b(date\s+of\s+birth|fecha\s+de\s+nacimiento|date\s+de\s+naissance)\b/i.test(lower) ||
    /\b(sex|sexe|sexo)\b/i.test(lower) ||
    /\b(surname|given\s+name|nationality|nationalit[eé]|nacionalidad)\b/i.test(lower) ||
    /\b(passport|passeport|pasaporte)\b/i.test(lower) ||
    /^p<[a-z]{3}/i.test(lower.replace(/\s/g, ''))
  );
}

function scanPlaceOfBirthAfterLabel(lines, startIndex, maxLookahead) {
  for (let j = 1; j <= maxLookahead; j += 1) {
    const next = cleanNameToken(lines[startIndex + j]);
    if (!next) continue;
    if (isPlaceOfBirthLabelTail(next) || isPassportFieldLabelLine(next)) continue;
    if (isPlausiblePlaceOfBirthValue(next)) return formatPlaceOfBirthDisplay(next);
  }
  return null;
}

export function findPlaceOfBirth(lines, { maxLookahead = 6 } = {}) {
  if (!isPassportDocument(lines)) return null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const labelRe of PLACE_OF_BIRTH_LABEL_PATTERNS) {
      if (!labelRe.test(line)) continue;
      const inline = cleanNameToken(line.replace(labelRe, '').replace(/^[\s:.\/\-]+/, ''));
      if (isPlausiblePlaceOfBirthValue(inline)) return formatPlaceOfBirthDisplay(inline);
      const found = scanPlaceOfBirthAfterLabel(lines, i, maxLookahead);
      if (found) return found;
      break;
    }
  }
  for (let i = 0; i < lines.length; i += 1) {
    if (!/\bplace\s+of\s+birth\b/i.test(lineAt(lines, i))) continue;
    const found = scanPlaceOfBirthAfterLabel(lines, i, Math.max(maxLookahead, 8));
    if (found) return found;
  }
  return null;
}

function lineAt(lines, index) {
  return lines[index] ?? '';
}

/** Tesseract backup — wider lookahead for scrambled line order on passport scans. */
export function findPlaceOfBirthFromTesseractLines(lines) {
  return findPlaceOfBirth(lines, { maxLookahead: 8 });
}

function parsePassportPlaceOfBirth(lines) {
  return findPlaceOfBirth(lines);
}

function normalizeSex(raw) {
  const token = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  if (token === 'M' || token === 'MALE') return 'M';
  if (token === 'F' || token === 'FEMALE') return 'F';
  if (token === 'X' || token === 'U') return token.charAt(0);
  return null;
}

function isSexLabelLine(line) {
  return isFuzzySexLabelLine(line);
}

/** AAMVA field number (usually 15) before Sex on US driver licenses. */
function isFieldNumberSexAnchorLine(line) {
  const text = String(line ?? '').trim();
  if (!text) return false;
  if (/\b\d{1,2}\b[\s.:)]*s[e3][x×]/i.test(text)) return true;
  if (/^\s*\d{1,2}[\s.:)]*\s*$/.test(text)) return true;
  return false;
}

/** Line has field-number + Sex label but M/F may be on the next line (common in Tesseract). */
function isFieldNumberSexLabelOnlyLine(line) {
  const text = String(line ?? '').trim();
  return /\b\d{1,2}\b[\s.:)]*s[e3][x×]\s*:?\s*$/i.test(text);
}

function isFuzzySexLabelLine(line) {
  const text = String(line ?? '');
  if (/\bSEX\b/i.test(text)) return true;
  if (/\bs[e3][x×]/i.test(text)) return true;
  if (/isex/i.test(text)) return true;
  if (/issex/i.test(text)) return true;
  if (/\bses\b/i.test(text)) return true;
  return isFieldNumberSexAnchorLine(line);
}

/** M/F to the right of "15 Sex" / "8 Sex" / garbled "isexF" on the same line. */
function extractSexRightOfFieldNumberLabel(text) {
  const line = String(text ?? '');
  const patterns = [
    /\b\d{1,2}\b[\s.:)]*s[e3][x×]\s*:?\s*([MF])\b/i,
    /\b\d{1,2}\b[\s.:)]*SEX\b\s*:?\s*([MF])\b/i,
    /\b\d{1,2}\b[\s.:)]*SEX\b[^A-Za-z0-9]*([MF])\b/i,
    /[\s(]s[e3][x×]\s*:?\s*([MF])\b/i,
    /isex([MF])\b/i,
    /isex\s*([MF])\b/i,
    /issex([MF])\b/i,
    /issex\s*([MF])\b/i,
    /\bses\s*:?\s*([MF])\b/i
  ];
  for (const re of patterns) {
    const match = line.match(re);
    if (match?.[1]) {
      const sex = normalizeSex(match[1]);
      if (sex === 'M' || sex === 'F') return sex;
    }
  }
  return null;
}

/** @deprecated alias */
function extractSexRightOfField15Label(text) {
  return extractSexRightOfFieldNumberLabel(text);
}

function isNonSexAdjacentLine(line) {
  return /\b(EXP|ISS|DOB|DATE\s+OF\s+BIRTH|HEIGHT|HT|WEIGHT|WT|EYES|EYE)\b/i.test(String(line ?? ''));
}

/** M or F on same line as Sex label — e.g. "15 Sex M", "15 SEX: F", "Sex M". */
function extractSexAdjacentToLabel(text) {
  const line = String(text ?? '');
  const fromField = extractSexRightOfFieldNumberLabel(line);
  if (fromField) return fromField;

  const patterns = [/\b(?:\d+\.?\s*)?SEX\b\s*:?\s*([MF])\b/i];
  for (const re of patterns) {
    const match = line.match(re);
    if (match?.[1]) {
      const sex = normalizeSex(match[1]);
      if (sex === 'M' || sex === 'F') return sex;
    }
  }
  return null;
}

function findSexOnFollowingLines(lines, afterIndex, maxLookahead = 3) {
  for (let j = 1; j <= maxLookahead; j += 1) {
    const next = lines[afterIndex + j];
    if (!next) break;
    if (isNonSexAdjacentLine(next)) continue;
    if (/\b(?:16|HT|HEIGHT)\b/i.test(next)) continue;

    const bare = next.match(/^\s*([MF])\s*$/i);
    if (bare?.[1]) {
      const sex = normalizeSex(bare[1]);
      if (sex === 'M' || sex === 'F') return sex;
    }

    const inline = extractSexAdjacentToLabel(next);
    if (inline) return inline;

    const aamva = next.match(/^\s*\d{1,2}[\s.:)]+\s*([MF])\b/i);
    if (aamva?.[1]) {
      const sex = normalizeSex(aamva[1]);
      if (sex === 'M' || sex === 'F') return sex;
    }
  }
  return null;
}

/**
 * Tesseract layout: field number + Sex anchors label; M/F is right of or below Sex/SEX.
 * Handles CT "15 Sex: F", VA "15 Sex" with M below, and split OCR like "15" then "Sex F".
 */
function findSexFromFieldNumberLayout(lines, maxLookahead = 5) {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    const inline = extractSexRightOfFieldNumberLabel(line);
    if (inline) return inline;

    if (isFieldNumberSexLabelOnlyLine(line) || isFuzzySexLabelLine(line)) {
      const below = findSexOnFollowingLines(lines, i, maxLookahead);
      if (below) return below;
    }

    if (/^\s*\d{1,2}[\s.:)]*\s*$/.test(String(line ?? '').trim())) {
      for (let j = 1; j <= maxLookahead; j += 1) {
        const next = lines[i + j];
        if (!next) break;
        const fromNext = extractSexRightOfFieldNumberLabel(next) || extractSexAdjacentToLabel(next);
        if (fromNext) return fromNext;
        if (isFuzzySexLabelLine(next)) {
          const following = findSexOnFollowingLines(lines, i + j, maxLookahead - j);
          if (following) return following;
        }
      }
    }
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!isFieldNumberSexAnchorLine(line)) continue;
    const below = findSexOnFollowingLines(lines, i, maxLookahead);
    if (below) return below;
  }

  return null;
}

/** Scan garbled Tesseract lines (e.g. Texas "isexF", "Ses F"). */
function findSexFromGarbledTesseractLines(lines) {
  for (const line of lines) {
    const sex = extractSexRightOfFieldNumberLabel(line);
    if (sex) return sex;
  }
  for (let i = 0; i < lines.length; i += 1) {
    if (!isFuzzySexLabelLine(lines[i])) continue;
    const inline = extractSexAdjacentToLabel(lines[i]);
    if (inline) return inline;
    const below = findSexOnFollowingLines(lines, i, 3);
    if (below) return below;
  }
  return null;
}

/**
 * Only extract Sex when M/F appears next to or below a Sex label — never guess from unrelated fields.
 * @param {string[]} lines
 * @param {{ maxLookahead?: number }} [options]
 * @returns {'M'|'F'|null}
 */
export function findSex(lines, { maxLookahead = 3 } = {}) {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const inline = extractSexAdjacentToLabel(line);
    if (inline) return inline;

    if (isSexLabelLine(line)) {
      const following = findSexOnFollowingLines(lines, i, maxLookahead);
      if (following) return following;
    }
  }

  for (const line of lines) {
    const aamva = line.match(/^\s*\d{1,2}[\s.:)]+\s*([MF])\b/i);
    if (aamva?.[1]) {
      const sex = normalizeSex(aamva[1]);
      if (sex === 'M' || sex === 'F') return sex;
    }
  }

  return null;
}

/** Tesseract backup — upscale + Sex zone; field number + Sex label; garbled OCR tolerant. */
export function findSexFromTesseractLines(lines) {
  const fromField = findSexFromFieldNumberLayout(lines, 5);
  if (fromField) return fromField;
  const fromGarbled = findSexFromGarbledTesseractLines(lines);
  if (fromGarbled) return fromGarbled;
  return findSex(lines, { maxLookahead: 5 });
}

function parseSex(lines) {
  const fromLabel = findSex(lines);
  if (fromLabel) return fromLabel;

  for (const line of lines) {
    const inline = line.match(/\bSEX\b[\s:.\/]*([MFUX])\b/i);
    if (inline?.[1]) {
      const sex = normalizeSex(inline[1]);
      if (sex) return sex;
    }
  }

  for (const line of lines) {
    const aamva = line.match(/^\s*15[\s.:)]+\s*([MFUX])\b/i);
    if (aamva?.[1]) {
      const sex = normalizeSex(aamva[1]);
      if (sex) return sex;
    }
  }
  return null;
}

function normalizeHeight(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const match = text.match(/(\d+)\s*['\-]?\s*-?\s*(\d{1,2})\s*"?\s*$/);
  if (match) {
    return `${match[1]}'${String(match[2]).padStart(2, '0')}"`;
  }
  return text.replace(/\s+/g, ' ') || null;
}

function parseHeight(lines) {
  for (const line of lines) {
    const inline = line.match(/\b(?:HT|HEIGHT)\b[\s:.\/]*(\d+\s*['\-]?\s*-?\s*\d{1,2}\s*"?\s*)/i);
    if (inline?.[1]) {
      const height = normalizeHeight(inline[1]);
      if (height) return height;
    }
  }

  for (const line of lines) {
    const aamva = line.match(/^\s*16[\s.:)]*(\d+\s*['\-]?\s*-?\s*\d{1,2}\s*"?\s*)/i);
    if (aamva?.[1]) {
      const height = normalizeHeight(aamva[1]);
      if (height) return height;
    }
  }

  for (const line of lines) {
    const bare = line.match(/^\s*(\d+'\s*-?\s*\d{1,2}\s*")\s*$/i);
    if (bare?.[1]) {
      const height = normalizeHeight(bare[1]);
      if (height) return height;
    }
  }
  return null;
}

function parseNameFromLines(lines) {
  const passport = parsePassportNameLines(lines);
  if (passport?.firstName || passport?.lastName) return passport;

  const stacked = parseStackedDlNameLines(lines);
  if (stacked?.firstName || stacked?.lastName) return stacked;

  const labeled = parseFnLnLabels(lines);
  if (labeled?.firstName || labeled?.lastName) return labeled;

  const aamva = parseAamvaNumberedName(lines);
  if (aamva?.firstName || aamva?.lastName) return aamva;

  const named = parseLabeledNameLines(lines);
  if (named?.firstName || named?.lastName) return named;

  const candidates = lines
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(
      (line) =>
        line.length >= 3 &&
        line.length <= 48 &&
        !ID_FIELD_SKIP.test(line) &&
        !isPassportNoiseLine(line) &&
        !NON_PERSON_NAME_HINT.test(line) &&
        !STATE_ZIP_TAIL.test(line) &&
        !ZIP_PATTERN.test(line) &&
        /[A-Za-z]/.test(line)
    );

  const nameLine = candidates.find((line) => /^[A-Za-z][A-Za-z'\-]+(\s+[A-Za-z][A-Za-z'\-]+){1,3}$/.test(line));
  if (!nameLine) return { firstName: null, middleInitial: null, middleName: null, lastName: null };

  const parts = nameLine.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: titleCaseWord(parts[0]), middleInitial: null, middleName: null, lastName: null };
  }
  if (parts.length === 2) {
    return { firstName: titleCaseWord(parts[0]), middleInitial: null, middleName: null, lastName: titleCaseWord(parts[1]) };
  }
  // US licenses often print one line as LAST FIRST MIDDLE (e.g. "TON HUNG THAT").
  if (parts.length === 3 && parts.every((p) => /^[A-Z]{2,}$/.test(p))) {
    return {
      firstName: titleCaseWord(parts[1]),
      middleInitial: parts[2].length === 1 ? parts[2].toUpperCase() : parts[2].charAt(0).toUpperCase(),
      middleName: titleCaseWord(parts[2]),
      lastName: titleCaseWord(parts[0])
    };
  }
  const middleParts = parts.slice(1, -1);
  const middleName = middleParts.length ? middleParts.map((part) => titleCaseWord(part)).join(' ') : null;
  const middleInitialSource = middleParts.join(' ');
  return {
    firstName: titleCaseWord(parts[0]),
    middleInitial: middleInitialSource
      ? middleInitialSource.length === 1
        ? middleInitialSource.toUpperCase()
        : middleInitialSource.charAt(0).toUpperCase()
      : null,
    middleName,
    lastName: titleCaseWord(parts[parts.length - 1])
  };
}

function levenshtein(a, b) {
  const s = String(a);
  const t = String(b);
  const m = s.length;
  const n = t.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function normalizeNameKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function fuzzyNameTokenMatch(a, b) {
  const na = normalizeNameKey(a);
  const nb = normalizeNameKey(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const maxDist = Math.max(1, Math.floor(Math.min(na.length, nb.length) * 0.25));
  return levenshtein(na, nb) <= maxDist;
}

function middleInitialsMatch(consentMiddle, ocrMiddleInitial) {
  const c = String(consentMiddle ?? '')
    .replace(/[^A-Za-z]/g, '')
    .charAt(0)
    .toUpperCase();
  const o = String(ocrMiddleInitial ?? '')
    .replace(/[^A-Za-z]/g, '')
    .charAt(0)
    .toUpperCase();
  if (!c) return true;
  if (!o) return true;
  return c === o;
}

function consentMatchesParsedName(consentParts, parsed) {
  if (!consentParts.first || !consentParts.last) return false;
  if (!parsed.firstName && !parsed.lastName) return false;

  const standard =
    fuzzyNameTokenMatch(consentParts.first, parsed.firstName) &&
    fuzzyNameTokenMatch(consentParts.last, parsed.lastName) &&
    middleInitialsMatch(consentParts.middle, parsed.middleInitial);

  if (standard) return true;

  // Fallback when OCR line was parsed as FIRST … LAST (not DMV reorder).
  const swapped =
    fuzzyNameTokenMatch(consentParts.last, parsed.firstName) &&
    fuzzyNameTokenMatch(consentParts.first, parsed.lastName) &&
    middleInitialsMatch(consentParts.middle, parsed.middleInitial);

  return swapped;
}

function looksLikeNonPersonName(parsed) {
  const blob = `${parsed.firstName || ''} ${parsed.lastName || ''}`.toUpperCase();
  if (!blob.trim()) return true;
  return NON_PERSON_NAME_HINT.test(blob);
}

/**
 * Require consent legal name to match name read from ID OCR (never substitute consent for OCR).
 * @param {object} parsed — from parseIdCardFields
 * @param {string|null|undefined} consentFullName
 */
export function compareConsentNameToIdOcr(parsed, consentFullName) {
  const consentParts = parseFullNameParts(formatCapitalizedFullNameString(consentFullName));
  const extractedFullName = formatCapitalizedFullName(parsed.firstName, parsed.middleInitial, parsed.lastName);

  if (!consentParts.first || !consentParts.last) {
    return {
      matched: false,
      extractedFullName,
      message: 'Enter your legal first and last name before verifying.'
    };
  }

  if (!extractedFullName || looksLikeNonPersonName(parsed)) {
    return {
      matched: false,
      extractedFullName: extractedFullName || null,
      message:
        'Could not read your name clearly from the ID photo. Use a well-lit, flat photo of the name on your passport, driver license, or government ID.'
    };
  }

  if (!consentMatchesParsedName(consentParts, parsed)) {
    return {
      matched: false,
      extractedFullName,
      message: `The name on your ID does not match what you entered. We read "${extractedFullName}" on your ID.`
    };
  }

  return { matched: true, extractedFullName, message: null };
}

/**
 * Best-effort parse of US ID card OCR lines from Rekognition DetectText.
 * @param {string[]} lines
 */
const PASSPORT_LABEL_PATTERNS = [
  { key: 'surname', re: /\bSURNAME\b/i, label: 'Surname' },
  { key: 'givenNames', re: /\bGIVEN\s*NAME/i, label: 'Given Name(s)' },
  { key: 'nationality', re: /\bNATIONALITY\b/i, label: 'Nationality' },
  { key: 'dateOfBirth', re: /\bDATE\s+OF\s+BIRTH\b/i, label: 'Date of birth' },
  { key: 'placeOfBirth', re: /\bPLACE\s+OF\s+BIRTH\b/i, label: 'Place of Birth' },
  { key: 'passport', re: PASSPORT_DOC_HINT, label: 'Passport' },
  { key: 'passportCard', re: PASSPORT_CARD_HINT, label: 'Passport Card' },
  { key: 'mrz', re: /^P<[A-Z]{3}/, label: 'MRZ' }
];

/** Which passport labels were seen in OCR lines (for UI / debug). */
export function findPassportLabelsInLines(lines) {
  const safeLines = Array.isArray(lines) ? lines : [];
  const found = [];
  for (const line of safeLines) {
    const compact = compactMrzLine(line);
    for (const { key, re, label } of PASSPORT_LABEL_PATTERNS) {
      if (found.some((item) => item.key === key)) continue;
      if (key === 'mrz' ? re.test(compact) : re.test(line)) {
        found.push({ key, label });
      }
    }
  }
  return found;
}

export function buildPassportFieldTrace(lines) {
  const safeLines = Array.isArray(lines) ? lines : [];
  const passport = isPassportDocument(safeLines);
  const labelsFound = findPassportLabelsInLines(safeLines);
  const parsed = parseIdCardFields(safeLines);
  return {
    isPassport: passport,
    labelsFound,
    rawLineCount: safeLines.length,
    fields: {
      surname: parsed.lastName || null,
      givenNames: parsed.firstName || null,
      middleName: parsed.middleName || parsed.middleInitial || null,
      nationality: parsed.countryOfCitizenship || null,
      ppNationality: parsed.ppNationality || null,
      dateOfBirth: parsed.dateOfBirth || null,
      placeOfBirth: parsed.countryOfBirth || null,
      sex: parsed.sex || null,
      documentType: parsed.documentType || null
    },
    rawLinesSample: safeLines.slice(0, 45)
  };
}

const PARSED_MERGE_KEYS = [
  'firstName',
  'middleInitial',
  'middleName',
  'lastName',
  'address',
  'city',
  'state',
  'dateOfBirth',
  'sex',
  'height',
  'countryOfCitizenship',
  'countryOfBirth',
  'ppNationality',
  'documentType'
];

/** Prefer first non-empty field across Rekognition + Tesseract line sets. */
export function mergeIdCardParsed(primary, ...fallbacks) {
  const merged = { ...(primary || {}) };
  for (const fallback of fallbacks) {
    if (!fallback) continue;
    for (const key of PARSED_MERGE_KEYS) {
      if (merged[key] == null || merged[key] === '') {
        if (fallback[key] != null && fallback[key] !== '') {
          merged[key] = fallback[key];
        }
      }
    }
    if (!merged.documentType && fallback.documentType) merged.documentType = fallback.documentType;
  }
  if (merged.documentType !== 'passport') {
    merged.ppNationality = merged.ppNationality || null;
  }
  return merged;
}

export function parseIdCardFields(lines) {
  const safeLines = Array.isArray(lines) ? lines : [];
  const { firstName, middleInitial, middleName, lastName } = parseNameFromLines(safeLines);
  const passport = isPassportDocument(safeLines);
  const driverLicense = isDriverLicenseDocument(safeLines);
  const address = findAddress(safeLines);
  const city = extractCityFromAddress(address) || findCityInLines(safeLines);
  const state =
    driverLicense && !passport
      ? findIssuingStateInLines(safeLines) || extractStateFromAddress(address)
      : null;
  const sex = parseSex(safeLines);
  const height = driverLicense || !passport ? parseHeight(safeLines) : null;
  const countryOfCitizenship = passport ? parsePassportNationality(safeLines) : null;
  const countryOfBirth = passport ? parsePassportPlaceOfBirth(safeLines) : null;
  const ppNationality = passport
    ? normalizePassportNationalityCode(countryOfCitizenship, safeLines)
    : null;
  return {
    firstName: firstName || null,
    middleInitial: middleInitial || null,
    middleName: middleName || null,
    lastName: lastName || null,
    address,
    city,
    state: state || null,
    dateOfBirth: findDateOfBirth(safeLines),
    sex: sex || null,
    height: height || null,
    countryOfCitizenship: countryOfCitizenship || null,
    countryOfBirth: countryOfBirth || null,
    ppNationality: ppNationality || null,
    documentType: passport ? 'passport' : driverLicense ? 'driver_license' : null,
    rawLines: safeLines
  };
}

export function computeAgeFromDob(dobText) {
  const m = String(dobText || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const birth = new Date(parseInt(m[3], 10), parseInt(m[1], 10) - 1, parseInt(m[2], 10));
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 && age <= 120 ? age : null;
}

/** Birth year from MM/DD/YYYY OCR text. */
export function extractBirthYearFromDob(dobText) {
  const m = String(dobText || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const year = parseInt(m[3], 10);
  return Number.isFinite(year) ? year : null;
}

/** Value for singles.dl_dob — full DOB from OCR or literal not found. */
export function formatDlDobCapture(dobText) {
  const text = String(dobText ?? '').trim();
  return text || 'not found';
}

/** Value for singles.pp_dob — passport DOB from OCR or literal not found. */
export function formatPpDobCapture(dobText) {
  return formatDlDobCapture(dobText);
}

/** Value for singles.pp_place_of_birth — passport place of birth from OCR or literal not found. */
export function formatPpPlaceOfBirthCapture(placeText) {
  const normalized = normalizePassportPlaceOfBirthDisplay(placeText);
  return normalized || 'not found';
}

/** Value for singles.dl_sex — 'M' | 'F' | null (CHAR(1); never full words). */
export function formatDlSexCapture(sexText) {
  const sex = normalizeSex(sexText);
  if (sex === 'M' || sex === 'F') return sex;
  return null;
}

/** Value for singles.pp_sex — passport sex from OCR or literal not found. */
export function formatPpSexCapture(sexText) {
  return formatDlSexCapture(sexText);
}

/** Value for singles.pp_nationality — ISO3 from passport OCR or not found. */
export function formatPpNationalityCapture(code) {
  const text = String(code ?? '').trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(text)) return text;
  return 'not found';
}
