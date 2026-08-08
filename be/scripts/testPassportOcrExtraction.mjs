#!/usr/bin/env node
/**
 * Run passport OCR extraction against mock Rekognition line sets and optional cropped images.
 * Usage (from be/): node scripts/testPassportOcrExtraction.mjs
 */
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildPassportFieldTrace,
  findPassportLabelsInLines,
  mergeIdCardParsed,
  parseIdCardFields
} from '../utils/idCardOcrParse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FIXTURES = [
  {
    name: 'US Passport — Smith (booklet)',
    lines: [
      'PASSPORT',
      'UNITED STATES OF AMERICA',
      'Surname',
      'SMITH',
      'Given Names',
      'SAFIA NOELLE',
      'Nationality',
      'UNITED STATES OF AMERICA',
      'Place of Birth',
      'Virginia, U.S.A.',
      'Date of birth',
      '24 FEB / FEB 87',
      'Sex',
      'F',
      'P<USASMITH<<SAFIA<NOELLE<<<<<<<<<<<<<<',
      '1234567890USA8702249F28010101234567890123456789012'
    ],
    expect: {
      surname: 'Smith',
      givenNames: 'Safia',
      ppNationality: 'USA',
      dateOfBirth: '02/24/1987',
      placeOfBirth: 'Virginia, U.S.A.'
    }
  },
  {
    name: 'US Passport — Ton (slashes without spaces → VIETNAM)',
    lines: [
      'PASSPORT',
      'UNITED STATES OF AMERICA',
      'Surname / Nom / Apellidos',
      'TON',
      'Given Names / Prénoms / Nombres',
      'HUNG THAT',
      'Nationality / Nationalité / Nationalidad',
      'UNITED STATES OF AMERICA',
      'Place of birth/Lieu de naissance/Lugar de nacimiento',
      'VIETNAM',
      'Date of birth / Date de naissance / Fecha de nacimiento',
      '07 OCT 1968',
      'Sex / Sexe / Sexo',
      'M',
      'P<USATON<<HUNG<THAT<<<<<<<<<<<<<<<<<<<<<<<<',
      'A554409793USA6810074M3501139960957203<068926'
    ],
    expect: {
      surname: 'Ton',
      givenNames: 'Hung',
      ppNationality: 'USA',
      dateOfBirth: '10/07/1968',
      placeOfBirth: 'Vietnam'
    }
  },
  {
    name: 'US Passport — Ton (booklet, trilingual Place of birth → VIETNAM)',
    lines: [
      'PASSPORT',
      'UNITED STATES OF AMERICA',
      'Surname / Nom / Apellidos',
      'TON',
      'Given Names / Prénoms / Nombres',
      'HUNG THAT',
      'Nationality / Nationalité / Nationalidad',
      'UNITED STATES OF AMERICA',
      'Place of birth / Lieu de naissance / Lugar de nacimiento',
      'VIETNAM',
      'Date of birth / Date de naissance / Fecha de nacimiento',
      '07 OCT 1968',
      'Sex / Sexe / Sexo',
      'M',
      'P<USATON<<HUNG<THAT<<<<<<<<<<<<<<<<<<<<<<<<',
      'A554409793USA6810074M3501139960957203<068926'
    ],
    expect: {
      surname: 'Ton',
      givenNames: 'Hung',
      ppNationality: 'USA',
      dateOfBirth: '10/07/1968',
      placeOfBirth: 'Vietnam'
    }
  },
  {
    name: 'UK Passport — Webb (booklet)',
    lines: [
      'PASSPORT',
      'UNITED KINGDOM OF GREAT BRITAIN AND NORTHERN IRELAND',
      'Surname',
      'WEBB',
      'Given names',
      'JAMES ROBERT',
      'Nationality',
      'BRITISH CITIZEN',
      'Date of birth',
      '17 FEB / FEV 77',
      'Sex',
      'M',
      'P<GBRWEBB<<JAMES<ROBERT<<<<<<<<<<<<<<',
      '5182425917GBR7702174M2404244123456789012345678901234'
    ],
    expect: { surname: 'Webb', givenNames: 'James', ppNationality: 'GBR', dateOfBirth: '02/17/1977' }
  },
  {
    name: 'US Passport — Ho (booklet, bilingual labels)',
    lines: [
      'PASSPORT',
      'UNITED STATES OF AMERICA',
      'Surname / Nom',
      'HO',
      'Given Names / Prénoms',
      'NGOC ANH THI',
      'Nationality / Nationalité',
      'UNITED STATES OF AMERICA',
      'Date of birth / Date de naissance',
      '08 Mar 1979',
      'Sex / Sexe',
      'F',
      'P<USAHO<<NGOC<ANH<THI<<<<<<<<<<<<<<<',
      '6792901860USA7903085F320715469180803812345678901234567890'
    ],
    expect: { surname: 'Ho', givenNames: 'Ngoc', ppNationality: 'USA', dateOfBirth: '03/08/1979' }
  },
  {
    name: 'US Passport Card — Traveler',
    lines: [
      'PASSPORT CARD',
      'United States of America',
      'Nationality',
      'USA',
      'Surname',
      'TRAVELER',
      'Given Names',
      'HAPPY',
      'Sex',
      'M',
      'Date of Birth',
      '1 JAN 1981',
      'Passport Card No.',
      'C03005988'
    ],
    expect: { surname: 'Traveler', givenNames: 'Happy', ppNationality: 'USA', dateOfBirth: '01/01/1981' }
  }
];

function printFixtureResult(fixture) {
  const parsed = parseIdCardFields(fixture.lines);
  const trace = buildPassportFieldTrace(fixture.lines);
  const labels = findPassportLabelsInLines(fixture.lines).map((item) => item.label);

  console.log('\n' + '='.repeat(72));
  console.log(fixture.name);
  console.log('='.repeat(72));
  console.log('Labels found:', labels.length ? labels.join(', ') : '(none)');
  console.log('Fields extracted:');
  console.log('  Surname (last):', trace.fields.surname ?? '—');
  console.log('  Given Names (first):', trace.fields.givenNames ?? '—');
  console.log('  Middle:', trace.fields.middleName ?? '—');
  console.log('  Nationality (display):', trace.fields.nationality ?? '—');
  console.log('  pp_nationality (ISO3):', trace.fields.ppNationality ?? '—');
  console.log('  Date of birth:', trace.fields.dateOfBirth ?? '—');
  console.log('  Place of Birth:', trace.fields.placeOfBirth ?? '—');
  console.log('  Sex:', trace.fields.sex ?? '—');
  console.log('  documentType:', trace.fields.documentType ?? '—');

  const checks = [
    ['surname', trace.fields.surname, fixture.expect.surname],
    ['givenNames', trace.fields.givenNames, fixture.expect.givenNames],
    ['ppNationality', trace.fields.ppNationality, fixture.expect.ppNationality],
    ['dateOfBirth', trace.fields.dateOfBirth, fixture.expect.dateOfBirth],
    ['placeOfBirth', trace.fields.placeOfBirth, fixture.expect.placeOfBirth]
  ];
  const failed = checks.filter(([, got, want]) => {
    if (want == null) return false;
    return String(got ?? '').toLowerCase() !== String(want).toLowerCase() &&
      !String(got ?? '').toLowerCase().startsWith(String(want).toLowerCase());
  });
  if (failed.length) {
    console.log('EXPECT mismatches:', failed.map(([k, got, want]) => `${k}: got "${got}" want "${want}"`).join('; '));
  } else {
    console.log('EXPECT: OK');
  }
  return failed.length === 0;
}

async function runImageCropsIfAvailable() {
  const composite = '/Users/a/.cursor/projects/Users-a-code-main/assets/image-6e732b75-2b9a-4907-ac83-26925bcbcace.png';
  let sharp;
  let detectTextLinesWithTesseract;
  try {
    ({ default: sharp } = await import('sharp'));
    ({ detectTextLinesWithTesseract } = await import('../utils/localTesseractOcr.js'));
  } catch {
    return;
  }
  const fs = await import('fs');
  if (!fs.existsSync(composite)) {
    console.log('\n(Image crops skipped — composite not found)');
    return;
  }

  const crops = [
    { name: 'Crop US Smith', region: { left: 290, top: 10, width: 210, height: 260 } },
    { name: 'Crop UK Webb', region: { left: 510, top: 10, width: 230, height: 260 } },
    { name: 'Crop US Ho', region: { left: 10, top: 300, width: 380, height: 290 } },
    { name: 'Crop US Passport Card', region: { left: 410, top: 300, width: 600, height: 290 } }
  ];

  console.log('\n' + '#'.repeat(72));
  console.log('TESSERACT on cropped passport images (best-effort)');
  console.log('#'.repeat(72));

  for (const crop of crops) {
    try {
      const buf = await sharp(composite).extract(crop.region).png().toBuffer();
      const lines = await detectTextLinesWithTesseract(buf);
      const parsed = parseIdCardFields(lines);
      const labels = findPassportLabelsInLines(lines).map((item) => item.label);
      console.log(`\n--- ${crop.name} (${lines.length} lines) ---`);
      console.log('Labels found:', labels.length ? labels.join(', ') : '(none)');
      console.log('  Surname:', parsed.lastName ?? '—');
      console.log('  Given Names:', parsed.firstName ?? '—');
      console.log('  pp_nationality:', parsed.ppNationality ?? '—');
      console.log('  DOB:', parsed.dateOfBirth ?? '—');
      if (lines.length <= 20) {
        console.log('  Lines:', lines.join(' | '));
      } else {
        console.log('  Lines sample:', lines.slice(0, 18).join(' | '));
      }
    } catch (err) {
      console.log(`\n--- ${crop.name}: ERROR ${err?.message || err} ---`);
    }
  }
}

let passCount = 0;
for (const fixture of FIXTURES) {
  if (printFixtureResult(fixture)) passCount += 1;
}

console.log(`\nMock fixtures: ${passCount}/${FIXTURES.length} passed`);

if (process.env.RUN_PASSPORT_TESSERACT_CROPS === '1') {
  await runImageCropsIfAvailable();
} else {
  console.log('\n(Set RUN_PASSPORT_TESSERACT_CROPS=1 to run Tesseract on cropped images)');
}
