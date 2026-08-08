import sharp from 'sharp';
import { detectTextLines } from '../lib/rekognitionClient.js';
import { detectTextLinesWithTesseract } from './localTesseractOcr.js';
import {
  buildDobOcrTraceFromSteps,
  buildSexOcrTraceFromSteps,
  formatDlDobCapture,
  formatDlSexCapture,
  findDateOfBirth,
  findDateOfBirthFromTesseractLines,
  findPlaceOfBirth,
  findPlaceOfBirthFromTesseractLines,
  findSex,
  findSexFromTesseractLines,
  mergeIdCardParsed,
  parseIdCardFields,
  buildPassportFieldTrace
} from './idCardOcrParse.js';

/** Upscale ID image before local Tesseract (Sex/DOB backup reads small label text better). */
export async function upscaleIdImageForOcr(bytes) {
  return sharp(bytes)
    .rotate()
    .resize({ width: 1800, withoutEnlargement: false })
    .png()
    .toBuffer();
}

/** Bottom-right crop where AAMVA field 15 Sex usually appears on US driver licenses. */
export async function cropSexZoneFromIdImage(bytes) {
  const rotated = sharp(bytes).rotate();
  const meta = await rotated.metadata();
  const w = meta.width || 1;
  const h = meta.height || 1;
  const zoneW = Math.max(1, Math.floor(w * 0.55));
  const zoneH = Math.max(1, Math.floor(h * 0.45));
  const left = Math.max(0, w - zoneW);
  const top = Math.max(0, h - zoneH);
  return rotated.extract({ left, top, width: zoneW, height: zoneH }).png().toBuffer();
}

/** Sharpen / upscale ID image for Tesseract backup pass (not sent to Rekognition). */
export async function enhanceIdImageForOcr(bytes) {
  return sharp(bytes)
    .rotate()
    .grayscale()
    .normalize()
    .sharpen()
    .resize({ width: 2200, withoutEnlargement: false })
    .jpeg({ quality: 92 })
    .toBuffer();
}

/**
 * Tesseract Sex detection: upscaled full card, then upscaled bottom-right Sex zone.
 * @returns {Promise<{ sex: string|null, lines: string[], zoneUsed: boolean }>}
 */
async function detectSexWithTesseractLayout(
  idBytes,
  { enhanced = false, preprocessedBytes = null, precomputedFullLines = null } = {}
) {
  const base =
    preprocessedBytes ?? (enhanced ? await enhanceIdImageForOcr(idBytes) : await upscaleIdImageForOcr(idBytes));

  const fullLines = precomputedFullLines ?? (await detectTextLinesWithTesseract(base));
  let sex = findSexFromTesseractLines(fullLines);
  if (sex) return { sex, lines: fullLines, zoneUsed: false };

  const zoneBytes = await cropSexZoneFromIdImage(base);
  const zoneLines = await detectTextLinesWithTesseract(zoneBytes);
  sex = findSexFromTesseractLines(zoneLines);
  return { sex, lines: sex ? zoneLines : fullLines, zoneUsed: Boolean(sex) };
}

function stepDisplayValue(step) {
  return step?.value ?? step?.dob ?? step?.sex ?? null;
}

function makeStep(key, label, value, error = null) {
  return {
    key,
    label,
    dob: value || null,
    sex: value || null,
    value: value || null,
    found: Boolean(value),
    ...(error ? { error } : {})
  };
}

function buildDobOcrTracePayload(trace, counts) {
  const saved = formatDlDobCapture(trace.selectedDob);
  return {
    ...trace,
    savedDlDob: saved,
    savedPpDob: saved,
    ...counts
  };
}

function buildSexOcrTracePayload(trace, counts) {
  const saved = formatDlSexCapture(trace.selectedSex);
  return {
    ...trace,
    savedDlSex: saved,
    savedPpSex: saved,
    ...counts
  };
}

/** PM2 / server log — one line per DOB OCR step. */
export function logDobOcrTrace(trace, { rekognitionLines = [], tesseractLines = [] } = {}) {
  if (!trace?.steps?.length) return;
  console.log('[rekognition:dob-ocr] === Date of Birth OCR trace ===');
  for (const step of trace.steps) {
    const errSuffix = step.error ? ` (error: ${step.error})` : '';
    console.log(
      `[rekognition:dob-ocr] ${step.label}: ${step.found ? stepDisplayValue(step) : 'not found'}${errSuffix}`
    );
  }
  if (trace.allFailed) {
    console.log('[rekognition:dob-ocr] ALL STEPS FAILED — singles.dl_dob saved as "not found"');
    if (rekognitionLines.length) {
      console.log('[rekognition:dob-ocr] Rekognition LINE sample:', rekognitionLines.slice(0, 25));
    }
    if (tesseractLines.length) {
      console.log('[rekognition:dob-ocr] Tesseract LINE sample:', tesseractLines.slice(0, 25));
    }
  } else {
    console.log(
      `[rekognition:dob-ocr] WINNER: ${trace.selectedStep} → DOB ${trace.selectedDob} → singles.dl_dob "${trace.savedDlDob}"`
    );
  }
}

/** PM2 / server log — one line per Sex OCR step. */
export function logSexOcrTrace(trace, { rekognitionLines = [], tesseractLines = [] } = {}) {
  if (!trace?.steps?.length) return;
  console.log('[rekognition:sex-ocr] === Sex OCR trace ===');
  for (const step of trace.steps) {
    const errSuffix = step.error ? ` (error: ${step.error})` : '';
    console.log(
      `[rekognition:sex-ocr] ${step.label}: ${step.found ? stepDisplayValue(step) : 'not found'}${errSuffix}`
    );
  }
  if (trace.allFailed) {
    console.log('[rekognition:sex-ocr] ALL STEPS FAILED — singles.dl_sex saved as "not found"');
    if (rekognitionLines.length) {
      console.log('[rekognition:sex-ocr] Rekognition LINE sample:', rekognitionLines.slice(0, 25));
    }
    if (tesseractLines.length) {
      console.log('[rekognition:sex-ocr] Tesseract LINE sample:', tesseractLines.slice(0, 25));
    }
  } else {
    console.log(
      `[rekognition:sex-ocr] WINNER: ${trace.selectedStep} → Sex ${trace.selectedSex} → singles.dl_sex "${trace.savedDlSex}"`
    );
  }
}

const STEP1_LABEL = '1. Primary — AWS Rekognition LINE text';
const STEP2_LABEL = '2. Backup — Tesseract OCR (local library, not AWS)';
const STEP3_LABEL = '3. Backup — Tesseract OCR on sharpened image (not AWS)';

/**
 * Step 1: AWS Rekognition LINE OCR (primary).
 * Steps 2–3: Tesseract.js local OCR backup (not AWS) — value on same line or next line below label.
 * DOB and Sex share Tesseract passes when either field still needs backup.
 * @param {Buffer|Uint8Array} idBytes
 */
export async function ocrParseIdCardFromImage(idBytes) {
  const rekognitionLines = await detectTextLines(idBytes);
  const dobSteps = [];
  const sexSteps = [];

  let selectedDob = findDateOfBirth(rekognitionLines);
  let selectedSex = findSex(rekognitionLines);
  let selectedDobStep = selectedDob ? 'rekognition-lines' : null;
  let selectedSexStep = selectedSex ? 'rekognition-lines' : null;

  const rekognitionParsedEarly = parseIdCardFields(rekognitionLines);
  let selectedPlaceOfBirth = rekognitionParsedEarly.countryOfBirth || findPlaceOfBirth(rekognitionLines);
  let selectedPlaceOfBirthStep = selectedPlaceOfBirth ? 'rekognition-lines' : null;
  const needsPlaceOfBirthBackup =
    rekognitionParsedEarly.documentType === 'passport' && !selectedPlaceOfBirth;

  dobSteps.push(makeStep('rekognition-lines', STEP1_LABEL, selectedDob));
  sexSteps.push(makeStep('rekognition-lines', STEP1_LABEL, selectedSex));

  let tesseractLines = [];
  let tesseractEnhancedLines = [];
  let ocrPassCount = 1;

  if (!selectedDob || !selectedSex || needsPlaceOfBirthBackup) {
    ocrPassCount = 2;
    try {
      const upscaledBytes = await upscaleIdImageForOcr(idBytes);
      tesseractLines = await detectTextLinesWithTesseract(upscaledBytes);

      if (!selectedDob) {
        const tesseractDob = findDateOfBirthFromTesseractLines(tesseractLines);
        dobSteps.push(makeStep('tesseract', STEP2_LABEL, tesseractDob));
        if (tesseractDob) {
          selectedDob = tesseractDob;
          selectedDobStep = 'tesseract';
        }
      }

      if (!selectedSex) {
        const { sex: tesseractSex, lines: sexLines, zoneUsed } = await detectSexWithTesseractLayout(idBytes, {
          enhanced: false,
          preprocessedBytes: upscaledBytes,
          precomputedFullLines: tesseractLines
        });
        if (sexLines.length && !tesseractLines.length) tesseractLines = sexLines;
        sexSteps.push(makeStep('tesseract', STEP2_LABEL, tesseractSex));
        if (tesseractSex) {
          selectedSex = tesseractSex;
          selectedSexStep = zoneUsed ? 'tesseract-sex-zone' : 'tesseract';
        }
      }

      if (needsPlaceOfBirthBackup && !selectedPlaceOfBirth) {
        const tesseractPlaceOfBirth = findPlaceOfBirthFromTesseractLines(tesseractLines);
        if (tesseractPlaceOfBirth) {
          selectedPlaceOfBirth = tesseractPlaceOfBirth;
          selectedPlaceOfBirthStep = 'tesseract';
        }
      }
    } catch (error) {
      const message = error?.message || 'Tesseract OCR failed';
      if (!selectedDob) {
        dobSteps.push(makeStep('tesseract', STEP2_LABEL, null, message));
      }
      if (!selectedSex) {
        sexSteps.push(makeStep('tesseract', STEP2_LABEL, null, message));
      }
    }
  }

  if (!selectedDob || !selectedSex || (needsPlaceOfBirthBackup && !selectedPlaceOfBirth)) {
    ocrPassCount = 3;
    try {
      const enhancedBytes = await enhanceIdImageForOcr(idBytes);
      tesseractEnhancedLines = await detectTextLinesWithTesseract(enhancedBytes);

      if (!selectedDob) {
        const enhancedDob = findDateOfBirthFromTesseractLines(tesseractEnhancedLines);
        dobSteps.push(makeStep('tesseract-enhanced', STEP3_LABEL, enhancedDob));
        if (enhancedDob) {
          selectedDob = enhancedDob;
          selectedDobStep = 'tesseract-enhanced';
        }
      }

      if (!selectedSex) {
        const { sex: enhancedSex, lines: sexLines, zoneUsed } = await detectSexWithTesseractLayout(idBytes, {
          enhanced: true,
          preprocessedBytes: enhancedBytes,
          precomputedFullLines: tesseractEnhancedLines
        });
        if (sexLines.length && !tesseractEnhancedLines.length) tesseractEnhancedLines = sexLines;
        sexSteps.push(makeStep('tesseract-enhanced', STEP3_LABEL, enhancedSex));
        if (enhancedSex) {
          selectedSex = enhancedSex;
          selectedSexStep = zoneUsed ? 'tesseract-enhanced-sex-zone' : 'tesseract-enhanced';
        }
      }

      if (needsPlaceOfBirthBackup && !selectedPlaceOfBirth) {
        const enhancedPlaceOfBirth = findPlaceOfBirthFromTesseractLines(tesseractEnhancedLines);
        if (enhancedPlaceOfBirth) {
          selectedPlaceOfBirth = enhancedPlaceOfBirth;
          selectedPlaceOfBirthStep = 'tesseract-enhanced';
        }
      }
    } catch (error) {
      const message = error?.message || 'Tesseract enhanced OCR failed';
      if (!selectedDob) {
        dobSteps.push(makeStep('tesseract-enhanced', STEP3_LABEL, null, message));
      }
      if (!selectedSex) {
        sexSteps.push(makeStep('tesseract-enhanced', STEP3_LABEL, null, message));
      }
    }
  }

  const counts = {
    ocrPassCount,
    rekognitionLineCount: rekognitionLines.length,
    tesseractLineCount: tesseractLines.length,
    tesseractEnhancedLineCount: tesseractEnhancedLines.length
  };

  const dobTraceCore = buildDobOcrTraceFromSteps(dobSteps);
  const sexTraceCore = buildSexOcrTraceFromSteps(sexSteps);

  const dobOcrTrace = buildDobOcrTracePayload(
    { ...dobTraceCore, selectedStep: selectedDobStep, selectedDob },
    counts
  );
  const sexOcrTrace = buildSexOcrTracePayload(
    { ...sexTraceCore, selectedStep: selectedSexStep, selectedSex },
    counts
  );

  const tesseractSampleLines = tesseractEnhancedLines.length ? tesseractEnhancedLines : tesseractLines;
  logDobOcrTrace(dobOcrTrace, { rekognitionLines, tesseractLines: tesseractSampleLines });
  logSexOcrTrace(sexOcrTrace, { rekognitionLines, tesseractLines: tesseractSampleLines });

  const rekognitionParsed = parseIdCardFields(rekognitionLines);
  const tesseractParsed = tesseractLines.length ? parseIdCardFields(tesseractLines) : null;
  const enhancedParsed = tesseractEnhancedLines.length ? parseIdCardFields(tesseractEnhancedLines) : null;
  const parsed = mergeIdCardParsed(rekognitionParsed, tesseractParsed, enhancedParsed);
  if (selectedDob) {
    parsed.dateOfBirth = selectedDob;
  }
  if (selectedSex) {
    parsed.sex = selectedSex;
  }
  if (selectedPlaceOfBirth) {
    parsed.countryOfBirth = selectedPlaceOfBirth;
  }

  const traceLineSet =
    tesseractEnhancedLines.length > 0
      ? tesseractEnhancedLines
      : tesseractLines.length > 0
        ? tesseractLines
        : rekognitionLines;
  const passportFieldTrace =
    parsed.documentType === 'passport'
      ? {
          ...buildPassportFieldTrace(traceLineSet),
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
          }
        }
      : null;

  return {
    parsed,
    lines: rekognitionLines,
    dobSource: selectedDobStep,
    sexSource: selectedSexStep,
    placeOfBirthSource: selectedPlaceOfBirthStep,
    dobOcrTrace,
    sexOcrTrace,
    ocrPassCount,
    passportFieldTrace
  };
}
