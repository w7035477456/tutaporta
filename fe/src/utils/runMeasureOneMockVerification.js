import { fetchMeasureOneEducationStatus, simulateMeasureOneEducationVerification } from 'api/measureoneFe';

/**
 * Runs the local MeasureOne demo flow (mock M1_ACADEMIC_RECORD / M1_DIGEST).
 * @returns {Promise<import('axios').AxiosResponse['data']>}
 */
export async function runMeasureOneMockVerification() {
  const status = await fetchMeasureOneEducationStatus();
  if (!status?.mockEnabled) {
    throw new Error(
      'MeasureOne demo mode is off. Remove API credentials from ~/.ssh/be/.env or set MEASUREONE_MOCK=true.'
    );
  }
  return simulateMeasureOneEducationVerification();
}
