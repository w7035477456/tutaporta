import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOCK_TRANSCRIPT_PATH = path.join(__dirname, '../../data/measureone/mock_transcript.json');

let cachedMockTranscript = null;

function toTrimmedText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

export async function loadMockTranscript() {
  if (cachedMockTranscript) return cachedMockTranscript;
  const raw = await fs.readFile(MOCK_TRANSCRIPT_PATH, 'utf8');
  cachedMockTranscript = JSON.parse(raw);
  return cachedMockTranscript;
}

export function academicRecordToAcademicSummary(academicRecord, datarequestId) {
  const institutionName = toTrimmedText(academicRecord?.institution?.name);
  const degrees = Array.isArray(academicRecord?.degrees) ? academicRecord.degrees : [];
  const primaryDegree = degrees[0] ?? null;

  return {
    processing_status: 'COMPLETED',
    datarequest_id: datarequestId,
    academic_summary: [
      {
        datasource: { name: institutionName },
        teaching_institution: { name: institutionName },
        degree_awarding_institution: { name: institutionName },
        degrees: degrees.map((degree) => ({
          type: toTrimmedText(degree?.type) || 'BACHELORS',
          description: toTrimmedText(degree?.title) || toTrimmedText(degree?.description),
          status: toTrimmedText(degree?.status) || 'AWARDED',
          awarded_date: toTrimmedText(degree?.confer_date) || toTrimmedText(degree?.awarded_date),
          major: toTrimmedText(degree?.major)
        }))
      }
    ]
  };
}

export async function buildMockAcademicSummaryResponse(datarequestId) {
  const mock = await loadMockTranscript();
  const requestId = toTrimmedText(datarequestId) || toTrimmedText(mock.datarequest_id) || 'dr_mock_demo_academic_summary';
  return academicRecordToAcademicSummary(mock.academic_record, requestId);
}

export function buildMockWebhookEvent(type, overrides = {}) {
  return {
    type,
    individual_id: overrides.individual_id,
    datarequest_id: overrides.datarequest_id,
    ...overrides
  };
}
